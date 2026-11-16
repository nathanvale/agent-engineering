// SUPPORTING TESTS (T6 Phase 2a). Component evidence written by the checker
// implementer. These are not bound cases and prove no V row; the independent
// binder's admissions and the Phase 2b harness own that proof. Envelopes here
// are minimal test-owned literals, never stand-ins for bound specimens.

import { describe, expect, test } from "bun:test";
import checkerOracle from "../../checker-expectations.json";
import retained from "../../retained-2.json";
import boundBudgets from "../bindings/BUDGETS.json";
import { BUDGETS } from "../../../../src/domains/contract3-check/budgets.ts";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { judgeObservations } from "../../../../src/domains/contract3-check/judge.ts";
import { PatternMatcher } from "../../../../src/domains/contract3-check/pattern.ts";
import { keptCheckerRoute } from "../../../../src/domains/contract3-check/kept-checker.ts";
import {
  createMinorTable,
  PRODUCTION_MINORS,
} from "../../../../src/domains/contract3-check/minors.ts";
import { judgementOutcome } from "../../../../src/domains/contract3-check/outcome.ts";
import {
  EXPECTATION_RULES,
  ruleSpec,
} from "../../../../src/domains/contract3-check/rules.ts";
import type {
  AdmittedCase,
  Json,
  Observation,
} from "../../../../src/domains/contract3-check/types.ts";
import { classifyVersion } from "../../../../src/domains/contract3-check/version.ts";

describe("catalogue and kept route agree with frozen oracles", () => {
  test("every frozen rule resolves to its frozen finding code and proof layer", () => {
    expect(checkerOracle.rules).toHaveLength(93);
    for (const rule of checkerOracle.rules)
      expect([
        rule.id,
        ruleSpec(rule.id)?.findingCode,
        ruleSpec(rule.id)?.proofLayer,
      ]).toEqual([rule.id, rule.findingCode, rule.proofLayer]);
    expect(ruleSpec("not-a-frozen-rule")).toBeUndefined();
  });

  test("every expectation rule is a frozen catalogue rule (F-3)", () => {
    const frozen = new Set(checkerOracle.rules.map((rule) => rule.id));
    expect(EXPECTATION_RULES.size).toBeGreaterThan(0);
    for (const id of EXPECTATION_RULES)
      expect([id, frozen.has(id)]).toEqual([id, true]);
  });

  test("the kept 2.0 checker route names retained-2.json's wrapper, commit and runtime", () => {
    const route = keptCheckerRoute();
    const runtime =
      retained.wrapperRoute.argv[1]?.replace("${plugin_root}/", "") ?? "";
    for (const part of [
      retained.wrapperRoute.source.repository,
      retained.wrapperRoute.source.path,
      retained.wrapperRoute.source.commit,
      runtime,
    ])
      expect(route).toContain(part);
    expect(runtime).toBe("runtime/cli-design-check.js");
  });
});

