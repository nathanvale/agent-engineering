// fallow-ignore-file unused-file -- binder authoring source; run by hand to regenerate bindings, never imported by product or test code
// fallow-ignore-file boundary-violation -- binder authoring source outside every boundary zone by design
//
// Process bindings (interface groups V, P, F and R) on real specimen runs.
// Expected exits, causes and identities are the binder's reading of the
// frozen contract, never a target's catalogue.
import {
  KEY_OF,
  admit,
  bind,
  ctxCd,
  ctxDiscovery,
  finding,
} from "./framework.mjs";
import {
  ALL_IDS,
  BASE,
  HUMAN,
  V,
  bytesOf,
  clone,
  envelope,
  ident,
  result,
} from "./model.mjs";

const ref = (rule, part) => `rules/${rule}/${part}`;
const variation = (rule, index) => `rules/${rule}/requiredVariations/${index}`;

export const RETAINED_WRAPPER =
  "config/agents/plugins/my-second-brain-playground/bin/cli-design-check";
export const RETAINED_COMMIT = "29bf4bb0f307f96d396aa087472a4dbed849c920";

export const resp = (env, { stderr = "", exit, state } = {}) => ({
  stdout: bytesOf(env),
  stderr,
  exit: exit ?? env.result.exitCode,
  ...(state === undefined ? {} : { state }),
});
export const expectOf = (env, identity = false) => ({
  exitCode: env.result.exitCode,
  causeCode: env.result.causeCode,
  outcome: env.result.outcome,
  ...(identity ? { commandIdentity: env.result.commandIdentity } : {}),
});

const RUN_BASE = [
  "json-framing",
  "version-malformed",
  "strict-keys",
  "result-correlation",
  "machine-stderr",
  "exit-envelope",
];

// One run case. Sentinels follow the same footprint rule as shape cases.
export function runCase(name, role, argv, responses, opts = {}) {
  const {
    rule,
    expect,
    touched = [],
    station = true,
    mode = "machine",
    counter,
    state,
    env,
    probe,
    tableName,
    extraRules = [],
    plain = false,
  } = opts;
  let pool = [];
  if (mode === "machine" && !plain) {
    pool = [...RUN_BASE];
    if (expect?.exitCode !== undefined) pool.push("exit-expected");
    if (expect?.causeCode !== undefined) pool.push("cause-expected");
    if (station) pool.push("station-observed");
  } else if (mode === "human" && expect?.exitCode !== undefined && !plain) {
    pool = ["exit-expected"];
  }
  pool.push(...extraRules);
  const { rules, excluded } =
    rule === undefined
      ? { rules: pool, excluded: {} }
      : admit(rule, pool, touched);
  return {
    case: {
      name,
      role,
      mode,
      target: { run: { argv, responses, counter, state, env, tableName } },
      rules,
      expect,
      probe,
      status: {},
    },
    excluded,
  };
}

const fail = (c, rule) => {
  c.status[rule] = { failed: finding(rule) };
  return c;
};

const ctxFor = (...keys) => [
  ctxDiscovery(),
  ...[...new Set(keys)].map((key) => ctxCd(key)),
];

function proc({ id, rule, kind, oracle, cases, excluded = {}, ...rest }) {
  bind({ id, rule, kind, oracle, cases, excluded, ...rest });
}

// Twin and negative over one subject run: the negative swaps the response.
function pair({
  rule,
  label = "",
  oracle,
  negOracle,
  role = "command",
  argv,
  good,
  bad,
  expect,
  ctxKeys,
  touched = ["observed"],
  notes,
  provisional,
  message = [],
  twinOnly = false,
  mode,
  probe,
  badProbe,
  state,
  station,
  twinKind,
  plainNegative = false,
}) {
  const suffix = label === "" ? "" : `.${label}`;
  const ctx = ctxKeys === null ? [] : ctxFor(...(ctxKeys ?? []));
  const twin = runCase("subject", role, argv, [good], {
    rule,
    expect,
    mode,
    probe,
    state,
    station: station ?? ctxKeys !== null,
  });
  proc({
    id: `${rule}.valid${suffix}`,
    rule,
    kind: twinKind ?? (label === "" ? "valid-twin" : "variation-valid"),
    oracle,
    cases: [...ctx, twin.case],
    notes,
    provisional,
  });
  if (twinOnly) return;
  const negative = runCase("subject", role, argv, [bad], {
    rule,
    expect,
    mode,
    probe: badProbe ?? probe,
    state,
    touched,
    station: station ?? ctxKeys !== null,
    plain: plainNegative,
  });
  fail(negative.case, rule);
  proc({
    id: `${rule}.negative${suffix}`,
    rule,
    kind: label === "" ? "negative" : "variation-negative",
    oracle: negOracle,
    cases: [...ctx, negative.case],
    excluded: negative.excluded,
    message: [V, ...message],
    notes,
    provisional,
  });
}

