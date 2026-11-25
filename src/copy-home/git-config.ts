import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { type CopyKind, compareText } from "./rules.ts";

const allowedExactConfigKeys = new Set([
  "core.repositoryformatversion",
  "core.filemode",
  "core.bare",
  "core.logallrefupdates",
  "core.ignorecase",
  "core.precomposeunicode",
  "core.symlinks",
  "core.worktree",
  "user.name",
  "user.email",
]);

const allowedPatternConfigKeys = [
  /^remote\..+\.(url|fetch|pushurl)$/i,
  /^branch\..+\.(remote|merge)$/i,
  /^submodule\..+\.(url|active)$/i,
  /^extensions\.[^.]+$/i,
] as const;

export function isAllowedConfigKey(key: string): boolean {
  if (allowedExactConfigKeys.has(key.toLowerCase())) return true;
  return allowedPatternConfigKeys.some((pattern) => pattern.test(key));
}

export function parseNullConfigKeys(stdout: string): readonly string[] {
  const keys: string[] = [];
  for (const entry of stdout.split("\0")) {
    if (entry.length === 0) continue;
    const newline = entry.indexOf("\n");
    const key = newline === -1 ? entry : entry.slice(0, newline);
    if (key.length > 0) keys.push(key);
  }
  return keys;
}

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

function inspectModuleChild(
  child: string,
  name: string,
  stack: string[],
  configFiles: Set<string>,
): boolean {
  let stat: ReturnType<typeof lstatSync>;
  try {
    stat = lstatSync(child);
  } catch {
    return false;
  }
  if (stat.isSymbolicLink()) return false;
  if (stat.isDirectory()) {
    stack.push(child);
    return true;
  }
  if (stat.isFile() && (name === "config" || name === "config.worktree")) {
    configFiles.add(child);
  }
  return true;
}

function collectModuleConfigFiles(
  modulesRoot: string,
  configFiles: Set<string>,
): boolean {
  let rootStat: ReturnType<typeof lstatSync>;
  try {
    rootStat = lstatSync(modulesRoot);
  } catch (error) {
    return errorCode(error) === "ENOENT";
  }
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) return false;

  const stack = [modulesRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) continue;
    let names: readonly string[];
    try {
      names = readdirSync(current);
    } catch {
      return false;
    }
    for (const name of names) {
      if (!inspectModuleChild(join(current, name), name, stack, configFiles)) {
        return false;
      }
    }
  }
  return true;
}

function resolveWorktreeGitDirs(
  repoPath: string,
): { readonly gitDir: string; readonly commonDir: string } | undefined {
  let content: string;
  try {
    content = readFileSync(join(repoPath, ".git"), "utf8");
  } catch {
    return undefined;
  }
  const match = /^gitdir:\s*(.+)$/m.exec(content);
  const rawTarget = match?.[1]?.trim();
  if (rawTarget === undefined || rawTarget.length === 0) return undefined;
  const gitDir = isAbsolute(rawTarget)
    ? rawTarget
    : resolve(repoPath, rawTarget);
  const commonDirFile = join(gitDir, "commondir");
  const commonStatus = checkOptionalRegularFile(commonDirFile);
  if (commonStatus === "invalid") return undefined;
  if (commonStatus === "absent") {
    return { gitDir, commonDir: gitDir };
  }
  try {
    const relCommon = readFileSync(commonDirFile, "utf8").trim();
    if (relCommon.length === 0) return undefined;
    const commonDir = isAbsolute(relCommon)
      ? relCommon
      : resolve(gitDir, relCommon);
    return { gitDir, commonDir };
  } catch {
    return undefined;
  }
}

export function resolveGitConfigFiles(
  repoPath: string,
  kind: CopyKind,
): readonly string[] | undefined {
  let gitDir: string;
  let commonDir: string;
  if (kind === "bare") {
    gitDir = repoPath;
    commonDir = repoPath;
  } else if (kind === "clone") {
    gitDir = join(repoPath, ".git");
    commonDir = gitDir;
  } else {
    const resolved = resolveWorktreeGitDirs(repoPath);
    if (resolved === undefined) return undefined;
    gitDir = resolved.gitDir;
    commonDir = resolved.commonDir;
  }

  const primaryConfig = join(commonDir, "config");
  if (checkOptionalRegularFile(primaryConfig) !== "present") return undefined;

  const files = new Set<string>([primaryConfig]);
  for (const optional of [
    join(commonDir, "config.worktree"),
    join(gitDir, "config"),
    join(gitDir, "config.worktree"),
  ]) {
    const status = checkOptionalRegularFile(optional);
    if (status === "invalid") return undefined;
    if (status === "present") files.add(optional);
  }
  if (!collectModuleConfigFiles(join(commonDir, "modules"), files)) {
    return undefined;
  }
  if (
    gitDir !== commonDir &&
    !collectModuleConfigFiles(join(gitDir, "modules"), files)
  ) {
    return undefined;
  }
  return [...files].sort(compareText);
}
