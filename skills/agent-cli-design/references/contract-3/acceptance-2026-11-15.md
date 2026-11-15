---

status: accepted
accepted_on: 2026-11-15
timezone: Australia/Melbourne
authority: Nathan Vale
contract_version: 3.0.0
accepted_commit: 5693651d19c6fba2430c904688e583266dbe58a0
manifest_sha256: c162c9850ca506fd839ce36b2b1a8172f064516b0f229dd34a5678b366b02b9d
---

# Command Contract 3.0 exact-text acceptance

Nathan accepted the exact reviewed Contract 3.0 text on 15 November 2026 at
20:00:12 Australia/Melbourne. This records text acceptance under A17 and
ROLL-9 step 4. It is not evidence of implementation, qualification, merge,
installation, activation or release.

## Accepted artifact

- Repository: `agent-engineering`, worktree `contract-3-text`.
- Immutable source commit: `5693651d19c6fba2430c904688e583266dbe58a0`.
- [Manifest](candidate.sha256) SHA-256:
  `c162c9850ca506fd839ce36b2b1a8172f064516b0f229dd34a5678b366b02b9d`.
- Scope: the exact 20 files listed in that manifest, including the skill entry,
  contract clauses, examples, requirement map, verification checklist and
  recorded decisions. Start at the [contract index](index.md).
- All 20 file hashes and the manifest hash were verified before recording
  this acceptance. The reviewed text has not been rewritten to change status
  labels. This later acceptance record is outside the frozen manifest.
- Redaction note, 16 November 2026: machine-specific absolute paths were later
  removed from two of the 20 files, from this record and from Git history on
  Nathan's instruction. The manifest file and the hash above are unchanged and
  still identify the accepted bytes, which are now held in private recovery
  material. The source commit above is their original identity; published
  history carries the redacted revision. See
  [redaction-2026-11-16.md](redaction-2026-11-16.md).

This record supersedes the historical "candidate" and "not accepted" notices
in that snapshot only as to Nathan's acceptance of the exact text. Proposed
wording selected by that acceptance is now accepted wording; explicitly
deferred choices remain deferred. Text acceptance alone does not complete the
remaining adoption steps or make 3.0 binding on an existing CLI. Do not
regenerate the accepted manifest merely to include this later record.

## Approval evidence

Nathan's exact reply to the presentation identifying the commit and manifest:

> Yes, accept this exact Contract 3.0 candidate and make that durable. Keep the deferred choices open. What do we need to do next before implementation?

Source: foreground Codex conversation
`01a1d8c3-8eb6-7453-a393-e0323b21c7b1`, user message recorded at
`2026-11-15T09:00:12.342Z`. The exact message text above has SHA-256
`4b05a3e111955fbb0130fa66333fdad371d43094ee335dd786e1d0224b78b3a2`.
The native conversation record was inspected; this is explicit acceptance,
not an inference from earlier scope approval or A20.

The reviewed candidate and fresh changed-text PASS are identified by
private execution evidence set `agent-engineering-contract3-20261115`,
`typescript-corrections/final-receipt.json` and `fresh-review.md` in the same
directory. The receipt binds the accepted
commit and manifest. Its review-record SHA-256 is
`3e5961e9bf7764b5b5087aa9eff6260665933d6db592332dea7c9fcef2bd0ba0`.
Earlier whole-candidate review and the subsequent focused corrections retain
their distinct scopes in [review.md](review.md).

## Authority and limits

The accepted toolchain, single application CLI, base plus add-ons, A1 through
A20, runtime validation and no automatic replay remain settled. Acceptance
selects the exact proposed interface shapes and requirements in this snapshot.
Examples remain illustrative where labelled; acceptance does not turn them
into compiled or production-proven code.

This approval authorises recording acceptance. It does not by itself authorise
the foundation build, migration of existing CLIs, moving planning records,
merging, installing, activating or releasing anything. The generated 2.0
bootstrap remains unchanged. Existing 2.0 CLIs retain their current contract
and checker until separately scoped migration.

Keep these [deferred choices](decisions.md#product-and-ownership-choices-still-open)
open:

- Raw-stream retention and its effect classification. Retention stays disabled
  until the required custody and classification decisions are accepted.
- Whether add-on installation may execute template code, and its recovery
  behaviour. No arbitrary template-code execution is authorised.
- Ownership of planning and B6 records after vault deprecation. Keep their
  existing owners; this acceptance record does not relocate them.
- Which existing CLIs migrate or retire, and when. Foundation first; migrations
  require their own scope.

## Remaining adoption and build prerequisites

[ROLL-9](adoption.md#what-makes-this-text-binding) remains the owner of the
adoption sequence. Step 4 is complete by this record. The contract and template
specification revisions, source-packet owner update and decision-log entry in
steps 5 through 8 are not completed by it. Keep those existing records at their
current owners. Merge and installation remain separately authorised states.

Before implementation, reconcile those records with this accepted hash and
obtain a bounded foundation implementation scope and actionable tickets. Carry
the recorded revision 4 CI gaps into that prerequisite review; do not infer
passing checks from a merge or erase the Connectors timeout risk because its
retry passed. Runtime, compiler and process qualification obligations remain
as listed in [verification.md](verification.md), not newly passing evidence.
