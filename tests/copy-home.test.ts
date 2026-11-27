import { describe, expect, setDefaultTimeout, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fixtureScriptPath } from "./support/copy-home-fixture.ts";
import { shouldSkipLoopback } from "./support/loopback-connect-probe.ts";
import { testFolder } from "./support/test-folder.ts";

setDefaultTimeout(30_000);

const skipLoopback = await shouldSkipLoopback();

const cli = join(import.meta.dir, "../src/cli.ts");

function parseJson(text: string): unknown {
  return JSON.parse(text);
}

function runWithFixture(
  args: readonly string[],
  script: string,
): { exitCode: number; stdout: string; stderr: string; folder: string } {
  const folder = testFolder("copy-home-");
  const child = Bun.spawnSync(
    [
      process.execPath,
      fixtureScriptPath,
      folder,
      ...args,
      "--",
      "bash",
      "-c",
      script,
    ],
    {
      env: { ...process.env, CLI_PATH: cli },
      stdout: "pipe",
      stderr: "pipe",
      timeout: 25_000,
      killSignal: "SIGKILL",
    },
  );
  return {
    exitCode: child.exitCode,
    stdout: child.stdout.toString(),
    stderr: child.stderr.toString(),
    folder,
  };
}

function killQuietly(pid: number): void {
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    return;
  }
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitUntil(
  check: () => boolean,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return true;
    await new Promise<void>((resolve) => {
      const timer = setInterval(() => {
        clearInterval(timer);
        resolve();
      }, 25);
    });
  }
  return check();
}

