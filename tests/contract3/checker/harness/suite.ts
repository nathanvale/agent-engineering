// Phase 2b harness for the independently bound cases (BINDINGS.md, binder
// handoff "What the harness must do"). It never edits a binding. Expected
// values come only from bindings/cases/<id>/expected.json; the checker's
// own output is the thing being judged, never a source of expectations.

import {
  cp,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import * as admissionModule from "../../../../src/domains/contract3-check/admission.ts";
import * as budgetsModule from "../../../../src/domains/contract3-check/budgets.ts";
import * as judgeModule from "../../../../src/domains/contract3-check/judge.ts";
import type { MinorTable } from "../../../../src/domains/contract3-check/minors.ts";
import { PRODUCTION_MINORS } from "../../../../src/domains/contract3-check/minors.ts";
import * as runnerModule from "../../../../src/domains/contract3-check/runner.ts";
import type {
  AdmittedCase,
  Observation,
} from "../../../../src/domains/contract3-check/types.ts";
import { FIXTURE_MINORS } from "../specimens/reader-3.1/reader.ts";

export const REPO_ROOT = resolve(import.meta.dir, "../../../..");
export const CHECKER_DIR = resolve(import.meta.dir, "..");
const BINDINGS_DIR = join(CHECKER_DIR, "bindings");
const READER = join(CHECKER_DIR, "specimens/reader-3.1/reader.ts");

export interface ManifestBinding {
  id: string;
  rule: string;
  group: string;
  kind: string;
  reader: "production-3.0.0" | "test-minor-3.1.0" | null;
  provisional: string[];
  caseIds: string[];
  files: Record<string, string>;
  shared: string[];
  specimens: string[];
}

export interface Manifest {
  totals: {
    bindings: number;
    admitted: number;
    static: number;
    stopped: number;
  };
  shared: Record<string, string>;
  specimens: Record<string, string>;
  procedures: { appliesTo: string[] }[];
  bindings: ManifestBinding[];
}

export interface ExpectedRow {
  caseId: string;
  passed: string[];
  failed: Record<string, string>;
  notRun: Record<string, string>;
  timedOut: Record<string, string>;
}

export interface ExpectedChecker {
  exitCode: number;
  outcome: string;
  causeCode: string;
  failureClass: string | null;
  effectClass: string;
  transactionState: string;
  data: "report" | null;
  stderr: string;
  messageIncludes: string[];
  messageExcludes?: string[];
}

export interface Expected {
  id: string;
  rule: string;
  kind: string;
  reader: ManifestBinding["reader"];
  provisional: string[];
  targetExecutions: string[];
  checker: ExpectedChecker | null;
  rows: ExpectedRow[] | null;
  rowsUnbound: string | null;
  counts: Record<string, number>;
  harness: Record<string, unknown> | null;
  static: Record<string, unknown> | null;
  notes: string | null;
}

export interface ReportRowLike {
  ruleId: string;
  caseId: string;
  status: string;
  findings: { code: string; message: string }[];
  evidence: string[];
  reason: string | null;
}

export async function loadManifest(): Promise<Manifest> {
  return JSON.parse(
    await readFile(join(BINDINGS_DIR, "MANIFEST.json"), "utf8"),
  ) as Manifest;
}

export async function loadExpected(
  root: string,
  id: string,
): Promise<Expected> {
  return JSON.parse(
    await readFile(join(root, "bindings/cases", id, "expected.json"), "utf8"),
  ) as Expected;
}

async function sha256(path: string): Promise<string> {
  const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
  return new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
}

/** Point 1: manifest identity and every SHA-256, before any run. */
export async function verifyManifest(manifest: Manifest): Promise<string[]> {
  const problems: string[] = [];
  const ids = manifest.bindings.map((binding) => binding.id);
  if (new Set(ids).size !== ids.length)
    problems.push("MANIFEST.json repeats a binding id.");
  if (ids.length !== manifest.totals.bindings)
    problems.push(
      `MANIFEST.json lists ${ids.length} bindings, totals say ${manifest.totals.bindings}.`,
    );
  const directories = (await readdir(join(BINDINGS_DIR, "cases"))).sort();
  const expectedDirs = [...ids].sort();
  if (JSON.stringify(directories) !== JSON.stringify(expectedDirs))
    problems.push(
      "The case directories differ from the manifest's binding ids.",
    );
  for (const binding of manifest.bindings) {
    const caseDir = join(BINDINGS_DIR, "cases", binding.id);
    const present = (await readdir(caseDir)).sort();
    if (
      JSON.stringify(present) !==
      JSON.stringify(Object.keys(binding.files).sort())
    )
      problems.push(`${binding.id}: files differ from the manifest.`);
    for (const [name, digest] of Object.entries(binding.files))
      if ((await sha256(join(caseDir, name))) !== digest)
        problems.push(`${binding.id}/${name}: SHA-256 mismatch.`);
  }
  for (const [path, digest] of Object.entries(manifest.shared))
    if ((await sha256(join(BINDINGS_DIR, path))) !== digest)
      problems.push(`${path}: SHA-256 mismatch.`);
  for (const [path, digest] of Object.entries(manifest.specimens))
    if ((await sha256(join(CHECKER_DIR, path))) !== digest)
      problems.push(`${path}: SHA-256 mismatch.`);
  return problems;
}

/** Point 2: bindings/ and specimens/ together, same layout, fresh directory. */
export async function freshCopy(): Promise<{
  root: string;
  dispose(): Promise<void>;
}> {
  const root = await mkdtemp(join(tmpdir(), "c3-bindings-"));
  await cp(BINDINGS_DIR, join(root, "bindings"), { recursive: true });
  await cp(join(CHECKER_DIR, "specimens"), join(root, "specimens"), {
    recursive: true,
  });
  return { root, dispose: () => rm(root, { recursive: true, force: true }) };
}

export function admissionPath(root: string, id: string): string {
  return join(root, "bindings/cases", id, "admission.json");
}

export function minorsFor(reader: Expected["reader"]): MinorTable {
  return reader === "test-minor-3.1.0" ? FIXTURE_MINORS : PRODUCTION_MINORS;
}

/** The checker modules the component layer drives: the repository's, or a perturbed copy's. */
export interface CheckerModules {
  admission: typeof admissionModule;
  budgets: typeof budgetsModule;
  judge: typeof judgeModule;
  runner: typeof runnerModule;
}

const REPOSITORY_MODULES: CheckerModules = {
  admission: admissionModule,
  budgets: budgetsModule,
  judge: judgeModule,
  runner: runnerModule,
};

async function observe(
  modules: CheckerModules,
  item: AdmittedCase,
): Promise<Observation> {
  const { readCaptured, runProgram } = modules.runner;
  const { BUDGETS } = modules.budgets;
  const target = item.target;
  if (target.kind === "captured") {
    const [stdout, stderr] = await Promise.all([
      readCaptured(target.stdoutPath, BUDGETS.TARGET_STDOUT_MAX_BYTES),
      readCaptured(target.stderrPath, BUDGETS.TARGET_STDERR_MAX_BYTES),
    ]);
    return {
      caseId: item.caseId,
      source: "captured",
      started: true,
      stdout,
      stderr,
      exit: target.exit,
      timedOut: false,
    };
  }
  const observation: Observation = {
    caseId: item.caseId,
    source: "run",
    ...(await runProgram(target)),
  };
  if (item.probe !== undefined && observation.started)
    observation.probe = await runProgram(item.probe);
  return observation;
}

/** Component layer input: the same admission observed in its own copy, then the pure judgement (G1). */
export async function componentRows(
  root: string,
  id: string,
  minors: MinorTable,
  modules: CheckerModules = REPOSITORY_MODULES,
): Promise<{ rows: ReportRowLike[]; refused: boolean } | { problem: string }> {
  const load = await modules.admission.loadAdmission(admissionPath(root, id));
  if (load.kind !== "ok")
    return { problem: `admission did not load: ${load.kind}` };
  const observations = new Map<string, Observation>();
  for (const item of load.admission.cases) {
    const observation = await observe(modules, item);
    observations.set(item.caseId, observation);
    if (modules.judge.refusesAlone(load.admission, item, observation, minors))
      break;
  }
  const judgement = await modules.judge.judgeObservations(
    load.admission,
    observations,
    minors,
  );
  return { rows: judgement.rows, refused: judgement.refusal !== null };
}

/**
 * A perturbed checker: a temporary copy of src/ with one exact text patch.
 * The repository's checker is never changed; no production seam exists.
 */
export async function perturbedChecker(
  file: string,
  find: string,
  replace: string,
): Promise<{
  cli: string;
  modules(): Promise<CheckerModules>;
  dispose(): Promise<void>;
}> {
  const root = await mkdtemp(join(tmpdir(), "c3-perturbed-"));
  await cp(join(REPO_ROOT, "src"), join(root, "src"), { recursive: true });
  const target = join(root, "src/domains/contract3-check", file);
  const text = await readFile(target, "utf8");
  if (text.split(find).length !== 2)
    throw new Error(`perturbation anchor not unique in ${file}`);
  await writeFile(
    target,
    text.replace(find, () => replace),
  );
  const domain = join(root, "src/domains/contract3-check");
  return {
    cli: join(root, "src/cli.ts"),
    modules: async () => ({
      admission: (await import(
        join(domain, "admission.ts")
      )) as typeof admissionModule,
      budgets: (await import(
        join(domain, "budgets.ts")
      )) as typeof budgetsModule,
      judge: (await import(join(domain, "judge.ts"))) as typeof judgeModule,
      runner: (await import(join(domain, "runner.ts"))) as typeof runnerModule,
    }),
    dispose: () => rm(root, { recursive: true, force: true }),
  };
}

/** Disable one rule alone: its findings are dropped where every finding is recorded. */
export function disableRulePatch(ruleId: string): [string, string, string] {
  return [
    "collector.ts",
    "  fail(ruleId: string, message: string): void {\n",
    `  fail(ruleId: string, message: string): void {\n    if (ruleId === ${JSON.stringify(ruleId)}) return;\n`,
  ];
}

function expectedPairs(rows: ExpectedRow[]): string[] {
  return rows.flatMap((row) =>
    [
      ...row.passed,
      ...Object.keys(row.failed),
      ...Object.keys(row.notRun),
      ...Object.keys(row.timedOut),
    ].map((rule) => `${row.caseId}\u0000${rule}`),
  );
}

/** Point 3 then 5: identity set first, then statuses, codes, reasons, counts. */
export function rowProblems(
  expected: Expected,
  actual: ReportRowLike[],
): string[] {
  if (expected.rows === null) return [];
  const want = expectedPairs(expected.rows).sort();
  const got = actual.map((row) => `${row.caseId}\u0000${row.ruleId}`);
  if (got.length === 0) return ["the report holds no rows"];
  if (new Set(got).size !== got.length)
    return ["the report repeats a (ruleId, caseId) pair"];
  if (JSON.stringify([...got].sort()) !== JSON.stringify(want)) {
    const missing = want
      .filter((pair) => !got.includes(pair))
      .map((pair) => pair.replace("\u0000", " "));
    const extra = got
      .filter((pair) => !want.includes(pair))
      .map((pair) => pair.replace("\u0000", " "));
    return [
      `identity set differs; missing ${JSON.stringify(missing)} unexpected ${JSON.stringify(extra)}`,
    ];
  }
  const byPair = new Map(
    actual.map((row) => [`${row.caseId}\u0000${row.ruleId}`, row]),
  );
  const problems: string[] = [];
  for (const row of expected.rows) {
    const at = (rule: string) => byPair.get(`${row.caseId}\u0000${rule}`);
    for (const rule of row.passed) {
      const got = at(rule);
      if (
        got?.status !== "passed" ||
        got.findings.length > 0 ||
        got.evidence.length === 0
      )
        problems.push(
          `${row.caseId} ${rule}: expected passed, got ${got?.status ?? "absent"}${got?.reason ? ` (${got.reason})` : ""}${got?.findings[0] ? ` [${got.findings[0].message}]` : ""}`,
        );
    }
    for (const [rule, code] of Object.entries(row.failed)) {
      const got = at(rule);
      if (
        got?.status !== "failed" ||
        !got.findings.some((finding) => finding.code === code)
      )
        problems.push(
          `${row.caseId} ${rule}: expected failed ${code}, got ${got?.status ?? "absent"}${got?.reason ? ` (${got.reason})` : ""}`,
        );
    }
    for (const [status, map] of [
      ["not_run", row.notRun],
      ["timed_out", row.timedOut],
    ] as const)
      for (const rule of Object.keys(map)) {
        const got = at(rule);
        if (got?.status !== status || (got.reason ?? "").length === 0)
          problems.push(
            `${row.caseId} ${rule}: expected ${status}, got ${got?.status ?? "absent"}${got?.findings[0] ? ` [${got.findings[0].message}]` : ""}`,
          );
      }
  }
  const tally: Record<string, number> = {};
  for (const row of actual) tally[row.status] = (tally[row.status] ?? 0) + 1;
  for (const [status, count] of Object.entries(expected.counts))
    if (status !== "total" && (tally[status] ?? 0) !== count)
      problems.push(
        `count ${status}: expected ${count}, got ${tally[status] ?? 0}`,
      );
  return problems;
}

export interface ProcessRun {
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  elapsedMs: number;
}

/** The real application CLI, or the D3 reader for test-minor bindings. */
export function checkerCommand(
  reader: Expected["reader"],
  admission: string,
  script = join(REPO_ROOT, "src/cli.ts"),
): string[] {
  const entry = reader === "test-minor-3.1.0" ? READER : script;
  return [
    process.execPath,
    "run",
    entry,
    "contract3",
    "check",
    "--admission",
    admission,
    "--json",
  ];
}

export async function runChecker(
  command: string[],
  onSpawn?: (child: ReturnType<typeof Bun.spawn>) => void,
): Promise<ProcessRun> {
  const started = performance.now();
  const child = Bun.spawn({
    cmd: command,
    cwd: REPO_ROOT,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: { PATH: process.env.PATH ?? "" },
  });
  onSpawn?.(child);
  const [stdout, stderr] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  await child.exited;
  return {
    exitCode: child.exitCode,
    signal: child.signalCode,
    stdout,
    stderr,
    elapsedMs: performance.now() - started,
  };
}

/** Point 4, process layer: major-independent fields only (D1). */
export function processProblems(
  expected: ExpectedChecker,
  run: ProcessRun,
): { problems: string[]; rows: ReportRowLike[] | null } {
  const problems: string[] = [];
  if (run.exitCode !== expected.exitCode)
    problems.push(
      `exit ${String(run.exitCode)} (signal ${String(run.signal)}), expected ${expected.exitCode}`,
    );
  if (run.stderr !== expected.stderr)
    problems.push(`checker stderr ${JSON.stringify(run.stderr.slice(0, 200))}`);
  let envelope: { message?: unknown; result?: Record<string, unknown> };
  try {
    envelope = JSON.parse(run.stdout) as typeof envelope;
  } catch {
    return {
      problems: [...problems, "checker stdout is not one JSON envelope"],
      rows: null,
    };
  }
  const result = envelope.result ?? {};
  for (const key of [
    "outcome",
    "causeCode",
    "failureClass",
    "effectClass",
    "transactionState",
  ] as const)
    if (result[key] !== expected[key])
      problems.push(
        `${key} ${JSON.stringify(result[key])}, expected ${JSON.stringify(expected[key])}`,
      );
  const message = typeof envelope.message === "string" ? envelope.message : "";
  for (const part of expected.messageIncludes)
    if (!message.includes(part))
      problems.push(
        `message lacks ${JSON.stringify(part)}: ${message.slice(0, 300)}`,
      );
  for (const part of expected.messageExcludes ?? [])
    if (message.includes(part))
      problems.push(`message contains excluded ${JSON.stringify(part)}`);
  const data = result.data as
    | { reportVersion?: unknown; rows?: ReportRowLike[] }
    | null
    | undefined;
  if (expected.data === null) {
    if (data !== null) problems.push("data is not null");
    return { problems, rows: null };
  }
  if (
    data === null ||
    data === undefined ||
    data.reportVersion !== 1 ||
    !Array.isArray(data.rows)
  ) {
    problems.push("data is not a reportVersion 1 report");
    return { problems, rows: null };
  }
  return { problems, rows: data.rows };
}