// ----- stderr, exits and causes --------------------------------------------
function streamsAndExits() {
  let rule = "machine-stderr";
  const routes = [
    ["", ["list", "--json"], BASE.listOk(), "command", ["list"], 4],
    ["help", ["--help", "--json"], BASE.help(), "help", null, 0],
    [
      "discovery",
      ["--discover", "--json"],
      BASE.discovery(),
      "discovery",
      null,
      1,
    ],
    [
      "command-discovery",
      ["--discover-command", ident("list"), "--json"],
      BASE.cd("list"),
      "command-discovery",
      null,
      1,
    ],
    [
      "usage",
      ["list", "--bogus", "--json"],
      BASE.listUsage(),
      "command",
      ["list"],
      2,
    ],
    [
      "internal",
      ["list", "--json"],
      BASE.listInternal(),
      "command",
      ["list"],
      3,
    ],
  ];
  for (const [label, argv, env, role, ctxKeys, index] of routes) {
    pair({
      rule,
      label,
      oracle:
        label === ""
          ? [ref(rule, "validTwin"), variation(rule, index)]
          : [variation(rule, index)],
      negOracle:
        label === ""
          ? [ref(rule, "negative"), variation(rule, index)]
          : [variation(rule, index)],
      role,
      argv,
      good: resp(env),
      bad: resp(env, { stderr: "specimen: cache is cold\n" }),
      expect: expectOf(env, true),
      ctxKeys,
      touched: ["stderr"],
    });
  }

  const showPrep = () =>
    envelope(
      result("show", "INTERNAL_PREPARATION"),
      "The CLI could not prepare to run.",
    );

  rule = "exit-expected";
  pair({
    rule,
    oracle: [ref(rule, "validTwin")],
    negOracle: [ref(rule, "negative")],
    argv: ["show", "n-9", "--json"],
    good: resp(BASE.showMissing()),
    bad: resp(showPrep()),
    expect: {
      exitCode: 3,
      causeCode: "DOMAIN_NOTE_MISSING",
      outcome: "refused",
    },
    ctxKeys: ["show"],
    notes:
      "The negative is a valid exit-1 internal refusal that agrees with its own process exit; the independent expectation is exit 3 (V-9).",
  });

  rule = "cause-expected";
  pair({
    rule,
    oracle: [ref(rule, "validTwin")],
    negOracle: [ref(rule, "negative")],
    argv: ["show", "n-9", "--json"],
    good: resp(BASE.showMissing()),
    bad: resp(BASE.showMissing()),
    expect: {
      exitCode: 3,
      causeCode: "DOMAIN_NOTE_MISSING",
      outcome: "refused",
    },
    ctxKeys: ["show"],
    twinOnly: true,
  });
  {
    const negative = runCase(
      "subject",
      "command",
      ["show", "n-9", "--json"],
      [resp(BASE.showMissing())],
      {
        rule,
        expect: {
          exitCode: 3,
          causeCode: "DOMAIN_PRECONDITION_UNMET",
          outcome: "refused",
        },
        touched: ["observedCause"],
      },
    );
    fail(negative.case, rule);
    proc({
      id: `${rule}.negative`,
      rule,
      kind: "negative",
      oracle: [ref(rule, "negative")],
      cases: [...ctxFor("show"), negative.case],
      excluded: negative.excluded,
      message: [V, "causeCode"],
      notes:
        "The specimen catalogue declares DOMAIN_NOTE_MISSING and the specimen emits it; the independent expectation for this brief is DOMAIN_PRECONDITION_UNMET at the same exit 3.",
    });
  }

  rule = "exit-envelope";
  pair({
    rule,
    oracle: [ref(rule, "validTwin")],
    negOracle: [ref(rule, "negative")],
    argv: ["show", "n-9", "--json"],
    good: resp(BASE.showMissing()),
    bad: resp(BASE.showMissing(), { exit: 1 }),
    expect: {
      exitCode: 3,
      causeCode: "DOMAIN_NOTE_MISSING",
      outcome: "refused",
    },
    ctxKeys: ["show"],
    touched: ["realExit"],
    message: ["exitCode"],
  });

  // additionalControls/envelope-exits: real exits 1, 4 and 75.
  const exits = [
    [
      "exit-1",
      ["show", "n-1", "--json"],
      BASE.showInternal(),
      "show",
      BASE.showMissing(),
    ],
    [
      "exit-4",
      ["preview", "--note", "first draft", "--json"],
      BASE.previewSchema(),
      "preview",
      envelope(
        result("preview", "INTERNAL_PREPARATION"),
        "The CLI could not prepare to run.",
      ),
    ],
    [
      "exit-75",
      ["apply", "--preview", "pv-7f3a", "--json"],
      BASE.applyTransient(),
      "apply",
      BASE.applyMissing(),
    ],
  ];
  for (const [label, argv, env, key, wrong] of exits) {
    const twin = runCase("subject", "command", argv, [resp(env)], {
      expect: expectOf(env, true),
    });
    proc({
      id: `envelope-exits.valid.${label}`,
      rule: "exit-expected",
      kind: "control-valid",
      oracle: [
        "additionalControls/envelope-exits",
        ref("exit-expected", "validTwin"),
        ref("cause-expected", "validTwin"),
      ],
      verification: ["V-9", "V-34"],
      cases: [...ctxFor(key), twin.case],
    });
    const negative = runCase("subject", "command", argv, [resp(wrong)], {
      rule: "exit-expected",
      expect: expectOf(env, true),
      touched: ["observed"],
    });
    fail(negative.case, "exit-expected");
    proc({
      id: `envelope-exits.negative.${label}`,
      rule: "exit-expected",
      kind: "control-negative",
      oracle: ["additionalControls/envelope-exits"],
      verification: ["V-9", "V-34"],
      cases: [...ctxFor(key), negative.case],
      excluded: negative.excluded,
      message: [V, "exitCode"],
      notes: `The specimen emits a valid, self-consistent exit-${wrong.result.exitCode} envelope where the brief expects exit ${env.result.exitCode}.`,
    });
  }
}

