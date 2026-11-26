import { lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  checkLocalShasAncestry,
  fetchRemoteShasCached,
  type LossRunCache,
  type LossStepDeadlines,
} from "./ancestry.ts";
import type { GitRunner } from "./git.ts";
import {
  applyInsteadOf,
  type ParsedCopyGitConfig,
  readCopyGitConfig,
  resolveGitDirs,
} from "./git-config.ts";
import { readCopyRefsAndStash } from "./git-refs.ts";
import type { LeaseLoadResult } from "./leases.ts";
import {
  type CopyKind,
  type Finding,
  isGitCopyKind,
  isInsidePath,
  isNetworkRemoteUrl,
  type LossResult,
  type LossVerdict,
  throwawayUnitDir,
} from "./rules.ts";

function findOtherFileInDir(
  dir: string,
  copiesInUnit: readonly string[],
): string | undefined {
  if (copiesInUnit.some((copy) => isInsidePath(dir, copy))) return undefined;
  let names: readonly string[];
  try {
    names = readdirSync(dir);
  } catch {
    return dir;
  }
  for (const name of names) {
    const found = inspectUnitEntry(join(dir, name), copiesInUnit);
    if (found !== undefined) return found;
  }
  return undefined;
}

function inspectUnitEntry(
  child: string,
  copiesInUnit: readonly string[],
): string | undefined {
  if (copiesInUnit.some((copy) => isInsidePath(child, copy))) return undefined;
  if (copiesInUnit.some((copy) => isInsidePath(copy, child))) {
    return findOtherFileInDir(child, copiesInUnit);
  }
  try {
    const stat = lstatSync(child);
    return stat.isDirectory() ? findOtherFileInDir(child, copiesInUnit) : child;
  } catch {
    return child;
  }
}

function findOtherFileInUnit(
  unitDir: string,
  allCopyPaths: readonly string[],
): string | undefined {
  const copiesInUnit = allCopyPaths.filter((p) => isInsidePath(p, unitDir));
  return findOtherFileInDir(unitDir, copiesInUnit);
}

type RemoteTipsResult = {
  readonly tips: ReadonlySet<string>;
  readonly anyProblem: boolean;
};

async function collectRemoteTips(
  git: GitRunner,
  config: Extract<ParsedCopyGitConfig, { readonly ok: true }>,
  cache: LossRunCache,
  deadlines: LossStepDeadlines,
  unknown: string[],
): Promise<RemoteTipsResult> {
  const tips = new Set<string>();
  let anyProblem = false;

  for (const remote of config.remotes) {
    if (remote.vcs !== undefined || remote.url === undefined) {
      unknown.push(`remote ${remote.name} effective URL is not a network URL`);
      anyProblem = true;
      continue;
    }
    const effectiveUrl = applyInsteadOf(remote.url, config.insteadOfRules);
    if (!isNetworkRemoteUrl(effectiveUrl)) {
      unknown.push(`remote ${remote.name} effective URL is not a network URL`);
      anyProblem = true;
      continue;
    }
    const remoteResult = await fetchRemoteShasCached(
      git,
      effectiveUrl,
      cache,
      deadlines,
    );
    if (!remoteResult.ok) {
      unknown.push(`${remoteResult.reason} for ${remote.name}`);
      anyProblem = true;
      continue;
    }
    for (const sha of remoteResult.shas) {
      tips.add(sha);
    }
  }
  return { tips, anyProblem };
}

function summarizeLocalRefVerdicts(
  verdicts: ReadonlyMap<string, "contained" | "unpushed" | "undecided">,
  anyProblem: boolean,
): { readonly anyUnpushed: boolean; readonly anyUndecided: boolean } {
  let anyUnpushed = false;
  let anyUndecided = false;
  for (const status of verdicts.values()) {
    if (status === "unpushed") {
      if (anyProblem) anyUndecided = true;
      else anyUnpushed = true;
    } else if (status === "undecided") {
      anyUndecided = true;
    }
  }
  return { anyUnpushed, anyUndecided };
}

