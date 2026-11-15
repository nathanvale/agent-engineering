# Candidate review record

This file records the independent review of the Command Contract 3.0
candidate. The drafter gives no verdict on its own text.

## Candidate

- **Scope.** Prepare one complete, independently reviewed Contract 3.0
  candidate so Nathan can accept its exact wording before implementation.
- **Ticket.** Draft and independently review Command Contract 3.0. Not
  published to a tracker.
- **Files.** `SKILL.md` and every file in `references/contract-3/`.
- **Identity.** SHA-256 of each file is in
  [candidate.sha256](candidate.sha256), which covers every candidate file
  except itself. A changed file means a different candidate.
- **Drafter.** A Fable 5.2 session.
- **Reviewer.** The Claude session that planned Contract 3.0 and wrote the
  design hand-over. It did not write this text.

## Authority for the scope and the drafter

Coordinator-verified conversation evidence. The foreground coordinator
reports these as Nathan's direct messages in its conversation on 15 November
2026. The drafter did not see the exchange. They are not a vault record, and
the plan has not been revised to match: it still lists the scope and ticket
as awaited and names the earlier writer.

- On the scope and ticket: "The proposed scope and ticket are accepted. ...
  Bootstrap the repository, then draft Command Contract 3.0 for review."
- On the text: "Okay, leave the bootstrap as it is and draft the 3.0 contract
  in agent-cli-design. Get Claude to review it, then show me the text and any
  decisions I need to make before we build."
- On the drafter: "pass it on to a fable 5.2", "working herdr", "to write the
  spec". This replaces the writer named in decision 17.

Accepting the scope accepts none of the contract text.

## What the reviewer is asked to judge

Read the candidate's actual bytes against the sources, not a summary:

1. **No silent loss.** Every rule group in the plan's drafting brief B1, and
   every safety, effect, recovery, diagnostics, output and lifecycle rule of
   the accepted 2.0 contract, is carried or changed by a named decision.
2. **Assessable.** Exact keys, presence rules, legal correlations, guidance,
   discovery, version and fallback behaviour can each be judged true or false
   of an envelope.
3. **Honest tags.** Nothing proposed is tagged as decided or carried.
   Nathan's decisions are quoted as he made them. No open choice is decided.
4. **Proof seams.** Each guarantee names the right kind of evidence and a
   failing control. No type-level claim stands in for runtime validation,
   authority, effects, serialisation or a real exit.
5. **Prototype lessons.** Real exit comparison, the successor to `profile`,
   malformed input refused before the approval guard, child cleanup on exit.
6. **Evidence limits.** Scratch results are kept apart from production proof.
   Unverified areas and the six double casts are preserved.
7. **Contradictions and omissions** inside the candidate and against the
   sources.

The reviewer reports findings and a verdict. The reviewer does not edit the
candidate.

## Drafter-side check (not the independent review)

Before round 1, the drafter ran one fresh-context reader over the candidate
against the accepted 2.0 contract and the lifecycle specification. It is the
drafter's own quality check. It is not independent and gives no verdict.

It reported 1 blocking, 10 material and 29 minor points. Each was checked
against the cited source lines. 39 were corrected. One was not a defect: the
tag on DIAG-8 stands, because the sentence it questioned is in the lifecycle
specification's diagnostics ticket, outside the lines the reader was given.

## Round 1

- **Reviewed manifest.**
  `650e86321b778f756a6f14a589da88a6d1bc3f18b2d0762e22bd7e7d6bf94dec`
- **Verdict.** FAIL. One blocking finding, 18 material, about 20 minor.
- **Method, as the reviewer reported it.** Four read-only reviewers plus the
  reviewer's own checks. All were models of one family, so shared blind spots
  remain. Nothing was run. The reviewer edited nothing.
- **Confirmed sound by the reviewer.** WIRE-1 to WIRE-16 against the 2.0
  contract; DIAG-1 to DIAG-16; every row of the lifecycle table; the writer
  guards and fallback limits; help and discovery invocations; the seventeen
  locks; the one-way typed-to-wire rule; the six double casts; scratch kept
  apart from production proof; all five prototype lessons; decisions 12, 13
  and 14 parked; Q1 to Q9 all Nathan's; examples 1 to 7 against the wire
  rules.

Dispositions. Every finding was supported by the source it cited, and all
were accepted.

