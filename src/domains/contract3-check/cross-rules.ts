// Rules that resolve one observation against others in the same admission:
// discovery agreement, station agreement, step resolution and input cases
// (V-11 to V-15, V-43, V-44, V-48, DISC-11 to DISC-13, STEP-6 to STEP-14).

import type { Book } from "./book.ts";
import { Collector, isObject } from "./collector.ts";
import {
  commandTokens,
  parseAgainstSchema,
  TEMPLATE_VALUE,
  type ParseResult,
} from "./input-grammar.ts";
import type { CommandDescription, CommandSummary } from "./navigation-data.ts";
import type { PatternMatcher } from "./pattern.ts";
import { COMMON_CAUSES } from "./result-table.ts";
import {
  canonical,
  renderGuidance,
  stationBindingNames,
  substitution,
} from "./templates.ts";
import type { AdmittedCase, Json, JsonObject, Observation } from "./types.ts";

export interface ParsedCase {
  item: AdmittedCase;
  observation: Observation;
  envelope: JsonObject | null;
  result: JsonObject | null;
  discovery: CommandSummary[] | null;
  help: CommandSummary[] | null;
  description: CommandDescription | null;
  /** Refused by its own observation (G2.3: never a source for other cases). */
  refused: boolean;
}

interface World {
  cli: string;
  cases: ParsedCase[];
  commands: Map<string, CommandSummary> | null;
  descriptions: Map<string, CommandDescription>;
  matcher: PatternMatcher;
  book: Book;
}

function show(value: Json | undefined): string {
  return typeof value === "string"
    ? value
    : (JSON.stringify(value) ?? "undefined");
}

const BUILT_INS: readonly [string, string[]][] = [
  ["help", ["--help"]],
  ["discovery", ["--discover"]],
  ["command-discovery", ["--discover-command"]],
  ["dispatch", []],
];

const INPUT_RULES = [
  "global-mode",
  "input-case",
  "input-required",
  "input-option",
  "input-presence",
  "input-repeat",
  "input-string",
  "input-integer",
  "input-constraints",
  "input-hidden",
  "input-dash",
  "input-deadline",
];

const EFFECT_RULES = [
  "navigation-effects",
  "input-future-binding",
  "input-generated-binding",
  "input-runtime",
];

function commandSteps(
  result: JsonObject,
): { step: JsonObject; inspection: boolean }[] {
  const steps: { step: JsonObject; inspection: boolean }[] = [];
  if (isObject(result.next) && result.next.kind === "command")
    steps.push({ step: result.next, inspection: false });
  const handoff = result.handoff;
  if (isObject(handoff) && Array.isArray(handoff.inspect))
    for (const entry of handoff.inspect)
      if (isObject(entry) && entry.kind === "command")
        steps.push({ step: entry, inspection: true });
  return steps;
}

function stationSteps(
  station: JsonObject,
): { step: JsonObject; inspection: boolean }[] {
  return isObject(station.guidance) ? commandSteps(station.guidance) : [];
}

function resolveSteps(
  world: World,
  c: Collector,
  steps: { step: JsonObject; inspection: boolean }[],
  where: string,
): void {
  const commands = world.commands;
  if (commands === null) return;
  for (const { step, inspection } of steps) {
    const target =
      typeof step.command === "string" ? commands.get(step.command) : undefined;
    if (inspection)
      c.check(
        "inspection-target",
        target?.effectClass === "inspect",
        () =>
          `${where}: inspection entry ${JSON.stringify(step.command)} must name a declared inspect command.`,
      );
    else
      c.check(
        "step-target",
        target !== undefined,
        () =>
          `${where}: next.command names ${JSON.stringify(step.command)}, which discovery does not declare.`,
      );
  }
}

async function stepArguments(
  world: World,
  c: Collector,
  steps: { step: JsonObject }[],
  where: string,
): Promise<void> {
  for (const { step } of steps) {
    const description =
      typeof step.command === "string"
        ? world.descriptions.get(step.command)
        : undefined;
    if (
      description?.input === null ||
      description === undefined ||
      !Array.isArray(step.args)
    )
      continue;
    const parsed = await parseAgainstSchema(
      description.input,
      step.args as string[],
      world.matcher,
    );
    if (parsed.kind === "budget")
      c.fail("pattern-budget", `${where}: ${parsed.reason}.`);
    else
      c.check(
        "step-arguments",
        parsed.kind === "accepted",
        () =>
          `${where}: step arguments for ${show(step.command)} fail its input schema (${parsed.kind === "refused" ? parsed.reason : ""}).`,
      );
  }
}

