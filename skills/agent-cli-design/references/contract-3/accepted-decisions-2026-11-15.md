# Contract 3.0 decisions after final review

Recorded on 15 November 2026, Australia/Melbourne.
Authority: Nathan's explicit replies in the foreground Codex conversation.
Purpose: preserve accepted directions for the next contract-text revision.

These decisions do not accept the complete contract or authorise its
implementation. Keep the generated 2.0 bootstrap unchanged. Existing CLI
migrations, installation, activation, release and merge remain outside scope.

## Relationship to the reviewed candidate

Read this record before revising the [candidate](index.md). The reviewed
manifest, [candidate.sha256](candidate.sha256), has SHA-256:

`751cca38f0edc5012e8dad2170e1d46a0e90447dac1ce8a7ec4effe9f02dcd8a`

This record is outside that manifest. Its five accepted directions qualify
the corresponding open questions in [decisions.md](decisions.md); the frozen
candidate has not yet incorporated them. Its existing review does not cover
the future wording or design needed to implement these decisions.

The source plan remains in the vault's `projects/cli-design-skill` packet.
This repository-binding record does not relocate that packet or settle the
post-vault home of planning and acceptance records.

## A1. A person may close an operation with an unknown outcome

Status: accepted direction. Relates to Q7 and CMD-13/CMD-13a.

Nathan: "Yes, allow an authorised person to close it as outcome unknown,
but never automatically replay it."

- Permit an authorised person to close the unresolved operation while
  retaining the fact that its effects remain unknown.
- Keep closure separate from proof of success, failure or non-application.
- Never use closure as authority for automatic replay.
- Design and verify the runtime authority boundary. A caller-supplied
  boolean or TypeScript value is not proof that a person authorised closure.

Reason and trade-off: provide an end to a case where evidence cannot be
obtained, while explicitly retaining the uncertainty a person accepts.
The alternative discussed was leaving the case unresolved until evidence
arrives, potentially indefinitely.

Required proof, not yet run: an agent cannot forge human closure; closing
preserves the unknown history; closure never repeats a completed or uncertain
effect. The exact closure record and authorisation mechanism remain to design.

## A2. Block affected operations and resources only

Status: accepted direction. Refines Q7's blocking scope.

Nathan: "Yes, only block the affected operation and resources. Let unrelated
work continue when we can prove it's independent."

- Scope unresolved-work restrictions to the affected operation and resources.
- Permit other work when independence is established.
- Treat unproven independence conservatively; a different command name alone
  does not establish independent resources or shared invariants.

Reason and trade-off: an uncertain operation should not stop unrelated work,
but the design must establish resource overlap and independence correctly.
The alternative discussed was blocking all changes through the CLI.

Required proof, not yet run: two operations sharing an affected resource are
blocked appropriately; a demonstrably independent operation proceeds; unknown
or incomplete resource information cannot evade the restriction. The resource
model, evidence for independence and concurrency mechanism remain to design.

## A3. Place the new tools beside the skill

Status: accepted. Addresses final-review finding 4 and ROLL-4/ROLL-7.

Nathan: "Yes, put the 3.0 checker, composer and exemplar in agent-engineering
alongside the skill, behind the one CLI."

- Make `agent-engineering` the source owner of the 3.0 checker, composer and
  exemplar alongside `agent-cli-design`.
- Expose application commands through the repository's one existing CLI.
- Preserve the separate template repository and the accepted foundation-first
  order. Keep existing 2.0 callers working until separately migrated.

Reason and trade-off: keep the contract and its tools together. Moving the
tools adds packaging and consumer-routing work; leaving them in Dotfiles
would keep the owners split. The kept 2.0 checker's final placement and
consumer routing need engineering reconciliation, not automatic relocation.

Required proof, not yet run: discovery and actual dispatch reach the new
commands through one front door; existing 2.0 consumers retain their checker;
the adoption and rollback descriptions name the actual repositories and pins.

## A4. Use four next-step kinds

Status: accepted direction for the candidate. Resolves the kind-list part of Q2.

Nathan: "Yes, we should try those four next step kinds, command, retry,
instruction, and done."

- Use `command`, `retry`, `instruction` and `done` as the proposed 3.0 kind set.
- Preserve the inherited restrictions: unknown and partial effects cannot
  suggest retry; done appears only on success; guidance grants no authority.
- Keep human closure as a handoff requiring authority, not an ordinary retry.

Reason and trade-off: make retry and completion explicit for machine readers,
at the cost of more validation than command and instruction alone. This does
not accept every field, binding rule or example in the draft. Sequences and
branching workflows were not added by this decision.

Required proof, not yet run: reject each illegal outcome/kind combination;
resolve command suggestions to declared routes; preserve exhaustive handling.

## A5. Allow implementation modules in src or packages

Status: accepted placement direction. Refines A3 without adding a CLI.

Nathan: "Yeah, the implementations can live in the packages folder. If it's
a big implementation, or if it's small, it can live inside the source folder."

- Keep small implementations under `src/` and allow large implementations
  under `packages/`.
- Register application commands through the single `src/cli.ts` front door
  and its command registration owner. A package does not add a second
  application CLI.
- Choose placement through engineering judgment. No size threshold, workspace
  package configuration or exact command names were accepted in this exchange.

Reason and trade-off: separate substantial implementations without forcing
small modules into packages. The split adds import and build boundaries only
where useful. The earlier illustrated file layout was not an exact layout spec.

Required proof, not yet run: package and source implementations are discoverable
and callable through the same CLI; no second application front door appears.

## Requested repair guidance and diagnosis

Nathan also requested repair hints so an agent can identify the next step,
potentially unblock the operation and diagnose why it happened.

Use the existing [guidance](next-steps.md) and [diagnostics](diagnostics.md)
owners. Distinguish observed facts from suspected causes. Offer read-only
inspection and identify any separately authorised repair. Neither a hint,
diagnostic record nor suggested command proves an effect absent or grants
permission to replay. Exact new fields or a new repair protocol were not
accepted; the earlier TypeScript fragments were illustrative.

Required proof, not yet run: changing or removing diagnostics does not change
the recovery decision; repair hints do not bypass authority or replay rules.

## Remaining work and next question

Next walkthrough question: Q3, whether structured command guidance can carry
validated values produced by the run, such as the ID of a preview. Its field
shape and rules remain proposed. Preserve the user's opportunity to choose.

Other unresolved matters include the recovery and lock design, the detailed
version policy, lifecycle departures, remaining schema/lint questions and the
post-vault record owner. Do not reopen accepted toolchain, single-CLI or
base-plus-add-ons decisions. Check inherited requirements before promoting a
review finding to a new product question.

The next drafter must reconcile these decisions with the frozen text, address
supported final-review findings, produce a new manifest and obtain review of
changed wording. Keep implementation evidence labelled unrun. Nathan must
accept the exact revised contract text before Contract 3.0 implementation.

No instruction here authorises migration of planning records. Exact verbs such
as `contract check`, `contract explain` and `template compose` remain examples.
