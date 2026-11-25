---
status: proposed
---

# Where agent copies live

## Context and problem

Agents create copies of repositories on a development machine throughout normal work: linked Git worktrees for branches, standalone clones for reviews or builds, `node_modules` trees, package caches, virtual environments, and test-run folders. Without a shared rule for where each kind of copy belongs and when it leaves, copies accumulate wherever a job happened to run.

A local census on the maintainer's machine found 168 Git copies (8.0 GB) inside the text-only coordination folder, 341 clones (about 29 GB) elsewhere in `$XDG_STATE_HOME`, 1,364 copies (49 GB) in `/tmp`, and 52 registered Git worktrees outside `<repo>/.worktrees/`. Copies accumulated silently until disk space ran low.

The three agent harnesses disagree on worktree placement and offer no clone-location setting. Claude Code places worktrees in `<repo>/.claude/worktrees/` unless a hook redirects them. Codex supports one global worktree root, and a relative setting breaks `codex --worktree` while no absolute path produces `<repo>/.worktrees/<name>`. Antigravity provides no worktree setting, flag, or hook.

Decision question: where should every kind of agent copy live, how long should it stay, who removes it, and how should all three harnesses keep copies bounded without losing work?

## Decision drivers

1. **No lost work.** Never delete uncommitted changes, untracked files, stashes, unpushed local refs, sibling files in a temp folder, or paths claimed by an active or paused ADR 0002 lease.
2. **Bounded disk with early warning.** Keep copies inside known homes with clear lifecycles, size lines, and guard checks so disk growth surfaces before a drive fills.
3. **One pattern across three harnesses.** Serve Claude Code, Codex, and Antigravity from one documented rule set using native harness levers and one pointer line, without copied prose.
4. **Trust boundaries (ADR 0001).** Keep private copies in `0700` folders and out of synced folders, keep run evidence text-only, and keep public documentation free of private tool names or machine paths.
5. **Sandbox fit.** Place throwaway copies inside the system temp directory, which all three harness sandboxes already allow.
6. **Findability.** Give every kind of copy one predictable home so the maintainer and agents can locate any copy and tell whether it is still needed.

## Considered options

- **Option A.** Define one lifecycle and one home for each of ten copy kinds, enforce placement at creation through harness levers, and verify afterwards with a read-only guard (`copy-home check`).
- **Option B.** Keep each harness's default folders and rely on periodic manual disk sweeps.
- **Option C.** Put all agent copies into one central copies folder governed by a single age limit.

## Decision

**Decision authority:** The maintainer.

We propose **Option A** because it satisfies all six decision drivers.

### One home per kind

| Kind | Maker | Home | Time to live | Cleanup trigger | Check |
| --- | --- | --- | --- | --- | --- |
| 1. Task worktree | Agent through the shared worktree runtime or `git worktree add <path>`, and Claude Code through its hook | `<repo>/.worktrees/<name>`, real path of the main checkout | Until its branch merges | Maker after merge | Guard `stray-worktree` |
| 2. Tool-owned worktree | A tool that cannot be redirected | Its registered tool-owned home | The tool's own | The tool | Guard lists it `ok` |
| 3. Throwaway clone | Worker or coordinator using `git clone` from the forge or `--no-local` | A `mktemp -d` folder in the temp folder | The job, at most 72 hours | Maker's last step after saving evidence, or coordinator for a build clone | Guard `expired-throwaway` |
| 4. Bulk copy (`node_modules`, package cache, venv, project tree) | Installers and tools | Inside the copy it serves, or a shared package cache at the tool's default | With its copy | With its copy | Guard `stray-copy` |
| 5. Cached mirror | A first-party command | `$XDG_CACHE_HOME/my-agent-dojo/<command>/` | While the command uses it | The command | Guard `stray-copy` anywhere else |
| 6. Test-run folder | Test harness and tools that follow `TMPDIR` | Inside a `mktemp -d` run folder with children's `TMPDIR` inside it | The run | Harness on any exit, deregistering its worktrees | Guard `expired-throwaway`, `dangling-registration` |
| 7. Session scratchpad | The harness | The harness's scratch folder, notes only | The harness's own | The harness | Guard `stray-copy` |
| 8. Run evidence | Coordinators and workers | `$XDG_STATE_HOME/my-agent-dojo/agent-coordination/{personal,open-source}/runs/<date-slug>/`, text only | ADR 0002 | ADR 0002 | Guard `stray-copy` |
| 9. Download or archive | Any agent | Its own new `mktemp -d` folder | The job | Maker | Prose only |
| 10. Remote or container copy | Cloud sessions and dev containers | Their own host, same layout inside | The host's own | The host | Outside this guard |

### Rules across kinds