describe("restated tables equal their independent owners", () => {
  test("BUDGETS equals bindings/BUDGETS.json in key set and every number (S3, SF-2)", () => {
    expect(boundBudgets.budgetsVersion).toBe(1);
    expect(Object.keys(BUDGETS).sort()).toEqual(
      Object.keys(boundBudgets.values).sort(),
    );
    expect(Object.keys(boundBudgets.values)).toHaveLength(13);
    const restated: Record<string, number> = { ...BUDGETS };
    for (const [name, value] of Object.entries(boundBudgets.values))
      expect([name, restated[name]]).toEqual([name, value]);
  });

  test("the rule catalogue holds exactly the 93 frozen ids, no more and no fewer (N-4)", async () => {
    const source = await readFile(
      join(import.meta.dir, "../../../../src/domains/contract3-check/rules.ts"),
      "utf8",
    );
    const declared = [
      ...source.matchAll(/\[\s*"([a-z0-9-]+)",\s*"([A-Z0-9_]+)",/g),
    ].map((match) => match[1]);
    const frozen = checkerOracle.rules.map((rule) => rule.id);
    expect(declared).toHaveLength(93);
    expect([...declared].sort()).toEqual([...frozen].sort());
  });
});

describe("version classification follows the frozen format cases", () => {
  const cases = new Map(
    checkerOracle.formatCases.map((item) => [item.id, item]),
  );
  const fixtureMinor = createMinorTable([{ keys: {}, members: {} }]);

  test("malformed values classify malformed, including a missing value", () => {
    const values = cases.get("malformed")?.values ?? [];
    expect(values).toHaveLength(8);
    for (const value of values)
      expect(classifyVersion(value as Json, PRODUCTION_MINORS).kind).toBe(
        "malformed",
      );
    expect(classifyVersion(undefined, PRODUCTION_MINORS).kind).toBe(
      "malformed",
    );
  });

  test("other majors classify other-major", () => {
    const values = cases.get("other-major")?.values ?? [];
    expect(values).toEqual(["2.0.0", "1.0.0", "4.1.2"]);
    for (const value of values)
      expect(classifyVersion(value, PRODUCTION_MINORS).kind).toBe(
        "other-major",
      );
  });

  test("a 3.1 reader refuses 3.2.0 and accepts 3.0.0 and 3.1.0", () => {
    expect(classifyVersion("3.2.0", fixtureMinor).kind).toBe("newer-minor");
    expect(classifyVersion("3.0.0", fixtureMinor).kind).toBe("accepted");
    expect(classifyVersion("3.1.0", fixtureMinor).kind).toBe("accepted");
    expect(classifyVersion("3.1.0", PRODUCTION_MINORS).kind).toBe(
      "newer-minor",
    );
  });
});

function validEnvelope(): Record<string, Json> {
  return {
    contractVersion: "3.0.0",
    message: "Status read.",
    availablePaths: [],
    result: {
      runId: "run-1",
      commandIdentity: "t.status",
      outcome: "success",
      effectClass: "inspect",
      transactionState: "unchanged",
      causeCode: "SUCCESS_UNCHANGED",
      failureClass: null,
      exitCode: 0,
      data: null,
      retryable: false,
      repairAction: null,
      effects: {
        completed: [],
        remaining: [],
        uncertain: [],
        inventoryComplete: true,
      },
      next: { kind: "done" },
    },
  };
}

const RULE_SET = [
  "strict-keys",
  "presence",
  "result-correlation",
  "exit-envelope",
  "machine-stderr",
];

function caseOf(caseId: string): AdmittedCase {
  return {
    caseId,
    rules: RULE_SET,
    role: "command",
    mode: "machine",
    target: {
      kind: "run",
      program: "bun-runtime",
      args: [],
      cwd: "/",
      env: {},
      argvOffset: 0,
    },
    normalize: [],
  };
}

function observed(caseId: string, envelope: Json, exit = 0): Observation {
  return {
    caseId,
    source: "run",
    started: true,
    stdout: {
      bytes: new TextEncoder().encode(`${JSON.stringify(envelope)}\n`),
      overBudget: false,
    },
    stderr: { bytes: new Uint8Array(), overBudget: false },
    exit: { code: exit },
    timedOut: false,
  };
}

async function judgeOne(envelope: Json, exit = 0) {
  return judgeObservations(
    { cli: "t", cases: [caseOf("one")] },
    new Map([["one", observed("one", envelope, exit)]]),
    PRODUCTION_MINORS,
    new PatternMatcher(),
  );
}

function statuses(rows: { ruleId: string; status: string }[]) {
  return Object.fromEntries(rows.map((row) => [row.ruleId, row.status]));
}

describe("in-process judgement (component layer only)", () => {
  test("a valid envelope passes every admitted row and succeeds", async () => {
    const judgement = await judgeOne(validEnvelope());
    expect(judgement.refusal).toBeNull();
    expect(judgement.rows.map((row) => [row.ruleId, row.status])).toEqual(
      RULE_SET.map((ruleId) => [ruleId, "passed"]),
    );
    expect(judgementOutcome(judgement).station).toBe("success");
  });

  test("one legacy key fails strict-keys alone and refuses as invalid input", async () => {
    const envelope = { ...validEnvelope(), envelopeVersion: 2 };
    const judgement = await judgeOne(envelope);
    expect(judgement.refusal?.kind).toBe("broken");
    expect(
      judgement.rows
        .filter((row) => row.status === "failed")
        .map((row) => [row.ruleId, row.findings[0]?.code]),
    ).toEqual([["strict-keys", "UNLISTED_KEY"]]);
    const outcome = judgementOutcome(judgement);
    expect(outcome.station).toBe("invalid-input");
    expect(outcome.data).toBeNull();
    expect(outcome.message).toContain("3.0.0");
    expect(outcome.message).toContain("envelopeVersion");
  });

  test("a real exit that differs from the envelope fails exit-envelope", async () => {
    const judgement = await judgeOne(validEnvelope(), 1);
    expect(
      judgement.rows
        .filter((row) => row.status === "failed")
        .map((row) => row.ruleId),
    ).toEqual(["exit-envelope"]);
  });

  test("2.0.0 output with 3.0-invalid keys is refused as another major naming the kept checker", async () => {
    const envelope = {
      ...validEnvelope(),
      contractVersion: "2.0.0",
      envelopeVersion: 2,
    };
    const outcome = judgementOutcome(await judgeOne(envelope));
    expect(outcome.station).toBe("unsupported-contract");
    expect(outcome.data).toBeNull();
    expect(outcome.message).toContain('"2.0.0"');
    expect(outcome.message).toContain(retained.wrapperRoute.source.path);
    expect(outcome.message).toContain(retained.wrapperRoute.source.commit);
  });

  test("3.0.1 is refused as malformed and names contractVersion", async () => {
    const envelope = { ...validEnvelope(), contractVersion: "3.0.1" };
    const outcome = judgementOutcome(await judgeOne(envelope));
    expect(outcome.station).toBe("invalid-input");
    expect(outcome.message).toContain("contractVersion");
    expect(outcome.message).toContain('"3.0.1"');
  });

  test("G2.1: a framing failure leaves only machine-stderr evaluable", async () => {
    const judgement = await judgeObservations(
      { cli: "t", cases: [caseOf("one")] },
      new Map([
        [
          "one",
          {
            ...observed("one", validEnvelope()),
            stdout: { bytes: new TextEncoder().encode("{"), overBudget: false },
          },
        ],
      ]),
      PRODUCTION_MINORS,
      new PatternMatcher(),
    );
    expect(statuses(judgement.rows)).toEqual({
      "strict-keys": "not_run",
      presence: "not_run",
      "result-correlation": "not_run",
      "exit-envelope": "not_run",
      "machine-stderr": "passed",
    });
    expect(judgement.refusal?.kind).toBe("broken");
  });

  test("G2.2: a version refusal leaves only framing, version and stderr rules evaluable", async () => {
    const judgement = await judgeObservations(
      {
        cli: "t",
        cases: [
          {
            ...caseOf("one"),
            rules: [
              "json-framing",
              "version-malformed",
              "version-major",
              "strict-keys",
              "machine-stderr",
            ],
          },
        ],
      },
      new Map([
        [
          "one",
          observed("one", { ...validEnvelope(), contractVersion: "3.0.1" }),
        ],
      ]),
      PRODUCTION_MINORS,
      new PatternMatcher(),
    );
    expect(statuses(judgement.rows)).toEqual({
      "json-framing": "passed",
      "version-malformed": "failed",
      "version-major": "passed",
      "strict-keys": "not_run",
      "machine-stderr": "passed",
    });
  });

  test("a case left unobserved after a refusal reports not_run", async () => {
    const judgement = await judgeObservations(
      { cli: "t", cases: [caseOf("one"), caseOf("two")] },
      new Map([
        [
          "one",
          observed("one", { ...validEnvelope(), contractVersion: "2.0.0" }),
        ],
      ]),
      PRODUCTION_MINORS,
      new PatternMatcher(),
    );
    expect(
      judgement.rows
        .filter((row) => row.caseId === "two")
        .every((row) => row.status === "not_run"),
    ).toBe(true);
    expect(judgement.refusal?.kind).toBe("other-major");
  });
});
