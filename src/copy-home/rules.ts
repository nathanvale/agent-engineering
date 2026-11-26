export type CopyKind =
  | "clone"
  | "worktree"
  | "bare"
  | "node-modules"
  | "package-cache"
  | "venv"
  | "project-tree";

export type HomeRole =
  | "repository"
  | "noCopy"
  | "throwaway"
  | "mirror"
  | "toolOwned"
  | "exception"
  | "unmatched";

export type FindingKind =
  | "stray-copy"
  | "stray-worktree"
  | "expired-throwaway"
  | "dangling-registration"
  | "scan-incomplete";

export type CopyVerdict =
  | "ok"
  | "stray-copy"
  | "stray-worktree"
  | "expired-throwaway";

export type LossVerdict = "nothing-found" | "work-found" | "unknown";

export type Finding = {
  readonly kind: FindingKind;
  readonly path: string;
  readonly reason: string;
};

export type LossResult = {
  readonly verdict: LossVerdict;
  readonly reasons: readonly string[];
};

export type CopyRecord = {
  readonly path: string;
  readonly kind: CopyKind;
  readonly home: HomeRole;
  readonly verdict: CopyVerdict;
  readonly lastTouched: string;
  readonly loss: LossResult;
};

export type CheckSummary = {
  readonly byHome: Readonly<Record<string, number>>;
  readonly byKind: Readonly<Record<string, number>>;
};

export type CheckReport = {
  readonly complete: boolean;
  readonly findings: readonly Finding[];
  readonly copies: readonly CopyRecord[];
  readonly summary: CheckSummary;
};

export type ThrowawayRoot = {
  readonly root: string;
  readonly maxAgeHours: number;
};

export type ExceptionEntry = {
  readonly path: string;
  readonly reason: string;
};

export type ResolvedRoot = {
  readonly role: Exclude<HomeRole, "repository" | "exception" | "unmatched">;
  readonly path: string;
  readonly maxAgeHours?: number;
};

export type WorktreeEntry = {
  readonly path: string;
  readonly prunable: boolean;
  readonly bare: boolean;
};

const lockfiles = new Set([
  "bun.lock",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "Cargo.lock",
  "uv.lock",
]);

const bunCacheEntryPattern = /^.+@.+@@@\d+$/;
const shaPattern = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/i;

export function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function isInsidePath(candidate: string, root: string): boolean {
  if (candidate === root) return true;
  if (root === "/") return candidate.startsWith("/");
  return candidate.startsWith(`${root}/`);
}

export function isLockfileName(name: string): boolean {
  return lockfiles.has(name);
}

export function isBunCacheEntryName(name: string): boolean {
  return bunCacheEntryPattern.test(name);
}

export function isGitCopyKind(kind: CopyKind): boolean {
  return kind === "clone" || kind === "worktree" || kind === "bare";
}

export function isNetworkRemoteUrl(rawUrl: string): boolean {
  const url = rawUrl.trim();
  if (url.length === 0) return false;
  if (
    url.startsWith("/") ||
    url.startsWith("./") ||
    url.startsWith("../") ||
    url.startsWith("~") ||
    url.startsWith("file://") ||
    url.startsWith("ext::") ||
    url.startsWith("fd::")
  ) {
    return false;
  }
  if (
    url.startsWith("https://") ||
    url.startsWith("http://") ||
    url.startsWith("ssh://") ||
    url.startsWith("git://")
  ) {
    return true;
  }
  if (url.includes("://")) return false;
  const colonIndex = url.indexOf(":");
  if (colonIndex <= 0) return false;
  const hostPart = url.slice(0, colonIndex);
  const pathPart = url.slice(colonIndex + 1);
  return (
    !hostPart.includes("/") && pathPart.length > 0 && !pathPart.startsWith(":")
  );
}

export function matchMostSpecificRoot(
  targetPath: string,
  roots: readonly ResolvedRoot[],
): ResolvedRoot | undefined {
  let best: ResolvedRoot | undefined;
  for (const root of roots) {
    if (!isInsidePath(targetPath, root.path)) continue;
    if (best === undefined || root.path.length > best.path.length) {
      best = root;
    }
  }
  return best;
}

export function isExpiredThrowaway(
  lastTouchedMs: number,
  nowMs: number,
  maxAgeHours: number,
): boolean {
  return nowMs - lastTouchedMs > maxAgeHours * 3_600_000;
}

