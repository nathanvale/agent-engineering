# Diagnostics

Candidate text for Command Contract 3.0. Not accepted, not binding. Read
[index.md](index.md) first for clause tags and status.

Diagnostics describe how a run was observed. They never decide what the run did.

## Schema

**DIAG-1 `[C0]`** `diagnostics` is an optional top-level envelope key. It is
absent only when diagnostics were neither requested nor triggered. When present
it is a strict discriminated union on `status`.

**DIAG-2 `[C0]`** The available variant is strict:

| Key | Type and rule |
| --- | --- |
| `status` | literal `available` |
| `file` | absolute private per-run path, or `null` when no file was safely opened |
| `sinkFailure` | `null`, `capacity`, `setup`, `write`, `flush-timeout` or `close`. When several occurred, the first in time. |
| `droppedRecords` | nonnegative safe integer. A record rejected before it entered the buffer. |
| `unflushedRecords` | nonnegative safe integer. An admitted record not confirmed written at freeze. Disjoint from dropped. |
| `truncatedRecords` | nonnegative safe integer. A record whose retained content was visibly truncated. May overlap unflushed. |
| `countsComplete` | boolean. `true`: every counter is exact at freeze. `false`: counters are lower bounds, and zero means nothing was counted. |
| `closed` | boolean. `true` only when the sink is confirmed closed. A timed-out sink stays `false`. |

Counters measure records, not bytes. After a first sink failure the counters
keep recording later known loss.

**DIAG-3 `[C0]`** The unavailable variant is strict
`{ status: "unavailable", reason, trusted }`:

- `reason` is `status-invalid` when accounting fails its own schema or
  invariants, or `status-unavailable` when accounting cannot be obtained.
  Neither value claims a sink setup, write or flush failure.
- `trusted` is a strict object holding any independently trusted subset of
  `file`, `sinkFailure`, `droppedRecords`, `unflushedRecords`,
  `truncatedRecords`, `countsComplete` and `closed`. Every key is optional and
  follows DIAG-2. `{}` is valid.
- A missing key means unknown. Never substitute `null`, `false`, zero or
  `setup` for an unknown fact.
- A missing `closed` cannot authorise pruning. A missing `sinkFailure` proves
  neither failure nor success.
- Preserve every still-trusted field. A verified file path survives corrupt
  counters.
- Exact counters need trustworthy complete accounting. Otherwise keep only
  known lower bounds, with `countsComplete: false` where that fact is known.

## Separation from the result

**DIAG-4 `[C0]`** Validate diagnostics separately from the already frozen
domain result. An invalid diagnostics object becomes the unavailable variant.
It never changes outcome, exit, effects or recovery, and never by itself
invokes the fallback of [LIFE-9](lifecycle.md#fallback).

**DIAG-5 `[C0]`** A diagnostics-only failure leaves `message` unchanged. The
loss is disclosed through `diagnostics.status` and `diagnostics.reason`.

**DIAG-6 `[C0]` `[LO]`** No diagnostic record can authorise replay. A completed
journal gives the same recovery decision and guidance with logs intact,
deleted or throwing.

## Custody and limits

**DIAG-7 `[C0]` `[LO]`** When enabled, diagnostics are private per-run files
under `$XDG_STATE_HOME/<cli>/diagnostics`, falling back to
`~/.local/state/<cli>/diagnostics`. No option overrides the file location.
Files are created exclusively at mode `0600` under a `0700` directory before
the first write.

**DIAG-8 `[LO]`** An existing final file, a symlink, a FIFO, a missing
directory, a target-tree override and an untrusted ancestor are each refused
or contained. Exclusive creation of the final component is not claimed to
protect against ancestor races, and a path check is not claimed to prevent a
reopen race: the sink's real open behaviour is inspected and an unsupported
destination is refused. The sink keeps the securely opened descriptor or an
equivalent contained handle. A checked descriptor followed by a reopen by
path does not satisfy this clause.

**DIAG-9 `[C0]`** Finite limits:

| Limit | Value |
| --- | --- |
| Aggregate per CLI, including active logs | 10,000,000 bytes |
| Per run | 1,000,000 bytes |
| Files | 50 |
| Buffer | 1,000,000 bytes or 256 records, whichever comes first |
| Record | 64,000 bytes, with visible truncation |
| Normal-shutdown flush | 500 milliseconds |

The limits account for queue and serialisation overhead. They are not a
process heap cap.

**DIAG-10 `[C0]`** On invocation, prune independently confirmed closed logs
older than seven days, then the oldest confirmed closed logs as room is
needed. Never prune an active or ambiguous file. Age alone never makes a file
a pruning candidate: a timed-out sink and an active run stay out of the set.
With no safe capacity, stop diagnostics and disclose the loss. Never replay
domain work to make room. There is no daemon, so an unused CLI keeps at most
the capped allowance.

**DIAG-11 `[LO]`** Two concurrent pruners complete safely. Concurrent
reservation and actual file allocation together hold the aggregate cap.

**DIAG-12 `[LO]` `[SK]`** Secrets supplied through argv, files or environment
are redacted before any public output (`message`, `data`, stdout, stderr) and
again at the diagnostics sink `[SK]`. A synthetic secret marker is absent
from stdout, stderr, diagnostics and promoted receipts, with the limits of
encoded, free-text and traversal coverage named. Over-depth and oversized
payloads are truncated with a visible marker.

**DIAG-12a `[LO]`** A diagnostic record carries the per-run identity, the
command, a monotonic sequence and a useful duration, with explicit context
propagation. In-memory reporting about the logger itself is bounded and is
never durable truth.

**DIAG-12b `[LO]`** A setup failure (an unset home, a permission error, no
space), a throwing sink and a stuck flush each leave the domain effect and
the exit unchanged.

**DIAG-13 `[C0]`** Journal and diagnostic maintenance are not domain effects.
They never appear in `effects`. The CLI discloses them in
`effectExclusions` ([DISC-6](discovery.md#discovery-data)).

## Finalisation order

**DIAG-14 `[C0]`** Normal termination runs in this order:

1. Complete domain observation. Freeze the domain result and recovery. Stop
   new logging.
2. Close diagnostic input, count queued records and attempt flushing and
   disposal for at most 500 milliseconds in total. At expiry abandon pending
   diagnostic work and freeze conservative unflushed counts. A late sink
   completion changes neither the frozen counts nor the result, and starts no
   second output write.
3. Construct the final diagnostics status. Validate and serialise one
   envelope.
4. Await stdout drain. End with the result's exit, subject to the lifecycle
   table in [LIFE-3](lifecycle.md#lifecycle-table).

**DIAG-15 `[C0]`** Known loss is disclosed in that one envelope. No diagnostic
activity happens after the status freeze in normal finalisation, including
logging an EPIPE after the sink closed. A crash or forced termination promises
no diagnostics status.

**DIAG-16 `[C0]` `[LO]`** A noninterference comparison may normalise changed
diagnostics fields, run identity and genuine time. It never normalises a
domain or recovery field.

## Ownership

**DIAG-17 `[D 20]` `[P]`** The diagnostics add-on is the only owner of durable
diagnostics and the only place a logging dependency is pinned. Its logging
APIs are verified from the actual pinned packages `[LO]`, and nothing here
authorises a dependency upgrade
([CMD-16](commands-and-addons.md#diagnostics-add-on)). A CLI without the add-on
emits no `diagnostics` key. The kernel validator still validates the whole
union in every CLI
([LIFE-7](lifecycle.md#writer)).
