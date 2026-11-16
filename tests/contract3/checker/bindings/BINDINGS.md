# Contract 3 checker bound cases

Independent bound cases for the Contract 3.0 checker (T6, MAG-105), written
by `c3-t6-bindings` from the frozen contract and oracles only. Every
observation is `not_run`: no checker exists and none was executed. The
interface review, gaps and rulings are in
[INTERFACE-REVIEW.md](INTERFACE-REVIEW.md).

## What is here

| Path                        | Owner and meaning                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| `cases/<id>/admission.json` | The admission file the checker reads, unchanged by the test harness                                    |
| `cases/<id>/expected.json`  | The binder's expected process result, component rows, exclusions and test harness or static assertions |
| `cases/<id>/*.stdout`       | Exact target bytes (captured cases and run responses); never reformatted                               |
| `cases/<id>/*.table.json`   | The response table a run case's specimen serves                                                        |
| `cases/<id>/table.json`     | Static fixture-minor tables (group T)                                                                  |
| `shared/`                   | Unmutated context bytes shared by many cases                                                           |
| `../specimens/target.mjs`   | Table-driven target: exact argv in, exact bytes and exit out, optional counter and state               |
| `../specimens/probe.mjs`    | Read-only D2 probe that prints the state file                                                          |
| `MANIFEST.json`             | Every bound case, its files' SHA-256, oracle references, V rows, counts and totals                     |
| `BUDGETS.json`              | The thirteen bound budget numbers (reasons below)                                                      |
| `STOPPED.json`              | Cases that cannot be bound, with clauses                                                               |
| `author/`                   | The binder's generator. Provenance only; the committed bytes, not the generator, are the bound cases   |

`../specimens/reader-3.1/` is reserved for the implementer's D3 reader (G20);
the binder writes nothing there.

## How the test harness must use them

1. **Verify identity first.** Read `MANIFEST.json`. The set of directories
   under `cases/` equals the manifest's bound case ids, with no extra, missing or
   duplicate id. Every listed file, shared file and specimen matches its
   SHA-256. A mismatch fails the whole suite before any run.
2. **Copy, then run in place.** Copy `bindings/` and `specimens/` into one
   fresh temporary directory with the same relative layout. Run each bound case
   that has an admission file (`totals.admitted` in `MANIFEST.json`) from that copy:
   `bun run src/cli.ts contract3 check --admission <copy>/bindings/cases/<id>/admission.json --json`
   from the repository root. Bound cases whose `reader` is `test-minor-3.1.0` run
   the D3 reader specimen with the same arguments instead. Counter and state
   files appear inside the copy; nothing in the admission file changes.
3. **Assert the identity set before any row.** When `checker.data` is
   `report`, `data.rows` holds exactly the pairs listed in `rows`: same
   `caseId` and rule set, no missing, duplicate or unexpected pair, and never
   empty. Only then compare statuses. A report that iterates zero rows never
   passes.
4. **Process assertions** (`checker`): real exit, `outcome`, `causeCode`,
   `failureClass`, `effectClass`, `transactionState`, `data` (`null` or the
   report), checker stderr empty, every `messageIncludes` substring present
   and every `messageExcludes` substring absent. Envelope keys that depend on
   D1 are not bound (INTERFACE-REVIEW.md, D1 table).
5. **Component assertions** (`rows`): feed the same admission file and the
   captured observations to the checker's pure judgement (G1). For each case,
   `passed` rules are `passed` with nonempty evidence and no findings;
   `failed` rules are `failed` with exactly that finding code among their
   findings; `notRun` and `timedOut` rules carry those statuses with a
   nonempty reason. `counts` equal the tally by status. A negative is proved
   only when both layers match.
6. **Test harness blocks** (`harness`): run the stated assertion and the stated
   sensitivity control in the same test harness. No-replay bound cases read their
   counter file after the checker exits: `absent` before, `1\n` after. A
   perturbed checker that reruns the target must make the counter `2\n` and
   the test harness must fail. Where `harness.additionalCounters` is present
   (the two pattern-budget no-replay bound cases count their input run too),
   every listed counter is compared the same way; ignoring one is a
   test harness defect.
7. **Static blocks** (`static`, group T): feed `table.json` or the stated
   constants to the repository's static check and assert the verdict and
   finding codes.
