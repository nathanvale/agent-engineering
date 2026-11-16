// fallow-ignore-file unused-file -- binder authoring source; run by hand to regenerate bindings, never imported by product or test code
// fallow-ignore-file boundary-violation -- binder authoring source outside every boundary zone by design
//
// Shape bindings (interface groups E, D and X) on captured bytes. Each
// valid twin is a hand-composed specimen envelope; each negative changes one
// thing and names the rule it serves.
import {
  KEY_OF,
  admit,
  bind,
  candidates,
  ctxCd,
  ctxDiscovery,
  finding,
} from "./framework.mjs";
import { BASE, CMD, V, bytesOf, clone, ident } from "./model.mjs";

const ref = (rule, part) => `rules/${rule}/${part}`;
const variation = (rule, index) => `rules/${rule}/requiredVariations/${index}`;

const at = (obj, path) => path.reduce((o, k) => o[k], obj);

const CD_TAGS = [
  "stations",
  "input",
  "ifNoResult",
  "templates",
  "stationRetry",
  "pattern",
];
const DISC_TAGS = ["discoveryCommands", "discoveryMeta", "versionCopy"];

function contextFor(role, env, extraCtx) {
  if (role === "command") {
    const key = KEY_OF[env.result.commandIdentity];
    const ctx = [ctxDiscovery(), ctxCd(key)];
    for (const extra of extraCtx) {
      if (extra !== key) ctx.push(ctxCd(extra));
    }
    return ctx;
  }
  if (role === "command-discovery") return [ctxDiscovery()];
  return [];
}

// One captured subject, last in the admission, with its context first.
export function shape({
  id,
  rule,
  kind,
  oracle,
  base,
  mutate,
  raw,
  touched = [],
  key,
  role = "command",
  extraCtx = [],
  notes,
  provisional,
  reader,
  verification,
  ctx,
  drop = {},
}) {
  const env = base();
  const pool = candidates(role, env, { cross: role === "command" });
  const negative = kind !== "valid-twin" && kind !== "variation-valid";
  const admitted = admit(rule, pool, negative ? touched : []);
  const rules = admitted.rules.filter((r) => drop[r] === undefined);
  const excluded = { ...admitted.excluded, ...drop };
  const mutated = clone(env);
  if (mutate !== undefined) mutate(mutated);
  let stdout = bytesOf(mutated);
  if (raw !== undefined) stdout = raw(stdout);
  const status = negative ? { [rule]: { failed: finding(rule) } } : {};
  const needsTargetCd = rules.includes("step-arguments");
  const stepTarget = needsTargetCd ? KEY_OF[env.result.next?.command] : null;
  const extras = [...extraCtx];
  if (stepTarget !== null && stepTarget !== undefined) extras.push(stepTarget);
  const context = ctx ?? contextFor(role, env, extras);
  bind({
    id,
    rule,
    kind,
    oracle,
    reader,
    provisional,
    verification,
    notes,
    excluded,
    message: negative ? [V, ...(key === undefined ? [] : [key])] : [],
    cases: [
      ...context,
      {
        name: "subject",
        role,
        target: { captured: { stdout } },
        rules,
        status,
      },
    ],
  });
}

const twin = (rule, base, extra = {}) =>
  shape({
    id: `${rule}.valid`,
    rule,
    kind: "valid-twin",
    oracle: [ref(rule, "validTwin")],
    base,
    ...extra,
  });

const neg = (rule, label, extra) =>
  shape({
    id: `${rule}.negative${label === "" ? "" : `.${label}`}`,
    rule,
    kind: label === "" ? "negative" : "variation-negative",
    ...extra,
  });

// Frequently used bases.
const applyUnknown = () =>
  BASE.applyState(
    "INTERNAL_RESULT_UNKNOWN",
    "unknown",
    "The write to a note could not be confirmed.",
  );
const applyDeadlineUnknown = () =>
  BASE.applyState(
    "DOMAIN_DEADLINE_UNKNOWN",
    "unknown",
    "The deadline passed with an unconfirmed write.",
  );
const DIAG_AVAILABLE = () => ({
  status: "available",
  file: null,
  sinkFailure: null,
  droppedRecords: 0,
  unflushedRecords: 0,
  truncatedRecords: 0,
  countsComplete: true,
  closed: true,
});
const DIAG_UNAVAILABLE = () => ({
  status: "unavailable",
  reason: "status-invalid",
  trusted: {},
});
const withDiagnostics = (diagnostics) => () => {
  const env = BASE.listOk();
  env.diagnostics = diagnostics;
  return env;
};
const stationIndex = (key, cause) =>
  BASE.cd(key).result.data.stations.findIndex((s) => s.causeCode === cause);

// ----- json-framing --------------------------------------------------------
function framing() {
  const rule = "json-framing";
  twin(rule, BASE.listOk);
  const blocked = { not_run: "blocked: json-framing failed on this case" };
  const variants = [
    ["", (b) => b + b, ref(rule, "negative"), [variation(rule, 1)]],
    [
      "truncated",
      (b) => b.slice(0, Math.floor(b.length / 2)),
      variation(rule, 0),
    ],
    ["trailing-text", (b) => `${b}Listed 2 notes.\n`, variation(rule, 2)],
    ["missing-newline", (b) => b.slice(0, -1), variation(rule, 3)],
    ["non-object-root", (b) => `[${b.slice(0, -1)}]\n`, variation(rule, 4)],
  ];
  for (const [label, raw, oracle, more = []] of variants) {
    const stdout = raw(bytesOf(BASE.listOk()));
    bind({
      id: `${rule}.negative${label === "" ? "" : `.${label}`}`,
      rule,
      kind: label === "" ? "negative" : "variation-negative",
      oracle: [oracle, ...more],
      message: [],
      excluded: {
        "*": "every other envelope rule needs one parsed object; only the rows below are admitted, as not_run",
      },
      cases: [
        {
          name: "subject",
          role: "command",
          target: { captured: { stdout } },
          rules: [rule, "version-malformed", "strict-keys", "presence"],
          status: {
            [rule]: { failed: finding(rule) },
            "version-malformed": blocked,
            "strict-keys": blocked,
            presence: blocked,
          },
        },
      ],
    });
  }
}

