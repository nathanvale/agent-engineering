# Adoption, the gap and what makes this binding

Candidate text for Command Contract 3.0. Not accepted, not binding. Read
[index.md](index.md) first for clause tags and status.

## Which contract binds

**ROLL-1 `[P]`** The accepted 2.0 contract (C0 revision 2) stays
binding for every CLI whose envelopes read `2.0.0`, until the last one is
moved or retired. It becomes historical only then. This candidate binds
nothing until the steps in ROLL-9 are complete.

**ROLL-2 `[D 3]`** Foundation first: the template, the composer, the checker,
the exemplar and this skill. Existing personal and client CLIs move
afterwards, as separate work. Nothing in this text authorises an automatic
migration. Each existing CLI moves in its own accepted scope.

**ROLL-2a `[D 16]` `[P]`** The CLI that guards vault writes stays `[D 16]`:
"No, it stays". The plan makes it the first existing CLI to move after the
foundation `[P]`. Decision 16 may change with the vault, which decision 22
says will be deprecated. Which other CLIs retire is not decided and is needed
only when the later moves are planned.

**ROLL-2b `[D 22]` `[P]`** This repository's own CLI was generated with the 2.0
starter and moves onto the 3.0 base later.

## During the gap

**ROLL-3 `[P]`** While both majors exist:

- This skill teaches 3.0.
- A `2.0.0` CLI is maintained under the accepted 2.0 contract. An agent using
  such a CLI follows that CLI's own skill.
