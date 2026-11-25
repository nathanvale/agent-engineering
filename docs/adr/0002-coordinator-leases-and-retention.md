---
status: accepted
---

# Coordinator leases and retention

## Context and problem

Multiple coordinators can run concurrently on one host across personal and open-source work and across agent harnesses. Without host-wide exclusion, two differently named coordinators can claim the same repository branch, Git worktree, or localhost port and overwrite each other's work.

At the same time, local operational state grows without bound unless settled raw logs and stopped coordinator folders can be pruned safely. Deleting a run while a crash recovery case still depends on its evidence destroys auditability and blocks safe repair.

Decision question: how should concurrent coordinators acquire and release exclusive host-wide resource leases, and how should settled raw runs and stopped coordinator folders be retained or pruned without endangering recovery?

## Decision drivers

1. **Host-wide mutual exclusion.** Prevent two concurrent coordinators across personal or open-source work from silently claiming the same repository branch, Git worktree, or localhost port, including under simultaneous startup, pending-then-created worktree paths, and confirmed reclaim across folders.
2. **Crash and reboot safety.** Ensure transient acquisition locks clear automatically on process crash or reboot, while durable lease records survive reboot so active and paused work is never stolen silently.
3. **Human-gated reclaim.** Require explicit human confirmation before reclaiming resources held by an `active` or `paused` coordinator, even when its heartbeat is stale or its process has died.
4. **Recovery-first bounded retention.** Keep local state bounded over time while guaranteeing that unresolved recovery evidence is never pruned, even across mixed-work command stores or inspection errors, regardless of whether outcomes were already promoted.
5. **Contract 3 alignment.** Align locking mechanisms, canonical scope keys, and recovery journal discovery with `agent-cli-kernel` Command Contract 3 (`Admission lock` and `Journal` invariants) without overloading single-tool transaction stores with multi-hour coordinator lifecycles.

## Considered options

- **Option A.** Separate transient acquisition locking in `$XDG_RUNTIME_DIR` (reusing the `agent-cli-kernel` OS locking mechanism) from durable atomic `lease.json` records in `$XDG_STATE_HOME`, paired with kernel-aligned worktree key sets, atomic former-holder revocation on reclaim, fail-closed recovery-first 30-day `runs/` pruning keyed to `settled_at`, and a 30-day stopped-coordinator ceiling covering both promoted and unpromoted folders.
- **Option B.** Reuse `agent-cli-kernel`'s single-tool state store (`admission.lock`) directly for host-wide coordinator leases and retention.
- **Option C.** Keep uncoordinated per-coordinator `lease.json` files inside `$XDG_STATE_HOME` without a host-wide acquisition lock and prune runs by filesystem modification time after 30 days.

## Decision

**Decision authority:** Nathan (project maintainer).

We recommend **Option A** because it satisfies host-wide mutual exclusion, crash and reboot safety, human-gated reclaim, recovery-first bounded retention, and Contract 3 alignment.

The lease and hygiene commands (`acquire`, `heartbeat`, `stop`, `reclaim`, and `sweep`) belong to the `agent-coordination` command. Where that command lives is undecided. This ADR names no repository and no CLI owner for it.

### 1. Separation of runtime locks and durable leases

- **Transient acquisition lock (`$XDG_RUNTIME_DIR`).** Lease creation, heartbeat updates, status transitions, and reclaim acquire one host-wide exclusive lock at `<runtime>/my-agent-dojo/agent-coordination/coordinator-lease.lock`, where `<runtime>` is the first usable runtime directory (directory mode `0700`, lock file mode `0600`), using the same non-blocking OS locking mechanism qualified in `agent-cli-kernel` (`O_EXLOCK`, `O_NONBLOCK`, `O_CLOEXEC`, `O_NOFOLLOW` on Darwin; `flock(LOCK_EX | LOCK_NB)` with `O_CLOEXEC` and `O_NOFOLLOW` on Linux). Contended callers retry with bounded polling (default 2000 ms timeout, 10 ms interval) and return a structured `lock-busy` refusal if the bound expires. The lock is held only during conflict scanning and atomic lease writing, and the operating system releases it automatically on process exit or crash. **Runtime directory rule.** A candidate is usable only when `lstat` shows a real directory (not a symlink) owned by the effective user ID with mode `0700`. The command checks candidates in order: `$XDG_RUNTIME_DIR` when set and absolute; then on macOS `DARWIN_USER_TEMP_DIR` (`confstr` or `getconf`) and `$TMPDIR`; on Linux `/run/user/<uid>`. The first usable candidate wins. Using any candidate after `$XDG_RUNTIME_DIR` emits a warning, as XDG Base Directory Specification v0.8 requires. When no candidate is usable, the command refuses with a repairable diagnostic and never uses `$XDG_STATE_HOME` or a shared temp directory.
- **Durable coordinator lease (`$XDG_STATE_HOME`).** Each coordinator stores its durable lease at `$XDG_STATE_HOME/my-agent-dojo/agent-coordination/{personal,open-source}/coordinators/<slug>/lease.json` (mode `0600`). Every write creates a unique sibling temp file with `O_WRONLY`, `O_CREAT`, `O_EXCL`, and `O_NOFOLLOW` (mode `0600`), calls `fsync`, atomically renames over `lease.json`, and calls `fsync` on the parent directory. Storing `lease.json` in `$XDG_STATE_HOME` ensures active and paused claims survive logout and reboot for recovery.

