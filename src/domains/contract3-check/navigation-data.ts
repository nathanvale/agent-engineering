// Help, discovery and command-discovery data (DISC-3 to DISC-13, INPUT-2)
// and the declaration rules judged on them alone (group D, template rules).

import {
  has,
  isNonEmptyString,
  isObject,
  isStringArray,
  member,
  nonEmptyString,
  requireKeys,
  strictKeys,
  type ShapeContext,
} from "./collector.ts";
import { validateStep } from "./envelope-rules.ts";
import { validateInputSchema, type InputSpec } from "./input-grammar.ts";
import { rowProblems } from "./result-table.ts";
import {
  bindingNamesIn,
  hasAnyBraceToken,
  stationStrings,
  unknownTokens,
} from "./templates.ts";
import type { Json, JsonObject } from "./types.ts";

export interface CommandSummary {
  commandIdentity: string;
  route: string[];
  effectClass: string;
  summary: string;
}

export interface CommandDescription {
  command: CommandSummary;
  ifNoResult: JsonObject | null;
  input: InputSpec | null;
  stations: JsonObject[];
}

const EXIT_MEANINGS: Readonly<Record<string, string>> = {
  "0": "success",
  "1": "internal",
  "2": "usage",
  "3": "domain",
  "4": "schema",
  "75": "transient",
};
const SIGNAL_EXITS: Readonly<Record<string, string>> = {
  "130": "SIGINT",
  "143": "SIGTERM",
};

/** Listed values are discovery-metadata; an unlisted key is strict-keys. */
function fixedMap(
  ctx: ShapeContext,
  value: Json | undefined,
  expected: Readonly<Record<string, string>>,
  path: string,
): void {
  if (value === undefined) return;
  if (!isObject(value)) {
    ctx.c.fail("discovery-metadata", `${path} must be an object.`);
    return;
  }
  ctx.c.check(
    "discovery-metadata",
    Object.entries(expected).every(([key, meaning]) => value[key] === meaning),
    () => `${path} must map ${JSON.stringify(expected)}.`,
  );
  ctx.c.touch("strict-keys");
  for (const key of Object.keys(value))
    if (!Object.hasOwn(expected, key))
      ctx.c.fail(
        "strict-keys",
        `Unlisted key ${path}/${key}; remove that key.`,
      );
}

function validateSummary(
  ctx: ShapeContext,
  value: Json | undefined,
  path: string,
): CommandSummary | null {
  if (!isObject(value)) {
    ctx.c.fail(
      "discovery-metadata",
      `${path} must be a CommandSummary object.`,
    );
    return null;
  }
  strictKeys(ctx, "command-summary", value, path);
  requireKeys(
    ctx,
    value,
    ["commandIdentity", "route", "summary", "effectClass"],
    path,
  );
  const { commandIdentity, summary, effectClass, route } = value;
  const valid =
    nonEmptyString(ctx, commandIdentity, `${path}/commandIdentity`) &&
    nonEmptyString(ctx, summary, `${path}/summary`) &&
    member(ctx, "effectClass", effectClass, `${path}/effectClass`);
  const routeValid = ctx.c.check(
    "discovery-metadata",
    isStringArray(route) && route.every(isNonEmptyString),
    () => `${path}/route must be an array of nonempty argv tokens.`,
  );
  if (
    !valid ||
    !routeValid ||
    !isNonEmptyString(commandIdentity) ||
    !isNonEmptyString(summary) ||
    typeof effectClass !== "string" ||
    !isStringArray(route)
  )
    return null;
  return { commandIdentity, route, effectClass, summary };
}

function summaries(
  ctx: ShapeContext,
  value: Json | undefined,
  path: string,
): CommandSummary[] {
  if (!Array.isArray(value)) {
    ctx.c.fail("discovery-metadata", `${path} must be an array.`);
    return [];
  }
  const list = value
    .map((item, index) => validateSummary(ctx, item, `${path}/${index}`))
    .filter((item): item is CommandSummary => item !== null);
  const identities = list.map((item) => item.commandIdentity);
  ctx.c.check(
    "discovery-metadata",
    new Set(identities).size === identities.length,
    () => `${path} lists a command identity more than once.`,
  );
  const routes = list
    .filter((item) => item.route.length > 0)
    .map((item) => JSON.stringify(item.route));
  ctx.c.check(
    "discovery-metadata",
    new Set(routes).size === routes.length,
    () => `${path} lists one route for two commands.`,
  );
  return list;
}