function recordAncestryOutcome(params: {
  readonly anyUnpushed: boolean;
  readonly anyUndecided: boolean;
  readonly anyProblem: boolean;
  readonly hasPartialClone: boolean;
  readonly failureReason: string | undefined;
  readonly workFound: string[];
  readonly unknown: string[];
}): void {
  if (params.anyUnpushed) {
    params.workFound.push("local ref not contained in any live remote tip");
    return;
  }
  if (!params.anyUndecided) return;
  if (params.failureReason !== undefined) {
    params.unknown.push(params.failureReason);
    return;
  }
  if (!params.anyProblem) {
    params.unknown.push(
      params.hasPartialClone
        ? "partial clone ancestry not checked"
        : "remote ancestry could not be decided",
    );
  }
}

async function assessGitRemotes(params: {
  readonly git: GitRunner;
  readonly commonDir: string;
  readonly config: Extract<ParsedCopyGitConfig, { readonly ok: true }>;
  readonly localShas: readonly string[];
  readonly cache: LossRunCache;
  readonly deadlines: LossStepDeadlines;
  readonly workFound: string[];
  readonly unknown: string[];
}): Promise<void> {
  const {
    git,
    commonDir,
    config,
    localShas,
    cache,
    deadlines,
    workFound,
    unknown,
  } = params;
  if (localShas.length === 0) return;
  if (config.hasInclude) {
    unknown.push("repository git config uses includes");
    return;
  }
  if (config.remotes.length === 0) {
    workFound.push("local commits with no remote configured");
    return;
  }

  const { tips, anyProblem } = await collectRemoteTips(
    git,
    config,
    cache,
    deadlines,
    unknown,
  );
  const { verdicts, failureReason } = await checkLocalShasAncestry({
    git,
    commonDir,
    localShas,
    remoteTips: tips,
    hasPartialClone: config.hasPartialClone,
    cache,
    deadlines,
  });
  const { anyUnpushed, anyUndecided } = summarizeLocalRefVerdicts(
    verdicts,
    anyProblem,
  );
  recordAncestryOutcome({
    anyUnpushed,
    anyUndecided,
    anyProblem,
    hasPartialClone: config.hasPartialClone,
    failureReason,
    workFound,
    unknown,
  });
}

async function assessGitCopy(params: {
  readonly git: GitRunner;
  readonly copyPath: string;
  readonly kind: CopyKind;
  readonly checkRemote: boolean;
  readonly cache: LossRunCache;
  readonly deadlines: LossStepDeadlines;
  readonly workFound: string[];
  readonly unknown: string[];
}): Promise<void> {
  const {
    git,
    copyPath,
    kind,
    checkRemote,
    cache,
    deadlines,
    workFound,
    unknown,
  } = params;
  if (kind !== "bare") {
    unknown.push("working tree not inspected");
  }

  const dirs = resolveGitDirs(copyPath, kind);
  if (dirs === undefined) {
    unknown.push("cannot resolve repository git directory");
    return;
  }

  const config = readCopyGitConfig(dirs);
  if (!config.ok) {
    unknown.push(config.reason);
    return;
  }
  if (config.hasUnsupportedRefStorage) {
    unknown.push("unsupported git ref storage");
    return;
  }

  const refs = readCopyRefsAndStash(dirs);
  if (!refs.ok) {
    unknown.push(refs.reason);
    return;
  }
  if (refs.hasStash) {
    workFound.push("stash present");
  }

  if (!checkRemote) {
    unknown.push("remote not checked");
    return;
  }

  await assessGitRemotes({
    git,
    commonDir: dirs.commonDir,
    config,
    localShas: refs.shas,
    cache,
    deadlines,
    workFound,
    unknown,
  });
}