| Finding | Disposition |
| --- | --- |
| B1. No conforming 3.0 checker could exist: base-fixed station words against version-specific guidance | VER-11 puts the observed version in `message`. DISC-11b makes the base's words defaults a command may replace, and lets a handler select those stations. |
| M1. A diagnostics fault sent to the fallback | LIFE-7 validates diagnostics first and never takes the fallback for it |
| M2. The checker criterion's successor dropped three accepted parts | Restored in ROLL-8 and V-34 |
| M3. The output-owner scope omitted | Carried in GATE-12, with the kernel's writer as owner |
| M4. An unavailable integration must not block help or discovery | New DISC-2a and V-40 |
| M5. The exit check passed the prototype's actual bug | V-9 compares with each row's frozen expected exit and cause |
| M6. The settling route contradicted itself, could dead-end and could race a live run | CMD-13 rewritten: one recovery command, `inspect`, holding the lock, with a person's attestation. DISC-14a names it as the report's one step. Example 7 declares it. Raised in Q7 with a smaller alternative. |
| M7. No runtime specimen per admitted correlation | New V-39. LIFE-7 validates next-step rules too. |
| M8. Weak failing controls | V-10, V-12, V-19 to V-25, V-28, V-29, V-31 and V-33 each name a deliberate defect |
| M9. Plan checks 14, 21 and 28 lost parts; a snippet did not parse | Fates revised, controls added, snippet fixed and still labelled illustrative |
| M10. Program disclosure had no key | Disclosed in `summary` (CMD-14). No new key. |
| M11. The derived station was unstated | Stated in DISC-10 |
| M12. Lock: three correctness holes and an unfair Q4 | CMD-12 and CMD-13 rewritten: atomic owner record with start time, block on every command under the lock. Q4 rewritten. CMD-11 keeps "stale-lock refusal". |
| M13. Bindings could inject options or orders | STEP-10 limits a binding to a whole argument or a resource identifier and bans a leading `-` and control characters |
| M14. The base took common causes from handlers; the lock cause was unnamed | DISC-11b; `DOMAIN_LOCK_UNVERIFIED` named |
| M15. DISC-4's premise was false | DISC-4 now allows one root operation that takes an option or operand |
| M16. A program in another process group survives a kill of the CLI | Stated as a limit in LIFE-11 |
| M17. Tags overclaimed; decisions.md was incomplete | Tags corrected on VER-3, ROLL-2a, ROLL-10, CMD-10, LIFE-8, GATE-7, WIRE-8, WIRE-9, STEP-1, STEP-2 and others. decisions.md restructured: Q1 widened, Q6 lists the smaller wire changes, Q10 added, three owner questions moved out of engineering. |
| M18. Two statements about Nathan were unverified | Quoted above as coordinator-verified conversation evidence |
| Minor findings | All applied: one row count for LIFE-11; "emergency write failure" restored; departure attributions; the unverified list extended; the patch rule limited to major 3; review-only rules named (STEP-16); the grant-consumption order (CMD-15) |

Three of these dispositions, for M6, M12 and M14, added mechanisms of the
drafter's own: a recovery command with a person's attestation, a lock
reclaim, and three new common causes. Round 2 found them unsafe and they
were withdrawn.

## Round 2

- **Reviewed manifest.**
  `e31fe6cd5dbed145fe9b878e705bfec2bc55afab93ec7f4c662bf09dc85eeac2`
- **Verdict.** FAIL. Round 1's blocking finding is fixed. One new blocking
  finding, eight material, about fifteen minor, almost all in the mechanisms
  the drafter added in answer to round 1.
- **Method, as the reviewer reported it.** Two read-only reviewers plus the
  reviewer's own checks, same model family. Nothing was run.
- **Confirmed fixed by the reviewer.** B1, M1 to M5, M7 to M15, M17 and M18.
- **The reviewer's suggestion.** Drop attestation and reclaim from the
  candidate, leave them as open questions, and return to them once Nathan
  has answered. The drafter took it: the plan itself classes the stale lock
  and the recover step as starter behaviour, not contract matters.

Dispositions. Every finding was supported and accepted.

