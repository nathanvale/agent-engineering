---
status: proposed
---

# Coordinator leases and retention

## Context and problem

Multiple coordinators can run concurrently on one host across different domains and agent harnesses. Without host-wide exclusion, two differently named coordinators can claim the same repository branch, Git worktree, or localhost port and overwrite each other's work.

At the same time, local operational state grows without bound unless settled raw logs and stopped coordinator folders can be pruned safely. Deleting a run while a crash recovery case still depends on its evidence destroys auditability and blocks safe repair.

Decision question: how should concurrent coordinators acquire and release exclusive host-wide resource leases, and how should settled raw runs and stopped coordinator folders be retained or pruned without endangering recovery?

## Decision drivers

1. **Host-wide mutual exclusion.** Prevent two concurrent coordinators in the same or different domains from silently claiming the same repository branch, Git worktree, or localhost port, including under simultaneous startup.
2. **Crash and reboot safety.** Ensure transient acquisition locks clear automatically on process crash or reboot, while durable lease records survive reboot so active and paused work is never stolen silently.
3. **Human-gated reclaim.** Require explicit human confirmation before reclaiming resources held by an `active` or `paused` coordinator, even when its heartbeat is stale or its process has died.
4. **Recovery-first bounded retention.** Keep local state bounded over time while guaranteeing that unresolved recovery evidence is never pruned, regardless of whether outcomes were already promoted.
5. **Contract 3 alignment.** Align locking mechanisms and recovery references with `agent-cli-kernel` Command Contract 3 (`Admission lock` and `Journal` invariants) without overloading single-command transaction stores with multi-hour coordinator lifecycles.

## Considered options

- **Option A.** Separate transient acquisition locking in `$XDG_RUNTIME_DIR` (reusing the `agent-cli-kernel` OS locking mechanism semantics) from durable atomic `lease.json` records in `$XDG_STATE_HOME`, paired with recovery-first 30-day `runs/` pruning keyed to `settled_at` and a 30-day stopped-coordinator archive ceiling.
- **Option B.** Reuse `agent-cli-kernel`'s single-tool state-seam `admission.lock` and per-tool store directly for host-wide coordinator leases and retention.
- **Option C.** Keep uncoordinated per-coordinator `lease.json` files inside `$XDG_STATE_HOME` without a host-wide acquisition lock and prune runs by filesystem modification time after 30 days.

## Decision

**Decision authority:** Nathan (project maintainer).

We recommend **Option A** because it satisfies host-wide mutual exclusion, crash and reboot safety, human-gated reclaim, recovery-first bounded retention, and Contract 3 alignment.

### 1. Separation of runtime locks and durable leases

- **Transient acquisition lock (`$XDG_RUNTIME_DIR`).** Lease creation, status changes, and reclaim acquire one host-wide exclusive lock at `$XDG_RUNTIME_DIR/my-agent-dojo/coordinator-lease.lock` (directory mode `0700`, lock file mode `0600`) using the same OS locking mechanism qualified in `agent-cli-kernel` (`O_EXLOCK | O_CLOEXEC | O_NOFOLLOW` on Darwin; `flock(LOCK_EX | LOCK_NB)` with `O_CLOEXEC | O_NOFOLLOW` on Linux). The lock is held only during conflict scanning and atomic lease writing, and the operating system releases it automatically on process exit or crash. When `$XDG_RUNTIME_DIR` is unset (the default on macOS), the tool falls back to a verified per-user `0700` directory under `$TMPDIR/my-agent-dojo-runtime-<uid>/` and logs the fallback per XDG Base Directory Specification v0.8.
- **Durable coordinator lease (`$XDG_STATE_HOME`).** Each coordinator stores its durable lease at `$XDG_STATE_HOME/my-agent-dojo/domains/<domain>/coordinators/<slug>/lease.json` (mode `0600`). Every write creates a unique sibling temp file with `O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW` (mode `0600`), calls `fsync`, atomically renames over `lease.json`, and calls `fsync` on the parent directory. Storing `lease.json` in `$XDG_STATE_HOME` ensures active and paused claims survive logout and reboot for recovery.

### 2. Lease schema, claim exclusivity, and cross-domain conflict discovery

Each `lease.json` (schema version `1`) records:

- Identity: `domain`, `coordinator_slug`, `conversation_id`, `harness` (`antigravity` | `codex` | `claude-code` | `other`), `host`, `pid` (number or `null` when no local process ID applies).
- Liveness and lifecycle: `started_at`, `updated_at` (heartbeat timestamp), `stopped_at` (timestamp or `null`), `stale_after_seconds` (default `1800`), `status` (`active` | `paused` | `stopped`), and `reclaim_policy` (enumerated; default and sole automatic policy `"confirm-active-and-paused"`).
- Resource claims:
  - `repos`: canonical repository identifiers touched by the coordinator (shared read access is allowed; exclusivity applies to branches and worktrees).
  - `branches`: repository-scoped pairs `{ repo_id, branch }` (exclusive host-wide).
  - `worktrees`: canonical paths resolved to filesystem `inode:<dev>:<ino>` when present or normalized absolute paths when pending creation, matching `agent-cli-kernel`'s canonical scope keys (exclusive host-wide).
  - `ports`: host-scoped pairs `{ host: "127.0.0.1" | "::1", port }` (exclusive host-wide).