export function validateHelpData(
  ctx: ShapeContext,
  data: Json | undefined,
): CommandSummary[] | null {
  const path = "/result/data";
  ctx.c.touch("discovery-metadata");
  if (!isObject(data)) {
    ctx.c.fail("discovery-metadata", `${path} must be HelpData.`);
    return null;
  }
  strictKeys(ctx, "help", data, path);
  requireKeys(ctx, data, ["usage", "summary", "commands", "options"], path);
  nonEmptyString(ctx, data.usage, `${path}/usage`, "discovery-metadata");
  nonEmptyString(ctx, data.summary, `${path}/summary`, "discovery-metadata");
  const options = data.options;
  if (Array.isArray(options))
    options.forEach((option, index) => {
      const optionPath = `${path}/options/${index}`;
      if (!isObject(option)) {
        ctx.c.fail(
          "discovery-metadata",
          `${optionPath} must be an OptionSummary.`,
        );
        return;
      }
      strictKeys(ctx, "option-summary", option, optionPath);
      requireKeys(ctx, option, ["name", "valueName", "summary"], optionPath);
      nonEmptyString(ctx, option.name, `${optionPath}/name`);
      nonEmptyString(ctx, option.summary, `${optionPath}/summary`);
      if (option.valueName !== null)
        nonEmptyString(ctx, option.valueName, `${optionPath}/valueName`);
    });
  else ctx.c.fail("discovery-metadata", `${path}/options must be an array.`);
  return summaries(ctx, data.commands, `${path}/commands`);
}

export function validateDiscoveryData(
  ctx: ShapeContext,
  data: Json | undefined,
  envelopeVersion: string,
): CommandSummary[] | null {
  const path = "/result/data";
  ctx.c.touch("discovery-metadata", "root-routes");
  if (!isObject(data)) {
    ctx.c.fail("discovery-metadata", `${path} must be DiscoveryData.`);
    return null;
  }
  strictKeys(ctx, "discovery", data, path);
  requireKeys(
    ctx,
    data,
    [
      "contractVersion",
      "commands",
      "exitMeanings",
      "signalExits",
      "effectExclusions",
    ],
    path,
  );
  ctx.c.check(
    "version-copy",
    data.contractVersion === envelopeVersion,
    () =>
      `${path}/contractVersion must equal the envelope's ${envelopeVersion}.`,
  );
  fixedMap(ctx, data.exitMeanings, EXIT_MEANINGS, `${path}/exitMeanings`);
  fixedMap(ctx, data.signalExits, SIGNAL_EXITS, `${path}/signalExits`);
  ctx.c.check(
    "discovery-metadata",
    !has(data, "effectExclusions") ||
      (isStringArray(data.effectExclusions) &&
        data.effectExclusions.every(isNonEmptyString)),
    () => `${path}/effectExclusions must be an array of nonempty strings.`,
  );
  return summaries(ctx, data.commands, `${path}/commands`);
}

function validateRetryPolicy(
  ctx: ShapeContext,
  station: JsonObject,
  path: string,
): void {
  const policy = station.retryDelayPolicy;
  ctx.c.touch("retry-policy");
  if (
    !isObject(policy) ||
    !member(ctx, "retryPolicyKind", policy.kind, `${path}/kind`, "retry-policy")
  ) {
    if (!isObject(policy))
      ctx.c.fail("retry-policy", `${path} must be a retry delay policy.`);
    return;
  }
  if (policy.kind === "none") {
    strictKeys(ctx, "retry-policy.none", policy, path);
    ctx.c.check(
      "retry-policy",
      station.retryable === false,
      () => `${path} kind none requires retryable false.`,
    );
    return;
  }
  strictKeys(ctx, "retry-policy.bounded", policy, path);
  const { minimumMilliseconds: minimum, maximumMilliseconds: maximum } = policy;
  ctx.c.check(
    "retry-policy",
    station.retryable === true &&
      typeof minimum === "number" &&
      typeof maximum === "number" &&
      Number.isSafeInteger(minimum) &&
      Number.isSafeInteger(maximum) &&
      minimum >= 1 &&
      maximum >= minimum,
    () =>
      `${path} bounded requires retryable true and positive safe minimumMilliseconds and maximumMilliseconds, with maximumMilliseconds at least minimumMilliseconds.`,
  );
}

