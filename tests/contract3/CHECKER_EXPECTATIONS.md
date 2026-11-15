# Independent checker report expectations

[checker-expectations.json](checker-expectations.json) freezes the T6 checker
rule identities, finding codes, valid/negative pairs and required variants
before production checker implementation. Its 93 pairs come from the accepted
clauses, the foundation T6 brief and the independent T0 oracle. No production
T1 implementation or checker output supplied expected values.

[checker-report.schema.json](checker-report.schema.json) declares the checker
report data interface under VER-14. It is an engineering interface, not a
Contract 3 wire extension, new common cause or universal evidence format.
`reportVersion: 1` versions this report data only. The checker help must explain
the final admitted interface before release.

The source identity is accepted commit
`5693651d19c6fba2430c904688e583266dbe58a0`, manifest SHA-256
`c162c9850ca506fd839ce36b2b1a8172f064516b0f229dd34a5678b366b02b9d`.
This work starts at engineering commit
`719c89e0cd9e35629d6fb3ee918ed729166b7b57` and serves C3-FND-7/T6.
The 20 frozen contract files and both T0 fixtures remain unchanged. T0 retains
all 49 verification rows, 20 common causes and 34 compiler locks.

## Row meaning

The schema describes data only. Rows are identified by the pair `ruleId` and
`caseId`, never by a new station ID. The test-owned admission binds exact case
identities, applicable rules and expected status counts before running a
candidate. First assert that full identity set, then inspect rows. Missing,
duplicate, unexpected or empty results cannot pass by vacuous iteration.

Every failed row uses its independently declared finding code and bounded,
redacted explanation. Multiple independently detectable violations remain
visible. A negative changes one rule; unrelated evaluable rows remain green.
Rows blocked by a failed prerequisite disclose `not_run`, never fabricated
observations. Separate well-formed valid twins exercise dependent rows.

`passed` and `failed` require evidence at the named proof layer. `not_run`,
`skipped`, `timed_out` and `missing` remain unproved. `declared_unreachable`
requires a reviewed impossibility rationale and evidence. A string satisfying
the schema is not proof that the cited evidence exists or supports the claim.
The report examples are synthetic shape examples only, not receipts.

The schema rejects unknown keys, missing required keys, unsupported statuses,
empty reports, failed rows with no findings, passed rows with findings, and
unproved rows without reasons. Semantic admission additionally checks rule/code
agreement, identity uniqueness, evidence and exact coverage counts.

## Refusal remains an ordinary refusal

VER-10 and VER-11 prescribe the checker refusal: schema class, exit 4,
unchanged inspect result, `data: null`, observed version and violated
key/correlation in `message`. A 2.0 refusal names the retained checker's actual
route from [retained-2.json](retained-2.json). It does not invoke that checker,
adapt output or replay the target.

VER-14 describes the checker-owned report in `data`; it does not require a full
row report on refused invocations. Full refusal-report transport is intentionally
unbound optional detail. These fixtures introduce no sidecar, stderr format or
success result for broken output. Finding codes in `formatCases` are test-owned
classification expectations, not invented refusal envelope fields. Failure
detail remains in the required message. Actual command admission must preserve
these distinctions.

## Binding and proof

`requirementBindings` maps V-17/V-34 and every named T6 supporting obligation
(V-9, V-12, V-14, V-15, V-16, V-35, V-43, V-44 and V-48) to frozen rules and
controls. V-10/V-11/V-13 support discovery agreement. `requiredVariations`
enumerates source-determined subcases. The fixture links existing T0 tables
instead of duplicating their sealed semantic vocabularies.

`supportBoundaries` assigns proof that a checker cannot infer from output to its
real owner. Shape checking cannot prove instruction meaning, secret status,
authority, actual recovery truth, secure diagnostics custody or writer handling
of values that cannot cross JSON. Those observations must remain disclosed.

Before implementation uses a case as proof, an independent test author binds
the concrete target bytes/program, input, immutable case identity, real command,
required row set and expected counts. Use the existing application CLI and
disposable specimens; do not add fake production commands. Bind numeric finite
input/pattern/time budgets and the fixture-only minor table independently before
their production implementation. No production-generated expected answer is
admitted. Any new semantic rule or changed expectation receives independent
source review before implementation, not a mass update to match code.

The no-replay scenarios require a real target to increment a separately read
counter exactly once before emitting malformed, broken, unsupported or hostile
output. The reader exits 4 without running that target again. The valid twin
keeps the same increment and emits accepted output. A disposable retry defect
must make the counter two and fail the harness. Capture real stdout/stderr,
exit and state. The reader's unchanged result says nothing about whether the
target changed its resource.

Ordinary target machine completion must leave stderr empty, including help,
discovery, usage refusals, internal failures and normal command completion.
Each route variant has an otherwise-valid stdout/exit negative that emits one
stderr line, and an empty-stderr valid twin. The target stream is distinct from
the checker's own stderr. Exceptional lifecycle outcomes retain their separate
LIFE-3 guarantees.

Envelope-bearing target exits 1, 4 and 75 each require admitted process
specimens. Compare both real exit and observed cause with independent expected
values, in addition to envelope/exit agreement. A valid exit-1 fallback cannot
satisfy an expected exit-3 domain refusal.

Every observation remains `not_run`. No checker command or production test is
implemented here. Static schema/source checks execute zero behavioural tests.
No T6 completion, qualification, installation or activation is claimed.

## Preserved exclusions

The T0 exclusion owner remains [expectations.json](expectations.json).
Product raw-stream retention stays disabled; private test receipts do not enable
it. Human authority and takeover remain qualification-gated. No existing CLI
migration, contract change, provider activation, new dependency, remote creation
or post-vault ownership decision is introduced.