While holding the runtime acquisition lock, the acquiring coordinator scans only the machine-local `lease.json` metadata files across `$XDG_STATE_HOME/my-agent-dojo/domains/*/coordinators/*/lease.json` within the same OS user's `0700` boundary. It never reads another domain's wikis, notes, handoffs, or run logs. Inside per-domain Linux VMs, only that VM's domain directory exists, so the same scan stays single-domain automatically.

### 3. Lifecycle, staleness, orphan detection, and reclaim rules

- **`active`.** Holds all declared `branches`, `worktrees`, and `ports` exclusively. No other coordinator may acquire an overlapping resource without explicit human confirmation.
- **`paused`.** Retains all declared `branches`, `worktrees`, and any still-declared `ports` exclusively so paused work cannot be silently overwritten. Reclaiming a `paused` lease requires explicit human confirmation under `confirm-active-and-paused`. A coordinator may release ephemeral localhost ports before transitioning to `paused` by removing them from `ports`.
- **`stopped`.** Sets `stopped_at` and releases all resource claims immediately. A `stopped` lease never blocks new acquisitions.
- **Staleness and orphan detection.** A non-stopped lease is flagged as `stale` during conflict inspection when `now - updated_at > stale_after_seconds` or when `host` matches the current host, `pid` is non-null, and `kill(pid, 0)` reports the process is gone. Staleness is reported to the operator as diagnostic evidence (`heartbeat-expired` or `pid-not-running`) with a repair command; it never authorizes silent takeover. Only an explicit human-confirmed reclaim transitions an orphaned lease to `stopped` and records the new owner.

### 4. Recovery-first retention and pruning

- **Recovery protection overrides promotion.** A run directory at `runs/<date-slug>/` is never eligible for pruning while any unresolved recovery case references it, even if its outcomes were already promoted.
- **Authoritative recovery references.** Before marking any run eligible for pruning, the hygiene check inspects two machine-readable sources:
  1. A local marker file `runs/<date-slug>/RECOVERY-OPEN.json` (mode `0600`, holding `recovery_id`, `run_id`, `opened_at`, `owner`, `reason`), created when a recovery case opens and removed only by the recovery owner once closure is verified.
  2. Unresolved Command Contract 3 state journals under `$XDG_STATE_HOME/<tool>/operations/<op-id>/` that reference the run ID.
- **30-day run retention clock.** Each run records `runs/<date-slug>/run-status.json` (mode `0600`) containing `created_at`, `settled_at`, `promoted_at`, and `promoted_to`. A run is **settled** only when `settled_at` is a non-null timestamp confirming execution ended and no action remains pending. The 30-day retention clock starts at `settled_at`, never at the folder name or filesystem modification time. Runs without `settled_at` remain protected.
- **Designated disk-hygiene owner.** Pruning is owned by the Super Coordinator's scheduled hygiene sweep (backed by a future `agent-engineering` CLI hygiene command) and executes deletion only after explicit human confirmation. Workers never prune historical runs silently.
- **Stopped coordinator retention and archive ceiling.** A `coordinators/<slug>/` folder stays intact while `status` is `active` or `paused`. Once `status` is `stopped` and durable outcomes are promoted, the folder stays for at most 30 days from `stopped_at`, after which the hygiene sweep archives compact metadata (`lease.json` and `decisions.tsv`) to `$XDG_STATE_HOME/my-agent-dojo/domains/<domain>/archives/coordinators/<slug>.tar.gz` (directory `0700`, archive `0600`) or removes the folder on human confirmation. A `stopped` coordinator with unpromoted outcomes is flagged in the hygiene sweep after 14 days so unpromoted folders cannot grow unboundedly.

## Consequences

- **Positive.** Eliminates simultaneous lease creation races across domains on one host. Protects active, paused, and orphaned work from silent takeover while still surfacing dead coordinators clearly. Guarantees recovery evidence survives until explicitly closed, while giving settled runs and stopped coordinators a concrete 30-day ceiling.
- **Negative.** Cross-domain conflict checks read lease metadata across domain directories on a shared host (bounded to same-user `0700` metadata only, never domain payloads). Operators must confirm reclaim of crashed coordinators instead of automatic stealing.
- **Neutral.** On macOS, where `$XDG_RUNTIME_DIR` is unset by default, the runtime lock uses the per-user `$TMPDIR` fallback until macOS provides a native runtime directory or work moves to Linux VMs.

