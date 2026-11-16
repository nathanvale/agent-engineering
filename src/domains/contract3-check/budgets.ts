// Finite budgets named in INTERFACE.md section 10, restated from the
// independent binder's tests/contract3/checker/bindings/BUDGETS.json
// (budgetsVersion 1; reasons in BINDINGS.md). A static test compares them.
// Changing a number here is a reviewed edit, never a test fix.

export const BUDGETS = {
  ADMISSION_MAX_BYTES: 1_048_576,
  ADMISSION_MAX_CASES: 256,
  TARGET_STDOUT_MAX_BYTES: 1_048_576,
  TARGET_STDERR_MAX_BYTES: 65_536,
  TARGET_JSON_MAX_DEPTH: 64,
  TARGET_RUN_MAX_MS: 5_000,
  TARGET_KILL_GRACE_MS: 500,
  PATTERN_MAX_SOURCE_BYTES: 4_096,
  PATTERN_MAX_SUBJECT_BYTES: 4_096,
  // Below JavaScriptCore's own backtracking cutoff (about 400 ms on the
  // implementer's Mac), which reports a false non-match rather than failing.
  // Linux must show the same ordering (see the Phase 2b handoff).
  PATTERN_MAX_MS: 250,
  MESSAGE_MAX_BYTES: 2_048,
  FINDING_MESSAGE_MAX_BYTES: 512,
  OBSERVED_VALUE_ECHO_MAX_CHARS: 64,
} as const;
