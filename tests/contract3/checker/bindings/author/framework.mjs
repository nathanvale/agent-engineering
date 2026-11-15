// fallow-ignore-file unused-file -- binder authoring source; run by hand to regenerate bindings, never imported by product or test code
// fallow-ignore-file boundary-violation -- binder authoring source outside every boundary zone by design
//
// Binding framework: rule footprints, applicability, case assembly and the
// expected-file shape. Written by the independent binder.
import { BASE, CMD, ORDER, bytesOf, clone } from "./model.mjs";

const ORACLE = JSON.parse(
  await Bun.file(
    new URL("../../../checker-expectations.json", import.meta.url),
  ).text(),
);
export const RULES = Object.fromEntries(ORACLE.rules.map((r) => [r.id, r]));

export const TARGET = "../../../specimens/target.mjs";
export const PROBE = "../../../specimens/probe.mjs";

// Interface section 9 groups.
const GROUPS = {
  V: ["version-malformed", "version-major", "version-newer"],
  E: [
    "declared-minor-shape",
    "version-copy",
    "json-framing",
    "strict-keys",
    "presence",
    "result-correlation",
    "effect-inventory",
    "guidance-arm",
    "retry-kind",
    "done-outcome",
    "metadata-values",
    "json-values",
    "effects-sets",
    "effects-state",
    "attempted-effect",
    "failure-data",
    "handoff-shape",
    "closed-union",
    "fallback-version",
    "diagnostics-available",
    "diagnostics-unavailable",
    "template-token",
    "binding-keys",
    "binding-value",
    "binding-placement",
    "available-order",
  ],
  D: [
    "station-duplicate",
    "retry-policy",
    "discovery-metadata",
    "root-routes",
    "lost-result-missing",
    "lost-result-target",
    "lost-result-inspect",
    "lost-result-literals",
    "input-schema",
    "pattern-syntax",
  ],
  X: [
    "step-target",
    "inspection-target",
    "guidance-template",
    "available-target",
    "station-fixed",
    "binding-route",
    "retry-delay",
    "step-arguments",
  ],
  P: [
    "machine-stderr",
    "exit-expected",
    "cause-expected",
    "exit-envelope",
    "builtins",
    "station-observed",
    "station-required",
    "input-case",
    "human-discovery",
    "help-discovery",
    "command-selection",
    "dispatch",
    "global-mode",
    "token-argv",
    "deterministic-fields",
    "diagnostics-absent",
    "pattern-budget",
    "open-cause",
    "input-required",
    "input-option",
    "input-presence",
    "input-repeat",
    "input-string",
    "input-integer",
    "input-constraints",
    "input-hidden",
    "input-dash",
    "input-deadline",
  ],
  F: [
    "navigation-effects",
    "provider-loading",
    "input-future-binding",
    "input-generated-binding",
    "input-runtime",
  ],
  R: ["unreachable-review", "minor-meaning"],
  H: ["no-replay", "pattern-isolation", "observer-exclusions", "raw-retention"],
  T: [
    "minor-remove",
    "minor-rename",
    "minor-required",
    "minor-cause",
    "source-agreement",
    "snippet-status",
    "retained-tooling",
  ],
};
export const GROUP_OF = Object.fromEntries(
  Object.entries(GROUPS).flatMap(([g, ids]) => ids.map((id) => [id, g])),
);
if (Object.keys(GROUP_OF).length !== 93) {
  throw new Error(`group table covers ${Object.keys(GROUP_OF).length} rules`);
}
for (const id of Object.keys(RULES)) {
  if (GROUP_OF[id] === undefined) throw new Error(`ungrouped rule ${id}`);
}

