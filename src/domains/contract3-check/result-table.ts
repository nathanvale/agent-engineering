// The result truth table (WIRE-14 to WIRE-16) and the fixed rows of the
// common causes (WIRE-18), restated from wire.md. Host causes stay open
// (VER-7, WIRE-20): an unknown cause is judged by its row only.

const EXIT_BY_CLASS: Readonly<Record<string, number>> = {
  internal: 1,
  usage: 2,
  domain: 3,
  schema: 4,
  transient: 75,
};

export type Arm = "next" | "handoff";

export interface ResultRow {
  outcome: string;
  transactionState: string;
  failureClass: string | null;
  exitCode: number;
  retryable: boolean;
  arm: Arm | null;
}

interface CommonCause {
  failureClass: string | null;
  outcome: string;
  transactionState: string;
  arm: Arm;
}

function common(
  failureClass: string | null,
  outcome: string,
  transactionState: string,
  arm: Arm,
): CommonCause {
  return { failureClass, outcome, transactionState, arm };
}

export const COMMON_CAUSES: Readonly<Record<string, CommonCause>> = {
  SUCCESS_UNCHANGED: common(null, "success", "unchanged", "next"),
  SUCCESS_COMPLETED: common(null, "success", "completed", "next"),
  USAGE_INVALID_INVOCATION: common("usage", "refused", "unchanged", "next"),
  USAGE_UNKNOWN_COMMAND: common("usage", "refused", "unchanged", "next"),
  SCHEMA_INVALID_INPUT: common("schema", "refused", "unchanged", "next"),
  SCHEMA_UNSUPPORTED_CONTRACT: common("schema", "refused", "unchanged", "next"),
  DOMAIN_PRECONDITION_UNMET: common("domain", "refused", "unchanged", "next"),
  DOMAIN_AUTHORITY_REQUIRED: common(
    "domain",
    "refused",
    "unchanged",
    "handoff",
  ),
  TRANSIENT_NOT_STARTED: common("transient", "refused", "unchanged", "next"),
  TRANSIENT_ATTEMPT_UNCHANGED: common(
    "transient",
    "failed",
    "unchanged",
    "next",
  ),
  DOMAIN_DEADLINE_BEFORE_START: common(
    "domain",
    "refused",
    "unchanged",
    "next",
  ),
  DOMAIN_DEADLINE_UNCHANGED: common("domain", "failed", "unchanged", "next"),
  DOMAIN_DEADLINE_COMPLETED: common("domain", "failed", "completed", "handoff"),
  DOMAIN_DEADLINE_PARTIAL: common(
    "domain",
    "failed",
    "partially-completed",
    "handoff",
  ),
  DOMAIN_DEADLINE_UNKNOWN: common("domain", "failed", "unknown", "handoff"),
  INTERNAL_PREPARATION: common("internal", "refused", "unchanged", "next"),
  INTERNAL_RESULT_UNCHANGED: common(
    "internal",
    "failed",
    "unchanged",
    "handoff",
  ),
  INTERNAL_RESULT_COMPLETED: common(
    "internal",
    "failed",
    "completed",
    "handoff",
  ),
  INTERNAL_RESULT_PARTIAL: common(
    "internal",
    "failed",
    "partially-completed",
    "handoff",
  ),
  INTERNAL_RESULT_UNKNOWN: common("internal", "failed", "unknown", "handoff"),
};

/** Causes the fallback can select (LIFE-9, DISC-11b). */
export function isFallbackCause(cause: string): boolean {
  return (
    cause === "INTERNAL_PREPARATION" || cause.startsWith("INTERNAL_RESULT_")
  );
}

function successProblems(row: ResultRow): string[] {
  const problems: string[] = [];
  if (row.failureClass !== null)
    problems.push("success requires failureClass null");
  if (row.exitCode !== 0) problems.push("success requires exitCode 0");
  if (
    row.transactionState !== "unchanged" &&
    row.transactionState !== "completed"
  )
    problems.push("success requires state unchanged or completed");
  if (row.retryable) problems.push("success is never retryable");
  if (row.arm === "handoff") problems.push("success carries next, not handoff");
  return problems;
}

function failureProblems(row: ResultRow, failureClass: string): string[] {
  const problems: string[] = [];
  const expectedExit = EXIT_BY_CLASS[failureClass];
  if (expectedExit !== undefined && row.exitCode !== expectedExit)
    problems.push(
      `exitCode ${row.exitCode} disagrees with failure class ${failureClass} (${expectedExit})`,
    );
  const changed = row.transactionState !== "unchanged";
  if (row.outcome === "refused" && changed)
    problems.push("a refusal is always unchanged");
  if (row.outcome === "failed" && failureClass === "usage")
    problems.push("failed with usage is invalid");
  if (failureClass === "transient" && changed)
    problems.push("transient never reports changed or uncertain effects");
  const retryable = failureClass === "transient" && !changed;
  if (row.retryable !== retryable)
    problems.push(`retryable must be ${retryable} for this row`);
  if (changed && row.arm === "next")
    problems.push("completed, partial or unknown effects require a handoff");
  if (failureClass === "transient" && row.arm === "handoff")
    problems.push("a transient row carries next");
  return problems;
}

/** Problems with one result row, its failure class and its common cause. */
export function rowProblems(row: ResultRow, cause: string): string[] {
  const problems =
    row.outcome === "success"
      ? successProblems(row)
      : row.failureClass === null
        ? ["refused or failed requires a failure class"]
        : failureProblems(row, row.failureClass);
  const fixed = COMMON_CAUSES[cause];
  if (fixed === undefined) return problems;
  if (
    fixed.failureClass !== row.failureClass ||
    fixed.outcome !== row.outcome ||
    fixed.transactionState !== row.transactionState
  )
    problems.push(
      `common cause ${cause} is fixed to ${fixed.outcome}, ${fixed.transactionState}, ${String(fixed.failureClass)}`,
    );
  if (row.arm !== null && row.arm !== fixed.arm)
    problems.push(`common cause ${cause} carries ${fixed.arm}`);
  return problems;
}
