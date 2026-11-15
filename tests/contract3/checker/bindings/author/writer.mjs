// fallow-ignore-file unused-file -- binder authoring source; run by hand to regenerate bindings, never imported by product or test code
// fallow-ignore-file boundary-violation -- binder authoring source outside every boundary zone by design
//
// Writes each binding as an admission, its target bytes and its expected
// file. Expected values come from the binding specification only.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GROUP_OF, PROBE, RULES, SHARED, TARGET } from "./framework.mjs";

const STATUSES = [
  "passed",
  "failed",
  "not_run",
  "skipped",
  "timed_out",
  "missing",
  "declared_unreachable",
];

const VERSION_REFUSALS = new Set(["version-major", "version-newer"]);

function caseFiles(dir, spec, c) {
  const files = {};
  if (c.target.shared !== undefined) {
    return {
      admissionTarget: {
        kind: "captured",
        stdout: `../../shared/${c.target.shared}.stdout`,
        stderr: "../../shared/empty.stderr",
        exit: { code: 0 },
      },
      files,
    };
  }
  if (c.target.captured !== undefined) {
    const cap = c.target.captured;
    files[`${c.name}.stdout`] = cap.stdout;
    files[`${c.name}.stderr`] = cap.stderr ?? "";
    return {
      admissionTarget: {
        kind: "captured",
        stdout: `${c.name}.stdout`,
        stderr: `${c.name}.stderr`,
        exit: { code: cap.exit ?? 0 },
      },
      files,
    };
  }
  const run = c.target.run;
  const base = run.tableName ?? c.name;
  const responses = run.responses.map((response, index) => {
    const out = {};
    for (const stream of ["stdout", "stderr"]) {
      const source = response[stream] ?? null;
      if (source === null || source === "") {
        out[stream] = null;
      } else if (typeof source === "object" && source.repeat !== undefined) {
        out[stream] = source;
      } else {
        const file = `${base}.${index}.${stream}`;
        files[file] = source;
        out[stream] = file;
      }
    }
    out.exit = response.exit;
    if (response.state !== undefined) out.state = response.state;
    if (response.hang === true) out.hang = true;
    return out;
  });
  const table = { argv: run.argv, responses };
  if (run.state !== undefined) table.state = run.state;
  files[`${base}.table.json`] = `${JSON.stringify(table, null, 2)}\n`;
  const env = { SPECIMEN_TABLE: `${base}.table.json`, ...(run.env ?? {}) };
  if (run.counter !== undefined) env.SPECIMEN_COUNTER = run.counter;
  return {
    admissionTarget: {
      kind: "run",
      program: "bun-runtime",
      args: [TARGET, ...run.argv],
      cwd: ".",
      env,
    },
    files,
  };
}

function rowsOf(spec) {
  return spec.cases.map((c) => {
    const row = {
      caseId: `${spec.id}/${c.name}`,
      passed: [],
      failed: {},
      notRun: {},
      timedOut: {},
    };
    for (const rule of c.rules) {
      const status = c.status?.[rule] ?? "passed";
      if (status === "passed") row.passed.push(rule);
      else if (status.failed !== undefined) row.failed[rule] = status.failed;
      else if (status.not_run !== undefined) row.notRun[rule] = status.not_run;
      else if (status.timed_out !== undefined) {
        row.timedOut[rule] = status.timed_out;
      } else throw new Error(`bad status ${spec.id} ${rule}`);
    }
    return row;
  });
}

function countsOf(rows) {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const row of rows) {
    counts.passed += row.passed.length;
    counts.failed += Object.keys(row.failed).length;
    counts.not_run += Object.keys(row.notRun).length;
    counts.timed_out += Object.keys(row.timedOut).length;
  }
  counts.total = STATUSES.reduce((sum, s) => sum + counts[s], 0);
  return counts;
}

function checkerOf(spec, rows) {
  const refusal = (cause, messageIncludes) => ({
    exitCode: 4,
    outcome: "refused",
    causeCode: cause,
    failureClass: "schema",
    effectClass: "inspect",
    transactionState: "unchanged",
    data: null,
    stderr: "",
    messageIncludes,
    ...(spec.messageExcludes === undefined
      ? {}
      : { messageExcludes: spec.messageExcludes }),
  });
  if (spec.admissionRefusal !== undefined) {
    return refusal("SCHEMA_INVALID_INPUT", spec.admissionRefusal);
  }
  const failedRules = rows.flatMap((row) => Object.keys(row.failed));
  if (failedRules.length > 0) {
    const subject = spec.cases.at(-1);
    const cause =
      spec.cause ??
      (failedRules.some((rule) => VERSION_REFUSALS.has(rule))
        ? "SCHEMA_UNSUPPORTED_CONTRACT"
        : "SCHEMA_INVALID_INPUT");
    return refusal(cause, [
      `${spec.id}/${subject.name}`,
      ...(spec.message ?? []),
    ]);
  }
  if (spec.cause !== undefined) {
    const subject = spec.cases.at(-1);
    return refusal(spec.cause, [
      `${spec.id}/${subject.name}`,
      ...(spec.message ?? []),
    ]);
  }
  return {
    exitCode: 0,
    outcome: "success",
    causeCode: "SUCCESS_UNCHANGED",
    failureClass: null,
    effectClass: "inspect",
    transactionState: "unchanged",
    data: "report",
    stderr: "",
    messageIncludes: spec.message ?? [],
  };
}