function validateTemplates(
  ctx: ShapeContext,
  station: JsonObject,
  path: string,
): void {
  ctx.c.touch("template-token", "binding-placement");
  for (const item of stationStrings(station)) {
    const where = `${path}${item.path}`;
    for (const token of unknownTokens(item.text))
      ctx.c.fail(
        "template-token",
        `${where} uses unknown template token ${token}.`,
      );
    if (item.slot === "command" || item.slot === "kind") {
      ctx.c.check(
        "binding-placement",
        !hasAnyBraceToken(item.text),
        () => `${where} is never a template slot.`,
      );
      continue;
    }
    const names = bindingNamesIn(item.text);
    if (names.length === 0) continue;
    const whole = item.slot === "args" || item.slot === "resource.id";
    ctx.c.check(
      "binding-placement",
      whole &&
        names.length === 1 &&
        item.text === `{binding.${names[0] ?? ""}}`,
      () =>
        `${where} (${item.slot}) may hold a binding only as a whole args element or the whole resource.id.`,
    );
  }
}

function validateGuidanceTemplate(
  ctx: ShapeContext,
  guidance: Json | undefined,
  path: string,
): void {
  if (guidance === undefined) return;
  if (!isObject(guidance)) {
    ctx.c.fail(
      "guidance-arm",
      `${path} must be strict { next } or { handoff }.`,
    );
    return;
  }
  if (
    !ctx.c.check(
      "guidance-arm",
      has(guidance, "next") !== has(guidance, "handoff"),
      () => `${path} must hold exactly one of next and handoff.`,
    )
  )
    return;
  if (has(guidance, "next")) {
    strictKeys(ctx, "guidance.next", guidance, path);
    validateStep(ctx, guidance.next, `${path}/next`, false);
    return;
  }
  strictKeys(ctx, "guidance.handoff", guidance, path);
  const handoff = guidance.handoff;
  if (
    !isObject(handoff) ||
    !Array.isArray(handoff.inspect) ||
    handoff.inspect.length === 0
  ) {
    ctx.c.fail(
      "handoff-shape",
      `${path}/handoff needs a nonempty inspect list.`,
    );
    return;
  }
  strictKeys(ctx, "handoff", handoff, `${path}/handoff`);
  member(ctx, "owner", handoff.owner, `${path}/handoff/owner`);
  handoff.inspect.forEach((entry, index) =>
    validateStep(ctx, entry, `${path}/handoff/inspect/${index}`, true),
  );
}

function validateReachability(
  ctx: ShapeContext,
  station: JsonObject,
  path: string,
): void {
  if (
    !member(ctx, "reachability", station.reachability, `${path}/reachability`)
  )
    return;
  const rationale = station.unreachableRationale;
  ctx.c.unproved(
    "unreachable-review",
    "Reachability is review-owned: shape never proves a station required or impossible (DISC-8, DISC-12).",
  );
  if (!has(station, "unreachableRationale")) return;
  if (station.reachability === "required")
    ctx.c.check(
      "unreachable-review",
      rationale === null,
      () => `${path}/unreachableRationale must be null for a required station.`,
    );
  else
    ctx.c.check(
      "unreachable-review",
      isNonEmptyString(rationale),
      () => `${path} declared-unreachable needs a reviewed rationale.`,
    );
}

function validateStation(
  ctx: ShapeContext,
  station: Json | undefined,
  path: string,
): JsonObject | null {
  if (!isObject(station)) {
    ctx.c.fail("discovery-metadata", `${path} must be a PublicStation.`);
    return null;
  }
  strictKeys(ctx, "station", station, path);
  requireKeys(
    ctx,
    station,
    [
      "commandIdentity",
      "outcome",
      "causeCode",
      "failureClass",
      "exitCode",
      "effectClass",
      "transactionState",
      "retryable",
      "retryDelayPolicy",
      "trigger",
      "guidance",
      "repairAction",
      "reachability",
      "unreachableRationale",
    ],
    path,
  );
  for (const key of ["commandIdentity", "causeCode", "trigger"])
    nonEmptyString(ctx, station[key], `${path}/${key}`);
  const enums =
    member(ctx, "outcome", station.outcome, `${path}/outcome`) &&
    member(ctx, "effectClass", station.effectClass, `${path}/effectClass`) &&
    member(
      ctx,
      "transactionState",
      station.transactionState,
      `${path}/transactionState`,
    ) &&
    member(ctx, "exitCode", station.exitCode, `${path}/exitCode`) &&
    (station.failureClass === null ||
      member(
        ctx,
        "failureClass",
        station.failureClass,
        `${path}/failureClass`,
      ));
  const guidance = isObject(station.guidance) ? station.guidance : {};
  const { outcome, transactionState, failureClass, exitCode, retryable } =
    station;
  if (
    enums &&
    typeof outcome === "string" &&
    typeof transactionState === "string" &&
    (failureClass === null || typeof failureClass === "string") &&
    typeof exitCode === "number" &&
    typeof retryable === "boolean"
  )
    for (const problem of rowProblems(
      {
        outcome,
        transactionState,
        failureClass,
        exitCode,
        retryable,
        arm: has(guidance, "next")
          ? "next"
          : has(guidance, "handoff")
            ? "handoff"
            : null,
      },
      typeof station.causeCode === "string" ? station.causeCode : "",
    ))
      ctx.c.fail("result-correlation", `${path}: ${problem}.`);
  ctx.c.check(
    "metadata-values",
    !has(station, "outcome") ||
      !has(station, "repairAction") ||
      (station.outcome === "success"
        ? station.repairAction === null
        : isNonEmptyString(station.repairAction)),
    () => `${path}/repairAction is null for success and a template otherwise.`,
  );
  validateRetryPolicy(ctx, station, `${path}/retryDelayPolicy`);
  validateGuidanceTemplate(ctx, station.guidance, `${path}/guidance`);
  validateTemplates(ctx, station, path);
  validateReachability(ctx, station, path);
  return station;
}

