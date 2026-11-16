# Next steps and handoffs

Candidate text for Command Contract 3.0. Not accepted, not binding. Read
[index.md](index.md) first for clause tags and status.

A4 accepts `command`, `retry`, `instruction` and `done`. A6 accepts validated
run values in arguments and resource IDs while command names and guidance stay
fixed. Exact keys and validation rules below are candidate wording.

## Authority

**STEP-1 `[D 2]` `[P]`** A next step is a suggestion. It grants no permission,
approval or authority to run anything. The caller's own authority rules
decide whether a suggested step runs.

**STEP-2 `[D 2]` `[P]`** A step may name a changing command. Naming it does not
make it safe to run.

## Step kinds

**STEP-3 `[D 2]` `[P]` `[A 4]`** `next` is a strict discriminated union on `kind`.
At 3.0.0 it has four members:

| `kind`        | Other keys        | Meaning to the caller                                                          |
| ------------- | ----------------- | ------------------------------------------------------------------------------ |
| `command`     | `command`, `args` | Run this declared command with these arguments                                 |
| `retry`       | none              | Run the same command again with the same input, after `retryDelayMilliseconds` |
| `instruction` | `text`            | No command expresses the step. Do what the text says.                          |
| `done`        | none              | Nothing further is required                                                    |

**STEP-4 `[P]` `[A 4]`** `retry` is present exactly when `retryable` is `true`.
A result with `retryable: true` carries no other kind, and a result with
`retryable: false` never carries `retry`.

**STEP-5 `[P]` `[A 4]`** `done` is legal only when `outcome` is `success`. It
replaces the 2.0 sentence `No further action required.`

**STEP-6 `[D 2]` `[P]`** A `command` step is strict
`{ kind, command, args }`:

- `command` is the canonical identity of a command this CLI declares in
  discovery. An identity discovery does not list is invalid.
- `args` is an array of strings and may be empty. Each element is exactly one
  argv token, placed after the command's route. Elements may be empty strings.
- No element is evaluated by a shell.
- The global `--json` switch is the caller's choice and never appears in
  `args`.
- Check the final argument vector against the named command's generated input
  schema (INPUT-2 to INPUT-5). Discovery checks syntax and declared constraints;
  executing the command revalidates input, current resources and authority. A
  well-shaped suggestion is not evidence that its effect is safe.