### 2. Lease schema, claim exclusivity, and cross-side conflict discovery

Each `lease.json` (schema version `1`) records:

- Identity: `domain` (`personal` or `open-source`), `coordinator_slug`, `conversation_id`, `harness` (`antigravity` | `codex` | `claude-code` | `other`), `host`, `pid` (number or `null` when no local process ID applies).
- Liveness, promotion, and lifecycle: `started_at`, `updated_at` (heartbeat timestamp), `stopped_at` (timestamp or `null`), `promoted_at` (timestamp or `null`), `promoted_to` (string or `null`), `reclaimed_by` (object recording `{ domain, coordinator_slug, conversation_id, reclaimed_at }` or `null`), `stale_after_seconds` (default `1800`), `status` (`active` | `paused` | `stopped`), and `reclaim_policy` (enumerated; default and sole automatic policy `"confirm-active-and-paused"`).
- Resource claims:
  - `repos`: canonical repository identifiers touched by the coordinator (shared read access is allowed; exclusivity applies to branches and worktrees).
  - `branches`: repository-scoped pairs `{ repo_id, branch }` (exclusive host-wide).
  - `worktrees`: entries `{ path, keys }` where `keys` is the canonical key set produced by `agent-cli-kernel`'s `pathKeys()` algorithm: for an existing path, both `inode:<dev>:<ino>` and `name:<parentdev>:<parentino>/<folded-basename>` after symlink resolution and NFC case folding; for a pending path that does not yet exist, `name:<ancestor-dev>:<ancestor-ino>/<folded-remaining-path>` anchored to the nearest existing ancestor after resolving ancestor symlinks. At conflict scan time, each stored worktree entry also re-evaluates fresh `pathKeys(path)` and unions them with its stored `keys`; any non-empty key-set intersection is a conflict. This catches pending-then-created races, symlink aliases, and case-insensitive volume aliases.
  - `ports`: host-scoped pairs `{ host: "127.0.0.1" | "::1", port }` (exclusive host-wide).

While holding the runtime acquisition lock, the acquiring coordinator scans only the machine-local `lease.json` metadata files across `$XDG_STATE_HOME/my-agent-dojo/agent-coordination/*/coordinators/*/lease.json` within the same OS user's `0700` boundary. It never reads the other side's wikis, notes, handoffs, or run logs. Any filesystem read or parse error other than `ENOENT` fails closed rather than treating an unreadable lease as absent. Inside per-domain Linux VMs, only that VM's side directory exists, so the same scan stays single-side automatically.

### 3. Lifecycle, staleness, orphan detection, and reclaim rules

- **`active`.** Holds all declared `branches`, `worktrees`, and `ports` exclusively. No other coordinator may acquire an overlapping resource without explicit human confirmation.
- **`paused`.** Retains all declared `branches`, `worktrees`, and any still-declared `ports` exclusively so paused work cannot be silently overwritten. Reclaiming a `paused` lease requires explicit human confirmation under `confirm-active-and-paused`. A coordinator may release ephemeral localhost ports before transitioning to `paused` by removing them from `ports`.
- **`stopped`.** Sets `stopped_at` and releases all resource claims immediately. A `stopped` lease never blocks new acquisitions.
- **Atomic cross-folder reclaim and heartbeat guard.** When a human confirms reclaim (whether inside the same coordinator folder or from another coordinator folder or side), the acquiring coordinator holds the runtime acquisition lock and atomically transitions every confirmed overlapping former holder's `lease.json` to `status: "stopped"` (`stopped_at` and `reclaimed_by` populated) before writing the replacement `lease.json`. Heartbeat updates to `updated_at` also run under the acquisition lock and verify that `lease.json` still belongs to the caller's `conversation_id` and is not `stopped`. A stale live process whose lease was reclaimed is refused and cannot overwrite the new owner or stay live beside it.
- **Staleness and orphan detection.** A non-stopped lease is flagged as `stale` during conflict inspection when `now - updated_at > stale_after_seconds` or when `host` matches the current host, `pid` is non-null, and `kill(pid, 0)` reports the process is gone. Staleness is reported to the operator as diagnostic evidence (`heartbeat-expired` or `pid-not-running`) with a repair command; it never authorizes silent takeover.

