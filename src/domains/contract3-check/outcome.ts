// The checker's own outcome (INTERFACE.md section 6), independent of which
// contract major wraps it. Messages are bounded and redacted (VER-11).

import type { ReportRow } from "./book.ts";
import { BUDGETS } from "./budgets.ts";
import { boundText } from "./collector.ts";
import type { Judgement, Refusal } from "./judge.ts";
import { keptCheckerRoute } from "./kept-checker.ts";
import type { Json } from "./types.ts";

export type CheckerStation =
  | "success"
  | "usage"
  | "precondition"
  | "invalid-input"
  | "unsupported-contract";

export interface CheckerOutcome {
  station: CheckerStation;
  message: string;
  data: { reportVersion: 1; rows: ReportRow[] } | null;
}

const FORMAT_CHARACTER = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;

/** A safe, bounded rendering of an observed value, or null when absent. */
function echo(value: Json | undefined): string {
  if (value === undefined) return "null (absent)";
  const json = escapeFormat(JSON.stringify(value));
  const max = BUDGETS.OBSERVED_VALUE_ECHO_MAX_CHARS;
  const chars = [...json];
  return chars.length > max
    ? `${chars.slice(0, max).join("")}... (truncated)`
    : json;
}

function escapeFormat(text: string): string {
  return text.replace(
    FORMAT_CHARACTER,
    (char) => `\\u${(char.codePointAt(0) ?? 0).toString(16).padStart(4, "0")}`,
  );
}

function bounded(message: string): string {
  return boundText(escapeFormat(message), BUDGETS.MESSAGE_MAX_BYTES);
}

const AFTER_EXECUTION =
  " The target already ran; inspect its effects separately. The checker did not and will not rerun it, and its own unchanged state says nothing about the target.";

function majorOf(value: Json | undefined): string {
  return typeof value === "string" ? (value.split(".")[0] ?? value) : "unknown";
}

function refusalMessage(refusal: Refusal, readerVersion: string): string {
  const where = `Case ${refusal.caseId}:`;
  const tail = refusal.targetExecuted ? AFTER_EXECUTION : "";
  switch (refusal.kind) {
    case "malformed":
      return `${where} contractVersion is malformed; observed ${echo(refusal.observedVersion)}. The violated key is contractVersion.${tail}`;
    case "other-major": {
      const kept =
        refusal.observedVersion === "2.0.0"
          ? ` For 2.0.0 output use ${keptCheckerRoute()}.`
          : "";
      return `${where} observed contractVersion ${echo(refusal.observedVersion)} is another major; this reader accepts 3.x up to ${readerVersion} only. Use a reader built for major ${majorOf(refusal.observedVersion)}; nothing was adapted.${kept}${tail}`;
    }
    case "newer-minor":
      return `${where} observed contractVersion ${echo(refusal.observedVersion)} is newer than this reader's ${readerVersion}. Upgrade the reader; nothing was adapted.${tail}`;
    case "broken":
      return refusal.observedVersion === undefined
        ? `${where} the observed output is broken and no contract version was read (reader ${readerVersion}). ${refusal.details.join(" ")}${tail}`
        : `${where} observed contractVersion ${echo(refusal.observedVersion)} is broken (reader ${readerVersion}). ${refusal.details.join(" ")}${tail}`;
  }
}

function summary(
  rows: readonly ReportRow[],
  readerVersion: string,
  observedVersions: readonly string[],
): string {
  const counts = new Map<string, number>();
  for (const row of rows)
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  const parts = [...counts.entries()].map(
    ([status, count]) => `${count} ${status}`,
  );
  const observed =
    observedVersions.length > 0
      ? `observed contractVersion ${observedVersions.join(", ")}`
      : "no machine envelope observed";
  return `Accepted every observation without adaptation as reader ${readerVersion} (${observed}); ${rows.length} admitted rows: ${parts.join(", ")}. Rows other than passed are unproved.`;
}

export function judgementOutcome(judgement: Judgement): CheckerOutcome {
  const { refusal } = judgement;
  if (refusal === null)
    return {
      station: "success",
      message: bounded(
        summary(
          judgement.rows,
          judgement.readerVersion,
          judgement.observedVersions,
        ),
      ),
      data: { reportVersion: 1, rows: judgement.rows },
    };
  return {
    station:
      refusal.kind === "other-major" || refusal.kind === "newer-minor"
        ? "unsupported-contract"
        : "invalid-input",
    message: bounded(refusalMessage(refusal, judgement.readerVersion)),
    data: null,
  };
}

export function admissionOutcome(
  station: "usage" | "precondition" | "invalid-input",
  message: string,
): CheckerOutcome {
  return { station, message: bounded(message), data: null };
}
