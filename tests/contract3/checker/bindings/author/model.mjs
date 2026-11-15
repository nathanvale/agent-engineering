// fallow-ignore-file unused-file -- binder authoring source; run by hand to regenerate bindings, never imported by product or test code
// fallow-ignore-file boundary-violation -- binder authoring source outside every boundary zone by design
//
// The specimen CLI model, written by hand by the independent binder from the
// frozen Contract 3.0 text. Nothing here reads checker, kernel or src/ code.
// Every byte a target prints is composed from these declarations.

export const V = "3.0.0";
export const CLI = "specimen";
export const ident = (name) => `${CLI}.${name}`;

const str = (minLength, maxLength, choices = null, pattern = null) => ({
  kind: "string",
  minLength,
  maxLength,
  choices,
  pattern,
});
const int = (minimum, maximum) => ({ kind: "integer", minimum, maximum });
const arg = (name, summary, required, value) => ({
  name,
  summary,
  required,
  value,
});
const opt = (
  name,
  summary,
  { aliases = [], required = false, repeatable = false, value = null } = {},
) => ({ name, aliases, summary, required, repeatable, value });
const input = (args = [], opts = [], constraints = [], deadline = false) => ({
  arguments: args,
  options: opts,
  constraints,
  deadlineSupported: deadline,
  additionalArguments: false,
  additionalOptions: false,
});

// T0 common causes (expectations.json#/common_causes): outcome, class, exit,
// state, retryable.
export const COMMON = {
  SUCCESS_UNCHANGED: ["success", null, 0, "unchanged", false],
  SUCCESS_COMPLETED: ["success", null, 0, "completed", false],
  USAGE_INVALID_INVOCATION: ["refused", "usage", 2, "unchanged", false],
  USAGE_UNKNOWN_COMMAND: ["refused", "usage", 2, "unchanged", false],
  SCHEMA_INVALID_INPUT: ["refused", "schema", 4, "unchanged", false],
  SCHEMA_UNSUPPORTED_CONTRACT: ["refused", "schema", 4, "unchanged", false],
  DOMAIN_PRECONDITION_UNMET: ["refused", "domain", 3, "unchanged", false],
  DOMAIN_AUTHORITY_REQUIRED: ["refused", "domain", 3, "unchanged", false],
  TRANSIENT_NOT_STARTED: ["refused", "transient", 75, "unchanged", true],
  TRANSIENT_ATTEMPT_UNCHANGED: ["failed", "transient", 75, "unchanged", true],
  DOMAIN_DEADLINE_BEFORE_START: ["refused", "domain", 3, "unchanged", false],
  DOMAIN_DEADLINE_UNCHANGED: ["failed", "domain", 3, "unchanged", false],
  DOMAIN_DEADLINE_COMPLETED: ["failed", "domain", 3, "completed", false],
  DOMAIN_DEADLINE_PARTIAL: [
    "failed",
    "domain",
    3,
    "partially-completed",
    false,
  ],
  DOMAIN_DEADLINE_UNKNOWN: ["failed", "domain", 3, "unknown", false],
  INTERNAL_PREPARATION: ["refused", "internal", 1, "unchanged", false],
  INTERNAL_RESULT_UNCHANGED: ["failed", "internal", 1, "unchanged", false],
  INTERNAL_RESULT_COMPLETED: ["failed", "internal", 1, "completed", false],
  INTERNAL_RESULT_PARTIAL: [
    "failed",
    "internal",
    1,
    "partially-completed",
    false,
  ],
  INTERNAL_RESULT_UNKNOWN: ["failed", "internal", 1, "unknown", false],
  // Host-owned causes of the specimen CLI (WIRE-19), one row each.
  DOMAIN_NOTE_MISSING: ["refused", "domain", 3, "unchanged", false],
  DOMAIN_PREVIEW_MISSING: ["refused", "domain", 3, "unchanged", false],
  SCHEMA_PREVIEW_CORRUPT: ["failed", "schema", 4, "unchanged", false],
  SCHEMA_READBACK_COMPLETED: ["failed", "schema", 4, "completed", false],
  SCHEMA_READBACK_PARTIAL: [
    "failed",
    "schema",
    4,
    "partially-completed",
    false,
  ],
  SCHEMA_READBACK_UNKNOWN: ["failed", "schema", 4, "unknown", false],
};