// ----- navigation ----------------------------------------------------------
function navigation() {
  let rule = "builtins";
  const builtinKeys = ["help", "discovery", "commandDiscovery", "dispatch"];
  {
    const disc = runCase(
      "discovery",
      "discovery",
      ["--discover", "--json"],
      [resp(BASE.discovery())],
      {
        expect: expectOf(BASE.discovery(), true),
        station: false,
        extraRules: [rule],
      },
    );
    const cds = builtinKeys.map(
      (key) =>
        runCase(
          `cd-${key}`,
          "command-discovery",
          [
            "--discover-command",
            ident(key === "commandDiscovery" ? "command-discovery" : key),
            "--json",
          ],
          [resp(BASE.cd(key))],
          {
            expect: expectOf(BASE.cd(key), true),
            station: false,
            extraRules: [rule],
          },
        ).case,
    );
    proc({
      id: `${rule}.valid`,
      rule,
      kind: "valid-twin",
      oracle: [ref(rule, "validTwin"), variation(rule, 1)],
      cases: [disc.case, ...cds],
    });
  }
  builtinKeys.forEach((key, index) => {
    const env = BASE.discovery();
    const id = ident(key === "commandDiscovery" ? "command-discovery" : key);
    env.result.data.commands = env.result.data.commands.filter(
      (c) => c.commandIdentity !== id,
    );
    const negative = runCase(
      "subject",
      "discovery",
      ["--discover", "--json"],
      [resp(env)],
      {
        rule,
        expect: expectOf(env, true),
        station: false,
        touched: ["discoveryCommands"],
      },
    );
    fail(negative.case, rule);
    proc({
      id: `${rule}.negative${index === 0 ? "" : `.remove-${id.slice(9)}`}`,
      rule,
      kind: index === 0 ? "negative" : "variation-negative",
      oracle:
        index === 0
          ? [ref(rule, "negative"), variation(rule, 0)]
          : [variation(rule, 0)],
      cases: [negative.case],
      excluded: negative.excluded,
      message: [V, id],
    });
  });
  {
    const negative = runCase(
      "subject",
      "command-discovery",
      ["--discover-command", ident("dispatch"), "--json"],
      [resp(BASE.cdUnknown())],
      {
        rule,
        expect: expectOf(BASE.cd("dispatch"), true),
        station: false,
        touched: ["observed"],
      },
    );
    fail(negative.case, rule);
    proc({
      id: `${rule}.negative.not-command-discoverable`,
      rule,
      kind: "variation-negative",
      oracle: [variation(rule, 1)],
      cases: [negative.case],
      excluded: negative.excluded,
      message: [V, ident("dispatch")],
    });
  }

  rule = "help-discovery";
  {
    const build = (helpEnv) => [
      runCase(
        "discovery",
        "discovery",
        ["--discover", "--json"],
        [resp(BASE.discovery())],
        {
          expect: expectOf(BASE.discovery(), true),
          station: false,
        },
      ).case,
      runCase("subject", "help", ["--help", "--json"], [resp(helpEnv)], {
        rule,
        expect: expectOf(helpEnv, true),
        station: false,
        touched: ["help"],
      }),
    ];
    const [disc, twin] = build(BASE.help());
    proc({
      id: `${rule}.valid`,
      rule,
      kind: "valid-twin",
      oracle: [ref(rule, "validTwin")],
      cases: [disc, twin.case],
    });
    const stale = BASE.help();
    stale.result.data.commands.find(
      (c) => c.commandIdentity === ident("show"),
    ).route = ["display"];
    const [disc2, negative] = build(stale);
    fail(negative.case, rule);
    proc({
      id: `${rule}.negative`,
      rule,
      kind: "negative",
      oracle: [ref(rule, "negative")],
      cases: [disc2, negative.case],
      excluded: negative.excluded,
      message: [V, "route"],
    });
  }

  rule = "human-discovery";
  pair({
    rule,
    oracle: [ref(rule, "validTwin")],
    negOracle: [ref(rule, "negative")],
    role: "discovery",
    mode: "human",
    argv: ["--discover"],
    good: { stdout: HUMAN.discovery, stderr: "", exit: 0 },
    bad: {
      stdout: "",
      stderr: "specimen: --discover requires --json\n",
      exit: 2,
    },
    expect: { exitCode: 0 },
    ctxKeys: null,
    message: [],
    notes:
      "Human mode: the row judges real exit against expect, nonempty stdout on exit 0 and one stderr line on a nonzero exit (G18).",
  });

  rule = "command-selection";
  {
    const dump = BASE.cd("list");
    dump.result.data.stations = ["list", "show", "apply"].flatMap(
      (key) => BASE.cd(key).result.data.stations,
    );
    pair({
      rule,
      oracle: [ref(rule, "validTwin")],
      negOracle: [ref(rule, "negative")],
      role: "command-discovery",
      argv: ["--discover-command", ident("list"), "--json"],
      good: resp(BASE.cd("list")),
      bad: resp(dump),
      expect: expectOf(BASE.cd("list"), true),
      ctxKeys: null,
      station: false,
      touched: ["stations"],
      message: ["stations"],
    });
  }

  rule = "dispatch";
  {
    const human = (stdout, stderr, exit) => ({ stdout, stderr, exit });
    const variants = [
      [
        "no-arguments",
        "dispatch",
        "human",
        [],
        human("", "specimen: no command given\n", 2),
        { exitCode: 2 },
        human("n-1\nn-2\n", "", 0),
        0,
        "No-argument invocation dispatches the host list operation.",
      ],
      [
        "",
        "dispatch",
        "machine",
        ["--json"],
        resp(BASE.dispatchUsage()),
        expectOf(BASE.dispatchUsage(), true),
        resp(BASE.listOk()),
        0,
        "Machine no-argument invocation dispatches the host list operation.",
      ],
      [
        "missing-selector",
        "dispatch",
        "machine",
        ["--discover-command", "--json"],
        resp(BASE.dispatchUsage()),
        expectOf(BASE.dispatchUsage(), true),
        resp(BASE.discovery()),
        1,
        "A missing selector falls back to full discovery.",
      ],
      [
        "incompatible-builtins",
        "dispatch",
        "machine",
        ["--help", "--discover", "--json"],
        resp(BASE.dispatchUsage()),
        expectOf(BASE.dispatchUsage(), true),
        resp(BASE.help()),
        2,
        "Incompatible built-ins are resolved by taking the first.",
      ],
      [
        "unknown-selected-identity",
        "command-discovery",
        "machine",
        ["--discover-command", "specimen.nope", "--json"],
        resp(BASE.cdUnknown()),
        expectOf(BASE.cdUnknown(), true),
        resp(BASE.dispatchUnknown()),
        3,
        "An unknown selected identity is refused under the dispatch identity.",
      ],
      [
        "human-help",
        "help",
        "human",
        ["--help"],
        human(HUMAN.help, "", 0),
        { exitCode: 0 },
        human(HUMAN.help, "", 2),
        4,
        "Human help exits 2.",
      ],
      [
        "machine-help",
        "help",
        "machine",
        ["--help", "--json"],
        resp(BASE.help()),
        expectOf(BASE.help(), true),
        human(HUMAN.help, "", 0),
        4,
        "Machine help prints human text.",
      ],
    ];
    for (const [
      label,
      role,
      mode,
      argv,
      good,
      expect,
      bad,
      index,
      why,
    ] of variants) {
      pair({
        rule,
        label,
        oracle:
          label === ""
            ? [ref(rule, "validTwin"), variation(rule, index)]
            : [variation(rule, index)],
        negOracle:
          label === ""
            ? [ref(rule, "negative"), variation(rule, index)]
            : [variation(rule, index)],
        role,
        mode,
        argv,
        good,
        bad,
        expect,
        ctxKeys: null,
        station: false,
        plainNegative: true,
        notes: `${why} The negative admits only dispatch: its output may not be one envelope.`,
      });
    }
  }

  rule = "global-mode";
  pair({
    rule,
    oracle: [ref(rule, "validTwin")],
    negOracle: [ref(rule, "negative")],
    argv: ["find", "--json", "--", "--json"],
    good: resp(BASE.findOk()),
    bad: resp(BASE.findUsage()),
    expect: expectOf(BASE.findOk(), true),
    ctxKeys: ["find"],
    notes:
      "--json after -- is the term operand; the negative treats it as the global switch and finds no term.",
  });
  pair({
    rule,
    label: "switch-after-operand",
    oracle: [ref(rule, "validTwin")],
    argv: ["find", "abc", "--json"],
    good: resp(BASE.findOk()),
    expect: expectOf(BASE.findOk(), true),
    ctxKeys: ["find"],
    twinOnly: true,
  });

  rule = "token-argv";
  {
    const spaced = { previewId: "pv-7f3a", note: "two words" };
    const split = BASE.previewOk(spaced);
    split.result.next.args = ["--preview", "pv-7f3a", "--note", "two", "words"];
    pair({
      rule,
      oracle: [ref(rule, "validTwin")],
      negOracle: [ref(rule, "negative")],
      argv: ["preview", "--note", "two words", "--json"],
      good: resp(BASE.previewOk(spaced)),
      bad: resp(split),
      expect: expectOf(BASE.previewOk(spaced), true),
      ctxKeys: ["preview", "apply"],
      touched: ["next"],
      message: ["args"],
      notes:
        "G10 interpretation: element-for-element agreement of emitted args with the substituted template on a real run.",
    });
  }

  rule = "station-observed";
  {
    const undeclared = BASE.showMissing();
    undeclared.result.causeCode = "DOMAIN_PRECONDITION_UNMET";
    undeclared.result.repairAction = "Repair the named precondition.";
    undeclared.result.next = {
      kind: "instruction",
      text: "Repair the named precondition, then run show again.",
    };
    undeclared.message = "A precondition for show is unmet.";
    pair({
      rule,
      oracle: [ref(rule, "validTwin")],
      negOracle: [ref(rule, "negative")],
      argv: ["show", "n-9", "--json"],
      good: resp(BASE.showMissing()),
      bad: resp(undeclared),
      expect: { exitCode: 3, outcome: "refused" },
      ctxKeys: ["show"],
      touched: ["observedStation", "cause"],
      message: ["DOMAIN_PRECONDITION_UNMET"],
    });
  }

  rule = "station-required";
  {
    const runs = [
      ["ok", ["list", "--json"], BASE.listOk(), undefined],
      ["usage", ["list", "--bogus", "--json"], BASE.listUsage(), undefined],
      [
        "preparation",
        ["list", "--json"],
        BASE.listPrep(),
        { SPECIMEN_FAULT: "preparation" },
      ],
      [
        "internal",
        ["list", "--json"],
        BASE.listInternal(),
        { SPECIMEN_FAULT: "result" },
      ],
    ];
    const build = (omit) => {
      const cases = runs
        .filter(([label]) => label !== omit)
        .map(
          ([label, argv, env, extraEnv]) =>
            runCase(`list-${label}`, "command", argv, [resp(env)], {
              expect: expectOf(env, true),
              env: extraEnv,
              station: false,
            }).case,
        );
      const cd = runCase(
        "subject",
        "command-discovery",
        ["--discover-command", ident("list"), "--json"],
        [resp(BASE.cd("list"))],
        {
          rule,
          expect: expectOf(BASE.cd("list"), true),
          station: false,
        },
      );
      return [ctxDiscovery(), ...cases, cd.case];
    };
    proc({
      id: `${rule}.valid`,
      rule,
      kind: "valid-twin",
      oracle: [ref(rule, "validTwin")],
      cases: build(null),
      notes:
        "Every required station of specimen.list is reached by its own run; INTERNAL_PREPARATION and INTERNAL_RESULT_UNCHANGED are fault-injected through SPECIMEN_FAULT.",
    });
    const negCases = build("internal");
    fail(negCases.at(-1), rule);
    proc({
      id: `${rule}.negative`,
      rule,
      kind: "negative",
      oracle: [ref(rule, "negative")],
      cases: negCases,
      message: [V, "INTERNAL_RESULT_UNCHANGED"],
      notes:
        "G11: an incomplete admission refuses with SCHEMA_INVALID_INPUT under the interface's invariant, although the target is correct.",
    });
  }

  rule = "open-cause";
  {
    const twin = runCase(
      "subject",
      "command",
      ["show", "n-9", "--json"],
      [resp(BASE.showMissing())],
      {
        rule,
        expect: expectOf(BASE.showMissing(), true),
      },
    );
    proc({
      id: `${rule}.valid`,
      rule,
      kind: "valid-twin",
      oracle: [
        ref(rule, "validTwin"),
        ref(rule, "negative"),
        "additionalControls/unknown-host-cause",
      ],
      verification: ["V-16", "V-34"],
      cases: [...ctxFor("show"), twin.case],
      harness: {
        rule,
        negativeIsCheckerPerturbation: true,
        perturbation:
          "Make the checker reject any cause absent from the 20 T0 common causes.",
        expectedUnderPerturbation:
          "This binding no longer matches: exit 4 replaces exit 0, so the harness must fail.",
      },
      notes:
        "DOMAIN_NOTE_MISSING is a host cause unknown to any cross-CLI list (VER-7, WIRE-20). G12.",
    });
  }

  rule = "unreachable-review";
  {
    const review = {
      not_run:
        "independent review required: a reachability rationale is reviewed, never proved from shape",
    };
    const twin = runCase(
      "subject",
      "command",
      ["show", "n-9", "--json"],
      [resp(BASE.showMissing())],
      {
        rule,
        expect: expectOf(BASE.showMissing(), true),
      },
    );
    twin.case.status[rule] = review;
    proc({
      id: `${rule}.valid`,
      rule,
      kind: "valid-twin",
      oracle: [ref(rule, "validTwin")],
      cases: [...ctxFor("show"), twin.case],
      notes:
        "Group R: an undetectable case stays not_run with a reason; the valid twin cannot pass from shape.",
    });
    const negative = runCase(
      "subject",
      "command",
      ["show", "n-1", "--json"],
      [resp(BASE.showSchema())],
      {
        rule,
        touched: ["observed"],
      },
    );
    fail(negative.case, rule);
    proc({
      id: `${rule}.negative`,
      rule,
      kind: "negative",
      oracle: [ref(rule, "negative")],
      cases: [...ctxFor("show"), negative.case],
      excluded: negative.excluded,
      message: [V, "SCHEMA_INVALID_INPUT"],
      notes:
        "show declares SCHEMA_INVALID_INPUT declared-unreachable; a run that reaches it is detectable.",
    });
  }
}

