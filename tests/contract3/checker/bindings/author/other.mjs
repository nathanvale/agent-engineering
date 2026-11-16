// fallow-ignore-file unused-file -- binder authoring source; run by hand to regenerate bindings, never imported by product or test code
// fallow-ignore-file boundary-violation -- binder authoring source outside every boundary zone by design
//
// D3 reader cases, harness-judged group H, static group T, budgets and the
// stopped cases. Written by the independent binder.
import { STOPPED, bind, ctxCd, ctxDiscovery, finding } from "./framework.mjs";
import { BASE, COMMON, V, bytesOf, ident } from "./model.mjs";
import {
  HOSTILE,
  HOSTILE_SUBJECT,
  RETAINED_COMMIT,
  WIDE_CODE,
  RETAINED_WRAPPER,
  expectOf,
  patternCases,
  resp,
  runCase,
  v2Envelope,
  versionCase,
} from "./process.mjs";

const ref = (rule, part) => `rules/${rule}/${part}`;
const D3 = "test-minor-3.1.0";

export const BUDGETS = {
  ADMISSION_MAX_BYTES: 1048576,
  ADMISSION_MAX_CASES: 256,
  TARGET_STDOUT_MAX_BYTES: 1048576,
  TARGET_STDERR_MAX_BYTES: 65536,
  TARGET_JSON_MAX_DEPTH: 64,
  TARGET_RUN_MAX_MS: 5000,
  TARGET_KILL_GRACE_MS: 500,
  PATTERN_MAX_SOURCE_BYTES: 4096,
  PATTERN_MAX_SUBJECT_BYTES: 4096,
  PATTERN_MAX_MS: 250,
  MESSAGE_MAX_BYTES: 2048,
  FINDING_MESSAGE_MAX_BYTES: 512,
  OBSERVED_VALUE_ECHO_MAX_CHARS: 64,
};

// Binder proposal for the test-only minor (D3 condition 4). Needs T1's
// agreement before any case marked fixture-minor-table is used as proof.
export const FIXTURE_TABLE = () => ({
  tableVersion: 1,
  status: "binder proposal; provisional until T1 agrees",
  minors: {
    "3.0.0": {
      result: {
        runId: "required",
        commandIdentity: "required",
        outcome: "required",
        effectClass: "required",
        transactionState: "required",
        causeCode: "required",
        failureClass: "nullable",
        exitCode: "required",
        data: "nullable",
        retryable: "required",
        retryDelayMilliseconds: "conditional",
        repairAction: "nullable",
        effects: "required",
        next: "conditional",
        handoff: "conditional",
        bindings: "conditional",
        idempotencyKey: "optional",
        attemptedEffect: "optional",
      },
      commonCauses: Object.keys(COMMON).slice(0, 20),
    },
    "3.1.0": {
      result: {
        runId: "required",
        commandIdentity: "required",
        outcome: "required",
        effectClass: "required",
        transactionState: "required",
        causeCode: "required",
        failureClass: "nullable",
        exitCode: "required",
        data: "nullable",
        retryable: "required",
        retryDelayMilliseconds: "conditional",
        repairAction: "nullable",
        effects: "required",
        next: "conditional",
        handoff: "conditional",
        bindings: "conditional",
        idempotencyKey: "optional",
        attemptedEffect: "optional",
        fixtureNote: "optional",
      },
      commonCauses: Object.keys(COMMON).slice(0, 20),
      meanings: {
        fixtureNote:
          "Optional nonempty string for a reader's test only. Absent means exactly what 3.0.0 meant; it grants nothing.",
      },
    },
  },
});