export const CMD = {
  help: {
    identity: ident("help"),
    route: ["--help"],
    summary: "Describe usage and commands.",
    effectClass: "inspect",
    input: input(),
  },
  discovery: {
    identity: ident("discovery"),
    route: ["--discover"],
    summary: "Describe the contract and every command.",
    effectClass: "inspect",
    input: input(),
  },
  commandDiscovery: {
    identity: ident("command-discovery"),
    route: ["--discover-command"],
    summary: "Describe one command and its stations.",
    effectClass: "inspect",
    input: input([
      arg("identity", "Canonical command identity.", true, str(1, 128)),
    ]),
  },
  dispatch: {
    identity: ident("dispatch"),
    route: [],
    summary: "Route an invocation to one command.",
    effectClass: "inspect",
    input: input(),
  },
  list: {
    identity: ident("list"),
    route: ["list"],
    summary: "List notes.",
    effectClass: "inspect",
    input: input(),
  },
  show: {
    identity: ident("show"),
    route: ["show"],
    summary: "Show one note.",
    effectClass: "inspect",
    input: input(
      [arg("noteId", "Note identity.", true, str(1, 80, null, "n-[0-9]+"))],
      [opt("--details", "Include the note text.")],
    ),
  },
  find: {
    identity: ident("find"),
    route: ["find"],
    summary: "Find notes.",
    effectClass: "inspect",
    input: input(
      [
        arg("term", "Search term.", true, str(1, 40)),
        arg("scope", "Folder to search.", false, str(1, 20)),
      ],
      [
        opt("--label", "Short label filter.", { value: str(1, 3) }),
        opt("--color", "Color filter.", {
          value: str(1, 10, ["red", "green", "blue"]),
        }),
        opt("--code", "Lowercase code filter.", {
          value: str(1, 20, null, "[a-z]+"),
        }),
        opt("--limit", "Maximum results.", {
          aliases: ["-n"],
          value: int(-5, 100),
        }),
        opt("--tag", "Tag filter; repeat to add tags.", {
          repeatable: true,
          value: str(1, 10),
        }),
        opt("--exact", "Match exactly.", { aliases: ["-e"] }),
        opt("--fuzzy", "Match approximately.", { aliases: ["-f"] }),
        opt("--since", "Earliest date label.", { value: str(1, 20) }),
        opt("--until", "Latest date label.", { value: str(1, 20) }),
      ],
      [
        { kind: "requires", ifPresent: "--until", thenPresent: "--since" },
        { kind: "exclusive", members: ["--exact", "--fuzzy"] },
      ],
    ),
  },
  preview: {
    identity: ident("preview"),
    route: ["preview"],
    summary: "Preview one note change.",
    effectClass: "repository-local",
    effects: ["preview.record"],
    input: input(
      [],
      [
        opt("--note", "Note text to preview.", {
          required: true,
          value: str(1, 80),
        }),
      ],
    ),
  },
  apply: {
    identity: ident("apply"),
    route: ["apply"],
    summary: "Apply one previewed note change.",
    effectClass: "repository-local",
    effects: ["audit.write", "index.write", "note.write"],
    input: input(
      [],
      [
        opt("--preview", "Preview identity.", {
          required: true,
          value: str(1, 80),
        }),
        opt("--note", "Note text to confirm.", { value: str(1, 80) }),
      ],
      [],
      true,
    ),
  },
  pending: {
    identity: ident("pending"),
    route: ["pending"],
    summary: "Report unfinished changes.",
    effectClass: "inspect",
    input: input(
      [],
      [
        opt("--command", "Only report this command identity.", {
          repeatable: true,
          value: str(1, 2000),
        }),
      ],
    ),
  },
};

export const ORDER = [
  "help",
  "discovery",
  "commandDiscovery",
  "dispatch",
  "list",
  "show",
  "find",
  "preview",
  "apply",
  "pending",
];
export const HOSTS = ["list", "show", "find", "preview", "apply", "pending"];
export const ALL_IDS = ORDER.map((k) => CMD[k].identity).sort();