function stationFor(
  description: CommandDescription,
  result: JsonObject,
): JsonObject | undefined {
  return description.stations.find(
    (station) =>
      station.commandIdentity === result.commandIdentity &&
      station.outcome === result.outcome &&
      station.causeCode === result.causeCode,
  );
}

function compareGuidance(
  c: Collector,
  station: JsonObject,
  result: JsonObject,
  where: string,
): void {
  const render = substitution(result);
  const guidance = isObject(station.guidance) ? station.guidance : {};
  const arm = Object.hasOwn(guidance, "next") ? "next" : "handoff";
  const expected = renderGuidance(guidance[arm], render);
  const emitted = result[arm];
  const expectedArgs = isObject(expected) ? expected.args : undefined;
  const emittedArgs = isObject(emitted) ? emitted.args : undefined;
  if (Array.isArray(expectedArgs) && Array.isArray(emittedArgs))
    c.check(
      "token-argv",
      expectedArgs.length === emittedArgs.length,
      () =>
        `${where}: rendered args have ${emittedArgs.length} tokens; the template gives ${expectedArgs.length}. A value is one argv token.`,
    );
  c.check(
    "guidance-template",
    expected !== null && canonical(expected) === canonical(emitted),
    () =>
      `${where}: emitted ${arm} differs from the declared station template after substitution.`,
  );
  const repair =
    typeof station.repairAction === "string"
      ? render(station.repairAction)
      : null;
  c.check(
    "guidance-template",
    repair === result.repairAction,
    () => `${where}: repairAction differs from the declared station words.`,
  );
  const declared = stationBindingNames(station);
  const actual = isObject(result.bindings) ? Object.keys(result.bindings) : [];
  const present = Object.hasOwn(result, "bindings");
  if (present !== declared.size > 0)
    c.fail(
      "presence",
      `${where}: bindings is ${present ? "present although the station names no binding" : "absent although the station templates name a binding"}.`,
    );
  c.check(
    "binding-keys",
    actual.length === declared.size &&
      actual.every((name) => declared.has(name)),
    () =>
      `${where}: bindings must have exactly the names the station templates use (${[...declared].join(", ") || "none"}).`,
  );
}

function compareFixed(
  c: Collector,
  station: JsonObject,
  result: JsonObject,
  where: string,
): void {
  for (const key of [
    "effectClass",
    "transactionState",
    "failureClass",
    "exitCode",
    "retryable",
  ])
    c.check(
      "station-fixed",
      result[key] === station[key],
      () => `${where}: ${key} differs from the declared station.`,
    );
  const policy = station.retryDelayPolicy;
  const delay = result.retryDelayMilliseconds;
  if (
    isObject(policy) &&
    policy.kind === "bounded" &&
    typeof delay === "number"
  )
    c.check(
      "retry-delay",
      delay >= (policy.minimumMilliseconds as number) &&
        delay <= (policy.maximumMilliseconds as number),
      () =>
        `${where}: retryDelayMilliseconds ${delay} is outside the station bounds.`,
    );
}

function stationAgreement(
  world: World,
  c: Collector,
  parsed: ParsedCase,
  result: JsonObject,
): void {
  const identity =
    typeof result.commandIdentity === "string" ? result.commandIdentity : "";
  const description = world.descriptions.get(identity);
  if (description === undefined) {
    for (const ruleId of [
      "station-observed",
      "station-fixed",
      "guidance-template",
      "token-argv",
    ])
      world.book.unproved(
        parsed.item.caseId,
        ruleId,
        `No admitted, unrefused command-discovery case describes ${identity}.`,
      );
    return;
  }
  const where = `case ${parsed.item.caseId}`;
  const station = stationFor(description, result);
  if (
    !c.check(
      "station-observed",
      station !== undefined,
      () =>
        `${where}: emitted tuple (${identity}, ${show(result.outcome)}, ${show(result.causeCode)}) is not a declared station.`,
    ) ||
    station === undefined
  )
    return;
  world.book.unproved(
    parsed.item.caseId,
    "unreachable-review",
    "Reachability is review-owned: an observed declared station proves only that it was reached.",
  );
  c.check(
    "unreachable-review",
    station.reachability !== "declared-unreachable",
    () =>
      `${where}: station (${show(result.commandIdentity)}, ${show(result.outcome)}, ${show(result.causeCode)}) is declared unreachable but was observed.`,
  );
  compareFixed(c, station, result, where);
  compareGuidance(c, station, result, where);
}