| Finding | Disposition |
| --- | --- |
| R2-B1. An attestation with no authority check lets a caller attest and repeat a change | The recovery command and the attestation are withdrawn. CMD-13 carries decision 11 and one refusal rule. Whether the contract defines recovery is Q7, with what a design must show. |
| R2-M1. `inspect` stopped meaning read-only | Withdrawn with recovery. DISC-14 states the report is read-only. V-19 fails a report that writes. |
| R2-M2. A reclaim that is not serialised gives two effects | Reclaim is withdrawn. CMD-12 carries the accepted rule: no stale lock is stolen automatically. |
| R2-M3. A live owner can be judged dead | Withdrawn with reclaim. Q4 lists what a reclaim design must show. |
| R2-M4. A command's replacement words could break the fallback | DISC-11b: the fallback's stations keep the base's fixed words and cannot be declared by a command. New V-41. LIFE-9 returns to the base's fixed guidance. |
| R2-M5. A binding could still choose the command | STEP-10: the filled invocation must resolve to the named command. V-39 specimen. |
| R2-M6. Could a minor add a common cause? | New VER-6a: it cannot |
| R2-M7. A caller rule contradicted the kill paths | The caller sentence is removed. CMD-14 names the two exceptions. LIFE-11 states the limit. |
| R2-M8. New behaviours had no failing control | The behaviours are withdrawn. V-19 and V-22 are rewritten for what remains. |
| Minor findings | All applied or made moot by the withdrawals: LIFE-8 step number; VER-10 differences carried in `message`; every proposed departure names its question; `[Q 10]` and `[Q 6]` tags added; Q10 notes decision 20; ROLL-2b; DISC-2a quoted exactly and V-40 widened; plan check 28 marked revised; five lifecycle rows, counted once; the banned character categories named; the lifecycle specification's lock sentences quoted exactly; Q4 and Q7 cite the plan's own classification. |

## Round 3

- **Reviewed manifest.**
  `78a25540cc5f3097abb2aa83bf193f310add08a29dd0ffb75c55ac30a1e579a3`, which
  includes the supplementary review's surviving findings below.
- **Verdict.** FAIL. Every round 2 finding is resolved or withdrawn. One new
  blocking finding, five material, about fifteen minor. The reviewer called
  the candidate close.
- **Method, as the reviewer reported it.** Two read-only reviewers on a
  frozen snapshot, then the reviewer's own check of every finding against
  the final bytes. Same model family. Nothing was run.
- **Confirmed sound by the reviewer.** The withdrawals are clean. CMD-12
  quotes the lifecycle specification exactly. The report is read-only. The
  fallback exclusion list is complete. Examples 1, 2, 3, 6 and 7 meet the
  wire rules.

Dispositions. Every finding was supported and accepted. The drafter read the
two cited 2.0 exemplar sources before relying on them.

| Finding | Disposition |
| --- | --- |
| R3-B1. An ordinary crash could block every changing command for good | CMD-13 carries the 2.0 exemplar's rule: an intent is also settled when read-back shows every effect complete or every effect not applied. Only a partial or uncertain read-back ends with a person. The gap paragraph and Q7 name decision 20's "recovery" as not carried. |
| R3-M1. The held-lock handoff could point at an empty report | CMD-12: the inspection entry points at the lock's owner and the resource. V-22 defect. |
| R3-M2. Q4 called never-retry accepted and hid its cost | Q4 separates what is accepted from what is proposed, names the cost and the existing CLI that would change, and offers a middle option. CMD-12 allows a bounded in-process wait. V-22 defect. |
| R3-M3. Q7 called its default "your decision, and no more" | Q7 separates the decision from the proposals on top, gives the alternative without the blocking rule, and names the uncarried part of decision 20. The introduction is corrected. |
| R3-M4. `ifNoResult` arguments could break the fallback | DISC-13: literal, bounded and checked at declaration. DISC-11b covers the deadline handoffs. V-41 has one defect per constraint. |
| R3-M5. "The state add-on declares the cause" made a template-wide cause | The changing command declares both refusal stations under causes it owns. The add-on selects them and adds none. Example 5's cause is renamed. V-19 defect for a skipped check. |
| Minor findings | All applied: five lifecycle rows in the requirement map; wording in CMD-13 and V-20; the argument rule restated so a reader can judge it from discovery, with its open limit named in STEP-16; question tags on CMD-14, STEP-15, DISC-15, STEP-9a, VER-11 and departure 30; example 4; the report declares its station table; "cleared by a person" tagged proposed; the older run named in `message`; the check order stated; Q4 and Q7 carry the remaining conditions and say their defaults turn starter behaviour into contract rules; a V-16 control for VER-6a. |

