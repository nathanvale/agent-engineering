// Group E: rules judged on one accepted-version envelope alone
// (wire.md, next-steps.md, diagnostics.md). Version classification has
// already accepted the declared minor.

import {
  has,
  isNonEmptyString,
  isNonNegativeSafeInteger,
  isObject,
  member,
  nonEmptyString,
  notNull,
  requireKeys,
  strictKeys,
  type ShapeContext,
} from "./collector.ts";
import { isFallbackCause, rowProblems, type Arm } from "./result-table.ts";
import { BINDING_NAME, bindingValueProblem } from "./templates.ts";
import type { Json, JsonObject } from "./types.ts";

const RESULT_REQUIRED = [
  "runId",
  "commandIdentity",
  "outcome",
  "effectClass",
  "transactionState",
  "causeCode",
  "failureClass",
  "exitCode",
  "data",
  "retryable",
  "repairAction",
  "effects",
] as const;

const LISTS = ["completed", "remaining", "uncertain"] as const;

function sortedUnique(values: readonly string[]): boolean {
  return values.every((value, index) => {
    const previous = values[index - 1];
    return previous === undefined || previous < value;
  });
}

function stringList(
  ctx: ShapeContext,
  value: Json | undefined,
  path: string,
): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    ctx.c.fail("metadata-values", `${path} must be an array of strings.`);
    return [];
  }
  value.forEach((item, index) => nonEmptyString(ctx, item, `${path}/${index}`));
  return value.filter((item): item is string => typeof item === "string");
}

export function validateStep(
  ctx: ShapeContext,
  step: Json | undefined,
  path: string,
  inspection: boolean,
): void {
  if (!isObject(step)) {
    ctx.c.fail(
      inspection ? "handoff-shape" : "metadata-values",
      `${path} must be an object.`,
    );
    return;
  }
  const kindUnion = inspection ? "inspectKind" : "stepKind";
  const ruleId = inspection ? "handoff-shape" : "closed-union";
  if (!member(ctx, kindUnion, step.kind, `${path}/kind`, ruleId)) return;
  const kind = step.kind as string;
  strictKeys(
    ctx,
    inspection
      ? (`inspect.${kind}` as "inspect.command" | "inspect.instruction")
      : (`step.${kind}` as
          | "step.command"
          | "step.retry"
          | "step.instruction"
          | "step.done"),
    step,
    path,
  );
  if (kind === "command") {
    requireKeys(ctx, step, ["command", "args"], path);
    nonEmptyString(ctx, step.command, `${path}/command`);
    ctx.c.check(
      "metadata-values",
      !has(step, "args") ||
        (Array.isArray(step.args) &&
          step.args.every((arg) => typeof arg === "string")),
      () => `${path}/args must be an array of strings.`,
    );
  }
  if (kind === "instruction") {
    requireKeys(ctx, step, ["text"], path);
    nonEmptyString(ctx, step.text, `${path}/text`);
  }
}

function validateHandoff(ctx: ShapeContext, handoff: Json | undefined): void {
  const path = "/result/handoff";
  ctx.c.touch("handoff-shape");
  if (!isObject(handoff)) {
    ctx.c.fail("handoff-shape", `${path} must be an object.`);
    return;
  }
  strictKeys(ctx, "handoff", handoff, path);
  requireKeys(ctx, handoff, ["owner", "reason", "inspect"], path);
  notNull(ctx, handoff, ["resource"], path);
  if (has(handoff, "owner"))
    member(ctx, "owner", handoff.owner, `${path}/owner`);
  if (has(handoff, "reason"))
    nonEmptyString(ctx, handoff.reason, `${path}/reason`);
  const inspect = handoff.inspect;
  if (!Array.isArray(inspect) || inspect.length === 0)
    ctx.c.fail("handoff-shape", `${path}/inspect must be a nonempty array.`);
  else
    inspect.forEach((entry, index) =>
      validateStep(ctx, entry, `${path}/inspect/${index}`, true),
    );
  const resource = handoff.resource;
  if (isObject(resource)) {
    strictKeys(ctx, "resource", resource, `${path}/resource`);
    requireKeys(ctx, resource, ["kind", "id"], `${path}/resource`);
    nonEmptyString(ctx, resource.kind, `${path}/resource/kind`);
    nonEmptyString(ctx, resource.id, `${path}/resource/id`);
  } else if (resource !== undefined && resource !== null)
    ctx.c.fail("metadata-values", `${path}/resource must be an object.`);
}

