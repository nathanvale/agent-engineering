# Requirement map

Candidate text for Command Contract 3.0. Not accepted, not binding. Read
[index.md](index.md) first for clause tags and status.

This file traces every item of the plan's drafting brief (B1 to B12) to the
clause that carries it. A brief item with no clause is a defect in this
candidate. Sources: the Command Contract 3.0 plan (decisions of 15 November
2026 and the drafting brief), the accepted contract specification (C0
revision 2), the accepted lifecycle and observability specification
(revision 1) and the accepted template and skill specification (revision 4).
Plan identity when read: SHA-256
`3cad7079e79d68df48c8b5bbf53fcf0e911c50aa77257ff1843690bef0af46ee`.

## B1. Every accepted 2.0 rule has a fate

| Rule group (C0 revision 2) | Fate in 3.0 | Carried or changed by |
| --- | --- | --- |
| General wire rules: strict objects, presence, strings, `JsonValue` | Kept | WIRE-1 to WIRE-4 |
| Outcomes and the result truth table | Kept | WIRE-15, WIRE-16 |
| Effects and the effect-state table | Kept | WIRE-10 to WIRE-13 |
| Result keys | Kept, except `nextAction` | WIRE-7, WIRE-8 |
| Next action | Changed by decision 2 | STEP-1 to STEP-15, WIRE-17 |
| Handoff | Kept. Inspection entries stay read-only and become structured (open, Q2). | WIRE-9, STEP-12, STEP-13 |
| Retry and delay policy | Kept | WIRE-7, WIRE-16, DISC-8, STEP-4 |
| Exits and causes | Kept. No common cause is added. | WIRE-14, WIRE-18, WIRE-19 |
| Discovery, help and `PublicStation` | Kept. The version keys change with decisions 1 and 8. | DISC-1 to DISC-8 |
| Built-in commands in discovery | Stated: they are declared | DISC-5, DISC-11 |
| Station identity and reachability | Kept | DISC-12 |
| A command with no station table | Kept, and moved from the simple profile to each qualifying `inspect` command by decision 18 | DISC-10 |
| Guidance templates and their five substitutions | Kept for strings. Extended to structured arguments (proposed). A sixth, bound token is proposed (open, Q3). | STEP-9, STEP-9a, STEP-10 |
| The five format cases and version handling | Changed by decisions 1 and 8 | VER-1 to VER-12 |
| "No dual-version support" | Changed by decision 8 for minors of one major. Still true across majors. | VER-3, VER-12 |
| Envelope keys | `contractVersion` changes with decision 1. `message` and `availablePaths` kept. `envelopeVersion` removal proposed (open, Q6). | WIRE-5, WIRE-6, WIRE-6a |
| Diagnostics schema and finalisation order | Kept | DIAG-1 to DIAG-16 |
| Signals, deadlines, broken pipes and crashes | Kept. Five rows gain a started-programs addition (departure 17). | LIFE-3 to LIFE-6a, LIFE-11 |
| Writer guards and the bounded fallback | Kept. The fallback declares 3.0.0. | LIFE-7, LIFE-9, LIFE-10 |
| The one-way typed-to-wire boundary and the locks | Kept | GATE-5, GATE-6 |
| Checker sensitivity (CDS-CE-3) | Kept | ROLL-8, V-34 |
| Criteria CDS-CE-1 to CDS-CE-3 and their exclusions | Successors proposed | ROLL-8 |
| Simple means every command is `inspect`; other complex triggers retained | Changed by decision 18: the rule applies per command | CMD-2 to CMD-4 |
| Journal, lock and concurrency (lifecycle specification, CDS-LO-1) | Kept. Decision 20's dead-owner reclaim is not carried (open, Q4). | CMD-11 to CMD-13 |
| Diagnostics custody (CDS-LO-2) | Kept | DIAG-6 to DIAG-12 |
| A sensitive process row per lifecycle claim (CDS-LO-3) | Kept | V-26 |
| One application CLI through its existing registration (template revision 4) | Kept | CMD-1 |
| An unavailable integration never blocks help or discovery (template revision 4) | Kept | DISC-2a, V-40 |
| The output-owner scope and console-method allowance (template revision 4) | Kept. The kernel's writer is the output owner. | GATE-12 |
| The accepted 2.0 contract stays binding for 2.0.0 CLIs | Stated | ROLL-1 |
| "Additive only when older consumers ignore it" (September research) | Replaced: an older reader refuses a newer version | VER-3, VER-5 |

