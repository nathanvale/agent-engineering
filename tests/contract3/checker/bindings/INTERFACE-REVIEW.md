# Interface review by the independent binder (T6, MAG-105)

Reviewer: `c3-t6-bindings`, the independent case binder. Subject:
[INTERFACE.md](../INTERFACE.md) at commit
`7e08c0b45e1886bd6bf0802a444946463c71660f`. Sources: the frozen contract under
`skills/agent-cli-design/references/contract-3/` (redacted manifest checked, 20
of 20), [checker-expectations.json](../../checker-expectations.json),
[checker-report.schema.json](../../checker-report.schema.json),
[CHECKER_EXPECTATIONS.md](../../CHECKER_EXPECTATIONS.md),
[expectations.json](../../expectations.json),
[retained-2.json](../../retained-2.json) and Nathan's binding decisions of 16
November 2026 (B1, B2, B3, F01). No checker code, kernel or `src/` file was
read. Status: review only; every observation stays `not_run`.

## Verdict

The proposed admission document and report can express every rule, format case,
no-replay case and additional control, with three stops and a set of binder
interpretations. Binding proceeds against the interface as written plus the
interpretations below. Each interpretation is a proposal to the implementer; a
disagreement changes the named cases, not the method.

| Result                                 | Rules                                                                                                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bound as written                       | 66 rules                                                                                                                                                                             |
| Bound with a stated interpretation     | `template-token`, `binding-keys`, `binding-placement`, `token-argv`, the 11 `input-*` process rules (one rule per argv case), `station-required`, `open-cause`, `unreachable-review` |
| Bound, conditional on D3 and the table | `version-newer` (3.1 reader part), `declared-minor-shape`, `fallback-version` (valid twin), the four static `minor-*` rules                                                          |
| Negative stopped                       | `fallback-version` (contract and oracle disagree, G14), `diagnostics-absent` (G13), `minor-meaning` (review only, no detectable negative)                                            |

Counted by rule: `fallback-version` sits in two rows, so the rows sum to 94. The exact case totals
live in `MANIFEST.json` once binding completes.

## Gaps and ambiguities

Each gap names the rules it blocks or bends and what the binder does about it.

**G1. Negatives are visible only as refusals.** Section 5 sends every failed
row to an exit-4 refusal with `data: null`. The oracle requires, for each
single-rule negative, the exact finding code, every unrelated evaluable row
`passed`, and prerequisite rows `not_run` (reportSemantics 4 and 5). None of
that crosses the process boundary. The interface names the component layer but
not its entry point. Blocks the row half of all 93 negatives and the
`broken-supported` format case. Binder action: every expected file carries the
process expectation (exit, cause, `data: null`, empty checker stderr, message
substrings) and a separate component expectation (the full row set). The
implementer must expose one pure judgement that takes the admission, the
observations and the supported-minor table and returns rows in the
`checker-report.schema.json` item shape, `failed` rows included. The harness
asserts the component rows against that entry point and the process fields
against the real CLI. Neither substitutes for the other.

**G2. No prerequisite model.** Nothing says which failure blocks which row.
Binder action, bound in `BINDINGS.md`:

1. A framing failure (`json-framing`) blocks every other row on that case
   except `machine-stderr`.
2. A version refusal (`version-malformed`, `version-major`, `version-newer`)
   blocks every row on that case except `json-framing`, the version rules and
   `machine-stderr` (VER-10: no other key of a refused version is interpreted).
3. A cross-observation row whose discovery or command-discovery case is not
   admitted, or is itself refused, is `not_run`.
4. Otherwise rules evaluate independently. A negative admits only rules whose
   input does not include the mutated location; each excluded rule is listed
   in that case's expected file with its reason. The binder never predicts a
   collateral `failed` row.

**G3. Captured fields.** `Captured.stdout` and `stderr` read as content, while
section 3 calls them files. Bound as file paths relative to the admission
directory.

**G4. Default working directory and where admissions run.** `cwd` is optional
and its default is unstated; section 12 says the harness writes admissions to a
fresh temporary directory, which breaks relative specimen paths and leaves the
no-replay counter path machine-specific. Binder action: every run case states
`cwd: "."`; the harness copies `tests/contract3/checker/bindings/` and
`tests/contract3/checker/specimens/` together into one fresh temporary
directory, preserving their relative layout, verifies every file against
`MANIFEST.json`, and runs the admission there. Counter and state files are
relative paths inside that copy, so admissions stay byte-identical.

