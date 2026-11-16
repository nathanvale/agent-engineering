// The one observation loop (review SF-3), shared by runCheck and the test
// harness's component layer: each listed case observed once, in admission
// order, starting no further target after a refused observation.

import { BUDGETS } from "./budgets.ts";
import { refusesAlone } from "./judge.ts";
import type { MinorTable } from "./minors.ts";
import { readCaptured, runProgram } from "./runner.ts";
import type { Admission, ListedCase, Observation } from "./types.ts";

/** Observe one listed case: one execution, or one read of captured files. */
async function observeCase(item: ListedCase): Promise<Observation> {
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

/** Observe every listed case in order, stopping after a refused observation. */
export async function observeAdmission(
  admission: Admission,
  minors: MinorTable,
): Promise<Map<string, Observation>> {
  const observations = new Map<string, Observation>();
  for (const item of admission.cases) {
    const observation = await observeCase(item);
    observations.set(item.caseId, observation);
    if (refusesAlone(admission, item, observation, minors)) break;
  }
  return observations;
}