### 4. Recovery-first retention and pruning

- **Recovery protection overrides promotion.** A run directory at `$XDG_STATE_HOME/my-agent-dojo/agent-coordination/{personal,open-source}/runs/<date-slug>/` is never eligible for pruning while any unresolved recovery case references it, even if its outcomes were already promoted.
- **Authoritative recovery references and fail-closed inspection.** Before marking any run eligible for pruning, the hygiene check inspects two machine-readable sources:
  1. A local marker file `runs/<date-slug>/RECOVERY-OPEN.json` (mode `0600`, holding `recovery_id`, `run_id`, `opened_at`, `owner`, `reason`), written when a recovery case opens and removed only by the recovery owner once closure is verified.
  2. Explicit scoped Command Contract 3 operation references recorded in `runs/<date-slug>/run-status.json` as `operations: [{ tool, domain, store_root, operation_id }]`. `store_root` is the absolute Contract 3 store root the command used for that operation, recorded when the operation runs. The journal is at `<store_root>/operations/<operation_id>`. For a first-party command, `store_root` is under `$XDG_STATE_HOME/my-agent-dojo/<command>/` (or `$XDG_STATE_HOME/my-agent-dojo/<command>/personal/` and `$XDG_STATE_HOME/my-agent-dojo/<command>/open-source/` when the command serves both sides). For a command whose store still sits at a shipped legacy root, it is under `$XDG_STATE_HOME/<command>/` (or `$XDG_STATE_HOME/<command>/{personal,open-source}/`). The run records the root instead of deriving it from `tool` and `domain`, because each command chooses its own store root and a derived root misses journals at an overridden or legacy root. Recording the exact reference ensures a mixed-work run hosted under `personal/` still detects unresolved journals stored under `open-source/` or another scoped command store.
  - **Fail-closed inspection rule.** Only `ENOENT` proves a recovery marker is absent. A journal is proven absent only when `<store_root>/operations/` exists and is readable and `<store_root>/operations/<operation_id>` returns `ENOENT`. A missing or relative `store_root`, a missing `operations/` directory (for example after a store moved), any permission error (`EACCES`, `EPERM`), I/O error, or malformed JSON in `RECOVERY-OPEN.json`, `run-status.json`, or any referenced store protects the run (`eligible: false`) and returns a repairable diagnostic.
- **30-day run retention clock.** Each run records `runs/<date-slug>/run-status.json` (mode `0600`) containing `created_at`, `settled_at`, `promoted_at`, `promoted_to`, and `operations`. The owning coordinator (or operator-approved hygiene repair flow) writes `settled_at` once execution ends and no action remains pending. The 30-day retention clock starts at `settled_at`, never at the folder name or filesystem modification time. Runs without `settled_at` remain protected from pruning and are flagged in the hygiene sweep after 14 days so crashed runs cannot accumulate silently.
- **Designated disk-hygiene owner.** Pruning and archiving are owned by the project maintainer (Nathan), assisted by the scheduled hygiene sweep of the `agent-coordination` command. Deletion or archive and removal runs only after explicit human confirmation. Workers never prune historical runs or coordinator folders silently.
- **Stopped coordinator 30-day ceiling (promoted and unpromoted).** A `coordinators/<slug>/` folder stays intact while `status` is `active` or `paused`, or while any referenced run has an open recovery case. Once `status` is `stopped` and zero open recovery cases remain:
  - Days 0 to 14 after `stopped_at`: kept intact.
  - Days 14 to 29 after `stopped_at`: if `promoted_at` is `null`, the hygiene sweep flags the unpromoted stopped folder for review.
  - Day 30 and beyond after `stopped_at` (hard ceiling for all stopped coordinators): if `promoted_at` is non-null, the folder becomes eligible for human-confirmed compact metadata archiving (`$XDG_DATA_HOME/my-agent-dojo/agent-coordination/{personal,open-source}/archives/coordinators/<slug>.tar.gz`, dir `0700`, archive `0600`; archives are durable records worth backing up, so they live in the data home) plus folder removal, or outright deletion. If `promoted_at` is `null`, the hygiene sweep requires a human-confirmed disposition at the 30-day ceiling: (a) promote durable outcomes now, then archive and remove, (b) archive the full stopped folder intact to `$XDG_DATA_HOME/my-agent-dojo/agent-coordination/{personal,open-source}/archives/coordinators/<slug>-unpromoted.tar.gz` (`0600`) to preserve unpromoted outcomes while removing the live folder, or (c) discard on explicit human confirmation.