### Every departure from accepted text

No accepted rule is dropped silently. Each change below needs Nathan's
acceptance with this text, and each is tagged where it appears.

| # | Departure | Basis | Clause |
| --- | --- | --- | --- |
| 1 | `contractVersion` is `3.0.0`. The form `3.<minor>.0` for later minors is proposed. | Decision 1; form proposed, Q5 | WIRE-5, VER-1 |
| 2 | A structured next step replaces `nextAction`. The key name `next` is proposed. | Decision 2; name proposed, Q2 | WIRE-7, WIRE-8 |
| 3 | The sentence `No further action required.` becomes the step `done` | Decision 2, proposed, Q2 | STEP-5 |
| 4 | A reader accepts older minors of its major | Decision 8 | VER-3 |
| 5 | A malformed version, including any triple with a nonzero patch, is `SCHEMA_INVALID_INPUT`, not `SCHEMA_UNSUPPORTED_CONTRACT` | Proposed, Q5 | VER-1, VER-10 |
| 6 | `envelopeVersion` removed | Proposed, Q6 | WIRE-6 |
| 7 | `profile` removed from discovery | Decision 18, proposed, Q6 | DISC-6 |
| 8 | `generationConventionVersion` removed from discovery | Proposed, Q6 | DISC-6 |
| 9 | A root operation requires an option or operand, so a no-argument invocation stays with dispatch | Proposed, Q6 | DISC-4 |
| 10 | `availablePaths` given one stated meaning | Proposed, Q6 | WIRE-6a |
| 11 | `ifNoResult` added to command discovery | Decision 11, shape proposed, Q7 | DISC-7, DISC-13 to DISC-15 |
| 12 | Withdrawn in round 3. Earlier candidates added three common causes. This one adds none. | None | None |
| 13 | `bindings` key and the `{binding.<name>}` token, limited to whole arguments and resource identifiers | Proposed, Q3 | WIRE-7, STEP-10 |
| 14 | Handoff inspection entries structured | Proposed, Q2 | STEP-12 |
| 15 | The five substitutions apply inside structured arguments, under the binding value rule | Proposed, Q3 | STEP-9a |
| 16 | Not carried: decision 20's dead-owner lock reclaim, which conflicts with the accepted rule. A held lock is refused with a handoff and never given a `retry` station, as the 2.0 exemplar does. | Decision 20 against the lifecycle specification, Q4 | CMD-12, STEP-15 |
| 17 | Started programs are stopped on a first signal and killed on a repeated signal and on a crash. This changes five accepted lifecycle rows and the matching sentences of the lifecycle specification. | Decision 20, proposed, Q10 | LIFE-11 |
| 18 | The two profiles replaced by per-command rules and add-ons | Decisions 18 and 20 | CMD-2 to CMD-19 |
| 19 | The template stops shipping Zod; one built-in validator checks every result | Decision 19 | CMD-18, LIFE-8 |
| 20 | Results the base produces appear as stations in each command's discovery. The base supplies default words, which a command may replace, except for the fallback's stations. | Proposed, Q6 | DISC-11, DISC-11b |
| 21 | The allowance to omit a station table follows each qualifying `inspect` command, not a simple-profile CLI | Decision 18, proposed, Q6 | DISC-10 |
| 22 | Built-in commands are required in `DiscoveryData.commands`. `HelpData.commands` lists host commands only. | Proposed, Q6 | DISC-5 |
| 23 | Withdrawn in round 5: a rule refusing new changes while one is unfinished, and a rule for when a change counts as settled. Neither is in this candidate. Decision 20's "recovery" is not carried. | Open requirement, Q7 | CMD-13a |
| 24 | The guidance of `SCHEMA_UNSUPPORTED_CONTRACT` no longer names one version | Decision 8, proposed, Q5 | WIRE-18 |
| 25 | `availablePaths` sorting is by code unit | Proposed, Q6 | WIRE-6a |
| 26 | The observed version is carried in `message`, not in repair guidance | Proposed, Q5 | VER-11 |
| 27 | A grant is consumed only once the lock is held | Proposed, Q6 | CMD-15 |
| 28 | A caller-supplied program is disclosed in the command's `summary` | Proposed, Q6 | CMD-14 |
| 29 | The no-station-table command's derived station is stated: `SUCCESS_UNCHANGED` with `done` | Proposed, Q6 | DISC-10 |
| 30 | The CDS-CE-3 successor compares the real exit with each row's expected exit. All three successor criteria are proposed wording. | Decision 20, proposed, Q6 | ROLL-8, V-9 |
| 31 | A value rendered into a step's arguments never equals a declared route token | Proposed, Q3 | STEP-10 |
| 32 | A minor never adds a common cause | Proposed, Q5 | VER-6a |
| 33 | The `ifNoResult` step's arguments are literal and bounded | Proposed, Q7 | DISC-13 |
| 34 | A command identity is at most 128 UTF-8 bytes | Proposed, Q6 | DISC-11b |

