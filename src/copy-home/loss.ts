import { lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { GitRunner } from "./git.ts";
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

type RemoteTipSummary = {
  readonly presentTips: readonly string[];
  readonly anyProblem: boolean;
  readonly anyTipMissing: boolean;
};

async function collectRemoteTips(
  git: GitRunner,
  copyPath: string,
  remoteNames: readonly string[],
  unknown: string[],
): Promise<RemoteTipSummary> {
  const presentTips = new Set<string>();
  let anyProblem = false;
  let anyTipMissing = false;

  for (const remote of remoteNames) {
    const effectiveUrl = await git.effectiveRemoteUrl(copyPath, remote);
    if (effectiveUrl === undefined || !isNetworkRemoteUrl(effectiveUrl)) {
      unknown.push(`remote ${remote} effective URL is not a network URL`);
      anyProblem = true;
      continue;
    }
    const remoteShas = await git.lsRemoteShas(copyPath, remote);
    if (remoteShas === undefined) {
      unknown.push(`git ls-remote failed for ${remote}`);
      anyProblem = true;
      continue;
    }
    for (const sha of remoteShas) {
      if (await git.commitExists(copyPath, sha)) presentTips.add(sha);
      else anyTipMissing = true;
    }
  }
  return {
    presentTips: [...presentTips],
    anyProblem,
    anyTipMissing,
  };
}

async function assessGitRemotes(
  git: GitRunner,
  copyPath: string,
  localShas: readonly string[],
  workFound: string[],
  unknown: string[],
): Promise<void> {
  if (localShas.length === 0) return;
  const remotes = await git.remotes(copyPath);
  if (!remotes.ok) {
    unknown.push("git remote failed");
    return;
  }
  if (remotes.names.length === 0) {
    workFound.push("local commits with no remote configured");
    return;
  }

  const tips = await collectRemoteTips(git, copyPath, remotes.names, unknown);
  const containment = await git.hasUncontainedCommits(
    copyPath,
    localShas,
    tips.presentTips,
  );
  if (!containment.ok) {
    unknown.push("git rev-list failed");
    return;
  }
  if (!containment.uncontained) return;

  if (tips.anyTipMissing) {
    unknown.push("remote tip missing locally");
  } else if (!tips.anyProblem) {
    workFound.push("local ref not contained in any live remote tip");
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
    const status = await git.statusPorcelain(copyPath);
    if (!status.ok) unknown.push(status.reason ?? "git status failed");
    else if (status.dirty) workFound.push("uncommitted or untracked changes");
  }

  const stash = await git.hasStash(copyPath);
  if (!stash.ok) unknown.push("git stash list failed");
  else if (stash.present) workFound.push("stash present");

  const local = await git.localCommitShas(copyPath);
  if (!local.ok) {
    unknown.push("git for-each-ref failed");
    return;
  }

  if (!checkRemote) {
    unknown.push("remote not checked");
    return;
  }
  await assessGitRemotes(git, copyPath, local.shas, workFound, unknown);
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