## Round 4

- **Reviewed manifest.**
  `51494ed3bfd823c47ae8a3bdc80af497936daf41a4e48c9879febc8842083aa0`
- **Verdict.** FAIL. One blocking, four material, about ten minor, all in
  the rules for unfinished changes except one.
- **Method, as the reviewer reported it.** One read-only reviewer on the
  round 3 to round 4 difference, plus the reviewer's own reading of CMD-12,
  CMD-13, Q4 and Q7 and its check of two findings against the 2.0 exemplar
  source. Same model family. Nothing was run.
- **Confirmed fixed by the reviewer.** R3-M1 apart from the owner's
  identity, R3-M3, R3-M5, every round 3 minor, and Q4 and Q7 now fair.
- **The reviewer's suggestion.** Every round found a blocking flaw in the
  rules for unfinished changes, and each fix added design the plan never
  asked for. Make "the contract requires only the report" the default, and
  keep the blocking rule, the settlement rule and the way out as Q7's
  larger, separately reviewed option. The drafter took it.

Dispositions.

| Finding | Kind | Disposition |
| --- | --- | --- |
| R4-B1. A settlement by read-back does not last: a later change makes the old intent read uncertain and blocks everything | Unresolved product choice | The settlement rule and the blocking rule are withdrawn. CMD-13a records settlement as an open requirement owned by Nathan, with this scenario among those a design must pass. |
| R4-M1. The report and the blocking rule disagreed about a live run | Internal contradiction | Repaired. CMD-13: for the report, an unfinished change is an intent with no outcome recorded by its own run, and a live run is listed. DISC-15 step 3 says an empty list does not show that no run is working. |
| R4-M2. "Not applied" had no exact test, so an effect removed by someone else could be repeated | Unresolved product choice | Withdrawn with the settlement rule. A scenario in CMD-13a. |
| R4-M3. The way out by hand is sometimes impossible: an effect that cannot be observed or undone | Unresolved product choice | Withdrawn with the blocking rule. A scenario in CMD-13a. Q7 names the cost to the CLI that guards vault writes. No guarantee was written to cover it. |
| R4-M4. The `ifNoResult` bound did not bound element count or encoded size | Internal contradiction | Repaired. DISC-13: at most 16 elements, encoded step at most 2,048 bytes, no brace token, no Cc, Cf, Zl or Zp character. V-41 lists each as a defect. |
| Minor findings | Internal | All applied or made moot: V-19 rewritten for the report alone; V-22 gains the wait, owner-identity and missing-station defects; the lock names its run's process identity; Q4 names the CLI that reclaims today; Q7 and DISC-14 no longer call "reports unfinished work" decided; CMD-3 tagged for Q4 and Q7; CMD-10 and the illustrative declaration carry the held-lock station; example 5 shows the held-lock station; DISC-14 item 5 reworded; STEP-10 states its exact-match assumption and Q3 names the open limit; requirement-map rows reordered. |

## Round 5

- **Reviewed manifest.**
  `bb5c99e9e93d6735214e298c2cd35778af8fc3b4515a7c59cdfceb06e02cb30f`
- **Verdict.** PASS WITH FINDINGS. Nothing blocking. Two material findings,
  both about how honestly the text described the report once settlement was
  withdrawn. About ten minor.
- **Method, as the reviewer reported it.** One read-only reviewer on the
  round 4 to round 5 difference, plus the reviewer's own reading of CMD-13,
  CMD-13a and Q7. Same model family. Nothing was run.
- **Confirmed by the reviewer.** The withdrawn rules are gone and nothing
  depends on them. The report stays read-only. CMD-13a is an honest open
  requirement, with an owner, a resolution step and seven falsifiable
  scenarios. Q7 decides nothing. The `ifNoResult` bounds meet the fallback
  limits.
- **The reviewer's closing statement.** Once the two material findings are
  fixed, the text is ready to go to Nathan with its open questions. A short
  check of those clauses is enough, not another full round.

Dispositions.

