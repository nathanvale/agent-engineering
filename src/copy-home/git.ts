import type {
  ParsedPath,
  ProgramResult,
  ProgramsCapability,
} from "agent-cli-kernel";
import {
  compareText,
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
const unsafeFilterKeyPattern = /^filter\..+\.(clean|smudge|process)$/i;
const scopedCredentialHelperPattern = /^credential\..+\.helper$/i;
const safeGitEnvArgs = [
  "GIT_OPTIONAL_LOCKS=0",
  "GIT_TERMINAL_PROMPT=0",
  "GIT_CONFIG_NOSYSTEM=1",
  "GIT_SSH_COMMAND=ssh -o BatchMode=yes",
  "GIT_ASKPASS=",
  "SSH_ASKPASS=",
  "GIT_EXTERNAL_DIFF=",
] as const;

export type GitRunner = {
  readonly worktreeList: (
    repoPath: string,
  ) => Promise<readonly WorktreeEntry[] | undefined>;
  readonly stageGitlinks: (repoPath: string) => Promise<ReadonlySet<string>>;
  readonly gitmodulesPaths: (
    repoPath: string,
    filePath: string,
  ) => Promise<readonly string[]>;
  readonly statusPorcelain: (repoPath: string) => Promise<{
    readonly ok: boolean;
    readonly dirty: boolean;
    readonly reason?: string;
  }>;
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

function matchBlockedRepoConfigKey(
  key: string,
  value: string,
  hasValue: boolean,
): string | undefined {
  const lowerKey = key.toLowerCase();
  const trimmed = value.trim();
  if (unsafeFilterKeyPattern.test(key) && trimmed.length > 0) {
    return key;
  }
  if (lowerKey === "diff.external" && trimmed.length > 0) {
    return "diff.external";
  }
  if (
    lowerKey === "core.fsmonitor" &&
    (!hasValue || (trimmed.length > 0 && trimmed.toLowerCase() !== "false"))
  ) {
    return "core.fsmonitor";
  }
  return undefined;
}

function parseLocalConfigEntries(stdout: string): readonly {
  readonly key: string;
  readonly value: string;
  readonly hasValue: boolean;
}[] {
  const entries: {
    readonly key: string;
    readonly value: string;
    readonly hasValue: boolean;
  }[] = [];
  const parts = stdout.split("\0");
  for (let index = 0; index + 1 < parts.length; index += 2) {
    const scope = parts[index];
    const entry = parts[index + 1];
    if (
      (scope !== "local" && scope !== "worktree") ||
      entry === undefined ||
      entry.length === 0
    ) {
      continue;
    }
    const newline = entry.indexOf("\n");
    const key = newline === -1 ? entry : entry.slice(0, newline);
    const value = newline === -1 ? "" : entry.slice(newline + 1);
    entries.push({ key, value, hasValue: newline !== -1 });
  }
  return entries;
}

function parseBlockedRepoConfigKeys(stdout: string): readonly string[] {
  const blocked = new Set<string>();
  for (const { key, value, hasValue } of parseLocalConfigEntries(stdout)) {
    const match = matchBlockedRepoConfigKey(key, value, hasValue);
    if (match !== undefined) blocked.add(match);
  }
  return [...blocked].sort(compareText);
}

function hasScopedCredentialHelper(stdout: string): boolean {
  return parseLocalConfigEntries(stdout).some(
    ({ key, value }) =>
      scopedCredentialHelperPattern.test(key) && value.trim().length > 0,
  );
}

export function createGitRunner(
  programs: ProgramsCapability,
  envExecutable: ParsedPath | undefined,
  emptyHooksDir: string,
): GitRunner {
  const gitExecutable = Bun.which("git");
  const safeGitConfigArgs = [
    "-c",
    "core.fsmonitor=false",
    "-c",
    "core.untrackedCache=false",
    "-c",
    `core.hooksPath=${emptyHooksDir}`,
    "-c",
    "credential.helper=",
    "-c",
    "core.sshCommand=ssh -o BatchMode=yes",
    "-c",
    "core.askPass=",
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
          ...safeGitEnvArgs,
          gitExecutable,
          "-C",
          repoPath,
          "--no-optional-locks",
          ...safeGitConfigArgs,
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
      const configRes = await execGit(repoPath, [
        "config",
        "--list",
        "--show-scope",
        "--null",
      ]);
      if (configRes === undefined || configRes.exitCode !== 0) {
        return {
          ok: false,
          dirty: false,
          reason: "cannot read repository git config",
        };
      }
      const blockedKeys = parseBlockedRepoConfigKeys(configRes.stdout);
      if (blockedKeys.length > 0) {
        return {
          ok: false,
          dirty: false,
          reason: `skipped git status due to repository config: ${blockedKeys.join(", ")}`,
        };
      }
      const res = await execGit(repoPath, [
        "status",
        "--porcelain=v1",
        "--untracked-files=normal",
      ]);
      if (res === undefined || res.exitCode !== 0) {
        return { ok: false, dirty: false, reason: "git status failed" };
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
      const configRes = await execGit(repoPath, [
        "config",
        "--list",
        "--show-scope",
        "--null",
      ]);
      if (
        configRes === undefined ||
        configRes.exitCode !== 0 ||
        hasScopedCredentialHelper(configRes.stdout)
      ) {
        return undefined;
      }
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