interface EffectLists {
  completed: string[];
  remaining: string[];
  uncertain: string[];
  inventoryComplete: boolean | null;
}

function validateEffectLists(
  ctx: ShapeContext,
  effects: Json | undefined,
): EffectLists | null {
  const path = "/result/effects";
  if (!isObject(effects)) {
    if (effects !== undefined)
      ctx.c.fail("metadata-values", `${path} must be an object.`);
    return null;
  }
  strictKeys(ctx, "effects", effects, path);
  requireKeys(ctx, effects, [...LISTS, "inventoryComplete"], path);
  const lists = {
    completed: stringList(ctx, effects.completed, `${path}/completed`),
    remaining: stringList(ctx, effects.remaining, `${path}/remaining`),
    uncertain: stringList(ctx, effects.uncertain, `${path}/uncertain`),
    inventoryComplete:
      typeof effects.inventoryComplete === "boolean"
        ? effects.inventoryComplete
        : null,
  };
  ctx.c.check(
    "metadata-values",
    lists.inventoryComplete !== null || !has(effects, "inventoryComplete"),
    () => `${path}/inventoryComplete must be a boolean.`,
  );
  ctx.c.touch("effects-sets");
  for (const name of LISTS)
    ctx.c.check(
      "effects-sets",
      sortedUnique(lists[name]),
      () => `${path}/${name} must be unique and sorted by code unit.`,
    );
  for (const [left, right] of [
    ["completed", "remaining"],
    ["completed", "uncertain"],
    ["remaining", "uncertain"],
  ] as const) {
    const overlap = lists[left].filter((item) => lists[right].includes(item));
    ctx.c.check(
      "effects-sets",
      overlap.length === 0,
      () => `${path}/${left} and ${right} share ${JSON.stringify(overlap)}.`,
    );
  }
  return lists;
}

function effectStateProblem(
  state: string,
  outcome: Json | undefined,
  lists: EffectLists,
): string | null {
  const counts = {
    completed: lists.completed.length,
    remaining: lists.remaining.length,
    uncertain: lists.uncertain.length,
  };
  const complete = lists.inventoryComplete === true;
  switch (state) {
    case "unchanged":
      if (!complete || counts.completed > 0 || counts.uncertain > 0)
        return "unchanged requires a complete inventory and empty completed and uncertain lists";
      return outcome === "success" && counts.remaining > 0
        ? "a success that is unchanged cannot retain remaining effects"
        : null;
    case "completed":
      return complete &&
        counts.completed > 0 &&
        counts.remaining === 0 &&
        counts.uncertain === 0
        ? null
        : "completed requires a complete inventory, completed effects and nothing remaining or uncertain";
    case "partially-completed":
      return complete &&
        counts.completed > 0 &&
        counts.remaining > 0 &&
        counts.uncertain === 0
        ? null
        : "partially-completed requires completed and remaining effects and nothing uncertain";
    case "unknown":
      return complete && counts.uncertain === 0
        ? "unknown with a complete inventory requires at least one uncertain effect"
        : null;
    default:
      return null;
  }
}

function validateEffects(ctx: ShapeContext, result: JsonObject): void {
  const lists = validateEffectLists(ctx, result.effects);
  if (lists === null) return;
  const state = result.transactionState;
  if (typeof state === "string") {
    const problem = effectStateProblem(state, result.outcome, lists);
    ctx.c.check(
      "effects-state",
      problem === null,
      () => `/result/effects: ${problem ?? ""}.`,
    );
  }
  if (result.effectClass === "inspect")
    ctx.c.check(
      "effect-inventory",
      state === "unchanged" &&
        lists.inventoryComplete === true &&
        lists.completed.length +
          lists.remaining.length +
          lists.uncertain.length ===
          0,
      () =>
        "/result/effects: an inspect result requires unchanged state, a complete inventory and three empty effects lists.",
    );
  const attempted = result.attemptedEffect;
  if (typeof attempted === "string") {
    ctx.c.check(
      "attempted-effect",
      result.outcome === "failed",
      () => "attemptedEffect appears only on a failed result.",
    );
    const homes = LISTS.filter((name) => lists[name].includes(attempted));
    ctx.c.check(
      "attempted-effect",
      homes.length === 1,
      () =>
        `attemptedEffect ${JSON.stringify(attempted)} must appear in exactly one effects list.`,
    );
  }
}