8. **Rule sensitivity** (`MANIFEST.json` `procedures`): for every listed
   negative, disable its target rule alone; the bound case must stop matching and
   the test harness must fail; restore and it matches again. Under the
   foundation coordinator's decision on S1 (option (i)), this is required at both layers
   and each layer's count is reported separately:
   - Component layer: always; the target row loses its bound finding.
   - Process layer: the bound refusal must disappear wherever the negative's
     observation breaks no other always-judged rule. Expectation rules
     (`exit-expected`, `cause-expected` and the input-agreement family) are
     judged only when listed, and every negative's `expect` carries only
     the fields its listed rules consume (review item B5). A broken observation of an
     accepted minor is still always refused (VER-10), so a negative whose
     mutation also breaks another contract rule (for example a deleted
     `failureClass`, which the declared station also contradicts) keeps
     exit 4 with its target rule disabled. For those, the process count
     records the refusal as over-determined, never as a pass, and the
     component layer carries the per-rule proof.
9. **Stopped cases** (`STOPPED.json`) are reported as stopped, never passed
   and never silently skipped.

`targetExecutions` lists every run and probe the checker must start, in
order. Stated limit (review S6, G24): execution count is observed only
through the no-replay counters, which cover 12 targets in 10 bound cases. Every
other `targetExecutions` list is an expectation the test harness cannot
observe, and is reported as such, never as proved.

## Expected-file shape

```text
{ bindingVersion: 1, id, rule, group, kind, oracle[], verification[],
  reader: "production-3.0.0" | "test-minor-3.1.0" | null,
  provisional[], admission, targetExecutions[],
  checker: { exitCode, outcome, causeCode, failureClass, effectClass,
             transactionState, data: null | "report", stderr: "",
             messageIncludes[], messageExcludes[]? } | null,
  rows: [{ caseId, passed[], failed{rule: code}, notRun{rule: reason},
           timedOut{rule: reason} }] | null,
  rowsUnbound, counts, excluded{rule: reason}, harness, static, notes }
```

`kind` is one of `valid-twin`, `negative`, `variation-valid`,
`variation-negative`, `format-case`, `control-valid`, `control-negative`,
`harness`, `harness-valid`, `static-valid`, `static-negative` or `budget`.
`oracle` entries are paths into `checker-expectations.json`, for example
`rules/strict-keys/requiredVariations/0` or `noReplayCases/executed-malformed-json`.

## How the rows were chosen

- **Subject last.** A negative's mutated case is the last case of its
  admission file, after its discovery and command-discovery context (G5).
- **Applicability.** A rule is listed for a case only where the case holds
  the element it judges; no bound case relies on a vacuous pass.
- **Footprints.** Each command-judged rule has a declared footprint (what it
  reads). A negative lists only rules whose footprint misses the mutated
  location, and lists every excluded rule with its reason in `excluded`. The
  binder never predicts a collateral `failed` row; unrelated listed rows are
  expected `passed`.
- **Prerequisites.** A framing failure blocks every row on that case that
  reads envelope content. Rules that judge whether an envelope is produced at
  all (`dispatch` and the navigation rules where machine mode must print one
  envelope, and `machine-stderr`) are still judged, and a framing failure is
  their evidence (DISC-1, LIFE-1; `dispatch.negative.machine-help`). A
  version refusal blocks every row except
  `json-framing`, the version rules up to the refusing class and
  `machine-stderr` (VER-10 order). Blocked rows are `not_run` with a reason.
  Later version classes are not listed after a refusing class.
- **Review rules.** `unreachable-review` and `minor-meaning` never pass from
  shape; their valid twins expect `not_run` with a review reason.
- **Expectation fields** (review item B5). In a refusing bound case, `expect` keeps
  `causeCode` and `outcome` only when `cause-expected` is listed, and
  `commandIdentity` only when `cause-expected`, `dispatch`,
  `command-selection`, `input-dash` or `input-deadline` is listed.
  `exitCode` stays whenever `expect` is present, since the interface makes it
  required. Valid twins keep their full `expect`.
- **No assumed check order.** Where an untrusted pattern is matched against a
  long subject, the declared `maxLength` is widened (`--code` to 64 in the
  pattern-budget contexts), so a checker may check length and pattern in
  either order (INPUT-2 fixes none; review item B3).
