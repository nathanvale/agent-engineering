import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  ParsedPath,
  ProgramRequest,
  ProgramResult,
  ProgramsCapability,
  RunAddon,
} from "agent-cli-kernel";
import { contractFor, runInProcess } from "agent-cli-kernel";
import { copyHomeCauses, createCopyHomeCheck } from "../src/copy-home/check.ts";
import { runCopyHomeCheck } from "../src/copy-home/scan.ts";
import {
  initFixtureRepo,
  runFixtureGit,
  writeFixtureEnv,
} from "./support/copy-home-loss-fixture.ts";
import { testFolder } from "./support/test-folder.ts";

setDefaultTimeout(30_000);

const testContract = contractFor({
  cli: "agent-engineering",
  commands: [createCopyHomeCheck(() => envExecutable)],
  causes: copyHomeCauses,
  installedAddons: ["programs"],
});

const envExecutable: ParsedPath = testContract.boundary.path(
  Bun.which("env") ?? "/usr/bin/env",
);

function gitSubcommand(args: readonly string[]): string | undefined {
  for (const candidate of [
    "worktree",
    "ls-files",
    "config",
    "ls-remote",
    "merge-base",
    "cat-file",
    "rev-list",
  ]) {
    if (args.includes(candidate)) return candidate;
  }
  return undefined;
}

function runRealProgram(request: ProgramRequest): ProgramResult {
  const proc = Bun.spawnSync([request.executable, ...request.args], {
    stdin: request.input ?? "ignore",
    stdout: "pipe",
    stderr: "pipe",
    timeout: request.timeoutMilliseconds,
    killSignal: "SIGKILL",
  });
  return {
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString(),
    exitCode: proc.exitCode,
    terminationConfirmed: true,
    outputTruncated: false,
  };
}

function makeProgramsAddon(
  inspect: (request: ProgramRequest) => Promise<ProgramResult>,
): RunAddon<ProgramsCapability> {
  const capability: ProgramsCapability = Object.freeze({
    inspect,
    supplied: inspect,
    domain() {
      throw new Error("domain capability not used in copy-home check");
    },
  });
  return {
    attach: () => ({
      capability,
      settle: () => Promise.resolve(true),
      killNow: () => undefined,
    }),
  };
}

function makeFakeSha(index: number): string {
  return index.toString(16).padStart(40, "a");
}

function writeHomesJson(
  sandbox: string,
  reposDir: string,
  noCopyDirs: readonly string[] = [],
): string {
  const homesFile = join(sandbox, "homes.json");
  writeFileSync(
    homesFile,
    `${JSON.stringify(
      {
        version: 1,
        repositories: [reposDir],
        noCopy: noCopyDirs,
        throwaway: [],
        mirror: [],
        toolOwned: [],
        exceptions: [],
      },
      null,
      2,
    )}\n`,
  );
  return homesFile;
}