function bindingRoute(
  world: World,
  c: Collector,
  result: JsonObject,
  where: string,
): void {
  if (world.commands === null || !isObject(result.bindings)) return;
  const routeTokens = new Set(
    [...world.commands.values()].flatMap((command) => command.route),
  );
  const names = new Map(
    Object.entries(result.bindings)
      .filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      )
      .map(([name, value]) => [value, name]),
  );
  const values = new Set(
    Object.values(result.bindings).filter(
      (value): value is string => typeof value === "string",
    ),
  );
  for (const { step } of commandSteps(result))
    for (const arg of Array.isArray(step.args) ? step.args : [])
      if (typeof arg === "string" && values.has(arg))
        c.check(
          "binding-route",
          !routeTokens.has(arg),
          () =>
            `${where}: binding ${names.get(arg) ?? "value"} renders ${JSON.stringify(arg)} into args, which equals a declared route token.`,
        );
}

async function judgeEnvelopeCase(
  world: World,
  parsed: ParsedCase,
): Promise<Collector> {
  const c = new Collector();
  const result = parsed.result;
  const where = `case ${parsed.item.caseId}`;
  if (parsed.envelope === null) return c;
  if (world.commands !== null) {
    const paths = parsed.envelope?.availablePaths;
    if (Array.isArray(paths))
      for (const path of paths)
        c.check(
          "available-target",
          typeof path === "string" && world.commands.has(path),
          () =>
            `${where}: availablePaths entry ${JSON.stringify(path)} is not a declared identity.`,
        );
  } else
    world.book.unproved(
      parsed.item.caseId,
      "available-target",
      "No admitted, unrefused discovery case lists the declared identities.",
    );
  if (result === null) return c;
  resolveSteps(world, c, commandSteps(result), where);
  await stepArguments(world, c, commandSteps(result), where);
  stationAgreement(world, c, parsed, result);
  bindingRoute(world, c, result, where);
  if (
    typeof result.causeCode === "string" &&
    COMMON_CAUSES[result.causeCode] !== undefined
  )
    world.book.unproved(
      parsed.item.caseId,
      "open-cause",
      "The observed cause is a common cause; no unknown host cause was exercised.",
    );
  return c;
}

function judgeDiscovery(
  world: World,
  c: Collector,
  summaries: CommandSummary[],
): void {
  for (const [suffix, route] of BUILT_INS) {
    const found = summaries.find(
      (item) => item.commandIdentity === `${world.cli}.${suffix}`,
    );
    c.check(
      "builtins",
      found !== undefined &&
        canonical(found.route) === canonical(route) &&
        found.effectClass === "inspect",
      () =>
        `Built-in ${world.cli}.${suffix} must be declared with route ${JSON.stringify(route)} and effect class inspect.`,
    );
  }
  const roots = summaries.filter(
    (item) =>
      item.route.length === 0 &&
      item.commandIdentity !== `${world.cli}.dispatch`,
  );
  c.check(
    "root-routes",
    roots.length <= 1,
    () => "Discovery admits more than one host root operation.",
  );
}

function judgeHelp(world: World, c: Collector, help: CommandSummary[]): void {
  if (world.commands === null) return;
  const builtIns = new Set(
    BUILT_INS.map(([suffix]) => `${world.cli}.${suffix}`),
  );
  const hosts = [...world.commands.values()].filter(
    (item) => !builtIns.has(item.commandIdentity),
  );
  const key = (items: CommandSummary[]) =>
    canonical(
      [...items].sort((a, b) =>
        a.commandIdentity < b.commandIdentity ? -1 : 1,
      ) as unknown as Json,
    );
  c.check(
    "help-discovery",
    key(help) === key(hosts),
    () =>
      "Help lists different host commands, routes or summaries than discovery.",
  );
}