function d3Cases() {
  const withVersion = (version, mutate) => {
    const env = BASE.listOk();
    env.contractVersion = version;
    if (mutate !== undefined) mutate(env);
    return bytesOf(env);
  };
  bind({
    id: "format.valid-supported.3.0.0",
    rule: "version-newer",
    kind: "format-case",
    oracle: ["formatCases/valid-supported/values/0"],
    verification: ["V-16"],
    reader: D3,
    provisional: ["d3-reader"],
    cases: [versionCase("subject", withVersion("3.0.0"), null)],
    message: ["3.0.0"],
    notes: "A 3.1 reader accepts an older minor without adaptation.",
  });
  bind({
    id: "version-newer.valid",
    rule: "version-newer",
    kind: "valid-twin",
    oracle: [
      ref("version-newer", "validTwin"),
      "formatCases/valid-supported/values/1",
    ],
    verification: ["V-16"],
    reader: D3,
    provisional: ["d3-reader"],
    cases: [versionCase("subject", withVersion("3.1.0"), null)],
    message: ["3.1.0"],
  });
  bind({
    id: "version-newer.negative",
    rule: "version-newer",
    kind: "negative",
    oracle: [
      ref("version-newer", "negative"),
      "formatCases/newer-minor/values/0",
    ],
    verification: ["V-16"],
    reader: D3,
    provisional: ["d3-reader"],
    cases: [versionCase("subject", withVersion("3.2.0"), "version-newer")],
    message: ["3.2.0", "3.1.0"],
  });
  bind({
    id: "format.valid-supported.3.1.0-key",
    rule: "version-newer",
    kind: "format-case",
    oracle: [
      "formatCases/valid-supported/values/1",
      "additionalControls/version-compatibility",
    ],
    verification: ["V-16"],
    reader: D3,
    provisional: ["d3-reader", "fixture-minor-table"],
    cases: [
      versionCase(
        "subject",
        withVersion("3.1.0", (env) => {
          env.result.fixtureNote = "read by the 3.1 reader";
        }),
        null,
      ),
    ],
    message: ["3.1.0"],
  });

  // declared-minor-shape, captured under the D3 reader.
  const minorCase = (stdout, negative) => ({
    name: "subject",
    role: "command",
    target: { captured: { stdout } },
    rules: [
      "declared-minor-shape",
      "json-framing",
      "version-malformed",
      "version-major",
      "version-newer",
      "result-correlation",
      "guidance-arm",
      "available-order",
    ],
    status: negative
      ? { "declared-minor-shape": { failed: finding("declared-minor-shape") } }
      : {},
  });
  bind({
    id: "declared-minor-shape.valid",
    rule: "declared-minor-shape",
    kind: "valid-twin",
    oracle: [ref("declared-minor-shape", "validTwin")],
    reader: D3,
    provisional: ["d3-reader", "fixture-minor-table"],
    cases: [minorCase(bytesOf(BASE.listOk()), false)],
    notes:
      "The 3.0.0 envelope omits fixtureNote and is read with its 3.0 meaning (V-16).",
  });
  bind({
    id: "declared-minor-shape.negative",
    rule: "declared-minor-shape",
    kind: "negative",
    oracle: [ref("declared-minor-shape", "negative")],
    reader: D3,
    provisional: ["d3-reader", "fixture-minor-table"],
    cases: [
      minorCase(
        withVersion("3.0.0", (env) => {
          env.result.fixtureNote = "not at 3.0.0";
        }),
        true,
      ),
    ],
    excluded: {
      "strict-keys":
        "the same key is unlisted at the declared minor; strict-keys and declared-minor-shape would both read it",
      presence: "reads key presence, which the mutation changes",
    },
    message: [V, "fixtureNote"],
  });

  // fallback-version: valid twin only (G14).
  bind({
    id: "fallback-version.valid",
    rule: "fallback-version",
    kind: "valid-twin",
    oracle: [ref("fallback-version", "validTwin")],
    reader: D3,
    provisional: ["d3-reader"],
    cases: [
      {
        name: "subject",
        role: "command",
        target: { captured: { stdout: bytesOf(BASE.listPrep()) } },
        rules: [
          "fallback-version",
          "json-framing",
          "version-malformed",
          "strict-keys",
          "presence",
          "result-correlation",
          "guidance-arm",
        ],
        status: {},
      },
    ],
    notes:
      "An INTERNAL_PREPARATION fallback at 3.0.0 using only 3.0.0 keys and members, read by the 3.1 reader.",
  });
  STOPPED.push({
    id: "fallback-version.negative",
    rule: "fallback-version",
    oracle: [ref("fallback-version", "negative")],
    reason:
      "Contract and oracle disagree (G14). VER-8 stamps the CLI minor on every envelope except the fallback; an INTERNAL_PREPARATION or INTERNAL_RESULT_* result produced outside the fallback is legal at 3.1.0 (DISC-11b, LIFE-9, LIFE-10, VER-9). The wire does not mark a fallback, so a 3.1.0 internal result cannot be judged a fallback violation without choosing product behaviour.",
    clauses: ["VER-8", "VER-9", "LIFE-9", "LIFE-10", "DISC-11b"],
  });

  bind({
    id: "minor-meaning.valid",
    rule: "minor-meaning",
    kind: "valid-twin",
    oracle: [ref("minor-meaning", "validTwin")],
    reader: D3,
    provisional: ["d3-reader", "fixture-minor-table"],
    cases: [
      {
        name: "subject",
        role: "command",
        target: { captured: { stdout: bytesOf(BASE.listOk()) } },
        rules: ["minor-meaning", "json-framing", "version-malformed"],
        status: {
          "minor-meaning": {
            not_run:
              "independent review required: meaning of an absent minor key is reviewed, never proved from shape",
          },
        },
      },
    ],
  });
  STOPPED.push({
    id: "minor-meaning.negative",
    rule: "minor-meaning",
    oracle: [ref("minor-meaning", "negative")],
    reason:
      "Review only. Treating an absent key as new authority is a reader's meaning, which no output byte shows; the checker reports not_run and an independent reviewer owns the finding.",
    clauses: ["VER-6", "VER-15"],
  });
}

