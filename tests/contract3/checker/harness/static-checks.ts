// Group T static checks (INTERFACE.md section 9: repository static tests).
// Each returns findings with the rule's frozen finding code; an empty list
// is compatible or agreeing. Expected values come from the bindings and the
// frozen T0 oracle, never from the checker's own tables.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type * as CollectorModule from "../../../../src/domains/contract3-check/collector.ts";
import type * as EnvelopeModule from "../../../../src/domains/contract3-check/envelope-rules.ts";
import type * as MinorsModule from "../../../../src/domains/contract3-check/minors.ts";
import type * as NavigationModule from "../../../../src/domains/contract3-check/navigation-data.ts";
import type * as ResultTableModule from "../../../../src/domains/contract3-check/result-table.ts";
import type { JsonObject } from "../../../../src/domains/contract3-check/types.ts";
import { REPO_ROOT } from "./suite.ts";

export interface StaticFinding {
  code: string;
  message: string;
}

type FieldTable = Record<string, string>;
interface MinorEntry {
  result: FieldTable;
  commonCauses: string[];
  /** A documented new key is an addition (VER-5); an undocumented one replacing an old key is a rename. */
  meanings?: Record<string, string>;
}

/** VER-5, VER-6, VER-6a over a fixture minor table (minor-remove, -rename, -required, -cause). */
export function minorCompatibility(table: {
  minors: Record<string, MinorEntry>;
}): StaticFinding[] {
  const findings: StaticFinding[] = [];
  const versions = Object.keys(table.minors).sort(
    (a, b) => Number(a.split(".")[1]) - Number(b.split(".")[1]),
  );
  for (let index = 1; index < versions.length; index += 1) {
    const before = table.minors[versions[index - 1] ?? ""];
    const after = table.minors[versions[index] ?? ""];
    if (before === undefined || after === undefined) continue;
    const removed = Object.keys(before.result).filter(
      (key) => !(key in after.result),
    );
    const added = Object.keys(after.result).filter(
      (key) => !(key in before.result),
    );
    const undocumented = added.filter(
      (key) => after.meanings?.[key] === undefined,
    );
    const renamed =
      removed.length === 1 && undocumented.length === 1 ? removed : [];
    for (const key of renamed)
      findings.push({
        code: "MINOR_RENAMES_KEY",
        message: `${versions[index]} renames result key ${key}.`,
      });
    for (const key of removed.filter((key) => !renamed.includes(key)))
      findings.push({
        code: "MINOR_REMOVES_KEY",
        message: `${versions[index]} removes result key ${key}.`,
      });
    for (const [key, presence] of Object.entries(after.result)) {
      const earlier = before.result[key];
      if (
        presence === "required" &&
        earlier !== "required" &&
        !(renamed.length > 0 && undocumented.includes(key))
      )
        findings.push({
          code: "MINOR_REQUIRES_KEY",
          message: `${versions[index]} makes result key ${key} required.`,
        });
    }
    for (const cause of after.commonCauses.filter(
      (cause) => !before.commonCauses.includes(cause),
    ))
      findings.push({
        code: "MINOR_ADDS_COMMON_CAUSE",
        message: `${versions[index]} adds common cause ${cause}.`,
      });
  }
  return findings;
}

/** retained-tooling: the kept-route constant holds the expected values byte for byte. */
export async function retainedTooling(
  expected: Record<string, string>,
  source?: string,
): Promise<StaticFinding[]> {
  const text =
    source ??
    (await readFile(
      join(REPO_ROOT, "src/domains/contract3-check/kept-checker.ts"),
      "utf8",
    ));
  return Object.entries(expected)
    .filter(([, value]) => !text.includes(JSON.stringify(value)))
    .map(([key, value]) => ({
      code: "RETAINED_2_ROUTE_CHANGED",
      message: `kept-route ${key} ${value} is missing.`,
    }));
}

