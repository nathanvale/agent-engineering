import { readdirSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import type { ParsedPath, ProgramsCapability } from "agent-cli-kernel";
import { createGitRunner, type GitRunner } from "./git.ts";
import { type LoadedHomes, loadHomes } from "./homes.ts";
import { loadLeases } from "./leases.ts";
import { assessLoss } from "./loss.ts";
import {
  buildSummary,
  type CheckReport,
  compareText,
  type CopyRecord,
  type CopyVerdict,
  type Finding,
  type HomeRole,
  isExpiredThrowaway,
  isInsidePath,
  matchMostSpecificRoot,
  type ResolvedRoot,
} from "./rules.ts";
import { type DetectedCopy, safeLstat, walkAllTargets } from "./walk.ts";

type RegisteredWorktreeInfo = {
  readonly mainCheckout: string;
};

type ClassificationResult = {
  readonly home: HomeRole;
  readonly verdict: CopyVerdict;
  readonly throwawayRoot: string | undefined;
};

function errorCode(error: unknown): string | undefined {
  const code: unknown = Reflect.get(Object(error), "code");
  return typeof code === "string" ? code : undefined;
}

function codexWorktreesRoot(): string {
  const value = process.env.CODEX_HOME;
  const base =
    value !== undefined && value.length > 0 && isAbsolute(value)
      ? value
      : join(homedir(), ".codex");
  return join(base, "worktrees");
}

function collectMainCheckoutsInParent(
  parent: string,
  mainCheckouts: Set<string>,
  findings: Finding[],
): void {
  let entries: readonly string[];
  try {
    entries = readdirSync(parent);
  } catch (error) {
    const code = errorCode(error);
    if (code === "ENOENT") return;
    findings.push({
      kind: "scan-incomplete",
      path: parent,
      reason: `Cannot read repositories directory (${code ?? "error"}).`,
    });
    return;
  }
  for (const name of entries) {
    let real: string;
    try {
      real = realpathSync.native(join(parent, name));
    } catch {
      continue;
    }
    if (
      safeLstat(real)?.isDirectory() &&
      safeLstat(join(real, ".git"))?.isDirectory()
    ) {
      mainCheckouts.add(real);
    }
  }
}

function discoverMainCheckouts(
  repoParents: readonly string[],
  findings: Finding[],
): readonly string[] {
  const mainCheckouts = new Set<string>();
  for (const parent of repoParents) {
    collectMainCheckoutsInParent(parent, mainCheckouts, findings);
  }
  return [...mainCheckouts];
}

async function collectExemptSubmodules(
  mainCheckout: string,
  git: GitRunner,
  exemptSubmodules: Set<string>,
): Promise<void> {
  const gitmodulesFile = join(mainCheckout, ".gitmodules");
  if (!safeLstat(gitmodulesFile)?.isFile()) return;
  const [listedPaths, stageGitlinks] = await Promise.all([
    git.gitmodulesPaths(mainCheckout, gitmodulesFile),
    git.stageGitlinks(mainCheckout),
  ]);
  for (const relPath of listedPaths) {
    if (!stageGitlinks.has(relPath)) continue;
    const full = join(mainCheckout, relPath);
    try {
      exemptSubmodules.add(realpathSync.native(full));
    } catch {
      exemptSubmodules.add(full);
    }
  }
}

async function collectRegisteredWorktrees(
  mainCheckout: string,
  git: GitRunner,
  registeredWorktrees: Map<string, RegisteredWorktreeInfo>,
  findings: Finding[],
): Promise<void> {
  const worktrees = await git.worktreeList(mainCheckout);
  if (worktrees === undefined) {
    findings.push({
      kind: "scan-incomplete",
      path: mainCheckout,
      reason: "git worktree list failed.",
    });
    return;
  }
  for (const entry of worktrees) {
    if (entry.bare) continue;
    let realPath: string;
    try {
      realPath = realpathSync.native(entry.path);
    } catch {
      findings.push({
        kind: "dangling-registration",
        path: entry.path,
        reason: `Registered worktree of ${mainCheckout} is missing on disk.`,
      });
      continue;
    }
    if (realPath === mainCheckout) continue;
    if (entry.prunable) {
      findings.push({
        kind: "dangling-registration",
        path: realPath,
        reason: `Registered worktree of ${mainCheckout} is prunable.`,
      });
      continue;
    }
    registeredWorktrees.set(realPath, { mainCheckout });
  }
}

function classifyRegisteredWorktree(
  copyPath: string,
  wtInfo: RegisteredWorktreeInfo,
  roots: readonly ResolvedRoot[],
  exceptions: ReadonlyMap<string, string>,
  findings: Finding[],
): ClassificationResult {
  const taskHome = join(wtInfo.mainCheckout, ".worktrees");
  if (isInsidePath(copyPath, taskHome) && copyPath !== taskHome) {
    return { home: "repository", verdict: "ok", throwawayRoot: undefined };
  }
  const matched = matchMostSpecificRoot(copyPath, roots);
  if (matched?.role === "toolOwned") {
    return { home: "toolOwned", verdict: "ok", throwawayRoot: undefined };
  }
  if (exceptions.has(copyPath)) {
    return { home: "exception", verdict: "ok", throwawayRoot: undefined };
  }
  findings.push({
    kind: "stray-worktree",
    path: copyPath,
    reason: `Registered worktree of ${wtInfo.mainCheckout} sits outside ${taskHome}.`,
  });
  return {
    home: matched?.role ?? "unmatched",
    verdict: "stray-worktree",
    throwawayRoot: matched?.role === "throwaway" ? matched.path : undefined,
  };
}

function classifyByRoot(
  copy: DetectedCopy,
  matched: ResolvedRoot | undefined,
  nowMs: number,
  findings: Finding[],
): ClassificationResult {
  if (matched === undefined) {
    findings.push({
      kind: "stray-copy",
      path: copy.path,
      reason: "Copy sits outside every allowed copy home.",
    });
    return {
      home: "unmatched",
      verdict: "stray-copy",
      throwawayRoot: undefined,
    };
  }
  if (matched.role === "noCopy") {
    findings.push({
      kind: "stray-copy",
      path: copy.path,
      reason: `Copy sits in no-copy root ${matched.path}.`,
    });
    return { home: "noCopy", verdict: "stray-copy", throwawayRoot: undefined };
  }
  if (matched.role === "mirror" || matched.role === "toolOwned") {
    return { home: matched.role, verdict: "ok", throwawayRoot: undefined };
  }
  const maxAgeHours = matched.maxAgeHours ?? 72;
  if (isExpiredThrowaway(copy.mtimeMs, nowMs, maxAgeHours)) {
    findings.push({
      kind: "expired-throwaway",
      path: copy.path,
      reason: `Throwaway copy exceeds ${String(maxAgeHours)} hours.`,
    });
    return {
      home: "throwaway",
      verdict: "expired-throwaway",
      throwawayRoot: matched.path,
    };
  }
  return { home: "throwaway", verdict: "ok", throwawayRoot: matched.path };
}

function classifyCopy(params: {
  readonly copy: DetectedCopy;
  readonly mainCheckouts: ReadonlySet<string>;
  readonly exemptSubmodules: ReadonlySet<string>;
  readonly registeredWorktrees: ReadonlyMap<string, RegisteredWorktreeInfo>;
  readonly roots: readonly ResolvedRoot[];
  readonly exceptions: ReadonlyMap<string, string>;
  readonly nowMs: number;
  readonly findings: Finding[];
}): ClassificationResult {
  const {
    copy,
    mainCheckouts,
    exemptSubmodules,
    registeredWorktrees,
    roots,
    exceptions,
    nowMs,
    findings,
  } = params;
  if (mainCheckouts.has(copy.path) || exemptSubmodules.has(copy.path)) {
    return { home: "repository", verdict: "ok", throwawayRoot: undefined };
  }
  const wtInfo = registeredWorktrees.get(copy.path);
  if (wtInfo !== undefined) {
    return classifyRegisteredWorktree(
      copy.path,
      wtInfo,
      roots,
      exceptions,
      findings,
    );
  }
  if (exceptions.has(copy.path)) {
    return { home: "exception", verdict: "ok", throwawayRoot: undefined };
  }
  return classifyByRoot(
    copy,
    matchMostSpecificRoot(copy.path, roots),
    nowMs,
    findings,
  );
}

export async function runCopyHomeCheck(options: {
  readonly homesPath: string | undefined;
  readonly checkRemote: boolean;
  readonly programs: ProgramsCapability;
  readonly envExecutable: ParsedPath | undefined;
}): Promise<
  | { readonly ok: true; readonly report: CheckReport }
  | { readonly ok: false; readonly message: string }
> {
  const loaded: LoadedHomes = loadHomes(options.homesPath);
  if (!loaded.ok) return loaded;

  const git = createGitRunner(options.programs, options.envExecutable);
  const findings: Finding[] = [...loaded.initialFindings];
  const mainCheckoutsList = discoverMainCheckouts(
    loaded.repositories,
    findings,
  );
  const mainCheckouts = new Set(mainCheckoutsList);
  const exemptSubmodules = new Set<string>();
  const registeredWorktrees = new Map<string, RegisteredWorktreeInfo>();

  for (const mainCheckout of mainCheckoutsList) {
    await collectExemptSubmodules(mainCheckout, git, exemptSubmodules);
    await collectRegisteredWorktrees(
      mainCheckout,
      git,
      registeredWorktrees,
      findings,
    );
  }

  const allRoots: ResolvedRoot[] = [...loaded.roots];
  for (const mainCheckout of mainCheckoutsList) {
    allRoots.push({
      role: "noCopy",
      path: join(mainCheckout, ".claude", "worktrees"),
    });
  }
  const codexRoot = codexWorktreesRoot();
  try {
    allRoots.push({ role: "noCopy", path: realpathSync.native(codexRoot) });
  } catch (error) {
    const code = errorCode(error);
    if (code !== "ENOENT") {
      findings.push({
        kind: "scan-incomplete",
        path: codexRoot,
        reason: `Cannot resolve Codex worktrees root (${code ?? "error"}).`,
      });
    }
    allRoots.push({ role: "noCopy", path: codexRoot });
  }

  const walkTargets = [
    ...mainCheckoutsList,
    ...registeredWorktrees.keys(),
    ...allRoots.map((root) => root.path),
    ...loaded.exceptions.map((entry) => entry.path),
  ];

  const detected = walkAllTargets(walkTargets, findings);
  const exceptionsMap = new Map(
    loaded.exceptions.map((entry) => [entry.path, entry.reason]),
  );
  const leases = loadLeases();
  const nowMs = Date.now();
  const allCopyPaths = [...detected.keys()];
  const copies: CopyRecord[] = [];

  const sortedDetected = [...detected.values()].sort((a, b) =>
    compareText(a.path, b.path),
  );
  for (const copy of sortedDetected) {
    const classified = classifyCopy({
      copy,
      mainCheckouts,
      exemptSubmodules,
      registeredWorktrees,
      roots: allRoots,
      exceptions: exceptionsMap,
      nowMs,
      findings,
    });
    const loss = await assessLoss({
      copyPath: copy.path,
      kind: copy.kind,
      throwawayRoot: classified.throwawayRoot,
      allCopyPaths,
      leases,
      checkRemote: options.checkRemote,
      git,
    });
    copies.push({
      path: copy.path,
      kind: copy.kind,
      home: classified.home,
      verdict: classified.verdict,
      lastTouched: new Date(copy.mtimeMs).toISOString(),
      loss,
    });
  }

  findings.sort(
    (a, b) => compareText(a.kind, b.kind) || compareText(a.path, b.path),
  );
  const complete = !findings.some(
    (finding) => finding.kind === "scan-incomplete",
  );
  return {
    ok: true,
    report: {
      complete,
      findings,
      copies,
      summary: buildSummary(copies),
    },
  };
}
