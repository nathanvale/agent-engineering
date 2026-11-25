import { lstatSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import type {
  ParsedPath,
  ProgramResult,
  ProgramsCapability,
} from "agent-cli-kernel";
import {
  isInsidePath,
  parseGitmodulesPaths,
  parseLsRemoteShas,
  parseStageGitlinks,
  parseWorktreePorcelain,
  type WorktreeEntry,
} from "./rules.ts";

const localGitTimeoutMs = 10_000;
const remoteGitTimeoutMs = 20_000;
const outputLimitBytes = 2_097_152;
const shutdownMs = 1_000;

function systemEmptyDirCandidates(): readonly string[] {
  const rootDir = parse(process.execPath).root;
  return [
    join(rootDir, "var", "empty"),
    join(rootDir, "run", "empty"),
    join(rootDir, "usr", "share", "empty"),
    join(rootDir, "usr", "share", "skel"),
  ];
}

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

export type AncestryResult = "ancestor" | "not-ancestor" | "unknown";

export type GitRunner = {
  readonly worktreeList: (
    repoPath: string,
  ) => Promise<readonly WorktreeEntry[] | undefined>;
  readonly stageGitlinks: (repoPath: string) => Promise<ReadonlySet<string>>;
  readonly gitmodulesPaths: (
    repoPath: string,
    filePath: string,
  ) => Promise<readonly string[]>;
  readonly lsRemoteShas: (
    effectiveUrl: string,
    emptyTransportDir: string | undefined,
  ) => Promise<LsRemoteResult>;
  readonly isAncestor: (
    gitDir: string,
    emptyTransportDir: string | undefined,
    localSha: string,
    remoteTip: string,
  ) => Promise<AncestryResult>;
};

function hasGitAncestor(dir: string): boolean {
  let current = dir;
  for (;;) {
    try {
      lstatSync(join(current, ".git"));
      return true;
    } catch {
      const parent = dirname(current);
      if (parent === current) return false;
      current = parent;
    }
  }
}

export function findEmptyTransportDir(
  scannedRoots: readonly string[],
): string | undefined {
  for (const candidate of systemEmptyDirCandidates()) {
    let real: string;
    try {
      real = realpathSync.native(candidate);
      if (!lstatSync(real).isDirectory()) continue;
      if (readdirSync(real).length !== 0) continue;
    } catch {
      continue;
    }
    if (
      scannedRoots.some(
        (root) => isInsidePath(real, root) || isInsidePath(root, real),
      )
    ) {
      continue;
    }
    if (hasGitAncestor(real)) continue;
    return real;
  }
  return undefined;
}

export function createGitRunner(
  programs: ProgramsCapability,
  envExecutable: ParsedPath | undefined,
): GitRunner {
  const gitExecutable = Bun.which("git");

  async function execEnvGit(
    envArgs: readonly string[],
    gitArgs: readonly string[],
    timeoutMilliseconds = localGitTimeoutMs,
  ): Promise<ProgramResult | undefined> {
    if (envExecutable === undefined || gitExecutable === null) return undefined;
    try {
      return await programs.inspect({
        executable: envExecutable,
        args: [...envArgs, gitExecutable, "--no-optional-locks", ...gitArgs],
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

    async lsRemoteShas(effectiveUrl, emptyTransportDir) {
      if (emptyTransportDir === undefined) {
        return {
          ok: false,
          reason: "no empty working directory available for git ls-remote",
        };
      }
      const res = await execEnvGit(
        isolatedGitEnvArgs,
        [
          "-C",
          emptyTransportDir,
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

    async isAncestor(gitDir, emptyTransportDir, localSha, remoteTip) {
      if (emptyTransportDir === undefined) return "unknown";
      const res = await execEnvGit(
        [...isolatedGitEnvArgs, `GIT_DIR=${gitDir}`],
        [
          "-C",
          emptyTransportDir,
          ...safeGitConfigArgs,
          "merge-base",
          "--is-ancestor",
          localSha,
          remoteTip,
        ],
        localGitTimeoutMs,
      );
      if (res === undefined) return "unknown";
      if (res.exitCode === 0) return "ancestor";
      if (res.exitCode === 1) return "not-ancestor";
      return "unknown";
    },
  };
}
