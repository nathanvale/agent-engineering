import type {
  GitRunner,
  LsRemoteResult,
  PeelCommitsResult,
  UncontainedShasResult,
} from "./git.ts";
import { compareText } from "./rules.ts";

export type LossStepDeadlines = {
  readonly remoteMs: number;
  readonly localMs: number;
};

export const defaultLossDeadlines: LossStepDeadlines = {
  remoteMs: 25_000,
  localMs: 15_000,
};

export type LocalShaStatus = "contained" | "unpushed" | "undecided";

type TipPresenceEntry =
  | {
      readonly ok: true;
      readonly present: readonly string[];
      readonly anyMissing: boolean;
    }
  | { readonly ok: false; readonly reason: string };

type AncestryCacheEntry = {
  tipPresence?: TipPresenceEntry;
  readonly verdicts: Map<string, LocalShaStatus>;
  failureReason?: string;
};

export type LossRunCache = {
  readonly lsRemote: Map<string, LsRemoteResult>;
  readonly ancestry: Map<string, AncestryCacheEntry>;
};

export function createLossRunCache(): LossRunCache {
  return {
    lsRemote: new Map(),
    ancestry: new Map(),
  };
}

type DeadlineOutcome<T> =
  | { readonly status: "ok"; readonly value: T }
  | { readonly status: "timed-out" }
  | { readonly status: "failed" };