// ----- input grammar -------------------------------------------------------
const OK = {
  find: () => BASE.findOk(),
  show: () => BASE.showOk(),
  preview: () => BASE.previewOk(),
  apply: () => BASE.applyOk(),
  list: () => BASE.listOk(),
};
const USAGE = {
  find: () => BASE.findUsage(),
  show: () => BASE.showUsage(),
  preview: () => BASE.previewUsage(),
  apply: () =>
    envelope(
      result("apply", "USAGE_INVALID_INVOCATION"),
      "The apply invocation is invalid.",
    ),
  list: () => BASE.listUsage(),
};

// One argv case: twin (correct target) and negative (wrong target).
function grammar(rule, label, key, argv, accepted, opts = {}) {
  const {
    oracle,
    cdMutate,
    wrongCd,
    main = false,
    notes,
    expectEnv,
    badEnv,
    probe,
    badProbe,
    state,
  } = opts;
  const good = expectEnv ?? (accepted ? OK[key]() : USAGE[key]());
  const bad = badEnv ?? (accepted ? USAGE[key]() : OK[key]());
  const expect = expectOf(good, true);
  const cdCase = () => {
    if (cdMutate === undefined) return ctxCd(key);
    const env = BASE.cd(key);
    cdMutate(env.result.data);
    return {
      name: `cd-${key}`,
      role: "command-discovery",
      target: { captured: { stdout: bytesOf(env) } },
      rules: ["json-framing", "version-malformed", "strict-keys"],
    };
  };
  const ctxKeys = [
    ...new Set([
      key,
      KEY_OF[good.result.commandIdentity],
      KEY_OF[bad.result.commandIdentity],
    ]),
  ].filter((k) => k !== key);
  const build = (response, wrongTarget, schemaWrong) => {
    const c = runCase("subject", "command", argv, [response], {
      rule,
      expect,
      touched: wrongTarget ? ["observed"] : [],
      probe,
      state,
    });
    const cd = schemaWrong ? cdCase() : ctxCd(key);
    return {
      cases: [ctxDiscovery(), cd, ...ctxKeys.map((k) => ctxCd(k)), c.case],
      excluded: c.excluded,
      subject: c.case,
    };
  };
  const name = label === "" ? "" : `.${label}`;
  const twinOracle = oracle ?? [];
  {
    const twin = build(resp(good, { state: opts.goodState }), false, false);
    proc({
      id: `${rule}.valid${name}`,
      rule,
      kind: main ? "valid-twin" : "variation-valid",
      oracle: main ? [ref(rule, "validTwin"), ...twinOracle] : twinOracle,
      cases: twin.cases,
      notes,
      provisional: opts.provisional,
    });
  }
  if (opts.twinOnly) return;
  const schemaWrong = cdMutate !== undefined;
  const targetWrong = wrongCd !== "only-schema";
  const negative = build(
    targetWrong
      ? resp(bad, { state: opts.badState })
      : resp(good, { state: opts.goodState }),
    targetWrong,
    schemaWrong,
  );
  if (badProbe !== undefined) negative.subject.probe = badProbe;
  fail(negative.subject, rule);
  proc({
    id: `${rule}.negative${name}`,
    rule,
    kind: main ? "negative" : "variation-negative",
    oracle: main ? [ref(rule, "negative"), ...twinOracle] : twinOracle,
    cases: negative.cases,
    excluded: negative.excluded,
    message: [V],
    notes,
    provisional: opts.provisional,
  });
}