// ----- strict-keys ---------------------------------------------------------
function strictKeys() {
  const rule = "strict-keys";
  twin(rule, BASE.listOk);
  const cdAll = ["keyset", ...CD_TAGS];
  const discAll = ["keyset", ...DISC_TAGS];
  const locations = [
    ["envelope", BASE.listOk, [], ["keyset"]],
    ["result", BASE.listOk, ["result"], ["keyset"]],
    ["effects", BASE.listOk, ["result", "effects"], ["keyset", "effects"]],
    ["next-done", BASE.listOk, ["result", "next"], ["keyset", "next"]],
    ["next-command", BASE.showMissing, ["result", "next"], ["keyset", "next"]],
    ["next-retry", BASE.applyTransient, ["result", "next"], ["keyset", "next"]],
    [
      "next-instruction",
      BASE.findUsage,
      ["result", "next"],
      ["keyset", "next"],
    ],
    ["handoff", applyUnknown, ["result", "handoff"], ["keyset", "handoff"]],
    [
      "inspect-command",
      applyUnknown,
      ["result", "handoff", "inspect", 0],
      ["keyset", "handoff"],
    ],
    [
      "inspect-instruction",
      BASE.showInternal,
      ["result", "handoff", "inspect", 0],
      ["keyset", "handoff"],
    ],
    [
      "handoff-resource",
      applyDeadlineUnknown,
      ["result", "handoff", "resource"],
      ["keyset", "handoff"],
    ],
    [
      "diagnostics-available",
      withDiagnostics(DIAG_AVAILABLE()),
      ["diagnostics"],
      ["keyset", "diagnostics"],
    ],
    [
      "diagnostics-unavailable",
      withDiagnostics(DIAG_UNAVAILABLE()),
      ["diagnostics"],
      ["keyset", "diagnostics"],
    ],
    [
      "diagnostics-trusted",
      withDiagnostics(DIAG_UNAVAILABLE()),
      ["diagnostics", "trusted"],
      ["keyset", "diagnostics"],
    ],
    [
      "discovery-data",
      BASE.discovery,
      ["result", "data"],
      discAll,
      "discovery",
    ],
    [
      "command-summary",
      BASE.discovery,
      ["result", "data", "commands", 0],
      discAll,
      "discovery",
    ],
    [
      "exit-meanings",
      BASE.discovery,
      ["result", "data", "exitMeanings"],
      ["keyset", "discoveryMeta"],
      "discovery",
    ],
    [
      "signal-exits",
      BASE.discovery,
      ["result", "data", "signalExits"],
      ["keyset", "discoveryMeta"],
      "discovery",
    ],
    ["help-data", BASE.help, ["result", "data"], ["keyset"], "help"],
    [
      "help-command-summary",
      BASE.help,
      ["result", "data", "commands", 0],
      ["keyset"],
      "help",
    ],
    [
      "help-option-summary",
      BASE.help,
      ["result", "data", "options", 0],
      ["keyset"],
      "help",
    ],
  ];
  const cdApply = () => BASE.cd("apply");
  const cdFind = () => BASE.cd("find");
  const transient = stationIndex("apply", "TRANSIENT_NOT_STARTED");
  const unknown = stationIndex("apply", "INTERNAL_RESULT_UNKNOWN");
  const cdLocations = [
    ["command-discovery-data", cdApply, ["result", "data"]],
    ["public-station", cdApply, ["result", "data", "stations", 0]],
    [
      "retry-policy-none",
      cdApply,
      ["result", "data", "stations", 0, "retryDelayPolicy"],
    ],
    [
      "retry-policy-bounded",
      cdApply,
      ["result", "data", "stations", transient, "retryDelayPolicy"],
    ],
    [
      "station-guidance-next",
      cdApply,
      ["result", "data", "stations", 0, "guidance"],
    ],
    [
      "station-guidance-handoff",
      cdApply,
      ["result", "data", "stations", unknown, "guidance"],
    ],
    [
      "station-step",
      cdApply,
      ["result", "data", "stations", 0, "guidance", "next"],
    ],
    ["if-no-result", cdApply, ["result", "data", "ifNoResult"]],
    ["input-schema", cdFind, ["result", "data", "input"]],
    ["argument-schema", cdFind, ["result", "data", "input", "arguments", 0]],
    ["option-schema", cdFind, ["result", "data", "input", "options", 0]],
    [
      "value-string",
      cdFind,
      ["result", "data", "input", "arguments", 0, "value"],
    ],
    [
      "value-integer",
      cdFind,
      ["result", "data", "input", "options", 3, "value"],
    ],
    [
      "constraint-requires",
      cdFind,
      ["result", "data", "input", "constraints", 0],
    ],
    [
      "constraint-exclusive",
      cdFind,
      ["result", "data", "input", "constraints", 1],
    ],
  ];
  for (const [label, base, path] of cdLocations) {
    locations.push([label, base, path, cdAll, "command-discovery"]);
  }
  for (const [label, base, path, touched, role = "command"] of locations) {
    neg(rule, `unknown-key.${label}`, {
      oracle: [variation(rule, 0)],
      base,
      role,
      touched,
      key: "unlisted",
      mutate: (env) => {
        at(env, path).unlisted = true;
      },
    });
  }
  const legacy = [
    ["", "envelopeVersion", BASE.listOk, [], 2, ["keyset"], "command"],
    [
      "legacy.nextAction",
      "nextAction",
      BASE.listOk,
      ["result"],
      "No further action required.",
      ["keyset", "next"],
      "command",
    ],
    [
      "legacy.profile",
      "profile",
      BASE.discovery,
      ["result", "data"],
      "simple",
      discAll,
      "discovery",
    ],
    [
      "legacy.generationConventionVersion",
      "generationConventionVersion",
      BASE.discovery,
      ["result", "data"],
      1,
      discAll,
      "discovery",
    ],
  ];
  for (const [label, name, base, path, value, touched, role] of legacy) {
    neg(rule, label, {
      oracle:
        label === ""
          ? [ref(rule, "negative"), variation(rule, 1)]
          : [variation(rule, 1)],
      base,
      role,
      touched,
      key: name,
      mutate: (env) => {
        at(env, path)[name] = value;
      },
    });
  }
}