**STEP-7 `[D 2]` `[P]`** An `instruction` step is strict `{ kind, text }`.
`text` addresses the calling agent. A request to a person or a role is a
handoff ([WIRE-9](wire.md#handoff)), because the contract already names who
must act there. A `next` instruction never asks a person to act.

**STEP-8 `[D 8]` `[P]`** The kinds are a union the contract owns. They are
closed at each minor, and a later minor may add a kind
([VER-5](versioning.md#what-a-minor-may-change)). Real output also needs
steps this first set does not express:

| Need                              | At 3.0.0                                                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| A repair, then a retry            | `repairAction` states the repair. `next` is the first concrete step: a `command` that performs or checks the repair, or an `instruction`. |
| Two steps in order                | An `instruction`                                                                                                                          |
| A choice among commands           | An `instruction`, with the candidates in `availablePaths`                                                                                 |
| A value the caller must supply    | An `instruction`                                                                                                                          |
| A condition the caller must check | An `instruction`                                                                                                                          |

Each row is a candidate for a new kind in a later minor.

## Guidance templates

**STEP-9 `[C0]`** The guidance and repair strings a station declares are
templates. Substitution happens in strings only. It never changes object
structure and never introduces a shell evaluation step. The accepted
substitutions are exactly five:

| Token                | Renders                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `{runId}`            | The result's `runId`                                                                              |
| `{completedEffects}` | `effects.completed` as a canonical JSON array                                                     |
| `{remainingEffects}` | `effects.remaining` as a canonical JSON array                                                     |
| `{uncertainEffects}` | `effects.uncertain` as a canonical JSON array                                                     |
| `{idempotencyKey}`   | The result's `idempotencyKey`. A station that uses it requires that key on every matching result. |

Any other brace token is invalid, except the binding token of STEP-10. A
literal instruction may refer the caller to `message` for an invalid field
name, a bounded observed version value or another specific error detail.
Those details need no token.

**STEP-9a `[P]`** In 3.0 the strings open to substitution are:
`repairAction`, `instruction.text`, each element of a `command` step's `args`,
and the `reason`, `resource.kind` and `resource.id` of a handoff, including
the `text` and `args` of entries inside `handoff.inspect`. Substitution never splits or joins `args`
elements. `command` and `kind` are never templates.

A value that any token renders into an `args` element or into `resource.id`
meets the value rule of STEP-10. `{idempotencyKey}` is the token at risk,
because the caller chose the key: a key of `--force` would become an option.
A command whose stations render the key there accepts only keys that meet
the rule, and refuses any other as invalid input.

## Run values

**STEP-10 `[P]` `[A 6]`** Some guidance needs a value known only at run time, such
as the identifier a preview just issued. The accepted contract allows the
five substitutions above and says any other binding needs an explicit
revision. A6 selects this extension; its exact shape is proposed:

- A station template may contain `{binding.<name>}`. `<name>` matches
  `^[a-z][A-Za-z0-9]*$`.
- The token appears only as a whole `args` element, in a `command` step or a
  `command` inspection entry, or as the whole of `resource.id`. It never
  appears in `instruction.text`, `repairAction`, `reason` or `resource.kind`.
  Text an agent or a person reads as guidance stays the station's fixed
  words, so a run value can never carry an order.
- A value is a nonempty, nonsecret string of at most 1,024 UTF-8 bytes. It
  is not only whitespace, holds no character of Unicode category Cc, Cf, Zl
  or Zp, and does not begin with `-`, so it can never become an option the
  station's author did not write or fake a new line for a reader.
- A value rendered into `args` never equals a route token of any command
  the CLI declares. A reader judges this from discovery. It keeps a run
  value from choosing the command only where the CLI's router matches route
  tokens exactly, which the base's router is required to do `[P]`.
- A result whose station templates name at least one binding carries
  `bindings`: a strict object with exactly those names as keys.
- A result whose station templates name no binding carries no `bindings` key.
- Discovery shows the templates with their tokens unsubstituted. A test
  substitutes the result's own fields and `bindings`, then compares the
  emitted guidance with the declared template.

Every bound value is validated before use, including values from earlier output.
Validate every caller-supplied value that may become a binding against STEP-10
and the target input slot before any guard or effect, not only idempotency keys.
For generated values, validate at their creation boundary before any effect
dependent on them; the writer still revalidates before output.
The target input declaration owns allowed value semantics (INPUT-4); token
filtering alone cannot establish those semantics or prove absence of secrets.

## Handoff inspection

**STEP-12 `[C0]` `[P]`** A `handoff.inspect` entry is an inspection entry,
not a next step. It reuses two step shapes. Each entry is one of:

| Shape                                | Rule                                                                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{ kind: "command", command, args }` | As STEP-6, and the named command's effect class is `inspect`                                                                                            |
| `{ kind: "instruction", text }`      | Read-only observation of an independently observable resource. Unlike a `next` instruction (STEP-7), it addresses the handoff's owner, who is a person. |

`retry` and `done` are never inspection entries. A command whose effect class
is not `inspect` is never an inspection entry. The 2.0 rule is unchanged:
inspection is read-only, and a command entry resolves to a real public
read-only route. What changes is that the entry is structured, so a reader
can check both.

**STEP-13 `[P]`** An inspection command reports the state the handoff is
about. A command that reports nothing pending while a change is unfinished
does not qualify ([DISC-14](discovery.md#if-no-result)).

## Station agreement

**STEP-14 `[C0]` `[P]`** The emitted `next` or `handoff` equals the declared
station's guidance after substitution. Changing the safe action, the delay
rule or the inspection route needs a distinct station meaning. A comparison
covers all material guidance, delay and repair semantics, not the guidance
arm alone.

**STEP-15 `[A 13]` `[P]`** A `retry` station is declared only where the
blocking condition clears without the caller performing a repair and the
unchanged state is proven. A generic held-lock refusal remains a handoff:
neither owner death nor a safe takeover is established by elapsed time.
Bounded waiting and qualified automatic reclaim happen inside the command
under REC-7, before a final result, and never replay an interrupted effect.

## How these rules are checked

**STEP-16 `[P]`** The validator and the checker judge shape, presence,
correlation, resolution and template agreement
([V-12, V-14, V-39](verification.md#checks)). Four rules can be judged only
by review, because they are about meaning: that an `instruction` addresses
the agent and never a person (STEP-7); that a binding value is not a secret
(STEP-10); that an `instruction` inspection entry is read-only (STEP-12);
and that an inspection command reports the state the handoff is about
(STEP-13). The input declaration must state special keywords and their constraints
(INPUT-4). Runtime state, authority, secret classification and instruction
meaning still require runtime checks and review. A schema alone proves none
of them.