function stopped() {
  STOPPED.push({
    id: "diagnostics-absent.valid",
    rule: "diagnostics-absent",
    oracle: [ref("diagnostics-absent", "validTwin")],
    reason:
      "Interface gap G13: nothing in the wire, discovery or admission tells the checker the target lacks the diagnostics add-on, so neither twin nor negative can be judged. Needs an admitted independent fact such as expect.diagnostics.",
    clauses: ["DIAG-1", "DIAG-17"],
  });
  STOPPED.push({
    id: "diagnostics-absent.negative",
    rule: "diagnostics-absent",
    oracle: [ref("diagnostics-absent", "negative")],
    reason: "As diagnostics-absent.valid (G13).",
    clauses: ["DIAG-1", "DIAG-17"],
  });
}

// ----- group H: harness-judged ---------------------------------------------
function harness() {
  const counter = "no-replay.counter";
  const INPUT_COUNTER = "no-replay.input.counter";
  const noReplay = (id, caseId, stdout, failing, given, extra = {}) => {
    const oracle = [
      ...given,
      ref("no-replay", "requiredVariations/0"),
      "noReplayProtocol/sensitivityControl",
    ];
    const c = versionCase("subject", stdout, failing, {
      counter,
      plain: failing === null,
    });
    bind({
      id,
      rule: "no-replay",
      kind: extra.kind ?? "harness",
      oracle,
      verification: ["V-48"],
      cases: [c],
      excluded: extra.excluded,
      message: extra.message ?? [],
      harness: {
        rule: "no-replay",
        counter: { file: counter, before: "absent", after: "1\n" },
        readerStderr: "",
        sensitivityControl:
          "Perturb the checker to run this target a second time after its output; the counter becomes 2\\n and the harness must fail.",
      },
      notes: extra.notes,
    });
    return caseId;
  };
  const listBytes = bytesOf(BASE.listOk());
  noReplay(
    "no-replay.executed-malformed-json",
    "malformed-json",
    listBytes.slice(0, 40),
    "json-framing",
    ["noReplayCases/executed-malformed-json", ref("no-replay", "negative")],
    {
      message: [],
    },
  );
  // json-framing failure needs its own row layout.
  const last = (id) => {
    const spec = BINDING_INDEX(id);
    const subject = spec.cases.at(-1);
    subject.rules = [
      "json-framing",
      "version-malformed",
      "strict-keys",
      "machine-stderr",
    ];
    subject.status = {
      "json-framing": { failed: finding("json-framing") },
      "version-malformed": {
        not_run: "blocked: json-framing failed on this case",
      },
      "strict-keys": { not_run: "blocked: json-framing failed on this case" },
    };
    spec.excluded = {
      "*": "blocked by framing; only the rows above are admitted",
    };
  };
  last("no-replay.executed-malformed-json");
  const withVersion = (value) => {
    const env = BASE.listOk();
    env.contractVersion = value;
    return bytesOf(env);
  };
  noReplay(
    "no-replay.executed-malformed-version",
    "malformed-version",
    withVersion("3.0.1"),
    "version-malformed",
    ["noReplayCases/executed-malformed-version"],
    {
      message: ["contractVersion", '"3.0.1"'],
      excluded: {
        "version-major": "classification stops at the first refused class",
        "version-newer": "classification stops at the first refused class",
      },
    },
  );
  noReplay(
    "no-replay.executed-unsupported-major",
    "unsupported-major",
    bytesOf(v2Envelope()),
    "version-major",
    ["noReplayCases/executed-unsupported-major"],
    {
      message: ["2.0.0", RETAINED_WRAPPER],
      excluded: {
        "version-newer": "classification stops at the first refused class",
      },
    },
  );
  {
    const broken = BASE.listOk();
    delete broken.result;
    noReplay(
      "no-replay.executed-broken-supported",
      "broken-supported",
      bytesOf(broken),
      null,
      ["noReplayCases/executed-broken-supported"],
      {
        message: [V, "result"],
      },
    );
    const spec = BINDING_INDEX("no-replay.executed-broken-supported");
    const subject = spec.cases.at(-1);
    subject.rules.push("presence");
    subject.status.presence = { failed: finding("presence") };
  }
  {
    const hostile = patternCases(HOSTILE, HOSTILE_SUBJECT, {
      counter,
      cdMaxLength: WIDE_CODE,
    });
    const input = runCase(
      "subject",
      "command",
      hostile.argv,
      [resp(BASE.findUsage())],
      {
        rule: "pattern-budget",
        expect: expectOf(BASE.findUsage(), true),
        station: false,
        counter: INPUT_COUNTER,
      },
    );
    input.case.status["pattern-budget"] = { failed: finding("pattern-budget") };
    bind({
      id: "no-replay.executed-pattern-budget",
      rule: "no-replay",
      kind: "harness",
      oracle: [
        "noReplayCases/executed-pattern-budget",
        ref("no-replay", "requiredVariations/0"),
        "noReplayProtocol/sensitivityControl",
      ],
      verification: ["V-44", "V-48"],
      cases: [ctxDiscovery(), hostile.cd, input.case],
      message: [V],
      harness: {
        rule: "no-replay",
        counter: { file: counter, before: "absent", after: "1\n" },
        counterOwner: `no-replay.executed-pattern-budget/cd-find`,
        additionalCounters: [
          {
            file: INPUT_COUNTER,
            before: "absent",
            after: "1\n",
            owner: "no-replay.executed-pattern-budget/subject",
          },
        ],
        readerStderr: "",
        sensitivityControl:
          "Perturb the checker to run either target again after the budget refusal; that target's counter becomes 2\\n and the harness must fail. Both counters are compared.",
      },
      notes:
        "The command-discovery run increments its counter and emits the hostile pattern; the later input run carries the subject value and increments its own counter (B4).",
    });
  }
  // Valid twins: same single increment, accepted output.
  for (const name of [
    "malformed-json",
    "malformed-version",
    "unsupported-major",
    "broken-supported",
  ]) {
    noReplay(
      `no-replay.valid.${name}`,
      name,
      listBytes,
      null,
      [
        "noReplayProtocol/validTwin",
        ref("no-replay", "validTwin"),
        `noReplayCases/executed-${name}`,
      ],
      {
        kind: "harness-valid",
        message: [V],
      },
    );
  }
  {
    const benign = patternCases("[a-z]+", "abc", {
      counter,
      cdMaxLength: WIDE_CODE,
    });
    const input = runCase(
      "subject",
      "command",
      benign.argv,
      [resp(BASE.findOk())],
      {
        rule: "pattern-budget",
        expect: expectOf(BASE.findOk(), true),
        station: false,
        counter: INPUT_COUNTER,
      },
    );
    bind({
      id: "no-replay.valid.pattern-budget",
      rule: "no-replay",
      kind: "harness-valid",
      oracle: [
        "noReplayProtocol/validTwin",
        "noReplayCases/executed-pattern-budget",
        ref("no-replay", "requiredVariations/0"),
      ],
      verification: ["V-44", "V-48"],
      cases: [ctxDiscovery(), benign.cd, input.case],
      harness: {
        rule: "no-replay",
        counter: { file: counter, before: "absent", after: "1\n" },
        counterOwner: "no-replay.valid.pattern-budget/cd-find",
        additionalCounters: [
          {
            file: INPUT_COUNTER,
            before: "absent",
            after: "1\n",
            owner: "no-replay.valid.pattern-budget/subject",
          },
        ],
        readerStderr: "",
      },
    });
  }

  // pattern-isolation: budgets and lifecycle with a terminable boundary.
  const isolation = (
    id,
    pattern,
    subject,
    oracle,
    harnessSpec,
    cdMaxLength,
  ) => {
    const cases = patternCases(pattern, subject, { cdMaxLength });
    const input = runCase(
      "subject",
      "command",
      cases.argv,
      [resp(BASE.findUsage())],
      {
        rule: "pattern-budget",
        expect: expectOf(BASE.findUsage(), true),
        station: false,
      },
    );
    input.case.status["pattern-budget"] = { failed: finding("pattern-budget") };
    bind({
      id,
      rule: "pattern-isolation",
      kind: "harness",
      oracle,
      verification: ["V-44"],
      cases: [ctxDiscovery(), cases.cd, input.case],
      message: [V],
      harness: { rule: "pattern-isolation", ...harnessSpec },
    });
  };
  isolation(
    "pattern-isolation.input-size",
    "[a-z]+",
    "a".repeat(BUDGETS.PATTERN_MAX_SUBJECT_BYTES + 1),
    [ref("pattern-isolation", "requiredVariations/0")],
    {
      assertion:
        "Refused for subject size before any match; checker exits within 5,000 ms.",
    },
    10000,
  );
  isolation(
    "pattern-isolation.pattern-size",
    "a".repeat(BUDGETS.PATTERN_MAX_SOURCE_BYTES + 1),
    "abc",
    [ref("pattern-isolation", "requiredVariations/1")],
    {
      assertion:
        "Refused for pattern size before any match; checker exits within 5,000 ms.",
    },
  );
  isolation(
    "pattern-isolation.elapsed",
    HOSTILE,
    HOSTILE_SUBJECT,
    [
      ref("pattern-isolation", "requiredVariations/2"),
      ref("pattern-isolation", "validTwin"),
    ],
    {
      sensitivityControl:
        "Run the pattern synchronously on the checker's own thread with no budget; the harness must fail, either on the 5,000 ms bound or because the engine's false non-match gives a wrong exit or cause (exit 0 instead of the bound exit-4 refusal).",
      assertion:
        "The checker's own budget ends the hostile match at PATTERN_MAX_MS (250 ms) and refuses; the checker exits 4 within 5,000 ms of start. On Bun 1.4.4 JavaScriptCore stops this match by itself after about 0.4 to 0.6 s and reports a false non-match, so a run that ends without the budget refusal is a wrong answer, not a pass (INPUT-2, V-44).",
    },
    WIDE_CODE,
  );
  // B8: the second target run announces itself, then blocks, so the signal
  // lands during that run by construction. Unsignalled, it times out.
  {
    const cases = patternCases(HOSTILE, HOSTILE_SUBJECT, {
      cdMaxLength: WIDE_CODE,
    });
    const input = runCase(
      "subject",
      "command",
      cases.argv,
      [
        {
          stdout: null,
          stderr: null,
          exit: 0,
          state: "input-run-started\n",
          hang: true,
        },
      ],
      {
        rule: "pattern-budget",
        expect: expectOf(BASE.findUsage(), true),
        station: false,
        state: "lifecycle.state",
      },
    );
    const reason = {
      timed_out:
        "target exceeded TARGET_RUN_MAX_MS and was terminated; its effects are unknown",
    };
    input.case.status = Object.fromEntries(
      input.case.rules.map((rule) => [rule, reason]),
    );
    bind({
      id: "pattern-isolation.lifecycle",
      rule: "pattern-isolation",
      kind: "harness",
      oracle: [
        ref("pattern-isolation", "requiredVariations/3"),
        ref("pattern-isolation", "negative"),
      ],
      verification: ["V-44"],
      cases: [ctxDiscovery(), cases.cd, input.case],
      harness: {
        rule: "pattern-isolation",
        announce: { file: "lifecycle.state", line: "input-run-started" },
        assertion:
          "Poll the case's lifecycle.state until it holds input-run-started: the second target run writes it before it blocks, so the run is in flight. Then send SIGTERM to the checker. It exits 143 with empty stdout within 500 ms of the signal, and no target process survives. If the announcement is never seen, the property is UNPROVED and this binding is not counted as passed. The process block below is the unsignalled run of the main loop: the blocked target times out at TARGET_RUN_MAX_MS, its rows are timed_out, and the checker exits 0 (timed_out is not a refusal).",
        sensitivityControl:
          "Make the checker ignore SIGTERM while a target runs, or stop forwarding it to the target: the harness must fail on the 500 ms bound or on a surviving target process.",
      },
      notes:
        "B8 (repair round 2). The hostile pattern stays declared, so the admission is still a hostile one while the signal lands; the elapsed budget itself is proved by pattern-isolation.elapsed.",
    });
  }

  // observer-exclusions: a timed-out case stays visible with a reason.
  {
    const hang = runCase(
      "hang",
      "command",
      ["list", "--json"],
      [{ stdout: null, stderr: null, exit: 0, hang: true }],
      {
        plain: true,
        extraRules: ["json-framing", "version-malformed", "machine-stderr"],
      },
    );
    const reason = {
      timed_out:
        "target exceeded TARGET_RUN_MAX_MS and was terminated; its effects are unknown",
    };
    hang.case.status = {
      "json-framing": reason,
      "version-malformed": reason,
      "machine-stderr": reason,
    };
    const ok = runCase(
      "subject",
      "command",
      ["list", "--json"],
      [resp(BASE.listOk())],
      {
        expect: expectOf(BASE.listOk(), true),
        station: false,
      },
    );
    bind({
      id: "observer-exclusions.valid",
      rule: "observer-exclusions",
      kind: "harness-valid",
      oracle: [
        ref("observer-exclusions", "validTwin"),
        ref("observer-exclusions", "negative"),
      ],
      verification: ["V-34"],
      cases: [hang.case, ok.case],
      harness: {
        rule: "observer-exclusions",
        assertion:
          "Every admitted pair is present; the hang case's rows are timed_out with nonempty reasons and are never passed or absent. The checker exits 0 within TARGET_RUN_MAX_MS + TARGET_KILL_GRACE_MS + 5,000 ms.",
        sensitivityControl:
          "Perturb the checker to drop timed_out rows from data.rows; the identity-set assertion must fail.",
      },
    });
  }

  // raw-retention: nothing is written beside the admission.
  {
    const ok = runCase(
      "subject",
      "command",
      ["list", "--json"],
      [resp(BASE.listOk())],
      {
        expect: expectOf(BASE.listOk(), true),
        station: false,
      },
    );
    bind({
      id: "raw-retention.valid",
      rule: "raw-retention",
      kind: "harness-valid",
      oracle: [
        ref("raw-retention", "validTwin"),
        ref("raw-retention", "negative"),
      ],
      verification: ["V-34"],
      cases: [ok.case],
      harness: {
        rule: "raw-retention",
        assertion:
          "List every file in the temporary copy and in the checker's working directory before and after the run. The sets are equal; no file contains the target's stdout bytes.",
        sensitivityControl:
          "Perturb the checker to write the target's stdout beside the admission; the file-set assertion must fail.",
      },
    });
  }
}

