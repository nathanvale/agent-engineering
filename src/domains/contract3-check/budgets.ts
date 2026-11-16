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
  // Linux must show the same ordering (see the Phase 2b implementer's handback).
  PATTERN_MAX_MS: 250,
  MESSAGE_MAX_BYTES: 2_048,
  FINDING_MESSAGE_MAX_BYTES: 512,
  OBSERVED_VALUE_ECHO_MAX_CHARS: 64,
} as const;

/**
 * Checker-owned timing constants that are not admission budgets (not in
 * BUDGETS.json). One owner, so no number is restated elsewhere.
 */
export const TIMINGS = {
  /** First stop signal: force-kill a running target before the 500 ms bound (LIFE-3, LIFE-11). */
  STOP_SIGNAL_FORCE_MS: BUDGETS.TARGET_KILL_GRACE_MS - 100,
  /** Upper bound on a pattern Worker starting at all; startup is excluded from PATTERN_MAX_MS. */
  WORKER_START_MAX_MS: 5_000,
  /**
   * Fail closed (S2): a non-match that took at least this long is treated as
   * budget exhaustion, because JavaScriptCore reports a false non-match when
   * its own backtracking cutoff fires. Benign anchored matches take far less.
   */
  PATTERN_FAIL_CLOSED_MS: BUDGETS.PATTERN_MAX_MS / 2,
} as const;
