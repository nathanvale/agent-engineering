// The host envelope Adapter (Adapter in the codebase-design sense: a concrete
// module satisfying an Interface at a Seam). It is not a VER-12 version
// adapter. Inside the checker, it is the only module that knows the host CLI's
// envelope major.
// STOPGAP, removed at T7 (accepted decision of 16 November 2026, 13:43): the
// host CLI moves to a Contract 3.0 front door at composition and no translator
// between envelope majors remains after that.
// PROVISIONAL (D1, open with Nathan): the host CLI is Contract 2.0, so the
// checker's own result and stations use the host's 2.0 shape. VER-14 "an
// envelope at the checker's minor" stays an open, disclosed obligation until
// the host moves to the 3.0 base. If D1 moves the host to 3.0, these change:
// this file (stations become kernel declarations with next or handoff arms);
// the command entry in src/commands.ts and the acceptsArguments route mode in
// src/cli.ts and src/commands-contract.ts; the D3 reader specimen
// tests/contract3/checker/specimens/reader-3.1/reader.ts (it builds the host
// envelope); and tests/contract3/checker/supporting/host-adapter.test.ts.
// runCheck, judgeObservations and every rule module stay unchanged. The
// checker core loads lazily so discovery never loads it (DISC-2a).

import type { OperationResult } from "../../commands-contract.ts";
import type { MinorTable } from "./minors.ts";
import type { CheckerResult, CheckerStation } from "./outcome.ts";

interface HostStationWords {
  causeCode: string;
  outcome: "success" | "refused";
  failureClass: "usage" | "domain" | "schema" | null;
  exitCode: 0 | 2 | 3 | 4;
  nextAction: string;
  repairAction: string | null;
  trigger: string;
}

const HOST_STATIONS: Readonly<Record<CheckerStation, HostStationWords>> = {
  success: {
    causeCode: "SUCCESS_UNCHANGED",
    outcome: "success",
    failureClass: null,
    exitCode: 0,
    nextAction: "Read data.rows; any row other than passed is unproved.",
    repairAction: null,
    trigger: "Every listed observation is accepted and no row failed.",
  },
  usage: {
    causeCode: "USAGE_INVALID_INVOCATION",
    outcome: "refused",
    failureClass: "usage",
    exitCode: 2,
    nextAction: "Run {cli} --help and correct the invocation.",
    repairAction: "Pass --admission followed by one path, and nothing else.",
    trigger: "The invocation does not name exactly one admission path.",
  },
  precondition: {
    causeCode: "DOMAIN_PRECONDITION_UNMET",
    outcome: "refused",
    failureClass: "domain",
    exitCode: 3,
    nextAction: "Make the named file readable, then run the check again.",
    repairAction: "Make the file or directory named in message available.",
    trigger:
      "An admission, captured stream, program or working directory is missing or unreadable.",
  },
  "invalid-input": {
    causeCode: "SCHEMA_INVALID_INPUT",
    outcome: "refused",
    failureClass: "schema",
    exitCode: 4,
    nextAction:
      "Correct the input shape named in message. Inspect target effects separately; the checker never reruns a target.",
    repairAction:
      "Correct the admission or target output named in message; message names the observed version and the violated key or correlation.",
    trigger:
      "The admission file is invalid, or target output is malformed, broken, over budget or fails a listed rule.",
  },
  "unsupported-contract": {
    causeCode: "SCHEMA_UNSUPPORTED_CONTRACT",
    outcome: "refused",
    failureClass: "schema",
    exitCode: 4,
    nextAction:
      "Use a reader that accepts the version named in message. No adaptation.",
    repairAction:
      "Use a reader built for the version named in message; nothing was adapted.",
    trigger:
      "Target output declares another major or a newer minor than this reader.",
  },
};

/** One host-shaped discovery station (the host's Contract 2.0 shape). */
export interface HostStation {
  causeCode: string;
  commandIdentity: string;
  effectClass: "inspect";
  exitCode: 0 | 2 | 3 | 4;
  failureClass: "usage" | "domain" | "schema" | null;
  guidance: { nextAction: string };
  outcome: "success" | "refused";
  reachability: "required";
  repairAction: string | null;
  retryable: false;
  retryDelayPolicy: { kind: "none" };
  transactionState: "unchanged";
  trigger: string;
  unreachableRationale: null;
}

/** The host CLI's name is the first segment of the command identity. */
function hostWords(text: string, commandIdentity: string): string {
  return text.replace(
    "{cli}",
    commandIdentity.split(".")[0] ?? commandIdentity,
  );
}

/** Host-shaped discovery stations for the checker command. */
export function checkerStations(commandIdentity: string): HostStation[] {
  return Object.values(HOST_STATIONS).map((words) => ({
    causeCode: words.causeCode,
    commandIdentity,
    effectClass: "inspect",
    exitCode: words.exitCode,
    failureClass: words.failureClass,
    guidance: { nextAction: hostWords(words.nextAction, commandIdentity) },
    outcome: words.outcome,
    reachability: "required",
    repairAction: words.repairAction,
    retryable: false,
    retryDelayPolicy: { kind: "none" },
    transactionState: "unchanged",
    trigger: words.trigger,
    unreachableRationale: null,
  }));
}

function toHostResult(
  commandIdentity: string,
  checked: CheckerResult,
): OperationResult {
  const words = HOST_STATIONS[checked.station];
  return {
    causeCode: words.causeCode,
    commandIdentity,
    data: checked.data,
    effectClass: "inspect",
    effects: {
      completed: [],
      inventoryComplete: true,
      remaining: [],
      uncertain: [],
    },
    exitCode: words.exitCode,
    failureClass: words.failureClass,
    message: checked.message,
    nextAction: hostWords(words.nextAction, commandIdentity),
    outcome: words.outcome,
    repairAction: words.repairAction,
    retryable: false,
    transactionState: "unchanged",
  };
}

/**
 * The production entry passes no table, so the reader reads exactly 3.0.0.
 * Only code (the test-only D3 reader specimen) can pass another table; no
 * argv token, environment variable or admission key reaches it (D3 condition 1).
 */
export async function executeCheck(
  commandIdentity: string,
  args: string[],
  minors?: MinorTable,
): Promise<OperationResult> {
  const { runCheck } = await import("./command.ts");
  return toHostResult(commandIdentity, await runCheck(args, minors));
}
