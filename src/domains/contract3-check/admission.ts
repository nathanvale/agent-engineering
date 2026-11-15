// The admission document (INTERFACE.md section 3). Everything here is
// checked before any target executes.

import { stat } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { BUDGETS } from "./budgets.ts";
import { isNonEmptyString, isObject, isStringArray } from "./collector.ts";
import { NOT_COMMAND_JUDGED, ruleSpec } from "./rules.ts";
import { canonical } from "./templates.ts";
import type {
  Admission,
  AdmittedCase,
  CapturedTarget,
  Expected,
  Json,
  JsonObject,
  Probe,
  RunTarget,
} from "./types.ts";

export type AdmissionLoad =
  | { kind: "ok"; admission: Admission }
  | { kind: "invalid"; problems: string[] }
  | { kind: "unreadable"; problem: string };

const ROLES = ["help", "discovery", "command-discovery", "dispatch", "command"];
const MODES = ["machine", "human"];
const EXITS = [0, 1, 2, 3, 4, 75];
const CASE_KEYS = [
  "caseId",
  "rules",
  "role",
  "mode",
  "target",
  "expect",
  "sameAs",
  "normalize",
  "selector",
  "probe",
];
const RUN_KEYS = ["kind", "program", "args", "cwd", "env", "argvOffset"];
const CAPTURED_KEYS = ["kind", "stdout", "stderr", "exit"];
const EXPECT_KEYS = ["exitCode", "causeCode", "commandIdentity", "outcome"];
const PROBE_KEYS = ["program", "args", "cwd", "env", "expectedStdout"];
const RECOVERY_POINTERS = /^\/result\/data(\/|$)/;

class Problems {
  readonly list: string[] = [];
  add(message: string): void {
    this.list.push(message);
  }
  strict(object: JsonObject, allowed: readonly string[], path: string): void {
    for (const key of Object.keys(object))
      if (!allowed.includes(key))
        this.add(`${path}/${key} is not an admission key.`);
  }
}

function pathFrom(base: string, value: string): string {
  return isAbsolute(value) ? value : resolve(base, value);
}

function readEnv(
  value: Json | undefined,
  path: string,
  problems: Problems,
): Record<string, string> {
  if (value === undefined) return {};
  if (
    !isObject(value) ||
    !Object.values(value).every((item) => typeof item === "string")
  ) {
    problems.add(`${path} must map names to strings.`);
    return {};
  }
  return value as Record<string, string>;
}

function readProgram(
  object: JsonObject,
  base: string,
  path: string,
  problems: Problems,
) {
  if (!isNonEmptyString(object.program))
    problems.add(`${path}/program must be "bun-runtime" or a path.`);
  if (!isStringArray(object.args))
    problems.add(`${path}/args must be an array of strings.`);
  if (object.cwd !== undefined && !isNonEmptyString(object.cwd))
    problems.add(`${path}/cwd must be a path.`);
  const program = typeof object.program === "string" ? object.program : "";
  return {
    program: program === "bun-runtime" ? program : pathFrom(base, program),
    args: isStringArray(object.args) ? object.args : [],
    cwd: typeof object.cwd === "string" ? pathFrom(base, object.cwd) : base,
    env: readEnv(object.env, `${path}/env`, problems),
  };
}

function readTarget(
  value: Json | undefined,
  base: string,
  path: string,
  problems: Problems,
): RunTarget | CapturedTarget | null {
  if (!isObject(value)) {
    problems.add(`${path} must be a run or captured target.`);
    return null;
  }
  if (value.kind === "run") {
    problems.strict(value, RUN_KEYS, path);
    const program = readProgram(value, base, path, problems);
    const offset = value.argvOffset ?? 0;
    if (
      typeof offset !== "number" ||
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      offset > program.args.length
    )
      problems.add(
        `${path}/argvOffset must be an integer from 0 to the number of args.`,
      );
    return {
      kind: "run",
      ...program,
      argvOffset: typeof offset === "number" ? offset : 0,
    };
  }
  if (value.kind !== "captured") {
    problems.add(`${path}/kind must be "run" or "captured".`);
    return null;
  }
  problems.strict(value, CAPTURED_KEYS, path);
  const exit = value.exit;
  const validExit =
    isObject(exit) &&
    Object.keys(exit).length === 1 &&
    ((typeof exit.code === "number" && Number.isSafeInteger(exit.code)) ||
      isNonEmptyString(exit.signal));
  if (
    !isNonEmptyString(value.stdout) ||
    !isNonEmptyString(value.stderr) ||
    !validExit
  ) {
    problems.add(
      `${path} needs stdout and stderr paths and an exit of { code } or { signal }.`,
    );
    return null;
  }
  return {
    kind: "captured",
    stdoutPath: pathFrom(base, value.stdout),
    stderrPath: pathFrom(base, value.stderr),
    exit:
      typeof exit.code === "number"
        ? { code: exit.code }
        : { signal: exit.signal as string },
  };
}