function inputGrammar() {
  let rule = "input-case";
  grammar(rule, "", "find", ["find", "--json", "abc", "--color=red"], false, {
    main: true,
    notes:
      "Interpretation: the specimen's parser accepts --name=value, which INPUT-2 forbids and the projection cannot express.",
  });
  grammar(
    rule,
    "color-separate-value",
    "find",
    ["find", "--json", "abc", "--color", "red"],
    true,
    { twinOnly: true, oracle: [ref(rule, "validTwin")] },
  );
  grammar(
    rule,
    "schema-only-wrong",
    "find",
    ["find", "--json", "abc", "--label", "abc"],
    true,
    {
      oracle: [variation(rule, 0)],
      cdMutate: (data) => {
        data.input.options.find((o) => o.name === "--label").value.maxLength =
          2;
      },
      wrongCd: "only-schema",
      notes:
        "Projection says --label is at most 2 code points; parser and independent case accept abc.",
    },
  );
  grammar(
    rule,
    "parser-only-wrong",
    "find",
    ["find", "--json", "abc", "--label", "abc"],
    true,
    {
      oracle: [variation(rule, 1)],
    },
  );
  grammar(
    rule,
    "both-wrong",
    "find",
    ["find", "--json", "abc", "--label", "abc"],
    true,
    {
      oracle: [variation(rule, 2)],
      cdMutate: (data) => {
        data.input.options.find((o) => o.name === "--label").value.maxLength =
          2;
      },
      notes:
        "Projection and parser agree on maxLength 2; the independent case still expects acceptance.",
    },
  );

  rule = "input-required";
  grammar(rule, "", "find", ["find", "--json"], false, {
    main: true,
    oracle: [variation(rule, 0)],
  });
  grammar(rule, "present", "find", ["find", "--json", "abc"], true, {
    twinOnly: true,
    oracle: [ref(rule, "validTwin")],
  });
  grammar(
    rule,
    "missing-required-option.preview",
    "preview",
    ["preview", "--json"],
    false,
    { oracle: [variation(rule, 0)] },
  );
  grammar(
    rule,
    "missing-required-option.apply",
    "apply",
    ["apply", "--json", "--note", "x"],
    false,
    { oracle: [variation(rule, 0)] },
  );
  grammar(
    rule,
    "extra-operand",
    "find",
    ["find", "--json", "abc", "docs", "extra"],
    false,
    { oracle: [variation(rule, 1)] },
  );

  rule = "input-option";
  grammar(rule, "", "find", ["find", "--json", "abc", "--lim", "5"], false, {
    main: true,
    oracle: [variation(rule, 1)],
  });
  grammar(
    rule,
    "declared",
    "find",
    ["find", "--json", "abc", "--limit", "5"],
    true,
    { twinOnly: true, oracle: [ref(rule, "validTwin")] },
  );
  grammar(rule, "alias", "find", ["find", "--json", "abc", "-n", "5"], true, {
    oracle: [ref(rule, "validTwin")],
  });
  grammar(
    rule,
    "unknown",
    "find",
    ["find", "--json", "abc", "--colour", "red"],
    false,
    { oracle: [variation(rule, 0)] },
  );
  grammar(rule, "bundle", "find", ["find", "--json", "abc", "-ef"], false, {
    oracle: [variation(rule, 2)],
  });
  grammar(
    rule,
    "equals",
    "find",
    ["find", "--json", "abc", "--color=red"],
    false,
    { oracle: [variation(rule, 3)] },
  );
  grammar(
    rule,
    "missing-value",
    "find",
    ["find", "--json", "abc", "--color"],
    false,
    { oracle: [variation(rule, 4)] },
  );

  rule = "input-presence";
  grammar(
    rule,
    "",
    "find",
    ["find", "--json", "abc", "docs", "--exact", "true"],
    false,
    {
      main: true,
      oracle: [variation(rule, 1)],
      notes:
        "term and scope are filled, so true is an extra operand, never a flag value.",
    },
  );
  grammar(rule, "present", "find", ["find", "--json", "abc", "--exact"], true, {
    twinOnly: true,
    oracle: [ref(rule, "validTwin")],
  });
  grammar(
    rule,
    "repeated",
    "find",
    ["find", "--json", "abc", "--exact", "--exact"],
    false,
    { oracle: [variation(rule, 0)] },
  );
  grammar(
    rule,
    "repeatable-declaration",
    "find",
    ["find", "--json", "abc", "--exact"],
    true,
    {
      oracle: [variation(rule, 2)],
      cdMutate: (data) => {
        data.input.options.find((o) => o.name === "--exact").repeatable = true;
      },
      wrongCd: "only-schema",
    },
  );

  rule = "input-repeat";
  const stateProbe = (expectedStdout) => ({
    state: "state.log",
    expectedStdout,
  });
  grammar(
    rule,
    "",
    "find",
    ["find", "--json", "abc", "--tag", "x", "--tag", "y"],
    true,
    {
      main: true,
      probe: stateProbe("tag=x\ntag=y\n"),
      state: "state.log",
      goodState: "tag=x\ntag=y\n",
      badEnv: BASE.findOk(),
      badState: "tag=y\ntag=x\n",
      oracle: [variation(rule, 1)],
      provisional: ["probe-for-parsed-values"],
      notes:
        "G9: order is visible only through the D2 probe reading what the specimen parsed.",
    },
  );
  grammar(
    rule,
    "repeated-nonrepeatable",
    "find",
    ["find", "--json", "abc", "--color", "red", "--color", "blue"],
    false,
    { oracle: [variation(rule, 0)] },
  );

  rule = "input-string";
  const strings = [
    [
      "",
      ["--label", "a\u{1F600}b"],
      true,
      [variation(rule, 1)],
      "a, one astral code point and b are 3 code points (4 UTF-16 units).",
    ],
    ["max", ["--label", "abc"], true, [variation(rule, 0)]],
    ["min", ["--label", "a"], true, [variation(rule, 0)]],
    ["below-min", ["--label", ""], false, [variation(rule, 0)]],
    ["above-max", ["--label", "abcd"], false, [variation(rule, 0)]],
    ["choice-red", ["--color", "red"], true, [variation(rule, 2)]],
    ["choice-green", ["--color", "green"], true, [variation(rule, 2)]],
    ["choice-blue", ["--color", "blue"], true, [variation(rule, 2)]],
    ["nonchoice", ["--color", "purple"], false, [variation(rule, 2)]],
    ["pattern-full", ["--code", "abc"], true, [variation(rule, 3)]],
    [
      "pattern-substring",
      ["--code", "abc1"],
      false,
      [variation(rule, 3)],
      "[a-z]+ matches a substring of abc1 but not the full string.",
    ],
  ];
  for (const [label, extra, accepted, oracle, notes] of strings) {
    grammar(
      rule,
      label,
      "find",
      ["find", "--json", "abc", ...extra],
      accepted,
      { main: label === "", oracle, notes },
    );
  }

  rule = "input-integer";
  const integers = [
    ["", "01", false, [variation(rule, 2)]],
    ["max", "100", true, [variation(rule, 0)]],
    ["min-negative", "-5", true, [variation(rule, 0), variation(rule, 1)]],
    ["above-max", "101", false, [variation(rule, 0)]],
    ["below-min", "-6", false, [variation(rule, 0)]],
    ["empty", "", false, [variation(rule, 2)]],
    ["float", "1.5", false, [variation(rule, 2)]],
    ["infinity", "Infinity", false, [variation(rule, 2)]],
    ["unsafe", "9007199254740993", false, [variation(rule, 2)]],
    ["plus", "+5", false, [variation(rule, 2)]],
  ];
  for (const [label, value, accepted, oracle] of integers) {
    grammar(
      rule,
      label,
      "find",
      ["find", "--json", "abc", "--limit", value],
      accepted,
      { main: label === "", oracle },
    );
  }

  rule = "input-constraints";
  grammar(
    rule,
    "",
    "find",
    ["find", "--json", "abc", "--exact", "--fuzzy"],
    false,
    { main: true, oracle: [variation(rule, 1)] },
  );
  grammar(
    rule,
    "satisfied",
    "find",
    ["find", "--json", "abc", "--since", "a", "--until", "b"],
    true,
    { twinOnly: true, oracle: [ref(rule, "validTwin")] },
  );
  grammar(
    rule,
    "requires-missing",
    "find",
    ["find", "--json", "abc", "--until", "b"],
    false,
    { oracle: [variation(rule, 0)] },
  );

  rule = "input-hidden";
  grammar(rule, "", "show", ["show", "--json", "latest"], false, {
    main: true,
    oracle: [variation(rule, 1)],
    notes:
      "latest fails the declared pattern n-[0-9]+; a hidden special keyword would accept it.",
  });
  grammar(rule, "declared", "show", ["show", "--json", "n-1"], true, {
    twinOnly: true,
    oracle: [ref(rule, "validTwin")],
  });
  grammar(
    rule,
    "custom-escape",
    "find",
    ["find", "--json", "abc", "--code", "@codes"],
    false,
    { oracle: [variation(rule, 2)] },
  );
  grammar(rule, "hidden-default", "find", ["find", "--json", "abc"], true, {
    oracle: [variation(rule, 0)],
    probe: stateProbe("color=\n"),
    state: "state.log",
    goodState: "color=\n",
    badEnv: BASE.findOk(),
    badState: "color=red\n",
    provisional: ["probe-for-parsed-values"],
    notes:
      "G9: an absent optional option must stay absent for the handler; the probe shows what the specimen parsed.",
  });

  rule = "input-dash";
  grammar(rule, "", "find", ["find", "--json", "abc", "--limit", "-5"], true, {
    main: true,
  });
  grammar(
    rule,
    "dash-operand-before-delimiter",
    "find",
    ["find", "--json", "-abc"],
    false,
    { oracle: [variation(rule, 0)] },
  );
  grammar(
    rule,
    "dash-operand-after-delimiter",
    "find",
    ["find", "--json", "--", "-abc"],
    true,
    { oracle: [variation(rule, 0)] },
  );
  grammar(
    rule,
    "json-after-delimiter",
    "find",
    ["find", "--json", "--", "--json"],
    true,
    { oracle: [variation(rule, 1)] },
  );
  grammar(
    rule,
    "identity-before-operand",
    "show",
    ["show", "--json", "--", "list"],
    false,
    {
      oracle: [variation(rule, 2)],
      badEnv: BASE.listOk(),
      notes:
        "The canonical identity is specimen.show before list is parsed as noteId, which then fails its pattern.",
    },
  );

  rule = "input-deadline";
  const dispatchUsage = () =>
    envelope(
      result("dispatch", "USAGE_INVALID_INVOCATION"),
      "--deadline-ms needs a positive integer.",
    );
  grammar(
    rule,
    "",
    "list",
    ["list", "--json", "--deadline-ms", "5000"],
    false,
    {
      main: true,
      oracle: [variation(rule, 2)],
      notes:
        "B1: the command itself refuses --deadline-ms when it declares no deadline support.",
    },
  );
  grammar(
    rule,
    "supported",
    "apply",
    ["apply", "--json", "--preview", "pv-7f3a", "--deadline-ms", "5000"],
    true,
    { oracle: [variation(rule, 0)] },
  );
  for (const [label, tail] of [
    ["zero", ["0"]],
    ["noninteger", ["1.5"]],
    ["missing-value", []],
  ]) {
    grammar(
      rule,
      label,
      "apply",
      ["apply", "--json", "--preview", "pv-7f3a", "--deadline-ms", ...tail],
      false,
      {
        oracle: [variation(rule, 1)],
        expectEnv: dispatchUsage(),
        badEnv: BASE.applyOk(),
        notes:
          "B1: a malformed deadline value is refused by specimen.dispatch.",
      },
    );
  }
}