function armOf(result: JsonObject): Arm | null {
  if (isObject(result.next) && !has(result, "handoff")) return "next";
  if (isObject(result.handoff) && !has(result, "next")) return "handoff";
  return null;
}

function validateGuidanceArm(ctx: ShapeContext, result: JsonObject): void {
  const hasNext = has(result, "next");
  const hasHandoff = has(result, "handoff");
  ctx.c.check(
    "guidance-arm",
    hasNext !== hasHandoff,
    () =>
      `/result must carry exactly one of next and handoff, not ${hasNext ? "both" : "neither"}.`,
  );
  ctx.c.check(
    "guidance-arm",
    result.next !== null && result.handoff !== null,
    () => "A guidance arm is null; omit the absent arm instead.",
  );
  if (isObject(result.next))
    validateStep(ctx, result.next, "/result/next", false);
  else if (hasNext && result.next !== null)
    ctx.c.fail("metadata-values", "/result/next must be an object.");
  if (hasHandoff && result.handoff !== null)
    validateHandoff(ctx, result.handoff);
  const kind = isObject(result.next) ? result.next.kind : undefined;
  ctx.c.check(
    "retry-kind",
    (result.retryable === true) === (kind === "retry") &&
      !(result.retryable === true && hasHandoff),
    () => "next.kind retry appears exactly when retryable is true.",
  );
  ctx.c.check(
    "done-outcome",
    kind !== "done" || result.outcome === "success",
    () => "next.kind done is legal only on success.",
  );
}

/** Presence of the conditional key is also a presence finding (binder bindings). */
function validateRetryDelay(ctx: ShapeContext, result: JsonObject): void {
  const present = has(result, "retryDelayMilliseconds");
  const delay = result.retryDelayMilliseconds;
  const retryable = result.retryable === true;
  if (present !== retryable || delay === null) {
    const message =
      delay === null
        ? "retryDelayMilliseconds is null; it is present with a value exactly when retryable is true."
        : retryable
          ? "A retryable result is missing retryDelayMilliseconds."
          : "retryDelayMilliseconds is present on a result that is not retryable.";
    ctx.c.fail("retry-delay", message);
    ctx.c.fail("presence", message);
    return;
  }
  ctx.c.touch("retry-delay");
  if (retryable)
    ctx.c.check(
      "retry-delay",
      typeof delay === "number" && Number.isSafeInteger(delay) && delay >= 1,
      () => "retryDelayMilliseconds must be a safe integer of at least 1.",
    );
}

function validateBindings(ctx: ShapeContext, result: JsonObject): void {
  if (!has(result, "bindings") || result.bindings === null) return;
  const bindings = result.bindings;
  if (!isObject(bindings)) {
    ctx.c.fail("binding-keys", "/result/bindings must be an object.");
    return;
  }
  const names = Object.keys(bindings);
  ctx.c.check(
    "binding-keys",
    names.length > 0,
    () => "/result/bindings is present but names no binding.",
  );
  for (const name of names) {
    ctx.c.check(
      "binding-keys",
      BINDING_NAME.test(name),
      () =>
        `Binding name ${JSON.stringify(name)} does not match ^[a-z][A-Za-z0-9]*$.`,
    );
    const value = bindings[name];
    const problem =
      typeof value === "string"
        ? bindingValueProblem(value)
        : "is not a string";
    ctx.c.check(
      "binding-value",
      problem === null,
      () => `Binding ${name} ${problem ?? ""}.`,
    );
  }
}

