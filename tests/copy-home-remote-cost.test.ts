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
import {
  checkLocalShasAncestry,
  createLossRunCache,
  defaultLossDeadlines,
  type LocalShaStatus,
} from "../src/copy-home/ancestry.ts";
import { copyHomeCauses, createCopyHomeCheck } from "../src/copy-home/check.ts";
import { createGitRunner } from "../src/copy-home/git.ts";
import { runCopyHomeCheck } from "../src/copy-home/scan.ts";
import {
  initFixtureRepo,
  runFixtureGit,
  writeFixtureEnv,
} from "./support/copy-home-loss-fixture.ts";
import {
  copyLossReasons,
  copyLossVerdict,
  oracleIsAncestor,
} from "./support/copy-home-test-helpers.ts";
import { testFolder } from "./support/test-folder.ts";

setDefaultTimeout(30_000);

const shortDeadlines = { remoteMs: 100, localMs: 100 } as const;

const testContract = contractFor({
  cli: "agent-engineering",
  commands: [createCopyHomeCheck(() => envExecutable, shortDeadlines)],
  causes: copyHomeCauses,
  installedAddons: ["programs"],
});

const resolvedEnv = Bun.which("env");
if (resolvedEnv === null) {
  throw new Error("env executable not found on PATH");
}

const envExecutable: ParsedPath = testContract.boundary.path(resolvedEnv);

const trackedGitSubcommands = [
  "worktree",
  "ls-files",
  "config",
  "ls-remote",
  "merge-base",
  "cat-file",
  "rev-list",
] as const;

