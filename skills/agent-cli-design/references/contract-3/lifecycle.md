# Lifecycle, writer and fallback

Candidate text for Command Contract 3.0. Not accepted, not binding. Read
[index.md](index.md) first for clause tags and status.

## Output modes

**LIFE-1 `[C0]`** Machine mode applies when `--json` is present, including on
usage failures. On ordinary application-controlled completion, machine mode
writes exactly one validated envelope to stdout as UTF-8 JSON, one object
followed by one newline, and leaves stderr empty. This holds for help,
discovery, usage refusals and internal failures.

**LIFE-2 `[C0]`** In human mode a refusal or failure is one line on stderr.
Human help and human discovery go to stdout with exit 0.

**LIFE-2a `[LO]`** Every route is noninteractive. A command never prompts, with
stdin closed or held open and not a terminal.

## Hooks and stopping

**LIFE-3 `[C0]`** Install the stdout error hook and the signal and crash hooks
before dispatch. A signal handler owns explicit process termination. A
listener never inherits default exit behaviour. Stop new domain work at the
first stop request. Never replay an effect in cleanup.

### Lifecycle table

| Event and timing | Exit | Envelope and output guarantee | Recovery |
| --- | --- | --- | --- |
| Normal valid result | Result table | Exactly one validated envelope in machine mode, then awaited drain | The result's guidance |
| First SIGINT before final envelope emission | 130 | Start no envelope. At most 500 ms diagnostic flush, then terminate. Started programs are stopped within the same bound ([LIFE-11](#started-programs)). | Inspect any interrupted effects next run ([LIFE-12](#no-result-received)) |
| First SIGTERM before final envelope emission | 143 | Same stopping and flush bound as SIGINT. Start no envelope. | Same |
| First signal while envelope bytes are draining | 130 or 143 by signal | No second envelope. The stream may be incomplete. Same maximum flush grace. | Infer neither failure nor absence of effects from incomplete output |
| First signal after the envelope drained, before process exit | 130 or 143 by signal | The emitted envelope stands. The signal exit is out-of-band and is not its `exitCode`. | Emitted effect evidence remains evidence. No automatic repetition. |
| Any repeated SIGINT or SIGTERM during shutdown | 130 or 143 by the repeated signal | Immediate termination. No further envelope. No flush or journal promise. Started programs are killed first ([LIFE-11](#started-programs)). | Inspect uncertainty next run |
| Uncaught exception or unhandled rejection | 1 | One bounded synchronous emergency recording attempt only. No new envelope. No exception dump on stderr. Started programs are killed first ([LIFE-11](#started-programs)). | Inspect journal and resources. Tolerate a missing final record. |
| SIGKILL, abort, hook-install failure, emergency write failure, power loss | Host or runtime dependent, outside the closed result exits | No envelope, flush, final journal record or child-cleanup guarantee | Recover by intent and resources. Never assume unchanged. |
| Deadline before operation dispatch | 3 | One refused and unchanged envelope when output remains available | `DOMAIN_DEADLINE_BEFORE_START`. An explicit new-run decision. |
| Deadline after dispatch, unchanged confirmed | 3 | One failed and unchanged envelope | `DOMAIN_DEADLINE_UNCHANGED`. No automatic retry. |
| Deadline after dispatch, all effects complete | 3 | One failed and completed envelope | `DOMAIN_DEADLINE_COMPLETED`. Inspect completion. |
| Deadline after dispatch, partial confirmed | 3 | One failed and partially-completed envelope | `DOMAIN_DEADLINE_PARTIAL`. Handoff. |
| Deadline after dispatch, effects uncertain | 3 | One failed and unknown envelope | `DOMAIN_DEADLINE_UNKNOWN`. Handoff. |
| EPIPE before full envelope drain | 1 | Stdout may be empty or partial. Stderr empty. No replacement envelope. | Journal and resources own domain truth |
| EPIPE after confirmed full drain | The result's exit | The emitted envelope and its exit stand | Existing guidance remains valid |
| Result fails JSON or schema validation before stdout begins | 1 | Exactly one bounded fallback attempt ([LIFE-9](#fallback)) | Preserve independently trusted effects. No replay. |
| Fallback itself fails, or output already began | 1 | No recursive fallback. No further envelope. Stderr empty. | Treat result delivery as unavailable. Inspect resources. |

Every row is `[C0]`, with two exceptions. "Emergency write failure" in the
forced-termination row is `[LO]`. Five rows carry an addition tagged
`[D 20]` `[Q 10]`, all from LIFE-11: the started-programs sentences in the
first-SIGINT, repeated-signal and crash rows; the first-SIGTERM row, which
changes by reference to the first; and the words "or child-cleanup" in the
forced-termination row.

**LIFE-4 `[C0]`** Signal exits 130 and 143 are out-of-band. They are not
members of the result exit set and no envelope carries them.

## Deadlines

**LIFE-5 `[C0]`** `--deadline-ms <positive-integer>` is admitted only for a
command that declares deadline support. A command with an unbounded
uninterruptible effect cannot declare it.

**LIFE-6 `[C0]`** The deadline covers operation dispatch and work. It excludes
the bounded diagnostic flush and the stdout drain. At the deadline the command
stops starting work and waits at most 500 milliseconds for cancellation and
observation. Effects still unconfirmed after that wait are reported as
`unknown`. This bound is separate from the diagnostics flush bound. No hard
bound on a connected but slow stdout consumer is claimed.

## Crash recording

**LIFE-6a `[C0]`** The crash recording attempt uses bounded data already
available and at most one synchronous write. It performs no asynchronous
disposal and no waiting. It promises no wall-clock bound on a stalled
filesystem. That limit needs process qualification against the supported
environment.

## Writer

**LIFE-7 `[C0]` `[D 19]`** One writer serialises every envelope. In order:

1. Validate the diagnostics object on its own, after the domain result is
   frozen. Replace an invalid one with the unavailable variant
   ([DIAG-4](diagnostics.md#separation-from-the-result)). This step never
   takes the fallback.
2. Guard plain acyclic JSON at a maximum nesting depth of 64. Reject cycles,
   over-depth, `undefined`, functions, bigint, `Date`, `NaN` and `Infinity`.
3. Run strict shape and cross-field validation of the whole envelope: every
   rule of [wire.md](wire.md) and [next-steps.md](next-steps.md) that can be
   judged from the envelope and the command's declaration.
4. Serialise and write.

A domain result that fails step 2 or 3 takes the fallback. It never surfaces
as an uncaught exception. A diagnostics fault alone never does.

**LIFE-8 `[D 19]` `[D 20]` `[P]`** The validator in step 3 is the one
dependency-free validator stamped with the base. It is complete from the first
release: every outcome, every effect class, every transaction state, every
guidance arm and both diagnostics variants. No add-on extends it or narrows
it. It also checks the result against the declaration of the command that
produced it: the cause is one the command declares, and the fixed fields equal
the declared station's ([DISC-9](discovery.md#stations)) `[Q 1]`.

Runtime validation is mandatory in every CLI. A type-check pass is never a
substitute for it ([GATE-2](static-gates.md#what-types-do-not-prove)).

## Fallback

**LIFE-9 `[C0]`** When a result fails the writer before any stdout write, make
exactly one fallback attempt:

1. Select a fixed internal cause from the trusted operation phase and effect
   summary. Before dispatch: `INTERNAL_PREPARATION`, refused and unchanged.
   After dispatch: the `INTERNAL_RESULT_*` cause matching the trusted
   transaction state, failed. When the trusted summary is missing for a
   command whose effect class is not `inspect`: `INTERNAL_RESULT_UNKNOWN`,
   empty collections and `inventoryComplete: false`. An `inspect` command
   keeps its inspect and unchanged stance.
2. Construct one small literal envelope from the trusted command identity and
   run identity, `null` data, a bounded constant message, no copied bad
   payload, and the base's fixed guidance for that cause
   ([DISC-11b](discovery.md#kernel-supplied-stations)). Include the frozen
   diagnostics when valid. Otherwise use the unavailable variant with every
   independently trusted field. Fabricate no path, sink failure, count or
   closure state. Preserve trusted effect identities within the size limit.
   When they do not fit, report `unknown` with incomplete inventory.
3. Encode with a guarded nonrecursive encoder used only here: at most 16,384
   UTF-8 bytes and nesting depth 8. Attempt one stdout write and drain. Any
   construction, validation, encoding or write failure terminates under the
   lifecycle table. There is no second attempt.

**LIFE-10 `[P]`** The fallback envelope always declares `contractVersion`
`3.0.0` and uses only keys and step kinds defined at 3.0.0, whatever minor the
CLI stamps on its other results ([VER-9](versioning.md#the-fallback-version)).
Every 3.x reader can therefore read the one result that says to inspect
effects.

## Started programs

**LIFE-11 `[D 20]` `[Q 10]`** A program the CLI starts never outlives the CLI on
any exit path the CLI controls:

| Exit path | Required action |
| --- | --- |
| Normal completion, refusal or failure | Each started program has exited, or is terminated, before the envelope is written |
| Deadline | Terminate at the deadline. Unconfirmed effects are `unknown` (LIFE-6). |
| First SIGINT or SIGTERM | Send SIGTERM to each started program's process group, then SIGKILL to any group still alive when the 500 millisecond bound of the first-signal row ends |
| Repeated SIGINT or SIGTERM | Send SIGKILL to each started program's process group, synchronously, then exit. No wait for confirmation. |
| Uncaught exception or unhandled rejection | Send SIGKILL to each started program's process group, synchronously, before exit |

Each started program runs in its own process group so the signal reaches its
descendants. SIGKILL of the CLI itself, abort and power loss carry no cleanup
guarantee.

This clause comes from the prototype: a repeated signal killed the CLI while a
started program kept running. It changes five accepted rows of the lifecycle
table, and the matching sentences of the accepted lifecycle specification
(a second Ctrl+C "exits immediately"). The two first-signal rows gain a stop
of started programs inside the existing 500 millisecond bound. The
repeated-signal row, which promised no cleanup, gains one synchronous kill
before the immediate exit. The crash row, which allowed the emergency
recording attempt "only", gains the same synchronous kill. The
forced-termination row names child cleanup among the things not guaranteed.
No envelope, flush or journal guarantee changes
([decisions.md](decisions.md), Q10).

A known limit: when anything kills the CLI's own process group with SIGKILL,
the CLI cannot clean up, and a program it started in another group
survives. That includes a 3.0 CLI killed by another 3.0 CLI on its own
repeated-signal or crash path.

## No result received

**LIFE-12 `[Q 7]`** A caller that receives no complete envelope from a
command whose effect class is not `inspect` runs that command's `ifNoResult`
command before anything else, and never repeats the change first
([DISC-13](discovery.md#if-no-result)). An incomplete stdout stream counts as
no result.

**LIFE-13 `[C0]`** A reader that judges another CLI's output never retries a
target that has already executed. It reports its own refusal as unchanged, and
its guidance requires separate inspection of the target's effects.

**LIFE-14 `[LO]`** Repeated deterministic inputs produce the same envelope,
except for run identity and time fields. Domain and recovery fields are never
normalised in that comparison.
