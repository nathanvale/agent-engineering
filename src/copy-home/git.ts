import { lstatSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import type {
  ParsedPath,
  ProgramResult,
  ProgramsCapability,
} from "agent-cli-kernel";
import {
  isAllowedConfigKey,
  parseNullConfigKeys,
  resolveGitConfigFiles,
} from "./git-config.ts";
import {
  type CopyKind,
  compareText,
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

const safeGitEnvArgs = [
  "GIT_OPTIONAL_LOCKS=0",
  "GIT_TERMINAL_PROMPT=0",
  "GIT_CONFIG_NOSYSTEM=1",
  "GIT_SSH_COMMAND=ssh -o BatchMode=yes",
  "GIT_ASKPASS=",
  "SSH_ASKPASS=",
  "GIT_EXTERNAL_DIFF=",
] as const;

const isolatedTransportEnvArgs = [
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
  ...safeGitEnvArgs,
  "GIT_CONFIG_GLOBAL=/dev/null",
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

export type LocalConfigCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

export type LsRemoteResult =
  | { readonly ok: true; readonly shas: readonly string[] }
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
  readonly checkLocalConfig: (
    repoPath: string,
    kind: CopyKind,
  ) => Promise<LocalConfigCheck>;
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
    effectiveUrl: string,
    emptyTransportDir: string | undefined,
  ) => Promise<LsRemoteResult>;
  readonly commitExists: (repoPath: string, sha: string) => Promise<boolean>;
  readonly hasUncontainedCommits: (
    repoPath: string,
    localShas: readonly string[],
    remoteShas: readonly string[],
  ) => Promise<{ readonly ok: boolean; readonly uncontained: boolean }>;
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

  async function execGit(
    repoPath: string,
    args: readonly string[],
    timeoutMilliseconds = localGitTimeoutMs,
  ): Promise<ProgramResult | undefined> {
    return execEnvGit(
      safeGitEnvArgs,
      ["-C", repoPath, ...safeGitConfigArgs, ...args],
      timeoutMilliseconds,
    );
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

    async checkLocalConfig(repoPath, kind) {
      const configFiles = resolveGitConfigFiles(repoPath, kind);
      if (configFiles === undefined) {
        return { ok: false, reason: "cannot read repository git config" };
      }
      const disallowed = new Set<string>();
      for (const configFile of configFiles) {
        const res = await execEnvGit(isolatedTransportEnvArgs, [
          "config",
          "--file",
          configFile,
          "--list",
          "--null",
          "--no-includes",
        ]);
        if (res === undefined || res.exitCode !== 0) {
          return { ok: false, reason: "cannot read repository git config" };
        }
        for (const key of parseNullConfigKeys(res.stdout)) {
          if (!isAllowedConfigKey(key)) disallowed.add(key);
        }
      }
      if (disallowed.size > 0) {
        const names = [...disallowed].sort(compareText);
        return {
          ok: false,
          reason: `disallowed repository git config key(s): ${names.join(", ")}`,
        };
      }
      return { ok: true };
    },

    async statusPorcelain(repoPath) {
      const res = await execGit(repoPath, [
        "status",
        "--porcelain=v1",
        "--untracked-files=normal",
        "--ignore-submodules=all",
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

    async lsRemoteShas(effectiveUrl, emptyTransportDir) {
      if (emptyTransportDir === undefined) {
        return {
          ok: false,
          reason: "no empty working directory available for git ls-remote",
        };
      }
      const res = await execEnvGit(
        isolatedTransportEnvArgs,
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
