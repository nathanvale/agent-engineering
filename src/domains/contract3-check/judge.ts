// Judges an admission (INTERFACE.md section 5). judgeObservations is the one
// pure judgement entry point (binder G1): admission, observations and the
// supported-minor table and the pattern matcher in; every admitted row,
// failed rows included, out. It runs no target and starts nothing itself;
// pattern matching happens only through the matcher the caller passes. The process layer collects observations with the
// single-execution runner, stopping by refusesAlone, then calls it.
// Prerequisites follow binder G2.

import { BUDGETS } from "./budgets.ts";
import { Book, observationEvidence, type ReportRow } from "./book.ts";
import { Collector, isObject, type ShapeContext } from "./collector.ts";
import { judgeAcrossCases, type ParsedCase } from "./cross-rules.ts";
import { validateEnvelope } from "./envelope-rules.ts";
import { readEnvelope } from "./json-ingress.ts";
import type { MinorTable } from "./minors.ts";
import {
  validateCommandDiscovery,
  validateDiscoveryData,
  validateHelpData,
} from "./navigation-data.ts";
import type { PatternMatcher } from "./pattern.ts";
import {
  humanProcessRules,
  machineProcessRules,
  machineStderrRule,
} from "./process-rules.ts";
import { classifyVersion, type VersionClass } from "./version.ts";
import type {
  Admission,
  AdmittedCase,
  Json,
  JsonObject,
  Observation,
} from "./types.ts";

export type RefusalKind =
  | "malformed"
  | "other-major"
  | "newer-minor"
  | "broken";

export interface Refusal {
  kind: RefusalKind;
  caseId: string;
  observedVersion: Json | undefined;
  details: string[];
  targetExecuted: boolean;
}

export interface Judgement {
  rows: ReportRow[];
  refusal: Refusal | null;
  readerVersion: string;
  /** Distinct accepted contractVersion values, in admission order (VER-10 message). */
  observedVersions: string[];
}

const VERSION_RULES: Record<
  Exclude<VersionClass["kind"], "accepted">,
  string
> = {
  malformed: "version-malformed",
  "other-major": "version-major",
  "newer-minor": "version-newer",
};

interface CaseOutcome {
  parsed: ParsedCase | null;
  refusal: Refusal | null;
}

/** Each detail names its case once, so findings from several cases stay legible. */
function labelled(caseId: string, message: string): string {
  return message.startsWith(`case ${caseId}:`)
    ? message
    : `case ${caseId}: ${message}`;
}

function refusalOf(
  kind: RefusalKind,
  item: AdmittedCase,
  observation: Observation,
  observedVersion: Json | undefined,
  details: string[],
): Refusal {
  return {
    kind,
    caseId: item.caseId,
    observedVersion,
    details,
    targetExecuted: observation.source === "run",
  };
}

function validateData(
  ctx: ShapeContext,
  cli: string,
  envelope: JsonObject,
  version: string,
): Pick<ParsedCase, "discovery" | "help" | "description"> {
  const result = isObject(envelope.result) ? envelope.result : {};
  const none = { discovery: null, help: null, description: null };
  if (result.outcome !== "success") return none;
  switch (result.commandIdentity) {
    case `${cli}.help`:
      return { ...none, help: validateHelpData(ctx, result.data) };
    case `${cli}.discovery`:
      return {
        ...none,
        discovery: validateDiscoveryData(ctx, result.data, version),
      };
    case `${cli}.command-discovery`:
      return {
        ...none,
        description: validateCommandDiscovery(ctx, result.data),
      };
    default:
      return none;
  }
}

function judgeMachine(
  admission: Admission,
  item: AdmittedCase,
  observation: Observation,
  minors: MinorTable,
  book: Book,
): CaseOutcome {
  const ingress = readEnvelope(
    observation.stdout.bytes,
    BUDGETS.TARGET_JSON_MAX_DEPTH,
  );
  const c = new Collector();
  c.touch("json-framing");
  machineStderrRule(c, observation);
  for (const finding of ingress.findings)
    c.fail(finding.ruleId, finding.message);
  if (!ingress.ok) {
    // A machine navigation or dispatch invocation must answer with one
    // envelope (DISC-1), so dispatch is judged even without one.
    if (item.role !== "command")
      c.fail(
        "dispatch",
        `A machine ${item.role} invocation must print one envelope (DISC-1).`,
      );
    book.record(item.caseId, c);
    book.block(
      item.caseId,
      ["json-framing", "machine-stderr", "dispatch"],
      "Blocked: the output failed json-framing, so no envelope was read (G2.1).",
    );
    return {
      parsed: null,
      refusal: refusalOf(
        "broken",
        item,
        observation,
        undefined,
        ingress.findings.map((finding) => finding.message),
      ),
    };
  }
  const envelope = ingress.value;
  const version = classifyVersion(envelope.contractVersion, minors);
  if (version.kind !== "accepted") {
    c.touch(...Object.values(VERSION_RULES));
    c.fail(
      VERSION_RULES[version.kind],
      `contractVersion classified ${version.kind}.`,
    );
    book.record(item.caseId, c);
    book.block(
      item.caseId,
      ["json-framing", "machine-stderr", ...Object.values(VERSION_RULES)],
      "Blocked: the version was refused, so no other key was interpreted (VER-10, G2.2).",
    );
    return {
      parsed: null,
      refusal: refusalOf(
        version.kind,
        item,
        observation,
        envelope.contractVersion,
        [],
      ),
    };
  }
  c.touch(...Object.values(VERSION_RULES));
  const ctx: ShapeContext = { c, minors, declaredMinor: version.minor };
  validateEnvelope(ctx, envelope);
  const data = validateData(ctx, admission.cli, envelope, version.observed);
  machineProcessRules(c, item, admission.cli, observation, envelope);
  book.record(item.caseId, c);
  const result = isObject(envelope.result) ? envelope.result : null;
  const refused = c.findings.length > 0;
  const parsed: ParsedCase = {
    item,
    observation,
    envelope,
    result,
    ...data,
    refused,
  };
  if (!refused) return { parsed, refusal: null };
  return {
    parsed,
    refusal: refusalOf(
      "broken",
      item,
      observation,
      version.observed,
      c.findings.map((finding) => finding.message),
    ),
  };
}