// ----- presence ------------------------------------------------------------
function presence() {
  const rule = "presence";
  twin(rule, BASE.listOk);
  const resultTags = {
    runId: ["strings"],
    commandIdentity: ["cause", "strings", "observedStation", "identity"],
    outcome: ["outcome"],
    effectClass: ["effectClass"],
    transactionState: ["state"],
    causeCode: ["cause"],
    failureClass: ["class"],
    exitCode: ["exit"],
    data: ["data"],
    retryable: ["retryable"],
    repairAction: ["repair"],
    effects: ["effects", "state"],
  };
  const omissions = [
    ["envelope.message", BASE.listOk, [], "message", ["strings"]],
    [
      "envelope.availablePaths",
      BASE.listOk,
      [],
      "availablePaths",
      ["available"],
    ],
    ["envelope.result", BASE.listOk, [], "result", ["*"]],
    ...Object.entries(resultTags).map(([name, tags]) => [
      `result.${name}`,
      BASE.listOk,
      ["result"],
      name,
      tags,
    ]),
    ...["completed", "remaining", "uncertain", "inventoryComplete"].map(
      (name) => [
        `effects.${name}`,
        BASE.listOk,
        ["result", "effects"],
        name,
        ["effects"],
      ],
    ),
    ...["owner", "reason", "inspect"].map((name) => [
      `handoff.${name}`,
      applyUnknown,
      ["result", "handoff"],
      name,
      ["handoff"],
    ]),
    ...["command", "args"].map((name) => [
      `next-command.${name}`,
      BASE.showMissing,
      ["result", "next"],
      name,
      ["next"],
    ]),
    [
      "next-instruction.text",
      BASE.findUsage,
      ["result", "next"],
      "text",
      ["next"],
    ],
    ...[
      "contractVersion",
      "commands",
      "exitMeanings",
      "signalExits",
      "effectExclusions",
    ].map((name) => [
      `discovery-data.${name}`,
      BASE.discovery,
      ["result", "data"],
      name,
      DISC_TAGS,
      "discovery",
    ]),
    ...["usage", "summary", "commands", "options"].map((name) => [
      `help-data.${name}`,
      BASE.help,
      ["result", "data"],
      name,
      [],
      "help",
    ]),
    ...["command", "semantics", "ifNoResult", "input", "stations"].map(
      (name) => [
        `command-discovery-data.${name}`,
        () => BASE.cd("apply"),
        ["result", "data"],
        name,
        CD_TAGS,
        "command-discovery",
      ],
    ),
    ...Object.keys(BASE.cd("apply").result.data.stations[0]).map((name) => [
      `public-station.${name}`,
      () => BASE.cd("apply"),
      ["result", "data", "stations", 0],
      name,
      CD_TAGS,
      "command-discovery",
    ]),
    ...Object.keys(BASE.cd("find").result.data.input).map((name) => [
      `input-schema.${name}`,
      () => BASE.cd("find"),
      ["result", "data", "input"],
      name,
      ["input", "pattern"],
      "command-discovery",
    ]),
  ];
  for (const [label, base, path, name, tags, role = "command"] of omissions) {
    const isMain = label === "result.failureClass";
    neg(rule, isMain ? "" : `omit.${label}`, {
      oracle: isMain
        ? [ref(rule, "negative"), variation(rule, 0)]
        : [variation(rule, 0)],
      base,
      role,
      touched: ["keyset", "null", ...tags],
      key: name,
      mutate: (env) => {
        delete at(env, path)[name];
      },
    });
  }
  const nulls = [
    ["idempotencyKey", BASE.listOk, ["result"], ["attempted"]],
    ["attemptedEffect", applyUnknown, ["result"], ["attempted"]],
    ["retryDelayMilliseconds", BASE.applyTransient, ["result"], ["delay"]],
    ["bindings", () => BASE.previewOk(), ["result"], ["bindings"]],
    ["diagnostics", BASE.listOk, [], ["diagnostics"]],
    ["resource", applyDeadlineUnknown, ["result", "handoff"], ["handoff"]],
  ];
  for (const [name, base, path, tags] of nulls) {
    neg(rule, `null.${name}`, {
      oracle: [variation(rule, 1)],
      base,
      touched: ["keyset", "null", ...tags],
      key: name,
      mutate: (env) => {
        at(env, path)[name] = null;
      },
    });
  }
  neg(rule, "conditional.retryDelay-present-when-not-retryable", {
    oracle: [variation(rule, 2)],
    base: BASE.listOk,
    touched: ["keyset", "delay"],
    key: "retryDelayMilliseconds",
    mutate: (env) => {
      env.result.retryDelayMilliseconds = 500;
    },
  });
  neg(rule, "conditional.retryDelay-absent-when-retryable", {
    oracle: [variation(rule, 2)],
    base: BASE.applyTransient,
    touched: ["keyset", "delay"],
    key: "retryDelayMilliseconds",
    mutate: (env) => {
      delete env.result.retryDelayMilliseconds;
    },
  });
  neg(rule, "conditional.bindings-present-without-template", {
    oracle: [variation(rule, 2)],
    base: BASE.listOk,
    touched: ["keyset", "bindings"],
    key: "bindings",
    mutate: (env) => {
      env.result.bindings = { noteId: "n-1" };
    },
  });
  neg(rule, "conditional.bindings-absent-with-template", {
    oracle: [variation(rule, 2)],
    base: () => BASE.previewOk(),
    touched: ["keyset", "bindings"],
    key: "bindings",
    mutate: (env) => {
      delete env.result.bindings;
    },
  });
}

// ----- result-correlation --------------------------------------------------
function resultCorrelation() {
  const rule = "result-correlation";
  const rows = [
    ["success-unchanged", BASE.listOk],
    ["success-completed", BASE.applyOk],
    ["refused-usage", BASE.findUsage],
    ["refused-schema", BASE.previewSchema],
    ["refused-domain", BASE.showMissing],
    ["refused-internal", BASE.listPrep],
    ["refused-transient", BASE.applyTransient],
    ["failed-unchanged-internal", BASE.listInternal],
    ["failed-unchanged-domain", BASE.applyDeadlineUnchanged],
    ["failed-unchanged-schema", BASE.applySchemaUnchanged],
    ["failed-unchanged-transient", BASE.applyTransientFailed],
    [
      "failed-completed-internal",
      () =>
        BASE.applyState(
          "INTERNAL_RESULT_COMPLETED",
          "completed",
          "Every write completed but the result could not be produced.",
        ),
    ],
    [
      "failed-completed-domain",
      () =>
        BASE.applyState(
          "DOMAIN_DEADLINE_COMPLETED",
          "completed",
          "The deadline passed after every write completed.",
        ),
    ],
    [
      "failed-completed-schema",
      () =>
        BASE.applyState(
          "SCHEMA_READBACK_COMPLETED",
          "completed",
          "Every write completed but the read-back failed.",
        ),
    ],
    [
      "failed-partial-internal",
      () =>
        BASE.applyState(
          "INTERNAL_RESULT_PARTIAL",
          "partially-completed",
          "Some writes completed before the result failed.",
        ),
    ],
    [
      "failed-partial-domain",
      () =>
        BASE.applyState(
          "DOMAIN_DEADLINE_PARTIAL",
          "partially-completed",
          "The deadline passed after some writes completed.",
        ),
    ],
    [
      "failed-partial-schema",
      () =>
        BASE.applyState(
          "SCHEMA_READBACK_PARTIAL",
          "partially-completed",
          "Some writes completed and the read-back failed.",
        ),
    ],
    ["failed-unknown-internal", applyUnknown],
    ["failed-unknown-domain", applyDeadlineUnknown],
    [
      "failed-unknown-schema",
      () =>
        BASE.applyState(
          "SCHEMA_READBACK_UNKNOWN",
          "unknown",
          "A write could not be confirmed.",
        ),
    ],
  ];
  rows.forEach(([label, base], index) => {
    shape({
      id: `${rule}.valid${index === 0 ? "" : `.${label}`}`,
      rule,
      kind: index === 0 ? "valid-twin" : "variation-valid",
      oracle:
        index === 0
          ? [ref(rule, "validTwin"), variation(rule, 0)]
          : [variation(rule, 0)],
      base,
      notes: `T0 result_truth_table row ${index + 1}: ${label}.`,
    });
  });
  neg(rule, "", {
    oracle: [ref(rule, "negative")],
    base: BASE.showMissing,
    touched: ["exit"],
    key: "exitCode",
    mutate: (env) => {
      env.result.exitCode = 4;
    },
  });
  neg(rule, "failed-usage", {
    oracle: [variation(rule, 1)],
    base: BASE.findUsage,
    touched: ["outcome"],
    key: "outcome",
    mutate: (env) => {
      env.result.outcome = "failed";
    },
  });
  const transientWith = (state) => (env) => {
    env.result.transactionState = state;
    env.result.effects =
      state === "completed"
        ? {
            completed: ["audit.write", "index.write", "note.write"],
            remaining: [],
            uncertain: [],
            inventoryComplete: true,
          }
        : state === "partially-completed"
          ? {
              completed: ["audit.write", "index.write"],
              remaining: ["note.write"],
              uncertain: [],
              inventoryComplete: true,
            }
          : {
              completed: ["audit.write"],
              remaining: [],
              uncertain: ["index.write", "note.write"],
              inventoryComplete: true,
            };
  };
  for (const state of ["completed", "partially-completed", "unknown"]) {
    neg(rule, `transient-${state}`, {
      oracle: [variation(rule, 1)],
      base: BASE.applyTransientFailed,
      touched: ["state", "effects", "attempted"],
      key: "transactionState",
      mutate: transientWith(state),
    });
  }
  neg(rule, "common-cause.transient-not-started-failed", {
    oracle: [variation(rule, 2)],
    base: BASE.applyTransient,
    touched: ["outcome", "cause"],
    key: "causeCode",
    mutate: (env) => {
      env.result.outcome = "failed";
    },
    notes:
      "failed/unchanged/transient/75 is a legal truth-table row; TRANSIENT_NOT_STARTED fixes outcome refused (T0 common_causes).",
  });
  neg(rule, "common-cause.success-unchanged-completed", {
    oracle: [variation(rule, 2)],
    base: BASE.applyNoop,
    touched: ["state", "effects", "cause"],
    key: "causeCode",
    mutate: (env) => {
      env.result.transactionState = "completed";
      env.result.effects = {
        completed: ["audit.write", "index.write", "note.write"],
        remaining: [],
        uncertain: [],
        inventoryComplete: true,
      };
    },
    notes:
      "success/completed is a legal row; SUCCESS_UNCHANGED fixes state unchanged (T0 common_causes).",
  });
  neg(rule, "common-cause.internal-preparation-failed", {
    oracle: [variation(rule, 2)],
    base: BASE.listPrep,
    touched: ["outcome", "cause"],
    key: "causeCode",
    mutate: (env) => {
      env.result.outcome = "failed";
    },
    notes:
      "failed/unchanged/internal/1 is a legal row; INTERNAL_PREPARATION fixes outcome refused (T0 common_causes).",
  });
}

