# Verification checklist

Candidate text for Command Contract 3.0. Not accepted, not binding. Read
[index.md](index.md) first for clause tags and status.

Every check below can fail. Each names the kind of evidence that proves it,
the foundation component that owns the proof, and the failing control: the
one deliberate defect that must turn the check red. A check with no red
control proves nothing.

No check here has been run against a 3.0 build, because none exists. The
build's own specification names one command per check. This text names none,
because the commands do not exist yet.

## Evidence kinds

| Kind | What it is | What it cannot show |
| --- | --- | --- |
| Compiler | A program that must fail, or must pass, under the real compiler settings on 7.0.2 and 7.1 | Authority, effects, serialisation, the real exit |
| Lint | One passing and one failing specimen per rule and per bypass | That a value is valid at run time |
| Runtime | An in-process test of the validator, the writer or a builder | Process behaviour: streams, signals, exits |
| Process | The real CLI run as a child process, judged on exit, stdout, stderr and resource state | Anything not observed in that run |
| Static | A file or manifest comparison | Behaviour |
| Review | An independent reader's finding against sources | Anything executable |

## Checks

| ID | Requirement | Clauses | Evidence | Owner | Failing control |
| --- | --- | --- | --- | --- | --- |
| V-1 | An illegal cause row fails where it is written | GATE-3, WIRE-15 | Compiler | Kernel | Add a transient cause with completed effects. It must fail at that row. |
| V-2 | Every lock rejects its program | GATE-6, GATE-7, GATE-8 | Compiler, both compilers | Kernel lock suite | Remove any one marker. The suite must fail with one diagnostic at that line. Each valid twin must compile. A withdrawn lock is kept with its decision reason, not deleted. |
| V-3 | Typed to wire holds one way | GATE-5 | Compiler | Kernel | Remove the marker on the reverse assignment. It must fail. |
| V-4 | An invalid envelope never reaches stdout | LIFE-7, LIFE-8, LIFE-9 | Process, with a labelled fault fixture | Kernel | Force a result with the wrong exit for its cause. The run must print the bounded fallback and exit 1. |
| V-5 | A forged result is rejected by lint | GATE-9, GATE-9a | Lint | Template lint configuration | One specimen per row: a cast, each bypass, and the brand exception. The cast and each bypass must fail. `as const`, `satisfies` and the brand exception must pass. |
| V-6 | Closed unions are handled exhaustively | GATE-11 | Lint and compiler | Template lint configuration; kernel | A `switch` missing a member with a `default`; a partial `Record`; a chain without `assertNever`. Each must fail. |
| V-7 | Run facts cannot override declared fields | GATE-4, DISC-9 | Runtime | Kernel | Pass a stale result object as the run facts. The output must carry the declared cause and exit. |
| V-8 | Every cause builds its accepted fixed fields | WIRE-14, WIRE-18, ROLL-10 | Runtime | Kernel, per-CLI cause table | Change one fixed field of one cause. The comparison with the hand-authored table must fail. |
| V-9 | The process's real exit and cause equal the row's frozen expected values, and the real exit equals the envelope's `exitCode` | WIRE-7, GATE-2, ROLL-8 | Process | 3.0 checker | Deliberate defect: a kernel fault that turns an exit-3 refusal into a valid exit-1 fallback. The row must fail, although the envelope is valid and agrees with the process exit. A CLI that prints a valid envelope for exit 3 and exits 1 must also fail. |
| V-10 | Station identity is unique and bound to its command | DISC-12, GATE-4 | Runtime catalogue test for duplicates. Compiler for identity binding (S4). | Kernel | Declare two stations with one tuple and different words: the catalogue test must fail, because the compiler accepts it. Emit under another command's identity: it must not compile. |
| V-11 | Built-in commands are declared | DISC-5, DISC-11 | Process | Kernel; 3.0 checker | Remove one built-in from discovery. The check must fail. |
| V-12 | Every command step and every `ifNoResult` resolves | STEP-6, STEP-12, DISC-13 | Compiler (S1, S7, K2, K5) and process | Kernel; 3.0 checker | In the checker, not only at compile time: a step naming a command discovery does not list; an inspection entry naming a changing command; an `ifNoResult` that is `null` on a changing command; an `ifNoResult` naming an undeclared or changing command. Each must fail. |
| V-13 | Declared equals observed | DISC-11, DISC-12 | Process | Each CLI's catalogue test | Delete one specimen. Emit one undeclared station. Each must fail. |
| V-14 | Emitted guidance equals the declared template | STEP-9, STEP-10, STEP-14 | Runtime and process | Kernel; 3.0 checker | An unknown brace token. A named binding missing from `bindings`. An extra binding. Each must fail. |
| V-15 | `availablePaths` entries resolve and are sorted | WIRE-5, WIRE-6a | Process | 3.0 checker | List an identity discovery does not declare. Unsort the list. Each must fail. |
| V-16 | The version rule holds | VER-1 to VER-10 | Process, with a test-only minor (VER-15) | 3.0 checker | A reader at 3.1 given 3.2, 4.0.0, 3.0.1, `3.0` and a 3.0 envelope carrying a 3.1 key. Each must be refused with the class and cause in VER-10. A valid 3.0 envelope must be accepted, and a key added at 3.1 that is absent from it must be read with its 3.0 meaning. A test-only minor that removes a key, renames one, makes one required or adds a common cause must fail the compatibility check. |
| V-17 | Another major is refused and the kept checker is named | VER-10, VER-13, ROLL-5 | Process | 3.0 checker | A 2.0.0 envelope. The refusal must name the observed version and the kept checker, and adapt nothing. |
| V-18 | The fallback is bounded and declares 3.0.0 | LIFE-9, LIFE-10, VER-9 | Process, with a labelled fault fixture | Kernel | A result that fails the writer: one fallback, at most 16,384 bytes, version 3.0.0, exit 1. A fallback that itself fails: no second envelope, empty stderr, exit 1. |
| V-19 | A lost response has a read-only route that reports unfinished work | DISC-13 to DISC-15, CMD-10, CMD-13 | Compiler (K2, K5) and process | Kernel; state add-on | Deliberate defects, one at a time: a report that returns an empty list while the journal holds an intent with no outcome; a report that writes to the journal or the resource. Each must fail. Scenarios: interrupt a change after its intent is recorded, and the report must list it. Hold a live run at a barrier after its intent is recorded, and the report must list it. A run that records an unknown result must still be listed. After a change completes, the report must not list it. A changing command with no `ifNoResult` must not compile. |
| V-20 | Malformed input is refused before the approval guard, and a refusal never uses up a grant | CMD-9, CMD-15 | Process | Kernel; approval add-on | Deliberate defect: swap dispatch steps 3 and 5. Malformed input with no grant then gives an authority denial, and the check must fail. Second defect: consume the grant before the lock is held. A held-lock refusal then uses up the grant, and the check must fail. |
| V-21 | No started program outlives the CLI on any of the five exit paths, and none inherits the CLI's streams | LIFE-11, CMD-14 | Process | Programs add-on | Deliberate defect: remove the exit-time kill. A started program that ignores SIGTERM then survives a repeated signal, and the check must fail. Second defect: let a started program inherit the CLI's streams. Its output then lands in machine stdout, and the check must fail. A started program must see a closed stdin. Each of the five paths of LIFE-11 is run. No process of the started group remains one second after the CLI exits `[P]`. |
| V-22 | One effect under contention, and no stale lock is taken | CMD-12, CMD-10 | Process, two real processes and a barrier | State add-on | Deliberate defects, one at a time: remove the lock (two effects appear); take a held lock once it reaches an age (the lock of a slow live run is stolen); declare a `retry` station for a held lock; declare a changing command with no held-lock station; give the held-lock handoff the report as its only inspection entry; write a lock that names its run and no process identifier or host; wait for a held lock with no bound. Each must fail. A signal during a wait must stop the run under LIFE-3, and a deadline that passes during a wait must end it under the deadline rows. |
| V-23 | Journal faults are classified honestly | CMD-11 | Process | State add-on | Deliberate defect: record completion before read-back. A fault after intent then reports `completed`, and the check must fail. Also run: a silent no-op; a truncated final record; a read-back failure. None may report completion. An independent reviewer inspects the resource as well as the journal. |
| V-24 | Diagnostics stay private and never change the result | DIAG-1 to DIAG-16 | Process | Diagnostics add-on | Deliberate defect: let a sink exception propagate. The domain exit then changes, and the check must fail. Also run: a setup failure (an unset home, a permission error, no space), a stuck flush, deleted logs, a hostile path. The domain result, exit and recovery must equal the clean run's. Success, domain failure and signal runs each have record-count and bounded-disposal evidence. |
| V-25 | Foundation consumers pass and the rollback works | ROLL-6, ROLL-7 | Process | Foundation step | Deliberate defects: leave one consumer pointed at the 3.0 checker (it must fail); rehearse a rollback that restores one pin of two (the rehearsal must fail). Then every consumer in ROLL-6 passes, and the full rollback returns both repositories to their earlier pins. |
| V-26 | Every lifecycle row has a sensitive process row: a drain of at least 1 MiB, a slow consumer, EPIPE before and after the flush, closed and held-open stdin, a deadline, each signal, a second signal, an uncaught exception, an unhandled rejection, hostile diagnostic paths, concurrent pruning and hostile strings, paths and JSON input | LIFE-2a to LIFE-6a | Process | Kernel; 3.0 checker | The exact commands, startup synchronisation, expected streams and exits, time bounds and findings are frozen first. Each row is then proved with a single violating stub, then run against the real candidate. An unobserved timing state is reported as unproved, never as green. An EPIPE timing that cannot be told apart deterministically returns to its owner. No exit rule is invented for it. |
| V-27 | Exit 75 is reachable | WIRE-15, DISC-8 | Process | Kernel; state add-on | A transient refusal must exit 75 with a delay inside its declared bounds. A delay outside the bounds must fail. |
| V-28 | The base and every add-on set pass the checker | CMD-3, CMD-17 | Process, and review for the mapping | Template; 3.0 checker | Deliberate defect: break one add-on's declared station. The checker must fail that add-on's sets and pass the others. Then: the base alone, the base plus each add-on, and the full set pass. A base CLI gains its first changing command by adding the state add-on and still passes. Review, when each move is scoped: the existing CLI maps to the base plus add-ons with no exception. |
| V-29 | Composition keeps one owner per path | CMD-6, CMD-17 | Static and process | Composer | Deliberate defects: an add-on fragment that claims a host path (planning must fail); an add-on install that edits a host file (the preservation diff must fail). Then every add-on set plans with no path owned twice. |
| V-30 | Stamped code is identical to its pinned revision | CMD-7 | Static | Static admission | Edit one byte of a stamped file. Admission must fail. |
| V-31 | The base has no runtime dependency and still validates | CMD-5, CMD-18, LIFE-8 | Static and process | Template | Deliberate defect: add a runtime dependency to the base. Admission must fail. Then the base's manifest and lockfile list none, and V-4 passes on the base alone. |
| V-32 | One CLI through its existing registration | CMD-1 | Process and static | Composer | A host with existing commands exposes old and new through the original entry point. A second entry point or registry must be rejected. |
| V-33 | The gap is covered | ROLL-4, ROLL-5 | Process | Kept 2.0 checker | Deliberate defects: change one byte of the kept checker (the byte comparison must fail); break one row of a 2.0.0 CLI (the kept checker must fail it). Then the kept checker passes each 2.0.0 CLI run with that CLI's real arguments. Probe arguments are not enough. |
| V-34 | The checker is independently sensitive | ROLL-8 | Process | 3.0 checker | One otherwise-valid mutation per rule, with every unrelated row green. Expected rows and codes are frozen before the checker is written. Bare human discovery is checked. Retained raw streams go only to an explicit private destination. Exits 1, 4 and 75 are each process-proved with an envelope. Independent verification runs every negative, conformant, broken and wrong candidate. |
| V-35 | The accepted tables, the typed owner and the checker agree | ROLL-10 | Static comparison | This skill; kernel; 3.0 checker | Change any one of the three alone. The comparison must fail. Every TypeScript snippet in these references type-checks or is labelled illustrative. The one snippet today is labelled illustrative and was not compiled. |
| V-36 | Every 2.0 rule has a stated fate | [requirement-map.md](requirement-map.md) | Review | This skill | A rule group with neither a carrying clause nor a naming decision fails the review. |
| V-37 | A fresh agent can extend a CLI from this skill alone | All | Process | This skill | An agent given only this skill adds one command with one new cause. It fails if the agent needs a file outside the skill or the checker reports a finding. Three passing runs of three `[P]`. |
| V-39 | Every admitted correlation has a runtime specimen | WIRE-12, WIRE-15 to WIRE-17, STEP-4 to STEP-6, STEP-10, STEP-12, ROLL-8 | Runtime | Kernel validator | One valid and one invalid specimen per row and rule: each truth-table row; each effect-state row; a `retry` without `retryable`; a `done` on a refusal; an inspection entry of kind `retry`; a binding outside a whole argument; a binding value that is empty, only whitespace, over 1,024 bytes, begins with `-`, or holds a Cc, Cf, Zl or Zp character; a value rendered into an argument that equals a declared route token; a router that resolves a prefix of a route token (the exact-match rule of CMD-9); an `{idempotencyKey}` of `--force` rendered into an argument. Specimens cover every ingress and egress route. Each invalid specimen must be rejected. Deliberate defect: disable one validator rule. Its invalid specimen is then accepted, and the test must fail. |
| V-40 | An unavailable integration never blocks help, discovery or an unrelated command | DISC-2a | Process | Kernel; each CLI | Deliberate defect: initialise every provider while listing commands. With one provider unavailable, root help, discovery and an unrelated command then fail, and the check must fail. No network call occurs while listing commands. |
| V-41 | A command's own words apply to results the base produces, and the fallback can always be built | DISC-11, DISC-11b, DISC-13, LIFE-9 | Runtime and process | Kernel | One deliberate defect per constraint. Each of these must be rejected at declaration, and the check fails if one is accepted: a command declares an `INTERNAL_PREPARATION` tuple; a command declares an `INTERNAL_RESULT_*` tuple; an `ifNoResult` whose `args` hold a brace token; one with more than 16 elements; one whose encoded step exceeds 2,048 bytes; one holding a Cc, Cf, Zl or Zp character; a command identity over 128 bytes. A further defect: the base ignores a command's own `SCHEMA_INVALID_INPUT` words. Scenario: a fallback for a command whose `ifNoResult` step sits at the bound stays inside 16,384 bytes. |
| V-38 | The verification journeys run against 3.0 | All | Process | Verification skill | A starter deliberately broken with a stray stderr line in machine mode must fail its journey. A journey not run is reported as not run. |