function judgeHuman(
  item: AdmittedCase,
  observation: Observation,
  book: Book,
): CaseOutcome {
  const c = new Collector();
  humanProcessRules(c, item, observation);
  book.record(item.caseId, c);
  const parsed: ParsedCase = {
    item,
    observation,
    envelope: null,
    result: null,
    discovery: null,
    help: null,
    description: null,
    refused: c.findings.length > 0,
  };
  if (!parsed.refused) return { parsed, refusal: null };
  return {
    parsed,
    refusal: refusalOf(
      "broken",
      item,
      observation,
      undefined,
      c.findings.map((finding) => finding.message),
    ),
  };
}

function judgeObservation(
  admission: Admission,
  item: AdmittedCase,
  observation: Observation,
  minors: MinorTable,
  book: Book,
): CaseOutcome {
  if (!observation.started) {
    book.wholeCase(
      item.caseId,
      "not_run",
      `The target did not start: ${observation.startError ?? "spawn failed"}. It was not retried.`,
    );
    return { parsed: null, refusal: null };
  }
  if (observation.timedOut) {
    book.wholeCase(
      item.caseId,
      "timed_out",
      `The target exceeded the ${BUDGETS.TARGET_RUN_MAX_MS} ms run budget and was terminated; its effects are unknown and it was not retried.`,
    );
    return { parsed: null, refusal: null };
  }
  if (observation.stdout.overBudget || observation.stderr.overBudget)
    return {
      parsed: null,
      refusal: refusalOf("broken", item, observation, undefined, [
        `Target ${observation.stdout.overBudget ? "stdout" : "stderr"} exceeded the reader's byte budget.`,
      ]),
    };
  return item.mode === "machine"
    ? judgeMachine(admission, item, observation, minors, book)
    : judgeHuman(item, observation, book);
}

/** Whether this observation alone refuses the invocation (the stop rule). */
export function refusesAlone(
  admission: Admission,
  item: AdmittedCase,
  observation: Observation,
  minors: MinorTable,
): boolean {
  return (
    judgeObservation(admission, item, observation, minors, new Book())
      .refusal !== null
  );
}

const NOT_EXECUTED =
  "Not executed: the checker starts no further target after a refused observation.";

/** The one pure judgement: every admitted row, failed rows included. */
export async function judgeObservations(
  admission: Admission,
  observations: ReadonlyMap<string, Observation>,
  minors: MinorTable,
  matcher: PatternMatcher,
): Promise<Judgement> {
  const book = new Book();
  const parsedCases: ParsedCase[] = [];
  const refusals = new Map<string, Refusal>();
  for (const item of admission.cases) {
    const observation = observations.get(item.caseId);
    if (observation === undefined) {
      book.wholeCase(item.caseId, "not_run", NOT_EXECUTED);
      continue;
    }
    book.evidence.set(item.caseId, observationEvidence(observation));
    const outcome = judgeObservation(
      admission,
      item,
      observation,
      minors,
      book,
    );
    if (outcome.refusal !== null) refusals.set(item.caseId, outcome.refusal);
    if (outcome.parsed !== null) parsedCases.push(outcome.parsed);
  }
  const collectors = await judgeAcrossCases(
    admission.cli,
    parsedCases,
    matcher,
    book,
  );
  for (const parsed of parsedCases) {
    const c = collectors.get(parsed.item.caseId);
    if (c === undefined) continue;
    book.record(parsed.item.caseId, c);
    if (c.findings.length === 0) continue;
    const details = c.findings.map((finding) => finding.message);
    const existing = refusals.get(parsed.item.caseId);
    if (existing === undefined)
      refusals.set(
        parsed.item.caseId,
        refusalOf(
          "broken",
          parsed.item,
          parsed.observation,
          parsed.envelope?.contractVersion,
          details,
        ),
      );
    else existing.details.push(...details);
  }
  return {
    rows: book.rows(admission.cases),
    refusal: firstRefusal(admission, refusals),
    readerVersion: minors.readerVersion,
    observedVersions: [
      ...new Set(
        parsedCases
          .map((parsed) => parsed.envelope?.contractVersion)
          .filter((version): version is string => typeof version === "string"),
      ),
    ],
  };
}

/** The first refused case in admission order sets the cause; every case's detail stays visible. */
function firstRefusal(
  admission: Admission,
  refusals: ReadonlyMap<string, Refusal>,
): Refusal | null {
  const ordered = admission.cases
    .map((item) => refusals.get(item.caseId))
    .filter((refusal): refusal is Refusal => refusal !== undefined);
  const [first, ...rest] = ordered;
  if (first === undefined) return null;
  return {
    ...first,
    details: [
      ...first.details.map((detail) => labelled(first.caseId, detail)),
      ...rest.flatMap((refusal) =>
        refusal.details.length > 0
          ? refusal.details.map((detail) => labelled(refusal.caseId, detail))
          : [labelled(refusal.caseId, `refused as ${refusal.kind}.`)],
      ),
    ],
  };
}