// What each command-judged rule reads. A negative never admits a rule whose
// footprint meets the tags its mutation touches (BINDINGS.md, prerequisite
// model rule 4). Over-approximation only removes sentinels.
export const FOOT = {
  "json-framing": ["framing"],
  "version-malformed": ["version"],
  "version-major": ["version"],
  "version-newer": ["version"],
  "strict-keys": ["keyset"],
  presence: ["keyset", "null"],
  "result-correlation": [
    "outcome",
    "state",
    "class",
    "exit",
    "retryable",
    "cause",
    "arm",
    "delay",
    "next",
    "data",
  ],
  "effect-inventory": ["effectClass", "state", "effects"],
  "guidance-arm": ["arm"],
  "retry-kind": ["retryable", "next"],
  "done-outcome": ["next", "outcome"],
  "metadata-values": ["strings", "integers"],
  "json-values": ["values", "depth"],
  "effects-sets": ["effects"],
  "effects-state": ["state", "effects", "outcome"],
  "attempted-effect": ["attempted", "effects", "outcome"],
  "failure-data": ["data", "outcome"],
  "handoff-shape": ["handoff"],
  "closed-union": ["vocab", "next", "handoff", "diagnostics"],
  "available-order": ["available"],
  "diagnostics-available": ["diagnostics"],
  "diagnostics-unavailable": ["diagnostics"],
  "step-target": ["next"],
  "inspection-target": ["handoff"],
  "guidance-template": [
    "next",
    "handoff",
    "repair",
    "bindings",
    "arm",
    "templates",
    "outcome",
    "cause",
    "identity",
  ],
  "available-target": ["available"],
  "station-fixed": [
    "outcome",
    "state",
    "class",
    "exit",
    "retryable",
    "cause",
    "effectClass",
    "stationRetry",
    "repair",
    "templates",
    "arm",
    "identity",
  ],
  "binding-route": ["bindings", "next"],
  "retry-delay": [
    "retryable",
    "delay",
    "stationRetry",
    "outcome",
    "cause",
    "identity",
  ],
  "step-arguments": ["next", "bindings", "input"],
  "binding-keys": ["bindings", "templates", "outcome", "cause", "identity"],
  "binding-value": ["bindings"],
  "version-copy": ["versionCopy"],
  "discovery-metadata": ["discoveryMeta"],
  "root-routes": ["discoveryCommands"],
  "station-duplicate": ["stations"],
  "retry-policy": ["stationRetry"],
  "lost-result-missing": ["ifNoResult"],
  "lost-result-target": ["ifNoResult", "discoveryCommands"],
  "lost-result-inspect": ["ifNoResult"],
  "lost-result-literals": ["ifNoResult"],
  "input-schema": ["input"],
  "pattern-syntax": ["pattern", "input"],
  "template-token": ["templates"],
  "binding-placement": ["templates"],
  "machine-stderr": ["stderr"],
  "exit-envelope": ["realExit"],
  "exit-expected": ["observed", "realExit"],
  "cause-expected": ["observed"],
  "station-observed": ["observedStation"],
};

const ENV_RULES = [
  "json-framing",
  "version-malformed",
  "version-major",
  "version-newer",
  "strict-keys",
  "presence",
  "result-correlation",
  "effect-inventory",
  "guidance-arm",
  "retry-kind",
  "done-outcome",
  "metadata-values",
  "json-values",
  "effects-sets",
  "effects-state",
  "attempted-effect",
  "failure-data",
  "handoff-shape",
  "closed-union",
  "available-order",
  "diagnostics-available",
  "diagnostics-unavailable",
];
const X_RULES = [
  "step-target",
  "inspection-target",
  "guidance-template",
  "available-target",
  "station-fixed",
  "retry-delay",
  "step-arguments",
  "binding-keys",
  "binding-value",
  "binding-route",
];
const DISC_RULES = ["version-copy", "discovery-metadata", "root-routes"];
const CD_RULES = [
  "station-duplicate",
  "retry-policy",
  "lost-result-missing",
  "lost-result-target",
  "lost-result-inspect",
  "lost-result-literals",
  "input-schema",
  "pattern-syntax",
  "template-token",
  "binding-placement",
];

const hasBindingToken = (value) => JSON.stringify(value).includes("{binding.");

