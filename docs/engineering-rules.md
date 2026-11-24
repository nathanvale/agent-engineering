# Engineering rules for coding agents

These baseline engineering rules govern coding agent sessions. They apply in every repository unless a closer instruction file says otherwise.

## Evidence and state

- Preserve unrelated user and agent changes.
- Keep secrets, tokens, credentials, and private values out of source and output.
- Test meaningful changes. State any proof gap instead of implying success.
- Evidence state: keep planned, implemented, tested, qualified, committed, pushed, merged, installed, activated, submitted, and released distinct. Report only the state current evidence proves.
- Mutable state: treat handoffs, packets, cached output, and prior observations as context, not authority. Refresh live state before acting or reporting.
- Unknown external outcome: inspect the exact target; retry only after live state proves the first attempt had no effect.

## Owners

- Follow the closest repository or directory instructions for the files being changed.
- Keep startup instructions to cross-project rules and sharp routes. Skills own workflows; code, CLI help, generated docs, and checks own deterministic contracts.
- Read the smallest sufficient owner. Point to it instead of copying its contract.
- Generated file: edit its named source, then regenerate the output.

## Git safety

- Never force-push, hard-reset, run `git clean -f`, restore the entire working tree, force-switch branches, or stage with `git add .` or `git add -A`. When Claude Code's `git-safety` hook is installed, it refuses these and prints the safer command.
- Dirty or untracked work: treat it as owned until proven disposable. Preserve it before removing a worktree or branch.
- Pull request body: write or revise it with the `pr` skill.

## Design and delegation

- Give capable agents maps, invariants, owner paths, inspectable state, and the next safe action.
- New tool or capability: search current dependencies and existing products for an owner before design. Record why reuse does not fit before custom implementation.
- Module, interface, or seam design: use `codebase-design` before implementation.
- Before the first edit, reconcile the request, accepted decisions, current diff, and named spec or handoff. State required outcomes, exclusions, and the stop boundary.
- Contradiction: outside a declared intentional RED step, stop when instructions, tests, and executable source disagree. Identify the authoritative owner and reconcile the mismatch before editing.
- Keep delegated work inside its named unit. Stop at its review, commit, or handoff boundary; start the next unit only with authority.
- Preserve every explicit requirement. Report missing proof as incomplete; never defer, narrow, or replace it because another path is easier or green.

## Failures and requirements

- Treat accepted decisions as settled. Reopen one only for direct contradiction or new high-consequence evidence.
- Use existing contract and discovery owners. Keep throwaway probes outside repositories; never invent placeholder commands, states, or interfaces to make a test pass.
- Every failure names its cause and its repair path, or the handoff replacing it.
