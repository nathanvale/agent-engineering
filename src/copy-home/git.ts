import type {
  ParsedPath,
  ProgramResult,
  ProgramsCapability,
} from "agent-cli-kernel";
import {
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

export type GitRunner = {
  readonly worktreeList: (
    repoPath: string,
  ) => Promise<readonly WorktreeEntry[] | undefined>;
  readonly stageGitlinks: (repoPath: string) => Promise<ReadonlySet<string>>;
  readonly gitmodulesPaths: (
    repoPath: string,
    filePath: string,
  ) => Promise<readonly string[]>;
  readonly statusPorcelain: (
    repoPath: string,
  ) => Promise<{ readonly ok: boolean; readonly dirty: boolean }>;
  readonly hasStash: (
    repoPath: string,
  ) => Promise<{ readonly ok: boolean; readonly present: boolean }>;
  readonly localCommitShas: (
    repoPath: string,
  ) => Promise<{ readonly ok: boolean; readonly shas: readonly string[] }>;
  readonly remotes: (
    repoPath: string,
  ) => Promise<{ readonly ok: boolean; readonly names: readonly string[] }>;
  readonly effectiveRemoteUrl: (
    repoPath: string,
    remote: string,
  ) => Promise<string | undefined>;
  readonly lsRemoteShas: (
    repoPath: string,
    remote: string,
  ) => Promise<readonly string[] | undefined>;
  readonly commitExists: (repoPath: string, sha: string) => Promise<boolean>;
  readonly hasUncontainedCommits: (
    repoPath: string,
    localShas: readonly string[],
    remoteShas: readonly string[],
  ) => Promise<{ readonly ok: boolean; readonly uncontained: boolean }>;
};

function parseLocalRefShas(stdout: string): Set<string> {
  const shas = new Set<string>();
  for (const rawLine of stdout.split("\n")) {
    const line = rawLine.trim();
    const space = line.indexOf(" ");
    if (space === -1) continue;
    const refName = line.slice(0, space);
    if (refName.startsWith("refs/remotes/") || refName === "refs/stash") {
      continue;
    }
    const sha = line.slice(space + 1).trim();
    if (sha.length > 0) shas.add(sha);
  }
  return shas;
}

export function createGitRunner(
  programs: ProgramsCapability,
  envExecutable: ParsedPath | undefined,
): GitRunner {
  const gitExecutable = Bun.which("git");

  async function execGit(
    repoPath: string,
    args: readonly string[],
    timeoutMilliseconds = localGitTimeoutMs,
  ): Promise<ProgramResult | undefined> {
    if (envExecutable === undefined || gitExecutable === null) return undefined;
    try {
      return await programs.inspect({
        executable: envExecutable,
        args: [
          "GIT_OPTIONAL_LOCKS=0",
          "GIT_TERMINAL_PROMPT=0",
          "GIT_SSH_COMMAND=ssh -o BatchMode=yes",
          gitExecutable,
          "-C",
          repoPath,
          "--no-optional-locks",
          ...args,
        ],
        timeoutMilliseconds,
        outputLimitBytes,
        shutdownMilliseconds: shutdownMs,
      });
    } catch {
      return undefined;
    }
  }

  return {
    async worktreeList(repoPath) {
      const res = await execGit(repoPath, ["worktree", "list", "--porcelain"]);
      if (res === undefined || res.exitCode !== 0) return undefined;
      return parseWorktreePorcelain(res.stdout);
    },

    async stageGitlinks(repoPath) {
      const res = await execGit(repoPath, ["ls-files", "--stage"]);
      if (res === undefined || res.exitCode !== 0) return new Set();
      return parseStageGitlinks(res.stdout);
    },

    async gitmodulesPaths(repoPath, filePath) {
      const res = await execGit(repoPath, [
        "config",
        "--file",
        filePath,
        "--get-regexp",
        "^submodule\\..*\\.path$",
      ]);
      if (res === undefined || res.exitCode !== 0) return [];
      return parseGitmodulesPaths(res.stdout);
    },

    async statusPorcelain(repoPath) {
      const res = await execGit(repoPath, [
        "status",
        "--porcelain=v1",
        "--untracked-files=normal",
      ]);
      if (res === undefined || res.exitCode !== 0) {
        return { ok: false, dirty: false };
      }
      return { ok: true, dirty: res.stdout.trim().length > 0 };
    },

    async hasStash(repoPath) {
      const res = await execGit(repoPath, ["stash", "list"]);
      if (res === undefined || res.exitCode !== 0) {
        return { ok: false, present: false };
      }
      return { ok: true, present: res.stdout.trim().length > 0 };
    },

    async localCommitShas(repoPath) {
      const refsRes = await execGit(repoPath, [
        "for-each-ref",
        "--format=%(refname) %(if)%(*objectname)%(then)%(*objectname)%(else)%(objectname)%(end)",
        "refs/",
      ]);
      if (refsRes === undefined || refsRes.exitCode !== 0) {
        return { ok: false, shas: [] };
      }
      const shas = parseLocalRefShas(refsRes.stdout);
      const headRes = await execGit(repoPath, [
        "rev-parse",
        "--verify",
        "-q",
        "HEAD^{commit}",
      ]);
      const headSha =
        headRes?.exitCode === 0 ? headRes.stdout.trim() : undefined;
      if (headSha !== undefined && headSha.length > 0) shas.add(headSha);
      return { ok: true, shas: [...shas] };
    },

    async remotes(repoPath) {
      const res = await execGit(repoPath, ["remote"]);
      if (res === undefined || res.exitCode !== 0) {
        return { ok: false, names: [] };
      }
      const names = res.stdout
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      return { ok: true, names };
    },

    async effectiveRemoteUrl(repoPath, remote) {
      const res = await execGit(repoPath, ["ls-remote", "--get-url", remote]);
      if (res === undefined || res.exitCode !== 0) return undefined;
      return res.stdout.trim();
    },

    async lsRemoteShas(repoPath, remote) {
      const res = await execGit(
        repoPath,
        ["ls-remote", remote],
        remoteGitTimeoutMs,
      );
      if (res === undefined || res.exitCode !== 0) return undefined;
      return parseLsRemoteShas(res.stdout);
    },

    async commitExists(repoPath, sha) {
      const res = await execGit(repoPath, [
        "rev-parse",
        "--verify",
        "-q",
        `${sha}^{commit}`,
      ]);
      return res !== undefined && res.exitCode === 0;
    },

    async hasUncontainedCommits(repoPath, localShas, remoteShas) {
      if (localShas.length === 0) return { ok: true, uncontained: false };
      if (remoteShas.length === 0) return { ok: true, uncontained: true };
      const res = await execGit(repoPath, [
        "rev-list",
        "--max-count=1",
        ...localShas,
        "--not",
        ...remoteShas,
      ]);
      if (res === undefined || res.exitCode !== 0) {
        return { ok: false, uncontained: false };
      }
      return { ok: true, uncontained: res.stdout.trim().length > 0 };
    },
  };
}
