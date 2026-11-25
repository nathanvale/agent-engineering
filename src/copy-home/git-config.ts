import { lstatSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import type { CopyKind } from "./rules.ts";

export type GitDirs = {
  readonly gitDir: string;
  readonly commonDir: string;
};

export type RemoteConfig = {
  readonly name: string;
  readonly url: string | undefined;
  readonly vcs: string | undefined;
};

export type InsteadOfRule = {
  readonly base: string;
  readonly insteadOf: string;
};

export type ParsedCopyGitConfig =
  | {
      readonly ok: true;
      readonly hasPartialClone: boolean;
      readonly hasUnsupportedRefStorage: boolean;
      readonly hasInclude: boolean;
      readonly remotes: readonly RemoteConfig[];
      readonly insteadOfRules: readonly InsteadOfRule[];
    }
  | {
      readonly ok: false;
      readonly reason: string;
    };

type ConfigEntry = {
  readonly section: string;
  readonly subsection: string | undefined;
  readonly key: string;
  readonly value: string;
};

type ConfigAccumulator = {
  hasPartialClone: boolean;
  hasUnsupportedRefStorage: boolean;
  hasInclude: boolean;
  readonly remoteMap: Map<string, { url?: string; vcs?: string }>;
  readonly insteadOfRules: InsteadOfRule[];
};

function errorCode(error: unknown): string | undefined {
  const code: unknown = Reflect.get(Object(error), "code");
  return typeof code === "string" ? code : undefined;
}

function checkOptionalRegularFile(
  path: string,
): "present" | "absent" | "invalid" {
  try {
    const stat = lstatSync(path);
    return !stat.isSymbolicLink() && stat.isFile() ? "present" : "invalid";
  } catch (error) {
    return errorCode(error) === "ENOENT" ? "absent" : "invalid";
  }
}

function isRegularDirectory(path: string): boolean {
  try {
    const stat = lstatSync(path);
    return !stat.isSymbolicLink() && stat.isDirectory();
  } catch {
    return false;
  }
}

function resolveCommonDir(gitDir: string): string | undefined {
  const commonDirFile = join(gitDir, "commondir");
  const status = checkOptionalRegularFile(commonDirFile);
  if (status === "invalid") return undefined;
  if (status === "absent") return gitDir;
  try {
    const relCommon = readFileSync(commonDirFile, "utf8").trim();
    if (relCommon.length === 0) return undefined;
    const commonDir = isAbsolute(relCommon)
      ? relCommon
      : resolve(gitDir, relCommon);
    return isRegularDirectory(commonDir) ? commonDir : undefined;
  } catch {
    return undefined;
  }
}

function resolveWorktreeGitDir(repoPath: string): string | undefined {
  const dotGit = join(repoPath, ".git");
  if (checkOptionalRegularFile(dotGit) !== "present") return undefined;
  let content: string;
  try {
    content = readFileSync(dotGit, "utf8");
  } catch {
    return undefined;
  }
  const match = /^gitdir:\s*(.+)$/m.exec(content);
  const rawTarget = match?.[1]?.trim();
  if (rawTarget === undefined || rawTarget.length === 0) return undefined;
  const gitDir = isAbsolute(rawTarget)
    ? rawTarget
    : resolve(repoPath, rawTarget);
  return isRegularDirectory(gitDir) ? gitDir : undefined;
}

export function resolveGitDirs(
  repoPath: string,
  kind: CopyKind,
): GitDirs | undefined {
  let gitDir: string | undefined;
  if (kind === "bare") {
    gitDir = isRegularDirectory(repoPath) ? repoPath : undefined;
  } else if (kind === "clone") {
    const candidate = join(repoPath, ".git");
    gitDir = isRegularDirectory(candidate) ? candidate : undefined;
  } else {
    gitDir = resolveWorktreeGitDir(repoPath);
  }
  if (gitDir === undefined) return undefined;
  const commonDir = resolveCommonDir(gitDir);
  if (commonDir === undefined) return undefined;
  return { gitDir, commonDir };
}

function joinContinuationLines(content: string): readonly string[] {
  const rawLines = content.replaceAll("\r\n", "\n").split("\n");
  const joined: string[] = [];
  let buffer = "";
  for (const rawLine of rawLines) {
    if (rawLine.endsWith("\\") && !rawLine.endsWith("\\\\")) {
      buffer += rawLine.slice(0, -1);
      continue;
    }
    joined.push(buffer + rawLine);
    buffer = "";
  }
  if (buffer.length > 0) joined.push(buffer);
  return joined;
}

function decodeEscape(next: string | undefined): string {
  if (next === "n") return "\n";
  if (next === "t") return "\t";
  if (next === "b") return "\b";
  return next ?? "";
}

function unescapeQuoted(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "\\" && i + 1 < raw.length) {
      i++;
      out += decodeEscape(raw[i]);
      continue;
    }
    if (ch !== undefined) out += ch;
  }
  return out;
}

