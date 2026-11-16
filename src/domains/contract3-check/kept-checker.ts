// The kept Contract 2.0 checker's actual route (ROLL-4, ROLL-5, VER-13).
// Restated from tests/contract3/retained-2.json wrapperRoute; the
// retained-tooling static test compares these values with that oracle.
// The 3.0 checker names this route and never invokes it.

const KEPT_CHECKER = {
  repository: "dotfiles",
  commit: "29bf4bb0f307f96d396aa087472a4dbed849c920",
  wrapperPath:
    "config/agents/plugins/my-second-brain-playground/bin/cli-design-check",
  runtimeEntry: "runtime/cli-design-check.js",
  wrapperBlob: "7bdc6dd22b4097076801188979e5a686fc124e48",
} as const;

export function keptCheckerRoute(): string {
  return `the kept Contract 2.0 checker: ${KEPT_CHECKER.repository} ${KEPT_CHECKER.wrapperPath} at ${KEPT_CHECKER.commit}, which runs ${KEPT_CHECKER.runtimeEntry}`;
}
