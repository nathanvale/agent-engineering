// Process rules judged on one observation against the admission's
// independent expectations (V-9, V-43, LIFE-1, LIFE-2, DISC-1, DISC-2).
// Expected exits and causes come only from the admission, never the target.

import { isObject, type Collector } from "./collector.ts";
import { COMMON_CAUSES, type CommonCauseCode } from "./result-table.ts";

const USAGE_INVALID: CommonCauseCode = "USAGE_INVALID_INVOCATION";
const USAGE_UNKNOWN: CommonCauseCode = "USAGE_UNKNOWN_COMMAND";
import type { AdmittedCase, JsonObject, Observation } from "./types.ts";

function exitText(observation: Observation): string {
  if (observation.exit === null) return "no exit";
  return "code" in observation.exit
    ? `exit ${observation.exit.code}`
    : `signal ${observation.exit.signal}`;
}

function exitCode(observation: Observation): number | null {
  return observation.exit !== null && "code" in observation.exit
    ? observation.exit.code
    : null;
}

function expectedExit(
  c: Collector,
  item: AdmittedCase,
  observation: Observation,
): void {
  // S1 option (i): an expectation rule is judged only when admitted.
  if (item.expect === undefined || !item.rules.includes("exit-expected"))
    return;
  const expected = item.expect.exitCode;
  c.check(
    "exit-expected",
    exitCode(observation) === expected,
    () =>
      `Real ${exitText(observation)} differs from the independently expected exitCode ${expected}.`,
  );
}

const NAVIGATION_IDENTITY: Readonly<Record<string, string>> = {
  help: "help",
  discovery: "discovery",
  "command-discovery": "command-discovery",
  dispatch: "dispatch",
};

function dispatchMachine(
  c: Collector,
  item: AdmittedCase,
  cli: string,
  result: JsonObject,
): void {
  const suffix = NAVIGATION_IDENTITY[item.role];
  if (suffix === undefined) return;
  const identity = `${cli}.${suffix}`;
  const ok =
    result.commandIdentity === identity &&
    (item.role === "dispatch"
      ? result.outcome === "refused" &&
        result.causeCode === USAGE_INVALID &&
        result.exitCode === 2
      : item.role === "command-discovery"
        ? (result.outcome === "success" && result.effectClass === "inspect") ||
          (result.causeCode === USAGE_UNKNOWN && result.exitCode === 2)
        : result.outcome === "success" &&
          result.effectClass === "inspect" &&
          result.exitCode === 0);
  c.check(
    "dispatch",
    ok,
    () =>
      `A ${item.role} invocation must answer as ${identity} with its DISC-1 outcome.`,
  );
}

/** Ordinary machine completion leaves stderr empty (LIFE-1). Judged even when framing fails. */
export function machineStderrRule(
  c: Collector,
  observation: Observation,
): void {
  if (observation.source === "run" && exitCode(observation) !== null)
    c.check(
      "machine-stderr",
      observation.stderr.bytes.length === 0,
      () =>
        `Ordinary machine completion wrote ${observation.stderr.bytes.length} stderr bytes; stderr must be empty.`,
    );
}

/** Binder G17: an expected identity is owned by the admitted rule that judges identity. */
const IDENTITY_RULES = [
  "dispatch",
  "command-selection",
  "input-dash",
  "input-deadline",
];

function identityOwner(item: AdmittedCase): string {
  return (
    item.rules.find((rule) => IDENTITY_RULES.includes(rule)) ?? "cause-expected"
  );
}

