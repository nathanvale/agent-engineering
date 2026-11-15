# Revised candidate review record

Status: A20 resolves the final immediate policy choice. The candidate includes
the subsequent TypeScript review corrections and requires exact-text acceptance.
Review receipts for each candidate are identified below. Not implemented. This
file records review provenance; it cannot grant approval.

## Identity and scope

The manifest [candidate.sha256](candidate.sha256) covers `SKILL.md` and every
Markdown file in this reference folder. Its SHA-256 identifies the candidate.
The original 16-file reviewed candidate and original manifest are preserved in
commit `9d1ecf1`; original manifest SHA-256:
`751cca38f0edc5012e8dad2170e1d46a0e90447dac1ce8a7ec4effe9f02dcd8a`.
Earlier findings and their dispositions remain readable in that commit's
review.md and the private final-review receipt. Earlier verdicts do not cover
this consolidation.

Nathan authorised this revision: "Okay, consolidate the accepted decisions
into the Contract 3.0 draft, get Claude to review it, and show me the revised
text and any remaining choices. Don't implement anything until I accept the text."
The scope and ticket were previously accepted. Neither instruction accepts
these contract bytes. Bootstrap, runtime source, existing CLIs, planning records,
installation, activation, release and merge remain unchanged and outside scope.

## Writer and reviewer

- Consolidation writer: foreground Codex agent.
- Independent reviewer: existing Claude Fable 5.2 Herdr agent
  `contract3-final`, native session `fa7ac902-d2c8-4454-9377-be5e6a635a7d`.
  It confirmed that A1 to A19 are readable. It did not write this consolidation.
- Review route: explicit `herdr --session default`, read-only candidate/source
  review. Review receipt belongs in private runtime state, not product code.

## Review questions

Check actual candidate bytes against A1 to A19, B1 to B12, C0 revision 2,
lifecycle revision 1, template revision 4 and the underlying prototype evidence.
Identify contradictions, lost requirements, false type/runtime guarantees,
missing owners and unfalsifiable checks. Focus on recovery, scoped admission,
reclaim races, human authority, input schemas, navigation, approval ordering,
child cleanup and honest versioning. Keep accepted choices settled; distinguish
proposed wording, open product choices, routine engineering and missing build
proof. Report findings with exact files/clauses and the smallest repair.

## Evidence boundaries

No Contract 3.0 runtime was built or tested. TypeScript snippets are illustrative
unless explicitly linked to an exact compiler probe. V-1 to V-49 are future
acceptance checks, not passing results. The original bootstrap's recorded
hashes are compared for preservation. The merged fourth revision's unresolved
composer CI is retained as unresolved; a passing Connectors retry does not erase
its timeout timing risk. No new CI result is claimed by this documentation task.

## Independent review and corrections

Round 1 reviewed manifest
`640f7779fa13ca0bb4bf9441f77daae87c747030f9d5eca967280538cc3d205d`.
Claude verified all 20 hashes before and after, all 21 bootstrap hashes, links,
clause references and seven JSON blocks. Its verdict: ready to read, not yet
ready for exact-byte acceptance or implementation. All A1 to A19 directions
were carried; it found the following repairs and one unresolved safety choice.

| Finding                                                       | Disposition in revised text                                                                                                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Uncertain lock ownership had no stated manual path            | REC-7a now leaves two policies explicit for Nathan: authorised stop attestation, or continued blocking until runtime proof. Neither is selected. |
| Failed unchanged run could block its own safe retry           | DISC-14 and REC-4 restore own-run confirmed non-application.                                                                                     |
| Scoped unresolved refusal lacked a station                    | CMD-10 and DISC-11 require it separately from held-lock refusal.                                                                                 |
| Human approval could still be a forgeable same-user file      | REC-5 requires a source the calling process cannot forge with its credentials, plus host qualification under those credentials.                  |
| Bound caller values could fail only after effects             | STEP-10 and V-44 explicitly require validation before the current invocation's guard/effect.                                                     |
| Contradictory/missing example fields                          | Preview classification, lock guidance and generated input metadata corrected.                                                                    |
| Input schema could not state its constraints/deadline support | INPUT-2 adds declared patterns and deadline support, explicit grammar and usage causes; VER-7 includes its unions.                               |
| Old checker still described as replaced in place              | ROLL-4 and ROLL-6 preserve its owner/routes beside the separately owned 3.0 tool.                                                                |
| Missing or lost negative controls                             | V-22, V-24, V-42, V-44, V-47 and V-48 cover the named failures; table structure repaired.                                                        |
| Reclaim environment left unstated                             | REC-7b names the proposed boundary, qualification owner and explicit disabled-until-qualified state.                                             |