export const summaryOf = (key) => ({
  commandIdentity: CMD[key].identity,
  route: CMD[key].route,
  summary: CMD[key].summary,
  effectClass: CMD[key].effectClass,
});

const IF_NO_RESULT = { kind: "command", command: ident("pending"), args: [] };

const instruction = (text) => ({ next: { kind: "instruction", text } });
const DONE = { next: { kind: "done" } };
const RETRY = { next: { kind: "retry" } };

const WORDS = {
  USAGE_INVALID_INVOCATION: [
    instruction(
      "Run specimen --help, correct the invocation, then run it again.",
    ),
    "Correct the invocation; message names the rejected token.",
  ],
  USAGE_UNKNOWN_COMMAND: [
    instruction("Select an identity from availablePaths."),
    "Select a declared command identity.",
  ],
  SCHEMA_INVALID_INPUT: [
    instruction(
      "Correct the input shape named in message, then run the command again.",
    ),
    "Correct the named input shape.",
  ],
  INTERNAL_PREPARATION: [
    instruction("Repair the CLI or runtime before another run."),
    "Repair the CLI or runtime before another run.",
  ],
};

const inspectHandoff = {
  handoff: {
    owner: "operator",
    reason: "The result could not be produced.",
    inspect: [
      {
        kind: "instruction",
        text: "Inspect the specimen runtime log for this run.",
      },
    ],
  },
};

const changingHandoff = (reason) => ({
  handoff: {
    owner: "operator",
    reason,
    inspect: [IF_NO_RESULT],
  },
});

function station(key, cause, trigger, guidance, repair, extra = {}) {
  const [outcome, failureClass, exitCode, transactionState, retryable] =
    COMMON[cause];
  return {
    commandIdentity: CMD[key].identity,
    outcome,
    causeCode: cause,
    failureClass,
    exitCode,
    effectClass: CMD[key].effectClass,
    transactionState,
    retryable,
    retryDelayPolicy: retryable
      ? {
          kind: "bounded",
          minimumMilliseconds: 250,
          maximumMilliseconds: 2000,
        }
      : { kind: "none" },
    trigger,
    guidance,
    repairAction: outcome === "success" ? null : repair,
    reachability: extra.unreachable ? "declared-unreachable" : "required",
    unreachableRationale: extra.unreachable ?? null,
  };
}

const kernel = (key, cause, trigger) =>
  station(key, cause, trigger, WORDS[cause][0], WORDS[cause][1]);

const inspectInternal = (key) =>
  station(
    key,
    "INTERNAL_RESULT_UNCHANGED",
    "The result failed validation before output.",
    inspectHandoff,
    "Inspect failed result production.",
  );

const changingInternals = (key) => [
  station(
    key,
    "INTERNAL_RESULT_UNCHANGED",
    "The result failed validation; no effect was applied.",
    changingHandoff("The result could not be produced."),
    "Inspect failed result production.",
  ),
  station(
    key,
    "INTERNAL_RESULT_COMPLETED",
    "The result failed validation after every effect completed.",
    changingHandoff("Effects completed but the result could not be produced."),
    "Inspect completed effects and result production.",
  ),
  station(
    key,
    "INTERNAL_RESULT_UNKNOWN",
    "The result failed validation and the effect state is unconfirmed.",
    changingHandoff("The effect state could not be confirmed."),
    "Inspect the unfinished change before any further change.",
  ),
];

const builtinBase = (key, triggerText) => [
  station(key, "SUCCESS_UNCHANGED", triggerText, DONE, null),
  kernel(key, "INTERNAL_PREPARATION", "The CLI could not prepare to run."),
  inspectInternal(key),
];

