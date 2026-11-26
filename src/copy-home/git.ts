import type {
  ParsedPath,
  ProgramResult,
  ProgramsCapability,
} from "agent-cli-kernel";
import {
  parseCatFileBatchCheck,
  parseGitmodulesPaths,
  parseLsRemoteShas,
  parseRevListShas,
  parseStageGitlinks,
  parseWorktreePorcelain,
  type WorktreeEntry,
} from "./rules.ts";

const localGitTimeoutMs = 10_000;
const remoteGitTimeoutMs = 20_000;
const outputLimitBytes = 2_097_152;
const shutdownMs = 1_000;
const filesystemRoot = "/";

const isolatedGitEnvArgs = [
  "-u",
  "GIT_DIR",
  "-u",
  "GIT_WORK_TREE",
  "-u",
  "GIT_COMMON_DIR",
  "-u",
  "GIT_INDEX_FILE",
  "-u",
  "GIT_CONFIG_PARAMETERS",
  "-u",
  "GIT_CONFIG_COUNT",
  "GIT_OPTIONAL_LOCKS=0",
  "GIT_TERMINAL_PROMPT=0",
  "GIT_CONFIG_NOSYSTEM=1",
  "GIT_CONFIG_GLOBAL=/dev/null",
  "GIT_SSH_COMMAND=ssh -o BatchMode=yes",
  "GIT_ASKPASS=",
  "SSH_ASKPASS=",
  "GIT_EXTERNAL_DIFF=",
  "GIT_NO_LAZY_FETCH=1",
] as const;

const noRepoGitEnvArgs = [
  ...isolatedGitEnvArgs,
  `GIT_CEILING_DIRECTORIES=${filesystemRoot}`,
] as const;

const safeGitConfigArgs = [
  "-c",
  "core.fsmonitor=false",
  "-c",
  "core.untrackedCache=false",
  "-c",
  "core.hooksPath=/dev/null",
  "-c",
  "credential.helper=",
  "-c",
  "core.sshCommand=ssh -o BatchMode=yes",
  "-c",
  "core.askPass=",
  "-c",
  "core.gitproxy=",
  "-c",
  "diff.external=",
  "-c",
  "core.pager=cat",
  "-c",
  "maintenance.auto=false",
  "-c",
  "gc.auto=0",
  "-c",
  "protocol.ext.allow=never",
] as const;

export type LsRemoteResult =
  | { readonly ok: true; readonly shas: readonly string[] }
  | { readonly ok: false; readonly reason: string };

export type ExistingObjectsResult =
  | {
      readonly ok: true;
      readonly present: readonly string[];
      readonly anyMissing: boolean;
    }
  | { readonly ok: false; readonly reason: string };

export type UncontainedShasResult =
  | { readonly ok: true; readonly uncontained: ReadonlySet<string> }
  | { readonly ok: false; readonly reason: string };

export type GitRunner = {
  readonly worktreeList: (
    repoPath: string,
  ) => Promise<readonly WorktreeEntry[] | undefined>;
  readonly stageGitlinks: (repoPath: string) => Promise<ReadonlySet<string>>;
  readonly gitmodulesPaths: (
    repoPath: string,
    filePath: string,
  ) => Promise<readonly string[]>;
  readonly lsRemoteShas: (effectiveUrl: string) => Promise<LsRemoteResult>;
  readonly existingObjects: (
    gitDir: string,
    shas: readonly string[],
  ) => Promise<ExistingObjectsResult>;
  readonly uncontainedShas: (
    gitDir: string,
    localShas: readonly string[],
    excludeTips: readonly string[],
  ) => Promise<UncontainedShasResult>;
};

const utf8Encoder = new TextEncoder();

