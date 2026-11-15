# Wire format

Candidate text for Command Contract 3.0. Not accepted, not binding. Read
[index.md](index.md) first for clause tags and status.

## General rules

**WIRE-1 `[C0]`** Machine output is UTF-8 JSON: one object followed by one
newline. Every object is strict: only the listed keys are legal.

**WIRE-2 `[C0]`** Each key has one presence class:

| Class       | Rule                                                                             |
| ----------- | -------------------------------------------------------------------------------- |
| Required    | Always present                                                                   |
| Nullable    | Always present. The value is an explicit `null` when the table says so.          |
| Conditional | Present exactly when the stated condition holds. Absent otherwise. Never `null`. |
| Optional    | Absent when unused. Never `null`.                                                |

`undefined` is rejected at every depth.

**WIRE-3 `[C0]`** A string is nonempty after trimming unless its rule permits
an empty string. Strings inside command input and inside `data` may be empty.
Identifiers and paths are nonsecret. An integer is a nonnegative safe JSON
integer unless its rule says otherwise.

**WIRE-4 `[C0]`** `JsonValue` is `null`, a boolean, a finite number, a string,
an array of `JsonValue`, or a plain string-keyed object of `JsonValue`.

## Envelope

**WIRE-5** Envelope keys:

| Key               | Class    | Type and rule                                                                                                      | Tag                   |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------ | --------------------- |
| `contractVersion` | Required | String `3.<minor>.0`. `3.0.0` at first release. The only version field ([VER-1](versioning.md#the-version-value)). | `[D 1]` `[D 8]` `[P]` |
| `message`         | Required | Safe human summary of this outcome                                                                                 | `[C0]`                |
| `availablePaths`  | Required | Array of canonical command identities, unique and lexicographically sorted. May be empty.                          | `[C0]`                |
| `result`          | Required | Result object (WIRE-7)                                                                                             | `[C0]`                |
| `diagnostics`     | Optional | Diagnostics object ([diagnostics.md](diagnostics.md))                                                              | `[C0]`                |

**WIRE-6 `[P]`** `envelopeVersion` is not a 3.0 key. The 2.0 integer
duplicated the major version, and VER-1 allows one version field. A 3.0
envelope that carries it is invalid under WIRE-1.

**WIRE-6a `[P]`** Every `availablePaths` entry is an identity listed in this
CLI's discovery ([DISC-6](discovery.md#discovery-data)), built-in commands
included. A CLI may list every public command or the subset it judges
relevant after this result. Presence grants no authority to run a command.
Absence forbids nothing. The 2.0 text did not say which of the two the list
means, and both are in use. Sorting is by code unit, so the order is the same
in every runtime.

## Result

**WIRE-7** Result keys:

| Key                      | Class       | Type and rule                                                                                                                                                 | Tag           |
| ------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `runId`                  | Required    | Unique invocation identity, preserved in recovery references                                                                                                  | `[C0]`        |
| `commandIdentity`        | Required    | Canonical identity, including the built-in dispatch, help and discovery identities. Never raw untrusted argv.                                                 | `[C0]`        |
| `outcome`                | Required    | `success`, `refused` or `failed`                                                                                                                              | `[C0]`        |
| `effectClass`            | Required    | `inspect`, `repository-local` or `external`. The command's declared stance, not a claim that an effect occurred.                                              | `[C0]`        |
| `transactionState`       | Required    | `unchanged`, `completed`, `partially-completed` or `unknown`                                                                                                  | `[C0]`        |
| `causeCode`              | Required    | An entry in this CLI's single cause owner (WIRE-14)                                                                                                           | `[C0]`        |
| `failureClass`           | Nullable    | `null` on success. Otherwise `internal`, `usage`, `domain`, `schema` or `transient`.                                                                          | `[C0]`        |
| `exitCode`               | Required    | `0`, `1`, `2`, `3`, `4` or `75`, agreeing with outcome and cause                                                                                              | `[C0]`        |
| `data`                   | Nullable    | A `JsonValue` on success, which may itself be `null`. `null` on refusal or failure.                                                                           | `[C0]`        |
| `retryable`              | Required    | Boolean set by the result table. `true` means an automatic same-input retry is safe after the delay, subject to the caller's existing authority.              | `[C0]`        |
| `retryDelayMilliseconds` | Conditional | Present exactly when `retryable` is `true`. Integer, at least 1, inside the station's declared bounds.                                                        | `[C0]`        |
| `repairAction`           | Nullable    | `null` on success. Otherwise guidance explaining the repair or the named handoff.                                                                             | `[C0]`        |
| `effects`                | Required    | Effects object (WIRE-10)                                                                                                                                      | `[C0]`        |
| `next`                   | Conditional | A next step ([next-steps.md](next-steps.md)). Exactly one of `next` and `handoff` is present.                                                                 | `[D 2]` `[P]` |
| `handoff`                | Conditional | A handoff (WIRE-9). Exactly one of `next` and `handoff` is present.                                                                                           | `[C0]`        |
| `bindings`               | Conditional | Run values for command arguments and resource identifiers ([STEP-10](next-steps.md#run-values)). Present exactly when the station's templates name a binding. | `[P]`         |
| `idempotencyKey`         | Optional    | Present only when the command accepted this key. Identity alone is not retry authorisation.                                                                   | `[C0]`        |
| `attemptedEffect`        | Optional    | An effect identifier. Only on `failed`. When present it appears in one Effects collection.                                                                    | `[C0]`        |

**WIRE-8 `[D 2]` `[P]`** `nextAction` is not a 3.0 key. `next` replaces it.
The key's name is proposed.

The optional `idempotencyKey` above is the 2.0 key, unchanged. The parked
decision 12 concerned a different thing: a key required on every changing
command.

## Handoff

**WIRE-9 `[C0]`** `Handoff` is strict `{ owner, reason, inspect, resource? }`:

- `owner`: `human` or `operator`.
- `reason`: why direct continuation is unsafe or unavailable.
- `inspect`: a nonempty array of safe, read-only inspection entries
  ([STEP-12](next-steps.md#handoff-inspection)). A placeholder executable or a
  mutating replay never qualifies.
- `resource`: optional strict `{ kind, id }`, both nonempty and nonsecret,
  naming an independently observable resource.

`[P]` A handoff means a person must act. A request to a person or a role is
always a handoff, never a next step ([STEP-7](next-steps.md#step-kinds)). The
plan reads decision 2 this way. The words are the planner's, not Nathan's.

## Effects

**WIRE-10 `[C0]`** `Effects` is strict
`{ completed, remaining, uncertain, inventoryComplete }`. The three
collections are arrays of effect identifiers: unique, mutually disjoint and
sorted. `inventoryComplete` is a boolean.

- An effect identifier names one intended domain effect at the command's
  declared granularity.
- `completed`: read-back confirmed.
- `remaining`: known not applied and still needed for the original operation.
- `uncertain`: applied or not applied is unproved.
- `inventoryComplete: false`: further effects may be missing from the lists.

**WIRE-11 `[C0]`** No collection is an executable queue or permission to
resume. At recovery, inspect uncertainty before any new effect and obtain any
separately required authority.

### Effect-state table

**WIRE-12 `[C0]`**

| State                 | Inventory | Completed    | Remaining    | Uncertain    | Constraint                                                                 |
| --------------------- | --------- | ------------ | ------------ | ------------ | -------------------------------------------------------------------------- |
| `unchanged`           | `true`    | empty        | zero or more | empty        | Confirmed no domain change. Success requires `remaining` empty.            |
| `completed`           | `true`    | one or more  | empty        | empty        | The whole intended effect set is confirmed complete                        |
| `partially-completed` | `true`    | one or more  | one or more  | empty        | Some effects confirmed complete, the others confirmed not applied          |
| `unknown`             | `true`    | zero or more | zero or more | one or more  | At least one known effect cannot be classified                             |
| `unknown`             | `false`   | zero or more | zero or more | zero or more | The inventory itself is incomplete. An empty `uncertain` is not certainty. |

**WIRE-13 `[C0]`**

- A preflight refusal is `unchanged` even when an unrelated older run needs
  inspection. Describe the older run in the handoff or its resource, not as
  this run's effects.
- An `inspect` command always has `unchanged`, `inventoryComplete: true` and
  three empty collections. A read failure never becomes an unknown domain
  effect because the returned data is uncertain. Evidence it finds about older
  runs belongs in `data` or a handoff.
- A changing command may succeed `unchanged` for a no-op or `completed` after
  effects. Its `commandIdentity` is the selected route's stable identity in
  both cases. Never rename a command after execution to distinguish its
  state. Both stations can be inspected in advance through discovery.
- Failure classes never override effect observations.

## Causes and exits

**WIRE-14 `[C0]`** One exit owner is exactly
`{ success: 0, internal: 1, usage: 2, domain: 3, schema: 4, transient: 75 }`.
One cause owner per CLI gives every cause exactly one failure class (`null`
for success), one allowed outcome and state pair, one retry behaviour and one
guidance arm. A success cause maps to exit 0. Every other cause maps to the
exit of its failure class. A name prefix is documentation and never selects a
class.

## Result truth table

**WIRE-15 `[C0]`** A refusal precedes any attempted change. `failed` means an
operation was attempted. `N` means `next` present and `handoff` absent. `H`
means `handoff` present and `next` absent.

| Outcome | State               | Failure class              | Exit                   | Retryable | Guidance | Meaning                                                                                  |
| ------- | ------------------- | -------------------------- | ---------------------- | --------- | -------- | ---------------------------------------------------------------------------------------- |
| success | unchanged           | null                       | 0                      | false     | N        | Cause `SUCCESS_UNCHANGED`. A read, preview or no-op succeeded. No domain effect remains. |
| success | completed           | null                       | 0                      | false     | N        | Cause `SUCCESS_COMPLETED`. All intended effects confirmed complete.                      |
| refused | unchanged           | usage                      | 2                      | false     | N or H   | Dispatch or input use declined before operation                                          |
| refused | unchanged           | schema                     | 4                      | false     | N or H   | Input or persisted-state shape rejected before operation                                 |
| refused | unchanged           | domain                     | 3                      | false     | N or H   | Permanent, authority or precondition refusal. Repair first.                              |
| refused | unchanged           | internal                   | 1                      | false     | N or H   | CLI preparation fault before operation. No automatic repetition.                         |
| refused | unchanged           | transient                  | 75                     | true      | N        | Temporary refusal. Same-input retry is safe after the delay.                             |
| failed  | unchanged           | internal                   | 1                      | false     | N or H   | The attempt failed. Unchanged is independently confirmed.                                |
| failed  | unchanged           | domain                     | 3                      | false     | N or H   | The attempt reached a domain failure. Unchanged confirmed.                               |
| failed  | unchanged           | schema                     | 4                      | false     | N or H   | The attempt met invalid persisted input. Unchanged confirmed.                            |
| failed  | unchanged           | transient                  | 75                     | true      | N        | The attempt failed temporarily. Unchanged confirmed. Same-input retry is safe.           |
| failed  | completed           | internal, domain or schema | 1, 3 or 4 respectively | false     | H        | Effects completed but the operation failed. Inspect completion.                          |
| failed  | partially-completed | internal, domain or schema | 1, 3 or 4 respectively | false     | H        | A known subset completed. Inspect before separately authorised recovery.                 |
| failed  | unknown             | internal, domain or schema | 1, 3 or 4 respectively | false     | H        | Some effect or the inventory is unconfirmed. Inspect before any retry.                   |

**WIRE-16 `[C0]`** Rules that follow from the table:

- `failed` with `usage` is invalid. Usage is decided before dispatch.
- `transient` with `completed`, `partially-completed` or `unknown` is invalid.
  A temporary dependency event after an uncertain mutation uses the applicable
  domain, internal or schema cause with `unknown`, never exit 75. An
  unconfirmed provider response is a domain uncertainty. A corrupt journal is
  a schema uncertainty. A local read-back lost to a CLI failure is an internal
  uncertainty. Each such cause has its own catalogue entry.
- Automatic same-input retry exists only for a transient, confirmed-unchanged
  refusal or failure. Completed, partial and unknown effects are never
  retried automatically.
- A failed operation with completed effects is handed off for inspection. It
  is never repeated.
- In an `N or H` row, each station chooses one arm. It never varies between
  arms under one identity. Materially different recovery needs a distinct
  cause or command meaning, not an extra station identifier.

**WIRE-17 `[D 2]` `[P]`** The guidance arm also constrains the step kind:
a result with `retryable: true` carries `next.kind` `retry`, and no other
result does ([STEP-4](next-steps.md#step-kinds)).

## Common causes

**WIRE-18 `[C0]`** Common entries. Each is a catalogue entry only for a
command where it is reachable. An impossible entry needs a reviewed
unreachable rationale ([DISC-8](discovery.md#command-discovery-data)). The guidance column is `[P]` where it names a
step kind or is marked.

| Cause                          | Class     | Outcome and state           | Guidance                                                                                                                                                  |
| ------------------------------ | --------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUCCESS_UNCHANGED`            | null      | success, unchanged          | N: `done`, or the step that follows a read or no-op                                                                                                       |
| `SUCCESS_COMPLETED`            | null      | success, completed          | N: `done`, or the step that follows a completed operation                                                                                                 |
| `USAGE_INVALID_INVOCATION`     | usage     | refused, unchanged          | N: inspect help and correct the invocation                                                                                                                |
| `USAGE_UNKNOWN_COMMAND`        | usage     | refused, unchanged          | N: select an identity from `availablePaths`                                                                                                               |
| `SCHEMA_INVALID_INPUT`         | schema    | refused, unchanged          | N: correct the named input shape                                                                                                                          |
| `SCHEMA_UNSUPPORTED_CONTRACT`  | schema    | refused, unchanged          | N: use a reader that accepts the observed version, or a producer this reader accepts. No adaptation. `[P]`: 2.0 said to select or produce contract 2.0.0. |
| `DOMAIN_PRECONDITION_UNMET`    | domain    | refused, unchanged          | N: repair the named permanent precondition                                                                                                                |
| `DOMAIN_AUTHORITY_REQUIRED`    | domain    | refused, unchanged          | H: the named authority owner                                                                                                                              |
| `TRANSIENT_NOT_STARTED`        | transient | refused, unchanged          | N: `retry`                                                                                                                                                |
| `TRANSIENT_ATTEMPT_UNCHANGED`  | transient | failed, unchanged           | N: `retry`                                                                                                                                                |
| `DOMAIN_DEADLINE_BEFORE_START` | domain    | refused, unchanged          | N: inspect the deadline and input, then explicitly decide a new run                                                                                       |
| `DOMAIN_DEADLINE_UNCHANGED`    | domain    | failed, unchanged           | N: inspect the deadline and input, then explicitly decide a new run                                                                                       |
| `DOMAIN_DEADLINE_COMPLETED`    | domain    | failed, completed           | H: inspect confirmed completed effects                                                                                                                    |
| `DOMAIN_DEADLINE_PARTIAL`      | domain    | failed, partially-completed | H: inspect known partial effects                                                                                                                          |
| `DOMAIN_DEADLINE_UNKNOWN`      | domain    | failed, unknown             | H: inspect uncertain effects                                                                                                                              |
| `INTERNAL_PREPARATION`         | internal  | refused, unchanged          | N: repair the CLI or runtime before another run                                                                                                           |
| `INTERNAL_RESULT_UNCHANGED`    | internal  | failed, unchanged           | H: inspect failed result production                                                                                                                       |
| `INTERNAL_RESULT_COMPLETED`    | internal  | failed, completed           | H: inspect completed effects and result production                                                                                                        |
| `INTERNAL_RESULT_PARTIAL`      | internal  | failed, partially-completed | H: inspect partial effects and result production                                                                                                          |
| `INTERNAL_RESULT_UNKNOWN`      | internal  | failed, unknown             | H: independently inspect effect state                                                                                                                     |

**WIRE-19 `[C0]`** A domain-specific cause is command-owned. It is admitted
before implementation with exactly one allowed row and concrete guidance. A
further success meaning under one command and state needs its own reviewed
success cause, with `null` failure class and exit 0. It never reuses the two
generic success causes with conflicting guidance. The two success rows of
WIRE-15 name the generic causes. A reviewed further success cause takes the
row of its state.

**WIRE-20 `[P]`** Inside one CLI the cause vocabulary is closed and typed. To
a reader of another CLI's output it is open: an unknown cause is handled by
its `outcome` and `failureClass`
([VER-7](versioning.md#closed-and-open-vocabularies)).