// ----- single-negative envelope rules --------------------------------------
function envelopeRules() {
  let rule = "effect-inventory";
  twin(rule, BASE.listOk);
  neg(rule, "", {
    oracle: [ref(rule, "negative")],
    base: BASE.listOk,
    touched: ["effects"],
    key: "effects",
    mutate: (env) => {
      env.result.effects.completed = ["note.write"];
    },
  });

  rule = "guidance-arm";
  twin(rule, BASE.listOk);
  neg(rule, "", {
    oracle: [ref(rule, "negative"), variation(rule, 1)],
    base: BASE.listOk,
    touched: ["arm", "handoff", "next", "keyset"],
    key: "handoff",
    mutate: (env) => {
      env.result.handoff = {
        owner: "operator",
        reason: "The result could not be produced.",
        inspect: [
          {
            kind: "instruction",
            text: "Inspect the specimen runtime log for this run.",
          },
        ],
      };
    },
  });
  neg(rule, "neither", {
    oracle: [variation(rule, 0)],
    base: BASE.listOk,
    touched: ["arm", "keyset", "next"],
    key: "next",
    mutate: (env) => {
      delete env.result.next;
    },
  });
  neg(rule, "null-arm", {
    oracle: [variation(rule, 2)],
    base: BASE.listOk,
    touched: ["arm", "null", "handoff"],
    key: "handoff",
    mutate: (env) => {
      env.result.handoff = null;
    },
  });

  rule = "retry-kind";
  twin(rule, BASE.applyTransient);
  neg(rule, "", {
    oracle: [ref(rule, "negative")],
    base: BASE.applyTransient,
    touched: ["next"],
    key: "next",
    mutate: (env) => {
      env.result.next = {
        kind: "instruction",
        text: "Wait, then run the command again.",
      };
    },
  });

  rule = "done-outcome";
  twin(rule, BASE.listOk);
  neg(rule, "", {
    oracle: [ref(rule, "negative")],
    base: BASE.showMissing,
    touched: ["next"],
    key: "next",
    mutate: (env) => {
      env.result.next = { kind: "done" };
    },
  });

  rule = "metadata-values";
  twin(rule, BASE.listOk);
  neg(rule, "", {
    oracle: [ref(rule, "negative")],
    base: BASE.listOk,
    touched: ["strings", "cause", "observedStation", "identity"],
    key: "commandIdentity",
    mutate: (env) => {
      env.result.commandIdentity = "   ";
    },
  });

  rule = "json-values";
  twin(rule, BASE.listOk);
  const nest = (depth) => (depth === 0 ? 0 : [nest(depth - 1)]);
  shape({
    id: `${rule}.valid.depth-64`,
    rule,
    kind: "variation-valid",
    oracle: [ref(rule, "validTwin")],
    base: () => {
      const env = BASE.listOk();
      env.result.data = nest(62);
      return env;
    },
    notes:
      "B2: envelope is level 0 and every value counts. data is level 2; the innermost scalar is at level 64.",
  });
  neg(rule, "", {
    oracle: [ref(rule, "negative")],
    base: BASE.listOk,
    touched: ["values"],
    key: "data",
    mutate: (env) => {
      env.result.data = { notes: ["n-1", "n-2"], size: "__NONFINITE__" };
    },
    raw: (bytes) => bytes.replace('"__NONFINITE__"', "1e999"),
    notes:
      "1e999 is valid JSON grammar that decodes to a nonfinite number (WIRE-4).",
  });
  neg(rule, "depth-65", {
    oracle: [ref(rule, "negative")],
    base: () => {
      const env = BASE.listOk();
      env.result.data = nest(62);
      return env;
    },
    touched: ["depth", "values"],
    key: "data",
    mutate: (env) => {
      env.result.data = nest(63);
    },
    notes:
      "B2 and LIFE-7 step 2: a scalar at level 65 exceeds TARGET_JSON_MAX_DEPTH 64.",
  });

  rule = "effects-sets";
  twin(rule, BASE.applyUnknownIncomplete);
  const sets = [
    ["", ["audit.write", "index.write"], ["index.write"], ["note.write"]],
    [
      "overlap.completed-uncertain",
      ["audit.write"],
      ["index.write"],
      ["audit.write", "note.write"],
    ],
    [
      "overlap.remaining-uncertain",
      ["audit.write"],
      ["index.write"],
      ["index.write", "note.write"],
    ],
    [
      "duplicate.completed",
      ["audit.write", "audit.write"],
      ["index.write"],
      ["note.write"],
    ],
    [
      "duplicate.remaining",
      ["audit.write"],
      ["index.write", "index.write"],
      ["note.write"],
    ],
    [
      "duplicate.uncertain",
      ["audit.write"],
      ["index.write"],
      ["note.write", "note.write"],
    ],
    ["unsorted.completed", ["index.write", "audit.write"], [], ["note.write"]],
    ["unsorted.remaining", [], ["index.write", "audit.write"], ["note.write"]],
    ["unsorted.uncertain", [], ["audit.write"], ["note.write", "index.write"]],
  ];
  for (const [label, completed, remaining, uncertain] of sets) {
    neg(rule, label, {
      oracle:
        label === ""
          ? [ref(rule, "negative"), variation(rule, 1)]
          : [
              variation(
                rule,
                label.startsWith("overlap")
                  ? 1
                  : label.startsWith("duplicate")
                    ? 0
                    : 2,
              ),
            ],
      base: BASE.applyUnknownIncomplete,
      touched: ["effects", "attempted"],
      key: "effects",
      mutate: (env) => {
        env.result.effects.completed = completed;
        env.result.effects.remaining = remaining;
        env.result.effects.uncertain = uncertain;
      },
    });
  }

  rule = "effects-state";
  const stateTwins = [
    ["", BASE.applyTransient, "unchanged"],
    ["completed", BASE.applyOk, "completed"],
    [
      "partially-completed",
      () =>
        BASE.applyState(
          "INTERNAL_RESULT_PARTIAL",
          "partially-completed",
          "Some writes completed before the result failed.",
        ),
      "partially-completed",
    ],
    ["unknown-complete", applyUnknown, "unknown"],
    ["unknown-incomplete", BASE.applyUnknownIncomplete, "unknown"],
  ];
  for (const [label, base] of stateTwins) {
    shape({
      id: `${rule}.valid${label === "" ? "" : `.${label}`}`,
      rule,
      kind: label === "" ? "valid-twin" : "variation-valid",
      oracle:
        label === ""
          ? [ref(rule, "validTwin"), variation(rule, 0)]
          : [variation(rule, 0)],
      base,
    });
  }
  const stateNegs = [
    [
      "",
      applyUnknown,
      (e) => {
        e.result.effects.uncertain = [];
        e.result.effects.remaining = ["note.write"];
      },
      ref(rule, "negative"),
    ],
    [
      "unchanged-with-completed",
      BASE.applyTransient,
      (e) => {
        e.result.effects.completed = ["note.write"];
      },
      variation(rule, 0),
    ],
    [
      "completed-with-remaining",
      BASE.applyOk,
      (e) => {
        e.result.effects.completed = ["audit.write", "index.write"];
        e.result.effects.remaining = ["note.write"];
      },
      variation(rule, 0),
    ],
    [
      "partial-without-remaining",
      () =>
        BASE.applyState(
          "INTERNAL_RESULT_PARTIAL",
          "partially-completed",
          "Some writes completed before the result failed.",
        ),
      (e) => {
        e.result.effects.remaining = [];
        e.result.effects.completed = [
          "audit.write",
          "index.write",
          "note.write",
        ];
      },
      variation(rule, 0),
    ],
    [
      "incomplete-inventory-not-unknown",
      () =>
        BASE.applyState(
          "INTERNAL_RESULT_PARTIAL",
          "partially-completed",
          "Some writes completed before the result failed.",
        ),
      (e) => {
        e.result.effects.inventoryComplete = false;
      },
      variation(rule, 0),
    ],
    [
      "success-unchanged-with-remaining",
      BASE.applyNoop,
      (e) => {
        e.result.effects.remaining = ["note.write"];
      },
      variation(rule, 1),
    ],
  ];
  for (const [label, base, mutate, oracle] of stateNegs) {
    neg(rule, label, {
      oracle: [oracle],
      base,
      touched: ["effects", "attempted"],
      key: "effects",
      mutate,
      notes:
        label === ""
          ? "remaining is set so the lists stay legal; only the unknown-with-complete-inventory constraint is broken."
          : undefined,
    });
  }

  rule = "attempted-effect";
  twin(rule, applyUnknown);
  neg(rule, "", {
    oracle: [ref(rule, "negative")],
    base: applyUnknown,
    touched: ["attempted"],
    key: "attemptedEffect",
    mutate: (env) => {
      env.result.attemptedEffect = "queue.write";
    },
  });

  rule = "failure-data";
  twin(rule, BASE.showMissing);
  neg(rule, "", {
    oracle: [ref(rule, "negative")],
    base: BASE.showMissing,
    touched: ["data"],
    key: "data",
    mutate: (env) => {
      env.result.data = { reportVersion: 1, rows: [] };
    },
  });

  rule = "handoff-shape";
  twin(rule, applyUnknown);
  neg(rule, "", {
    oracle: [ref(rule, "negative")],
    base: applyUnknown,
    touched: ["handoff", "keyset"],
    key: "inspect",
    mutate: (env) => {
      env.result.handoff.inspect = [{ kind: "done" }];
    },
  });
  neg(rule, "empty-inspect", {
    oracle: [ref(rule, "validTwin")],
    base: applyUnknown,
    touched: ["handoff"],
    key: "inspect",
    mutate: (env) => {
      env.result.handoff.inspect = [];
    },
    notes:
      "WIRE-9: inspect is a nonempty array; the valid twin text requires nonempty inspections.",
  });

  rule = "closed-union";
  twin(rule, BASE.listOk);
  neg(rule, "", {
    oracle: [ref(rule, "negative")],
    base: BASE.listOk,
    touched: ["vocab", "next", "keyset"],
    key: "kind",
    mutate: (env) => {
      env.result.next = { kind: "wait" };
    },
  });

  rule = "available-order";
  twin(rule, BASE.listOk);
  neg(rule, "", {
    oracle: [ref(rule, "negative"), variation(rule, 0)],
    base: BASE.listOk,
    touched: ["available"],
    key: "availablePaths",
    mutate: (env) => {
      const paths = env.availablePaths;
      [paths[0], paths[1]] = [paths[1], paths[0]];
    },
  });
  neg(rule, "duplicate", {
    oracle: [variation(rule, 1)],
    base: BASE.listOk,
    touched: ["available"],
    key: "availablePaths",
    mutate: (env) => {
      env.availablePaths.splice(1, 0, env.availablePaths[0]);
    },
  });

  rule = "available-target";
  twin(rule, BASE.listOk);
  neg(rule, "", {
    oracle: [ref(rule, "negative")],
    base: BASE.listOk,
    touched: ["available"],
    key: "availablePaths",
    mutate: (env) => {
      env.availablePaths.push("specimen.zzz");
    },
  });
}

