# Decisions and remaining choices

Candidate text, not accepted and not permission to implement. The original
candidate is preserved at commit `9d1ecf1`. Its Q1 to Q10 labels are historical;
they are not ten unanswered questions now.

## Settled directions

[The acceptance record](accepted-decisions-2026-11-15.md) preserves Nathan's
words for A1 to A20. [The requirement map](requirement-map.md#subsequent-accepted-decisions)
links each to revised clauses and falsifiable checks. These choices stay settled:

- One CLI with separate implementation files, and base plus add-ons.
- ESLint with TypeScript 6 for linting, native TypeScript 7 for compilation,
  and Biome for formatting. No extra dependency selected by this draft.
- Authorised human closure with outcome unknown; scoped blocking; no automatic
  replay; automatic reclaim needs runtime stopped-owner proof, while A20 permits
  trusted human confirmation. Both require guaranteed exclusive takeover.
- Four next-step kinds, validated run arguments, generated navigation and
  input schemas from executable declarations.
- Implemented-version stamping, readers first, additive minors, patch zero,
  and the fixed 3.0.0 emergency fallback.
- Bounded program shutdown, the selected lint rules, and approval consumption
  after exclusive lock acquisition and before the approved effect.
- New 3.0 tools in agent-engineering behind its one CLI; exact contract
  acceptance beside the contract; existing planning remains in place.

## Candidate wording to accept with the text

These are concrete draft choices, not additional accepted decisions. Accepting
the exact text would select them together; they do not require a sequence of
separate questions unless Nathan wants a different behaviour:

- The `next`, `bindings`, `input` and `ifNoResult` shapes in STEP-3,
  STEP-10, INPUT-2 and DISC-13. A12 explicitly leaves input format to the draft.
- Removal of `envelopeVersion`, `profile` and
  `generationConventionVersion`; declared built-ins; derived inspect stations;
  `availablePaths` means discoverable routes, never permission (WIRE-6,
  WIRE-6a, DISC-5, DISC-6, DISC-10, DISC-11).
- The detailed version grammar and refusal causes; no new common causes in
  a minor because names may already belong to a CLI (VER-1 to VER-11).
- Recovery records, scope declarations, read-only reporting and monotonic
  closure in REC-1 to REC-10. These are proposed design requirements, not
  demonstrated safety of a production implementation.
- The successor acceptance criteria in ROLL-8. Historical evidence cannot
  stand in for these new checks.

## Manual stop confirmation is settled

A20 accepts trusted human confirmation that the owner and delegated writers
stopped when the CLI cannot verify this. REC-7a carries it, preserving exclusive
takeover, current-owner checks and no replay. No immediate recovery-policy
choice remains from this review. Nathan still needs to accept the exact revised
contract text after its focused re-check; this decision is not that acceptance.

## Product and ownership choices still open

None of the following is silently selected by the candidate:

| Choice                                                                                                                                | When an answer is needed                         | Current boundary                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| May retained raw stream files be created by an inspect command, and are those files domain effects or declared diagnostic exclusions? | Before a build enables retained raw streams      | Keep retention disabled until its custody and classification are accepted. In-memory bounded capture is already required. |
| May add-on installation execute template code, and what is recovered if its checks fail?                                              | Before composer installation behaviour is built  | CMD-17 defines output ownership only; it does not authorise arbitrary template code execution.                            |
| Where do existing planning and B6 records live after the vault is deprecated?                                                         | Before those owners are retired or records moved | Keep current owners. A17 settles only the exact Contract 3.0 acceptance record.                                           |
| Which existing CLIs retire or migrate, and does the CLI on 1.0.0 ever move?                                                           | A later migration scope                          | Foundation first. No migration authorised.                                                                                |

The raw-stream and installer choices may be resolved during the separately scoped build before the
relevant capability is enabled. They do not make the accepted directions open
again. If a proposed implementation needs one earlier, surface that dependency
rather than choosing it implicitly.

The diagnostics packages already carry the accepted LogTape 2.4.2 pin
(template revision 4, tool ownership and target pins). No new choice or upgrade
is introduced here.

## Engineering and missing proof

Kernel function signatures, the schema encoder, lint selectors, authoritative
closure verification, local locking primitives, composition mechanics and the
verification skill's test layout belong to engineering under the accepted rules.
Choose them with independent negative controls, not another preference vote.
An implementation that cannot prove REC-7 must hand off, not loosen reclaim.
The six prototype double casts still need a cast-free implementation.

No 3.0 kernel, checker or composer exists. Every runtime, compiler and process
check remains a build obligation unless separately labelled as an isolated
probe. [Verification](verification.md) records those limits. Final acceptance
of exact reviewed text remains Nathan's next contract-wide decision.