export const STATIONS = {
  help: builtinBase("help", "Help was requested."),
  discovery: builtinBase("discovery", "Discovery was requested."),
  commandDiscovery: [
    station(
      "commandDiscovery",
      "SUCCESS_UNCHANGED",
      "A declared command was selected.",
      DONE,
      null,
    ),
    kernel(
      "commandDiscovery",
      "USAGE_UNKNOWN_COMMAND",
      "The selected identity is not declared.",
    ),
    kernel(
      "commandDiscovery",
      "INTERNAL_PREPARATION",
      "The CLI could not prepare to run.",
    ),
    inspectInternal("commandDiscovery"),
  ],
  dispatch: [
    kernel(
      "dispatch",
      "USAGE_INVALID_INVOCATION",
      "No command, a missing selector or incompatible built-in options.",
    ),
    kernel("dispatch", "USAGE_UNKNOWN_COMMAND", "The route is not declared."),
    kernel("dispatch", "INTERNAL_PREPARATION", "The CLI could not prepare."),
    inspectInternal("dispatch"),
  ],
  list: [
    station("list", "SUCCESS_UNCHANGED", "List notes.", DONE, null),
    kernel("list", "USAGE_INVALID_INVOCATION", "The invocation is invalid."),
    kernel("list", "INTERNAL_PREPARATION", "The CLI could not prepare."),
    inspectInternal("list"),
  ],
  show: [
    station("show", "SUCCESS_UNCHANGED", "The note was read.", DONE, null),
    station(
      "show",
      "DOMAIN_NOTE_MISSING",
      "No note has the requested identity.",
      { next: { kind: "command", command: ident("list"), args: [] } },
      "Choose a note identity that specimen.list reports; run {runId} found none.",
    ),
    kernel("show", "USAGE_INVALID_INVOCATION", "The invocation is invalid."),
    station(
      "show",
      "SCHEMA_INVALID_INPUT",
      "A persisted note failed its shape check.",
      WORDS.SCHEMA_INVALID_INPUT[0],
      WORDS.SCHEMA_INVALID_INPUT[1],
      {
        unreachable:
          "show validates its operand as usage and reads no persisted payload.",
      },
    ),
    kernel("show", "INTERNAL_PREPARATION", "The CLI could not prepare."),
    inspectInternal("show"),
  ],
  find: [
    station("find", "SUCCESS_UNCHANGED", "The search completed.", DONE, null),
    kernel("find", "USAGE_INVALID_INVOCATION", "The invocation is invalid."),
    station(
      "find",
      "SCHEMA_INVALID_INPUT",
      "A persisted index failed its shape check.",
      WORDS.SCHEMA_INVALID_INPUT[0],
      WORDS.SCHEMA_INVALID_INPUT[1],
      {
        unreachable:
          "find validates its arguments as usage and reads no persisted payload.",
      },
    ),
    kernel("find", "INTERNAL_PREPARATION", "The CLI could not prepare."),
    inspectInternal("find"),
  ],
  preview: [
    station(
      "preview",
      "SUCCESS_COMPLETED",
      "The preview was recorded.",
      {
        next: {
          kind: "command",
          command: ident("apply"),
          args: [
            "--preview",
            "{binding.previewId}",
            "--note",
            "{binding.note}",
          ],
        },
      },
      null,
    ),
    kernel("preview", "USAGE_INVALID_INVOCATION", "The invocation is invalid."),
    kernel(
      "preview",
      "SCHEMA_INVALID_INPUT",
      "The note store failed its shape check.",
    ),
    kernel("preview", "INTERNAL_PREPARATION", "The CLI could not prepare."),
    ...changingInternals("preview"),
  ],
  apply: [
    station(
      "apply",
      "SUCCESS_COMPLETED",
      "The change was applied.",
      DONE,
      null,
    ),
    station(
      "apply",
      "SUCCESS_UNCHANGED",
      "The preview was already applied.",
      DONE,
      null,
    ),
    station(
      "apply",
      "TRANSIENT_NOT_STARTED",
      "A sync of the note store is in progress.",
      RETRY,
      "Wait for the sync to finish.",
    ),
    station(
      "apply",
      "TRANSIENT_ATTEMPT_UNCHANGED",
      "The note store was busy and nothing was written.",
      RETRY,
      "Wait for the note store to become free.",
    ),
    station(
      "apply",
      "DOMAIN_PREVIEW_MISSING",
      "No unconsumed preview has the requested identity.",
      instruction("Run specimen.preview again to issue a new preview."),
      "Issue a new preview.",
    ),
    station(
      "apply",
      "SCHEMA_PREVIEW_CORRUPT",
      "The preview record failed its shape check before any write.",
      instruction(
        "Inspect the preview record named in message, then issue a new preview.",
      ),
      "Replace the corrupt preview record.",
    ),
    station(
      "apply",
      "SCHEMA_READBACK_COMPLETED",
      "Every write completed but the read-back failed its shape check.",
      changingHandoff("Read-back of completed writes failed its shape check."),
      "Inspect the completed writes.",
    ),
    station(
      "apply",
      "SCHEMA_READBACK_PARTIAL",
      "Some writes completed and the read-back failed its shape check.",
      changingHandoff("Read-back of partial writes failed its shape check."),
      "Inspect the partial writes.",
    ),
    station(
      "apply",
      "SCHEMA_READBACK_UNKNOWN",
      "The read-back failed its shape check and a write is unconfirmed.",
      changingHandoff("A write could not be confirmed."),
      "Inspect the unconfirmed writes.",
    ),
    kernel("apply", "USAGE_INVALID_INVOCATION", "The invocation is invalid."),
    kernel(
      "apply",
      "SCHEMA_INVALID_INPUT",
      "The preview store failed its shape check.",
    ),
    kernel("apply", "INTERNAL_PREPARATION", "The CLI could not prepare."),
    ...changingInternals("apply"),
    station(
      "apply",
      "INTERNAL_RESULT_PARTIAL",
      "The result failed validation after some effects completed.",
      changingHandoff("Some effects completed before the result failed."),
      "Inspect partial effects and result production.",
    ),
    station(
      "apply",
      "DOMAIN_DEADLINE_BEFORE_START",
      "The deadline passed before any work started.",
      instruction(
        "Inspect the deadline and input, then decide explicitly whether to start a new run.",
      ),
      "Choose a longer deadline or a smaller change.",
    ),
    station(
      "apply",
      "DOMAIN_DEADLINE_UNCHANGED",
      "The deadline passed and no write was applied.",
      instruction(
        "Inspect the deadline and input, then decide explicitly whether to start a new run.",
      ),
      "Choose a longer deadline or a smaller change.",
    ),
    station(
      "apply",
      "DOMAIN_DEADLINE_COMPLETED",
      "The deadline passed after every write completed.",
      changingHandoff("The deadline passed after every write completed."),
      "Inspect the completed writes.",
    ),
    station(
      "apply",
      "DOMAIN_DEADLINE_PARTIAL",
      "The deadline passed after some writes completed.",
      changingHandoff("The deadline passed after some writes completed."),
      "Inspect the partial writes.",
    ),
    station(
      "apply",
      "DOMAIN_DEADLINE_UNKNOWN",
      "The deadline passed with an unconfirmed write.",
      {
        handoff: {
          owner: "operator",
          reason: "Writes {uncertainEffects} are unconfirmed.",
          inspect: [IF_NO_RESULT],
          resource: { kind: "note-store", id: "notes" },
        },
      },
      "Inspect the unconfirmed writes.",
    ),
  ],
  pending: [
    station(
      "pending",
      "SUCCESS_UNCHANGED",
      "The unfinished report was read.",
      instruction(
        "Inspect each unfinished case and follow its recovery handoff. Never repeat an interrupted operation automatically.",
      ),
      null,
    ),
    kernel("pending", "USAGE_INVALID_INVOCATION", "The invocation is invalid."),
    kernel("pending", "INTERNAL_PREPARATION", "The CLI could not prepare."),
    inspectInternal("pending"),
  ],
};