// ----- diagnostics ---------------------------------------------------------
function diagnostics() {
  let rule = "diagnostics-available";
  twin(rule, withDiagnostics(DIAG_AVAILABLE()));
  shape({
    id: `${rule}.valid.absolute-file`,
    rule,
    kind: "variation-valid",
    oracle: [variation(rule, 2)],
    base: withDiagnostics({
      ...DIAG_AVAILABLE(),
      file: "/state/specimen/diagnostics/run-0001.jsonl",
    }),
    notes:
      "Synthetic absolute path inside target bytes. Shape cannot prove private custody (DIAG-7, DIAG-8; supportBoundaries).",
  });
  const avail = [
    ["", "droppedRecords", -1, ref(rule, "negative"), [variation(rule, 1)]],
    ["sink-failure-enum", "sinkFailure", "disk", variation(rule, 0)],
    ["counts-complete-type", "countsComplete", "yes", variation(rule, 0)],
    ["closed-type", "closed", 1, variation(rule, 0)],
    ["unflushed-unsafe", "unflushedRecords", "__UNSAFE__", variation(rule, 1)],
    ["truncated-noninteger", "truncatedRecords", 1.5, variation(rule, 1)],
    ["file-relative", "file", "logs/run-0001.jsonl", variation(rule, 2)],
  ];
  for (const [label, field, value, oracle, more = []] of avail) {
    neg(rule, label, {
      oracle: [oracle, ...more],
      base: withDiagnostics(DIAG_AVAILABLE()),
      touched: ["diagnostics"],
      key: field,
      mutate: (env) => {
        env.diagnostics[field] = value;
      },
      raw: (bytes) => bytes.replace('"__UNSAFE__"', "9007199254740993"),
    });
  }
  neg(rule, "missing-closed", {
    oracle: [variation(rule, 0)],
    base: withDiagnostics(DIAG_AVAILABLE()),
    touched: ["diagnostics", "keyset"],
    key: "closed",
    mutate: (env) => {
      delete env.diagnostics.closed;
    },
  });

  rule = "diagnostics-unavailable";
  shape({
    id: `${rule}.valid`,
    rule,
    kind: "valid-twin",
    oracle: [ref(rule, "validTwin"), variation(rule, 0)],
    base: withDiagnostics(DIAG_UNAVAILABLE()),
    notes: "The empty trusted object is valid (DIAG-3).",
  });
  shape({
    id: `${rule}.valid.trusted-subset`,
    rule,
    kind: "variation-valid",
    oracle: [variation(rule, 1)],
    base: withDiagnostics({
      status: "unavailable",
      reason: "status-unavailable",
      trusted: {
        file: "/state/specimen/diagnostics/run-0001.jsonl",
        countsComplete: false,
      },
    }),
  });
  const unav = [
    [
      "",
      (d) => {
        d.reason = "setup";
      },
      "reason",
      ref(rule, "negative"),
      [variation(rule, 2)],
    ],
    [
      "reason-unknown",
      (d) => {
        d.reason = "status-unknown";
      },
      "reason",
      variation(rule, 2),
    ],
    [
      "trusted-counter-type",
      (d) => {
        d.trusted = { droppedRecords: "3" };
      },
      "droppedRecords",
      variation(rule, 2),
    ],
    [
      "trusted-closed-null",
      (d) => {
        d.trusted = { closed: null };
      },
      "closed",
      variation(rule, 1),
    ],
  ];
  for (const [label, change, field, oracle, more = []] of unav) {
    neg(rule, label, {
      oracle: [oracle, ...more],
      base: withDiagnostics(DIAG_UNAVAILABLE()),
      touched: ["diagnostics", "null"],
      key: field,
      mutate: (env) => change(env.diagnostics),
    });
  }
}