export function buildSummary(copies: readonly CopyRecord[]): CheckSummary {
  const byHome: Record<string, number> = {};
  const byKind: Record<string, number> = {};
  for (const copy of copies) {
    byHome[copy.home] = (byHome[copy.home] ?? 0) + 1;
    byKind[copy.kind] = (byKind[copy.kind] ?? 0) + 1;
  }
  return { byHome, byKind };
}

export function parseWorktreePorcelain(
  stdout: string,
): readonly WorktreeEntry[] {
  const entries: WorktreeEntry[] = [];
  let currentPath: string | undefined;
  let prunable = false;
  let bare = false;
  const flush = () => {
    if (currentPath !== undefined) {
      entries.push({ path: currentPath, prunable, bare });
    }
    currentPath = undefined;
    prunable = false;
    bare = false;
  };
  for (const rawLine of stdout.split("\n")) {
    const line = rawLine.trimEnd();
    if (line === "") {
      flush();
      continue;
    }
    if (line.startsWith("worktree ")) {
      flush();
      currentPath = line.slice("worktree ".length);
    } else if (line.startsWith("prunable")) {
      prunable = true;
    } else if (line === "bare") {
      bare = true;
    }
  }
  flush();
  return entries;
}

export function parseStageGitlinks(stdout: string): ReadonlySet<string> {
  const paths = new Set<string>();
  for (const rawLine of stdout.split("\n")) {
    if (!rawLine.startsWith("160000 ")) continue;
    const tabIndex = rawLine.indexOf("\t");
    if (tabIndex !== -1) {
      paths.add(rawLine.slice(tabIndex + 1));
    }
  }
  return paths;
}

export function parseGitmodulesPaths(stdout: string): readonly string[] {
  const paths: string[] = [];
  for (const rawLine of stdout.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const spaceIndex = line.indexOf(" ");
    if (spaceIndex !== -1) {
      paths.push(line.slice(spaceIndex + 1).trim());
    }
  }
  return paths;
}

export function parseLsRemoteShas(stdout: string): readonly string[] {
  const shas = new Set<string>();
  for (const rawLine of stdout.split("\n")) {
    const trimmed = rawLine.trim();
    if (trimmed.length === 0) continue;
    const first = trimmed.split(/\s+/)[0];
    if (first !== undefined && shaPattern.test(first)) {
      shas.add(first);
    }
  }
  return [...shas];
}

export type CatFileBatchCheckParsed =
  | {
      readonly ok: true;
      readonly present: readonly string[];
      readonly anyMissing: boolean;
    }
  | { readonly ok: false };

export function parseCatFileBatchCheck(
  stdout: string,
  expectedCount: number,
): CatFileBatchCheckParsed {
  const trimmedEnd = stdout.endsWith("\n") ? stdout.slice(0, -1) : stdout;
  const lines = trimmedEnd.length === 0 ? [] : trimmedEnd.split("\n");
  if (lines.length !== expectedCount) return { ok: false };
  const present: string[] = [];
  let anyMissing = false;
  for (const rawLine of lines) {
    const parts = rawLine.trim().split(/\s+/);
    const sha = parts[0];
    const kind = parts[1];
    if (sha === undefined || !shaPattern.test(sha)) return { ok: false };
    if (kind === "commit" || kind === "tag") {
      present.push(sha);
    } else if (kind === "missing" || kind === "tree" || kind === "blob") {
      anyMissing = true;
    } else {
      return { ok: false };
    }
  }
  return { ok: true, present, anyMissing };
}

export function parseRevListShas(stdout: string): ReadonlySet<string> {
  const shas = new Set<string>();
  for (const rawLine of stdout.split("\n")) {
    const trimmed = rawLine.trim();
    if (shaPattern.test(trimmed)) {
      shas.add(trimmed);
    }
  }
  return shas;
}

export function throwawayUnitDir(
  copyPath: string,
  throwawayRoot: string,
): string {
  if (copyPath === throwawayRoot) return copyPath;
  const prefix = throwawayRoot === "/" ? "/" : `${throwawayRoot}/`;
  if (!copyPath.startsWith(prefix)) return copyPath;
  const rest = copyPath.slice(prefix.length);
  const slashIndex = rest.indexOf("/");
  if (slashIndex === -1) return copyPath;
  return `${prefix}${rest.slice(0, slashIndex)}`;
}