## The plan's 28 proposed checks

The plan's checks were proposals written before the design was accepted. This
table gives each one a successor. An obsolete row binds nothing.

| Plan check | Fate | Successor |
| --- | --- | --- |
| 1. Illegal row | Retained | V-1 |
| 2. Undeclared station | Revised: the locks S2 to S4 replace the single property-access case | V-2, V-10 |
| 3. Locks | Retained and extended with K1 to K6, S1 to S7 and W1 | V-2 |
| 4. Forged result | Retained, both parts | V-4, V-5 |
| 5. Override | Retained | V-7 |
| 6. Every cause | Retained | V-8 |
| 7. Typed and wire types agree | Parts 1 and 2 retained. Part 3 revised: the template ships no schema library (decision 19), so the two-way check applies only where a CLI adds a schema for the same value. | V-3 |
| 8. Station identity | Retained | V-10 |
| 9. Built-ins declared | Retained | V-11 |
| 10. Strict checker passes on fresh starters | Revised: the base and each add-on set replace the simple and complex starters | V-28 |
| 11. Unchanged wire | Retired by decision 1 | None |
| 12. One owner | Retained | V-30 |
| 13. Declared equals observed | Retained | V-13 |
| 14. Skill | Revised: a snippet must type-check or be labelled illustrative. The one snippet here is illustrative and not compiled. | V-35 |
| 15. Verification skill | Retained. Its name, place and fault fixtures are still Nathan's small choices. | V-38 |
| 16. Fresh agent | Retained. The run count is proposed. | V-37 |
| 17. Existing registration owner | Retained | V-32 |
| 18. Simple stays dependency-free | Revised: the base replaces the simple profile | V-31 |
| 19. Old format refused | Retained | V-17 |
| 20. Next steps resolve | Retained and extended to inspection entries and `ifNoResult` | V-12 |
| 21. Older minor accepted, newer refused | Retained, with the removal, rename and new-required control and the absent-key rule | V-16 |
| 22. The gap is covered | Retained | V-33 |
| 23. Exhaustive handling | Retained | V-6 |
| 24. Every 2.0 rule has a stated fate | Retained | V-36 |
| 25. Exit 75 is reachable | Retained. The real exit comparison the plan pointed to from here is V-9. | V-27, V-9 |
| 26. Foundation consumers | Retained | V-25 |
| 27. A lost response has a route | Retained | V-19 |
| 28. Base plus add-ons | Revised: the mapping of every existing CLI becomes review evidence, taken when each move is scoped. The rest is retained. | V-28, V-29 |