export const clone = (value) => JSON.parse(JSON.stringify(value));

function render(value, ctx) {
  if (typeof value === "string") {
    const whole = /^\{binding\.([a-z][A-Za-z0-9]*)\}$/.exec(value);
    if (whole !== null) return ctx.bindings[whole[1]];
    return value
      .replaceAll("{runId}", ctx.runId)
      .replaceAll("{completedEffects}", JSON.stringify(ctx.effects.completed))
      .replaceAll("{remainingEffects}", JSON.stringify(ctx.effects.remaining))
      .replaceAll("{uncertainEffects}", JSON.stringify(ctx.effects.uncertain));
  }
  if (Array.isArray(value)) return value.map((item) => render(item, ctx));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, render(v, ctx)]),
    );
  }
  return value;
}

export const stationOf = (key, cause) => {
  const found = STATIONS[key].find((s) => s.causeCode === cause);
  if (found === undefined) throw new Error(`no station ${key} ${cause}`);
  return found;
};

export const NO_EFFECTS = () => ({
  completed: [],
  remaining: [],
  uncertain: [],
  inventoryComplete: true,
});

// Builds one result from a declared station plus this run's facts (DISC-9).
export function result(key, cause, facts = {}) {
  const s = stationOf(key, cause);
  const effects = facts.effects ?? NO_EFFECTS();
  const runId = facts.runId ?? "run-0001";
  const ctx = { runId, effects, bindings: facts.bindings ?? {} };
  const r = {
    runId,
    commandIdentity: s.commandIdentity,
    outcome: s.outcome,
    effectClass: s.effectClass,
    transactionState: s.transactionState,
    causeCode: s.causeCode,
    failureClass: s.failureClass,
    exitCode: s.exitCode,
    data: s.outcome === "success" ? (facts.data ?? null) : null,
    retryable: s.retryable,
  };
  if (s.retryable) {
    r.retryDelayMilliseconds =
      facts.delay ?? s.retryDelayPolicy.minimumMilliseconds * 2;
  }
  r.repairAction = s.repairAction === null ? null : render(s.repairAction, ctx);
  r.effects = effects;
  if ("next" in s.guidance) r.next = render(s.guidance.next, ctx);
  else r.handoff = render(s.guidance.handoff, ctx);
  if (facts.bindings !== undefined) r.bindings = facts.bindings;
  if (facts.attemptedEffect !== undefined) {
    r.attemptedEffect = facts.attemptedEffect;
  }
  return r;
}

