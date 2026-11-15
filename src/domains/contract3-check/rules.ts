// The checker's own rule catalogue: identity, finding code, proof layer and
// the judge that owns each rule (INTERFACE.md section 9). Identities and
// codes are frozen by tests/contract3/checker-expectations.json; a static
// test compares this table with that oracle.

export type ProofLayer = "version" | "shape" | "process" | "static" | "review";

export type RuleGroup =
  | "version"
  | "envelope"
  | "declaration"
  | "cross"
  | "process"
  | "effect"
  | "review"
  | "harness"
  | "static";

export interface RuleSpec {
  id: string;
  findingCode: string;
  proofLayer: ProofLayer;
  group: RuleGroup;
}

const TABLE: readonly (readonly [string, string, ProofLayer, RuleGroup])[] = [
  ["version-malformed", "VERSION_MALFORMED", "version", "version"],
  ["version-major", "VERSION_UNSUPPORTED_MAJOR", "version", "version"],
  ["version-newer", "VERSION_UNSUPPORTED_MINOR", "version", "version"],
  ["declared-minor-shape", "DECLARED_MINOR_SHAPE", "shape", "envelope"],
  ["version-copy", "VERSION_COPY_MISMATCH", "shape", "envelope"],
  ["json-framing", "OUTPUT_FRAMING", "shape", "envelope"],
  ["machine-stderr", "MACHINE_STDERR_NOT_EMPTY", "process", "process"],
  ["strict-keys", "UNLISTED_KEY", "shape", "envelope"],
  ["presence", "KEY_PRESENCE", "shape", "envelope"],
  ["result-correlation", "RESULT_CORRELATION", "shape", "envelope"],
  ["effect-inventory", "EFFECT_INVENTORY", "shape", "envelope"],
  ["guidance-arm", "GUIDANCE_ARM", "shape", "envelope"],
  ["retry-kind", "RETRY_KIND", "shape", "envelope"],
  ["done-outcome", "DONE_OUTCOME", "shape", "envelope"],
  ["exit-expected", "EXPECTED_EXIT_MISMATCH", "process", "process"],
  ["cause-expected", "EXPECTED_CAUSE_MISMATCH", "process", "process"],
  ["exit-envelope", "ENVELOPE_EXIT_MISMATCH", "process", "process"],
  ["builtins", "BUILTIN_NOT_DECLARED", "process", "process"],
  ["station-observed", "UNDECLARED_STATION", "process", "process"],
  ["station-required", "REQUIRED_STATION_UNOBSERVED", "process", "process"],
  ["station-duplicate", "STATION_DUPLICATE", "shape", "declaration"],
  ["step-target", "STEP_TARGET_UNDECLARED", "shape", "cross"],
  ["inspection-target", "INSPECTION_TARGET_MUTATES", "shape", "cross"],
  ["lost-result-missing", "IF_NO_RESULT_MISSING", "shape", "declaration"],
  ["lost-result-target", "IF_NO_RESULT_TARGET", "shape", "declaration"],
  ["guidance-template", "GUIDANCE_TEMPLATE_MISMATCH", "shape", "cross"],
  ["template-token", "TEMPLATE_TOKEN_UNKNOWN", "shape", "envelope"],
  ["binding-keys", "BINDING_KEYS", "shape", "envelope"],
  ["binding-value", "BINDING_VALUE", "shape", "envelope"],
  ["available-target", "AVAILABLE_PATH_UNDECLARED", "shape", "cross"],
  ["available-order", "AVAILABLE_PATH_ORDER", "shape", "envelope"],
  ["input-case", "INPUT_CASE_MISMATCH", "process", "process"],
  ["step-arguments", "STEP_ARGUMENTS_INVALID", "shape", "cross"],
  ["pattern-budget", "PATTERN_BUDGET_EXCEEDED", "process", "process"],
  ["human-discovery", "HUMAN_DISCOVERY_INVALID", "process", "process"],
  ["navigation-effects", "NAVIGATION_EFFECT", "process", "effect"],
  ["no-replay", "TARGET_REPLAYED", "process", "harness"],
  [
    "deterministic-fields",
    "DETERMINISTIC_RESULT_CHANGED",
    "process",
    "process",
  ],
  ["metadata-values", "METADATA_VALUE", "shape", "envelope"],
  ["json-values", "JSON_VALUE_INVALID", "shape", "envelope"],
  ["effects-sets", "EFFECT_SET_INVALID", "shape", "envelope"],
  ["effects-state", "EFFECT_STATE_MISMATCH", "shape", "envelope"],
  ["attempted-effect", "ATTEMPTED_EFFECT_INVALID", "shape", "envelope"],
  ["failure-data", "FAILURE_DATA_PRESENT", "shape", "envelope"],
  ["retry-delay", "RETRY_DELAY_INVALID", "shape", "cross"],
  ["handoff-shape", "HANDOFF_INVALID", "shape", "envelope"],
  ["closed-union", "CLOSED_MEMBER_UNKNOWN", "shape", "envelope"],
  ["open-cause", "HOST_CAUSE_REJECTED", "process", "process"],
  ["retry-policy", "RETRY_POLICY_INVALID", "shape", "declaration"],
  ["station-fixed", "STATION_FIXED_FIELD_MISMATCH", "shape", "cross"],
  ["unreachable-review", "UNREACHABLE_UNJUSTIFIED", "review", "review"],
  ["help-discovery", "HELP_DISCOVERY_MISMATCH", "process", "process"],
  ["discovery-metadata", "DISCOVERY_METADATA_INVALID", "shape", "declaration"],
  ["command-selection", "COMMAND_DISCOVERY_SELECTION", "process", "process"],
  ["dispatch", "DISPATCH_MISMATCH", "process", "process"],
  ["root-routes", "ROOT_ROUTE_INVALID", "shape", "declaration"],
  ["global-mode", "GLOBAL_MODE_MISMATCH", "process", "process"],
  ["provider-loading", "NAVIGATION_PROVIDER_REQUIRED", "process", "effect"],
  ["lost-result-inspect", "INSPECT_IF_NO_RESULT", "shape", "declaration"],
  [
    "lost-result-literals",
    "IF_NO_RESULT_LITERAL_INVALID",
    "shape",
    "declaration",
  ],
  ["binding-placement", "BINDING_PLACEMENT", "shape", "envelope"],
  ["binding-route", "BINDING_ROUTE_TOKEN", "shape", "cross"],
  ["token-argv", "TOKEN_ARGV_BOUNDARY", "process", "process"],
  ["input-schema", "INPUT_SCHEMA_INVALID", "shape", "declaration"],
  ["input-required", "INPUT_REQUIRED_MISMATCH", "process", "process"],
  ["input-option", "INPUT_OPTION_MISMATCH", "process", "process"],
  ["input-presence", "INPUT_PRESENCE_MISMATCH", "process", "process"],
  ["input-repeat", "INPUT_REPETITION_MISMATCH", "process", "process"],
  ["input-string", "INPUT_STRING_MISMATCH", "process", "process"],
  ["input-integer", "INPUT_INTEGER_MISMATCH", "process", "process"],
  ["input-constraints", "INPUT_CONSTRAINT_MISMATCH", "process", "process"],
  ["input-hidden", "INPUT_UNDECLARED_GRAMMAR", "process", "process"],
  ["input-dash", "INPUT_DELIMITER_MISMATCH", "process", "process"],
  ["input-deadline", "INPUT_DEADLINE_MISMATCH", "process", "process"],
  ["input-future-binding", "FUTURE_BINDING_TOO_LATE", "process", "effect"],
  [
    "input-generated-binding",
    "GENERATED_BINDING_TOO_LATE",
    "process",
    "effect",
  ],
  ["input-runtime", "RUNTIME_VALIDATION_BYPASSED", "process", "effect"],
  ["pattern-syntax", "PATTERN_SYNTAX_INVALID", "shape", "declaration"],
  ["pattern-isolation", "PATTERN_ISOLATION_MISSING", "process", "harness"],
  ["minor-remove", "MINOR_REMOVES_KEY", "static", "static"],
  ["minor-rename", "MINOR_RENAMES_KEY", "static", "static"],
  ["minor-required", "MINOR_REQUIRES_KEY", "static", "static"],
  ["minor-meaning", "MINOR_CHANGES_MEANING", "review", "review"],
  ["minor-cause", "MINOR_ADDS_COMMON_CAUSE", "static", "static"],
  ["fallback-version", "FALLBACK_VERSION_INVALID", "shape", "envelope"],
  ["source-agreement", "CONTRACT_TABLE_DRIFT", "static", "static"],
  ["snippet-status", "SNIPPET_PROOF_MISSING", "static", "static"],
  [
    "diagnostics-available",
    "DIAGNOSTICS_AVAILABLE_INVALID",
    "shape",
    "envelope",
  ],
  [
    "diagnostics-unavailable",
    "DIAGNOSTICS_UNAVAILABLE_INVALID",
    "shape",
    "envelope",
  ],
  ["diagnostics-absent", "DIAGNOSTICS_UNDECLARED", "process", "process"],
  ["observer-exclusions", "OBSERVATION_EXCLUSION_HIDDEN", "process", "harness"],
  ["retained-tooling", "RETAINED_2_ROUTE_CHANGED", "static", "static"],
  ["raw-retention", "RAW_RETENTION_ENABLED", "process", "harness"],
];

const RULES: readonly RuleSpec[] = TABLE.map(
  ([id, findingCode, proofLayer, group]) => ({
    id,
    findingCode,
    proofLayer,
    group,
  }),
);

const BY_ID = new Map(RULES.map((rule) => [rule.id, rule]));

export function ruleSpec(id: string): RuleSpec | undefined {
  return BY_ID.get(id);
}

/** Groups this command never judges; their rows belong to another owner. */
export const NOT_COMMAND_JUDGED: Readonly<Record<string, string>> = {
  harness: "the checker's process test harness",
  static: "the repository static tests",
};