- The refusal rule in [VER-3](versioning.md#what-a-reader-accepts) binds
  programs that read envelopes, such as the checker. It does not tell an
  agent to stop using a `2.0.0` CLI.

## The kept 2.0 checker

**ROLL-4 `[D 9]` `[P]`** The released 2.0 checker is kept beside the 3.0
checker `[D 9]`, under a second name `[P]`, where the existing test suites
reach it. A copy in git
history does not serve them: existing CLIs call the checker in their own
tests on every run.

**ROLL-5 `[D 9]` `[P]`**

- The kept checker's bytes equal those of one pinned released commit. The pin
  is taken again after the template's fourth revision landed, because a
  starter repair may have changed the released checker.
- Where an existing suite imports the 2.0 validator's source, that source is
  kept too.
- The kept checker runs only on a CLI whose version reads exactly `2.0.0`.
  Run on a 3.0 CLI it reports that "contract 2.0.0 is broken", which is
  false.
- The 3.0 checker refuses a `2.0.0` CLI with `SCHEMA_UNSUPPORTED_CONTRACT`
  and names the kept checker ([VER-13](versioning.md#the-checker)).
- The kept checker is deleted when the last `2.0.0` CLI is moved or retired.
  It never judges a new CLI.

## What the foundation step breaks

**ROLL-6 `[P]`** When the checker starts printing 3.0, these consumers break
and must be moved or pointed at the kept checker in the same step. The plan's
drafting brief B5 lists each by path.

| Consumer | Why it breaks |
| --- | --- |
| Test suites of existing 2.0.0 CLIs that call the checker | They read its message, outcome and row counts |
| One suite that imports the checker's 2.0 validator source | The source moves |
| The exemplar's tests | They read rows, stub a 2.0.0 checker envelope and import checker source |
| The composer's and the template's tests | They assert the starter's `contractVersion` |
| The 2.0 skill text and its qualification reference | They name the `skippedRows` field |
| The repository check workflow that runs all of the above | It runs them |

## Rollback

**ROLL-7 `[P]`** The foundation step changes two repositories, two pins and
the skill text. The two pins land together.

- The step has a written rollback that returns both repositories to their
  earlier pins and restores the earlier skill text.
- The rollback is rehearsed before the step merges
  ([V-25](verification.md#checks)).
- A rollback leaves every `2.0.0` CLI and the kept checker untouched.

The rollback's exact commands belong to the build. They depend on code that
does not exist.

## Successor criteria

**ROLL-8 `[Q 6]`** The accepted criteria CDS-CE-1 to CDS-CE-3 name `2.0.0`.
The contract specification revision that adopts this text needs successors.
Proposed wording:

| Successor of | Statement |
| --- | --- |
| CDS-CE-1 | The exact 3.0 contract is accepted as bytes bound to a SHA-256: every key and its presence class, the outcome, state and cause vocabulary, every exit meaning, the step kinds, the version rule, the help and discovery shapes, and the lifecycle and fallback tables. An independent review finds no unresolved policy cell. |
| CDS-CE-2 | One typed owner implements only the accepted tables. External data enters as `unknown`. One writer guards JSON and validates the whole envelope immediately before serialisation. All locks in [GATE-6 and GATE-7](static-gates.md#compile-time-locks) compile-fail with a recorded code and a sensitivity control. Typed-to-wire holds one way. Each marker is stripped independently and its diagnostic code and location asserted. A withdrawn probe is preserved with its decision reason. Parser-owned brands. Runtime specimens cover every admitted correlation and every ingress and egress route. No raw exception reaches machine stderr. A compiler pass alone qualifies neither serialisation nor authority. |
| CDS-CE-3 | The 3.0 checker judges every admitted rule independently: expected rows and codes frozen before implementation; one otherwise-valid mutation per rule with unrelated rows green; bare human discovery; optional retained raw streams, kept only at private explicit destinations with stated custody; envelope-bearing exits 1, 4 and 75 process-proved with declared commands; real exit codes compared with each row's expected exit; the format cases of [VER-10](versioning.md#format-cases) proved; every observation exclusion and skipped row disclosed. Independent verification runs every negative, conformant, broken and wrong candidate. The 2.0 manifest, oracle and fixtures stay immutable as historical evidence. Lifecycle behaviour is proved by its own process rows, never inferred. |

## What makes this text binding

**ROLL-9 `[D 7]` `[D 15]` `[D 17]` `[P]`** In this order:

| Step | State on 15 November 2026 |
| --- | --- |
| 1. An accepted scope and a ticket for the text, after the template's fourth revision lands | The fourth revision has merged. Scope and ticket accepted: coordinator-verified conversation evidence, quoted in [review.md](review.md). Not a vault record. Not published to a tracker. Accepting the scope accepts none of this text. |
| 2. The 3.0 contract text drafted as skill reference files | This candidate |
| 3. An independent review with no unresolved policy cell. The writer gives no verdict. | [review.md](review.md) |
| 4. Nathan accepts exact bytes, bound to a SHA-256 | Not done. Open decisions remain ([decisions.md](decisions.md)). |
| 5. A new accepted revision of the contract specification that points at those bytes, keeps the 2.0 packet binding for 2.0.0 CLIs and replaces CDS-CE-1 to CDS-CE-3 | Not done |
| 6. A template specification revision: the criterion "no duplicate contract", the two lint rules, the 3.0.0 target, the lines citing the 2.0 contract, the dependency row that names a schema library, and the two profiles replaced by a base plus add-ons | Not done |
| 7. The source packet's owner line changed: this skill owns the rules for good, the stamped shared file owns the code, and a toolkit, if one is ever built, uses the contract and cannot redefine it | Not done |
| 8. The decisions of 15 November 2026 entered in the decision log | Not done |
| 9. Merge, then installation, as separate states | Not done |

Where steps 5 to 8 are recorded once the vault is deprecated is open
([decisions.md](decisions.md), Q9).

**ROLL-10 `[D 15]` `[P]`** This skill is the contract's owner for good
`[D 15]`. The rest of this clause is proposed. The tables here are
hand-authored and are the oracle. Production code and the checker's
expectation tables are each compared against them by a check that fails on
any difference. A table generated from production code would make the code
its own judge, so any generated view is labelled non-normative.