// A rule is admitted only where the case holds the element it judges; no
// binding relies on a vacuous pass (BINDINGS.md).
function applies(rule, env) {
  const r = env.result;
  const data = r.data;
  switch (rule) {
    case "effect-inventory":
      return r.effectClass === "inspect";
    case "done-outcome":
      return r.next?.kind === "done";
    case "attempted-effect":
      return r.attemptedEffect !== undefined;
    case "failure-data":
      return r.outcome !== "success";
    case "handoff-shape":
      return r.handoff !== undefined;
    case "available-order":
      return env.availablePaths.length >= 2;
    case "diagnostics-available":
      return env.diagnostics?.status === "available";
    case "diagnostics-unavailable":
      return env.diagnostics?.status === "unavailable";
    case "step-target":
      return r.next?.kind === "command";
    case "step-arguments":
      return r.next?.kind === "command";
    case "inspection-target":
      return (r.handoff?.inspect ?? []).some((e) => e.kind === "command");
    case "binding-value":
    case "binding-route":
      return r.bindings !== undefined;
    case "lost-result-missing":
    case "lost-result-target":
      return data.command.effectClass !== "inspect";
    case "lost-result-inspect":
      return data.command.effectClass === "inspect";
    case "lost-result-literals":
      return data.ifNoResult !== null;
    case "pattern-syntax":
      return JSON.stringify(data.input).includes('"pattern":"');
    case "binding-placement":
      return hasBindingToken(data.stations);
    default:
      return true;
  }
}

export function candidates(role, env, { cross = true } = {}) {
  const base = ENV_RULES.filter((rule) => applies(rule, env));
  if (role === "discovery") return [...base, ...DISC_RULES];
  if (role === "command-discovery") {
    return [...base, ...CD_RULES.filter((rule) => applies(rule, env))];
  }
  if (role === "help") return base;
  if (!cross) return base;
  return [...base, ...X_RULES.filter((rule) => applies(rule, env))];
}

const SAFE_FROM_WILDCARD = new Set(["framing", "version", "available"]);

export function admit(target, pool, touched) {
  const rules = [target];
  const excluded = {};
  for (const rule of pool) {
    if (rule === target) continue;
    const foot = FOOT[rule] ?? [];
    const hit = touched.includes("*")
      ? foot.filter((tag) => !SAFE_FROM_WILDCARD.has(tag))
      : foot.filter((tag) => touched.includes(tag));
    if (hit.length > 0) {
      excluded[rule] = `reads ${hit.join(", ")}, which this mutation changes`;
    } else {
      rules.push(rule);
    }
  }
  return { rules, excluded };
}

export const KEY_OF = Object.fromEntries(
  ORDER.map((key) => [CMD[key].identity, key]),
);

export const DISC_CTX = [
  "json-framing",
  "version-malformed",
  "strict-keys",
  "version-copy",
  "discovery-metadata",
  "root-routes",
];
export const CD_CTX = [
  "json-framing",
  "version-malformed",
  "strict-keys",
  "station-duplicate",
  "retry-policy",
  "input-schema",
];

export const ctxDiscovery = () => ({
  name: "discovery",
  role: "discovery",
  target: { shared: "discovery" },
  rules: DISC_CTX,
});
export const ctxCd = (key) => ({
  name: `cd-${key}`,
  role: "command-discovery",
  target: { shared: `cd-${key}` },
  rules: CD_CTX,
});

export const SHARED = {
  discovery: bytesOf(BASE.discovery()),
  help: bytesOf(BASE.help()),
  ...Object.fromEntries(
    ORDER.map((key) => [`cd-${key}`, bytesOf(BASE.cd(key))]),
  ),
};

export const BINDINGS = [];
export const STOPPED = [];

export function bind(spec) {
  if (BINDINGS.some((b) => b.id === spec.id)) {
    throw new Error(`duplicate binding ${spec.id}`);
  }
  BINDINGS.push(spec);
}

export const deepClone = clone;

export function finding(rule) {
  const code = RULES[rule]?.findingCode;
  if (code === undefined) throw new Error(`unknown rule ${rule}`);
  return code;
}
