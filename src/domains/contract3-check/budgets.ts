// Finite budgets named in INTERFACE.md section 10.
// PROVISIONAL VALUES: the numbers are engineering placeholders until the
// independent binder fixes them (checker-expectations.json futureBindings,
// "T6 and T1"). Changing a number here is a reviewed edit, not a test fix.

export const BUDGETS = {
  ADMISSION_MAX_BYTES: 1_048_576,
  ADMISSION_MAX_CASES: 512,
  TARGET_STDOUT_MAX_BYTES: 1_048_576,
  TARGET_STDERR_MAX_BYTES: 65_536,
  TARGET_JSON_MAX_DEPTH: 64,
  TARGET_RUN_MAX_MS: 10_000,
  TARGET_KILL_GRACE_MS: 500,
  PATTERN_MAX_SOURCE_BYTES: 1_024,
  PATTERN_MAX_SUBJECT_BYTES: 4_096,
  // Below JavaScriptCore's own backtracking cutoff (about 400 ms on the
  // implementer's Mac), which reports a false non-match rather than failing.
  PATTERN_MAX_MS: 250,
  MESSAGE_MAX_BYTES: 2_048,
  FINDING_MESSAGE_MAX_BYTES: 512,
  OBSERVED_VALUE_ECHO_MAX_CHARS: 64,
} as const;
