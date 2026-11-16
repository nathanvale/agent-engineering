# Contract 3 checker interface (T6 Phase 1 design note)

Status: proposed interface for independent case binding. No checker code
exists. Nothing here is observed, qualified or proved. This note binds the
first `futureBindings` entry of
[checker-expectations.json](../checker-expectations.json) as a proposal:
command identity, arguments, input and report modes, command-owned outcomes,
guidance and help. Every other future binding stays with its named owner.

Sources, in authority order: the frozen contract under
`skills/agent-cli-design/references/contract-3/` (redacted manifest 20 of 20),
[checker-expectations.json](../checker-expectations.json),
[checker-report.schema.json](../checker-report.schema.json),
[CHECKER_EXPECTATIONS.md](../CHECKER_EXPECTATIONS.md),
[expectations.json](../expectations.json), [retained-2.json](../retained-2.json),
the foundation spec section T6 and the 16 November binding decisions (B1 to
B3, F01). Nothing here reads, imports or copies the Contract 3 kernel.

## Decisions needed before Phase 2

These do not block binding cases against the observable expectations below.
They do block the named Phase 2 code.

**D1. Which envelope major the checker itself prints.** VER-14 says the
checker's own result is "an ordinary envelope at the checker's minor", so
3.0.0. ROLL-2b and the acceptance record keep this repository's CLI on
Contract 2.0 until a separately scoped migration, and VER-12 forbids
dual-major support. The command lives behind that 2.0 CLI (ROLL-4, AGENTS.md).

| Option                                  | Consequence                                                                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a) Print the host CLI's 2.0.0 envelope | One CLI, one major. Accepted exclusions hold. VER-14 "at the checker's minor" stays an open, disclosed obligation until the host moves to the 3.0 base. |
| (b) Print 3.0.0 from this one command   | Mixed majors in one CLI. Host help and discovery describe 2.0. The kept 2.0 checker would judge this command broken.                                    |
| (c) Wait for the host migration         | T6 process receipts wait on unscoped migration work.                                                                                                    |

Recommendation: (a). Every checker expectation the oracle freezes (outcome,
effect class, transaction state, failure class, cause, exit, `data: null`,
message content) has the same meaning in both majors. Phase 2 must confirm
`SCHEMA_INVALID_INPUT`, `SCHEMA_UNSUPPORTED_CONTRACT` and
`DOMAIN_PRECONDITION_UNMET` exist in the host's 2.0 cause owner; if one does
not, stop and report rather than add it.

**D2. Independent effect observation for five process rules.**
`navigation-effects`, `provider-loading`, `input-future-binding`,
`input-generated-binding` and `input-runtime` need to know whether a target
changed state, which its stdout cannot prove. Proposal: an admitted read-only
probe program (section 4) that the checker runs exactly once after its case.
Alternative: the test harness reads state itself and those rows become
harness-judged (group H below). The binder chooses; without a probe these rows
report `not_run`.

**D3. How V-16 runs a 3.1 reader as a real process.** VER-15 keeps the test-only
minor in a reader's test fixtures. Proposal: the checker's domain takes its
supported-minor table as a constructor argument; production passes only
3.0.0. A disposable reader specimen under `tests/contract3/checker/specimens/`
constructs the same runner and judge with the fixture-only 3.1.0 table and
runs as its own process. It is not reachable through the application CLI. The
fixture minor table itself stays unbound (T6 with T1).

## 1. Command identity and route