## Consequences

- **Positive.** Eliminates simultaneous lease creation races, pending-then-created worktree alias races, and dual-live-holder reclaims across personal and open-source work on one host. Protects active, paused, and orphaned work from silent takeover while blocking stale heartbeat overwrites. Guarantees recovery evidence across suite-namespaced, shipped legacy, same-side, and cross-side Contract 3 stores survives inspection errors, store moves, and promotion, while placing a hard 30-day ceiling on both promoted and unpromoted stopped coordinators.
- **Negative.** Cross-side conflict checks read lease metadata across `personal/` and `open-source/` on a shared host (bounded to same-user `0700` metadata only, never notes, handoffs, or run payloads). Operators must confirm reclaim of crashed coordinators and confirm hygiene dispositions instead of silent automation.
- **Neutral.** On macOS, where `$XDG_RUNTIME_DIR` is unset by default, the runtime lock warns and uses the OS `DARWIN_USER_TEMP_DIR` fallback under the runtime directory rule until macOS provides a native runtime directory or work moves to Linux VMs.

## Options and tradeoffs

### Driver comparison matrix

| Driver | Option A (runtime lock + atomic state lease + fail-closed retention) | Option B (reuse kernel per-tool `admission.lock`) | Option C (uncoordinated leases + mtime pruning) |
| --- | --- | --- | --- |
| Host-wide mutual exclusion | Strong. Single OS lock serializes cross-side claim checks, key-set intersections, atomic former-holder revocation, and atomic writes. | Fails. Kernel `admission.lock` provides cross-process OS locking only within one command's store root, not host-wide across personal and open-source work. | Fails. Simultaneous starts race and silently claim identical worktrees or ports. |
| Crash and reboot safety | Strong. OS clears runtime lock on crash; `lease.json` survives reboot in `$XDG_STATE_HOME`. | Partial. Placing lock files inside `$XDG_STATE_HOME` mixes logout-scoped locks with durable state. | Weak. No lock cleanup guarantees; torn JSON writes risk corrupting lease state. |
| Human-gated reclaim | Strong. Both `active` and `paused` require explicit human confirmation; confirmed reclaim atomically stops former holders; heartbeats guard against overwrites. | Misaligned. Kernel `state-seam.ts` holds run identity in a process-local map that forgets runs when a CLI invocation exits. | Weak. Unspecified `paused` and orphan rules invite silent takeover or permanent deadlock. |
| Recovery-first bounded retention | Strong. `RECOVERY-OPEN.json` and fail-closed scoped `KernelOperationRef` journal checks override promotion; 30-day ceiling covers settled runs and both promoted and unpromoted stopped coordinators. | Partial. Covers single-tool Contract 3 journals only, not cross-harness coordinator `runs/`. | Fails. Filesystem `mtime` drifts on backups or reads and ignores open recovery cases. |
| Contract 3 alignment | Strong. Reuses Darwin `O_EXLOCK` and `O_NONBLOCK` and Linux `flock` semantics, `pathKeys()` and `currentKeys()` scope keys, and `operations/` journal discovery. | Overloads a single-command transaction store with multi-hour coordinator orchestration. | Ignores Contract 3 locking, scope, and journal invariants. |

### Option A

- **Good.** Proven in a private multi-process Bun prototype: simultaneous cross-domain claims yield one winner and one conflict refusal, pending-then-created and symlink-aliased worktrees conflict via key-set intersection, cross-folder reclaim atomically stops the former holder and blocks stale heartbeats, unreadable journal directories fail closed, mixed-domain scoped journals protect runs alongside `RECOVERY-OPEN.json`, and the 14-day and 30-day stopped-coordinator ceiling covers both promoted and unpromoted folders. That prototype predates `store_root` and the `agent-coordination/` path rename. The recorded store-root lookup was checked only in a throwaway nine-case experiment (0 wrong verdicts), and the recovery-first fail-closed pruning test must prove it.
- **Bad.** Requires maintaining one small host-wide lease schema and hygiene sweep alongside per-command Contract 3 stores.

### Option B