export function createGitRunner(
  programs: ProgramsCapability,
  envExecutable: ParsedPath | undefined,
): GitRunner {
  const gitExecutable = Bun.which("git");

  async function execEnvGit(
    envArgs: readonly string[],
    gitArgs: readonly string[],
    timeoutMilliseconds = localGitTimeoutMs,
    input?: Uint8Array,
  ): Promise<ProgramResult | undefined> {
    if (envExecutable === undefined || gitExecutable === null) return undefined;
    try {
      return await programs.inspect({
        executable: envExecutable,
        args: [...envArgs, gitExecutable, "--no-optional-locks", ...gitArgs],
        ...(input !== undefined ? { input } : {}),
        timeoutMilliseconds,
        outputLimitBytes,
        shutdownMilliseconds: shutdownMs,
      });
    } catch {
      return undefined;
    }
  }

  async function execMainCheckoutGit(
    repoPath: string,
    args: readonly string[],
  ): Promise<ProgramResult | undefined> {
    return execEnvGit(
      isolatedGitEnvArgs,
      ["-C", repoPath, ...safeGitConfigArgs, ...args],
      localGitTimeoutMs,
    );
  }

  return {
    async worktreeList(repoPath) {
      const res = await execMainCheckoutGit(repoPath, [
        "worktree",
        "list",
        "--porcelain",
      ]);
      if (res === undefined || res.exitCode !== 0) return undefined;
      return parseWorktreePorcelain(res.stdout);
    },

    async stageGitlinks(repoPath) {
      const res = await execMainCheckoutGit(repoPath, ["ls-files", "--stage"]);
      if (res === undefined || res.exitCode !== 0) return new Set();
      return parseStageGitlinks(res.stdout);
    },

    async gitmodulesPaths(repoPath, filePath) {
      const res = await execMainCheckoutGit(repoPath, [
        "config",
        "--file",
        filePath,
        "--get-regexp",
        "^submodule\\..*\\.path$",
      ]);
      if (res === undefined || res.exitCode !== 0) return [];
      return parseGitmodulesPaths(res.stdout);
    },

    async lsRemoteShas(effectiveUrl) {
      const res = await execEnvGit(
        noRepoGitEnvArgs,
        [
          "-C",
          filesystemRoot,
          ...safeGitConfigArgs,
          "ls-remote",
          "--",
          effectiveUrl,
        ],
        remoteGitTimeoutMs,
      );
      if (res === undefined || res.exitCode !== 0) {
        return { ok: false, reason: "git ls-remote failed" };
      }
      return { ok: true, shas: parseLsRemoteShas(res.stdout) };
    },

    async existingObjects(gitDir, shas) {
      if (shas.length === 0) {
        return { ok: true, present: [], anyMissing: false };
      }
      const input = utf8Encoder.encode(`${shas.join("\n")}\n`);
      const res = await execEnvGit(
        [...noRepoGitEnvArgs, `GIT_DIR=${gitDir}`],
        [
          "-C",
          filesystemRoot,
          ...safeGitConfigArgs,
          "cat-file",
          "--batch-check",
        ],
        localGitTimeoutMs,
        input,
      );
      if (res === undefined || res.exitCode !== 0 || res.outputTruncated) {
        return { ok: false, reason: "git cat-file failed" };
      }
      const parsed = parseCatFileBatchCheck(res.stdout, shas.length);
      if (!parsed.ok) {
        return { ok: false, reason: "git cat-file output invalid" };
      }
      return {
        ok: true,
        present: parsed.present,
        anyMissing: parsed.anyMissing,
      };
    },

    async uncontainedShas(gitDir, localShas, excludeTips) {
      if (localShas.length === 0) {
        return { ok: true, uncontained: new Set() };
      }
      const lines = [...localShas, ...excludeTips.map((tip) => `^${tip}`)];
      const input = utf8Encoder.encode(`${lines.join("\n")}\n`);
      const res = await execEnvGit(
        [...noRepoGitEnvArgs, `GIT_DIR=${gitDir}`],
        ["-C", filesystemRoot, ...safeGitConfigArgs, "rev-list", "--stdin"],
        localGitTimeoutMs,
        input,
      );
      if (res === undefined || res.exitCode !== 0 || res.outputTruncated) {
        return { ok: false, reason: "git rev-list failed" };
      }
      return { ok: true, uncontained: parseRevListShas(res.stdout) };
    },
  };
}