// ----- templates and bindings ----------------------------------------------
function templates() {
  const cdOf = (key) => () => BASE.cd(key);
  const stationAt = (env, cause) =>
    env.result.data.stations.find((s) => s.causeCode === cause);

  let rule = "template-token";
  shape({
    id: `${rule}.valid`,
    rule,
    kind: "valid-twin",
    oracle: [ref(rule, "validTwin")],
    base: cdOf("show"),
    role: "command-discovery",
    notes: "show's DOMAIN_NOTE_MISSING repairAction uses {runId}.",
  });
  shape({
    id: `${rule}.valid.effects-token`,
    rule,
    kind: "variation-valid",
    oracle: [ref(rule, "validTwin")],
    base: cdOf("apply"),
    role: "command-discovery",
    notes:
      "apply's DOMAIN_DEADLINE_UNKNOWN handoff reason uses {uncertainEffects}.",
  });
  neg(rule, "", {
    oracle: [ref(rule, "negative")],
    base: cdOf("show"),
    role: "command-discovery",
    touched: ["templates"],
    key: "{unknownToken}",
    mutate: (env) => {
      stationAt(env, "DOMAIN_NOTE_MISSING").repairAction =
        "Choose a note identity; {unknownToken} found none.";
    },
  });

  rule = "binding-placement";
  shape({
    id: `${rule}.valid`,
    rule,
    kind: "valid-twin",
    oracle: [ref(rule, "validTwin")],
    base: cdOf("preview"),
    role: "command-discovery",
  });
  const success = (env) => stationAt(env, "SUCCESS_COMPLETED");
  const placements = [
    [
      "",
      "preview",
      (e) => {
        stationAt(e, "SCHEMA_INVALID_INPUT").guidance.next.text =
          "Fix {binding.note}, then run the command again.";
      },
      ref(rule, "negative"),
      "instruction.text",
      [variation(rule, 1)],
    ],
    [
      "partial-args-element",
      "preview",
      (e) => {
        success(e).guidance.next.args = [
          "--preview",
          "{binding.previewId}",
          "--note={binding.note}",
        ];
      },
      variation(rule, 0),
      "args",
    ],
    [
      "repair-action",
      "preview",
      (e) => {
        stationAt(e, "SCHEMA_INVALID_INPUT").repairAction =
          "Correct {binding.note}.";
      },
      variation(rule, 1),
      "repairAction",
    ],
    [
      "handoff-reason",
      "apply",
      (e) => {
        stationAt(e, "DOMAIN_DEADLINE_UNKNOWN").guidance.handoff.reason =
          "Write {binding.note} is unconfirmed.";
      },
      variation(rule, 1),
      "reason",
    ],
    [
      "resource-kind",
      "apply",
      (e) => {
        stationAt(e, "DOMAIN_DEADLINE_UNKNOWN").guidance.handoff.resource.kind =
          "{binding.note}";
      },
      variation(rule, 1),
      "resource.kind",
    ],
    [
      "command-slot",
      "preview",
      (e) => {
        success(e).guidance.next.command = "{binding.target}";
      },
      variation(rule, 2),
      "command",
    ],
    [
      "kind-slot",
      "preview",
      (e) => {
        success(e).guidance.next.kind = "{binding.kind}";
      },
      variation(rule, 2),
      "kind",
    ],
  ];
  for (const [label, key, mutate, oracle, violated, more = []] of placements) {
    neg(rule, label, {
      oracle: [oracle, ...more],
      base: cdOf(key),
      role: "command-discovery",
      touched: ["templates", "vocab", "keyset"],
      key: violated,
      mutate,
    });
  }

  rule = "binding-keys";
  twin(rule, () => BASE.previewOk());
  const keyNegs = [
    [
      "",
      () => BASE.previewOk(),
      (e) => {
        delete e.result.bindings.note;
      },
      ref(rule, "negative"),
      [variation(rule, 0)],
    ],
    [
      "extra-key",
      () => BASE.previewOk(),
      (e) => {
        e.result.bindings.extra = "x";
      },
      variation(rule, 1),
    ],
    [
      "present-without-token",
      BASE.listOk,
      (e) => {
        e.result.bindings = { noteId: "n-1" };
      },
      variation(rule, 2),
    ],
    [
      "invalid-name",
      () => BASE.previewOk(),
      (e) => {
        e.result.bindings = { previewId: "pv-7f3a", Note: "first draft" };
      },
      variation(rule, 3),
    ],
  ];
  for (const [label, base, mutate, oracle, more = []] of keyNegs) {
    neg(rule, label, {
      oracle: [oracle, ...more],
      base,
      touched: ["bindings", "keyset"],
      key: "bindings",
      mutate,
    });
  }

  rule = "binding-value";
  const withNote = (note) => () =>
    BASE.previewOk({ previewId: "pv-7f3a", note });
  shape({
    id: `${rule}.valid`,
    rule,
    kind: "valid-twin",
    oracle: [ref(rule, "validTwin"), variation(rule, 4)],
    base: () => BASE.previewOk(),
    notes:
      "The row proves the lexical value rules only. Whether a value is a secret is reviewed, never claimed from shape (STEP-10, STEP-16).",
  });
  shape({
    id: `${rule}.valid.1024-bytes`,
    rule,
    kind: "variation-valid",
    oracle: [variation(rule, 1)],
    base: withNote("n".repeat(1024)),
    notes: "1,024 UTF-8 bytes is the inclusive STEP-10 maximum.",
    drop: {
      "step-arguments":
        "apply's --note slot allows 80 code points, so the rendered step is outside the target schema; this case proves the binding value rule only",
    },
  });
  const valueNegs = [
    ["", "-x", ref(rule, "negative"), [variation(rule, 2)]],
    ["empty", "", variation(rule, 0)],
    ["whitespace-only", "   ", variation(rule, 0)],
    ["1025-bytes", "n".repeat(1025), variation(rule, 1)],
    ["cc", "a\u0007b", variation(rule, 3)],
    ["cf", "a​b", variation(rule, 3)],
    ["zl", "a b", variation(rule, 3)],
    ["zp", "a b", variation(rule, 3)],
  ];
  for (const [label, note, oracle, more = []] of valueNegs) {
    neg(rule, label, {
      oracle: [oracle, ...more],
      base: () => BASE.previewOk(),
      touched: ["bindings", "next", "strings"],
      key: "note",
      mutate: (env) => {
        const next = BASE.previewOk({ previewId: "pv-7f3a", note });
        env.result.bindings = next.result.bindings;
        env.result.next = next.result.next;
      },
    });
  }

  rule = "binding-route";
  twin(rule, () => BASE.previewOk());
  neg(rule, "", {
    oracle: [ref(rule, "negative")],
    base: () => BASE.previewOk(),
    touched: ["bindings", "next"],
    key: "note",
    mutate: (env) => {
      const next = BASE.previewOk({ previewId: "pv-7f3a", note: "list" });
      env.result.bindings = next.result.bindings;
      env.result.next = next.result.next;
    },
    notes: "list is a route token of specimen.list (STEP-10, INPUT-3).",
  });
}