function validateSpec(spec) {
  const names = new Set();
  for (const c of spec.cases) {
    if (names.has(c.name)) throw new Error(`${spec.id}: duplicate ${c.name}`);
    names.add(c.name);
    if (c.rules.length === 0) throw new Error(`${spec.id}/${c.name}: no rules`);
    if (new Set(c.rules).size !== c.rules.length) {
      throw new Error(`${spec.id}/${c.name}: duplicate rule`);
    }
    for (const rule of c.rules) {
      if (RULES[rule] === undefined) throw new Error(`unknown rule ${rule}`);
      if (["H", "T"].includes(GROUP_OF[rule])) {
        throw new Error(`${spec.id}: ${rule} is not command-judged`);
      }
    }
    for (const rule of Object.keys(c.status ?? {})) {
      if (!c.rules.includes(rule)) {
        throw new Error(`${spec.id}/${c.name}: status for unadmitted ${rule}`);
      }
    }
  }
}

export function writeBinding(root, spec) {
  const dir = join(root, "cases", spec.id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const files = {};
  const admissionCases = [];
  const executions = [];
  if (spec.cases.length > 0) validateSpec(spec);
  for (const c of spec.cases) {
    const { admissionTarget, files: own } = caseFiles(dir, spec, c);
    Object.assign(files, own);
    const entry = {
      caseId: `${spec.id}/${c.name}`,
      rules: c.rules,
      role: c.role,
      mode: c.mode ?? "machine",
      target: admissionTarget,
    };
    if (c.expect !== undefined) entry.expect = c.expect;
    if (c.sameAs !== undefined) entry.sameAs = `${spec.id}/${c.sameAs}`;
    if (c.normalize !== undefined) entry.normalize = c.normalize;
    if (c.probe !== undefined) {
      entry.probe = {
        program: "bun-runtime",
        args: [PROBE],
        cwd: ".",
        env: { SPECIMEN_STATE: c.probe.state },
        expectedStdout: c.probe.expectedStdout,
      };
    }
    admissionCases.push(entry);
    if (admissionTarget.kind === "run") executions.push(`${entry.caseId}:run`);
    if (c.probe !== undefined) executions.push(`${entry.caseId}:probe`);
  }
  const rows = spec.cases.length > 0 ? rowsOf(spec) : [];
  const admitted = spec.cases.length > 0;
  if (admitted) {
    const admission = {
      admissionVersion: 1,
      cli: "specimen",
      cases: admissionCases,
    };
    files["admission.json"] = `${JSON.stringify(admission, null, 2)}\n`;
  }
  const refusedBeforeRuns = spec.admissionRefusal !== undefined;
  const noRows = refusedBeforeRuns || spec.rowsUnbound !== undefined;
  const expected = {
    bindingVersion: 1,
    id: spec.id,
    rule: spec.rule,
    group: GROUP_OF[spec.rule] ?? null,
    kind: spec.kind,
    oracle: spec.oracle,
    verification: spec.verification ?? RULES[spec.rule]?.verification ?? [],
    reader: spec.reader ?? (admitted ? "production-3.0.0" : null),
    provisional: spec.provisional ?? [],
    admission: admitted ? "admission.json" : null,
    targetExecutions: refusedBeforeRuns ? [] : executions,
    checker: admitted ? checkerOf(spec, rows) : null,
    rows: noRows ? null : rows,
    rowsUnbound: spec.rowsUnbound ?? null,
    counts: noRows || !admitted ? null : countsOf(rows),
    excluded: spec.excluded ?? {},
    harness: spec.harness ?? null,
    static: spec.static ?? null,
    notes: spec.notes ?? null,
  };
  files["expected.json"] = `${JSON.stringify(expected, null, 2)}\n`;
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }
  for (const [name, value] of Object.entries(spec.extraFiles ?? {})) {
    writeFileSync(join(dir, name), value);
  }
}

export function writeShared(root) {
  const dir = join(root, "shared");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "empty.stderr"), "");
  for (const [name, bytes] of Object.entries(SHARED)) {
    writeFileSync(join(dir, `${name}.stdout`), bytes);
  }
}