**G5. Stop after refusal versus later captured cases.** Rule 9 stops further
runs; it does not say whether later captured cases are judged. Binder action:
in every negative the subject case is last, so no expected row depends on this.

**G6. Message assertions.** The oracle forbids a byte-exact prose oracle.
Binder action: substrings only. Malformed: the case id, `contractVersion` and
the observed value rendered as JSON (`"3.0.1"`, `3`, `null`). Other major: the
exact observed string; for `2.0.0` also the kept wrapper path and pin from
`retained-2.json`. Newer minor: both versions. Broken: the case id, the
observed version and the mutated key name. Any refusal after a run is not
pinned beyond these.

**G7. Template rules sit on the wrong observation.** `template-token` and
`binding-placement` judge station templates, which exist only in
command-discovery `PublicStation` guidance and `repairAction`; `binding-keys`
needs those templates to know the exact required names. Section 9 lists all
three as "each envelope alone". Binder action: `template-token` and
`binding-placement` rows attach to the command-discovery case; `binding-keys`
attaches to the command case with its command-discovery case admitted earlier.

**G8. The process input rules cannot be told apart by argv.** `input-case`,
`input-required`, `input-option`, `input-presence`, `input-repeat`,
`input-string`, `input-integer`, `input-constraints`, `input-hidden`,
`input-dash` and `input-deadline` all reduce to one three-way agreement: the
checker's reading of argv under the projected schema, the observed process
result and `expect`. Binder action: each argv case admits exactly one input
rule, which owns the finding; no negative admits a second input rule.

**G9. No channel for parsed values.** `input-repeat` (order preserved) and
parts of `input-integer` (precision loss) need what the target parsed, which no
contract field carries and `Expected` cannot pin. Binder action: these cases
use the D2 probe, with the specimen recording parsed values to state. They are
conditional on the probe applying to these P rules as well as group F.
Alternative for the implementer: an `expect.data` field compared at
`/result/data`.

**G10. `token-argv` has no process link.** No admission field links a rendered
step to a later run, and the checker cannot observe a shell. Binder action:
judged on a real run as element-for-element agreement between the emitted
`args` and the declared template after substitution, with element count
preserved. The negative splits one bound value into two elements and does not
admit `guidance-template`.

**G11. `station-required` refuses a correct target.** An incomplete admission
fails the row and so refuses with `SCHEMA_INVALID_INPUT`, although the target
is not broken. Accepted for now; the binder binds it that way and flags the
cause as a candidate for `DOMAIN_PRECONDITION_UNMET` review.

**G12. Checker-defect negatives.** The negatives of `open-cause` ("checker
rejects it"), `no-replay`, `observer-exclusions`, `raw-retention` and
`pattern-isolation` describe a broken checker, not a broken target. Binder
action: bind the valid target case and the expected harness result; the
negative is a disposable checker perturbation run by the harness.

**G13. `diagnostics-absent` cannot be judged.** Nothing in the wire, discovery
or admission tells the checker that the target lacks the diagnostics add-on.
Stopped. Needs an admitted independent fact, for example
`expect.diagnostics: "absent" | "present"`.

**G14. The fallback is not identifiable on the wire.** `fallback-version`'s
negative "stamp fallback with 3.1.0" assumes a reader can tell a fallback
envelope apart. VER-8 stamps the CLI minor on every envelope except the
fallback, and an `INTERNAL_PREPARATION` or `INTERNAL_RESULT_*` result produced
outside the fallback is legal at the CLI's minor (DISC-11b, LIFE-9, LIFE-10,
VER-9). A 3.1.0 internal result is therefore legal unless it came from the
fallback, which the wire does not say. Stopped under the rule "contract and
oracle disagree". The valid twin (a 3.0.0 fallback read by a 3.1 reader) is
bound.

**G15. Probe judgement.** Section 4 rule 12 runs a probe but does not say how
its result maps to rows. Binder action: an F (or G9) row passes only when the
observed result agrees with `expect` and the probe exits 0 with empty stderr
and stdout byte-equal to `expectedStdout`. A mismatch fails the row with its
finding code. A probe timeout makes the row `timed_out`; a probe nonzero exit,
nonempty stderr or spawn failure makes it `not_run` with a reason. Never
`passed`.