// ----- cross-observation rules ---------------------------------------------
function crossRules() {
  let rule = "step-target";
  twin(rule, BASE.showMissing);
  neg(rule, "", {
    oracle: [ref(rule, "negative")],
    base: BASE.showMissing,
    touched: ["next"],
    key: "command",
    mutate: (env) => {
      env.result.next.command = "specimen.browse";
    },
  });

  rule = "inspection-target";
  twin(rule, applyUnknown);
  neg(rule, "", {
    oracle: [ref(rule, "negative"), variation(rule, 0)],
    base: applyUnknown,
    touched: ["handoff"],
    key: "inspect",
    mutate: (env) => {
      env.result.handoff.inspect[0].command = ident("preview");
    },
  });
  neg(rule, "undeclared", {
    oracle: [variation(rule, 1)],
    base: applyUnknown,
    touched: ["handoff"],
    key: "inspect",
    mutate: (env) => {
      env.result.handoff.inspect[0].command = "specimen.journal";
    },
  });

  rule = "guidance-template";
  twin(rule, BASE.showMissing);
  neg(rule, "", {
    oracle: [ref(rule, "negative")],
    base: BASE.showMissing,
    touched: ["repair"],
    key: "repairAction",
    mutate: (env) => {
      env.result.repairAction = "Choose any other note identity.";
    },
  });

  rule = "station-fixed";
  twin(rule, BASE.showOk);
  neg(rule, "", {
    oracle: [ref(rule, "negative")],
    base: BASE.showOk,
    touched: ["effectClass"],
    key: "effectClass",
    mutate: (env) => {
      env.result.effectClass = "repository-local";
    },
  });

  rule = "retry-delay";
  twin(rule, BASE.applyTransient);
  const delays = [
    ["", 5000, ref(rule, "negative"), [variation(rule, 3)]],
    ["below-minimum", 100, variation(rule, 3)],
    ["zero", 0, variation(rule, 2)],
    ["noninteger", 1.5, variation(rule, 2)],
    ["unsafe", "__UNSAFE__", variation(rule, 2)],
  ];
  for (const [label, value, oracle, more = []] of delays) {
    neg(rule, label, {
      oracle: [oracle, ...more],
      base: BASE.applyTransient,
      touched: ["delay", "integers"],
      key: "retryDelayMilliseconds",
      mutate: (env) => {
        env.result.retryDelayMilliseconds = value;
      },
      raw: (bytes) => bytes.replace('"__UNSAFE__"', "9007199254740993"),
    });
  }
  neg(rule, "missing", {
    oracle: [variation(rule, 0)],
    base: BASE.applyTransient,
    touched: ["delay", "keyset", "null"],
    key: "retryDelayMilliseconds",
    mutate: (env) => {
      delete env.result.retryDelayMilliseconds;
    },
  });
  neg(rule, "present-on-nonretryable", {
    oracle: [variation(rule, 1)],
    base: BASE.listOk,
    touched: ["delay", "keyset", "null"],
    key: "retryDelayMilliseconds",
    mutate: (env) => {
      env.result.retryDelayMilliseconds = 500;
    },
  });

  rule = "step-arguments";
  twin(rule, () => BASE.previewOk());
  neg(rule, "", {
    oracle: [ref(rule, "negative")],
    base: () => BASE.previewOk(),
    touched: ["next"],
    key: "--preview",
    mutate: (env) => {
      env.result.next.args = ["--note", "first draft"];
    },
    notes:
      "apply's required --preview option is omitted from the rendered step.",
  });
  shape({
    id: `${rule}.negative.declaration-unsatisfiable`,
    rule,
    kind: "variation-negative",
    oracle: [ref(rule, "negative")],
    base: () => BASE.cd("preview"),
    role: "command-discovery",
    touched: ["templates"],
    key: "args",
    ctx: [ctxDiscovery(), ctxCd("apply")],
    mutate: (env) => {
      env.result.data.stations.find(
        (s) => s.causeCode === "SUCCESS_COMPLETED",
      ).guidance.next.args = ["--preview", "{binding.previewId}", "--note"];
    },
    notes:
      "F01 option 2: --note has no value token for any binding, so the template is rejected at declaration. The row sits on the command-discovery case.",
  });
}

