// The one edge that knows the host CLI's envelope major.
// PROVISIONAL (D1): the host CLI is Contract 2.0, so the checker's own
// result and stations use the host's 2.0 shape. VER-14 "an envelope at the
// checker's minor" stays an open, disclosed obligation until the host moves
// to the 3.0 base. A later D1 ruling replaces this file only; runCheck and
// everything it judges stay unchanged. The checker core loads lazily so
// discovery never loads it (DISC-2a).

import type { OperationResult } from "../../commands-contract.ts";
import type { MinorTable } from "./minors.ts";
import type { CheckerOutcome, CheckerStation } from "./outcome.ts";

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
    trigger:
      "Every admitted observation is accepted and no admitted row failed.",
  },
  usage: {
    causeCode: "USAGE_INVALID_INVOCATION",
    outcome: "refused",
    failureClass: "usage",
    exitCode: 2,
    nextAction: "Run example --help and correct the invocation.",
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
      "The admission is invalid, or target output is malformed, broken, over budget or fails an admitted rule.",
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

/** Host-shaped discovery stations for the checker command. */
export function checkerStations(commandIdentity: string): unknown[] {
  return Object.values(HOST_STATIONS).map((words) => ({
    causeCode: words.causeCode,
    commandIdentity,
    effectClass: "inspect",
    exitCode: words.exitCode,
    failureClass: words.failureClass,
    guidance: { nextAction: words.nextAction },
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
  outcome: CheckerOutcome,
): OperationResult {
  const words = HOST_STATIONS[outcome.station];
  return {
    causeCode: words.causeCode,
    commandIdentity,
    data: outcome.data,
    effectClass: "inspect",
    effects: {
      completed: [],
      inventoryComplete: true,
      remaining: [],
      uncertain: [],
    },
    exitCode: words.exitCode,
    failureClass: words.failureClass,
    message: outcome.message,
    nextAction: words.nextAction,
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