- **Who deletes.** The maker deletes its own copy at its last step (or at the cleanup trigger in the table above). Everything else belongs to the maintainer on the guard's report. This ADR authorizes no automatic deletion.
- **Loss check.** The loss check gives advice to the maintainer and never grants permission to delete. The checked unit is the copy's folder, or for a throwaway copy the whole `mktemp -d` folder.
  - `work-found`: an uncommitted or untracked change, a stash, a local ref (branch, tag, detached `HEAD`, or other `refs/*`) whose commit no tip on the remote itself contains, or a non-stopped ADR 0002 lease claiming a path in the unit.
  - `unknown`, with the reason: remote tips not read live with `git ls-remote`, a remote whose effective URL (after `insteadOf`) is not a network URL, a remote tip missing locally, unreadable leases, a project tree without Git, or any other file in the unit outside a copy (ignored files included).
  - `node_modules`, package caches, and venvs count as nothing to lose on their own, but each Git copy inside them gets its own loss check.
  - `nothing-found`: reported only when neither `work-found` nor `unknown` applies.
- **Temp homes are not durable.** macOS clears `/tmp` at restart and `$TMPDIR` after about 3 days. The loss check shows the maintainer what is at risk before the operating system removes it.
- **Privacy.** Private-repository copies stay in `0700` folders and never sit inside a cloud-synced folder (such as a synced documents folder).
- **Disk budget.** Each home gets a size line and an early warning before it fills. The machine-setup repository configures those thresholds.
- **Named exceptions.** Each exception covers one copy only, never the copies nested inside it, and carries a reason. This public ADR names tools and machine folders by role only.

### Harness levers

Settings, hooks, and instruction pointers are applied in the machine-setup repository:

- **Claude Code.** Keep the `WorktreeCreate` and `WorktreeRemove` hooks. A `PreToolUse` shell check refuses `git worktree add` outside a task worktree home and refuses `git clone` into a no-copy home. Claude Code never removes hook-made subagent worktrees, so the guard reports them.
- **Codex.** Remove any relative `[desktop] git-worktree-root` setting because it breaks `codex --worktree`, and no absolute value produces `<repo>/.worktrees/<name>`. Agents use no Codex-managed worktree. They create the task worktree first, then start Codex inside it. The same shell check applies. A sandboxed Codex worker cannot commit because its `.git` directory is read-only, so its coordinator commits.
- **Antigravity.** No setting, flag, or worktree hook exists. Add a global instruction pointer and run the shell check on its shell tool. App-made worktrees are caught afterwards by the guard with no wrapper.
- **Prose.** Add one pointer line to ADR 0004 in each harness's global instruction file. Keep no copied rule text.

### Settled choices

The maintainer settled four implementation choices when accepting the specification:

1. **Tool-owned homes.** A third-party worktree manager's folder is an allowed tool-owned home. A vault tool's candidate worktrees folder is an allowed tool-owned home only until that tool retires with the old vault. Their disk size lines are configured in the machine-setup repository.
2. **Antigravity.** Rely on the guard check afterwards, plus the global instruction pointer and the shell check. Build no wrapper around the harness.
3. **Existing stray clones with work found or unknown.** Save each stray clone's uncommitted changes and unpushed commits as patch text, then move the folder to Trash on the maintainer's confirmation during cleanup.
4. **Guard command.** The read-only guard is the `copy-home check` command in `agent-engineering`.

## Consequences

- **Positive.** Every kind of agent copy has one predictable home and lifecycle. Throwaway copies live in system temp folders that all three sandboxes already permit. A single read-only guard (`copy-home check`) detects stray copies, expired throwaways, stray worktrees, dangling registrations, and incomplete scans, and reports loss risk without deleting anything.
- **Negative.** Antigravity app-made worktrees and Claude Code hook-made subagent worktrees are detected after creation rather than prevented or auto-removed. Codex agents cannot use `codex --worktree` and must enter a pre-created task worktree. The maintainer must still review and confirm cleanup of reported strays.
- **Neutral.** Concrete machine paths, disk thresholds, harness hooks, and private tool-owned folder mappings stay in the machine-setup repository rather than in this public ADR.

## Options and tradeoffs

### Driver comparison matrix