**G16. Required fields for P rules.** Section 3 makes `expect` optional. Binder
action: every case admitting `exit-expected` carries `expect.exitCode`, every
case admitting `cause-expected` carries `expect.causeCode`, and every F rule
case carries a probe. The checker's behaviour on a missing value stays open;
no binding exercises it.

**G17. `expect.commandIdentity` has no owning rule.** Binder action: used only
on `dispatch`, `command-selection`, `input-dash` (identity before operand
parse) and `input-deadline` (B1), where that rule owns a mismatch.

**G18. Human-mode criteria.** `Expected` has no stream expectations. Binder
action: a human-mode row judges real exit against `expect.exitCode`, nonempty
stdout on exit 0, and on a nonzero exit exactly one stderr line (LIFE-2). No
prose is judged.

**G19. Encoded size of `ifNoResult`.** DISC-13's 2,048-byte limit depends on the
encoding. Binder action: compact JSON with keys in the order `kind`, `command`,
`args`, which is also how the specimens print it. The 2,048 and 2,049 byte
cases are exact under that encoding only.

**G20. Specimen ownership.** The assignment gives the binder
`tests/contract3/checker/specimens/**`, while section 12 places the D3 reader,
which wraps checker code, there. Binder action: the D3 reader lives at
`tests/contract3/checker/specimens/reader-3.1/` and is the implementer's; the
binder writes nothing there.

**G21. Repository gates.** Fallow reports any loose specimen program as an
unused file outside every boundary zone. Binder action: each specimen program
starts with reasoned file-level `fallow-ignore-file` comments; JSON bindings
are kept Biome-formatted; target byte files use the `.stdout` and `.stderr`
extensions, which Biome ignores, so their bytes stay exact.

## Rulings

### D2: probe program, with an independent harness readback

Ruling: adopt the probe.

- Group F has frozen finding codes at the process layer. If the harness judged
  them, the checker would only ever report `not_run`, and the
  `checker-rule-disabled` control could never go RED for these five rules.
- The probe is admitted by the test author, runs once after its case under the
  same no-shell, empty-environment, null-stdin and budget rules, and is counted
  in the fixed execution total, so it adds no replay path.
- The harness still reads the same state file itself after the checker exits
  and compares it with the binder's expected bytes. The probe is never the only
  witness of a target effect.
- G15 fixes how a probe result maps to rows.

### D3: test-only 3.1 reader specimen, accepted with conditions

Ruling: accept the proposal.

1. The supported-minor table is a constructor argument of the domain. The
   production entry passes exactly `["3.0.0"]`, and no argv token, environment
   variable or admission key can change it.
2. The reader specimen at `specimens/reader-3.1/` accepts the same invocation
   and admission as the application command and prints the same envelope. It is
   never registered in `src/commands.ts`.
3. A production-reader case binds the same `3.1.0` bytes as
   `VERSION_UNSUPPORTED_MINOR`, so the fixture table cannot leak into production
   silently.
4. The fixture field table is a binder proposal recorded in `BINDINGS.md` and
   needs T1's agreement before use. Every case that depends on it is marked
   `provisional: fixture-minor-table`.

Rejected alternative: an admission key selecting supported minors. It would let
any caller make the released checker accept a minor that VER-15 confines to test
fixtures.

### D1: binding independent of the envelope major

D1 stays with Nathan. Every binding asserts only values with one meaning in
both majors: real exit, `outcome`, `effectClass`, `transactionState`,
`failureClass`, `causeCode`, `data` (`null` or the row report), empty checker
stderr, and message substrings. These assertions are deliberately not bound,
because they differ between option (a), a 2.0.0 envelope, and option (b), a
3.0.0 envelope:

| Assertion                             | Option (a), 2.0.0                   | Option (b), 3.0.0                  |
| ------------------------------------- | ----------------------------------- | ---------------------------------- |
| `contractVersion` value               | `2.0.0`                             | `3.0.0`                            |
| `envelopeVersion` key                 | present (the 2.0 integer)           | absent (WIRE-6)                    |
| Guidance key and shape                | `nextAction` string                 | `next` union or `handoff` (WIRE-8) |
| Success guidance words                | 2.0 sentence "No further action..." | `next` per the declared station    |
| Strict key set of envelope and result | the 2.0 tables                      | WIRE-5 and WIRE-7                  |
| Self-check by a 2.0 or 3.0 checker    | the kept 2.0 checker judges it      | the 3.0 checker judges it          |

