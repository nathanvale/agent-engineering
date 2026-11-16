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

| Event and timing                                                          | Exit                                                       | Envelope and output guarantee                                                                                                                                                                   | Recovery                                                                  |
| ------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Normal valid result                                                       | Result table                                               | Exactly one validated envelope in machine mode, then awaited drain                                                                                                                              | The result's guidance                                                     |
| First SIGINT before final envelope emission                               | 130                                                        | Start no envelope. At most 500 ms diagnostic flush, then terminate. Started programs receive shutdown attempts within the same bound ([LIFE-11](#started-programs)).                            | Inspect any interrupted effects next run ([LIFE-12](#no-result-received)) |
| First SIGTERM before final envelope emission                              | 143                                                        | Same stopping and flush bound as SIGINT. Start no envelope.                                                                                                                                     | Same                                                                      |
| First signal while envelope bytes are draining                            | 130 or 143 by signal                                       | No second envelope. The stream may be incomplete. Same maximum flush grace.                                                                                                                     | Infer neither failure nor absence of effects from incomplete output       |
| First signal after the envelope drained, before process exit              | 130 or 143 by signal                                       | The emitted envelope stands. The signal exit is out-of-band and is not its `exitCode`.                                                                                                          | Emitted effect evidence remains evidence. No automatic repetition.        |
| Any repeated SIGINT or SIGTERM during shutdown                            | 130 or 143 by the repeated signal                          | Immediate termination. No further envelope. No flush or journal promise. Forced termination of owned programs is attempted first ([LIFE-11](#started-programs)).                                | Inspect uncertainty next run                                              |
| Uncaught exception or unhandled rejection                                 | 1                                                          | One bounded synchronous emergency recording attempt only. No new envelope. No exception dump on stderr. Forced termination of owned programs is attempted first ([LIFE-11](#started-programs)). | Inspect journal and resources. Tolerate a missing final record.           |
| SIGKILL, abort, hook-install failure, emergency write failure, power loss | Host or runtime dependent, outside the closed result exits | No envelope, flush, final journal record or child-cleanup guarantee                                                                                                                             | Recover by intent and resources. Never assume unchanged.                  |
| Deadline before operation dispatch                                        | 3                                                          | One refused and unchanged envelope when output remains available                                                                                                                                | `DOMAIN_DEADLINE_BEFORE_START`. An explicit new-run decision.             |
| Deadline after dispatch, unchanged confirmed                              | 3                                                          | One failed and unchanged envelope                                                                                                                                                               | `DOMAIN_DEADLINE_UNCHANGED`. No automatic retry.                          |
| Deadline after dispatch, all effects complete                             | 3                                                          | One failed and completed envelope                                                                                                                                                               | `DOMAIN_DEADLINE_COMPLETED`. Inspect completion.                          |
| Deadline after dispatch, partial confirmed                                | 3                                                          | One failed and partially-completed envelope                                                                                                                                                     | `DOMAIN_DEADLINE_PARTIAL`. Handoff.                                       |
| Deadline after dispatch, effects uncertain                                | 3                                                          | One failed and unknown envelope                                                                                                                                                                 | `DOMAIN_DEADLINE_UNKNOWN`. Handoff.                                       |
| EPIPE before full envelope drain                                          | 1                                                          | Stdout may be empty or partial. Stderr empty. No replacement envelope.                                                                                                                          | Journal and resources own domain truth                                    |
| EPIPE after confirmed full drain                                          | The result's exit                                          | The emitted envelope and its exit stand                                                                                                                                                         | Existing guidance remains valid                                           |
| Result fails JSON or schema validation before stdout begins               | 1                                                          | Exactly one bounded fallback attempt ([LIFE-9](#fallback))                                                                                                                                      | Preserve independently trusted effects. No replay.                        |
| Fallback itself fails, or output already began                            | 1                                                          | No recursive fallback. No further envelope. Stderr empty.                                                                                                                                       | Treat result delivery as unavailable. Inspect resources.                  |

Every row is `[C0]`, with two exceptions. "Emergency write failure" in the
forced-termination row is `[LO]`. Five rows carry an addition tagged
`[D 20]` `[P]`, all from LIFE-11: the started-programs sentences in the
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
the declared station's ([DISC-9](discovery.md#stations)) `[P]`.

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

**LIFE-10 `[A 8]` `[P]`** The fallback envelope always declares `contractVersion`
`3.0.0` and uses only keys and step kinds defined at 3.0.0, whatever minor the
CLI stamps on its other results ([VER-9](versioning.md#the-fallback-version)).
Every 3.x reader can therefore read the one result that says to inspect
effects.

## Started programs

**LIFE-11 `[D 20]` `[A 14]` `[P]`** The programs add-on owns bounded
shutdown of programs it starts. A successful kill request is an attempt, not
observed termination and never proof that an external effect was undone.

| Exit path                             | Required action                                                                                                                                                                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Normal completion, refusal or failure | Observe owned programs exiting; otherwise attempt SIGTERM then SIGKILL within each declared finite shutdown budget. If termination cannot be confirmed, keep effect uncertainty and report a handoff rather than claiming cleanup. |
| Deadline                              | Request termination within LIFE-6's cancellation and observation bound. Unconfirmed effects are unknown.                                                                                                                           |
| First SIGINT or SIGTERM               | Send SIGTERM to owned process groups and attempt SIGKILL for survivors before the existing 500 ms bound expires. No extra cleanup grace.                                                                                           |
| Repeated SIGINT or SIGTERM            | Attempt synchronous SIGKILL for owned groups, then exit immediately. No confirmation wait, new envelope or flush promise.                                                                                                          |
| Catchable crash                       | Attempt synchronous SIGKILL for owned groups, preserving LIFE-6a's single emergency recording attempt and no asynchronous wait.                                                                                                    |

Ownership is tracked from program creation; do not signal unrelated processes.
A process group helps reach descendants but does not contain every detached
or remote process. SIGKILL of the CLI itself, abort, hook-install failure and
power loss provide no cleanup guarantee. An attempted kill cannot satisfy the
stopped-writer proof required by REC-7. Evidence must separate observed exits,
attempted cleanup and survivors. The prototype exposed the need for this rule;
it did not prove cleanup on every platform. No envelope, journal or flush
guarantee is expanded beyond LIFE-3.

## No result received

**LIFE-12 `[P]`** A caller that receives no complete envelope from a
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