function judgeSelection(
  world: World,
  c: Collector,
  parsed: ParsedCase,
  description: CommandDescription,
): void {
  const selected = parsed.item.selector ?? description.command.commandIdentity;
  c.check(
    "command-selection",
    description.command.commandIdentity === selected &&
      description.stations.every(
        (station) => station.commandIdentity === selected,
      ),
    () =>
      `Command discovery for ${selected} must describe only that command and its own stations.`,
  );
  if (world.commands !== null) {
    const ifNoResult = description.ifNoResult;
    if (ifNoResult !== null) {
      const target =
        typeof ifNoResult.command === "string"
          ? world.commands.get(ifNoResult.command)
          : undefined;
      c.check(
        "lost-result-target",
        target?.effectClass === "inspect",
        () =>
          `ifNoResult names ${JSON.stringify(ifNoResult.command)}, which is not a declared inspect command.`,
      );
    }
    description.stations.forEach((station, index) =>
      resolveSteps(world, c, stationSteps(station), `station ${index}`),
    );
  } else
    world.book.unproved(
      parsed.item.caseId,
      "lost-result-target",
      "No admitted, unrefused discovery case lists the declared commands.",
    );
  if (parsed.item.rules.includes("station-required")) {
    const observed = new Set(
      world.cases
        .filter((item) => item.result !== null)
        .map((item) =>
          JSON.stringify([
            item.result?.commandIdentity,
            item.result?.outcome,
            item.result?.causeCode,
          ]),
        ),
    );
    for (const station of description.stations)
      if (station.reachability === "required")
        c.check(
          "station-required",
          observed.has(
            JSON.stringify([
              station.commandIdentity,
              station.outcome,
              station.causeCode,
            ]),
          ),
          () =>
            `Required station (${show(station.commandIdentity)}, ${show(station.outcome)}, ${show(station.causeCode)}) was not reached by any admitted case.`,
        );
  }
  if (
    description.stations.some(
      (station) => station.reachability === "declared-unreachable",
    )
  )
    world.book.unproved(
      parsed.item.caseId,
      "unreachable-review",
      "A declared-unreachable rationale needs independent review; shape alone proves no impossibility.",
    );
}

async function judgeInput(
  world: World,
  c: Collector,
  parsed: ParsedCase,
): Promise<void> {
  const { item, result } = parsed;
  // The three-way argv agreement is judged only where an input rule is
  // admitted: an expected refusal may come from runtime or run-value checks
  // the projected schema cannot show (INPUT-4, STEP-10).
  const ruleIds = item.rules.filter((rule) => INPUT_RULES.includes(rule));
  const budgetOnly = item.rules.includes("pattern-budget");
  if (ruleIds.length === 0 && !budgetOnly) return;
  const identity =
    item.expect?.commandIdentity ??
    (typeof result?.commandIdentity === "string"
      ? result.commandIdentity
      : undefined);
  const description =
    identity === undefined ? undefined : world.descriptions.get(identity);
  if (
    item.target.kind !== "run" ||
    item.expect === undefined ||
    description?.input === null ||
    description === undefined
  ) {
    for (const ruleId of ruleIds)
      world.book.unproved(
        item.caseId,
        ruleId,
        "Needs a run case with an expected exit and an admitted command-discovery case for its command.",
      );
    return;
  }
  const argv = item.target.args.slice(item.target.argvOffset);
  const tokens = commandTokens(argv, description.command.route);
  const projection: ParseResult =
    tokens === null
      ? { kind: "refused", reason: "argv does not select the command's route" }
      : await parseAgainstSchema(description.input, tokens, world.matcher);
  if (
    description.input.arguments.some(
      (slot) => slot.value.kind === "string" && slot.value.pattern !== null,
    ) ||
    description.input.options.some(
      (slot) => slot.value?.kind === "string" && slot.value.pattern !== null,
    )
  )
    c.touch("pattern-budget");
  if (projection.kind === "budget") {
    c.fail("pattern-budget", `case ${item.caseId}: ${projection.reason}.`);
    return;
  }
  if (ruleIds.length === 0) return;
  if (projection.kind === "declaration") {
    for (const ruleId of ruleIds)
      c.fail(
        ruleId,
        `case ${item.caseId}: the command's declaration is invalid: ${projection.reason}.`,
      );
    return;
  }
  const expectedAccepted = item.expect.exitCode !== 2;
  const exit = parsed.observation.exit;
  const observedAccepted = !(
    exit !== null &&
    "code" in exit &&
    exit.code === 2
  );
  for (const ruleId of ruleIds) {
    c.check(
      ruleId,
      observedAccepted === expectedAccepted,
      () =>
        `case ${item.caseId}: the CLI ${observedAccepted ? "accepted" : "refused"} argv the independent case ${expectedAccepted ? "accepts" : "refuses"}.`,
    );
    c.check(
      ruleId,
      (projection.kind === "accepted") === expectedAccepted,
      () =>
        `case ${item.caseId}: the projected input schema ${projection.kind === "accepted" ? "accepts" : "refuses"} argv the independent case ${expectedAccepted ? "accepts" : "refuses"}.`,
    );
  }
}

