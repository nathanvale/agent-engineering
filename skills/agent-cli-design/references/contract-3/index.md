# Command Contract 3.0: candidate index

**Status: candidate. Not accepted, not binding, not implemented.** Nathan
accepts exact bytes after an independent review
([review.md](review.md)). Until then the accepted 2.0 contract (C0 revision 2)
is the only binding contract, and every existing CLI stays on it
([ROLL-1](adoption.md#which-contract-binds)).

Command Contract 3.0 is the accepted 2.0 contract, changed only where a
numbered decision of 15 November 2026 changes it, plus the proposals marked
below that those decisions leave to this text.

## Read by task

| Task                                                                        | Read                                             |
| --------------------------------------------------------------------------- | ------------------------------------------------ |
| Produce or validate an envelope                                             | [wire.md](wire.md)                               |
| Say what the caller does next, or hand off to a person                      | [next-steps.md](next-steps.md)                   |
| Help, discovery, stations, the route for a lost response                    | [discovery.md](discovery.md)                     |
| Read another CLI's output, or stamp a version                               | [versioning.md](versioning.md)                   |
| Signals, deadlines, pipes, crashes, the writer, the fallback                | [lifecycle.md](lifecycle.md)                     |
| Diagnostics status, custody and limits                                      | [diagnostics.md](diagnostics.md)                 |
| Declare a command, pick add-ons, run programs, change state, check approval | [commands-and-addons.md](commands-and-addons.md) |
| Input declarations, argument schemas and validation                         | [input-schema.md](input-schema.md)               |
| Unfinished operations, scope, closure and lock reclaim                      | [recovery.md](recovery.md)                       |
| Types, compile-time locks, the selected lint rules                          | [static-gates.md](static-gates.md)               |
| Existing 2.0.0 CLIs, the kept checker, rollback, what makes this binding    | [adoption.md](adoption.md)                       |
| See a whole envelope                                                        | [examples.md](examples.md)                       |
| Prove a requirement, or find its failing control                            | [verification.md](verification.md)               |
| Trace a clause to its source                                                | [requirement-map.md](requirement-map.md)         |
| Decide what is still Nathan's                                               | [decisions.md](decisions.md)                     |

## Clause tags

Every normative clause has an identifier and at least one tag. The tag says
who owns the clause's content.

| Tag     | Meaning                                                                                                                                   |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `[C0]`  | Carried from the accepted 2.0 contract (C0 revision 2). Same meaning. Wording changes only to use 3.0 names.                              |
| `[LO]`  | Carried from the accepted lifecycle and observability specification, revision 1.                                                          |
| `[TS4]` | Carried from the accepted template and skill specification, revision 4.                                                                   |
| `[SK]`  | Carried from the released 2.0 skill references. Delivered guidance, not located in an accepted specification by the drafter.              |
| `[D n]` | Follows Nathan's decision `n` of 15 November 2026. The direction is his.                                                                  |
| `[P]`   | Proposed wording by the drafter. Nathan has not accepted it.                                                                              |
| `[A n]` | Accepted direction in [the subsequent decision record](accepted-decisions-2026-11-15.md). Exact contract wording still awaits acceptance. |

A clause tagged `[D n]` together with `[P]` means: he decided the direction,
and the exact words are proposed.

An omitted combination is invalid. A result is valid only when it satisfies
every applicable table row and key rule. `[C0]`

## Clause prefixes

| Prefix  | File                   |
| ------- | ---------------------- |
| `WIRE`  | wire.md                |
| `STEP`  | next-steps.md          |
| `DISC`  | discovery.md           |
| `VER`   | versioning.md          |
| `LIFE`  | lifecycle.md           |
| `DIAG`  | diagnostics.md         |
| `CMD`   | commands-and-addons.md |
| `INPUT` | input-schema.md        |
| `REC`   | recovery.md            |
| `GATE`  | static-gates.md        |
| `ROLL`  | adoption.md            |
| `V`     | verification.md        |

Lock identifiers `N1` to `N10`, `M1` to `M3` and `R1` to `R4` are the accepted
compile-time locks. They are not clause identifiers.

## Words

- **Envelope:** the outer JSON object a CLI prints in machine mode.
- **Station:** one declared result a command can produce: the tuple (command
  identity, outcome, cause) with its fixed words.
- **Changing command:** a command whose effect class is `repository-local` or
  `external`.
- **Reader:** a program that parses an envelope, such as the checker.
  **Producer:** the CLI that printed it.
- **Kernel:** the stamped, dependency-free base every 3.0 CLI carries.
- **Foundation:** the template, composer, checker, exemplar and this skill.
- **Lock:** a program that must fail to compile, kept as a test.
- **Failing control:** the one deliberate defect that must turn a check red.

## Scope of 3.0.0

In: the accepted 2.0 contract; a new wire (decision 1); structured next steps
(decision 2); the version rule (decision 8); the route for a lost response
(decisions 10 and 11); one base plus add-ons (decisions 18 and 20); one
built-in validator (decision 19); the selected lint rules (decisions 4 and 5, A15 and A16); and A1 to A20
as mapped in [requirement-map.md](requirement-map.md#subsequent-accepted-decisions).

Parked by Nathan, not in 3.0.0: a caller-chosen key on every changing command
(decision 12); a safe-to-repeat flag (decision 13); an identity for the
command list on every result (decision 14). Each can arrive in a later minor
as an optional addition.

Out of this text: implementation, the checker build, migration of any existing
CLI, installation and release.