- **Good.** Reuses existing `agent-cli-kernel` state store directories with zero new files.
- **Bad.** While `coordination.ts` uses cross-process OS locking inside one command's store root, `state-seam.ts` tracks active run identity in a process-local map for short-lived CLI commands. Bending a per-command transaction store into a host-wide coordinator registry conflates tool runtime state with domain operational state.

### Option C

- **Good.** Zero locking code.
- **Bad.** Fails under concurrent coordinator startup, risks torn JSON files, leaves `paused` and orphan semantics ambiguous, and allows `mtime`-based pruning to delete live recovery evidence.

## Confirmation

### Design acceptance gate (moves status from `proposed` to `accepted`)

- Independent cross-model design review passes with zero P0 and zero P1 findings across ADR 0001, ADR 0002, `GLOSSARY.md`, and the companion specification.
- Multi-process prototype demonstrates mutual exclusion, pending-then-created worktree key-set conflict detection, cross-folder reclaim revocation plus heartbeat guard, mixed-domain fail-closed journal recovery protection, and the 14-day and 30-day stopped-coordinator ceiling.
- Decision authority (Nathan) explicitly approves transitioning ADR 0002 to `accepted`.

### Implementation confirmation (verified when the `agent-coordination` command lands)

- **Concurrent acquisition and worktree key-set test.** Two parallel processes racing to claim the same `{ repo_id, branch }`, worktree (including a pending-then-created path and a symlink alias), or localhost port across `personal/` and `open-source/` produce one `ok` result and one `resource-conflict` refusal (`human_confirmation_required: true`), and contention past the lock timeout returns `lock-busy`.
- **Lifecycle, cross-folder reclaim, heartbeat, and staleness test.** An `active`, `paused`, or `stale` lease blocks silent takeover with a structured conflict; confirmed reclaim (same folder or across folders and sides) atomically sets the former holder to `stopped` with `reclaimed_by` and causes the former holder's next heartbeat to fail; a `stopped` lease releases claims immediately.
- **Recovery-first fail-closed pruning test.** With an injectable clock, runs carrying `RECOVERY-OPEN.json`, runs whose `operations` appear in suite-namespaced (`my-agent-dojo/<command>/operations/`), same-side (`my-agent-dojo/<command>/personal/operations/`), cross-side (`my-agent-dojo/<command>/open-source/operations/`), or shipped legacy (`<command>/operations/`) stores, runs whose recorded `store_root` is relative or no longer exists, runs whose journal inspection fails (`EACCES`), unsettled runs (`settled_at: null`, flagged after 14 days), and settled runs under 30 days are never pruned; only settled runs at or past 30 days with zero open recovery references become eligible.
- **Stopped-coordinator ceiling test.** With an injectable clock, promoted stopped coordinators become archive-eligible or delete-eligible at 30 days, unpromoted stopped coordinators flag at 14 days and require human-confirmed disposition (promote and archive, archive intact, or discard) at 30 days, and open recovery cases override the ceiling.
- **Permission and XDG validation test.** An empty or relative `$XDG_STATE_HOME` is ignored and the XDG Base Directory Specification v0.8 default state directory is used. Each runtime candidate follows the runtime directory rule: an unset, empty, or relative `$XDG_RUNTIME_DIR`, or one that is a symlink, has another owner, or has a mode other than `0700` (for example `/tmp`), is skipped with a warning, and with no usable candidate the command refuses with a repairable diagnostic. Created directories verify `0700`, and created JSON and lock files verify `0600`.

### Open questions

- What exact files or fields a compact metadata archive (`<slug>.tar.gz`) contains.
- How a coordinator folder records which `runs/<date-slug>/` folders belong to it.
- Which command sets a lease's `promoted_at` timestamp.

### Revisit triggers

- **Per-domain Linux VM rollout.** When each domain runs in its own Linux VM, `$XDG_RUNTIME_DIR` is natively provided by systemd, cross-side lease scanning collapses to one side automatically, and host-wide port conflict checks scope to the VM.
- **Multi-host or remote coordinator execution.** If coordinators run across multiple physical machines against shared remote branches, revisit whether local `lease.json` must be paired with a remote lease service.

## References

- [ADR 0001: Local state and domain storage boundaries](0001-local-state-and-domain-storage-boundaries.md)
- [Public storage glossary](../../GLOSSARY.md)
- `agent-cli-kernel` state add-on locking, scope, and journal model (`coordination.ts`, `scope.ts`, `store.ts`)
- XDG Base Directory Specification v0.8 (`https://specifications.freedesktop.org/basedir/latest/`)