| Item             | Value                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Command identity | `example.contract3.check` (the host CLI's identity prefix is `example`)                                                                    |
| Route            | `contract3 check`                                                                                                                          |
| Effect class     | `inspect`. Every result is `unchanged`, `inventoryComplete: true`, three empty effect lists.                                               |
| Registration     | One entry in `src/commands.ts`; domain code in separate files under `src/`.                                                                |
| Profile          | The host stays a simple-profile CLI. The checker starts target programs, but their effects are the target's, never claimed by the checker. |

Phase 2 consequence: the host dispatcher currently matches the whole argv to a
route and calls `execute([])`. It must pass the tokens after the route to the
command without changing any existing command's behaviour or tests.

## 2. Invocation and arguments

```text
example contract3 check --admission PATH [--json]
```

| Token              | Rule                                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| `--admission PATH` | Required, exactly once, followed by a separate value. The JSON admission document (section 3).            |
| `--json`           | The host's global machine-mode switch.                                                                    |
| Anything else      | Usage refusal: unknown option, repeated `--admission`, missing value, `--admission=PATH`, or any operand. |

The checker never reads its own stdin. All target data enters through the
admission document or through target runs it declares.

## 3. Admission document (the checker's input)

The admission is the test-owned binding of exact case identities, applicable
rules and independent expectations. The checker emits exactly the admitted
(`ruleId`, `caseId`) pairs, no more and no fewer. The checker never invents a
case or a rule.

```text
Admission = {
  admissionVersion: 1,
  cli: string,                  // the target's executable name, used to form <cli>.help etc.
  cases: Case[]                 // at least one; caseId unique
}

Case = {
  caseId: string,               // immutable, nonempty, unique in the admission
  rules: string[],              // ruleIds from checker-expectations.json; unique; at least one
  role: "help" | "discovery" | "command-discovery" | "dispatch" | "command",
  mode: "machine" | "human",
  target: Run | Captured,
  expect?: Expected,            // independent expected values; never production output
  sameAs?: string,              // deterministic-fields: the earlier caseId to compare with
  normalize?: string[],         // deterministic-fields: extra JSON Pointers under /result/data declared as time fields
  probe?: Probe,                // D2 proposal only
  selector?: string             // Phase 2a addition: command-discovery case only; the selected identity
}

Run = { kind: "run", program: "bun-runtime" | string, args: string[], cwd?: string, env?: { [name]: string },
        argvOffset?: integer }  // Phase 2a addition: leading args that are not the target CLI's own argv (default 0)
Captured = { kind: "captured", stdout: string, stderr: string, exit: { code: integer } | { signal: string } }

Expected = {
  exitCode: 0 | 1 | 2 | 3 | 4 | 75,
  causeCode?: string,
  commandIdentity?: string,
  outcome?: "success" | "refused" | "failed"
}

Probe = { program: "bun-runtime" | string, args: string[], cwd?: string, env?: {...}, expectedStdout: string }
```

Rules the checker enforces before any target runs. A violation refuses the
whole invocation with `SCHEMA_INVALID_INPUT` and zero target executions:

- Strict objects; unknown keys, missing required keys and wrong types refuse.
- Every `ruleId` exists in the frozen rule list. Groups H and T (section 9)
  are not command-judged and refuse with their owner named.
- A process-layer rule on a `captured` case refuses: captured bytes cannot
  prove a process observation.
- `sameAs` names an earlier case with the same `role`, `mode` and `target`.
- `normalize` pointers sit under `/result/data`. `/result/runId` is always
  normalized. Pointers to effects, guidance, bindings, causes or recovery
  fields refuse (LIFE-14).
- Paths (`program` unless `bun-runtime`, `cwd`, captured files, probe paths)
  are absolute or relative to the admission file's directory. Tracked
  admissions use relative paths only.
- Every budget in section 10 holds for the document itself.

An unreadable admission or captured file is `DOMAIN_PRECONDITION_UNMET`
(section 6), also before any target runs.

Phase 2a additions (16 November 2026, implementer): `argvOffset` and
`selector` are optional and additive; an admission bound to the original note
stays valid. Input rules need `argvOffset` to find the target CLI's argv;
`command-selection` compares with `selector` when given. Adopted from the
binder's review: one pure judgement entry point `judgeObservations(admission,
observations, minors)` returning schema rows with failed rows included (G1);
the G2 prerequisite model; the G15 probe mapping, which also covers input
rules when a probe is admitted (G9); identity ownership (G17); human-mode
criteria (G18); compact `{kind, command, args}` encoding for the `ifNoResult`
size limit (G19). `diagnostics-absent`, the `fallback-version` negative and
`minor-meaning` stay stopped: they report `not_run` with a reason.

Phase 2b (16 November 2026, implementer): `argvOffset` defaults to 1 when
`program` is `bun-runtime` (the first arg is the target script) and to 0
otherwise. The section 10 budgets are bound by the independent binder in
`bindings/BUDGETS.json` and restated in `src/domains/contract3-check/budgets.ts`.
The checker is aligned to the bound cases' attribution and prerequisite model
(`bindings/BINDINGS.md`). The bound cases run through
`tests/contract3/checker/harness/`; the D3 reader specimen is
`specimens/reader-3.1/reader.ts`.

## 4. Target execution protocol

1. **Count fixed in advance.** The number of target executions equals the
   number of admitted `run` cases (plus admitted probes). It is fixed before
   the first execution and never depends on any observed output.
2. **At most once.** Each run case executes at most once per checker
   invocation. No retry after malformed, broken, unsupported, hostile,
   oversize or timed-out output, spawn failure, nonzero exit or signal.
   `sameAs` pairs are two separately admitted executions, not a retry.
3. **Sequential, admission order.** One target process at a time.
4. **No shell.** `program` and `args` pass verbatim as an argument vector. No
   PATH lookup, globbing or expansion. `bun-runtime` means the checker's own
   Bun executable.
5. **No inherited stdin.** Target stdin is the null device. The checker's
   stdin is never forwarded.
6. **No inherited environment.** The target sees only the admitted `env` map.
   The checker's credentials and variables never pass through. Phase 2 must
   prove Bun runs a specimen under this rule on macOS and `ubuntu-latest`; a
   missing precondition fails, never passes silently.
7. **Capture.** stdout and stderr are read separately, each up to its byte
   budget, plus the real exit code or terminating signal. Exceeding a stream
   budget terminates the target and refuses with `SCHEMA_INVALID_INPUT`.
8. **Time.** Each run has a wall-time budget. On expiry the checker sends
   SIGTERM, then SIGKILL after the grace budget (LIFE-11). That case's rows
   report `timed_out`; its effects are unknown and never retried.
9. **Stop after refusal.** Once an observation refuses the invocation, the
   checker starts no further target run.
10. **Own signals.** On SIGINT or SIGTERM the checker terminates the running
    target as in LIFE-11 within 500 ms and exits 130 or 143 with no envelope.
11. **No retention.** Raw streams are never written anywhere. Rows keep only
    digests and counts (section 7).
12. **Probe (D2).** A probe runs once, after its case, under rules 2 to 8.

Captured cases execute nothing. The checker reads each file once, under the
same byte budgets.

## 5. Judgement model

Two layers with one invariant.

- **Domain judgement** (pure, in-process): admission plus observations plus the
  supported-minor table in, the full row set out, including `failed` rows with
  their findings. Version classification of each machine observation comes
  first (VER-10 order: malformed, other major, newer minor, broken, accepted);
  no other key of a refused version is interpreted.
- **Command outcome**: maps the judgement to one envelope.

Invariant: exit 0 if and only if no admitted row is `failed` and no
observation is refused. A broken, wrong or unsupported target never produces a
success result. Unproved rows (`not_run`, `skipped`, `timed_out`, `missing`,
`declared_unreachable`) may appear in a success report with their reasons.

Consequence for proof layers:

- Process layer: a single-rule negative shows exit 4, its cause, `data: null`,
  the violated key or correlation in `message`, and an unchanged counter. Its
  restored valid twin shows exit 0 with every admitted row `passed`.
  Disabling the rule makes the negative exit 0, so the sensitivity test fails.
- Component layer: the exact finding code and "unrelated evaluable rows stay
  passed" are asserted on the domain judgement, as the `broken-supported`
  format case's internal test expectation describes. This is component
  evidence and never substitutes for a required process row.

Refusal report transport stays intentionally unbound: no row report, finding
code field, sidecar file or stderr format accompanies a refusal.

## 6. Checker outcomes

All rows: effect class `inspect`, state `unchanged`. Words are proposals for
the binder; each tuple keeps one set of words.

| Station (outcome, cause)               | Class, exit | When                                                                                                                                                                               | Guidance                                                                                                                |
| -------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| success, `SUCCESS_UNCHANGED`           | null, 0     | Every observation accepted; no admitted row failed                                                                                                                                 | next: instruction "Read data.rows; any row other than passed is unproved."                                              |
| refused, `USAGE_INVALID_INVOCATION`    | usage, 2    | Section 2 violations                                                                                                                                                               | next: "Run example --help and correct the invocation."                                                                  |
| refused, `DOMAIN_PRECONDITION_UNMET`   | domain, 3   | Admission or captured file missing or unreadable                                                                                                                                   | next: "Make the named file readable, then run the check again."                                                         |
| refused, `SCHEMA_INVALID_INPUT`        | schema, 4   | Admission invalid; or a target observation malformed (VER-1, including missing version and `3.0.1`), broken at an accepted minor, failing any admitted rule, or exceeding a budget | next: "Correct the input shape named in message. Inspect target effects separately; the checker never reruns a target." |
| refused, `SCHEMA_UNSUPPORTED_CONTRACT` | schema, 4   | Well-formed other major, or a newer minor than the reader                                                                                                                          | next: "Use a reader that accepts the version named in message. No adaptation."                                          |
| failed, `INTERNAL_RESULT_UNCHANGED`    | internal, 1 | The checker's own result could not be produced                                                                                                                                     | The host's existing internal handoff.                                                                                   |

The cause of a refused invocation comes from the first refused observation in
admission order. Admission and precondition refusals precede every target run.

`message` content, bounded and redacted (VER-11):

- Malformed: the case id, `contractVersion` as the violated key, and the safe
  observed value rendered as JSON, or `null` when absent.
- Other major: the case id and the exact observed string; "use a reader
  built for major N; nothing was adapted". For `2.0.0` it names the kept
  checker by its route in [retained-2.json](../retained-2.json): the dotfiles
  wrapper `config/agents/plugins/my-second-brain-playground/bin/cli-design-check`
  at commit `29bf4bb0f307f96d396aa087472a4dbed849c920`, which runs the
  packaged `runtime/cli-design-check.js`. The checker never invokes it.
- Newer minor: the observed string and the reader's own version; "upgrade the
  reader".
- Broken or failing rule: the case id, observed version, and each violated
  key or correlation, up to the message budget.
- Any refusal after a target executed: that the target already ran, that its
  effects need separate inspection, and that the checker's `unchanged` says
  nothing about the target.

Classification before shape: `2.0.0` with keys invalid under 3.0 is an
unsupported major, never broken. An unknown target cause is handled by its
outcome and failure class (VER-7, WIRE-20); no closed cross-CLI cause list.

## 7. Report data (success only)

`data` validates against [checker-report.schema.json](../checker-report.schema.json),
`reportVersion: 1`.

- Rows: exactly the admitted pairs, ordered by case in admission order, then
  by rule in that case's `rules` order. Identity is (`ruleId`, `caseId`).
- `passed` carries `evidence` at the rule's proof layer; never findings.
- `failed` rows never reach `data` (section 5).
- Unproved statuses carry a nonempty `reason`; findings stay empty.
- Group R rows never report `passed` from shape alone (section 9).
- Evidence entries are portable tokens, never paths or raw bytes, for example
  `case:<caseId>:run-once`, `case:<caseId>:captured`,
  `case:<caseId>:stdout-sha256:<hex>`, `case:<caseId>:stderr-bytes:<n>`,
  `case:<caseId>:exit:<n>`, `case:<caseId>:signal:<name>`.

## 8. Help

Host `--help` lists the command with this summary: "Judge a Contract 3 CLI's
output against an admitted case set without rerunning it."
Proposed full help text, which must match the final admitted interface before
release (its route is a D1 consequence):

```text
Usage: example contract3 check --admission PATH [--json]

