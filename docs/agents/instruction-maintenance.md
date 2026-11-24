# Instruction Maintenance

- Invoke `writing-for-agents` before changing `AGENTS.md`, `CLAUDE.md`, or a
  `SKILL.md`, or a document reached by their pointer.
- Write compactly: cut filler, not reasons. Keep the reason beside any
  constraint whose purpose is not obvious.
- One idea per bullet.
- Imperative voice.
- Use Markdown structure. Reserve XML tags for machine-parsed boundaries.
- Direct: lead with the action, boundary, owner, or check.
- Critical language: use `must`/`never` only for enforceable invariants; name
  the consequence or check.
- Keep the closest applicable instruction file as a trigger-bearing map. Put
  branch-only guidance in an owned guide file in the repository.
- Register each guide with a task trigger in that repository's guide index,
  reached from its `AGENTS.md`; add direct pointers only when a branch needs
  them.
- Preserve one source of truth. Point to it instead of copying its contract.
- Before editing, inspect the current owner and check for duplicate,
  contradictory, stale, or broader guidance.
- Before writing, show the exact path-limited change, startup-context delta,
  proof, and rollback. Ask for approval when the user did not explicitly request
  the change.
- Verify every changed pointer.

## Verification

- Check whitespace in the exact candidate diff and paths. Record its comparison
  base, end state (worktree, index or commit), pathspec and corresponding
  `git diff --check` arguments. Run the repository's installed formatter in check
  mode where it supports the changed format;
  record unsupported formats separately. Inspect every changed local pointer and
  heading anchor against that candidate. Record the checked paths and outcomes;
  formatting alone does not prove pointer validity.
- For installed startup links, run the owning setup tool's status check and
  inspect the stored targets and status, not only the exit code.
  A correct link does not prove that a running Harness loaded its content.
- Native loading proof follows the owner's evaluation procedure, whose grader
  tests qualify the grader, not a native run. Execute a
  bounded native canary only within its separate authority; retain unrun loading
  proof as incomplete.
- Before relying on a scheduled check, verify its live entry is enabled and its
  referenced executable or skill is available on this host. Record the entry and
  result. Keep file verification, installed-link readback and native loading as
  separate results.
