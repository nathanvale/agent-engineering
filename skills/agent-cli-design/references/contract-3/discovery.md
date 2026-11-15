# Help, discovery and stations

Candidate text for Command Contract 3.0. Not accepted, not binding. Read
[index.md](index.md) first for clause tags and status.

## Invocations

**DISC-1 `[C0]` `[A 10]`**

| Invocation                                              | Built-in identity         | Behaviour                                                                        |
| ------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------- |
| `<cli> --help`                                          | `<cli>.help`              | Human help, stdout, exit 0                                                       |
| `<cli> --help --json`                                   | `<cli>.help`              | One success, unchanged, inspect envelope. `data` is `HelpData`.                  |
| `<cli> --discover`                                      | `<cli>.discovery`         | Human summary of `DiscoveryData`, stdout, exit 0                                 |
| `<cli> --discover --json`                               | `<cli>.discovery`         | One success, unchanged, inspect envelope. `data` is `DiscoveryData`.             |
| `<cli> --discover-command <canonical-command-identity>` | `<cli>.command-discovery` | Human rendering for exactly one selected command                                 |
| The same with `--json`                                  | `<cli>.command-discovery` | One success, unchanged, inspect envelope. `data` is `CommandDiscoveryData`.      |
| Unknown selected identity                               | `<cli>.command-discovery` | Refused, unchanged, `USAGE_UNKNOWN_COMMAND`, exit 2                              |
| Missing selector, or incompatible built-in options      | `<cli>.dispatch`          | Refused, unchanged, `USAGE_INVALID_INVOCATION`, exit 2                           |
| No arguments                                            | `<cli>.dispatch`          | The same usage refusal. Human mode: one stderr line. Machine mode: one envelope. |

**DISC-2 `[C0]`** `--json` is a global switch recognised before `--`, in any
argv position. Tokens after `--` are operands and never toggle the mode. The
built-in help and discovery options are mutually exclusive. Command options
come from the command owner. No request returns every command's stations at
once.

**DISC-2a `[TS4]`** An unavailable domain integration never prevents root
help, discovery or an unrelated command from loading. A CLI does not
initialise every provider or perform network work to list commands.

## Help data

**DISC-3 `[C0]`**

- `HelpData = { usage, summary, commands: CommandSummary[], options: OptionSummary[] }`
- `CommandSummary = { commandIdentity, route: string[], summary, effectClass }`
- `OptionSummary = { name, valueName: string | null, summary }`

Every summary derives from the command owner. Command identities are unique.
`route` is the argv tokens after the executable.

**DISC-4 `[C0]` `[A 10]` `[P]`** `route` is empty only for a root operation and for
`<cli>.dispatch` `[P]`. At most one host command is a root operation, and it
requires at least one option or operand, so the no-argument invocation stays
with dispatch (DISC-1) `[A 10]`. The 2.0 text allowed both without saying how
they are told apart, and the 2.0 checker itself declares both with an empty
route.

## Built-in commands are declared

**DISC-5 `[P]`** The four built-in identities are declared commands. The 2.0
text was silent here, and that silence is why the released 2.0 starters fail
the strict checker: their envelopes name built-in identities that their
discovery never lists.

| Identity                  | `route`                  | `effectClass` |
| ------------------------- | ------------------------ | ------------- |
| `<cli>.help`              | `["--help"]`             | `inspect`     |
| `<cli>.discovery`         | `["--discover"]`         | `inspect`     |
| `<cli>.command-discovery` | `["--discover-command"]` | `inspect`     |
| `<cli>.dispatch`          | `[]`                     | `inspect`     |

- Each appears in `DiscoveryData.commands`.
- Each answers `--discover-command` with its own stations.
- Each may appear in `availablePaths` and as a `command` step.
- `HelpData.commands` lists host commands. `HelpData.options` describes the
  built-in switches.

Removing any of the four from discovery is a contract violation.

## Discovery data

**DISC-6 `[C0]` `[D 1]` `[P]`**

