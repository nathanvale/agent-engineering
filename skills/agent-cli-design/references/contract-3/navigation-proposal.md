# Generated command and station navigation

Status: proposed wording for the next Contract 3.0 candidate. Requested by
Nathan on 15 November 2026. This is outside the frozen candidate manifest;
its review does not cover this addition. No implementation or behavioural
test result is claimed here.

Read this when revising discovery or preparing its implementation checks.
Apply [accepted decisions A10 and A11](accepted-decisions-2026-11-15.md#a10-refuse-a-missing-command-and-keep-explicit-help-successful)
alongside [discovery](discovery.md). Preserve the accepted toolchain, one
application CLI and base-plus-add-ons design.

## NAV-1. Navigate through the existing CLI

Use progressive discovery through the existing routes:

1. `bun run src/cli.ts --help` shows human usage and exits 0.
2. `bun run src/cli.ts --discover --json` lists registered command summaries.
3. `bun run src/cli.ts --discover-command <commandIdentity> --json` describes
   one selected command and its possible outcome stations.
4. Inspect a station's declared guidance, repair hint or handoff. Resolve any
   referenced command identity through the same discovery routes before
   deciding whether to invoke it under the caller's authority.

These are argument shapes, not commands to paste with angle brackets intact.
Use the repository's existing front door when its path differs. Add no second
CLI, navigation executable, dashboard service or new discovery route.
Implementations may live under `src/` or `packages/`; both register through
the same application CLI.

Retain DISC-1 and DISC-2 output and routing rules: human and machine modes,
one envelope in machine mode, global `--json` before `--`, mutually exclusive
built-in discovery switches, and usage refusals for invalid selectors or
invocations. With no command, show usage guidance and exit 2, as accepted in
A10. Fit human refusal guidance into the inherited single stderr line; do
not silently change this to successful help or a second output format.

## NAV-2. Generate from executable declarations

Generate help, command discovery and selected-command stations from the
declarations registered in the running executable. Use the same completed
registration set for dispatch. A command registered by composition or an
add-on must not appear in discovery while an earlier cached dispatcher
cannot route to it.

Keep command identity, route tokens, summary and effect class with their
executable command owner. Keep fixed station fields and guidance with the
station owner used to construct results. Include applicable kernel stations
and retain the inherited allowance to derive simple inspection stations;
do not require a second handwritten catalogue for them. Preserve the built-in
identities and their selected-command discovery from DISC-5.

Dynamic means reflecting the declarations of this executable invocation.
It does not require hot reload, runtime plugin downloads or probing providers
to discover commands. Cache only if discovery and dispatch still reflect
the same completed registration set. Exact registration and constructor APIs
remain engineering choices subject to these checks and the reviewed schema.

## NAV-3. Keep possible outcomes separate from current facts

Selected-command discovery retains `semantics: "possible-outcomes"` and
returns only that command's stations. Identify stations by the inherited
tuple `(commandIdentity, outcome, causeCode)`; introduce no wire station ID.
There is no request that dumps every command's stations at once.

Publish fixed guidance and templates without fabricating run values, current
resource state, current effect identifiers or permission to act. Runtime
results bind only validated values under accepted A6. Keep command names and
guidance fixed. Discovery is neither an execution plan nor proof of authority.

Use the four accepted next-step kinds, `command`, `retry`, `instruction` and
`done`, through [the guidance owner](next-steps.md). Follow command references
for further inspection; display instructions and handoffs as such. A map may
contain cycles. Reading it never automatically follows a retry, performs a
repair, closes an unknown outcome or replays an effect. Current facts require
an explicitly invoked inspection command. Existing recovery and authority
rules continue to govern any later action.

## NAV-4. Generate navigation without domain effects

Loading declarations and rendering navigation must not run domain handlers,
initialise domain providers or contact their networks. Unavailable integrations
must not prevent help, either discovery route or unrelated commands loading.
Separate metadata loading from provider initialisation and effectful handlers.

Freedom from domain effects includes not changing resources, acquiring domain
locks, consuming approvals, settling unresolved work or replaying operations.
It does not mean literally zero filesystem writes: retain only the bounded
journal and diagnostic maintenance already permitted and disclosed through
`effectExclusions`. [Diagnostics custody and limits](diagnostics.md#custody-and-limits)
remain binding; exclusions cannot disguise domain changes.

## Responsibilities and acceptance checks

The command owner supplies declarations and independently specified command
behaviour. The base owns registration, routing and navigation projections.
The checker owner verifies their agreement through real processes and
independent observations. All three belong behind the existing CLI; these
responsibilities do not create new applications or choose planning ownership.

All checks below are **required evidence for the proposed implementation,
not yet run**. Record source revision, invocation, stdout, stderr, exit code
and relevant resource observations. Use isolated state and fixture-owned
resources for actual dispatch. Test fixtures may supply commands; never add
artificial production commands to obtain passing checks.

| Check                        | Falsifiable result and failure control                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1. Navigation routes        | Invoke human and machine help, root discovery and selected-command discovery. Check identities, validated output, exit codes and exact command inventory against an independently authored fixture expectation. Include all four built-ins. Unknown identity, missing selector and incompatible switches refuse with exit 2. Bare invocation exits 2; explicit help exits 0. Exercise `--json` on both sides of `--` to prove the inherited mode rule.                                        |
| N2. Declaration changes      | Add or change a fixture declaration, then launch a fresh process. Help and discovery reflect the intended new identity, route and summary; removed entries disappear. Selected-command stations reflect changed declarations. A deliberately stale map fails the test.                                                                                                                                                                                                                        |
| N3. Actual dispatch          | Invoke discovered host routes with valid fixture inputs and assert the intended handler's independently observable result, including resource state where applicable. Also exercise built-ins with their required selectors. Treat dispatch's empty route as the specified usage refusal, not a successful host command. A deliberately stale dispatcher or wrong handler binding fails even when discovery looks correct.                                                                    |
| N4. Existing CLI composition | Compose into an isolated host with existing commands. Prove its front door is preserved, old and new declarations are discoverable, and both old and new routes actually dispatch. Assert one application entry point. Include registration after initial module loading to expose cached dispatch state.                                                                                                                                                                                     |
| N5. Station agreement        | Inspect each command separately. Check its applicable kernel and host stations, and absence of other commands' stations. Reach required stations through real process cases; compare emitted fixed fields, guidance and validated bindings with declarations and independent behavioural expectations. A changed repair instruction or omitted station fails. Reviewed impossible stations stay explicitly unreachable; missing evidence is not a pass.                                       |
| N6. Navigation references    | Resolve declared command guidance and handoff inspection identities through discovery, including built-ins. Check read-only classifications where required. An undeclared reference fails. Keep argument executability tests separate from schema validation: known fixture arguments must dispatch correctly, but token validation alone does not prove every argument is accepted.                                                                                                          |
| N7. No domain effects        | Traverse help, root discovery and every selected-command view, including invalid requests and cyclic guidance. Observe attempted provider calls, outbound requests, handler entry and domain mutations, and compare domain resources, locks and approval state before and after. No domain attempt or change is allowed. Account separately for permitted diagnostics. A test-only effect attempt, including write-then-undo, must be detected; unchanged final files alone are insufficient. |
| N8. Integration isolation    | Make a domain integration unavailable and make its initialisation fail if attempted. All navigation still succeeds and an unrelated fixture command dispatches. Assert that listing metadata never initialises the failing integration. This is process evidence, not a mocked renderer test alone.                                                                                                                                                                                           |

TypeScript types can keep projections aligned in authored code. They cannot
prove real dispatch, absence of effects, authority or validity of external
input. Preserve runtime declaration/result validation and process checks.

Illustrative TypeScript, not compiler-verified or a proposed public API:

```ts
// A minimal ownership sketch; full contract fields and validation are omitted.
type Summary = Readonly<{
  commandIdentity: string;
  route: readonly string[];
  summary: string;
}>;
type RegisteredCommand = Readonly<{
  summary: Summary;
  run: (args: readonly string[]) => Promise<void>;
}>;

function commandSummaries(commands: readonly RegisteredCommand[]) {
  // Read metadata. Never call command.run() to discover it.
  return commands.map((command) => command.summary);
}

// Dispatch must use this same completed set of registrations.
// A process test must prove that each route reaches the intended handler.
```

## Accepted input-schema direction and remaining draft choices

- **Per-command input schemas are required.** [Accepted A12](accepted-decisions-2026-11-15.md#a12-generate-argument-and-option-schemas-from-input-declarations)
  requires schemas generated from the command's input declarations. Publish
  them through selected-command discovery. The exact format and supported
  constraint vocabulary remain for the draft; root `HelpData.options` alone
  does not meet the requirement. Preserve runtime validation and the accepted
  version rules. No schema library or wire keys are selected here.
- **N9. Input-schema agreement, required proof not yet run.** Change a
  fixture's input declarations and verify discovery changes with them.
  Independently specified valid inputs parse; missing required inputs and
  violations of published constraints refuse before domain effects. A stale
  schema or disagreement with the parser fails the check. Keep runtime
  resource and authority checks separate from input-shape validation. N6's
  warning about token-only validation remains relevant until the revised
  schema contract and its checks are implemented.
- **Station construction remains to reconcile.** Derivation from executable
  declarations is required here; Q1's exact constructor design and other
  unaccepted station schema details are not accepted by implication.
- **No-result navigation retains Q7's boundary.** Use accepted read-only
  inspection requirements, but do not treat the proposed `ifNoResult` field or
  unfinished-work report shape as newly accepted by this addition.
- **No extra graph schema is selected.** Existing routes and station guidance
  provide navigation. Separate node/edge payloads, whole-catalogue dumps and
  per-command live availability fields are outside this proposal.

Integrate accepted wording into DISC and its verification rows in the next
candidate, reconcile it with A1 through A12, then obtain review of the new
exact text and manifest. Nathan's acceptance of the exact contract remains
required before Contract 3.0 implementation.

## Source map

| Requirement                                                                    | Authority or inherited source                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Existing routes, progressive discovery, station tuple and independent evidence | C0, Help and command-scoped discovery (`my-second-brain-playground` repository, `projects/cli-design-skill/specs/control-contract-evolution.md`); candidate DISC-1 through DISC-12. C0's superseded version/profile fields are not reintroduced. |
| One CLI, executable declarations and kernel ownership                          | Current plan, B12 (`my-second-brain-playground` repository, `projects/cli-design-skill/contract-3-plan.md`); accepted A3, A5 and requested A11. Prototype-derived constructor details remain proposals.                                                                            |
| Guidance, bindings, recovery and authority                                     | Accepted A1, A2, A4 and A6; candidate STEP-1, STEP-6, STEP-12 and STEP-14.                                                                                                                                                                                                                 |
| Integration isolation and declared bookkeeping exclusions                      | Candidate DISC-2a, DISC-6 and DIAG-13, inherited C0 diagnostics/noninterference rules.                                                                                                                                                                                                     |
| No command versus explicit help                                                | Accepted A10; inherited C0 invocation and output rules.                                                                                                                                                                                                                                    |

No prototype or type example establishes the production guarantees above.