const FORBIDDEN_LITERAL = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;

function validateIfNoResult(
  ctx: ShapeContext,
  data: JsonObject,
  command: CommandSummary | null,
): JsonObject | null {
  const path = "/result/data/ifNoResult";
  if (!has(data, "ifNoResult")) return null;
  const step = data.ifNoResult;
  if (command !== null && command.effectClass === "inspect") {
    ctx.c.check(
      "lost-result-inspect",
      step === null,
      () => `${path} is null for an inspect command.`,
    );
    return null;
  }
  if (command === null) return isObject(step) ? step : null;
  if (
    !ctx.c.check(
      "lost-result-missing",
      step !== null,
      () => `${path} is null on changing command ${command.commandIdentity}.`,
    )
  )
    return null;
  if (!isObject(step) || step.kind !== "command") {
    ctx.c.fail("lost-result-target", `${path} must be a command step.`);
    return null;
  }
  strictKeys(ctx, "step.command", step, path);
  const args = step.args;
  ctx.c.check(
    "lost-result-literals",
    isStringArray(args) &&
      args.length <= 16 &&
      args.every(
        (arg) => !hasAnyBraceToken(arg) && !FORBIDDEN_LITERAL.test(arg),
      ) &&
      new TextEncoder().encode(
        JSON.stringify({ kind: step.kind, command: step.command, args }),
      ).length <= 2048,
    () =>
      `${path} args are at most 16 literal tokens with no brace token or Cc, Cf, Zl, Zp character, and the step is at most 2048 bytes.`,
  );
  return step;
}

/** Command-discovery data for one selected command. */
export function validateCommandDiscovery(
  ctx: ShapeContext,
  data: Json | undefined,
): CommandDescription | null {
  const path = "/result/data";
  if (!isObject(data)) {
    ctx.c.fail("discovery-metadata", `${path} must be CommandDiscoveryData.`);
    return null;
  }
  strictKeys(ctx, "command-discovery", data, path);
  requireKeys(
    ctx,
    data,
    ["command", "semantics", "ifNoResult", "input", "stations"],
    path,
  );
  member(ctx, "semantics", data.semantics, `${path}/semantics`);
  const command = validateSummary(ctx, data.command, `${path}/command`);
  const ifNoResult = validateIfNoResult(ctx, data, command);
  const input = validateInputSchema(ctx, data.input, `${path}/input`);
  const stationList = Array.isArray(data.stations)
    ? data.stations
        .map((station, index) =>
          validateStation(ctx, station, `${path}/stations/${index}`),
        )
        .filter((station): station is JsonObject => station !== null)
    : [];
  ctx.c.touch("station-duplicate");
  const tuples = stationList.map((station) =>
    JSON.stringify([
      station.commandIdentity,
      station.outcome,
      station.causeCode,
    ]),
  );
  ctx.c.check(
    "station-duplicate",
    new Set(tuples).size === tuples.length,
    () =>
      `${path}/stations repeats a (commandIdentity, outcome, causeCode) tuple: ${tuples.filter((tuple, index) => tuples.indexOf(tuple) !== index).join(" ")}.`,
  );
  if (command === null) return null;
  return { command, ifNoResult, input, stations: stationList };
}