```text
DiscoveryData = {
  contractVersion,          // equals the envelope's contractVersion
  commands: CommandSummary[],
  exitMeanings: { "0": "success", "1": "internal", "2": "usage",
                  "3": "domain", "4": "schema", "75": "transient" },
  signalExits: { "130": "SIGINT", "143": "SIGTERM" },
  effectExclusions: string[]
}
```

- `contractVersion` is a copy of the one version field and equals it
  ([VER-1](versioning.md#the-version-value)).
- `effectExclusions` discloses journal and diagnostic maintenance, which are
  not domain effects ([DIAG-13](diagnostics.md#custody-and-limits)).
- `profile` is not a 3.0 key. Decision 18 replaced the two profiles with
  rules that follow each command, and each `CommandSummary` already carries
  the command's `effectClass`. `[D 18]` `[P]`
- `generationConventionVersion` is not a 3.0 key. `[P]`

## Command discovery data

**DISC-7 `[C0]` `[D 11]` `[P]` `[A 12]`**

```text
CommandDiscoveryData = {
  command: CommandSummary,
  semantics: "possible-outcomes",
  ifNoResult: CommandStep | null,     // DISC-13
  input: InputSchema,               // INPUT-2, generated from executable input declarations
  stations: PublicStation[]
}
```

**DISC-8 `[C0]` `[D 2]`**

```text
PublicStation = {
  commandIdentity, outcome, causeCode, failureClass, exitCode,
  effectClass, transactionState, retryable, retryDelayPolicy,
  trigger, guidance, repairAction, reachability, unreachableRationale
}
```

- Scalar keys follow the result rules in [wire.md](wire.md). `trigger` is
  nonempty.
- `retryDelayPolicy` is strict `{ kind: "none" }` when `retryable` is
  `false`. When `true` it is strict
  `{ kind: "bounded", minimumMilliseconds, maximumMilliseconds }`. Both bounds
  are positive safe integers and the maximum is at least the minimum. Equal
  bounds are a fixed delay.
- Every emitted `retryDelayMilliseconds` falls inside those bounds,
  inclusive. The command owner justifies the safe lower bound and the finite
  upper bound. A materially different retry policy needs a distinct station.
- `guidance` is strict `{ next }` or strict `{ handoff }`, holding the
  station's templates ([STEP-9](next-steps.md#guidance-templates)). `[D 2]`
- `repairAction` is `null` for a success station, otherwise a template.
- `reachability` is `required` or `declared-unreachable`.
  `unreachableRationale` is `null` for `required`, otherwise a reviewed
  reason. Reviewed unreachable means impossible, not untested.
- A `PublicStation` carries no `runId`, no current effect identifiers and no
  claim about current state. A published inspection example is descriptive.
  It is never executable authority.

## Stations

**DISC-9 `[P]` `[A 11]`** A command lists each result it can produce once, as a
station. Code that produces a result selects a declared station and supplies
only this run's facts: the run identity, `message`, `data`, effects, the
attempted effect, the delay, any accepted `idempotencyKey` and any bindings. The station's fixed fields and words come from the declaration and
cannot be overridden by the run's facts. Discovery is a projection of the
same declaration, so the words exist in one place.

A11 accepts generation from executable declarations. Exact station APIs remain
engineering; declarations describe possible outcomes, not present state or
authority. A12 requires the input schema from the same executable owner; see
[input-schema.md](input-schema.md). A10 settles no-command exit 2 and help exit 0.

**DISC-10 `[C0]` `[D 18]` `[P]`** An `inspect` command that declares no
approval and no cause of its own may omit a station table. Its finite result
descriptions are then derived from the same command declaration. DISC-9
never removes this. In 2.0 the allowance belonged to a simple-profile CLI,
where every command was `inspect` and no other trigger applied. Decision 18
moved the rules to each command, so the allowance now follows the command,
including in a CLI that also has changing commands.

The derived description is one success station, `SUCCESS_UNCHANGED` with
`next` `done` and a `trigger` taken from the command's summary, plus the
stations the base adds (DISC-11). The 2.0 text never said what is derived.

### Kernel-supplied stations

**DISC-11 `[P]`** Some results are produced by the base, not by the command's
handler: usage and input refusals, deadline results, approval denials, state
refusals and the fallback. Each is a station of the command whose identity it
carries, and appears in that command's `stations`. Observed is declared then
holds for every envelope a CLI can print, the fallback included.

| Applies to                                           | Stations the base adds                                                                                                                                                                                            |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every host command                                   | `USAGE_INVALID_INVOCATION`, `SCHEMA_INVALID_INPUT` (where the command takes input), `INTERNAL_PREPARATION`                                                                                                        |
| Every `inspect` command, built-in or host            | `INTERNAL_RESULT_UNCHANGED`                                                                                                                                                                                       |
| Every changing command                               | `INTERNAL_RESULT_UNCHANGED`, `INTERNAL_RESULT_COMPLETED`, `INTERNAL_RESULT_UNKNOWN`. The command itself declares distinct held-lock and unresolved-case refusals ([CMD-12](commands-and-addons.md#state-add-on)). |
| A changing command that declares two or more effects | `INTERNAL_RESULT_PARTIAL`. A single effect cannot be partial ([WIRE-12](wire.md#effect-state-table)).                                                                                                             |
| A command that declares deadline support             | The five `DOMAIN_DEADLINE_*` causes its effect class can reach                                                                                                                                                    |
| A command that declares approval                     | `DOMAIN_AUTHORITY_REQUIRED`                                                                                                                                                                                       |
| `<cli>.dispatch`                                     | `USAGE_INVALID_INVOCATION`, `USAGE_UNKNOWN_COMMAND`, `INTERNAL_PREPARATION`                                                                                                                                       |
| `<cli>.help`, `<cli>.discovery`                      | `SUCCESS_UNCHANGED`, `INTERNAL_PREPARATION`                                                                                                                                                                       |
| `<cli>.command-discovery`                            | `SUCCESS_UNCHANGED`, `USAGE_UNKNOWN_COMMAND`, `INTERNAL_PREPARATION`                                                                                                                                              |

A built-in option error is refused as `<cli>.dispatch` (DISC-1), so the three
other built-ins carry no usage station of their own.

**DISC-11b `[C0]` `[P]`** The base supplies default words for each station
it adds. The command owner still selects repair and guidance content `[C0]`:
a command may declare one of these tuples itself, and its declared words then
apply to every result with that tuple, whether the handler or the base
produced it. One tuple keeps one set of words and one delay policy
(DISC-8, DISC-12). A handler may select such a station for its own results,
for example `SCHEMA_INVALID_INPUT` for a bad persisted-state shape. A handler
that needs a different delay policy uses another cause.

The stations the fallback can select are the exception: `INTERNAL_PREPARATION`
and every `INTERNAL_RESULT_*`. A command never declares these tuples, and a
declaration that does is rejected. Their words are the base's fixed literals,
with no binding and no `{idempotencyKey}`, using only 3.0.0 members, inside
the fallback's size and depth limits. A command identity is at most 128
UTF-8 bytes, checked at declaration, because the fallback copies it `[P]`. The fallback can therefore always be
produced ([LIFE-9](lifecycle.md#fallback)). For a changing command, the base
builds each `INTERNAL_RESULT_*` handoff with an inspection entry naming the
command's `ifNoResult` command, so a broken result points at the same
read-only route as DISC-13. The base's default handoff for the
`DOMAIN_DEADLINE_COMPLETED`, `DOMAIN_DEADLINE_PARTIAL` and
`DOMAIN_DEADLINE_UNKNOWN` stations of a changing command inspects with it
too.

### Identity and reachability

**DISC-12 `[C0]`**

- Station identity is the tuple (`commandIdentity`, `outcome`, `causeCode`).
  No station identifier appears on the wire. Where a test needs a key, it is
  the JSON serialisation of the three-element tuple.
- Two stations with one tuple and different words are invalid.
- A new CLI needs agreement in both directions: every observed result is a
  declared station, and every required station is reached by a process test.
- Internal station entries add a nonempty `independentObservable` pointing at
  independent process evidence. It is a pointer, not an independently
  authored oracle, and it is omitted from `PublicStation`.
- Expected effects, retry safety, causes and recovery instructions used by
  tests are authored separately from the production catalogue and the
  implementation, from this contract and the command brief. A test compares
  real resource observations and recovery behaviour with those independent
  expectations. A wrong catalogue agreeing with a wrong implementation proves
  nothing.
- An existing CLI adopted intentionally may keep the accepted reviewable gap
  baseline without claiming full coverage. New or changed stations stay
  strict `[SK]`.

## If no result

**DISC-13 `[D 11]` `[P]`** Every changing command declares one read-only
command to run when the caller received no result `[D 11]`. `ifNoResult` in
that command's `CommandDiscoveryData` is a `command` step
([STEP-6](next-steps.md#step-kinds)) naming it. For an `inspect` command
`ifNoResult` is `null`: running it again is safe. A changing command with a
`null` `ifNoResult`, or one naming a command that is undeclared or not
`inspect`, is invalid. Its `args` are literal: at most 16 elements, no
brace token, and no character of Unicode category Cc, Cf, Zl or Zp. The
whole step, encoded as JSON, is at most 2,048 UTF-8 bytes. The rule is
checked when the command is declared, because the base copies the step into
the fallback ([DISC-11b](#kernel-supplied-stations)). The key's name, place and shape are proposals
([decisions.md](decisions.md)).

**DISC-14 `[D 11]` `[A 1]` `[A 2]` `[P]`** The named command:

1. is declared `inspect`, needs exactly its published literal arguments and
   performs no domain effect, journal repair or settlement;
2. reads journal and resource evidence and never replays an effect;
3. returns `data.unfinished`, listing every unresolved intent, including live,
   partial and unknown runs. A valid completion, a confirmed not-applied record written by its own run,
   or REC-4 closure ends that
   listing; it never deletes history;
4. represents each entry as strict `{ operationId, commandIdentity, runId, effects }`, with
   sorted unique declared effect identifiers. `operationId` is the durable REC-1 identity used by the recovery/history
   routes. Effects are effect names, not
   resource scopes and not proof that an entry belongs to the caller;
5. refuses honestly if it cannot read a complete trustworthy report. It never
   presents inaccessible or corrupt state as an empty successful report.

One command may serve several changing commands. Closure history remains
available through a separately declared read-only route under REC-6. Neither
an empty list nor a disappeared entry proves the lost invocation did not run.

**DISC-14a `[C0]` `[P]`** The report declares its success station explicitly,
using a fixed instruction or declared command for the next inspection. It
never derives `done` merely because its own read completed. The caller reads
`data.unfinished` for pending cases; diagnostics may assist diagnosis but never
own recovery truth. All guidance follows STEP-1 to STEP-16.

**DISC-15 `[D 11]` `[A 1]` `[A 2]` `[P]`** After no complete response:

1. Run `ifNoResult` before deciding whether to perform more affected work.
   Never repeat the lost operation first.
2. Inspect listed cases and follow their recovery route. A nonempty report
   is not a global freeze: a new operation proceeds only when the state
   add-on proves its operations and resources independent (REC-2). The caller
   cannot establish independence from different command names alone.
3. An empty report does not prove non-application or identify the lost run.
   Inspect the resource and retained history. Any further domain operation
   is an explicit new decision under current authority, never automatic replay.
4. Preserve unknown outcomes after human closure. Closing releases only the
   resolved coordination obligation, not uncertainty or permission to repeat.

Caller-chosen keys on every changing command and a safe-to-repeat flag remain
parked (D12, D13). The read-only report cannot promise correlation unavailable
from those decisions. REC-6 names that limitation explicitly.
