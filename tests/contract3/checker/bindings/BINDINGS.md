# Contract 3 checker bindings

Independent case bindings for the Contract 3.0 checker (T6, MAG-105), written
by `c3-t6-bindings` from the frozen contract and oracles only. Every
observation is `not_run`: no checker exists and none was executed. The
interface review, gaps and rulings are in
[INTERFACE-REVIEW.md](INTERFACE-REVIEW.md).

## What is here

| Path                        | Owner and meaning                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| `cases/<id>/admission.json` | The admission the checker reads, unchanged by the harness                                         |
| `cases/<id>/expected.json`  | The binder's expected process result, component rows, exclusions and harness or static assertions |
| `cases/<id>/*.stdout`       | Exact target bytes (captured cases and run responses); never reformatted                          |
| `cases/<id>/*.table.json`   | The response table a run case's specimen serves                                                   |
| `cases/<id>/table.json`     | Static fixture-minor tables (group T)                                                             |
| `shared/`                   | Unmutated context bytes shared by many cases                                                      |
| `../specimens/target.mjs`   | Table-driven target: exact argv in, exact bytes and exit out, optional counter and state          |
| `../specimens/probe.mjs`    | Read-only D2 probe that prints the state file                                                     |
| `MANIFEST.json`             | Every binding, its files' SHA-256, oracle references, V rows, counts and totals                   |
| `BUDGETS.json`              | The thirteen bound budget numbers (reasons below)                                                 |
| `STOPPED.json`              | Cases that cannot be bound, with clauses                                                          |
| `author/`                   | The binder's generator. Provenance only; the committed bytes are the binding                      |

`../specimens/reader-3.1/` is reserved for the implementer's D3 reader (G20);
the binder writes nothing there.

## How the harness must use them

1. **Verify identity first.** Read `MANIFEST.json`. The set of directories
   under `cases/` equals the manifest's binding ids, with no extra, missing or
   duplicate id. Every listed file, shared file and specimen matches its
   SHA-256. A mismatch fails the whole suite before any run.
2. **Copy, then run in place.** Copy `bindings/` and `specimens/` into one
   fresh temporary directory with the same relative layout. Run each admitted
   binding from that copy:
   `bun run src/cli.ts contract3 check --admission <copy>/bindings/cases/<id>/admission.json --json`
   from the repository root. Bindings whose `reader` is `test-minor-3.1.0` run
   the D3 reader specimen with the same arguments instead. Counter and state
   files appear inside the copy; nothing in the admission changes.
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
5. **Component assertions** (`rows`): feed the same admission and the
   captured observations to the checker's pure judgement (G1). For each case,
   `passed` rules are `passed` with nonempty evidence and no findings;
   `failed` rules are `failed` with exactly that finding code among their
   findings; `notRun` and `timedOut` rules carry those statuses with a
   nonempty reason. `counts` equal the tally by status. A negative is proved
   only when both layers match.
6. **Harness blocks** (`harness`): run the stated assertion and the stated
   sensitivity control in the same harness. No-replay bindings read their
   counter file after the checker exits: `absent` before, `1\n` after. A
   perturbed checker that reruns the target must make the counter `2\n` and
   the harness must fail.
7. **Static blocks** (`static`, group T): feed `table.json` or the stated
   constants to the repository's static check and assert the verdict and
   finding codes.
8. **Rule sensitivity** (`MANIFEST.json` `procedures`): for every listed
   negative, disable its target rule alone; the binding must stop matching and
   the harness must fail; restore and it matches again.
9. **Stopped cases** (`STOPPED.json`) are reported as stopped, never passed
   and never silently skipped.

`targetExecutions` lists every run and probe the checker must start, in
order. Execution count is independently observed only where a counter
exists (the no-replay bindings); elsewhere it is not independently observed,
which stays a stated proof gap.

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
  admission, after its discovery and command-discovery context (G5).
- **Applicability.** A rule is admitted on a case only where the case holds
  the element it judges; no binding relies on a vacuous pass.
- **Footprints.** Each command-judged rule has a declared footprint (what it
  reads). A negative admits only rules whose footprint misses the mutated
  location, and lists every excluded rule with its reason in `excluded`. The
  binder never predicts a collateral `failed` row; unrelated admitted rows are
  expected `passed`.
- **Prerequisites.** A framing failure blocks every other row on that case
  except `machine-stderr`; a version refusal blocks every row except
  `json-framing`, the version rules up to the refusing class and
  `machine-stderr` (VER-10 order). Blocked rows are `not_run` with a reason.
  Later version classes are not admitted after a refusing class.
- **Review rules.** `unreachable-review` and `minor-meaning` never pass from
  shape; their valid twins expect `not_run` with a review reason.
- **One input rule per argv case** (G8). Expected exits, causes and
  identities come from the binder's reading of INPUT-2 to INPUT-5 and the
  B1 decision, never from the specimen's catalogue.

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

| Name                            | Value     | Reason                                                                                                       |
| ------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------ |
| `ADMISSION_MAX_BYTES`           | 1,048,576 | Largest bound admission is under 100 KB; 1 MiB bounds hostile input with headroom                            |
| `ADMISSION_MAX_CASES`           | 256       | Largest bound admission has 6 cases; `budget.admission-cases` admits 257                                     |
| `TARGET_STDOUT_MAX_BYTES`       | 1,048,576 | Discovery output is a few KB; 1 MiB matches the DIAG-9 per-run order of magnitude                            |
| `TARGET_STDERR_MAX_BYTES`       | 65,536    | Only emptiness, length and digest are used; one bounded line is far below                                    |
| `TARGET_JSON_MAX_DEPTH`         | 64        | Frozen: LIFE-7 step 2, counted per B2 (envelope level 0, every value counts)                                 |
| `TARGET_RUN_MAX_MS`             | 5,000     | Specimen runs take tens of milliseconds; 5 s is a wide CI margin and keeps the timeout case short            |
| `TARGET_KILL_GRACE_MS`          | 500       | Frozen 500 ms stopping bound (LIFE-3, LIFE-11)                                                               |
| `PATTERN_MAX_SOURCE_BYTES`      | 4,096     | Real declaration patterns are tens of bytes                                                                  |
| `PATTERN_MAX_SUBJECT_BYTES`     | 4,096     | Above any declared string bound in the specimen and far above the 1,024-byte binding value limit (STEP-10)   |
| `PATTERN_MAX_MS`                | 250       | Benign anchored matches finish in microseconds; `(a+)+b` on 40 characters runs for minutes                   |
| `MESSAGE_MAX_BYTES`             | 2,048     | A case id, a 64-character version echo and a few key names fit; it stays well under the 16,384-byte fallback |
| `FINDING_MESSAGE_MAX_BYTES`     | 512       | One violated key or correlation and a repair direction                                                       |
| `OBSERVED_VALUE_ECHO_MAX_CHARS` | 64        | A legal version is under 20 characters; `budget.observed-version-echo` sends 201                             |

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