- **One input rule per argv case** (G8). Expected exits, causes and
  identities come from the binder's reading of INPUT-2 to INPUT-5 and the
  accepted decision B1, never from the specimen's catalogue.

## Specimen CLI

The specimen CLI `specimen` has the four built-ins and six host commands:
`list`, `show`, `find` (the rich input schema), `preview` and `apply`
(changing, `apply` with three effects and deadline support) and `pending` (the
`ifNoResult` report). All declarations, stations and words are in
`author/model.mjs`, written by hand from the contract. `target.mjs` checks its
argv against the table, increments `SPECIMEN_COUNTER` before any stdout byte,
appends a response's `state` text to the table's state file, prints exact
bytes and exits with the stated code; any mismatch exits 70 with one stderr
line. Specimens were run alone with Bun 1.4.4 under an empty environment on
macOS: all 265 runs and 18 probes produced their intended bytes, exits,
counters and state. `ubuntu-latest` is not yet observed.

## Budgets

| Name                            | Value     | Reason                                                                                                                                                                                                                                                                            |
| ------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ADMISSION_MAX_BYTES`           | 1,048,576 | Largest bound admission file is under 100 KB; 1 MiB bounds hostile input with headroom                                                                                                                                                                                            |
| `ADMISSION_MAX_CASES`           | 256       | Largest bound admission file has 6 cases; `budget.admission-cases` lists 257                                                                                                                                                                                                      |
| `TARGET_STDOUT_MAX_BYTES`       | 1,048,576 | Discovery output is a few KB; 1 MiB matches the DIAG-9 per-run order of magnitude                                                                                                                                                                                                 |
| `TARGET_STDERR_MAX_BYTES`       | 65,536    | Only emptiness, length and digest are used; one bounded line is far below                                                                                                                                                                                                         |
| `TARGET_JSON_MAX_DEPTH`         | 64        | Frozen: LIFE-7 step 2, counted per accepted decision B2 (envelope level 0, every value counts)                                                                                                                                                                                    |
| `TARGET_RUN_MAX_MS`             | 5,000     | Specimen runs take tens of milliseconds; 5 s is a wide CI margin and keeps the timeout case short                                                                                                                                                                                 |
| `TARGET_KILL_GRACE_MS`          | 500       | Frozen 500 ms stopping bound (LIFE-3, LIFE-11)                                                                                                                                                                                                                                    |
| `PATTERN_MAX_SOURCE_BYTES`      | 4,096     | Real declaration patterns are tens of bytes                                                                                                                                                                                                                                       |
| `PATTERN_MAX_SUBJECT_BYTES`     | 4,096     | Above any declared string bound in the specimen and far above the 1,024-byte run binding value limit (STEP-10)                                                                                                                                                                    |
| `PATTERN_MAX_MS`                | 250       | Benign anchored matches finish in microseconds. On Bun 1.4.4, JavaScriptCore stops `(a+)+b` on 40 characters by itself after about 0.4 to 0.6 s and reports a false non-match, so this budget must fire first; losing that race is a wrong answer, not a slow one (INPUT-2, V-44) |
| `MESSAGE_MAX_BYTES`             | 2,048     | A case id, a 64-character version echo and a few key names fit; it stays well under the 16,384-byte fallback                                                                                                                                                                      |
| `FINDING_MESSAGE_MAX_BYTES`     | 512       | One violated key or correlation and a repair direction                                                                                                                                                                                                                            |
| `OBSERVED_VALUE_ECHO_MAX_CHARS` | 64        | A legal version is under 20 characters; `budget.observed-version-echo` sends 201                                                                                                                                                                                                  |

## Provisional markers

- `d3-reader`: needs the implementer's D3 reader specimen.
- `fixture-minor-table`: uses the binder's proposed test-only 3.1.0 table
  (`fixtureNote`, optional), which needs T1's agreement.
- `probe-for-parsed-values`: uses the D2 probe for a group P rule (G9).

## Regenerating

`author/build.mjs` regenerates every case from `author/model.mjs` and the
rule files; see its header for the four commands. Regeneration reproduces the
committed bytes exactly. Any change to an expected value is a new expectation
that needs independent source review (CHECKER_EXPECTATIONS.md); never
regenerate to match checker output.