New checks with no plan predecessor: V-14, V-15, V-18, V-20 to V-24, V-26,
V-34 and V-39 to V-41. V-20 and V-21 come from the prototype. V-22 to V-24 and
V-26 carry the accepted lifecycle specification. V-34 and V-39 carry the
accepted checker and typed-contract criteria. V-40 carries the accepted
template specification.

## Carried from the prototype

| Lesson | Clause | Check |
| --- | --- | --- |
| The strict checker passed four rows whose real exit was wrong, because the envelope was a valid fallback | GATE-2 | V-9 |
| The `profile` discovery key cannot survive: the 2.0 checker requires `simple` or `complex` | DISC-6, CMD-2 | V-11, V-28 |
| An approval guard runs before the handler, so malformed input must be refused first | CMD-9 | V-20 |
| A repeated signal killed the CLI while a started program kept running | LIFE-11 | V-21 |
| The prototype used six double casts | GATE-10 | V-5 |

## Scratch results are not production proof

| Result | Where it was shown | What it does not show |
| --- | --- | --- |
| Six generated CLIs compiled on both compilers and passed the 2.0 strict checker 15 of 15 with matching exits | Throwaway prototype | Anything about the 3.0 wire: it printed 2.0.0 envelopes with string next steps |
| K1 to K6 each gave one diagnostic at their line | Throwaway prototype | Behaviour under the template's real compiler settings |
| A killed run left a dead lock that the next run reclaimed, then refused to repeat the change | Throwaway prototype | Lock release when a signal arrives mid-change. That the reclaim is safe: it was not serialised. This candidate carries no reclaim (CMD-12). |
| Nineteen "must not compile" cases rejected on both compilers | Throwaway probe, with settings that differ from the template's | The seventeen accepted locks against a 3.0 vocabulary |
| The two selected lint rules flagged their specimens | Small specimens, TypeScript 6.0.2 API | Either rule on foundation code |
| Structured next steps typed in a reviewer's draft, two kinds | One reviewer's draft | The four kinds proposed here, `bindings`, or any runtime |

## Not verified by anyone

- Any lint rule on foundation code.
- Static admission, the add-on composer and per-dependency-set lockfiles.
- Lock release when a signal arrives mid-change.
- Any settlement or recovery design. None is in this candidate (CMD-13a).
- Boundary zones per workspace package.
- A 3.0 checker, a 3.0 validator or a 3.0 kernel. None exists.
- Anything under the test runner.
- How shared types reach a per-CLI cause table.
- The 2.0 exemplar writer's agreement with its schema.
- Whether the runtime's own type checker tracks TypeScript 7.1.
- One envelope-producing script outside the plugin, never run under the
  checker.
- Editor hover text for the contract types.
- Whether an installed add-on nothing uses is noticed. The boundary tool can
  see it only if admission checks imports.
- The union-ordering behaviour of the TypeScript 6 lint view.
- Findings the 2.0 checker hides behind its one-finding-per-row rule.
- The delivered 2.0 lock fixture's three later locks. The drafter read the
  seventeen named by the accepted criterion and did not read those three.
- The examples in [examples.md](examples.md), beyond JSON syntax.
- The template's fourth revision is merged, and its composer change merged
  with failing and pending checks. It is not fully green.