## B2. The version rule

| Brief item | Clause |
| --- | --- |
| A version is exactly `3.<minor>.0`; anything else is malformed and reported apart from newer | VER-1, VER-10 |
| Patch is always 0 | VER-2 |
| A reader accepts its own major at its own minor or lower | VER-3 |
| Keys the declared version does not list are errors | VER-4 |
| A minor may add optional keys and members of contract-owned unions | VER-5 |
| A minor never removes, renames or changes a meaning; absence means the earlier meaning | VER-6 |
| Cause codes are open to a reader; contract-owned unions are closed | VER-7, WIRE-20 |
| One version field; any copy equals it | VER-2a, DISC-6 |
| The fallback always declares 3.0.0 | VER-9, LIFE-10 |
| A CLI stamps its own minor; readers upgrade first | VER-8 |
| A reader keeps the shape of each older minor | VER-4a |
| Open: what `envelopeVersion` becomes | WIRE-6 (Q6) |
| Open: how the checker's own report is versioned | VER-14 |
| Open: a label for test-only minors | VER-15 |

## B3. Next steps

| Brief item | Clause |
| --- | --- |
| Missing kinds: retry, repair then retry, a sequence, a choice, a caller-supplied value, done | STEP-3, STEP-8 |
| A kind can be added in a later minor; the first set covers retry | STEP-4, STEP-8, VER-5 |
| A request to a person is a handoff | STEP-7, WIRE-9 |
| Values from the run need a proposed revision of the substitutions | STEP-10 (Q3) |
| A next step may name a changing command; a suggestion grants no authority | STEP-1, STEP-2 |
| Handoff inspection entries stay read-only; say whether they are structured | STEP-12 |
| A command step's arguments cannot be checked today | STEP-6 |
| Two plan samples are wrong and must not be copied | STEP-13, STEP-15 |

## B4. Gates for decisions 4 and 5

| Brief item | Clause |
| --- | --- |
| Outside `switch`: a full `Record`, or a chain ending in `assertNever` | GATE-11 |
| The assertion exception is narrow: named brand types, a rooted folder, no source import from tests | GATE-9 |
| The bypasses a reviewer ran, and their closures | GATE-9a |
| Lint covers tests as well as source | GATE-9 |
| Which September conditions still apply | GATE-13 (Q8) |
| The two rules need a template specification revision | GATE-16, ROLL-9 |

## B5. Rollout

| Brief item | Clause |
| --- | --- |
| What breaks when the checker prints 3.0 | ROLL-6 |
| The old checker kept beside the new one, pinned, and deleted last | ROLL-4, ROLL-5 |
| The 3.0 checker's refusal names the old checker | VER-13, ROLL-5 |
| Rollback | ROLL-7 |
| Guidance during the gap | ROLL-3 |