interface TruthRow {
  outcome: string;
  transactionState: string;
  failureClass: string | null;
  exitCode: number;
  retryable: boolean;
  guidance: string;
}
interface CauseRow extends TruthRow {
  causeCode: string;
}
interface EffectRow {
  transactionState: string;
  inventoryComplete: boolean;
  completed: string;
  remaining: string;
  uncertain: string;
}

/** Test-owned oracle restated from WIRE-14; the one copy in the test harness. */
export const EXIT_OWNER: Readonly<Record<string, number>> = {
  success: 0,
  internal: 1,
  usage: 2,
  domain: 3,
  schema: 4,
  transient: 75,
};

function list(shape: string, name: string): string[] {
  return shape === "empty" ? [] : [name];
}

function effectEnvelope(row: EffectRow): JsonObject {
  const changed = row.transactionState !== "unchanged";
  return {
    contractVersion: "3.0.0",
    message: "Static effect-state probe.",
    availablePaths: [],
    result: {
      runId: "static",
      commandIdentity: "static.change",
      outcome: changed ? "failed" : "refused",
      effectClass: "repository-local",
      transactionState: row.transactionState,
      causeCode: "STATIC_PROBE",
      failureClass: "domain",
      exitCode: 3,
      data: null,
      retryable: false,
      repairAction: "Inspect.",
      effects: {
        completed: list(row.completed, "a"),
        remaining: list(row.remaining, "b"),
        uncertain: list(row.uncertain, "c"),
        inventoryComplete: row.inventoryComplete,
      },
      ...(changed
        ? {
            handoff: {
              owner: "operator",
              reason: "Inspect.",
              inspect: [{ kind: "instruction", text: "Inspect." }],
            },
          }
        : { next: { kind: "instruction", text: "Inspect." } }),
    },
  };
}

const REPOSITORY_DOMAIN = join(REPO_ROOT, "src/domains/contract3-check");