export async function assessLoss(params: {
  readonly copyPath: string;
  readonly kind: CopyKind;
  readonly throwawayRoot: string | undefined;
  readonly allCopyPaths: readonly string[];
  readonly leases: LeaseLoadResult;
  readonly checkRemote: boolean;
  readonly git: GitRunner;
  readonly cache: LossRunCache;
  readonly deadlines: LossStepDeadlines;
}): Promise<LossResult> {
  if (!params.leases.ok) {
    return { verdict: "unknown", reasons: [params.leases.reason] };
  }

  const unitDir =
    params.throwawayRoot !== undefined
      ? throwawayUnitDir(params.copyPath, params.throwawayRoot)
      : params.copyPath;

  const workFound: string[] = [];
  const unknown: string[] = [];

  for (const claim of params.leases.claims) {
    if (
      isInsidePath(claim.path, unitDir) ||
      isInsidePath(unitDir, claim.path)
    ) {
      workFound.push(`claimed by ${claim.status} lease ${claim.coordinator}`);
    }
  }

  if (params.kind === "project-tree") {
    unknown.push("project tree without Git");
  } else if (isGitCopyKind(params.kind)) {
    await assessGitCopy({
      git: params.git,
      copyPath: params.copyPath,
      kind: params.kind,
      checkRemote: params.checkRemote,
      cache: params.cache,
      deadlines: params.deadlines,
      workFound,
      unknown,
    });
  }

  if (unitDir !== params.copyPath) {
    const strayFile = findOtherFileInUnit(unitDir, params.allCopyPaths);
    if (strayFile !== undefined) {
      unknown.push(`other file in unit outside copy: ${strayFile}`);
    }
  }

  if (workFound.length > 0) {
    return { verdict: "work-found", reasons: [...workFound, ...unknown] };
  }
  if (unknown.length > 0) {
    return { verdict: "unknown", reasons: unknown };
  }
  return { verdict: "nothing-found", reasons: [] };
}

type CopyLossEntry = {
  readonly path: string;
  readonly unitDir: string;
  readonly loss: LossResult;
};

const verdictRank: Readonly<Record<LossVerdict, number>> = {
  "nothing-found": 0,
  unknown: 1,
  "work-found": 2,
};

function mergeLossVerdict(left: LossVerdict, right: LossVerdict): LossVerdict {
  return verdictRank[right] > verdictRank[left] ? right : left;
}

function appendNestedReasons(other: CopyLossEntry, reasons: string[]): void {
  if (other.loss.reasons.length === 0) {
    reasons.push(`nested copy ${other.path}: ${other.loss.verdict}`);
    return;
  }
  for (const reason of other.loss.reasons) {
    reasons.push(`nested copy ${other.path}: ${reason}`);
  }
}

function mergeNestedLosses(
  entry: CopyLossEntry,
  entries: readonly CopyLossEntry[],
  reasons: string[],
): LossVerdict {
  let verdict: LossVerdict = entry.loss.verdict;
  for (const other of entries) {
    if (
      other.path === entry.path ||
      !isInsidePath(other.path, entry.unitDir) ||
      other.loss.verdict === "nothing-found"
    ) {
      continue;
    }
    verdict = mergeLossVerdict(verdict, other.loss.verdict);
    appendNestedReasons(other, reasons);
  }
  return verdict;
}

function mergeScanIncompleteFindings(
  unitDir: string,
  scanIncomplete: readonly Finding[],
  initialVerdict: LossVerdict,
  reasons: string[],
): LossVerdict {
  let verdict = initialVerdict;
  for (const finding of scanIncomplete) {
    if (!isInsidePath(finding.path, unitDir)) continue;
    verdict = mergeLossVerdict(verdict, "unknown");
    reasons.push(`unreadable path ${finding.path}: ${finding.reason}`);
  }
  return verdict;
}

export function propagateUnitLosses(
  entries: readonly CopyLossEntry[],
  findings: readonly Finding[],
): readonly LossResult[] {
  const scanIncomplete = findings.filter(
    (finding) => finding.kind === "scan-incomplete",
  );
  return entries.map((entry) => {
    const reasons: string[] = [...entry.loss.reasons];
    const afterNested = mergeNestedLosses(entry, entries, reasons);
    const verdict = mergeScanIncompleteFindings(
      entry.unitDir,
      scanIncomplete,
      afterNested,
      reasons,
    );
    return { verdict, reasons };
  });
}