function readExpect(
  value: Json | undefined,
  path: string,
  problems: Problems,
): Expected | undefined {
  if (value === undefined) return undefined;
  if (
    !isObject(value) ||
    typeof value.exitCode !== "number" ||
    !EXITS.includes(value.exitCode)
  ) {
    problems.add(`${path} needs exitCode, one of ${EXITS.join(", ")}.`);
    return undefined;
  }
  problems.strict(value, EXPECT_KEYS, path);
  const expected: Expected = { exitCode: value.exitCode };
  for (const key of ["causeCode", "commandIdentity", "outcome"] as const) {
    const item = value[key];
    if (item === undefined) continue;
    if (isNonEmptyString(item)) expected[key] = item;
    else problems.add(`${path}/${key} must be a nonempty string.`);
  }
  return expected;
}

function readRules(
  value: Json | undefined,
  captured: boolean,
  path: string,
  problems: Problems,
): string[] {
  if (
    !isStringArray(value) ||
    value.length === 0 ||
    new Set(value).size !== value.length
  ) {
    problems.add(`${path} must be a nonempty list of unique rule ids.`);
    return [];
  }
  for (const id of value) {
    const spec = ruleSpec(id);
    if (spec === undefined)
      problems.add(`${path} names unknown rule ${JSON.stringify(id)}.`);
    else if (NOT_COMMAND_JUDGED[spec.group] !== undefined)
      problems.add(
        `${path} names ${id}, which is judged by ${NOT_COMMAND_JUDGED[spec.group] ?? ""}, not by this command.`,
      );
    else if (captured && spec.proofLayer === "process")
      problems.add(
        `${path} names process rule ${id} on a captured case; captured bytes cannot prove a process observation.`,
      );
  }
  return value;
}

function readProbe(
  value: Json | undefined,
  base: string,
  path: string,
  problems: Problems,
): Probe | undefined {
  if (value === undefined) return undefined;
  if (!isObject(value) || typeof value.expectedStdout !== "string") {
    problems.add(`${path} needs a program and expectedStdout.`);
    return undefined;
  }
  problems.strict(value, PROBE_KEYS, path);
  return {
    ...readProgram(value, base, path, problems),
    expectedStdout: value.expectedStdout,
  };
}

function readNormalize(
  value: Json | undefined,
  path: string,
  problems: Problems,
): string[] {
  if (value === undefined) return [];
  if (
    !isStringArray(value) ||
    !value.every((pointer) => RECOVERY_POINTERS.test(pointer))
  ) {
    problems.add(
      `${path} may name only JSON Pointers under /result/data; domain recovery and guidance fields are never normalized.`,
    );
    return [];
  }
  return value;
}

function readCase(
  value: Json | undefined,
  index: number,
  base: string,
  earlier: AdmittedCase[],
  problems: Problems,
): AdmittedCase | null {
  const path = `/cases/${index}`;
  if (!isObject(value)) {
    problems.add(`${path} must be an object.`);
    return null;
  }
  problems.strict(value, CASE_KEYS, path);
  const caseId = value.caseId;
  if (!isNonEmptyString(caseId))
    problems.add(`${path}/caseId must be a nonempty string.`);
  else if (earlier.some((item) => item.caseId === caseId))
    problems.add(`${path}/caseId ${caseId} repeats.`);
  if (typeof value.role !== "string" || !ROLES.includes(value.role))
    problems.add(`${path}/role must be one of ${ROLES.join(", ")}.`);
  if (typeof value.mode !== "string" || !MODES.includes(value.mode))
    problems.add(`${path}/mode must be machine or human.`);
  const target = readTarget(value.target, base, `${path}/target`, problems);
  const rules = readRules(
    value.rules,
    target?.kind === "captured",
    `${path}/rules`,
    problems,
  );
  if (
    value.selector !== undefined &&
    (value.role !== "command-discovery" || !isNonEmptyString(value.selector))
  )
    problems.add(
      `${path}/selector is a nonempty string on a command-discovery case only.`,
    );
  const probe = readProbe(value.probe, base, `${path}/probe`, problems);
  if (probe !== undefined && target?.kind !== "run")
    problems.add(`${path}/probe needs a run target.`);
  const admitted: AdmittedCase = {
    caseId: typeof caseId === "string" ? caseId : "",
    rules,
    role: value.role as AdmittedCase["role"],
    mode: value.mode as AdmittedCase["mode"],
    target: target ?? {
      kind: "captured",
      stdoutPath: "",
      stderrPath: "",
      exit: { code: 0 },
    },
    normalize: readNormalize(value.normalize, `${path}/normalize`, problems),
  };
  const expected = readExpect(value.expect, `${path}/expect`, problems);
  if (expected !== undefined) admitted.expect = expected;
  if (typeof value.selector === "string") admitted.selector = value.selector;
  if (probe !== undefined) admitted.probe = probe;
  if (value.sameAs !== undefined) {
    const twin = earlier.find((item) => item.caseId === value.sameAs);
    if (
      twin === undefined ||
      twin.role !== admitted.role ||
      twin.mode !== admitted.mode ||
      canonical(twin.target as unknown as Json) !==
        canonical(admitted.target as unknown as Json)
    )
      problems.add(
        `${path}/sameAs must name an earlier case with the same role, mode and target.`,
      );
    else admitted.sameAs = twin.caseId;
  }
  return target === null ? null : admitted;
}