/** Rules for one machine-mode observation with an accepted envelope. */
export function machineProcessRules(
  c: Collector,
  item: AdmittedCase,
  cli: string,
  observation: Observation,
  envelope: JsonObject,
): void {
  // Captured bytes prove no process observation (INTERFACE.md section 3).
  if (observation.source === "captured") return;
  const result = isObject(envelope.result) ? envelope.result : {};
  const code = exitCode(observation);
  c.check(
    "exit-envelope",
    code !== null && code === result.exitCode,
    () =>
      `Real ${exitText(observation)} differs from the envelope exitCode ${JSON.stringify(result.exitCode)}.`,
  );
  expectedExit(c, item, observation);
  const expect = item.expect;
  // S1 option (i): cause, outcome and identity expectations are judged only
  // when their owning rule is admitted; a valid envelope is never refused
  // because an unadmitted expectation differs.
  const causeAdmitted = item.rules.includes("cause-expected");
  const identityRule = identityOwner(item);
  if (causeAdmitted && expect?.causeCode !== undefined)
    c.check(
      "cause-expected",
      result.causeCode === expect.causeCode,
      () =>
        `Observed causeCode ${JSON.stringify(result.causeCode)} differs from the independently expected ${expect.causeCode}.`,
    );
  if (
    item.rules.includes(identityRule) &&
    expect?.commandIdentity !== undefined
  )
    c.check(
      identityRule,
      result.commandIdentity === expect.commandIdentity,
      () =>
        `Observed commandIdentity ${JSON.stringify(result.commandIdentity)} differs from the expected ${expect.commandIdentity}.`,
    );
  if (causeAdmitted && expect?.outcome !== undefined)
    c.check(
      "cause-expected",
      result.outcome === expect.outcome,
      () =>
        `Observed outcome ${JSON.stringify(result.outcome)} differs from the expected ${expect.outcome}.`,
    );
  c.unproved(
    "diagnostics-absent",
    "No independent fact in the admission file says whether the target enables diagnostics (stopped case G13).",
  );
  if (
    typeof result.causeCode === "string" &&
    COMMON_CAUSES[result.causeCode] === undefined
  )
    c.touch("open-cause");
  if (item.role === "help" || item.role === "discovery")
    c.check(
      "provider-loading",
      code === 0,
      () =>
        `Navigation under the admission file's environment ended with ${exitText(observation)}; it must not need providers or credentials.`,
    );
  dispatchMachine(c, item, cli, result);
}

function lineCount(bytes: Uint8Array): number {
  const text = new TextDecoder().decode(bytes);
  return text.length === 0
    ? 0
    : text.endsWith("\n")
      ? text.slice(0, -1).split("\n").length
      : Number.NaN;
}

function looksLikeEnvelope(bytes: Uint8Array): boolean {
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return (
      value !== null && typeof value === "object" && "contractVersion" in value
    );
  } catch {
    return false;
  }
}

/** Rules for one human-mode observation (LIFE-2, DISC-1, DISC-2, binder G18). */
export function humanProcessRules(
  c: Collector,
  item: AdmittedCase,
  observation: Observation,
): void {
  if (observation.source === "captured") return;
  expectedExit(c, item, observation);
  const code = exitCode(observation);
  const printed = observation.stdout.bytes.length > 0;
  const oneStderrLine = lineCount(observation.stderr.bytes) === 1;
  c.check(
    "global-mode",
    !looksLikeEnvelope(observation.stdout.bytes),
    () =>
      "Human mode printed a machine envelope; --json after -- is an operand, never the global switch.",
  );
  if (item.role === "dispatch") {
    c.check(
      "dispatch",
      code === 2 && oneStderrLine,
      () =>
        `A human usage refusal exits 2 with exactly one stderr line; observed ${exitText(observation)}.`,
    );
    return;
  }
  // F3: one owner per DISC-1 row. Human help belongs to dispatch; human
  // discovery and command discovery belong to human-discovery.
  if (item.role === "help") {
    c.check(
      "dispatch",
      code === 0 && printed,
      () =>
        `Human help must exit 0 on stdout; observed ${exitText(observation)}.`,
    );
    return;
  }
  if (item.role !== "discovery" && item.role !== "command-discovery") return;
  const navigation =
    item.role === "command-discovery" && code !== 0
      ? oneStderrLine
      : code === 0 && printed;
  c.check(
    "human-discovery",
    navigation,
    () =>
      `Human ${item.role} prints to stdout with exit 0 without --json, or refuses with one stderr line; observed ${exitText(observation)}.`,
  );
}