Additional source checks preserve the existing LogTape 2.4.2 pin, carry exemplar
locks P1 to P3, classify persisted previews as changing, identify the kept
checker's closed cause list, and retain the old skill's workflow during the gap.
These are inherited requirements, not new product choices.

Round 2 reviewed manifest
`1e8eaa76ebc91b55c1ee2268a76bb9508e3decdd7f707ccb78fc9f2e0cff1fb8`.
Claude confirmed the substantive repairs, all 20 hashes and bootstrap
preservation. Verdict: ready for Nathan to review with the one named safety
choice; exact-text acceptance still requires that choice and Nathan's approval.
Two small defects were then corrected: the missing REC-9 scope/takeover-crash
rows, and the wording applying stopped-owner conditions to every recovery
command. Clarifications distinguish human closure from ordinary grants and
bound untrusted schema-pattern evaluation. The final focused readback checks
those corrections against the final manifest.

Final review readback and exact-byte verification are
stored outside the candidate to avoid a self-referential manifest:
private execution evidence set `agent-engineering-contract3-20261115`,
`consolidation-review/`.
That evidence must be inspected before claiming the final review is complete.

The independent reviewer is from the same model family as earlier Claude
reviewers. No compiler or production process test was run in review; no finding
required a new compiler probe. Exact-text acceptance remains Nathan's. A20 below resolves REC-7a's policy,
not acceptance of the full text. No full-text acceptance is recorded here.

## A20 follow-up

Nathan replied "Agree" to the recommendation and explicit question permitting
an authorised person to confirm the stopped owner and delegated writers when
the CLI cannot verify that fact. A20 records the exact response and its question.
REC-7a now carries the chosen policy. REC-3 and REC-5 route to it; REC-10 and
V-49 add qualification controls. The immediate policy question is settled;
retained-stream, installer, post-vault ownership and migration choices remain
at their existing later boundaries.

The prior reviewed candidate is commit `0602d8b`, manifest
`a6a2d70e80b815865371261dbbf84b26b0d4c97b3553d4815f569ca5901725bb`.
The focused Claude readback must check A20, no waiver of exclusivity, no
known-live override, nonforgeable authority, preserved grant ordering and no
replay. Its final receipt belongs in the existing private consolidation-review
folder and identifies the revised manifest. This record is not runtime proof.

The first A20 review confirmed the selected policy and requested two repairs:
make grant consumption precede owner replacement under exclusive takeover
coordination, and distinguish automatic stopped-owner proof from permitted
human confirmation in the live-writer control. Both are corrected in REC-7a,
REC-9 and V-49. REC-7b now explicitly qualifies exclusivity for both routes.
No closure grant is consumed by takeover and no domain replay is permitted.
The final focused receipt is `a20-final-readback.txt` in the private review
folder, with its exact candidate identity in `a20-final-receipt.json`.

## TypeScript review corrections

After the A20 candidate at commit `de164f1`, Nathan requested a three-agent
TypeScript review and then authorised correction of its three findings, fresh
review of the changed text and presentation for acceptance. This does not
accept the text or authorise implementation.

- K3 now describes capability acquisition. CMD-14 requires invocation-time
  active-effect validation, coordinated with effect closure. V-21 owns the
  expired-handle, wrong-run/effect and closure-race process controls. A native
  TypeScript 7.0.2 probe accepted a closure retaining a valid handle; the
  forged-token control failed. This is compiler evidence about a prototype
  signature, not a demonstrated production escape or a passing runtime repair.
- V-5 and V-6 name compiler, lint, independent review and runtime owners
  separately. A missing exhaustiveness sink and a partial lookup passed the
  selected compiler/lint probe; an incomplete chain retaining assertNever
  failed. No prohibition was removed.
- The changing-command example now records an effect, reads it back and
  includes the distinct unresolved-case refusal. Its remaining omissions are
  explicit. It remains illustrative, not a compiled or complete production API.

The original probe receipts and the fresh changed-text review belong in
private execution evidence set `agent-engineering-contract3-20261115`,
`typescript-corrections/`.
The coordinator records the final manifest and review verdict there, outside
the candidate, to avoid a self-referential hash. Earlier review verdicts do not
cover these changes. All runtime controls added here remain unrun until the
separately authorised build. Accepted decisions and deferred choices are
unchanged.