function validateScalars(ctx: ShapeContext, result: JsonObject): void {
  for (const key of ["runId", "commandIdentity", "causeCode"] as const)
    if (has(result, key)) nonEmptyString(ctx, result[key], `/result/${key}`);
  for (const key of ["idempotencyKey", "attemptedEffect"] as const)
    if (has(result, key) && result[key] !== null)
      nonEmptyString(ctx, result[key], `/result/${key}`);
  if (has(result, "retryable"))
    ctx.c.check(
      "metadata-values",
      typeof result.retryable === "boolean",
      () => "/result/retryable must be a boolean.",
    );
  if (has(result, "repairAction") && result.repairAction !== null)
    nonEmptyString(ctx, result.repairAction, "/result/repairAction");
  if (has(result, "outcome"))
    member(ctx, "outcome", result.outcome, "/result/outcome");
  if (has(result, "effectClass"))
    member(ctx, "effectClass", result.effectClass, "/result/effectClass");
  if (has(result, "transactionState"))
    member(
      ctx,
      "transactionState",
      result.transactionState,
      "/result/transactionState",
    );
  if (has(result, "failureClass") && result.failureClass !== null)
    member(ctx, "failureClass", result.failureClass, "/result/failureClass");
  if (has(result, "exitCode"))
    member(ctx, "exitCode", result.exitCode, "/result/exitCode");
}

function validateCorrelation(ctx: ShapeContext, result: JsonObject): void {
  const {
    outcome,
    transactionState,
    failureClass,
    exitCode,
    retryable,
    causeCode,
  } = result;
  ctx.c.touch("result-correlation", "failure-data");
  if (
    typeof outcome !== "string" ||
    typeof transactionState !== "string" ||
    !(failureClass === null || typeof failureClass === "string") ||
    typeof exitCode !== "number" ||
    typeof retryable !== "boolean" ||
    typeof causeCode !== "string"
  )
    return;
  const problems = rowProblems(
    {
      outcome,
      transactionState,
      failureClass,
      exitCode,
      retryable,
      arm: armOf(result),
    },
    causeCode,
  );
  for (const problem of problems)
    ctx.c.fail("result-correlation", `Result row: ${problem}.`);
  const repairPresent = has(result, "repairAction");
  if (outcome === "success") {
    if (repairPresent)
      ctx.c.check(
        "result-correlation",
        result.repairAction === null,
        () => "repairAction is null on success.",
      );
  } else {
    ctx.c.check(
      "failure-data",
      result.data === null,
      () => `data must be null on ${outcome}.`,
    );
    if (repairPresent)
      ctx.c.check(
        "result-correlation",
        isNonEmptyString(result.repairAction),
        () => `repairAction is required on ${outcome}.`,
      );
  }
  if (isFallbackCause(causeCode)) {
    // Binder G14 (stopped negative): at a later minor an ordinary internal
    // result is legal and the wire does not mark a fallback, so only the
    // 3.0.0 valid twin is judged here.
    if (ctx.declaredMinor === 0) ctx.c.touch("fallback-version");
    else
      ctx.c.unproved(
        "fallback-version",
        "The wire does not distinguish a fallback from an ordinary internal result at a later minor (binder G14, stopped).",
      );
  }
}

function validateResult(ctx: ShapeContext, result: JsonObject): void {
  strictKeys(ctx, "result", result, "/result");
  requireKeys(ctx, result, RESULT_REQUIRED, "/result");
  notNull(
    ctx,
    result,
    ["bindings", "idempotencyKey", "attemptedEffect"],
    "/result",
  );
  validateScalars(ctx, result);
  validateCorrelation(ctx, result);
  validateEffects(ctx, result);
  validateGuidanceArm(ctx, result);
  validateRetryDelay(ctx, result);
  validateBindings(ctx, result);
}

function counter(value: Json | undefined): boolean {
  return isNonNegativeSafeInteger(value);
}

const DIAGNOSTIC_CHECKS: Readonly<
  Record<string, (ctx: ShapeContext, value: Json | undefined) => boolean>