/** source-agreement: the checker's typed tables (in domainDir) agree with the frozen T0 tables. */
export async function sourceAgreement(
  expected: {
    exitOwner: Record<string, number>;
    signalExits: Record<string, string>;
  },
  domainDir = REPOSITORY_DOMAIN,
): Promise<StaticFinding[]> {
  const { Collector } = (await import(
    join(domainDir, "collector.ts")
  )) as typeof CollectorModule;
  const { validateEnvelope } = (await import(
    join(domainDir, "envelope-rules.ts")
  )) as typeof EnvelopeModule;
  const { PRODUCTION_MINORS } = (await import(
    join(domainDir, "minors.ts")
  )) as typeof MinorsModule;
  const { validateDiscoveryData } = (await import(
    join(domainDir, "navigation-data.ts")
  )) as typeof NavigationModule;
  const { COMMON_CAUSES, rowProblems } = (await import(
    join(domainDir, "result-table.ts")
  )) as typeof ResultTableModule;
  const oracle = JSON.parse(
    await readFile(
      join(REPO_ROOT, "tests/contract3/expectations.json"),
      "utf8",
    ),
  ) as {
    common_causes: { rows: CauseRow[] };
    result_truth_table: { rows: TruthRow[] };
    effect_state_table: { rows: EffectRow[] };
  };
  const findings: StaticFinding[] = [];
  const drift = (message: string) =>
    findings.push({ code: "CONTRACT_TABLE_DRIFT", message });
  if (JSON.stringify(expected.exitOwner) !== JSON.stringify(EXIT_OWNER))
    drift("binding exit owner differs from the T0 exit owner");
  const causes = oracle.common_causes.rows;
  if (causes.length !== 20 || Object.keys(COMMON_CAUSES).length !== 20)
    drift("common cause count is not 20");
  for (const row of causes) {
    const typed = COMMON_CAUSES[row.causeCode];
    if (
      typed === undefined ||
      typed.failureClass !== row.failureClass ||
      typed.outcome !== row.outcome ||
      typed.transactionState !== row.transactionState ||
      (typed.arm === "next" ? "N" : "H") !== row.guidance.split(":")[0]
    )
      drift(`common cause ${row.causeCode} differs`);
    if (
      rowProblems(
        { ...row, arm: row.guidance === "H" ? "handoff" : "next" },
        row.causeCode,
      ).length > 0
    )
      drift(`common cause ${row.causeCode} row is rejected`);
  }
  const truth = oracle.result_truth_table.rows;
  if (truth.length !== 20) drift("truth table row count is not 20");
  for (const row of truth) {
    if (
      row.failureClass !== null &&
      EXIT_OWNER[row.failureClass] !== row.exitCode
    )
      drift(`truth row exit ${row.exitCode} differs from the exit owner`);
    for (const arm of row.guidance
      .split("|")
      .map((value) => (value === "H" ? "handoff" : "next")))
      if (rowProblems({ ...row, arm }, "STATIC_HOST_CAUSE").length > 0)
        drift(
          `truth row ${row.outcome}/${row.transactionState}/${String(row.failureClass)} with ${arm} is rejected`,
        );
    if (
      rowProblems(
        {
          ...row,
          exitCode: row.exitCode === 0 ? 1 : 0,
          arm: row.guidance === "H" ? "handoff" : "next",
        },
        "STATIC_HOST_CAUSE",
      ).length === 0
    )
      drift(
        `truth row ${row.outcome}/${String(row.failureClass)} accepts a wrong exit`,
      );
  }
  const effects = oracle.effect_state_table.rows;
  if (effects.length !== 5) drift("effect-state row count is not 5");
  for (const row of effects) {
    const c = new Collector();
    validateEnvelope(
      { c, minors: PRODUCTION_MINORS, declaredMinor: 0 },
      effectEnvelope(row),
    );
    if (c.findings.some((finding) => finding.ruleId === "effects-state"))
      drift(
        `effect-state row ${row.transactionState}/${String(row.inventoryComplete)} is rejected`,
      );
  }
  for (const signals of [
    expected.signalExits,
    { ...expected.signalExits, "143": "SIGKILL" },
  ]) {
    const c = new Collector();
    validateDiscoveryData(
      { c, minors: PRODUCTION_MINORS, declaredMinor: 0 },
      {
        contractVersion: "3.0.0",
        commands: [],
        exitMeanings: Object.fromEntries(
          Object.entries(EXIT_OWNER).map(([meaning, exit]) => [
            String(exit),
            meaning,
          ]),
        ),
        signalExits: signals,
        effectExclusions: [],
      },
      "3.0.0",
    );
    const rejected = c.findings.some(
      (finding) => finding.ruleId === "discovery-metadata",
    );
    if (rejected === (signals === expected.signalExits))
      drift("signal exits disagree with the binding");
  }
  return findings;
}

const FENCE = /^```(\S*)\s*$/gm;

/** snippet-status: every TypeScript snippet in checker docs is illustrative or proved; every fence names its language. */
export function snippetStatus(documents: Record<string, string>): {
  findings: StaticFinding[];
  snippets: number;
  typescript: number;
} {
  const findings: StaticFinding[] = [];
  let snippets = 0;
  let typescript = 0;
  for (const [name, text] of Object.entries(documents)) {
    let open = true;
    for (const match of text.matchAll(FENCE)) {
      open = !open;
      if (open) continue;
      snippets += 1;
      const language = match[1] ?? "";
      if (language === "")
        findings.push({
          code: "SNIPPET_PROOF_MISSING",
          message: `${name}: a code fence names no language.`,
        });
      if (["ts", "typescript", "js", "javascript"].includes(language)) {
        typescript += 1;
        const before = text.slice(
          Math.max(0, (match.index ?? 0) - 200),
          match.index ?? 0,
        );
        if (!/illustrative/i.test(before))
          findings.push({
            code: "SNIPPET_PROOF_MISSING",
            message: `${name}: a ${language} snippet is neither labelled illustrative nor proved.`,
          });
      }
    }
  }
  return { findings, snippets, typescript };
}
