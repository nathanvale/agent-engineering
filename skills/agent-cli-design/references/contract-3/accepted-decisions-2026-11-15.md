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

This record is outside that manifest. Its accepted directions qualify
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

## A6. Allow validated run values in arguments and resource IDs

Status: accepted direction. Resolves the permission to add run-value bindings
in Q3; relates to STEP-9a, STEP-10, WIRE-7, V-14 and V-39.

Nathan: "Yes, allow validated run values in arguments and resource IDs, but
keep command names and guidance fixed. Make that durable."

- Permit validated run values, such as a preview ID, in whole argument tokens
  and resource identifiers.
- Keep command identities and guidance text fixed by their declarations.
  A run value cannot introduce an instruction or select another command.
- Preserve argv boundaries without shell evaluation. Validate caller-supplied
  bound values before effects, and validate the emitted result at runtime.
- Preserve the rule that guidance grants no execution authority. A valid
  binding does not permit replay, repair or human closure by itself.

Reason and trade-off: an agent can use the exact run-specific identifier
without reconstructing a command from prose. This adds validation rules; the
alternative was a text instruction referring the reader to message or data.
The exact wire key, template notation and limits still need reviewed wording.
This direction does not approve every detail of the existing Q3 proposal.

Required proof, not yet run: legitimate values remain single arguments;
malicious values cannot become options, command selectors or executable shell
text; secret values are not exposed; invalid bound input is refused before
effects; rendered guidance matches the fixed declaration after substitution.
Types alone cannot establish these runtime properties.

## A7. Declare the implemented contract version on normal responses

Status: accepted. Resolves the producer-version choice in Q5 and VER-8.

Nathan: "Yes, always declare the CLI's implemented contract version and
upgrade readers first. Make that durable."

- Stamp normal responses with the CLI's implemented contract version.
- Upgrade readers before producers that emit a newer contract minor.
- Preserve the already accepted rule that newer 3.x readers accept older
  3.x responses. Do not choose a version separately for each normal response
  based on the lowest schema it happens to fit.

Reason and trade-off: use a predictable producer identity without per-response
compatibility inference. Coordinated reader-first deployment is the cost;
lowest-fitting-version stamping would keep some older readers usable longer
but adds producer complexity.

Required proof, not yet run: all normal responses carry the implemented
version; reader-first rollout is checked; newer readers accept valid older
3.x responses; unsupported newer versions are refused clearly. The emergency
fallback's version was expressly left separate in the question Nathan answered.
This does not accept the rest of the version grammar or Q5 policy by implication.

## A8. Keep the emergency fallback at Contract 3.0.0

Status: accepted. Resolves Q5's fallback-version choice, VER-9 and LIFE-10.

Nathan: "Yes, keep the emergency fallback at 3.0.0 as the exception.
Make that durable."

- Declare `contractVersion: "3.0.0"` on the emergency fallback, as the
  explicit exception to A7's normal-response stamping rule.
- Keep that fallback within the original 3.0.0 format so every conforming
  3.x reader can interpret it. Do not relabel newer fields as 3.0.0.
- Preserve the inherited one-attempt fallback boundary and honest reporting
  of trusted effects or uncertainty. Fallback grants no authority to replay.

Reason and trade-off: an older 3.x reader can understand an emergency response
during an incomplete upgrade. Maintaining a frozen fallback format is the
cost; using the producer's newer version everywhere would be more uniform
but could make the emergency response unreadable to that older reader.

Required proof, not yet run: a producer at a test-only newer minor emits a
3.0.0-valid fallback, with no newer fields or union members; 3.0.0 and newer
readers accept it; its effect report remains honest; no fallback path retries
the domain operation. No future minor is released by this decision.

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

Next walkthrough question: the minor-version evolution policy (Q5, VER-5
and VER-6). May later 3.x minors add optional fields and new contract-owned
union members while preserving every existing meaning, with readers upgraded
first, or should those additions require a new major? No choice has been made.
The remaining version grammar and common-cause rules also remain proposed.

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