// ----- deterministic fields ------------------------------------------------
function deterministic() {
  const rule = "deterministic-fields";
  const listAt = (runId, generatedAt, notes = ["n-1", "n-2"]) => {
    const env = BASE.listOk();
    env.result.runId = runId;
    env.result.data = { notes, generatedAt };
    return env;
  };
  const transientAt = (runId, delay, remaining = []) => {
    const env = BASE.applyTransient(delay);
    env.result.runId = runId;
    env.result.effects.remaining = remaining;
    return env;
  };
  const build = (first, second, { normalize, key }) => {
    const argv =
      key === "list"
        ? ["list", "--json"]
        : ["apply", "--preview", "pv-7f3a", "--json"];
    const shared = { counter: "det.counter", tableName: "target" };
    const a = runCase("first", "command", argv, [resp(first), resp(second)], {
      ...shared,
      station: true,
    });
    const b = runCase("second", "command", argv, [resp(first), resp(second)], {
      ...shared,
      rule,
      station: true,
    });
    b.case.sameAs = "first";
    if (normalize !== undefined) b.case.normalize = normalize;
    return [ctxDiscovery(), ctxCd(key), a.case, b.case];
  };
  const time = ["/result/data/generatedAt"];
  proc({
    id: `${rule}.valid`,
    rule,
    kind: "valid-twin",
    oracle: [ref(rule, "validTwin"), variation(rule, 3)],
    cases: build(
      listAt("run-0001", "2026-11-16T00:00:00Z"),
      listAt("run-0002", "2026-11-16T00:00:05Z"),
      { normalize: time, key: "list" },
    ),
    notes:
      "Two separately admitted runs of one target; the counter selects the response, so only runId and the declared time field differ.",
  });
  const negs = [
    [
      "",
      listAt("run-0001", "2026-11-16T00:00:00Z"),
      listAt("run-0002", "2026-11-16T00:00:05Z", ["n-1"]),
      time,
      "list",
      [ref(rule, "negative"), variation(rule, 0)],
      "data",
    ],
    [
      "effects",
      transientAt("run-0001", 500),
      transientAt("run-0002", 500, ["note.write"]),
      undefined,
      "apply",
      [variation(rule, 1)],
      "effects",
    ],
    [
      "recovery",
      transientAt("run-0001", 500),
      transientAt("run-0002", 750),
      undefined,
      "apply",
      [variation(rule, 2)],
      "retryDelayMilliseconds",
    ],
  ];
  for (const [label, first, second, normalize, key, oracle, violated] of negs) {
    const cases = build(first, second, { normalize, key });
    fail(cases.at(-1), rule);
    proc({
      id: `${rule}.negative${label === "" ? "" : `.${label}`}`,
      rule,
      kind: label === "" ? "negative" : "variation-negative",
      oracle,
      cases,
      message: [V, violated],
    });
  }
  const refused = build(
    transientAt("run-0001", 500),
    transientAt("run-0002", 500, ["note.write"]),
    { normalize: ["/result/effects"], key: "apply" },
  );
  proc({
    id: `${rule}.negative.normalize-outside-data`,
    rule,
    kind: "variation-negative",
    oracle: [variation(rule, 3)],
    cases: refused,
    admissionRefusal: ["/result/effects"],
    notes:
      "LIFE-14: only run identity and genuine time normalize. The admission is refused before any target runs.",
  });
}