function parseSectionHeader(
  line: string,
):
  | { readonly section: string; readonly subsection: string | undefined }
  | undefined {
  const quoted = /^\[([A-Za-z0-9-]+)\s+"((?:[^"\\]|\\.)*)"\]/.exec(line);
  if (quoted?.[1] !== undefined && quoted[2] !== undefined) {
    return {
      section: quoted[1].toLowerCase(),
      subsection: unescapeQuoted(quoted[2]),
    };
  }
  const dotted = /^\[([A-Za-z0-9-]+)\.([^\]]+)\]/.exec(line);
  if (dotted?.[1] !== undefined && dotted[2] !== undefined) {
    return {
      section: dotted[1].toLowerCase(),
      subsection: dotted[2].trim().toLowerCase(),
    };
  }
  const plain = /^\[([A-Za-z0-9-]+)\]/.exec(line);
  if (plain?.[1] !== undefined) {
    return { section: plain[1].toLowerCase(), subsection: undefined };
  }
  return undefined;
}

type ValueParseState = {
  out: string;
  pendingSpace: string;
  inQuotes: boolean;
  done: boolean;
};

function stepUnquotedValueChar(ch: string, state: ValueParseState): void {
  if (ch === "#" || ch === ";") {
    state.done = true;
    return;
  }
  if (ch === '"') {
    if (state.out.length > 0) state.out += state.pendingSpace;
    state.pendingSpace = "";
    state.inQuotes = true;
    return;
  }
  if (ch === " " || ch === "\t") {
    state.pendingSpace += ch;
    return;
  }
  if (state.out.length > 0) state.out += state.pendingSpace;
  state.pendingSpace = "";
  state.out += ch;
}

function parseConfigValue(rawValue: string): string {
  const state: ValueParseState = {
    out: "",
    pendingSpace: "",
    inQuotes: false,
    done: false,
  };
  for (let i = 0; i < rawValue.length && !state.done; i++) {
    const ch = rawValue[i];
    if (ch === undefined) continue;
    if (!state.inQuotes) {
      stepUnquotedValueChar(ch, state);
      continue;
    }
    if (ch === "\\") {
      i++;
      state.out += decodeEscape(rawValue[i]);
    } else if (ch === '"') {
      state.inQuotes = false;
    } else {
      state.out += ch;
    }
  }
  return state.out;
}

function parseKeyValueLine(
  trimmed: string,
  section: string,
  subsection: string | undefined,
): ConfigEntry | undefined {
  const eqIndex = trimmed.indexOf("=");
  if (eqIndex === -1) {
    const key = parseConfigValue(trimmed).trim().toLowerCase();
    return key.length > 0
      ? { section, subsection, key, value: "true" }
      : undefined;
  }
  const key = trimmed.slice(0, eqIndex).trim().toLowerCase();
  if (key.length === 0) return undefined;
  return {
    section,
    subsection,
    key,
    value: parseConfigValue(trimmed.slice(eqIndex + 1)),
  };
}

function parseGitConfigText(content: string): readonly ConfigEntry[] {
  const entries: ConfigEntry[] = [];
  let section: string | undefined;
  let subsection: string | undefined;
  for (const line of joinContinuationLines(content)) {
    const trimmed = line.trimStart();
    if (
      trimmed.length === 0 ||
      trimmed.startsWith("#") ||
      trimmed.startsWith(";")
    ) {
      continue;
    }
    if (trimmed.startsWith("[")) {
      const header = parseSectionHeader(trimmed);
      if (header !== undefined) {
        section = header.section;
        subsection = header.subsection;
      }
      continue;
    }
    if (section === undefined) continue;
    const entry = parseKeyValueLine(trimmed, section, subsection);
    if (entry !== undefined) entries.push(entry);
  }
  return entries;
}

function globalGitConfigPaths(): readonly string[] {
  const envGlobal = process.env.GIT_CONFIG_GLOBAL;
  if (envGlobal !== undefined) {
    if (envGlobal.length === 0 || envGlobal === "/dev/null") return [];
    return [envGlobal];
  }
  const home = homedir();
  const xdgConfig =
    process.env.XDG_CONFIG_HOME !== undefined &&
    process.env.XDG_CONFIG_HOME.length > 0 &&
    isAbsolute(process.env.XDG_CONFIG_HOME)
      ? process.env.XDG_CONFIG_HOME
      : join(home, ".config");
  return [join(home, ".gitconfig"), join(xdgConfig, "git", "config")];
}