> = {
  file: (_ctx, value) =>
    value === null || (typeof value === "string" && value.startsWith("/")),
  sinkFailure: (ctx, value) =>
    value === null ||
    ctx.minors.memberMembership(
      "sinkFailure",
      value as string,
      ctx.declaredMinor,
    ) === "known",
  droppedRecords: (_ctx, value) => counter(value),
  unflushedRecords: (_ctx, value) => counter(value),
  truncatedRecords: (_ctx, value) => counter(value),
  countsComplete: (_ctx, value) => typeof value === "boolean",
  closed: (_ctx, value) => typeof value === "boolean",
};

function diagnosticFields(
  ctx: ShapeContext,
  object: JsonObject,
  path: string,
  ruleId: string,
  required: boolean,
): void {
  for (const [key, valid] of Object.entries(DIAGNOSTIC_CHECKS)) {
    if (!has(object, key)) {
      if (required) ctx.c.fail(ruleId, `${path}/${key} is missing.`);
      continue;
    }
    ctx.c.check(
      ruleId,
      valid(ctx, object[key]),
      () => `${path}/${key} is invalid.`,
    );
  }
}

function validateDiagnostics(
  ctx: ShapeContext,
  diagnostics: Json | undefined,
): void {
  const path = "/diagnostics";
  if (!isObject(diagnostics)) {
    ctx.c.fail("metadata-values", `${path} must be an object.`);
    return;
  }
  if (!member(ctx, "diagnosticsStatus", diagnostics.status, `${path}/status`))
    return;
  if (diagnostics.status === "available") {
    ctx.c.touch("diagnostics-available");
    strictKeys(ctx, "diagnostics.available", diagnostics, path);
    diagnosticFields(ctx, diagnostics, path, "diagnostics-available", true);
    return;
  }
  ctx.c.touch("diagnostics-unavailable");
  strictKeys(ctx, "diagnostics.unavailable", diagnostics, path);
  ctx.c.check(
    "diagnostics-unavailable",
    typeof diagnostics.reason === "string" &&
      ctx.minors.memberMembership(
        "unavailableReason",
        diagnostics.reason,
        ctx.declaredMinor,
      ) === "known",
    () => `${path}/reason must be status-invalid or status-unavailable.`,
  );
  const trusted = diagnostics.trusted;
  if (!isObject(trusted)) {
    ctx.c.fail("diagnostics-unavailable", `${path}/trusted must be an object.`);
    return;
  }
  strictKeys(ctx, "diagnostics.trusted", trusted, `${path}/trusted`);
  diagnosticFields(
    ctx,
    trusted,
    `${path}/trusted`,
    "diagnostics-unavailable",
    false,
  );
}

function validatePaths(ctx: ShapeContext, paths: Json | undefined): void {
  if (!Array.isArray(paths)) {
    ctx.c.fail("metadata-values", "/availablePaths must be an array.");
    return;
  }
  paths.forEach((path, index) =>
    nonEmptyString(ctx, path, `/availablePaths/${index}`),
  );
  const strings = paths.filter(
    (path): path is string => typeof path === "string",
  );
  ctx.c.check(
    "available-order",
    sortedUnique(strings),
    () => "/availablePaths must be unique and sorted by code unit.",
  );
}

/** Group E rules on one envelope whose version was accepted. */
export function validateEnvelope(
  ctx: ShapeContext,
  envelope: JsonObject,
): void {
  ctx.c.touch("json-framing", "json-values", "metadata-values", "presence");
  strictKeys(ctx, "envelope", envelope, "");
  requireKeys(ctx, envelope, ["message", "availablePaths", "result"], "");
  notNull(ctx, envelope, ["diagnostics"], "");
  if (has(envelope, "message"))
    nonEmptyString(ctx, envelope.message, "/message");
  if (has(envelope, "availablePaths"))
    validatePaths(ctx, envelope.availablePaths);
  if (isObject(envelope.result)) validateResult(ctx, envelope.result);
  else if (has(envelope, "result"))
    ctx.c.fail("presence", "/result must be an object.");
  if (has(envelope, "diagnostics") && envelope.diagnostics !== null)
    validateDiagnostics(ctx, envelope.diagnostics);
}