export const envelope = (r, message, extra = {}) => {
  const env = {
    contractVersion: extra.version ?? V,
    message,
    availablePaths: extra.available ?? ALL_IDS,
    result: r,
  };
  if (extra.diagnostics !== undefined) env.diagnostics = extra.diagnostics;
  return env;
};

export const discoveryData = () => ({
  contractVersion: V,
  commands: ORDER.map(summaryOf),
  exitMeanings: {
    0: "success",
    1: "internal",
    2: "usage",
    3: "domain",
    4: "schema",
    75: "transient",
  },
  signalExits: { 130: "SIGINT", 143: "SIGTERM" },
  effectExclusions: ["diagnostic maintenance", "journal maintenance"],
});

export const helpData = () => ({
  usage: "specimen [--json] <command> [arguments]",
  summary: "Specimen CLI for independent checker bindings.",
  commands: HOSTS.map(summaryOf),
  options: [
    { name: "--help", valueName: null, summary: "Show help." },
    {
      name: "--discover",
      valueName: null,
      summary: "Describe every command.",
    },
    {
      name: "--discover-command",
      valueName: "identity",
      summary: "Describe one command and its stations.",
    },
    { name: "--json", valueName: null, summary: "Print one JSON envelope." },
    {
      name: "--deadline-ms",
      valueName: "milliseconds",
      summary:
        "Stop starting work after this many milliseconds where supported.",
    },
  ],
});

export const commandDiscoveryData = (key) => ({
  command: summaryOf(key),
  semantics: "possible-outcomes",
  ifNoResult: CMD[key].effectClass === "inspect" ? null : clone(IF_NO_RESULT),
  input: clone(CMD[key].input),
  stations: clone(STATIONS[key]),
});

const effectsOf = (state) => {
  switch (state) {
    case "completed":
      return {
        completed: ["audit.write", "index.write", "note.write"],
        remaining: [],
        uncertain: [],
        inventoryComplete: true,
      };
    case "partially-completed":
      return {
        completed: ["audit.write", "index.write"],
        remaining: ["note.write"],
        uncertain: [],
        inventoryComplete: true,
      };
    case "unknown":
      return {
        completed: ["audit.write", "index.write"],
        remaining: [],
        uncertain: ["note.write"],
        inventoryComplete: true,
      };
    default:
      return NO_EFFECTS();
  }
};

