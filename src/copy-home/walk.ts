import { lstatSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import {
  type CopyKind,
  type Finding,
  isBunCacheEntryName,
  isLockfileName,
} from "./rules.ts";

const bareInternals = new Set([
  "objects",
  "refs",
  "hooks",
  "info",
  "logs",
  "branches",
  "worktrees",
  "modules",
]);

export type DetectedCopy = {
  readonly path: string;
  readonly kind: CopyKind;
  readonly mtimeMs: number;
};

function errorCode(error: unknown): string | undefined {
  const code: unknown = Reflect.get(Object(error), "code");
  return typeof code === "string" ? code : undefined;
}

export function safeLstat(path: string) {
  try {
    return lstatSync(path);
  } catch {
    return undefined;
  }
}

function detectGitKind(
  dir: string,
  entries: ReadonlySet<string>,
): CopyKind | undefined {
  if (entries.has(".git")) {
    const gitStat = safeLstat(join(dir, ".git"));
    if (gitStat?.isDirectory()) return "clone";
    if (gitStat?.isFile()) return "worktree";
  }
  if (entries.has("HEAD") && entries.has("objects") && entries.has("refs")) {
    const headStat = safeLstat(join(dir, "HEAD"));
    const objectsStat = safeLstat(join(dir, "objects"));
    const refsStat = safeLstat(join(dir, "refs"));
    if (
      headStat?.isFile() &&
      objectsStat?.isDirectory() &&
      refsStat?.isDirectory()
    ) {
      return "bare";
    }
  }
  return undefined;
}

function detectBulkKind(
  dir: string,
  entries: readonly string[],
): CopyKind | undefined {
  if (basename(dir) === "node_modules") return "node-modules";
  if (
    entries.includes("pyvenv.cfg") &&
    safeLstat(join(dir, "pyvenv.cfg"))?.isFile()
  ) {
    return "venv";
  }
  if (entries.some((name) => isBunCacheEntryName(name))) {
    return "package-cache";
  }
  if (
    entries.some(
      (name) => isLockfileName(name) && safeLstat(join(dir, name))?.isFile(),
    )
  ) {
    return "project-tree";
  }
  return undefined;
}

function shouldSkipChild(name: string, gitKind: CopyKind | undefined): boolean {
  if (name === ".git") return true;
  return gitKind === "bare" && bareInternals.has(name);
}

function lstatOrReport(path: string, findings: Finding[]) {
  try {
    return lstatSync(path);
  } catch (error) {
    const code = errorCode(error);
    if (code !== "ENOENT") {
      findings.push({
        kind: "scan-incomplete",
        path,
        reason: `Cannot stat path (${code ?? "error"}).`,
      });
    }
    return undefined;
  }
}

function isDescendableDirectory(path: string, findings: Finding[]): boolean {
  const stat = lstatOrReport(path, findings);
  return stat !== undefined && !stat.isSymbolicLink() && stat.isDirectory();
}

function detectCopyKind(
  dir: string,
  names: readonly string[],
  insideCopy: boolean,
): {
  readonly gitKind: CopyKind | undefined;
  readonly foundKind: CopyKind | undefined;
} {
  const gitKind = detectGitKind(dir, new Set(names));
  if (gitKind !== undefined) return { gitKind, foundKind: gitKind };
  if (insideCopy) return { gitKind: undefined, foundKind: undefined };
  return { gitKind: undefined, foundKind: detectBulkKind(dir, names) };
}

function walkDirectory(
  dir: string,
  insideCopy: boolean,
  visited: Set<string>,
  detected: Map<string, DetectedCopy>,
  findings: Finding[],
): void {
  if (visited.has(dir)) return;
  visited.add(dir);

  const dirStat = lstatOrReport(dir, findings);
  if (!dirStat?.isDirectory()) return;

  let names: readonly string[];
  try {
    names = readdirSync(dir);
  } catch (error) {
    findings.push({
      kind: "scan-incomplete",
      path: dir,
      reason: `Cannot read directory (${errorCode(error) ?? "error"}).`,
    });
    return;
  }

  const { gitKind, foundKind } = detectCopyKind(dir, names, insideCopy);
  if (foundKind !== undefined && !detected.has(dir)) {
    detected.set(dir, { path: dir, kind: foundKind, mtimeMs: dirStat.mtimeMs });
  }

  const nextInside = insideCopy || foundKind !== undefined;
  for (const name of names) {
    if (shouldSkipChild(name, gitKind)) continue;
    const child = join(dir, name);
    if (isDescendableDirectory(child, findings)) {
      walkDirectory(child, nextInside, visited, detected, findings);
    }
  }
}

export function walkAllTargets(
  targets: readonly string[],
  findings: Finding[],
): ReadonlyMap<string, DetectedCopy> {
  const visited = new Set<string>();
  const detected = new Map<string, DetectedCopy>();
  for (const target of targets) {
    walkDirectory(target, false, visited, detected, findings);
  }
  return detected;
}