// ----- declaration rules ---------------------------------------------------
function declarationRules() {
  const cdOf = (key) => () => BASE.cd(key);
  const declNeg = (
    rule,
    label,
    key,
    mutate,
    oracle,
    violated,
    touched,
    notes,
  ) =>
    neg(rule, label, {
      oracle,
      base: cdOf(key),
      role: "command-discovery",
      touched,
      key: violated,
      mutate,
      notes,
    });
  const declTwin = (rule, key, notes) =>
    shape({
      id: `${rule}.valid`,
      rule,
      kind: "valid-twin",
      oracle: [ref(rule, "validTwin")],
      base: cdOf(key),
      role: "command-discovery",
      notes,
    });
  const stationAt = (env, cause) =>
    env.result.data.stations.find((s) => s.causeCode === cause);

  let rule = "station-duplicate";
  declTwin(rule, "apply");
  declNeg(
    rule,
    "",
    "apply",
    (e) => {
      const copy = clone(stationAt(e, "TRANSIENT_NOT_STARTED"));
      copy.trigger = "The note store is being synchronised.";
      e.result.data.stations.push(copy);
    },
    [ref(rule, "negative")],
    "TRANSIENT_NOT_STARTED",
    ["stations"],
  );

  rule = "retry-policy";
  declTwin(rule, "apply");
  declNeg(
    rule,
    "",
    "apply",
    (e) => {
      stationAt(e, "TRANSIENT_NOT_STARTED").retryDelayPolicy = {
        kind: "bounded",
        minimumMilliseconds: 2000,
        maximumMilliseconds: 250,
      };
    },
    [ref(rule, "negative")],
    "maximumMilliseconds",
    ["stationRetry"],
  );

  rule = "lost-result-missing";
  declTwin(rule, "apply");
  declNeg(
    rule,
    "",
    "apply",
    (e) => {
      e.result.data.ifNoResult = null;
    },
    [ref(rule, "negative")],
    "ifNoResult",
    ["ifNoResult"],
  );

  rule = "lost-result-target";
  declTwin(rule, "apply");
  declNeg(
    rule,
    "",
    "apply",
    (e) => {
      e.result.data.ifNoResult.command = "specimen.journal";
    },
    [ref(rule, "negative"), variation(rule, 0)],
    "ifNoResult",
    ["ifNoResult"],
  );
  declNeg(
    rule,
    "changing-target",
    "apply",
    (e) => {
      e.result.data.ifNoResult.command = ident("preview");
    },
    [variation(rule, 1)],
    "ifNoResult",
    ["ifNoResult"],
  );

  rule = "lost-result-inspect";
  declTwin(rule, "list");
  declNeg(
    rule,
    "",
    "list",
    (e) => {
      e.result.data.ifNoResult = {
        kind: "command",
        command: ident("pending"),
        args: [],
      };
    },
    [ref(rule, "negative")],
    "ifNoResult",
    ["ifNoResult"],
  );

  rule = "lost-result-literals";
  declTwin(rule, "apply");
  const sixteen = Array.from({ length: 8 }, () => [
    "--command",
    ident("apply"),
  ]).flat();
  const stepBytes = (args) =>
    Buffer.byteLength(
      JSON.stringify({ kind: "command", command: ident("pending"), args }),
    );
  const sized = (target) => {
    const fixed = stepBytes(["--command", ""]);
    return ["--command", "c".repeat(target - fixed)];
  };
  const at2048 = sized(2048);
  const at2049 = sized(2049);
  if (stepBytes(at2048) !== 2048 || stepBytes(at2049) !== 2049) {
    throw new Error("ifNoResult size construction is off");
  }
  const literalVariants = [
    [
      "valid.16-args",
      sixteen,
      false,
      variation(rule, 0),
      "16 literal args are the inclusive DISC-13 maximum.",
    ],
    [
      "valid.2048-bytes",
      at2048,
      false,
      variation(rule, 1),
      "Compact JSON in key order kind, command, args is exactly 2,048 UTF-8 bytes (G19).",
    ],
    ["17-args", [...sixteen, "--command"], true, variation(rule, 0)],
    [
      "2049-bytes",
      at2049,
      true,
      variation(rule, 1),
      "Compact JSON is exactly 2,049 UTF-8 bytes (G19).",
    ],
    [
      "",
      ["{binding.run}"],
      true,
      ref(rule, "negative"),
      "Brace token inside ifNoResult args.",
      [variation(rule, 2)],
    ],
    ["cc", ["--command", "a\u0007"], true, variation(rule, 2)],
    ["cf", ["--command", "a​"], true, variation(rule, 2)],
    ["zl", ["--command", "a "], true, variation(rule, 2)],
    ["zp", ["--command", "a "], true, variation(rule, 2)],
  ];
  for (const [
    label,
    args,
    negative,
    oracle,
    notes,
    more = [],
  ] of literalVariants) {
    if (negative) {
      declNeg(
        rule,
        label,
        "apply",
        (e) => {
          e.result.data.ifNoResult.args = args;
        },
        [oracle, ...more],
        "ifNoResult",
        ["ifNoResult"],
        notes,
      );
    } else {
      shape({
        id: `${rule}.${label}`,
        rule,
        kind: "variation-valid",
        oracle: [oracle],
        base: () => {
          const env = BASE.cd("apply");
          env.result.data.ifNoResult.args = args;
          return env;
        },
        role: "command-discovery",
        notes,
      });
    }
  }

  rule = "input-schema";
  declTwin(rule, "find");
  const option = (e, name) =>
    e.result.data.input.options.find((o) => o.name === name);
  const inputNegs = [
    [
      "",
      (e) => {
        option(e, "--limit").aliases = ["-n", "--json"];
      },
      ref(rule, "negative"),
      "--json",
      [variation(rule, 2)],
    ],
    [
      "required-after-optional",
      (e) => {
        e.result.data.input.arguments.reverse();
      },
      variation(rule, 0),
      "term",
    ],
    [
      "duplicate-name",
      (e) => {
        option(e, "--code").name = "--label";
      },
      variation(rule, 1),
      "--label",
    ],
    [
      "duplicate-alias",
      (e) => {
        option(e, "--fuzzy").aliases = ["-e"];
      },
      variation(rule, 1),
      "-e",
    ],
    [
      "additional-arguments",
      (e) => {
        e.result.data.input.additionalArguments = true;
      },
      variation(rule, 3),
      "additionalArguments",
    ],
    [
      "additional-options",
      (e) => {
        e.result.data.input.additionalOptions = true;
      },
      variation(rule, 3),
      "additionalOptions",
    ],
    [
      "bounds-inverted",
      (e) => {
        option(e, "--label").value.minLength = 5;
      },
      variation(rule, 4),
      "minLength",
    ],
    [
      "choices-empty",
      (e) => {
        option(e, "--color").value.choices = [];
      },
      variation(rule, 4),
      "choices",
    ],
    [
      "choices-duplicate",
      (e) => {
        option(e, "--color").value.choices = ["red", "red", "blue"];
      },
      variation(rule, 4),
      "choices",
    ],
    [
      "choice-out-of-bounds",
      (e) => {
        option(e, "--color").value.maxLength = 4;
      },
      variation(rule, 4),
      "choices",
    ],
    [
      "requires-unresolved",
      (e) => {
        e.result.data.input.constraints[0].thenPresent = "--from";
      },
      variation(rule, 5),
      "--from",
    ],
    [
      "exclusive-unresolved",
      (e) => {
        e.result.data.input.constraints[1].members = ["--exact", "--approx"];
      },
      variation(rule, 5),
      "--approx",
    ],
    [
      "unsatisfiable-required",
      (e) => {
        option(e, "--exact").required = true;
        option(e, "--fuzzy").required = true;
      },
      variation(rule, 5),
      "exclusive",
    ],
  ];
  for (const [label, mutate, oracle, violated, more = []] of inputNegs) {
    declNeg(rule, label, "find", mutate, [oracle, ...more], violated, [
      "input",
      "pattern",
    ]);
  }

  rule = "pattern-syntax";
  declTwin(
    rule,
    "show",
    "noteId pattern n-[0-9]+ is a valid full-string Unicode pattern.",
  );
  declNeg(
    rule,
    "",
    "show",
    (e) => {
      e.result.data.input.arguments[0].value.pattern = "n-[0-9";
    },
    [ref(rule, "negative")],
    "pattern",
    ["pattern", "input"],
  );

  // Discovery-subject rules.
  const discTwin = (rule) =>
    shape({
      id: `${rule}.valid`,
      rule,
      kind: "valid-twin",
      oracle: [ref(rule, "validTwin")],
      base: BASE.discovery,
      role: "discovery",
    });
  rule = "version-copy";
  discTwin(rule);
  neg(rule, "", {
    oracle: [ref(rule, "negative")],
    base: BASE.discovery,
    role: "discovery",
    touched: ["versionCopy"],
    key: "contractVersion",
    mutate: (env) => {
      env.result.data.contractVersion = "3.1.0";
    },
  });
  rule = "discovery-metadata";
  discTwin(rule);
  neg(rule, "", {
    oracle: [ref(rule, "negative")],
    base: BASE.discovery,
    role: "discovery",
    touched: ["discoveryMeta"],
    key: "exitMeanings",
    mutate: (env) => {
      env.result.data.exitMeanings["75"] = "domain";
    },
  });
  rule = "root-routes";
  discTwin(rule);
  neg(rule, "", {
    oracle: [ref(rule, "negative")],
    base: BASE.discovery,
    role: "discovery",
    touched: ["discoveryCommands"],
    key: "route",
    mutate: (env) => {
      for (const c of env.result.data.commands) {
        if (
          c.commandIdentity === ident("list") ||
          c.commandIdentity === ident("show")
        ) {
          c.route = [];
        }
      }
    },
  });
}

export function shapeBindings() {
  framing();
  strictKeys();
  presence();
  resultCorrelation();
  envelopeRules();
  diagnostics();
  templates();
  crossRules();
  declarationRules();
}

export { CMD };