async function awaitWithDeadline<T>(
  work: Promise<T>,
  deadlineMs: number,
): Promise<DeadlineOutcome<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<DeadlineOutcome<T>>((resolve) => {
    timer = setTimeout(() => {
      resolve({ status: "timed-out" });
    }, deadlineMs);
  });
  const settledPromise = work.then(
    (value): DeadlineOutcome<T> => ({ status: "ok", value }),
    (): DeadlineOutcome<T> => ({ status: "failed" }),
  );
  try {
    return await Promise.race([settledPromise, timeoutPromise]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function fetchRemoteShasCached(
  git: GitRunner,
  effectiveUrl: string,
  cache: LossRunCache,
  deadlines: LossStepDeadlines,
): Promise<LsRemoteResult> {
  const cached = cache.lsRemote.get(effectiveUrl);
  if (cached !== undefined) return cached;
  const outcome = await awaitWithDeadline(
    git.lsRemoteShas(effectiveUrl),
    deadlines.remoteMs,
  );
  let result: LsRemoteResult;
  if (outcome.status === "ok") {
    result = outcome.value;
  } else if (outcome.status === "timed-out") {
    result = { ok: false, reason: "git ls-remote timed out" };
  } else {
    result = { ok: false, reason: "git ls-remote failed" };
  }
  cache.lsRemote.set(effectiveUrl, result);
  return result;
}

async function resolveTipPresence(
  git: GitRunner,
  commonDir: string,
  sortedTips: readonly string[],
  entry: AncestryCacheEntry,
  deadlines: LossStepDeadlines,
): Promise<TipPresenceEntry> {
  if (entry.tipPresence !== undefined) return entry.tipPresence;
  const outcome = await awaitWithDeadline(
    git.existingObjects(commonDir, sortedTips),
    deadlines.localMs,
  );
  let presence: TipPresenceEntry;
  if (outcome.status === "ok") {
    presence = outcome.value;
  } else if (outcome.status === "timed-out") {
    presence = { ok: false, reason: "git cat-file timed out" };
  } else {
    presence = { ok: false, reason: "git cat-file failed" };
  }
  entry.tipPresence = presence;
  return presence;
}

function markUndecided(
  entry: AncestryCacheEntry,
  shas: readonly string[],
  reason?: string,
): void {
  for (const sha of shas) {
    entry.verdicts.set(sha, "undecided");
  }
  if (reason !== undefined) {
    entry.failureReason = reason;
  }
}

async function peelLocalCommits(
  git: GitRunner,
  commonDir: string,
  shas: readonly string[],
  deadlines: LossStepDeadlines,
): Promise<PeelCommitsResult> {
  const outcome = await awaitWithDeadline(
    git.peelCommits(commonDir, shas),
    deadlines.localMs,
  );
  if (outcome.status === "ok") return outcome.value;
  if (outcome.status === "timed-out") {
    return { ok: false, reason: "git cat-file timed out" };
  }
  return { ok: false, reason: "git cat-file failed" };
}

async function runUncontainedCheck(
  git: GitRunner,
  commonDir: string,
  peeledCommits: readonly string[],
  presentTips: readonly string[],
  deadlines: LossStepDeadlines,
): Promise<UncontainedShasResult> {
  const outcome = await awaitWithDeadline(
    git.uncontainedShas(commonDir, peeledCommits, presentTips),
    deadlines.localMs,
  );
  if (outcome.status === "ok") return outcome.value;
  if (outcome.status === "timed-out") {
    return { ok: false, reason: "git rev-list timed out" };
  }
  return { ok: false, reason: "git rev-list failed" };
}

function collectPeeledCommits(
  unchecked: readonly string[],
  peeled: ReadonlyMap<string, string>,
  entry: AncestryCacheEntry,
): readonly string[] {
  const peeledCommits: string[] = [];
  const seenCommits = new Set<string>();
  for (const sha of unchecked) {
    const commitSha = peeled.get(sha);
    if (commitSha === undefined) {
      entry.verdicts.set(sha, "undecided");
    } else if (!seenCommits.has(commitSha)) {
      seenCommits.add(commitSha);
      peeledCommits.push(commitSha);
    }
  }
  return peeledCommits;
}

function recordPeeledVerdicts(
  unchecked: readonly string[],
  peeled: ReadonlyMap<string, string>,
  uncontained: ReadonlySet<string>,
  fallbackStatus: LocalShaStatus,
  entry: AncestryCacheEntry,
): void {
  for (const sha of unchecked) {
    const commitSha = peeled.get(sha);
    if (commitSha === undefined) continue;
    entry.verdicts.set(
      sha,
      uncontained.has(commitSha) ? fallbackStatus : "contained",
    );
  }
}

async function populateUncheckedVerdicts(params: {
  readonly git: GitRunner;
  readonly commonDir: string;
  readonly sortedTips: readonly string[];
  readonly unchecked: readonly string[];
  readonly entry: AncestryCacheEntry;
  readonly deadlines: LossStepDeadlines;
}): Promise<void> {
  const presence = await resolveTipPresence(
    params.git,
    params.commonDir,
    params.sortedTips,
    params.entry,
    params.deadlines,
  );
  if (!presence.ok) {
    markUndecided(params.entry, params.unchecked, presence.reason);
    return;
  }
  if (presence.present.length === 0) {
    markUndecided(params.entry, params.unchecked);
    return;
  }
  const peelResult = await peelLocalCommits(
    params.git,
    params.commonDir,
    params.unchecked,
    params.deadlines,
  );
  if (!peelResult.ok) {
    markUndecided(params.entry, params.unchecked, peelResult.reason);
    return;
  }
  const peeledCommits = collectPeeledCommits(
    params.unchecked,
    peelResult.peeled,
    params.entry,
  );
  if (peeledCommits.length === 0) return;
  const uncontainedResult = await runUncontainedCheck(
    params.git,
    params.commonDir,
    peeledCommits,
    presence.present,
    params.deadlines,
  );
  if (!uncontainedResult.ok) {
    markUndecided(params.entry, params.unchecked, uncontainedResult.reason);
    return;
  }
  const fallbackStatus: LocalShaStatus = presence.anyMissing
    ? "undecided"
    : "unpushed";
  recordPeeledVerdicts(
    params.unchecked,
    peelResult.peeled,
    uncontainedResult.uncontained,
    fallbackStatus,
    params.entry,
  );
}

export async function checkLocalShasAncestry(params: {
  readonly git: GitRunner;
  readonly commonDir: string;
  readonly localShas: readonly string[];
  readonly remoteTips: ReadonlySet<string>;
  readonly hasPartialClone: boolean;
  readonly cache: LossRunCache;
  readonly deadlines: LossStepDeadlines;
}): Promise<{
  readonly verdicts: ReadonlyMap<string, LocalShaStatus>;
  readonly failureReason: string | undefined;
}> {
  const verdicts = new Map<string, LocalShaStatus>();
  const needsCheck: string[] = [];
  for (const sha of params.localShas) {
    if (params.remoteTips.has(sha)) {
      verdicts.set(sha, "contained");
    } else if (params.remoteTips.size === 0) {
      verdicts.set(sha, "unpushed");
    } else if (params.hasPartialClone) {
      verdicts.set(sha, "undecided");
    } else if (!verdicts.has(sha)) {
      needsCheck.push(sha);
    }
  }
  if (needsCheck.length === 0) {
    return { verdicts, failureReason: undefined };
  }

  const sortedTips = [...params.remoteTips].sort(compareText);
  const cacheKey = `${params.commonDir}\0${sortedTips.join("\n")}`;
  let entry = params.cache.ancestry.get(cacheKey);
  if (entry === undefined) {
    entry = { verdicts: new Map() };
    params.cache.ancestry.set(cacheKey, entry);
  }

  const unchecked = [...new Set(needsCheck)].filter(
    (sha) => !entry.verdicts.has(sha),
  );
  if (unchecked.length > 0) {
    await populateUncheckedVerdicts({
      git: params.git,
      commonDir: params.commonDir,
      sortedTips,
      unchecked,
      entry,
      deadlines: params.deadlines,
    });
  }

  for (const sha of needsCheck) {
    verdicts.set(sha, entry.verdicts.get(sha) ?? "undecided");
  }
  return { verdicts, failureReason: entry.failureReason };
}