| Finding | Kind | Disposition |
| --- | --- | --- |
| R5-M1. The text said a CLI's own design could take an entry out of the report. Under the report's definition, nothing can. | Internal misstatement | Repaired by saying so. CMD-13, CMD-13a and Q7 now state that a killed run's entry stays listed for good, that no command can remove it, and that every later careful caller then stops with a person. No rule was added to change that: it would be a settlement rule. |
| R5-M2. "Outcome" was undefined, so a run that recorded an unknown result dropped out of the report | Internal contradiction | Repaired. Only a completion record or a confirmed not-applied record, written by the run itself, ends a listing. V-19 scenario added. |
| Minor findings | Internal | All applied: CMD-13a's first scenario and its review-gate wording; example 5's inspection entry is read-only and the action moved to the repair words; a command identity is bounded at 128 bytes; CMD-9 states the exact-match router rule, with a V-39 defect; V-22 covers a deadline during the wait and names the process identifier and host; CMD-3 cites CMD-13a; the round counts agree; LIFE-12 and DISC-15 carry one tag; three lines rewrapped. |

## Round 5 confirmation

Pending. The reviewer is asked for a short check of the two repaired clauses
and the minors.

## Supplementary review

Nathan asked for a second, separate review by another Claude session. It
supplements the original design reviewer and does not replace it. It accepts
no product choice.

- **Reviewed manifest.** The round 2 bytes,
  `e31fe6cd5dbed145fe9b878e705bfec2bc55afab93ec7f4c662bf09dc85eeac2`, from
  its own snapshot.
- **Its verdict on those bytes.** Ready for Nathan to read the decisions.
  Not ready to accept as bytes. Eleven findings, none raised in round 1.
- **Method, as it reported.** Read all 16 files, parts of the plan and the
  accepted specifications, and the prototype's state and programs code.
  Nothing was run. Same model family as the other reviewers.

Each finding was reconciled against the round 3 text and the sources.

| Finding | Disposition |
| --- | --- |
| F1. "Settled" excluded a run's own completion, so every success could block the next change | Supported. CMD-13 now defines settled: the owning run's own completion or not-applied record, or the CLI's own recovery record. V-19 runs two successful applies in a row. |
| F2. A reclaim was not required to be atomic | Already resolved. Round 3 withdrew reclaim. Q4 lists the condition for any later design. |
| F3. An attestation was not bound to a person | Already resolved. Round 3 withdrew attestation. Q7 lists the condition. |
| F4. A caller-supplied `{idempotencyKey}` rendered into an argument can become an option | Supported. STEP-9a applies the binding value rule to any value rendered into an argument or a resource identifier. V-39 specimen. |
| F5. Command-declared fallback words could make the fallback impossible | Already resolved in round 3: DISC-11b and V-41 |
| F6. One recovery command against several lock scopes | Recovery is withdrawn. The residual is supported: CMD-12 now says each changing command takes exactly one lock for the state it changes. |
| F7. A person clearing a lock had no precondition | The cause it named is withdrawn. The residual is supported: CMD-12 says a person confirms no run is still working first, and that the contract defines no clearing command. |
| F8. Started programs could inherit the CLI's streams | Supported. CMD-14: closed stdin, output captured under a declared bound. V-21 control. |
| F9. "No path to start a program" overclaimed | Supported. CMD-14 lists `Bun.spawnSync` and `Bun.$` and says the ban is a guard, not isolation. |
| F10. The TypeScript 7.1 sentence was tagged as accepted | Supported. GATE-1 tags it `[P]` and says 7.1 is a beta. |
| F11. The typed-contract criterion's successor dropped two parts | Supported. ROLL-8 carries ingress and egress routes and preserved withdrawn probes. V-2 and V-39 follow. |

None of the withdrawn product behaviour was added back.

## Evidence limits

- The drafter read the plan, the accepted 2.0 contract and the lifecycle
  specification in full, and the template specification in the sections the
  contract depends on. Lock definitions, lint research and prototype facts
  were extracted by two delegated readers and not re-read line by line.
- No compiler, linter, CLI or checker was run for this candidate. No probe
  was needed or written.
- The examples were checked for JSON syntax only.
- The reviewer did not check: most of the examples beyond the wire rules; the
  bodies of the diagnostics and verification files beyond the rows cited; the
  `[SK]` clauses against the released 2.0 skill; the consumer list in ROLL-6.
- Every reader so far, the drafter's and the reviewer's, is from one model
  family. A reader from another family has not seen this text.
- Private runtime evidence stays outside this repository and is not quoted
  here.