function parseAdmission(value: unknown, base: string): AdmissionLoad {
  const problems = new Problems();
  if (!isObject(value as Json))
    return {
      kind: "invalid",
      problems: ["The admission root must be a JSON object."],
    };
  const root = value as JsonObject;
  problems.strict(root, ["admissionVersion", "cli", "cases"], "");
  if (root.admissionVersion !== 1) problems.add("/admissionVersion must be 1.");
  if (!isNonEmptyString(root.cli) || /\s/.test(root.cli))
    problems.add("/cli must be the target executable name without whitespace.");
  const cases = root.cases;
  if (
    !Array.isArray(cases) ||
    cases.length === 0 ||
    cases.length > BUDGETS.ADMISSION_MAX_CASES
  ) {
    problems.add(`/cases must hold 1 to ${BUDGETS.ADMISSION_MAX_CASES} cases.`);
    return { kind: "invalid", problems: problems.list };
  }
  const admitted: AdmittedCase[] = [];
  cases.forEach((item, index) => {
    const parsed = readCase(item, index, base, admitted, problems);
    if (parsed !== null) admitted.push(parsed);
  });
  if (problems.list.length > 0)
    return { kind: "invalid", problems: problems.list };
  return {
    kind: "ok",
    admission: { cli: root.cli as string, cases: admitted },
  };
}

async function exists(
  path: string,
  kind: "file" | "directory",
): Promise<boolean> {
  try {
    const info = await stat(path);
    return kind === "file" ? info.isFile() : info.isDirectory();
  } catch {
    return false;
  }
}

async function preconditionProblem(
  admission: Admission,
): Promise<string | null> {
  for (const item of admission.cases) {
    const programs = item.target.kind === "run" ? [item.target] : [];
    if (item.probe !== undefined)
      programs.push({ ...item.probe, kind: "run", argvOffset: 0 });
    for (const program of programs) {
      if (
        program.program !== "bun-runtime" &&
        !(await exists(program.program, "file"))
      )
        return `Case ${item.caseId}: program file is missing or unreadable.`;
      if (!(await exists(program.cwd, "directory")))
        return `Case ${item.caseId}: working directory is missing.`;
    }
    if (item.target.kind === "captured")
      for (const path of [item.target.stdoutPath, item.target.stderrPath])
        if (!(await exists(path, "file")))
          return `Case ${item.caseId}: a captured stream file is missing or unreadable.`;
  }
  return null;
}

export async function loadAdmission(path: string): Promise<AdmissionLoad> {
  const absolute = resolve(path);
  let text: string;
  try {
    const file = Bun.file(absolute);
    if (file.size > BUDGETS.ADMISSION_MAX_BYTES)
      return {
        kind: "invalid",
        problems: [
          `The admission exceeds ${BUDGETS.ADMISSION_MAX_BYTES} bytes.`,
        ],
      };
    text = await file.text();
  } catch {
    return {
      kind: "unreadable",
      problem: "The admission file is missing or unreadable.",
    };
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { kind: "invalid", problems: ["The admission is not valid JSON."] };
  }
  const parsed = parseAdmission(value, dirname(absolute));
  if (parsed.kind !== "ok") return parsed;
  const problem = await preconditionProblem(parsed.admission);
  return problem === null ? parsed : { kind: "unreadable", problem };
}