| Driver | Option A (lifecycle per kind + levers + guard) | Option B (harness defaults + disk sweep) | Option C (one central copies folder + age limit) |
| --- | --- | --- | --- |
| No lost work | Strong. The maker deletes only after saving evidence. The guard is read-only with live remote and lease loss checks. | Weak. Manual sweeps under disk pressure invite hasty deletion without loss checks. | Weak. A single age limit risks deleting long-lived worktrees or unpushed work. |
| Bounded disk with early warning | Strong. Size lines and guard checks surface strays and expired throwaways early. | Fails. Defaults produced 8.0 GB in coordination state and 49 GB in `/tmp` before anyone noticed. | Moderate. Bounds one folder, but misses copies created outside it. |
| One pattern across three harnesses | Strong. Native levers plus one pointer line and one guard cover all three harnesses. | Fails. Each harness scatters copies into its own incompatible default folder. | Weak. Forces overrides that Codex and Antigravity cannot express cleanly. |
| Trust boundaries (ADR 0001) | Strong. Separates text-only coordination state, `0700` private copies, and public role-only docs. | Fails. Copies routinely land inside coordination and state folders. | Partial. Mixes different lifecycles and copy kinds in one folder. |
| Sandbox fit | Strong. Throwaways use system temp folders that all three sandboxes already allow. | Partial. Defaults work in-place but leak into state folders. | Fails. A central folder sits outside default sandbox roots. |
| Findability | Strong. One home per kind and `<repo>/.worktrees/<name>` keep task branches next to their repository. | Weak. Copies scatter across `.claude/worktrees/`, Codex roots, state folders, and `/tmp`. | Weak. Breaks `<repo>/.worktrees/` and survives restart unlike `/tmp`. |

### Option A

- **Good.** Preserves `<repo>/.worktrees/<name>`, fits all three sandboxes, enforces text-only coordination folders, and pairs prevention where harnesses allow it with a read-only loss-aware guard.
- **Bad.** Requires maintaining one homes configuration file in the machine-setup repository and reviewing guard findings by hand.

### Option B

- **Good.** Requires no configuration, hooks, or guard command.
- **Bad.** Already produced unmanaged multi-gigabyte sprawl across coordination state, `$XDG_STATE_HOME`, and `/tmp`, with no early warning and no loss check.

### Option C

- **Good.** Uses one directory and one retention clock for all copies.
- **Bad.** Breaks `<repo>/.worktrees/`, sits outside default harness sandbox roots, survives restart (unlike `/tmp`), and treats active task worktrees the same as throwaway clones.

## Confirmation

### Design acceptance gate

- Independent cross-model review passes with zero P0 and zero P1 findings across this ADR and `GLOSSARY.md`.
- Automated privacy scan confirms zero local home paths and zero private tool or repository names in this ADR and `GLOSSARY.md` (AC-02).
- The maintainer explicitly approves transitioning status from `proposed` to `accepted`.

### Implementation confirmation

The `copy-home check` command in `agent-engineering` confirms this ADR through five acceptance checks:

- **AC-04 (red).** On a fixture tree with 20 planted violations, `copy-home check` exits non-zero and reports all 20 findings. These include 13 `stray-copy` findings (clones, `node_modules`, renamed bare repositories, package caches, venvs, project trees, copies nested inside an excepted repository or its `node_modules`, copies in a scratch root under temp, copies inside a main checkout, fake submodule pointers using `--separate-git-dir`, and unregistered clones inside `<repo>/.worktrees/`). They also include 3 `expired-throwaway` findings (stale clones, including ones nested in fresh outer clones or project trees), 2 `stray-worktree` findings (including `<repo>/.claude/worktrees/`), 1 `dangling-registration`, and 1 `scan-incomplete` for an unreadable folder. Valid copies report `ok`, including real submodules listed in `.gitmodules` and the index, and symlinked repositories with worktrees in their real `.worktrees/`.
- **AC-05 (green).** After removing planted strays and pruning worktrees, `copy-home check` reports zero findings and exits `0`.
- **AC-06 (loss check).** The loss fixture verifies `nothing-found`, `work-found`, and `unknown` across nine cases. Those cases cover a clean pushed clone, an untracked file, a stash, an unpushed branch commit, a commit only on a local tag, a branch deleted on the remote after fetch, an `insteadOf` rewrite to a local path, an unsaved sibling file beside the clone, and a paused ADR 0002 lease. Tests also confirm `unknown` when `--remote` is omitted or when a lease file is malformed.
- **AC-07 (read-only and owned).** Confirms `copy-home check` touches no files under scanned roots and that the test fixture builder reaps its folder and daemon even after `SIGKILL`.
- **AC-08 (harness defaults caught).** Runs Claude Code and Codex in an isolated home with no sign-in and confirms `copy-home check` flags both default worktrees (`<repo>/.claude/worktrees/` and `$CODEX_HOME/worktrees/`) as `stray-worktree`. Antigravity cannot be probed without a sign-in, and that gap is recorded.
- **Later probes (machine-setup and cleanup follow-ups).** Confirm live harness hooks, shell checks, global instruction pointers, disk size lines, Claude Code Desktop's worktree location and hook behavior, and a post-cleanup census rerun.

### Revisit triggers

- Codex gains a per-repository worktree location setting or hook.
- Antigravity gains a worktree location setting or hook.
- Per-domain VMs land, changing host-level isolation and temp-folder boundaries.

## References

- [ADR 0001: Local state and domain storage boundaries](0001-local-state-and-domain-storage-boundaries.md)
- [ADR 0002: Coordinator leases and retention](0002-coordinator-leases-and-retention.md)
- [Agent Engineering glossary](../../GLOSSARY.md)
