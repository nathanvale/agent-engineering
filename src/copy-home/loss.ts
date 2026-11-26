import { lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";
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
    const remoteResult = await git.lsRemoteShas(effectiveUrl);
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

async function checkLocalRefContained(params: {
  readonly git: GitRunner;
  readonly gitDir: string;
  readonly localSha: string;
  readonly remoteTips: ReadonlySet<string>;
  readonly hasPartialClone: boolean;
}): Promise<"contained" | "unpushed" | "undecided"> {
  if (params.remoteTips.has(params.localSha)) return "contained";
  if (params.remoteTips.size === 0) return "unpushed";
  if (params.hasPartialClone) return "undecided";

  let anyUndecided = false;
  for (const tip of params.remoteTips) {
    const verdict = await params.git.isAncestor(
      params.gitDir,
      params.localSha,
      tip,
    );
    if (verdict === "ancestor") return "contained";
    if (verdict === "unknown") anyUndecided = true;
  }
  return anyUndecided ? "undecided" : "unpushed";
}

async function checkAllLocalRefs(params: {
  readonly git: GitRunner;
  readonly gitDir: string;
  readonly localShas: readonly string[];
  readonly remoteTips: ReadonlySet<string>;
  readonly hasPartialClone: boolean;
  readonly anyProblem: boolean;
}): Promise<{ readonly anyUnpushed: boolean; readonly anyUndecided: boolean }> {
  let anyUnpushed = false;
  let anyUndecided = false;
  for (const localSha of params.localShas) {
    const status = await checkLocalRefContained({
      git: params.git,
      gitDir: params.gitDir,
      localSha,
      remoteTips: params.remoteTips,
      hasPartialClone: params.hasPartialClone,
    });
    if (status === "unpushed") {
      if (params.anyProblem) anyUndecided = true;
      else anyUnpushed = true;
    } else if (status === "undecided") {
      anyUndecided = true;
    }
  }
  return { anyUnpushed, anyUndecided };
}

async function assessGitRemotes(params: {
  readonly git: GitRunner;
  readonly gitDir: string;
  readonly config: Extract<ParsedCopyGitConfig, { readonly ok: true }>;
  readonly localShas: readonly string[];
  readonly workFound: string[];
  readonly unknown: string[];
}): Promise<void> {
  const { git, gitDir, config, localShas, workFound, unknown } = params;
  if (localShas.length === 0) return;
  if (config.hasInclude) {
    unknown.push("repository git config uses includes");
    return;
  }
  if (config.remotes.length === 0) {
    workFound.push("local commits with no remote configured");
    return;
  }

  const { tips, anyProblem } = await collectRemoteTips(git, config, unknown);
  const { anyUnpushed, anyUndecided } = await checkAllLocalRefs({
    git,
    gitDir,
    localShas,
    remoteTips: tips,
    hasPartialClone: config.hasPartialClone,
    anyProblem,
  });

  if (anyUnpushed) {
    workFound.push("local ref not contained in any live remote tip");
  } else if (anyUndecided && !anyProblem) {
    unknown.push(
      config.hasPartialClone
        ? "partial clone ancestry not checked"
        : "remote ancestry could not be decided",
    );
  }
}

async function assessGitCopy(
  git: GitRunner,
  copyPath: string,
  kind: CopyKind,
  checkRemote: boolean,
  workFound: string[],
  unknown: string[],
): Promise<void> {
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
    gitDir: dirs.gitDir,
    config,
    localShas: refs.shas,
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
    await assessGitCopy(
      params.git,
      params.copyPath,
      params.kind,
      params.checkRemote,
      workFound,
      unknown,
    );
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