## B6. What makes the text binding

All nine steps, with their state: ROLL-9. Successor criteria: ROLL-8.

## B7. Engineering rows

| Row | Where this candidate stands |
| --- | --- |
| D2, delivery of the shared file | Stamped: CMD-7 |
| D2a, the owner file's path | `src/kernel/`, with decision 20: CMD-5 |
| D3, the design | Working answer 6, open: DISC-9 (Q1) |
| D3a, the station helper's API | The build's. Constrained by CMD-1 and DISC-9. |
| D4b, `generationConventionVersion` | Removal proposed: DISC-6 (Q6) |
| D5, the compiler pin | Unchanged: GATE-1 |
| D11, how the checker learns cause names | It judges declared stations against legal rows it holds independently: VER-7, WIRE-20, V-34 |
| D12, the exemplar's future | First consumer, in the foundation step. Not contract text. |
| D13, who owns the comparison checks | The build's: V-35 |
| D15, the dependency-free validator | One complete validator in the kernel: LIFE-8 |
| D7a to D7e, the verification skill | Nathan's small choices when it is set up: V-38 |
| D14, who writes and who reviews | Decision 17, then this assignment: [review.md](review.md) |
| D2b, D9b, D10 | Deferred or overtaken. No clause. |

## B8 and B9. Scope

| Brief item | Clause |
| --- | --- |
| The skill owns the contract for good (decision 15) | ROLL-10 |
| 3.0.0 takes in the lost-response route; three items parked (decisions 10 to 14) | [index.md](index.md), DISC-15 |
| Which CLIs retire (decision 16, partly answered) | ROLL-2a |
| An agent cannot tell a stale lock from a live one | Unchanged from 2.0 in this candidate. The plan classes it as starter behaviour: CMD-12 (Q4) |
| The starter's recover step does not close an intent | The plan classes it as starter behaviour. Settlement is an open requirement: CMD-13a (Q7) |

## B10. The route for a lost response

| Brief item | Clause |
| --- | --- |
| Each changing command declares one read-only command | DISC-13, CMD-10 |
| The named command reports any unfinished change | DISC-14, CMD-13 |
| What a caller does | DISC-15, LIFE-12 |
| The named step is typed as an inspect-only command | STEP-12, GATE-7 (K2, K5, S7) |

## B11. One base plus add-ons

| Brief item | Clause |
| --- | --- |
| Rules follow each command's effect | CMD-2, CMD-3 |
| The add-on list | CMD-11 to CMD-16 |
| Add-ons work in combination, each on the base alone and all together | CMD-17, V-28 |
| "Read-only does not waive other triggers" carries over | CMD-4 |
| Successors for `profile` in discovery and the profile selection | DISC-6, CMD-2 |
| A caller-supplied program "stays its own case" | CMD-14 lists it as one of three cases inside the programs add-on, as the accepted design (B12) does |

## B12. The accepted design

| Brief item | Clause |
| --- | --- |
| The base and its five functions; host ownership | CMD-5, CMD-6 |
| `changing` requires effects and `ifNoResult`; effect state from the ledger | CMD-10, CMD-10a |
| The context typed from the declaration | CMD-8 |
| Four add-ons | CMD-11 to CMD-16 |
| The state add-on's "lock with dead-owner reclaim" | Not carried. It conflicts with the accepted rule (Q4): CMD-12 |
| Composition, manifest, planner, lockfiles, admission | CMD-17, CMD-18 |
| Real exit codes need their own check | V-9 |
| `profile` dropped or redefined | DISC-6 |
| Malformed input refused before the approval guard | CMD-9, V-20 |
| Programs killed on exit | LIFE-11, V-21 |
| Six double casts forbidden | GATE-10 |
| Not checked: lint, admission, composer, lockfiles, lock release on a signal | CMD "Not verified", [verification.md](verification.md) |
| The shared workspace (decision 21) | CMD-19 |