// Base envelopes. Each call returns a fresh object.
export const BASE = {
  help: () =>
    envelope(
      result("help", "SUCCESS_UNCHANGED", { data: helpData() }),
      "Help for specimen.",
    ),
  discovery: () =>
    envelope(
      result("discovery", "SUCCESS_UNCHANGED", { data: discoveryData() }),
      "Discovery for specimen.",
    ),
  cd: (key) =>
    envelope(
      result("commandDiscovery", "SUCCESS_UNCHANGED", {
        data: commandDiscoveryData(key),
      }),
      `Command discovery for ${CMD[key].identity}.`,
    ),
  cdUnknown: () =>
    envelope(
      result("commandDiscovery", "USAGE_UNKNOWN_COMMAND"),
      "No declared command has identity specimen.nope.",
    ),
  dispatchUsage: () =>
    envelope(
      result("dispatch", "USAGE_INVALID_INVOCATION"),
      "No command was given.",
    ),
  dispatchUnknown: () =>
    envelope(
      result("dispatch", "USAGE_UNKNOWN_COMMAND"),
      "No declared route matches bogus.",
    ),
  listOk: () =>
    envelope(
      result("list", "SUCCESS_UNCHANGED", { data: { notes: ["n-1", "n-2"] } }),
      "Listed 2 notes.",
    ),
  listUsage: () =>
    envelope(
      result("list", "USAGE_INVALID_INVOCATION"),
      "list takes no arguments; rejected --bogus.",
    ),
  listPrep: () =>
    envelope(
      result("list", "INTERNAL_PREPARATION"),
      "The CLI could not prepare to run.",
    ),
  listInternal: () =>
    envelope(
      result("list", "INTERNAL_RESULT_UNCHANGED"),
      "The result could not be produced.",
    ),
  showOk: () =>
    envelope(
      result("show", "SUCCESS_UNCHANGED", {
        data: { noteId: "n-1", title: "First note" },
      }),
      "Showed note n-1.",
    ),
  showMissing: () =>
    envelope(result("show", "DOMAIN_NOTE_MISSING"), "Note n-9 was not found."),
  showUsage: () =>
    envelope(
      result("show", "USAGE_INVALID_INVOCATION"),
      "noteId does not match its declared pattern.",
    ),
  showInternal: () =>
    envelope(
      result("show", "INTERNAL_RESULT_UNCHANGED"),
      "The result could not be produced.",
    ),
  showSchema: () =>
    envelope(
      result("show", "SCHEMA_INVALID_INPUT"),
      "Note n-1 failed its shape check.",
    ),
  findOk: (data = { matches: [] }) =>
    envelope(result("find", "SUCCESS_UNCHANGED", { data }), "Found 0 notes."),
  findUsage: () =>
    envelope(
      result("find", "USAGE_INVALID_INVOCATION"),
      "The find invocation is invalid.",
    ),
  previewOk: (bindings = { previewId: "pv-7f3a", note: "first draft" }) =>
    envelope(
      result("preview", "SUCCESS_COMPLETED", {
        data: { previewId: bindings.previewId },
        effects: {
          completed: ["preview.record"],
          remaining: [],
          uncertain: [],
          inventoryComplete: true,
        },
        bindings,
      }),
      "Previewed 1 change.",
    ),
  previewUsage: () =>
    envelope(
      result("preview", "USAGE_INVALID_INVOCATION"),
      "The preview invocation is invalid.",
    ),
  previewSchema: () =>
    envelope(
      result("preview", "SCHEMA_INVALID_INPUT"),
      "The note store failed its shape check.",
    ),
  previewInternalUnchanged: () =>
    envelope(
      result("preview", "INTERNAL_RESULT_UNCHANGED", {
        attemptedEffect: "preview.record",
        effects: {
          completed: [],
          remaining: ["preview.record"],
          uncertain: [],
          inventoryComplete: true,
        },
      }),
      "The result could not be produced; nothing was recorded.",
    ),
  previewInternalCompleted: () =>
    envelope(
      result("preview", "INTERNAL_RESULT_COMPLETED", {
        attemptedEffect: "preview.record",
        effects: {
          completed: ["preview.record"],
          remaining: [],
          uncertain: [],
          inventoryComplete: true,
        },
      }),
      "The preview was recorded but the result could not be produced.",
    ),
  applyOk: () =>
    envelope(
      result("apply", "SUCCESS_COMPLETED", {
        data: { applied: "pv-7f3a" },
        effects: effectsOf("completed"),
      }),
      "Applied preview pv-7f3a.",
    ),
  applyNoop: () =>
    envelope(
      result("apply", "SUCCESS_UNCHANGED", { data: { applied: "pv-7f3a" } }),
      "Preview pv-7f3a was already applied.",
    ),
  applyTransient: (delay = 500) =>
    envelope(
      result("apply", "TRANSIENT_NOT_STARTED", { delay }),
      "A sync of the note store is in progress.",
    ),
  applyTransientFailed: () =>
    envelope(
      result("apply", "TRANSIENT_ATTEMPT_UNCHANGED", {
        attemptedEffect: "audit.write",
        effects: {
          completed: [],
          remaining: ["audit.write", "index.write", "note.write"],
          uncertain: [],
          inventoryComplete: true,
        },
      }),
      "The note store was busy; nothing was written.",
    ),
  applyMissing: () =>
    envelope(
      result("apply", "DOMAIN_PREVIEW_MISSING"),
      "No unconsumed preview has identity pv-missing.",
    ),
  applySchemaUnchanged: () =>
    envelope(
      result("apply", "SCHEMA_PREVIEW_CORRUPT", {
        attemptedEffect: "audit.write",
        effects: {
          completed: [],
          remaining: ["audit.write", "index.write", "note.write"],
          uncertain: [],
          inventoryComplete: true,
        },
      }),
      "Preview pv-7f3a failed its shape check.",
    ),
  applyState: (cause, state, message) =>
    envelope(
      result("apply", cause, {
        attemptedEffect: "note.write",
        effects: effectsOf(state),
      }),
      message,
    ),
  applyDeadlineBefore: () =>
    envelope(
      result("apply", "DOMAIN_DEADLINE_BEFORE_START"),
      "The deadline passed before any work started.",
    ),
  applyDeadlineUnchanged: () =>
    envelope(
      result("apply", "DOMAIN_DEADLINE_UNCHANGED", {
        attemptedEffect: "audit.write",
        effects: {
          completed: [],
          remaining: ["audit.write", "index.write", "note.write"],
          uncertain: [],
          inventoryComplete: true,
        },
      }),
      "The deadline passed; nothing was written.",
    ),
  applyUnknownIncomplete: () =>
    envelope(
      result("apply", "INTERNAL_RESULT_UNKNOWN", {
        attemptedEffect: "note.write",
        effects: {
          completed: ["audit.write"],
          remaining: ["index.write"],
          uncertain: ["note.write"],
          inventoryComplete: false,
        },
      }),
      "The effect inventory could not be completed.",
    ),
  pendingOk: () =>
    envelope(
      result("pending", "SUCCESS_UNCHANGED", { data: { unfinished: [] } }),
      "No unfinished changes.",
    ),
};

export const HUMAN = {
  help: "Usage: specimen [--json] <command> [arguments]\n\nCommands:\n  list     List notes.\n  show     Show one note.\n  find     Find notes.\n  preview  Preview one note change.\n  apply    Apply one previewed note change.\n  pending  Report unfinished changes.\n",
  discovery:
    "specimen contract 3.0.0\n\nCommands:\n  specimen.help\n  specimen.discovery\n  specimen.command-discovery\n  specimen.dispatch\n  specimen.list\n  specimen.show\n  specimen.find\n  specimen.preview\n  specimen.apply\n  specimen.pending\n",
};

export const bytesOf = (value) => `${JSON.stringify(value)}\n`;