function strip(value: Json | undefined, pointers: string[]): Json | undefined {
  if (!isObject(value)) return value;
  const copy = structuredClone(value);
  for (const pointer of ["/result/runId", ...pointers]) {
    const parts = pointer
      .split("/")
      .slice(1)
      .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
    let node: Json | undefined = copy;
    for (const part of parts.slice(0, -1))
      node = isObject(node) ? node[part] : undefined;
    const last = parts.at(-1);
    if (isObject(node) && last !== undefined) delete node[last];
  }
  return copy;
}

/** JSON Pointers where two values differ, for a bounded message. */
function differences(
  left: Json | undefined,
  right: Json | undefined,
  path: string,
): string[] {
  if (isObject(left) && isObject(right))
    return [...new Set([...Object.keys(left), ...Object.keys(right)])].flatMap(
      (key) => differences(left[key], right[key], `${path}/${key}`),
    );
  return canonical(left) === canonical(right) ? [] : [path || "/"];
}

function judgeDeterministic(
  world: World,
  c: Collector,
  parsed: ParsedCase,
): void {
  const twin = world.cases.find(
    (item) => item.item.caseId === parsed.item.sameAs,
  );
  if (twin === undefined) return;
  const differing = differences(
    strip(parsed.envelope ?? undefined, parsed.item.normalize),
    strip(twin.envelope ?? undefined, parsed.item.normalize),
    "",
  );
  if (canonical(parsed.observation.exit) !== canonical(twin.observation.exit))
    differing.push("process exit");
  c.check(
    "deterministic-fields",
    differing.length === 0,
    () =>
      `case ${parsed.item.caseId}: deterministic output differs from ${twin.item.caseId} at ${differing.slice(0, 6).join(", ")}; only run identity and declared time fields may differ.`,
  );
}

const PROBE_REQUIRED = [...EFFECT_RULES, "provider-loading"];

/**
 * Binder G15 and G9: a probe-judged row passes only when the observed exit
 * agrees with expect and the probe exits 0, writes no stderr and prints
 * exactly expectedStdout. Effect rules never pass without a probe.
 */
function judgeProbe(world: World, c: Collector, parsed: ParsedCase): void {
  const { item, observation } = parsed;
  const probe = observation.probe;
  if (item.probe === undefined || probe === undefined) {
    for (const ruleId of item.rules.filter((rule) =>
      PROBE_REQUIRED.includes(rule),
    ))
      world.book.unproved(
        item.caseId,
        ruleId,
        "No admitted read-only probe observed the target's effects.",
      );
    return;
  }
  const ruleIds = item.rules.filter(
    (rule) => PROBE_REQUIRED.includes(rule) || INPUT_RULES.includes(rule),
  );
  if (probe.timedOut) {
    for (const ruleId of ruleIds)
      world.book.override(
        item.caseId,
        ruleId,
        "timed_out",
        "The probe exceeded its run budget and was terminated.",
      );
    return;
  }
  const exit = probe.exit;
  if (
    !probe.started ||
    exit === null ||
    !("code" in exit) ||
    exit.code !== 0 ||
    probe.stderr.bytes.length > 0
  ) {
    for (const ruleId of ruleIds)
      world.book.override(
        item.caseId,
        ruleId,
        "not_run",
        "The probe did not start, exited nonzero or wrote stderr; it observed nothing trustworthy.",
      );
    return;
  }
  const text = new TextDecoder().decode(probe.stdout.bytes);
  const expected = item.probe.expectedStdout;
  const targetExit = observation.exit;
  const exitAgrees =
    item.expect === undefined ||
    (targetExit !== null &&
      "code" in targetExit &&
      targetExit.code === item.expect.exitCode);
  for (const ruleId of ruleIds) {
    c.check(
      ruleId,
      text === expected,
      () =>
        `case ${item.caseId}: the independent probe observed ${JSON.stringify(text.slice(0, 64))}, expected ${JSON.stringify(expected.slice(0, 64))}.`,
    );
    c.check(
      ruleId,
      exitAgrees,
      () =>
        `case ${item.caseId}: the target's real exit differs from the expected exit.`,
    );
  }
}