// ----- pattern budget ------------------------------------------------------
export const HOSTILE = "(a+)+b";
export const HOSTILE_SUBJECT = "a".repeat(40);

export function patternCases(pattern, subject, { counter, cdMaxLength } = {}) {
  const cd = BASE.cd("find");
  const code = cd.result.data.input.options.find(
    (o) => o.name === "--code",
  ).value;
  code.pattern = pattern;
  if (cdMaxLength !== undefined) code.maxLength = cdMaxLength;
  const cdRun = runCase(
    "cd-find",
    "command-discovery",
    ["--discover-command", ident("find"), "--json"],
    [resp(cd)],
    {
      expect: expectOf(cd, true),
      station: false,
      counter,
      extraRules: ["pattern-syntax"],
    },
  );
  return { cd: cdRun.case, argv: ["find", "--json", "abc", "--code", subject] };
}

function patternBudget() {
  const rule = "pattern-budget";
  const benign = patternCases("[a-z]+", "abc");
  const twin = runCase(
    "subject",
    "command",
    benign.argv,
    [resp(BASE.findOk())],
    {
      rule,
      expect: expectOf(BASE.findOk(), true),
    },
  );
  proc({
    id: `${rule}.valid`,
    rule,
    kind: "valid-twin",
    oracle: [ref(rule, "validTwin")],
    cases: [ctxDiscovery(), benign.cd, twin.case],
  });
  const hostile = patternCases(HOSTILE, HOSTILE_SUBJECT);
  const negative = runCase(
    "subject",
    "command",
    hostile.argv,
    [resp(BASE.findUsage())],
    {
      rule,
      expect: expectOf(BASE.findUsage(), true),
    },
  );
  fail(negative.case, rule);
  proc({
    id: `${rule}.negative`,
    rule,
    kind: "negative",
    oracle: [ref(rule, "negative")],
    verification: ["V-44"],
    cases: [ctxDiscovery(), hostile.cd, negative.case],
    message: [V],
    notes: `Pattern ${HOSTILE} against 40 a characters backtracks exponentially; the checker must stop at PATTERN_MAX_MS and refuse.`,
  });
}

// ----- effect probes (group F) ---------------------------------------------
function effectProbes() {
  const probe = (expectedStdout = "") => ({
    state: "state.log",
    expectedStdout,
  });
  const f = (
    rule,
    label,
    role,
    argv,
    good,
    bad,
    badState,
    oracle,
    negOracle,
    notes,
    extra = {},
  ) =>
    pair({
      rule,
      label,
      role,
      argv,
      good: resp(good),
      bad: resp(bad, { state: badState }),
      expect: expectOf(good, true),
      oracle,
      negOracle,
      ctxKeys: extra.ctxKeys ?? null,
      station: extra.station ?? false,
      probe: probe(),
      state: "state.log",
      notes,
      touched: extra.touched ?? ["observed"],
    });

  f(
    "navigation-effects",
    "",
    "discovery",
    ["--discover", "--json"],
    BASE.discovery(),
    BASE.discovery(),
    "provider.init\n",
    [ref("navigation-effects", "validTwin")],
    [ref("navigation-effects", "negative")],
    "The negative prints valid discovery but writes provider.init to state; only the probe sees it.",
    { touched: ["probe"] },
  );

  const providerFail = envelope(
    {
      ...result("discovery", "SUCCESS_UNCHANGED", { data: null }),
      outcome: "refused",
      causeCode: "DOMAIN_PRECONDITION_UNMET",
      failureClass: "domain",
      exitCode: 3,
      data: null,
      repairAction: "Configure provider credentials.",
      next: {
        kind: "instruction",
        text: "Configure provider credentials, then run discovery again.",
      },
    },
    "Provider credentials are missing.",
  );
  {
    const rule = "provider-loading";
    const env = { SPECIMEN_PROVIDER: "unavailable" };
    const runs = [
      ["help", "help", ["--help", "--json"], BASE.help()],
      ["list", "command", ["list", "--json"], BASE.listOk()],
      ["subject", "discovery", ["--discover", "--json"], BASE.discovery()],
    ];
    const build = (subjectEnv, broken) =>
      runs.map(([name, role, argv, good]) =>
        runCase(
          name,
          role,
          argv,
          [resp(name === "subject" ? subjectEnv : good)],
          {
            rule,
            expect: expectOf(good, true),
            station: false,
            env,
            probe: probe(),
            state: "state.log",
            touched:
              name === "subject" && broken
                ? ["observed", "observedStation"]
                : [],
          },
        ),
      );
    const twin = build(BASE.discovery(), false);
    proc({
      id: `${rule}.valid`,
      rule,
      kind: "valid-twin",
      oracle: [ref(rule, "validTwin")],
      cases: twin.map((r) => r.case),
      notes:
        "SPECIMEN_PROVIDER=unavailable stands for denied provider access; help, discovery and an unrelated command still succeed.",
    });
    const negative = build(providerFail, true);
    fail(negative.at(-1).case, rule);
    proc({
      id: `${rule}.negative`,
      rule,
      kind: "negative",
      oracle: [ref(rule, "negative")],
      cases: negative.map((r) => r.case),
      excluded: negative.at(-1).excluded,
      message: [V],
    });
  }

  f(
    "input-future-binding",
    "",
    "command",
    ["preview", "--note", "list", "--json"],
    BASE.previewUsage(),
    BASE.previewInternalCompleted(),
    "preview.record\n",
    [ref("input-future-binding", "validTwin")],
    [ref("input-future-binding", "negative")],
    "--note becomes binding note in the apply step; list equals a route token (STEP-10), so it is refused before any effect. Binder reading: an argv value fault is USAGE_INVALID_INVOCATION (INPUT-2, CMD-9 step 3).",
    { ctxKeys: ["preview"], station: true, touched: ["observed", "probe"] },
  );
  f(
    "input-generated-binding",
    "",
    "command",
    ["preview", "--note", "first draft", "--json"],
    BASE.previewInternalUnchanged(),
    BASE.previewInternalCompleted(),
    "preview.record\n",
    [ref("input-generated-binding", "validTwin")],
    [ref("input-generated-binding", "negative")],
    "SPECIMEN_FAULT=generated-id makes the specimen's generated previewId invalid; validation at creation fails before preview.record. Binder reading: INTERNAL_RESULT_UNCHANGED.",
    { ctxKeys: ["preview"], station: true, touched: ["observed", "probe"] },
  );
  f(
    "input-runtime",
    "",
    "command",
    ["apply", "--preview", "pv-missing", "--json"],
    BASE.applyMissing(),
    BASE.applyOk(),
    "audit.write\nindex.write\nnote.write\n",
    [ref("input-runtime", "validTwin")],
    [ref("input-runtime", "negative")],
    "pv-missing is syntactically valid; the resource does not exist, so the command must refuse with no effect.",
    { ctxKeys: ["apply"], station: true, touched: ["observed", "probe"] },
  );
}