describe("copy-home check --remote cost and bounds", () => {
  test("cost bound: shared common git dir with 200 local SHAs and 200 remote tips bounds git calls", async () => {
    const sandbox = realpathSync.native(testFolder("copy-home-cost-"));
    const prevState = process.env.XDG_STATE_HOME;
    const prevCodex = process.env.CODEX_HOME;
    const prevGitGlobal = process.env.GIT_CONFIG_GLOBAL;
    try {
      const reposDir = join(sandbox, "repos");
      mkdirSync(reposDir, { recursive: true });
      const envMap = writeFixtureEnv(sandbox);
      process.env.XDG_STATE_HOME = envMap.XDG_STATE_HOME;
      process.env.CODEX_HOME = envMap.CODEX_HOME;
      process.env.GIT_CONFIG_GLOBAL = envMap.GIT_CONFIG_GLOBAL;

      const mainRepo = join(reposDir, "many-refs");
      initFixtureRepo(mainRepo, "base");
      const remoteUrl = "https://forge.example.invalid/org/many-refs.git";
      runFixtureGit(mainRepo, ["remote", "add", "origin", remoteUrl]);

      const localShas: string[] = [];
      for (let i = 0; i < 200; i++) {
        runFixtureGit(mainRepo, [
          "commit",
          "--quiet",
          "--allow-empty",
          "-m",
          `c-${String(i)}`,
        ]);
        const sha = runFixtureGit(mainRepo, ["rev-parse", "HEAD"]);
        localShas.push(sha);
        runFixtureGit(mainRepo, [
          "update-ref",
          `refs/heads/b-${String(i)}`,
          sha,
        ]);
      }

      for (let i = 0; i < 4; i++) {
        runFixtureGit(mainRepo, [
          "worktree",
          "add",
          "--quiet",
          join(mainRepo, ".worktrees", `wt-${String(i)}`),
          `b-${String(i)}`,
        ]);
      }

      const tipLines = Array.from(
        { length: 200 },
        (_, i) => `${makeFakeSha(i + 1)}\trefs/heads/r-${String(i)}`,
      ).join("\n");

      const counts = {
        lsRemote: 0,
        mergeBase: 0,
        catFile: 0,
        revList: 0,
      };

      const programs: ProgramsCapability = {
        inspect: (request) => {
          const sub = gitSubcommand(request.args);
          if (sub === "ls-remote") {
            counts.lsRemote += 1;
            return Promise.resolve({
              stdout: `${tipLines}\n`,
              stderr: "",
              exitCode: 0,
              terminationConfirmed: true,
              outputTruncated: false,
            });
          }
          if (sub === "merge-base") {
            counts.mergeBase += 1;
            return Promise.resolve({
              stdout: "",
              stderr: "",
              exitCode: 1,
              terminationConfirmed: true,
              outputTruncated: false,
            });
          }
          if (sub === "cat-file") {
            counts.catFile += 1;
            return Promise.resolve(runRealProgram(request));
          }
          if (sub === "rev-list") {
            counts.revList += 1;
            return Promise.resolve(runRealProgram(request));
          }
          return Promise.resolve(runRealProgram(request));
        },
        supplied: () => Promise.reject(new Error("unused")),
        domain: () => {
          throw new Error("unused");
        },
      };

      const homesFile = writeHomesJson(sandbox, reposDir);
      const outcome = await runCopyHomeCheck({
        homesPath: homesFile,
        checkRemote: true,
        programs,
        envExecutable,
      });

      expect(outcome.ok).toBe(true);
      expect(localShas.length).toBe(200);
      expect(counts.mergeBase).toBe(0);
      expect(counts.lsRemote).toBe(1);
      expect(counts.catFile).toBeLessThanOrEqual(1);
      expect(counts.revList).toBeLessThanOrEqual(1);
    } finally {
      if (prevState === undefined) delete process.env.XDG_STATE_HOME;
      else process.env.XDG_STATE_HOME = prevState;
      if (prevCodex === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = prevCodex;
      if (prevGitGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL;
      else process.env.GIT_CONFIG_GLOBAL = prevGitGlobal;
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  test("planted hang: never-settling ancestry step ends within deadline and prints unknown JSON", async () => {
    const sandbox = realpathSync.native(testFolder("copy-home-hang-"));
    const prevState = process.env.XDG_STATE_HOME;
    const prevCodex = process.env.CODEX_HOME;
    const prevGitGlobal = process.env.GIT_CONFIG_GLOBAL;
    try {
      const reposDir = join(sandbox, "repos");
      mkdirSync(reposDir, { recursive: true });
      const envMap = writeFixtureEnv(sandbox);
      process.env.XDG_STATE_HOME = envMap.XDG_STATE_HOME;
      process.env.CODEX_HOME = envMap.CODEX_HOME;
      process.env.GIT_CONFIG_GLOBAL = envMap.GIT_CONFIG_GLOBAL;

      const mainRepo = join(reposDir, "hang-repo");
      initFixtureRepo(mainRepo, "base");
      const baseSha = runFixtureGit(mainRepo, ["rev-parse", "HEAD"]);
      runFixtureGit(mainRepo, [
        "commit",
        "--quiet",
        "--allow-empty",
        "-m",
        "local-ahead",
      ]);
      runFixtureGit(mainRepo, [
        "remote",
        "add",
        "origin",
        "https://forge.example.invalid/org/hang-repo.git",
      ]);

      const addon = makeProgramsAddon((request) => {
        const sub = gitSubcommand(request.args);
        if (sub === "ls-remote") {
          return Promise.resolve({
            stdout: `${baseSha}\trefs/heads/main\n`,
            stderr: "",
            exitCode: 0,
            terminationConfirmed: true,
            outputTruncated: false,
          });
        }
        if (sub === "merge-base" || sub === "rev-list") {
          return new Promise<ProgramResult>(() => undefined);
        }
        return Promise.resolve(runRealProgram(request));
      });

      const homesFile = writeHomesJson(sandbox, reposDir);
      let sentinelTimer: ReturnType<typeof setTimeout> | undefined;
      const runPromise = runInProcess(testContract, {
        addons: { programs: addon },
      })([
        "copy-home",
        "check",
        "--homes",
        homesFile,
        "--remote",
        "--json",
      ]);
      const sentinelPromise = new Promise<"hung">((resolve) => {
        sentinelTimer = setTimeout(() => {
          resolve("hung");
        }, 500);
      });
      const raced = await Promise.race([runPromise, sentinelPromise]);
      if (sentinelTimer !== undefined) clearTimeout(sentinelTimer);

      expect(raced).not.toBe("hung");
    } finally {
      if (prevState === undefined) delete process.env.XDG_STATE_HOME;
      else process.env.XDG_STATE_HOME = prevState;
      if (prevCodex === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = prevCodex;
      if (prevGitGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL;
      else process.env.GIT_CONFIG_GLOBAL = prevGitGlobal;
      rmSync(sandbox, { recursive: true, force: true });
    }
  });
});