// ----- group T: static repository tests ------------------------------------
function statics() {
  const table = FIXTURE_TABLE();
  const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
  bind({
    id: "minor.valid",
    rule: "minor-remove",
    kind: "static-valid",
    oracle: [
      "minor-remove",
      "minor-rename",
      "minor-required",
      "minor-cause",
    ].map((r) => ref(r, "validTwin")),
    verification: ["V-16"],
    provisional: ["fixture-minor-table"],
    cases: [],
    extraFiles: { "table.json": json(table) },
    static: { input: "table.json", expected: "compatible", findings: [] },
  });
  const negatives = [
    [
      "minor-remove",
      (t) => {
        delete t.minors["3.1.0"].result.idempotencyKey;
      },
      "idempotencyKey",
    ],
    [
      "minor-rename",
      (t) => {
        const r = t.minors["3.1.0"].result;
        delete r.attemptedEffect;
        r.attemptEffect = "optional";
      },
      "attemptedEffect",
    ],
    [
      "minor-required",
      (t) => {
        t.minors["3.1.0"].result.fixtureNote = "required";
      },
      "fixtureNote",
    ],
    [
      "minor-cause",
      (t) => {
        t.minors["3.1.0"].commonCauses.push("FIXTURE_COMMON");
      },
      "FIXTURE_COMMON",
    ],
  ];
  for (const [rule, mutate, key] of negatives) {
    const t = FIXTURE_TABLE();
    mutate(t);
    bind({
      id: `${rule}.negative`,
      rule,
      kind: "static-negative",
      oracle: [
        ref(rule, "negative"),
        "additionalControls/version-compatibility",
      ],
      verification: ["V-16"],
      provisional: ["fixture-minor-table"],
      cases: [],
      extraFiles: { "table.json": json(t) },
      static: {
        input: "table.json",
        expected: "incompatible",
        findings: [{ code: finding(rule), mentions: key }],
      },
      notes:
        "minor-remove and minor-rename are judged as distinct findings: a rename is detected when one 3.0.0 key disappears and one new key appears in the same object.",
    });
  }
  bind({
    id: "retained-tooling.valid",
    rule: "retained-tooling",
    kind: "static-valid",
    oracle: [
      ref("retained-tooling", "validTwin"),
      ref("retained-tooling", "negative"),
      "additionalControls/kept-tool-route",
    ],
    verification: ["V-17", "V-34"],
    cases: [],
    static: {
      expected: {
        repository: "dotfiles",
        commit: RETAINED_COMMIT,
        path: RETAINED_WRAPPER,
        blob: "7bdc6dd22b4097076801188979e5a686fc124e48",
        runtime: "runtime/cli-design-check.js",
      },
      source: "retained-2.json#/wrapperRoute/source and #/scripts",
      assertion:
        "The checker's kept-route constant equals these values byte for byte.",
      negativeControl:
        "Change the constant's path to select the new checker; the static test must fail with RETAINED_2_ROUTE_CHANGED.",
    },
  });
  bind({
    id: "source-agreement.valid",
    rule: "source-agreement",
    kind: "static-valid",
    oracle: [
      ref("source-agreement", "validTwin"),
      ref("source-agreement", "negative"),
    ],
    verification: ["V-35"],
    cases: [],
    static: {
      expected: {
        exitOwner: {
          success: 0,
          internal: 1,
          usage: 2,
          domain: 3,
          schema: 4,
          transient: 75,
        },
        commonCauses: "expectations.json#/common_causes/rows (20 rows)",
        resultTruthTable:
          "expectations.json#/result_truth_table/rows (20 rows)",
        effectStateTable: "expectations.json#/effect_state_table/rows (5 rows)",
        signalExits: { 130: "SIGINT", 143: "SIGTERM" },
      },
      assertion: "The checker's typed tables equal these independent values.",
      negativeControl:
        "Change one exit (for example transient to 3) in the checker's typed owner only; the static test must fail with CONTRACT_TABLE_DRIFT. The mutation site is the implementer's file.",
    },
  });
  bind({
    id: "snippet-status.valid",
    rule: "snippet-status",
    kind: "static-valid",
    oracle: [
      ref("snippet-status", "validTwin"),
      ref("snippet-status", "negative"),
    ],
    verification: ["V-35"],
    cases: [],
    static: {
      expected:
        "Every code snippet in the checker's help and documentation is labelled illustrative or has an exact typecheck proof.",
      negativeControl:
        "Remove the illustrative label from one uncompiled snippet; the static test must fail with SNIPPET_PROOF_MISSING.",
    },
  });
}