// ----- version classification and format cases ----------------------------
export const v2Envelope = () => ({
  contractVersion: "2.0.0",
  envelopeVersion: 2,
  message: "Listed 2 notes.",
  availablePaths: ALL_IDS,
  result: {
    runId: "run-0001",
    commandIdentity: ident("list"),
    outcome: "success",
    effectClass: "inspect",
    transactionState: "unchanged",
    causeCode: "SUCCESS_UNCHANGED",
    failureClass: null,
    exitCode: 0,
    data: { notes: ["n-1", "n-2"] },
    retryable: false,
    repairAction: null,
    effects: {
      completed: [],
      remaining: [],
      uncertain: [],
      inventoryComplete: true,
    },
    nextAction: "No further action required.",
  },
});

const ORDERED = ["version-malformed", "version-major", "version-newer"];
const blocked = {
  not_run:
    "blocked: version refusal; no other key of a refused version is interpreted (VER-10)",
};

export function versionCase(
  name,
  stdout,
  failing,
  { counter, plain = false } = {},
) {
  const upTo =
    failing === null ? ORDERED : ORDERED.slice(0, ORDERED.indexOf(failing) + 1);
  const rules = ["json-framing", ...upTo, "machine-stderr"];
  const status = {};
  if (failing !== null) {
    status[failing] = { failed: finding(failing) };
    rules.push("strict-keys", "presence", "exit-envelope");
    for (const r of ["strict-keys", "presence", "exit-envelope"])
      status[r] = blocked;
  } else if (!plain) {
    rules.push("strict-keys", "presence", "exit-envelope");
  }
  return {
    name,
    role: "command",
    mode: "machine",
    target: {
      run: {
        argv: ["list", "--json"],
        responses: [{ stdout, stderr: "", exit: 0 }],
        counter,
      },
    },
    rules,
    status,
  };
}

const LATER = (failing) =>
  Object.fromEntries(
    ORDERED.slice(ORDERED.indexOf(failing) + 1).map((r) => [
      r,
      "classification stops at the first refused class (VER-10 order); a later class is not admitted",
    ]),
  );

function versions() {
  const valid = bytesOf(BASE.listOk());
  bind({
    id: "version.valid.production",
    rule: "version-malformed",
    kind: "valid-twin",
    oracle: [
      ref("version-malformed", "validTwin"),
      ref("version-major", "validTwin"),
    ],
    verification: ["V-16", "V-17"],
    cases: [versionCase("subject", valid, null)],
    message: [V],
    notes: "Production reader 3.0.0 accepts 3.0.0 without adaptation.",
  });
  const withVersion = (value, present = true) => {
    const env = BASE.listOk();
    if (present) env.contractVersion = value;
    else delete env.contractVersion;
    return bytesOf(env);
  };
  const malformed = [
    ["null", null],
    ["number-3", 3],
    ["two-part", "3.0"],
    ["patch-nonzero", "3.0.1"],
    ["leading-zero", "03.0.0"],
    ["prerelease", "3.0.0-beta"],
    ["build", "3.0.0+build"],
    ["whitespace", " 3.0.0 "],
  ];
  malformed.forEach(([label, value], index) => {
    const main = value === "3.0.1";
    bind({
      id: main ? "version-malformed.negative" : `format.malformed.${label}`,
      rule: "version-malformed",
      kind: main ? "negative" : "format-case",
      oracle: [
        ...(main ? [ref("version-malformed", "negative")] : []),
        `formatCases/malformed/values/${index}`,
      ],
      verification: ["V-16", "V-17"],
      cases: [versionCase("subject", withVersion(value), "version-malformed")],
      excluded: LATER("version-malformed"),
      message: ["contractVersion", JSON.stringify(value)],
    });
  });
  bind({
    id: "format.malformed.missing",
    rule: "version-malformed",
    kind: "format-case",
    oracle: ["formatCases/malformed/missingValueAlso"],
    verification: ["V-16", "V-17"],
    cases: [
      versionCase("subject", withVersion(null, false), "version-malformed"),
    ],
    excluded: LATER("version-malformed"),
    message: ["contractVersion", "null"],
  });
  ["2.0.0", "1.0.0", "4.1.2"].forEach((value, index) => {
    const main = value === "2.0.0";
    const stdout = main ? bytesOf(v2Envelope()) : withVersion(value);
    bind({
      id: main ? "version-major.negative" : `format.other-major.${value}`,
      rule: "version-major",
      kind: main ? "negative" : "format-case",
      oracle: [
        ...(main
          ? [
              ref("version-major", "negative"),
              "additionalControls/kept-tool-route",
            ]
          : []),
        `formatCases/other-major/values/${index}`,
      ],
      verification: ["V-16", "V-17"],
      cases: [versionCase("subject", stdout, "version-major")],
      excluded: LATER("version-major"),
      message: main ? [value, RETAINED_WRAPPER, RETAINED_COMMIT] : [value],
      notes: main
        ? "A well-formed Contract 2.0 envelope (envelopeVersion and nextAction). The refusal names the kept checker route from retained-2.json and never invokes it."
        : undefined,
    });
  });
  {
    const broken2 = {
      contractVersion: "2.0.0",
      envelopeVersion: 2,
      result: { nextAction: "Run it again.", profile: "simple" },
    };
    bind({
      id: "control.classification-before-shape",
      rule: "version-major",
      kind: "control-negative",
      oracle: ["additionalControls/classification-before-shape"],
      verification: ["V-16"],
      cases: [versionCase("subject", bytesOf(broken2), "version-major")],
      excluded: LATER("version-major"),
      message: ["2.0.0", RETAINED_WRAPPER],
      notes:
        "2.0.0 plus keys invalid under 3.0 stays an unsupported major; nothing is read as 3.0.",
    });
  }
  bind({
    id: "version-newer.negative.production-3.1.0",
    rule: "version-newer",
    kind: "variation-negative",
    oracle: [ref("version-newer", "negative"), "formatCases/newer-minor"],
    verification: ["V-16"],
    cases: [versionCase("subject", withVersion("3.1.0"), "version-newer")],
    message: ["3.1.0", "3.0.0"],
    notes:
      "D3 condition 3: the production reader refuses the fixture minor as newer.",
  });
  {
    const broken = BASE.listOk();
    delete broken.result;
    const c = versionCase("subject", bytesOf(broken), null, { plain: true });
    c.rules.push("presence");
    c.status.presence = { failed: finding("presence") };
    bind({
      id: "format.broken-supported",
      rule: "presence",
      kind: "format-case",
      oracle: ["formatCases/broken-supported/values/0"],
      verification: ["V-16"],
      cases: [c],
      message: [V, "result"],
      notes:
        "The internal finding code is presence's KEY_PRESENCE; no code field appears in the refusal.",
    });
  }
}

export function processBindings() {
  streamsAndExits();
  navigation();
  inputGrammar();
  deterministic();
  patternBudget();
  effectProbes();
  versions();
}

export { clone };