## Options and tradeoffs

### Driver comparison matrix

| Driver | Option A (runtime lock + atomic state lease + recovery-first pruning) | Option B (reuse kernel per-tool `admission.lock`) | Option C (uncoordinated leases + mtime pruning) |
| --- | --- | --- | --- |
| Host-wide mutual exclusion | Strong. Single OS lock serializes cross-domain claim checks and atomic writes. | Fails. Kernel `admission.lock` is per-tool and process-scoped via `state-seam.ts`, not host-wide across domains. | Fails. Simultaneous starts race and silently claim identical worktrees or ports. |
| Crash and reboot safety | Strong. OS clears runtime lock on crash; `lease.json` survives reboot in `$XDG_STATE_HOME`. | Partial. Putting locks inside `$XDG_STATE_HOME` mixes transient locks with durable state. | Weak. No lock cleanup guarantees; torn JSON writes risk corrupting lease state. |
| Human-gated reclaim | Strong. Both `active` and `paused` require explicit human confirmation; staleness flags without stealing. | Misaligned. Kernel `state-seam.ts` forgets run identity when a CLI invocation exits. | Weak. Unspecified `paused` and orphan rules invite silent takeover or permanent deadlock. |
| Recovery-first bounded retention | Strong. Explicit `RECOVERY-OPEN.json` and Contract 3 `operations/` checks override promotion; `settled_at` anchors 30-day clock. | Partial. Covers single-tool Contract 3 journals only, not cross-harness coordinator `runs/`. | Fails. Filesystem `mtime` drifts on backups or reads and ignores open recovery cases. |
| Contract 3 alignment | Strong. Reuses Darwin `O_EXLOCK`/Linux `flock` semantics, canonical inode scope keys, and `operations/` journal checks. | Overloads a single-command transaction store with multi-hour coordinator orchestration. | Ignores Contract 3 locking and journal invariants. |

### Option A

- **Good.** Proven in throwaway multi-process Bun prototype: simultaneous cross-domain claims yield exactly one winner and one conflict refusal, permissions enforce `0700`/`0600`, paused and stale leases block silent takeover, stopped leases release immediately, and recovery markers override promotion during 30-day pruning.
- **Bad.** Requires maintaining one small host-wide lease schema and hygiene sweep alongside per-tool Contract 3 stores.

### Option B

- **Good.** Reuses existing `agent-cli-kernel` state store directories with zero new files.
- **Bad.** `state-seam.ts` is designed for short-lived, single-process CLI transactions inside one tool's `$XDG_STATE_HOME/<tool>/` store; bending it into a multi-domain, multi-hour coordinator registry conflates tool state with domain operational state.

### Option C

- **Good.** Zero locking code.
- **Bad.** Fails under concurrent coordinator startup, risks torn JSON files, leaves `paused` and orphan semantics ambiguous, and allows `mtime`-based pruning to delete live recovery evidence.

## Confirmation

Before this ADR moves from `proposed` to `accepted` and when the future `agent-engineering` storage CLI implements these contracts:

- **Concurrent acquisition test.** Two parallel processes racing to claim the same `{ repo_id, branch }`, canonical worktree inode, or localhost port across different domains produce exactly one `ok` result and one `resource-conflict` refusal with `human_confirmation_required: true`.
- **Lifecycle and staleness test.** An `active`, `paused`, or `stale` lease blocks silent takeover; a `stopped` lease releases claims immediately; explicit human-confirmed reclaim transitions the prior holder cleanly.
- **Recovery-first pruning test.** With an injectable clock, runs with `RECOVERY-OPEN.json`, unresolved Contract 3 `operations/` references, missing `settled_at`, or age under 30 days are never pruned; only settled runs at or past 30 days with zero open recovery references become eligible.
- **Permission and XDG validation test.** Relative `$XDG_STATE_HOME` or `$XDG_RUNTIME_DIR` paths are refused; created directories verify `0700` and created JSON/lock files verify `0600`.

### Revisit triggers

- **Per-domain Linux VM rollout.** When each domain runs in its own Linux VM, `$XDG_RUNTIME_DIR` is natively provided by systemd, cross-domain lease scanning collapses to single-domain automatically, and host-wide port conflict checks scope to the VM.
- **Multi-host or remote coordinator execution.** If coordinators run across multiple physical machines against shared remote branches, revisit whether local `lease.json` must be paired with a remote lease service.

## References

- [ADR 0001: Local state and domain storage boundaries](0001-local-state-and-domain-storage-boundaries.md)
- [Public storage glossary](../../GLOSSARY.md)
- `agent-cli-kernel` state add-on locking and scope model (`coordination.ts`, `scope.ts`, `store.ts`)
- XDG Base Directory Specification v0.8 (`https://specifications.freedesktop.org/basedir/latest/`)
