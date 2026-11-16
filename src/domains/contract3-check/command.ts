// The checker command, independent of the envelope major that wraps it.
// host-adapter.ts is the only file that knows the host CLI's contract.

import { loadAdmission } from "./admission.ts";
import { judgeObservations } from "./judge.ts";
import { PRODUCTION_MINORS, type MinorTable } from "./minors.ts";
import {
  admissionResult,
  judgementResult,
  type CheckerResult,
} from "./outcome.ts";
import { observeAdmission } from "./observe.ts";
import { PatternMatcher } from "./pattern.ts";

const USAGE = "Usage: contract3 check --admission PATH [--json].";

function admissionPath(args: readonly string[]): string | null {
  const [option, value, ...rest] = args;
  if (option !== "--admission" || value === undefined || rest.length > 0)
    return null;
  return value;
}

export async function runCheck(
  args: readonly string[],
  minors: MinorTable = PRODUCTION_MINORS,
): Promise<CheckerResult> {
  const path = admissionPath(args);
  if (path === null)
    return admissionResult(
      "usage",
      `${USAGE} Pass --admission followed by one separate path value and nothing else.`,
    );
  const load = await loadAdmission(path);
  if (load.kind === "unreadable")
    return admissionResult("precondition", `${load.problem} No target ran.`);
  if (load.kind === "invalid")
    return admissionResult(
      "invalid-input",
      `The admission is invalid: ${load.problems.slice(0, 8).join(" ")} No target ran.`,
    );
  const observations = await observeAdmission(load.admission, minors);
  const judgement = await judgeObservations(
    load.admission,
    observations,
    minors,
    new PatternMatcher(),
  );
  return judgementResult(judgement);
}