/** The selector of a command-discovery case: admitted, or the argv token after --discover-command. */
function selectorOf(item: AdmittedCase): string | undefined {
  if (item.selector !== undefined) return item.selector;
  if (item.target.kind !== "run") return undefined;
  const argv = item.target.args.slice(item.target.argvOffset);
  const at = argv.indexOf("--discover-command");
  return at < 0 ? undefined : argv[at + 1];
}

/** DISC-5: each built-in answers --discover-command with its own success. */
function judgeBuiltinSelection(
  world: World,
  c: Collector,
  parsed: ParsedCase,
): void {
  const selector = selectorOf(parsed.item);
  const builtIns = BUILT_INS.map(([suffix]) => `${world.cli}.${suffix}`);
  if (
    selector === undefined ||
    !builtIns.includes(selector) ||
    parsed.result === null
  )
    return;
  c.check(
    "builtins",
    parsed.result.outcome === "success" &&
      parsed.description?.command.commandIdentity === selector,
    () =>
      `Built-in ${selector} must be command-discoverable with its own stations.`,
  );
}

/**
 * F01 (reject at declaration): a station's command-step args, with every
 * template token standing for any valid run value, must satisfy the target
 * command's input schema.
 */
async function templateArguments(
  world: World,
  c: Collector,
  description: CommandDescription,
): Promise<void> {
  for (const [index, station] of description.stations.entries())
    for (const { step } of stationSteps(station)) {
      const target =
        typeof step.command === "string"
          ? world.descriptions.get(step.command)
          : undefined;
      if (target?.input == null || !Array.isArray(step.args)) continue;
      const args = step.args.map((arg) =>
        typeof arg !== "string"
          ? JSON.stringify(arg)
          : /[{}]/.test(arg)
            ? TEMPLATE_VALUE
            : arg,
      );
      const parsed = await parseAgainstSchema(
        target.input,
        args,
        world.matcher,
      );
      c.check(
        "step-arguments",
        parsed.kind === "accepted",
        () =>
          `station ${index}: declared args for ${show(step.command)} cannot satisfy its input schema for any run value (${"reason" in parsed ? parsed.reason : ""}).`,
      );
    }
}

/** All cross-observation rules; one collector per case. */
export async function judgeAcrossCases(
  cli: string,
  cases: ParsedCase[],
  matcher: PatternMatcher,
  book: Book,
): Promise<Map<string, Collector>> {
  const sources = cases.filter((item) => !item.refused);
  const discovery =
    sources.find((item) => item.discovery !== null)?.discovery ?? null;
  const descriptions = new Map<string, CommandDescription>();
  for (const parsed of sources)
    if (parsed.description !== null)
      descriptions.set(
        parsed.description.command.commandIdentity,
        parsed.description,
      );
  const world: World = {
    cli,
    cases,
    commands:
      discovery === null
        ? null
        : new Map(discovery.map((item) => [item.commandIdentity, item])),
    descriptions,
    matcher,
    book,
  };
  const collectors = new Map<string, Collector>();
  for (const parsed of cases) {
    const c = await judgeEnvelopeCase(world, parsed);
    if (parsed.discovery !== null) judgeDiscovery(world, c, parsed.discovery);
    if (parsed.help !== null) judgeHelp(world, c, parsed.help);
    if (parsed.description !== null) {
      judgeSelection(world, c, parsed, parsed.description);
      await templateArguments(world, c, parsed.description);
    }
    if (parsed.item.role === "command-discovery")
      judgeBuiltinSelection(world, c, parsed);
    if (parsed.item.role === "command") await judgeInput(world, c, parsed);
    if (parsed.item.sameAs !== undefined) judgeDeterministic(world, c, parsed);
    judgeProbe(world, c, parsed);
    collectors.set(parsed.item.caseId, c);
  }
  return collectors;
}
