# Types, locks and lint

Candidate text for Command Contract 3.0. Not accepted, not binding. Read
[index.md](index.md) first for clause tags and status.

Static gates catch a wrong program before it runs. They never replace the
runtime writer, the checker or a process test.

## Toolchain

**GATE-1 `[TS4]`** Compilation is native TypeScript 7.0.2 and is the verdict.
ESLint reads types through the TypeScript 6 API. Biome formats only. The pin
does not move without Nathan's decision. A TypeScript 7.1 beta observation is
research only and adds no second compiler-version acceptance requirement.

## What types do not prove

**GATE-2 `[C0]` `[P]`** Each row names the gate that does prove it:

| Types cannot prove                                                                                                                        | Proved by                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| That a result is honest: "unchanged" and "refused" are representable, not verified                                                        | Journal and resource read-back; process tests against independent expectations ([DISC-12](discovery.md#identity-and-reachability)) |
| That guidance is actionable, or that an inspection command exists and is read-only                                                        | The checker resolving steps against discovery ([V-12](verification.md#checks))                                                     |
| That a brand was earned. A brand vanishes at run time and a cast forges it.                                                               | Runtime validation at the boundary; the assertion rule (GATE-9)                                                                    |
| Value rules: sorted, unique and disjoint effect lists; a delay inside its bounds; attempted-effect membership; nonempty strings; no `NaN` | The runtime validator ([LIFE-8](lifecycle.md#writer))                                                                              |
| That a spread, `Object.assign`, a mutable alias or `JSON.parse` did not rewrite a checked value after it was built                        | The runtime validator, immediately before serialisation                                                                            |
| The actual exit code of the process                                                                                                       | A process test comparing the real exit with the envelope ([V-9](verification.md#checks))                                           |
| Serialisation: cycles, depth, `undefined`, dates, bigint                                                                                  | The writer's JSON guard ([LIFE-7](lifecycle.md#writer))                                                                            |
| Authority, effects and anything about access                                                                                              | Runtime guards and process tests. A brand or a directory layout grants no filesystem, instruction or credential isolation.         |

A compiler pass alone never qualifies serialisation, authority, effects or an
actual exit.

## The typed owner

**GATE-3 `[C0]` `[P]`** One typed owner per repository holds the contract:
the stamped shared file, identical everywhere, plus that CLI's own cause
table.

- The exit set and the cause table are literal tables checked with
  `as const satisfies`.
- The result truth table ([WIRE-15](wire.md#result-truth-table)) is written
  once as a type. A cause row that breaks it fails to compile at that row.
- Each cause row carries its exit, and the row type ties the exit to the
  failure class.
- A success cause is bound to its state, and success requires nothing
  remaining.
- Each result type is looked up from its cause. The union is built by mapping
  then indexing. Prefer direct lookups where they express the correlation clearly. Genuine
  generics are allowed (A16); this contract imposes no arbitrary one-generic
  limit or blanket ban on conditional types.
- The same legal rows also exist as a runtime value, because types are erased
  at run time. The validator reads that value.

How the shared types reach a per-CLI cause table they do not contain is not
proved. It is a build obligation.

**GATE-4 `[P]`** Construction rules, each closing a hole a review compiled:

| Rule                                                                             | Hole it closes                                                                                      |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| A builder writes the fixed fields last                                           | A stale object passed as run facts replaced cause, class and exit, and the envelope was still legal |
| Every seam is typed against the full result and station unions                   | A union-typed cause passed with the wrong guidance arm                                              |
| A builder body is checked directly, with no overload standing in as a conversion | An overload accepted a body returning success with exit 42 for a refusal                            |
| Exported contract types are type aliases                                         | An interface was merged from another file to accept empty facts                                     |
| A station map is read-only without relying on a `const` type parameter           | The feature has a regression report on the 7.1 beta. A reviewer's direct test did not reproduce it. |
| A station's words have one private copy, read by discovery and by the emit       | Discovery and the emitted result disagreed after an edit                                            |
| A station's identity is bound when it is declared                                | An emit ran under another command's identity                                                        |

## Typed to wire is one way

**GATE-5 `[C0]`** Two types describe a result, at different strengths on
purpose. The typed result carries the correlation: this cause, so this
outcome, this exit, this guidance arm. The wire type is the flat JSON shape
and is wider.

- The typed result is assignable to the wire type.
- Assigning the wire type to the typed result fails to compile. That failure
  is kept as a lock.
- A wire value becomes a typed result only through runtime validation.
- A two-way check applies only where a hand-declared type and a schema
  describe the same value. It is never applied between the wire type and the
  typed result.

## Compile-time locks

**GATE-6 `[C0]`** The seventeen accepted locks carry forward against the 3.0
vocabulary. The accepted criterion names the seventeen identifiers. The
program beside each is restated `[P]` from the delivered 2.0 lock fixture.
Each is one invalid program:

| Lock | The program that must not compile                         |
| ---- | --------------------------------------------------------- |
| N1   | `failed` with `unknown` and `retryable: true`             |
| N2   | A cause paired with a failure class that is not its row's |
| N3   | A result carrying both `next` and `handoff`               |
| N4   | `partially-completed` with a `next` and no handoff        |
| N5   | `success` with `unknown`                                  |
| N6   | A handoff with `resource: undefined`                      |
| N7   | An authority slot given a resource identifier brand       |
| N8   | A parsed-path slot given a raw string                     |
| N9   | An exit value outside the exit set                        |
| N10  | An assignment to a member of the exit owner               |
| M1   | `retryable: true` with no `retryDelayMilliseconds`        |
| M2   | `partially-completed` with empty effects                  |
| M3   | An `inspect` command result with `failed` and `unknown`   |
| R1   | `refused` with `unknown`                                  |
| R2   | A `Date` assigned to `JsonValue`                          |
| R3   | A nested `undefined` assigned to `JsonValue`              |
| R4   | `refused` with `completed`                                |

N3 and N4 name `next` where 2.0 named `nextAction`. None of the seventeen is
dropped. An earlier probe dropped M3, N6, N7, N8, R2 and R3, and the build
must not. The delivered fixture also carries P1, P2 and P3, inspected during this
consolidation. Keep their domain correlations in the exemplar's own cause
owner, not as new common causes: journal-limit refusal requires a next step;
prior-run refusal requires handoff; partial-recovery handoff cannot claim
unknown state. Apply the 3.0 structured guidance names. Each gets the same
marker-removal and valid-twin checks. Source: the delivered exemplar's
`tests/c1/type-contract.ts` at dotfiles commit
`29bf4bb0f307f96d396aa087472a4dbed849c920`, file SHA-256
`4ec843fff07c7e6480c3252122757326e39d83931a3aee2d6204118b425ebc67`.
This is source inspection, not a 3.0 compilation result.

**GATE-7 `[D 20]` `[D 2]` `[D 11]` `[P]`** New locks for 3.0:

| Lock | The program that must not compile                                                                         | Evidence so far                   |
| ---- | --------------------------------------------------------------------------------------------------------- | --------------------------------- |
| K1   | A handler using a capability its command did not declare                                                  | Scratch prototype                 |
| K2   | A changing command with no `ifNoResult`                                                                   | Scratch prototype                 |
| K3   | Acquiring a domain-program handle without the required effect capability                                  | Scratch prototype                 |
| K4   | An effect identifier the command did not declare                                                          | Scratch prototype                 |
| K5   | The value naming an `ifNoResult` command written as a literal                                             | Scratch prototype                 |
| K6   | An `inspect` command opening a transaction                                                                | Scratch prototype                 |
| S1   | A `command` step naming an identity the CLI does not declare                                              | Scratch prototype                 |
| S2   | A handler editing a declared station's next step                                                          | Scratch prototype                 |
| S3   | An emit of a cause the command never declared                                                             | Scratch prototype                 |
| S4   | An emit under another command's identity                                                                  | Scratch prototype                 |
| S5   | A `retry` step on a station whose row is not retryable                                                    | None                              |
| S6   | A `done` step on a station that is not a success                                                          | None                              |
| S7   | A handoff inspection entry naming a command that is not `inspect`                                         | One reviewer draft                |
| W1   | The wire type assigned to the typed result. Carried, not new (GATE-5). Named here so the suite counts it. | Compiled against the 2.0 exemplar |

"Scratch prototype" means a throwaway program outside any repository. It is
not production proof. Every lock is proved again in the build. S2 to S4 follow A11's single executable declaration owner. S5 and S6 have never been compiled, so
the runtime validator is their only proof until the build
([V-39](verification.md#checks)).

K3 checks capability acquisition, not the lifetime of a captured value. A valid
handle can escape its effect callback through a closure without any cast.
TypeScript does not revoke that handle when the callback ends. CMD-14 therefore
requires an active-effect check at every program start; V-21 proves rejection
of an escaped or expired handle before any program is started. The effect
boundary remains mandatory even where the compiler cannot enforce it.

**GATE-8 `[C0]` `[P]`** How a lock is tested:

- One invalid program per marker. Each marker guards one line.
- The test removes each marker in turn and asserts: a nonzero compiler exit,
  exactly one diagnostic, its code, and its line.
- The test never asserts message text or a particular exit value. The two
  compilers exit differently on failure, and long types print differently.
- Each lock has a sensitivity control: the valid twin of the program
  compiles.
- Locks run under the repository's real compiler settings, on the accepted native 7.0.2 pin. The TypeScript 6 lint view is
  checked separately for disagreements (GATE-13).
- Expected-error markers appear only in the lock folder.

## Type assertions

**GATE-9 `[D 4]` `[P]`** A type assertion is a lint error outside a
validation boundary. `as const` stays allowed. `satisfies` stays allowed.

- The rule is `consistent-type-assertions` with `assertionStyle: "never"`.
- The one exception is a cast to a named brand type, inside the validation
  boundary folder. The folder is written as a rooted path.
- A boundary never returns a whole result by cast. A file holding
  `return value as ContractResult` would let every handler forge a result.
- Reading an error code or handling a timer is not a validation boundary and
  gets no exception.
- Source never imports from tests.
- Lint covers tests as well as source.
- Runtime validation stays mandatory. The rule stops a forged value. It does
  not validate a real one.

**GATE-9a `[D 4]` `[P]`** Ways past the rule that a review ran, and the
closure for each:

| Bypass                                                                             | Closure                                                                                                                   |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| An inline disable comment                                                          | `noInlineConfig`                                                                                                          |
| A cast in a `.mts` or `.cts` file, which the lint run skipped silently             | The lint file pattern includes `.mts` and `.cts`                                                                          |
| A type predicate that lies                                                         | Predicates only in the validation boundary folder                                                                         |
| An expected-error marker outside the lock folder                                   | GATE-8                                                                                                                    |
| An overload used as a conversion                                                   | GATE-4. The rule cannot see it.                                                                                           |
| `Object.assign` onto a valid result; a generic conversion through array covariance | Runtime validation plus the selected A15 and A16 lint errors, scoped by GATE-14. Neither lint rule proves full soundness. |

**GATE-10 `[D 4]`** The prototype behind decision 20 used six double casts
(`as unknown as`). Production code uses none of them:

1. A handler's `run` function widened to the erased record type.
2. An inspect command's specification widened to the common specification
   type.
3. A changing command's specification widened the same way.
4. A station's words widened to a loose words type.
5. A handler context widened to fit a capability's attach parameter.
6. An effect token forged from a plain object inside the state add-on.

The sixth forges exactly the brand that proves an effect was recorded. Each
needs a design that type-checks without the cast.

## Exhaustive handling

**GATE-11 `[D 5]` `[P]`** Handling of a contract outcome, state or other
closed union is exhaustive. Three forms are legal:

| Form          | Gate                                                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| A `switch`    | `switch-exhaustiveness-check` with `considerDefaultExhaustiveForUnions: false`. A `default` does not hide a missing member. |
| A lookup      | A full `Record` over the union. A missing member fails to compile.                                                          |
| An `if` chain | It ends in `assertNever`. A missing member fails to compile.                                                                |

A partial lookup, a `Map`, a ternary with a fallback and an `in` check pass
every gate today. They are not legal forms for a closed contract union, and a
review treats one as a finding.

Cause codes of another CLI are open ([VER-7](versioning.md#closed-and-open-vocabularies)).
A reader never switches exhaustively on them.

## Lint already required

**GATE-12 `[TS4]`** Unchanged, and not part of decisions 4 and 5:
`no-explicit-any` and `no-non-null-assertion` at error severity; the
`recommendedTypeChecked` preset; the restricted-import policy; detection of
undeclared dependencies; and the output-owner scope with its console-method
allowance. Only the output owner writes to the process streams. In 3.0 the
output owner is the kernel's writer `[D 20]` `[P]`.

## Two compilers

**GATE-13 `[TS4]` `[P]`** Lint diagnostics use the TypeScript 6 view.
Compilation on TypeScript 7 is the verdict. A disagreement between them is
attributed and resolved. It is never resolved by weakening a check until it
passes. `[TS4]`

Earlier research set conditions on adopting contract lint. The candidate
carries two of them and not the rest `[P]`:

| September condition                                                          | In this candidate                                                                            |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| An unresolved disagreement between the two compilers blocks activation       | Carried, for the locks and the selected rules                                                |
| Compare the expected diagnostic code per lock, not an aggregate pass or fail | Carried (GATE-8)                                                                             |
| "Lint adds little beyond the checker rows" as a reason not to adopt          | Not carried. Decisions 4 and 5 select the original rules; A15 and A16 add two scoped errors. |
| A fixed performance budget, measured twice before activation                 | Not carried as a contract clause. It is the template revision's to set.                      |

## Additional selected lint errors

**GATE-14 `[A 15]` `[A 16]` `[P]`** In code constructing or handling contract
values, make `Object.assign` an error and enable
`@typescript-eslint/no-unnecessary-type-parameters` at error severity. The
scope includes the kernel, contract builders, adapters, handlers, consumers
and corresponding tests, including `.ts`, `.mts` and `.cts`. Enumerate rooted
scope paths in the generated configuration and fail admission if a contract
handler is placed outside that scope. An alias or wrapper that evades the
selector is a coverage limitation to expose, never a reason to omit validation.

Reject both assigning new contract objects and mutating existing ones with
`Object.assign`. `prefer-object-spread` alone is insufficient: it can miss
mutation of a valid target. Keep genuine input/output correlations and
validation helpers with meaningful generic relationships. Do not ban every
generic or claim the rule detects every unsound conversion. V-45 owns positive
and negative specimens and configuration coverage.

The six researched custom rules remain candidates except where another clause
already requires their invariant. The output-owner protection in GATE-12
remains mandatory. No new runtime dependency follows from these lint choices.

**GATE-15 `[TS4]`** Fallow keeps unused exports and module boundaries. An
unused station is a property, not an export, so Fallow does not see it. The
catalogue test does ([V-13](verification.md#checks)).

## Status

**GATE-16 `[D 4]` `[D 5]` `[A 15]` `[A 16]` `[P]`** The selected rules need
the adoption records in ROLL-9 before activation. No lint rule has run against
3.0 foundation code. Historical specimens ran through the TypeScript 6.0.2 API;
those results do not qualify future production code.