function readGlobalInsteadOfRules(): readonly InsteadOfRule[] {
  const rules: InsteadOfRule[] = [];
  for (const path of globalGitConfigPaths()) {
    let text: string;
    try {
      text = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    for (const entry of parseGitConfigText(text)) {
      if (
        entry.section === "url" &&
        entry.subsection !== undefined &&
        entry.key === "insteadof" &&
        entry.value.length > 0
      ) {
        rules.push({ base: entry.subsection, insteadOf: entry.value });
      }
    }
  }
  return rules;
}

function collectCopyConfigFiles(dirs: GitDirs): readonly string[] | undefined {
  const primary = join(dirs.commonDir, "config");
  if (checkOptionalRegularFile(primary) !== "present") return undefined;
  const files = new Set<string>([primary]);
  const optionals = [join(dirs.commonDir, "config.worktree")];
  if (dirs.gitDir !== dirs.commonDir) {
    optionals.push(join(dirs.gitDir, "config"));
    optionals.push(join(dirs.gitDir, "config.worktree"));
  }
  for (const optional of optionals) {
    const status = checkOptionalRegularFile(optional);
    if (status === "invalid") return undefined;
    if (status === "present") files.add(optional);
  }
  return [...files];
}

function recordRemoteEntry(
  remoteMap: Map<string, { url?: string; vcs?: string }>,
  remoteName: string,
  key: string,
  value: string,
): void {
  const current = remoteMap.get(remoteName) ?? {};
  if (key === "url" && current.url === undefined) {
    current.url = value;
  } else if (key === "vcs" && value.length > 0) {
    current.vcs = value;
  }
  remoteMap.set(remoteName, current);
}

function applyConfigEntry(entry: ConfigEntry, acc: ConfigAccumulator): void {
  if (entry.section === "extensions") {
    if (entry.key === "partialclone" && entry.value.length > 0) {
      acc.hasPartialClone = true;
    } else if (
      entry.key === "refstorage" &&
      entry.value.toLowerCase() !== "files"
    ) {
      acc.hasUnsupportedRefStorage = true;
    }
    return;
  }
  if (
    (entry.section === "include" || entry.section === "includeif") &&
    entry.key === "path"
  ) {
    acc.hasInclude = true;
    return;
  }
  if (entry.section === "remote" && entry.subsection !== undefined) {
    recordRemoteEntry(acc.remoteMap, entry.subsection, entry.key, entry.value);
    return;
  }
  if (
    entry.section === "url" &&
    entry.subsection !== undefined &&
    entry.key === "insteadof" &&
    entry.value.length > 0
  ) {
    acc.insteadOfRules.push({
      base: entry.subsection,
      insteadOf: entry.value,
    });
  }
}

export function readCopyGitConfig(dirs: GitDirs): ParsedCopyGitConfig {
  const configFiles = collectCopyConfigFiles(dirs);
  if (configFiles === undefined) {
    return { ok: false, reason: "cannot read repository git config" };
  }

  const acc: ConfigAccumulator = {
    hasPartialClone: false,
    hasUnsupportedRefStorage: false,
    hasInclude: false,
    remoteMap: new Map(),
    insteadOfRules: [...readGlobalInsteadOfRules()],
  };

  for (const configFile of configFiles) {
    let content: string;
    try {
      content = readFileSync(configFile, "utf8");
    } catch {
      return { ok: false, reason: "cannot read repository git config" };
    }
    for (const entry of parseGitConfigText(content)) {
      applyConfigEntry(entry, acc);
    }
  }

  const remotes: RemoteConfig[] = [];
  for (const [name, info] of acc.remoteMap) {
    remotes.push({ name, url: info.url, vcs: info.vcs });
  }
  return {
    ok: true,
    hasPartialClone: acc.hasPartialClone,
    hasUnsupportedRefStorage: acc.hasUnsupportedRefStorage,
    hasInclude: acc.hasInclude,
    remotes,
    insteadOfRules: acc.insteadOfRules,
  };
}

export function applyInsteadOf(
  rawUrl: string,
  rules: readonly InsteadOfRule[],
): string {
  let best: InsteadOfRule | undefined;
  for (const rule of rules) {
    if (!rawUrl.startsWith(rule.insteadOf)) continue;
    if (best === undefined || rule.insteadOf.length > best.insteadOf.length) {
      best = rule;
    }
  }
  if (best === undefined) return rawUrl;
  return `${best.base}${rawUrl.slice(best.insteadOf.length)}`;
}