function gitSubcommand(args: readonly string[]): string | undefined {
  return trackedGitSubcommands.find((candidate) => args.includes(candidate));
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

function makeProgramsCapability(
  inspect: (request: ProgramRequest) => Promise<ProgramResult>,
): ProgramsCapability {
  return Object.freeze({
    inspect,
    supplied: inspect,
    domain() {
      throw new Error("domain capability not used in copy-home check");
    },
  });
}

function makeProgramsAddon(
  inspect: (request: ProgramRequest) => Promise<ProgramResult>,
): RunAddon<ProgramsCapability> {
  const capability = makeProgramsCapability(inspect);
  return {
    attach: () => ({
      capability,
      settle: () => Promise.resolve(true),
      killNow: () => undefined,
    }),
  };
}

function makeFakeSha(index: number): string {
  return `1${index.toString(16).padStart(39, "0")}`;
}

function writeHomesJson(
  sandbox: string,
  reposDir: string,
  noCopyDirs: readonly string[] = [],
): string {
  const homesFile = join(sandbox, "homes.json");
  const config = {
    version: 1,
    repositories: [reposDir],
    noCopy: noCopyDirs,
    throwaway: [],
    mirror: [],
    toolOwned: [],
    exceptions: [],
  };
  writeFileSync(homesFile, `${JSON.stringify(config, null, 2)}\n`);
  return homesFile;
}

function commitFile(
  repo: string,
  fileName: string,
  content: string,
  message: string,
): string {
  writeFileSync(join(repo, fileName), content);
  runFixtureGit(repo, ["add", "--", fileName]);
  runFixtureGit(repo, ["commit", "--quiet", "-m", message]);
  return runFixtureGit(repo, ["rev-parse", "HEAD"]);
}

async function verifyAncestryAgainstOracle(
  git: ReturnType<typeof createGitRunner>,
  gitDir: string,
  localShas: readonly string[],
  remoteTips: ReadonlySet<string>,
  expected: readonly (readonly [string, LocalShaStatus])[],
): Promise<void> {
  const result = await checkLocalShasAncestry({
    git,
    commonDir: gitDir,
    localShas,
    remoteTips,
    hasPartialClone: false,
    cache: createLossRunCache(),
    deadlines: defaultLossDeadlines,
  });
  for (const sha of localShas) {
    expect(result.verdicts.get(sha)).toBe(
      oracleIsAncestor(gitDir, sha, remoteTips),
    );
  }
  for (const [sha, status] of expected) {
    expect(result.verdicts.get(sha)).toBe(status);
  }
}

describe("copy-home check --remote cost and bounds", () => {
  test("equivalence: batched ancestry verdict matches per-pair git merge-base --is-ancestor oracle", async () => {
    const sandbox = realpathSync.native(testFolder("copy-home-equiv-"));
    try {
      const repo = join(sandbox, "repo");
      initFixtureRepo(repo, "root");
      const rootSha = runFixtureGit(repo, ["rev-parse", "HEAD"]);

      runFixtureGit(repo, ["checkout", "--quiet", "-b", "older"]);
      const olderCommitSha = commitFile(
        repo,
        "older.txt",
        "older\n",
        "older-1",
      );
      const olderTipSha = commitFile(repo, "older.txt", "older-2\n", "older-2");

      runFixtureGit(repo, ["checkout", "--quiet", "main"]);
      runFixtureGit(repo, ["checkout", "--quiet", "-b", "side"]);
      const sideCommitSha = commitFile(repo, "side.txt", "side\n", "side-1");

      runFixtureGit(repo, ["checkout", "--quiet", "main"]);
      const mainMidSha = commitFile(repo, "main.txt", "main\n", "main-1");
      runFixtureGit(repo, [
        "merge",
        "--quiet",
        "--no-ff",
        "side",
        "-m",
        "merge-side",
      ]);
      const mergeTipSha = runFixtureGit(repo, ["rev-parse", "HEAD"]);

      runFixtureGit(repo, ["checkout", "--quiet", "-b", "unpushed"]);
      const unpushedSha = commitFile(
        repo,
        "unpushed.txt",
        "unpushed\n",
        "unpushed-1",
      );
      const tag = (name: string, target: string): string => {
        runFixtureGit(repo, ["tag", "-a", "-m", name, name, target]);
        return runFixtureGit(repo, ["rev-parse", name]);
      };
      const unpushedTagSha = tag("unpushed-tag", unpushedSha);
      const pushedTagSha = tag("pushed-tag", sideCommitSha);
      const rootTreeSha = runFixtureGit(repo, [
        "rev-parse",
        `${rootSha}^{tree}`,
      ]);
      const treeTagSha = tag("tree-tag", rootTreeSha);

      const gitDir = join(repo, ".git");
      const localShas = [
        rootSha,
        olderCommitSha,
        olderTipSha,
        sideCommitSha,
        mainMidSha,
        mergeTipSha,
        unpushedSha,
        unpushedTagSha,
        pushedTagSha,
        treeTagSha,
      ];
      const realPrograms = makeProgramsCapability((request) =>
        Promise.resolve(runRealProgram(request)),
      );
      const git = createGitRunner(realPrograms, envExecutable);

      await verifyAncestryAgainstOracle(
        git,
        gitDir,
        localShas,
        new Set([mergeTipSha, olderTipSha]),
        [
          [olderCommitSha, "contained"],
          [sideCommitSha, "contained"],
          [unpushedSha, "unpushed"],
          [unpushedTagSha, "unpushed"],
          [pushedTagSha, "contained"],
          [treeTagSha, "undecided"],
        ],
      );
      await verifyAncestryAgainstOracle(
        git,
        gitDir,
        localShas,
        new Set([mergeTipSha, olderTipSha, makeFakeSha(999_999)]),
        [
          [olderCommitSha, "contained"],
          [sideCommitSha, "contained"],
          [unpushedSha, "undecided"],
          [unpushedTagSha, "undecided"],
          [pushedTagSha, "contained"],
          [treeTagSha, "undecided"],
        ],
      );
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

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
      const baseSha = runFixtureGit(mainRepo, ["rev-parse", "HEAD"]);
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

      const tipShas = [
        baseSha,
        ...Array.from({ length: 199 }, (_, i) => makeFakeSha(i + 1)),
      ];
      expect(new Set(tipShas).size).toBe(200);
      expect(new Set(localShas).size).toBe(200);
      const tipLines = tipShas
        .map((sha, i) => `${sha}\trefs/heads/r-${String(i)}`)
        .join("\n");

      const counts = {
        lsRemote: 0,
        mergeBase: 0,
        catFile: 0,
        revList: 0,
      };

      const programs = makeProgramsCapability((request) => {
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
      });

      const homesFile = writeHomesJson(sandbox, reposDir);
      const outcome = await runCopyHomeCheck({
        homesPath: homesFile,
        checkRemote: true,
        programs,
        envExecutable,
      });

      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.report.copies.length).toBe(5);
      }
      expect(counts.mergeBase).toBe(0);
      expect(counts.lsRemote).toBe(1);
      expect(counts.catFile).toBe(2);
      expect(counts.revList).toBe(1);
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
      const localAheadSha = runFixtureGit(mainRepo, ["rev-parse", "HEAD"]);
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
        if (sub === "cat-file") {
          const isPeel = request.args.includes("--batch-check=%(objectname)");
          return Promise.resolve({
            stdout: isPeel ? `${localAheadSha}\n` : `${baseSha} commit 100\n`,
            stderr: "",
            exitCode: 0,
            terminationConfirmed: true,
            outputTruncated: false,
          });
        }
        if (sub === "rev-list") {
          return new Promise<ProgramResult>(() => undefined);
        }
        return Promise.resolve(runRealProgram(request));
      });

      const homesFile = writeHomesJson(sandbox, reposDir);
      const runResult = await runInProcess(testContract, {
        addons: { programs: addon },
      })(["copy-home", "check", "--homes", homesFile, "--remote", "--json"]);

      expect(runResult.kind).toBe("envelope");
      if (runResult.kind !== "envelope") {
        throw new Error(`Expected envelope result, got ${runResult.kind}`);
      }
      expect(runResult.exitCode).toBe(0);
      const serialized = JSON.stringify(runResult.envelope);
      const envelope: unknown = JSON.parse(serialized);
      const data: unknown = Reflect.get(
        Object(Reflect.get(Object(envelope), "result")),
        "data",
      );
      expect(copyLossVerdict(data, mainRepo)).toBe("unknown");
      expect(copyLossReasons(data, mainRepo)).toContain(
        "git rev-list timed out",
      );
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
