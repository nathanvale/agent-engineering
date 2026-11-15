// The checker command, independent of the envelope major that wraps it.
// host-adapter.ts is the only file that knows the host CLI's contract.

import { loadAdmission } from "./admission.ts";
import { BUDGETS } from "./budgets.ts";
import { judgeObservations, refusesAlone } from "./judge.ts";
import { PRODUCTION_MINORS, type MinorTable } from "./minors.ts";
import {
  admissionOutcome,
  judgementOutcome,
  type CheckerOutcome,
} from "./outcome.ts";
import { readCaptured, runProgram } from "./runner.ts";
import type { AdmittedCase, Observation } from "./types.ts";

const USAGE = "Usage: contract3 check --admission PATH [--json].";

function admissionPath(args: readonly string[]): string | null {
  const [option, value, ...rest] = args;
  if (option !== "--admission" || value === undefined || rest.length > 0)
    return null;
  return value;
}

/** Observe one admitted case: one execution, or one read of captured files. */
async function observeCase(item: AdmittedCase): Promise<Observation> {
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

export async function runCheck(
  args: readonly string[],
  minors: MinorTable = PRODUCTION_MINORS,
): Promise<CheckerOutcome> {
  const path = admissionPath(args);
  if (path === null)
    return admissionOutcome(
      "usage",
      `${USAGE} Pass --admission followed by one separate path value and nothing else.`,
    );
  const load = await loadAdmission(path);
  if (load.kind === "unreadable")
    return admissionOutcome("precondition", `${load.problem} No target ran.`);
  if (load.kind === "invalid")
    return admissionOutcome(
      "invalid-input",
      `The admission is invalid: ${load.problems.slice(0, 8).join(" ")} No target ran.`,
    );
  const observations = new Map<string, Observation>();
  for (const item of load.admission.cases) {
    const observation = await observeCase(item);
    observations.set(item.caseId, observation);
    if (refusesAlone(load.admission, item, observation, minors)) break;
  }
  const judgement = await judgeObservations(
    load.admission,
    observations,
    minors,
  );
  return judgementOutcome(judgement);
}
