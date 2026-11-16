// Collects per-case rule evaluations and builds the VER-14 row report
// (tests/contract3/checker-report.schema.json, reportVersion 1).

import { ruleSpec } from "./rules.ts";
import type { Collector } from "./collector.ts";
import type { ListedCase, Finding, Observation } from "./types.ts";

export type RowStatus = "passed" | "failed" | "not_run" | "timed_out";

export interface ReportRow {
  ruleId: string;
  caseId: string;
  status: RowStatus;
  findings: { code: string; message: string }[];
  evidence: string[];
  reason: string | null;
}

interface Entry {
  findings: Finding[];
  exercised: boolean;
  evidence: Set<string>;
  reason: string | null;
}

export function observationEvidence(observation: Observation): string[] {
  const id = observation.caseId;
  const tokens = [
    `case:${id}:${observation.source === "run" ? "run-once" : "captured"}`,
    `case:${id}:stdout-sha256:${new Bun.CryptoHasher("sha256").update(observation.stdout.bytes).digest("hex")}`,
    `case:${id}:stderr-bytes:${observation.stderr.bytes.length}`,
  ];
  if (observation.exit !== null)
    tokens.push(
      "code" in observation.exit
        ? `case:${id}:exit:${observation.exit.code}`
        : `case:${id}:signal:${observation.exit.signal}`,
    );
  return tokens;
}

export class Book {
  private readonly entries = new Map<string, Entry>();
  private readonly caseReasons = new Map<
    string,
    { status: RowStatus; reason: string }
  >();
  private readonly blocked = new Map<
    string,
    { allowed: ReadonlySet<string>; reason: string }
  >();
  private readonly overrides = new Map<
    string,
    { status: "not_run" | "timed_out"; reason: string }
  >();
  readonly evidence = new Map<string, string[]>();
  readonly failures: { caseId: string; finding: Finding }[] = [];

  private entry(caseId: string, ruleId: string): Entry {
    const key = `${caseId}\u0000${ruleId}`;
    let entry = this.entries.get(key);
    if (entry === undefined) {
      entry = {
        findings: [],
        exercised: false,
        evidence: new Set(),
        reason: null,
      };
      this.entries.set(key, entry);
    }
    return entry;
  }

  record(
    caseId: string,
    collector: Collector,
    extraEvidence: string[] = [],
  ): void {
    const evidence = [...(this.evidence.get(caseId) ?? []), ...extraEvidence];
    for (const ruleId of collector.exercised) {
      const entry = this.entry(caseId, ruleId);
      entry.exercised = true;
      for (const token of evidence) entry.evidence.add(token);
    }
    for (const [ruleId, reason] of collector.unprovable)
      this.unproved(caseId, ruleId, reason);
    for (const finding of collector.findings) {
      this.entry(caseId, finding.ruleId).findings.push(finding);
      this.failures.push({ caseId, finding });
    }
  }

  /** A reason this rule could not be evaluated for this case. */
  unproved(caseId: string, ruleId: string, reason: string): void {
    const entry = this.entry(caseId, ruleId);
    entry.reason ??= reason;
  }

  /** G2: a failed prerequisite leaves every other rule of the case not_run. */
  block(caseId: string, allowed: readonly string[], reason: string): void {
    this.blocked.set(caseId, { allowed: new Set(allowed), reason });
  }

  /** A row-level unproved status, for example a probe that timed out. */
  override(
    caseId: string,
    ruleId: string,
    status: "not_run" | "timed_out",
    reason: string,
  ): void {
    this.overrides.set(`${caseId}\u0000${ruleId}`, { status, reason });
  }

  wholeCase(
    caseId: string,
    status: "not_run" | "timed_out",
    reason: string,
  ): void {
    this.caseReasons.set(caseId, { status, reason });
  }

  private row(caseId: string, ruleId: string): ReportRow {
    const code = ruleSpec(ruleId)?.findingCode ?? ruleId;
    const entry = this.entries.get(`${caseId}\u0000${ruleId}`);
    const whole = this.caseReasons.get(caseId);
    const none: ReportRow["findings"] = [];
    const base = { ruleId, caseId, findings: none };
    if (entry !== undefined && entry.findings.length > 0)
      return {
        ...base,
        status: "failed",
        findings: entry.findings.map((finding) => ({
          code,
          message: finding.message,
        })),
        evidence: [...entry.evidence],
        reason: null,
      };
    if (whole !== undefined)
      return {
        ...base,
        status: whole.status,
        evidence: [],
        reason: whole.reason,
      };
    const block = this.blocked.get(caseId);
    if (block !== undefined && !block.allowed.has(ruleId))
      return { ...base, status: "not_run", evidence: [], reason: block.reason };
    const override = this.overrides.get(`${caseId}\u0000${ruleId}`);
    if (override !== undefined)
      return {
        ...base,
        status: override.status,
        evidence: [],
        reason: override.reason,
      };
    if (
      entry?.exercised === true &&
      entry.reason === null &&
      entry.evidence.size > 0
    )
      return {
        ...base,
        status: "passed",
        evidence: [...entry.evidence],
        reason: null,
      };
    return {
      ...base,
      status: "not_run",
      evidence: [],
      reason:
        entry?.reason ?? "No observation in this case exercised this rule.",
    };
  }

  rows(cases: readonly ListedCase[]): ReportRow[] {
    return cases.flatMap((item) =>
      item.rules.map((ruleId) => this.row(item.caseId, ruleId)),
    );
  }
}