describe("copy-home check", () => {
  test("AC-04 and AC-05: reports 20 planted findings red, touches nothing, then passes green after remove-planted", () => {
    const outDir = testFolder("copy-home-out-");
    const redOut = join(outDir, "red.json");
    const greenOut = join(outDir, "green.json");
    try {
      const ran = runWithFixture(
        [],
        [
          `bun run "$CLI_PATH" copy-home check --homes "$FIXTURE/homes.json" --json > ${JSON.stringify(redOut)}`,
          "RED_EXIT=$?",
          'touch "$FIXTURE/stamp"',
          'bun run "$CLI_PATH" copy-home check --homes "$FIXTURE/homes.json" --json > /dev/null',
          'TOUCHED=$(find "$FIXTURE" -newer "$FIXTURE/stamp" 2>/dev/null | wc -l | tr -d " ")',
          'bun run tests/support/copy-home-fixture.ts "$FIXTURE" --remove-planted',
          `bun run "$CLI_PATH" copy-home check --homes "$FIXTURE/homes.json" --json > ${JSON.stringify(greenOut)}`,
          "GREEN_EXIT=$?",
          'printf "%s\\n%s\\n%s\\n" "$RED_EXIT" "$TOUCHED" "$GREEN_EXIT"',
        ].join("\n"),
      );

      expect(existsSync(ran.folder)).toBe(false);
      expect(ran.exitCode).toBe(0);

      const lines = ran.stdout.split("\n");
      const redExit = Number(lines[0]);
      const touched = Number(lines[1]);
      const greenExit = Number(lines[2]);

      expect(redExit).not.toBe(0);
      expect(touched).toBe(0);
      expect(greenExit).toBe(0);

      const redEnvelope = parseJson(readFileSync(redOut, "utf8"));
      const greenEnvelope = parseJson(readFileSync(greenOut, "utf8"));

      expect(redEnvelope).toMatchObject({
        result: {
          causeCode: "DOMAIN_COPY_HOME_FINDINGS",
          data: {
            complete: false,
          },
        },
      });

      const redData: unknown = Reflect.get(
        Object(Reflect.get(Object(redEnvelope), "result")),
        "data",
      );
      const findings: unknown = Reflect.get(Object(redData), "findings");
      expect(Array.isArray(findings)).toBe(true);
      const findingList = Array.isArray(findings) ? findings : [];
      expect(findingList.length).toBe(20);

      const byKind = new Map<string, number>();
      for (const item of findingList) {
        const kind = String(Reflect.get(Object(item), "kind"));
        byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
      }
      expect(Object.fromEntries(byKind)).toEqual({
        "stray-copy": 13,
        "expired-throwaway": 3,
        "stray-worktree": 2,
        "dangling-registration": 1,
        "scan-incomplete": 1,
      });

      const copies: unknown = Reflect.get(Object(redData), "copies");
      expect(Array.isArray(copies)).toBe(true);
      const okPaths = (Array.isArray(copies) ? copies : [])
        .filter((entry) => Reflect.get(Object(entry), "verdict") === "ok")
        .map((entry) => String(Reflect.get(Object(entry), "path")));

      expect(okPaths.some((p) => p.endsWith(join("tmp", "fresh-clone")))).toBe(
        true,
      );
      expect(
        okPaths.some((p) => p.endsWith("/repos/main-repo/.worktrees/wt-task")),
      ).toBe(true);
      expect(okPaths.some((p) => p.endsWith("/tool-owned/wt-tool"))).toBe(true);
      expect(okPaths.some((p) => p.endsWith("/mirrors/cached-mirror"))).toBe(
        true,
      );
      expect(okPaths.some((p) => p.endsWith("/no-copy/excepted-repo"))).toBe(
        true,
      );
      expect(
        okPaths.some((p) =>
          p.endsWith("/repos/main-repo/submodules/valid-sub"),
        ),
      ).toBe(true);
      expect(
        okPaths.some((p) => p.endsWith("/repos/real-repo/.worktrees/wt-real")),
      ).toBe(true);

      expect(greenEnvelope).toMatchObject({
        result: {
          causeCode: "SUCCESS_UNCHANGED",
          data: {
            complete: true,
            findings: [],
          },
        },
      });
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  test("refuses a non-empty fixture root and leaves it untouched", () => {
    const folder = testFolder("copy-home-nonempty-");
    const sentinel = join(folder, "keep.txt");
    writeFileSync(sentinel, "keep\n");
    try {
      const cmd = [process.execPath, fixtureScriptPath, folder, "--", "true"];
      const child = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" });
      expect(child.exitCode).not.toBe(0);
      expect(child.stderr.toString()).toContain("empty");
      expect(existsSync(folder)).toBe(true);
      expect(readdirSync(folder)).toEqual(["keep.txt"]);
      expect(readFileSync(sentinel, "utf8")).toBe("keep\n");
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  test("refuses relative --homes path and reports scan-incomplete when no homes file exists", () => {
    const sandbox = testFolder("copy-home-edge-");
    try {
      const relRun = Bun.spawnSync(
        [
          process.execPath,
          "run",
          cli,
          "copy-home",
          "check",
          "--homes",
          "relative/homes.json",
          "--json",
        ],
        {
          cwd: sandbox,
          stdout: "pipe",
          stderr: "pipe",
          timeout: 15_000,
          killSignal: "SIGKILL",
        },
      );
      expect(relRun.exitCode).toBe(3);
      expect(parseJson(relRun.stdout.toString())).toMatchObject({
        result: {
          causeCode: "DOMAIN_COPY_HOME_INVALID_HOMES",
        },
      });

      const emptyConfig = join(sandbox, "config");
      const emptyState = join(sandbox, "state");
      const emptyCache = join(sandbox, "cache");
      const emptyData = join(sandbox, "data");
      const emptyTmp = join(sandbox, "tmp");
      for (const dir of [
        emptyConfig,
        emptyState,
        emptyCache,
        emptyData,
        emptyTmp,
      ]) {
        mkdirSync(dir, { recursive: true });
      }
      const noHomesRun = Bun.spawnSync(
        [process.execPath, "run", cli, "copy-home", "check", "--json"],
        {
          cwd: sandbox,
          env: {
            ...process.env,
            XDG_CONFIG_HOME: emptyConfig,
            XDG_STATE_HOME: emptyState,
            XDG_CACHE_HOME: emptyCache,
            XDG_DATA_HOME: emptyData,
            CODEX_HOME: join(sandbox, "codex"),
            TMPDIR: emptyTmp,
          },
          stdout: "pipe",
          stderr: "pipe",
          timeout: 15_000,
          killSignal: "SIGKILL",
        },
      );
      expect(noHomesRun.exitCode).toBe(3);
      const envelope = parseJson(noHomesRun.stdout.toString());
      expect(envelope).toMatchObject({
        result: {
          causeCode: "DOMAIN_COPY_HOME_FINDINGS",
          data: {
            complete: false,
          },
        },
      });
      const data: unknown = Reflect.get(
        Object(Reflect.get(Object(envelope), "result")),
        "data",
      );
      const findings: unknown = Reflect.get(Object(data), "findings");
      expect(
        (Array.isArray(findings) ? findings : []).some(
          (f) => Reflect.get(Object(f), "kind") === "scan-incomplete",
        ),
      ).toBe(true);
      writeFileSync(join(sandbox, "done.txt"), "ok\n");
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });
});

describe.skipIf(skipLoopback)("needs-loopback: copy-home check", () => {
  test("AC-06: loss check verdicts for cases 01 to 09 with --remote and read-only check", async () => {
    const ran = runWithFixture(
      ["--loss"],
      [
        'cat "$FIXTURE/daemon.pid"',
        'bun run "$CLI_PATH" copy-home check --homes "$FIXTURE/homes.json" --remote --json > "$FIXTURE/loss.json"',
        'touch "$FIXTURE/stamp"',
        'bun run "$CLI_PATH" copy-home check --homes "$FIXTURE/homes.json" --remote --json > /dev/null',
        'TOUCHED=$(find "$FIXTURE" -newer "$FIXTURE/stamp" | wc -l | tr -d " ")',
        'printf "%s\\n" "$TOUCHED"',
        'cat "$FIXTURE/loss.json"',
      ].join("\n"),
    );

    expect(existsSync(ran.folder)).toBe(false);
    expect(ran.exitCode).toBe(0);

    const lines = ran.stdout.split("\n");
    const daemonPid = Number(lines[0]?.trim());
    expect(Number.isSafeInteger(daemonPid) && daemonPid > 0).toBe(true);
    expect(await waitUntil(() => !processAlive(daemonPid), 5_000)).toBe(true);
    expect(processAlive(daemonPid)).toBe(false);

    expect(Number(lines[1])).toBe(0);
    const envelope = parseJson(lines.slice(2).join("\n"));
    const data: unknown = Reflect.get(
      Object(Reflect.get(Object(envelope), "result")),
      "data",
    );
    const copies: unknown = Reflect.get(Object(data), "copies");
    const lossEntries = (Array.isArray(copies) ? copies : [])
      .map((entry) => {
        const loss: unknown = Reflect.get(Object(entry), "loss");
        const reasons: unknown = Reflect.get(Object(loss), "reasons");
        return {
          path: String(Reflect.get(Object(entry), "path")),
          verdict: String(Reflect.get(Object(loss), "verdict")),
          reasons: Array.isArray(reasons) ? reasons.map((r) => String(r)) : [],
        };
      })
      .filter((entry) => entry.path.includes("/loss/"))
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

    const verdicts = lossEntries.map((entry) => entry.verdict);
    expect(verdicts).toEqual([
      "unknown",
      "unknown",
      "work-found",
      "work-found",
      "work-found",
      "work-found",
      "unknown",
      "unknown",
      "work-found",
    ]);
    expect(lossEntries[0]?.reasons).toContain("working tree not inspected");
    expect(lossEntries[1]?.reasons).toContain("working tree not inspected");
  });

  test("loss without --remote is unknown", async () => {
    const ran = runWithFixture(
      ["--loss"],
      [
        'cat "$FIXTURE/daemon.pid"',
        'bun run "$CLI_PATH" copy-home check --homes "$FIXTURE/homes.json" --json',
      ].join("\n"),
    );
    expect(existsSync(ran.folder)).toBe(false);
    expect(ran.exitCode).toBe(0);

    const lines = ran.stdout.split("\n");
    const daemonPid = Number(lines[0]?.trim());
    expect(Number.isSafeInteger(daemonPid) && daemonPid > 0).toBe(true);
    expect(await waitUntil(() => !processAlive(daemonPid), 5_000)).toBe(true);
    expect(processAlive(daemonPid)).toBe(false);

    const envelope = parseJson(lines.slice(1).join("\n"));
    const data: unknown = Reflect.get(
      Object(Reflect.get(Object(envelope), "result")),
      "data",
    );
    const copies: unknown = Reflect.get(Object(data), "copies");
    const cleanEntry: unknown = (Array.isArray(copies) ? copies : []).find(
      (entry) =>
        String(Reflect.get(Object(entry), "path")).endsWith("/loss/01-clean"),
    );
    expect(cleanEntry).toMatchObject({
      loss: {
        verdict: "unknown",
      },
    });
    const reasons: unknown = Reflect.get(
      Object(Reflect.get(Object(cleanEntry), "loss")),
      "reasons",
    );
    expect(
      (Array.isArray(reasons) ? reasons : []).some((r) =>
        String(r).includes("remote not checked"),
      ),
    ).toBe(true);
  });

  test("malformed lease makes every loss check unknown", async () => {
    const ran = runWithFixture(
      ["--loss"],
      [
        'cat "$FIXTURE/daemon.pid"',
        'BAD_DIR="$XDG_STATE_HOME/my-agent-dojo/agent-coordination/personal/coordinators/bad"',
        'mkdir -p "$BAD_DIR"',
        'printf "{not valid json" > "$BAD_DIR/lease.json"',
        'bun run "$CLI_PATH" copy-home check --homes "$FIXTURE/homes.json" --remote --json',
      ].join("\n"),
    );
    expect(existsSync(ran.folder)).toBe(false);
    expect(ran.exitCode).toBe(0);

    const lines = ran.stdout.split("\n");
    const daemonPid = Number(lines[0]?.trim());
    expect(Number.isSafeInteger(daemonPid) && daemonPid > 0).toBe(true);
    expect(await waitUntil(() => !processAlive(daemonPid), 5_000)).toBe(true);
    expect(processAlive(daemonPid)).toBe(false);

    const envelope = parseJson(lines.slice(1).join("\n"));
    const data: unknown = Reflect.get(
      Object(Reflect.get(Object(envelope), "result")),
      "data",
    );
    const copies: unknown = Reflect.get(Object(data), "copies");
    const list = Array.isArray(copies) ? copies : [];
    expect(list.length).toBeGreaterThan(0);
    for (const entry of list) {
      expect(
        Reflect.get(Object(Reflect.get(Object(entry), "loss")), "verdict"),
      ).toBe("unknown");
    }
  });

  test("a killed fixture builder leaves no daemon and no folder", async () => {
    const folder = testFolder("copy-home-kill-");
    const readyFile = join(folder, "ready");
    const child = Bun.spawn(
      [
        process.execPath,
        fixtureScriptPath,
        folder,
        "--loss",
        "--",
        "bash",
        "-c",
        `touch ${JSON.stringify(readyFile)} && cat`,
      ],
      {
        stdin: "pipe",
        stdout: "ignore",
        stderr: "ignore",
        detached: false,
        timeout: 25_000,
        killSignal: "SIGKILL",
      },
    );

    try {
      const ready = await waitUntil(
        () => existsSync(readyFile) && existsSync(join(folder, "daemon.pid")),
        10_000,
      );
      expect(ready).toBe(true);

      const daemonPid = Number(
        readFileSync(join(folder, "daemon.pid"), "utf8").trim(),
      );
      expect(processAlive(daemonPid)).toBe(true);

      process.kill(child.pid, "SIGKILL");
      await child.exited;

      const cleaned = await waitUntil(
        () => !processAlive(daemonPid) && !existsSync(folder),
        5_000,
      );
      expect(cleaned).toBe(true);
      expect(processAlive(daemonPid)).toBe(false);
      expect(existsSync(folder)).toBe(false);
    } finally {
      killQuietly(child.pid);
      await child.exited;
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
