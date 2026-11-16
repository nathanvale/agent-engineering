// Shared data shapes for the Contract 3 checker. Nothing here knows which
// contract major wraps the checker's own result (see command.ts).

export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

export type JsonObject = { [key: string]: Json };

export type CaseRole =
  | "help"
  | "discovery"
  | "command-discovery"
  | "dispatch"
  | "command";

export type Mode = "machine" | "human";

export interface Expected {
  exitCode: number;
  causeCode?: string;
  commandIdentity?: string;
  outcome?: string;
}

export interface ProgramSpec {
  /** Absolute path, or the literal "bun-runtime" for the checker's own Bun. */
  program: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
}

export interface RunTarget extends ProgramSpec {
  kind: "run";
  /** Count of leading args that are not the target CLI's own argv. */
  argvOffset: number;
}

export interface CapturedTarget {
  kind: "captured";
  stdoutPath: string;
  stderrPath: string;
  exit: ProcessExit;
}

export interface Probe extends ProgramSpec {
  expectedStdout: string;
}

export interface ListedCase {
  caseId: string;
  rules: string[];
  role: CaseRole;
  mode: Mode;
  target: RunTarget | CapturedTarget;
  expect?: Expected;
  sameAs?: string;
  normalize: string[];
  selector?: string;
  probe?: Probe;
}

export interface Admission {
  cli: string;
  cases: ListedCase[];
}

export type ProcessExit = { code: number } | { signal: string };

export interface StreamCapture {
  bytes: Uint8Array;
  overBudget: boolean;
}

export interface ProgramObservation {
  started: boolean;
  startError?: string;
  stdout: StreamCapture;
  stderr: StreamCapture;
  exit: ProcessExit | null;
  timedOut: boolean;
}

export interface Observation extends ProgramObservation {
  caseId: string;
  source: "run" | "captured";
  probe?: ProgramObservation;
}

export interface Finding {
  ruleId: string;
  message: string;
}