The harness must pick these assertions from D1's outcome; no binding hardcodes
either.

## Binding decisions applied

- B1: `--deadline-ms` on a command without deadline support is refused with
  that command's identity; a malformed deadline value is refused as
  `<cli>.dispatch`. Bound in the `input-deadline` cases.
- B2: depth counts the envelope as level 0 and every value, scalars included.
  A scalar at level 64 is accepted and one at level 65 is refused. Bound in the
  `json-values` cases.
- B3: no specimen command declares approval, so `DOMAIN_AUTHORITY_REQUIRED` is
  not exercised. Recorded as not applicable rather than bound.
- F01: a station template whose substituted `args` cannot satisfy the target
  schema for any binding value is a declaration fault. Bound as a
  `step-arguments` variation on the command-discovery case.

## Budgets

Section 10 leaves thirteen numbers open. They are bound with reasons in
`BINDINGS.md` and as data in `BUDGETS.json`. One comes from frozen text
(`TARGET_JSON_MAX_DEPTH` 64, LIFE-7 step 2, counted per B2) and one from the
frozen 500 ms stopping bound (`TARGET_KILL_GRACE_MS`, LIFE-3 and LIFE-11); the
others are stated engineering numbers.

## Addendum: found while binding

Added after the review commit; the review above is otherwise unchanged except
for table formatting required by `bun run format:check`.

**G22. No rule owns a budget refusal.** Section 4 rule 7 and section 10 refuse
an over-budget stream or admission with `SCHEMA_INVALID_INPUT`, but no rule id
carries the component row. The four `budget.*` bindings bind the process
result only and mark `rowsUnbound`.

**G23. Pattern size budgets.** Whether an oversize pattern or subject is
caught while reading the declaration or while matching is unstated. Binder
action: the `pattern-budget` row on the input case that uses the pattern
fails; the subject-size case widens the declared `maxLength` so a length
refusal cannot pre-empt the budget.

**G24. Execution count is not observable in general.** Only a counter shows
how many times a target ran. Binder action: the no-replay bindings carry a
counter; every other binding lists its expected executions in
`targetExecutions` as an unobserved expectation.

**G17, refined.** `expect.commandIdentity` is carried on every run case, but
observed and expected identities differ only in negatives whose target rule
owns the difference (`dispatch`, `input-dash` and `input-deadline`; eight
negatives in all).

**Binder readings with a choice behind them.** These are bound and flagged in
their cases' notes; a different reading changes only those cases.

- An invalid caller value destined to become a binding is an argv value fault:
  `USAGE_INVALID_INVOCATION` (INPUT-2; CMD-9 step 3 allows usage or schema).
- An invalid generated binding found at creation, before any dependent effect,
  is `INTERNAL_RESULT_UNCHANGED`.

## Addendum 2: corrections after the checker review (repair round 1)

Applied through the generator on 16 November 2026 after the contract review
of the checker at `63d711a` (its B1 to B5) and the coordinator's decision on
S1 (option (i)). The text above is unchanged; these entries supersede it where
they differ.

- **G2, rule 1 narrowed (B2).** A framing failure blocks rows that read
  envelope content. Rules that judge whether an envelope is produced
  (`dispatch`, the navigation rules in machine mode, `machine-stderr`) are
  still judged, and the framing failure is their evidence (DISC-1, LIFE-1).
  `dispatch.negative.machine-help` was already bound this way.
- **G23, extended (B3).** `--code` `maxLength` is widened to 64 in every
  pattern-budget context (`pattern-budget.valid` and `.negative`, both
  pattern-budget no-replay bindings, `pattern-isolation.elapsed` and
  `.lifecycle`). No binding now assumes the checker checks length before
  matching the pattern, or the reverse.
- **Budget reason (B1).** On Bun 1.4.4, JavaScriptCore ends `(a+)+b` on 40
  characters after about 0.4 to 0.6 s with a false non-match. The bound
  refusal is unchanged and right by INPUT-2 and V-44. The pattern-isolation
  sensitivity control fails either by the time bound or by a wrong exit or
  cause.
- **G24 (B4).** The pattern-budget no-replay pair also counts its input run
  (`harness.additionalCounters`).
- **G16, tightened (B5).** Under option (i), a refusing binding's `expect`
  carries only the fields an admitted rule consumes.