Reads PATH, a JSON admission naming cases, rules and independent expected
values. Runs each admitted target once, in order, with no shell, no inherited
stdin and no inherited environment, or reads captured stdout, stderr and exit.
Never reruns a target. Accepts contract 3.0.0 output only.

Exit 0: every observation accepted and no admitted row failed; data holds the
row report. Unproved rows carry reasons.
Exit 2: invalid invocation. Exit 3: admission or captured file unreadable.
Exit 4: invalid admission, or target output malformed, broken, failing an
admitted rule, over budget, or of an unsupported version. data is null.
For contract 2.0.0 output use the kept 2.0 checker named in the refusal.
Does not judge instruction meaning, secrecy, authority, recovery truth,
diagnostics custody or values that cannot cross JSON.
```

## 9. Rule ownership

All 93 rules, grouped by who judges them.

| Group | Judge                                                                            | Rules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V, 3  | Command, version classification                                                  | `version-malformed`, `version-major`, `version-newer`                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| E, 26 | Command, each envelope alone                                                     | `declared-minor-shape`, `version-copy`, `json-framing`, `strict-keys`, `presence`, `result-correlation`, `effect-inventory`, `guidance-arm`, `retry-kind`, `done-outcome`, `metadata-values`, `json-values`, `effects-sets`, `effects-state`, `attempted-effect`, `failure-data`, `handoff-shape`, `closed-union`, `fallback-version`, `diagnostics-available`, `diagnostics-unavailable`, `template-token`, `binding-keys`, `binding-value`, `binding-placement`, `available-order`              |
| D, 10 | Command, declarations in discovery and command discovery                         | `station-duplicate`, `retry-policy`, `discovery-metadata`, `root-routes`, `lost-result-missing`, `lost-result-target`, `lost-result-inspect`, `lost-result-literals`, `input-schema`, `pattern-syntax`                                                                                                                                                                                                                                                                                            |
| X, 8  | Command, across observations of one admission                                    | `step-target`, `inspection-target`, `guidance-template`, `available-target`, `station-fixed`, `binding-route`, `retry-delay`, `step-arguments`                                                                                                                                                                                                                                                                                                                                                    |
| P, 28 | Command, run cases with independent `expect`                                     | `machine-stderr`, `exit-expected`, `cause-expected`, `exit-envelope`, `builtins`, `station-observed`, `station-required`, `input-case`, `human-discovery`, `help-discovery`, `command-selection`, `dispatch`, `global-mode`, `token-argv`, `deterministic-fields`, `diagnostics-absent`, `pattern-budget`, `open-cause`, `input-required`, `input-option`, `input-presence`, `input-repeat`, `input-string`, `input-integer`, `input-constraints`, `input-hidden`, `input-dash`, `input-deadline` |
| F, 5  | Command with an effect probe (D2), else `not_run`                                | `navigation-effects`, `provider-loading`, `input-future-binding`, `input-generated-binding`, `input-runtime`                                                                                                                                                                                                                                                                                                                                                                                      |
| R, 2  | Command fails detectable cases; otherwise `not_run`, independent review required | `unreachable-review` (a declared-unreachable station observed in any case fails), `minor-meaning`                                                                                                                                                                                                                                                                                                                                                                                                 |
| H, 4  | Test harness, about the checker process itself                                   | `no-replay` (independent counter), `pattern-isolation` (terminable boundary, reader stays responsive), `observer-exclusions` (every admitted pair present, unproved with reason), `raw-retention` (no stream files written)                                                                                                                                                                                                                                                                       |
| T, 7  | Repository static tests                                                          | `minor-remove`, `minor-rename`, `minor-required`, `minor-cause` (fixture minor table), `source-agreement`, `snippet-status`, `retained-tooling` (checker's kept-route constant against [retained-2.json](../retained-2.json))                                                                                                                                                                                                                                                                     |

Cross-observation rules (X, and D rules that need a command's stations)
resolve against the `discovery` and `command-discovery` cases of the same
admission. If a needed case is not admitted, the row is `not_run` with that
reason. Expected exits and causes for `exit-expected` and `cause-expected`
come only from `expect`, never from the target's catalogue.

## 10. Budgets (named open values)

Each needs an independently bound number before its production check
(futureBindings, T6 with T1). Exceeding any target-facing budget refuses with
`SCHEMA_INVALID_INPUT` unless noted.

| Name                            | Bounds                                                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `ADMISSION_MAX_BYTES`           | Admission document size                                                                                                          |
| `ADMISSION_MAX_CASES`           | Cases per admission                                                                                                              |
| `TARGET_STDOUT_MAX_BYTES`       | Captured stdout per case                                                                                                         |
| `TARGET_STDERR_MAX_BYTES`       | Captured stderr per case (only emptiness, length and digest are used)                                                            |
| `TARGET_JSON_MAX_DEPTH`         | Nesting accepted when reading target output, counted per B2 (envelope is level 0, every value counts)                            |
| `TARGET_RUN_MAX_MS`             | Wall time per run; expiry gives `timed_out`, not a refusal                                                                       |
| `TARGET_KILL_GRACE_MS`          | SIGTERM to SIGKILL grace on timeout                                                                                              |
| `PATTERN_MAX_SOURCE_BYTES`      | Size of an untrusted target pattern                                                                                              |
| `PATTERN_MAX_SUBJECT_BYTES`     | Input matched against it                                                                                                         |
| `PATTERN_MAX_MS`                | Match time inside a terminable boundary (separate process or terminable worker; Phase 2 proves termination on both CI platforms) |
| `MESSAGE_MAX_BYTES`             | The checker's `message`                                                                                                          |
| `FINDING_MESSAGE_MAX_BYTES`     | Each finding message (domain layer)                                                                                              |
| `OBSERVED_VALUE_ECHO_MAX_CHARS` | Observed version echo; control and format characters escaped                                                                     |

## 11. What the checker will not judge

From `supportBoundaries` and the exclusions. These stay disclosed, never
reported `passed`:

- STEP-16 instruction meaning, nonsecret bindings and read-only inspection:
  originating command or host reviewer.
- GATE-2, LIFE-7, V-4, V-18 writer guards for cycles, `undefined`,
  functions, bigint, Date, nonfinite values, depth limits, fallback and
  transport: T1 and T2 runtime evidence. The checker sees only malformed
  streams, envelope rules and real exits.
- DISC-14, DISC-14a, V-19 lost-result truth and honest corrupt-state refusal:
  T3 and T8. The checker resolves routes and syntax only.
- DIAG-4, DIAG-7 to DIAG-11, DIAG-14, V-24 diagnostics custody, caps and
  retention: T5 and T8. Shape checking certifies no custody.
- Whether a target's effects happened, except through an admitted probe (D2).
  The checker's `unchanged` is about the checker only.
- Host authority, reclaim, takeover, OS or filesystem qualification, live
  providers, and Contract 2.0 output (refused, never adapted).

## 12. Disposable specimens in tests

- Specimen targets are small programs under
  `tests/contract3/checker/specimens/`, run by Bun through a `run` case. They
  print fixed bytes, exit with fixed codes and, for no-replay cases, increment
  a counter file whose path arrives through the admitted `env`.
- Tests write admissions into a fresh temporary directory, run the real CLI
  (`bun run src/cli.ts contract3 check --admission <file> --json`), capture
  its stdout, stderr and exit, then read the counter separately.
- Specimens are never registered in `src/commands.ts` and are unreachable
  through the application CLI. No production command exists for testing.
- Expected values come from the frozen oracles and the binder, never from
  checker or production output.
- The D3 reader specimen is the one specimen that wraps checker code; it
  exists only for the fixture-only minor.

## 13. Not invented here

No contract wire field, envelope key, common cause, station identifier on the
wire, refusal report transport, sidecar, stderr format, raw-stream retention,
new dependency, fake production command or command-owned cause. Binding the
concrete cases, specimens, counts and budget numbers belongs to the
independent author.