// ----- budgets -------------------------------------------------------------
function budgets() {
  const over = (id, stream, size, note) => {
    const response = { stdout: bytesOf(BASE.listOk()), stderr: "", exit: 0 };
    response[stream] = { repeat: size, byte: "x" };
    const c = runCase("subject", "command", ["list", "--json"], [response], {
      plain: true,
      extraRules: ["json-framing"],
    });
    bind({
      id,
      rule: "json-framing",
      kind: "budget",
      oracle: ["futureBindings/3"],
      verification: ["V-34"],
      cases: [c.case],
      cause: "SCHEMA_INVALID_INPUT",
      rowsUnbound:
        "Interface gap G22: no rule owns a stream-budget refusal, so its component row is not bound.",
      notes: note,
    });
  };
  over(
    "budget.stdout-over",
    "stdout",
    BUDGETS.TARGET_STDOUT_MAX_BYTES + 1,
    "TARGET_STDOUT_MAX_BYTES + 1 bytes on stdout.",
  );
  over(
    "budget.stderr-over",
    "stderr",
    BUDGETS.TARGET_STDERR_MAX_BYTES + 1,
    "TARGET_STDERR_MAX_BYTES + 1 bytes on stderr.",
  );
  {
    const value = `3${".0".repeat(100)}`;
    const env = BASE.listOk();
    env.contractVersion = value;
    bind({
      id: "budget.observed-version-echo",
      rule: "version-malformed",
      kind: "budget",
      oracle: ["formatCases/malformed/messageRequires"],
      verification: ["V-16"],
      cases: [versionCase("subject", bytesOf(env), "version-malformed")],
      excluded: {
        "version-major": "classification stops at the first refused class",
        "version-newer": "classification stops at the first refused class",
      },
      message: ["contractVersion"],
      messageExcludes: [value],
      notes:
        "A 201-character malformed version: the echo is bounded by OBSERVED_VALUE_ECHO_MAX_CHARS (64), so the full value never appears.",
    });
  }
  {
    const cases = Array.from(
      { length: BUDGETS.ADMISSION_MAX_CASES + 1 },
      (_, index) => ({
        name: `c${String(index).padStart(3, "0")}`,
        role: "command-discovery",
        target: { shared: "cd-list" },
        rules: ["json-framing"],
      }),
    );
    bind({
      id: "budget.admission-cases",
      rule: "json-framing",
      kind: "budget",
      oracle: ["futureBindings/3"],
      verification: ["V-34"],
      cases,
      admissionRefusal: [],
      notes:
        "ADMISSION_MAX_CASES + 1 captured cases: refused before any read or run.",
    });
  }
}

let INDEX = null;
const BINDING_INDEX = (id) => INDEX(id);

export function otherBindings(lookup) {
  INDEX = lookup;
  d3Cases();
  stopped();
  harness();
  statics();
  budgets();
}

export { ctxCd, ident };
