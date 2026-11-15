// Input schemas (INPUT-2 to INPUT-4): the declaration rules a command's
// projected InputSchema must meet, and the checker's own independent argv
// parser for that projection. The parser is the checker's reading of the
// contract text, never the target's parser.

import {
  isNonEmptyString,
  isNonNegativeSafeInteger,
  isObject,
  member,
  requireKeys,
  strictKeys,
  type ShapeContext,
} from "./collector.ts";
import {
  patternSyntaxProblem,
  patternTooLarge,
  type PatternMatcher,
} from "./pattern.ts";
import type { Json } from "./types.ts";

type ValueSpec =
  | {
      kind: "string";
      minLength: number;
      maxLength: number;
      choices: string[] | null;
      pattern: string | null;
    }
  | { kind: "integer"; minimum: number; maximum: number };

interface ArgumentSpec {
  name: string;
  required: boolean;
  value: ValueSpec;
}

interface OptionSpec {
  name: string;
  aliases: string[];
  required: boolean;
  repeatable: boolean;
  value: ValueSpec | null;
}

type ConstraintSpec =
  | { kind: "requires"; ifPresent: string; thenPresent: string }
  | { kind: "exclusive"; members: string[] };

export interface InputSpec {
  arguments: ArgumentSpec[];
  options: OptionSpec[];
  constraints: ConstraintSpec[];
  deadlineSupported: boolean;
}

const GLOBAL_TOKENS = ["--json", "--help", "--discover", "--discover-command"];
const INTEGER_TOKEN = /^-?(0|[1-9][0-9]*)$/;
const POSITIVE_TOKEN = /^[1-9][0-9]*$/;

function codePoints(value: string): number {
  return [...value].length;
}

function fail(ctx: ShapeContext, message: string): void {
  ctx.c.fail("input-schema", message);
}

function validateValue(
  ctx: ShapeContext,
  value: Json | undefined,
  path: string,
): ValueSpec | null {
  if (!isObject(value)) {
    fail(ctx, `${path} must be a value schema object.`);
    return null;
  }
  if (!member(ctx, "valueKind", value.kind, `${path}/kind`)) return null;
  if (value.kind === "integer") {
    strictKeys(ctx, "value.integer", value, path);
    const { minimum, maximum } = value;
    if (
      !Number.isSafeInteger(minimum) ||
      !Number.isSafeInteger(maximum) ||
      (maximum as number) < (minimum as number)
    ) {
      fail(
        ctx,
        `${path} integer bounds must be safe integers with maximum at least minimum.`,
      );
      return null;
    }
    return {
      kind: "integer",
      minimum: minimum as number,
      maximum: maximum as number,
    };
  }
  strictKeys(ctx, "value.string", value, path);
  requireKeys(
    ctx,
    value,
    ["minLength", "maxLength", "choices", "pattern"],
    path,
    "input-schema",
  );
  const { minLength, maxLength, choices, pattern } = value;
  if (
    !isNonNegativeSafeInteger(minLength) ||
    !isNonNegativeSafeInteger(maxLength) ||
    maxLength < minLength
  ) {
    fail(
      ctx,
      `${path} string bounds must be nonnegative safe integers with maxLength at least minLength.`,
    );
    return null;
  }
  let choiceList: string[] | null = null;
  if (choices !== null) {
    const valid =
      Array.isArray(choices) &&
      choices.length > 0 &&
      choices.every(
        (choice) =>
          typeof choice === "string" &&
          codePoints(choice) >= minLength &&
          codePoints(choice) <= maxLength,
      ) &&
      new Set(choices).size === choices.length;
    if (!valid) {
      fail(
        ctx,
        `${path}/choices must be null or a nonempty unique list of strings within the bounds.`,
      );
      return null;
    }
    choiceList = choices as string[];
  }
  let source: string | null = null;
  if (pattern !== null) {
    if (typeof pattern !== "string") {
      ctx.c.fail("pattern-syntax", `${path}/pattern must be null or a string.`);
      return null;
    }
    ctx.c.touch("pattern-syntax", "pattern-budget");
    if (patternTooLarge(pattern)) {
      ctx.c.fail(
        "pattern-budget",
        `${path}/pattern exceeds the reader's pattern-size budget.`,
      );
      return null;
    }
    const problem = patternSyntaxProblem(pattern);
    if (problem !== null) {
      ctx.c.fail(
        "pattern-syntax",
        `${path}/pattern is not a valid Unicode regular expression.`,
      );
      return null;
    }
    source = pattern;
  }
  return {
    kind: "string",
    minLength,
    maxLength,
    choices: choiceList,
    pattern: source,
  };
}

function validateArgument(
  ctx: ShapeContext,
  item: Json | undefined,
  path: string,
): ArgumentSpec | null {
  if (!isObject(item)) {
    fail(ctx, `${path} must be an object.`);
    return null;
  }
  strictKeys(ctx, "input.argument", item, path);
  requireKeys(
    ctx,
    item,
    ["name", "summary", "required", "value"],
    path,
    "input-schema",
  );
  const value = validateValue(ctx, item.value, `${path}/value`);
  if (
    !isNonEmptyString(item.name) ||
    !isNonEmptyString(item.summary) ||
    typeof item.required !== "boolean" ||
    value === null
  ) {
    fail(
      ctx,
      `${path} needs a name, a summary, a boolean required and a value schema.`,
    );
    return null;
  }
  return { name: item.name, required: item.required, value };
}

function optionToken(token: Json | undefined, long: boolean): token is string {
  if (typeof token !== "string" || token.includes("=")) return false;
  return long
    ? token.startsWith("--") && token.length > 2
    : token.startsWith("-") && token.length > 1;
}

function validateOption(
  ctx: ShapeContext,
  item: Json | undefined,
  path: string,
): OptionSpec | null {
  if (!isObject(item)) {
    fail(ctx, `${path} must be an object.`);
    return null;
  }
  strictKeys(ctx, "input.option", item, path);
  requireKeys(
    ctx,
    item,
    ["name", "aliases", "summary", "required", "repeatable", "value"],
    path,
    "input-schema",
  );
  const value =
    item.value === null
      ? null
      : validateValue(ctx, item.value, `${path}/value`);
  const aliases = item.aliases;
  if (
    !optionToken(item.name, true) ||
    !Array.isArray(aliases) ||
    !aliases.every((alias) => optionToken(alias, false)) ||
    !isNonEmptyString(item.summary) ||
    typeof item.required !== "boolean" ||
    typeof item.repeatable !== "boolean" ||
    (item.value !== null && value === null)
  ) {
    fail(
      ctx,
      `${path} needs a --long-name, option-token aliases, a summary, boolean required and repeatable, and a value schema or null.`,
    );
    return null;
  }
  if (item.value === null && item.repeatable)
    ctx.c.fail(
      "input-presence",
      `${path} is a presence flag and cannot be repeatable.`,
    );
  return {
    name: item.name,
    aliases,
    required: item.required,
    repeatable: item.repeatable,
    value,
  };
}

function validateConstraint(
  ctx: ShapeContext,
  item: Json | undefined,
  path: string,
  slots: Set<string>,
): ConstraintSpec | null {
  if (
    !isObject(item) ||
    !member(ctx, "constraintKind", item.kind, `${path}/kind`)
  )
    return null;
  if (item.kind === "requires") {
    strictKeys(ctx, "constraint.requires", item, path);
    const { ifPresent, thenPresent } = item;
    if (
      typeof ifPresent !== "string" ||
      typeof thenPresent !== "string" ||
      !slots.has(ifPresent) ||
      !slots.has(thenPresent) ||
      ifPresent === thenPresent
    ) {
      fail(ctx, `${path} must name two distinct declared slots.`);
      return null;
    }
    return { kind: "requires", ifPresent, thenPresent };
  }
  strictKeys(ctx, "constraint.exclusive", item, path);
  const members = item.members;
  if (
    !Array.isArray(members) ||
    members.length < 2 ||
    !members.every((name) => typeof name === "string" && slots.has(name)) ||
    new Set(members).size !== members.length
  ) {
    fail(
      ctx,
      `${path}/members must name at least two distinct declared slots.`,
    );
    return null;
  }
  return { kind: "exclusive", members: members as string[] };
}

function checkUniqueness(
  ctx: ShapeContext,
  spec: InputSpec,
  path: string,
): void {
  const seen = new Set<string>();
  const tokens = [
    ...spec.arguments.map((argument) => argument.name),
    ...spec.options.flatMap((option) => [option.name, ...option.aliases]),
  ];
  for (const token of tokens) {
    if (seen.has(token))
      fail(ctx, `${path} declares ${JSON.stringify(token)} more than once.`);
    seen.add(token);
  }
  const reserved = spec.deadlineSupported
    ? [...GLOBAL_TOKENS, "--deadline-ms"]
    : GLOBAL_TOKENS;
  for (const option of spec.options)
    for (const token of [option.name, ...option.aliases])
      if (reserved.includes(token))
        fail(ctx, `${path} option ${token} shadows a global switch.`);
  const firstOptional = spec.arguments.findIndex(
    (argument) => !argument.required,
  );
  if (
    firstOptional >= 0 &&
    spec.arguments.slice(firstOptional).some((argument) => argument.required)
  )
    fail(ctx, `${path} declares a required argument after an optional one.`);
}

function checkSatisfiable(
  ctx: ShapeContext,
  spec: InputSpec,
  path: string,
): void {
  const required = new Set([
    ...spec.arguments.filter((item) => item.required).map((item) => item.name),
    ...spec.options.filter((item) => item.required).map((item) => item.name),
  ]);
  const exclusivePairs = spec.constraints.flatMap((constraint) =>
    constraint.kind === "exclusive"
      ? constraint.members.flatMap((left) =>
          constraint.members
            .filter((right) => right !== left)
            .map((right) => [left, right] as const),
        )
      : [],
  );
  const forced = new Set(required);
  for (const constraint of spec.constraints)
    if (constraint.kind === "requires" && forced.has(constraint.ifPresent))
      forced.add(constraint.thenPresent);
  if (
    exclusivePairs.some(
      ([left, right]) => forced.has(left) && forced.has(right),
    )
  )
    fail(
      ctx,
      `${path} admits no satisfiable combination of required slots and constraints.`,
    );
}

/** input-schema and pattern rules; returns the usable spec or null. */
export function validateInputSchema(
  ctx: ShapeContext,
  input: Json | undefined,
  path: string,
): InputSpec | null {
  ctx.c.touch("input-schema");
  if (!isObject(input)) {
    fail(ctx, `${path} must be an InputSchema object.`);
    return null;
  }
  strictKeys(ctx, "input", input, path);
  requireKeys(
    ctx,
    input,
    [
      "arguments",
      "options",
      "constraints",
      "deadlineSupported",
      "additionalArguments",
      "additionalOptions",
    ],
    path,
    "input-schema",
  );
  if (input.additionalArguments !== false || input.additionalOptions !== false)
    fail(
      ctx,
      `${path} additionalArguments and additionalOptions must be false.`,
    );
  const argumentsList = Array.isArray(input.arguments)
    ? input.arguments.map((item, index) =>
        validateArgument(ctx, item, `${path}/arguments/${index}`),
      )
    : [null];
  const options = Array.isArray(input.options)
    ? input.options.map((item, index) =>
        validateOption(ctx, item, `${path}/options/${index}`),
      )
    : [null];
  if (
    typeof input.deadlineSupported !== "boolean" ||
    argumentsList.includes(null) ||
    options.includes(null) ||
    !Array.isArray(input.constraints)
  ) {
    fail(
      ctx,
      `${path} has an invalid argument, option, constraint list or deadlineSupported.`,
    );
    return null;
  }
  const partial = {
    arguments: argumentsList as ArgumentSpec[],
    options: options as OptionSpec[],
    deadlineSupported: input.deadlineSupported,
  };
  const slots = new Set([
    ...partial.arguments.map((item) => item.name),
    ...partial.options.map((item) => item.name),
  ]);
  const constraints = input.constraints.map((item, index) =>
    validateConstraint(ctx, item, `${path}/constraints/${index}`, slots),
  );
  if (constraints.includes(null)) return null;
  const spec: InputSpec = {
    ...partial,
    constraints: constraints as ConstraintSpec[],
  };
  checkUniqueness(ctx, spec, path);
  checkSatisfiable(ctx, spec, path);
  return spec;
}

export type ParseResult =
  | { kind: "accepted" }
  | { kind: "refused"; reason: string }
  | { kind: "budget"; reason: string };

const ACCEPTED: ParseResult = { kind: "accepted" };

async function valueProblem(
  value: ValueSpec,
  token: string,
  matcher: PatternMatcher,
): Promise<ParseResult> {
  if (value.kind === "integer") {
    const number = Number(token);
    return INTEGER_TOKEN.test(token) &&
      Number.isSafeInteger(number) &&
      number >= value.minimum &&
      number <= value.maximum
      ? ACCEPTED
      : {
          kind: "refused",
          reason: `integer token ${JSON.stringify(token)} is outside the declared grammar or bounds`,
        };
  }
  const length = codePoints(token);
  if (length < value.minLength || length > value.maxLength)
    return {
      kind: "refused",
      reason: "string length is outside the declared bounds",
    };
  if (value.choices !== null && !value.choices.includes(token))
    return { kind: "refused", reason: "value is not a declared choice" };
  if (value.pattern === null) return ACCEPTED;
  const matched = await matcher.match(value.pattern, token);
  if (matched === "budget")
    return {
      kind: "budget",
      reason: "pattern match exceeded the reader's finite budget",
    };
  return matched === "match"
    ? ACCEPTED
    : { kind: "refused", reason: "value does not match the declared pattern" };
}

interface ParseState {
  counts: Map<string, number>;
  position: number;
}

function constraintProblem(
  spec: InputSpec,
  counts: Map<string, number>,
): string | null {
  const present = (name: string) => (counts.get(name) ?? 0) > 0;
  for (const slot of [...spec.arguments, ...spec.options])
    if (slot.required && !present(slot.name))
      return `required slot ${slot.name} is missing`;
  for (const constraint of spec.constraints) {
    if (
      constraint.kind === "requires" &&
      present(constraint.ifPresent) &&
      !present(constraint.thenPresent)
    )
      return `${constraint.ifPresent} requires ${constraint.thenPresent}`;
    if (
      constraint.kind === "exclusive" &&
      constraint.members.filter(present).length > 1
    )
      return `${constraint.members.join(", ")} are exclusive`;
  }
  return null;
}

async function optionStep(
  spec: InputSpec,
  tokens: string[],
  index: number,
  state: ParseState,
  matcher: PatternMatcher,
): Promise<[ParseResult, number]> {
  const token = tokens[index] ?? "";
  if (spec.deadlineSupported && token === "--deadline-ms") {
    const value = tokens[index + 1];
    const count = (state.counts.get(token) ?? 0) + 1;
    state.counts.set(token, count);
    const valid =
      value !== undefined &&
      POSITIVE_TOKEN.test(value) &&
      Number.isSafeInteger(Number(value)) &&
      count === 1;
    return [
      valid
        ? ACCEPTED
        : {
            kind: "refused",
            reason: "--deadline-ms needs one positive integer",
          },
      index + 2,
    ];
  }
  const option = spec.options.find(
    (candidate) =>
      candidate.name === token || candidate.aliases.includes(token),
  );
  if (option === undefined)
    return [
      {
        kind: "refused",
        reason: `unknown option token ${JSON.stringify(token)}`,
      },
      index + 1,
    ];
  const count = (state.counts.get(option.name) ?? 0) + 1;
  state.counts.set(option.name, count);
  if (option.value === null)
    return [
      count > 1
        ? { kind: "refused", reason: `presence flag ${option.name} repeated` }
        : ACCEPTED,
      index + 1,
    ];
  if (count > 1 && !option.repeatable)
    return [
      { kind: "refused", reason: `option ${option.name} repeated` },
      index + 1,
    ];
  const value = tokens[index + 1];
  if (value === undefined)
    return [
      { kind: "refused", reason: `option ${option.name} is missing its value` },
      index + 1,
    ];
  return [await valueProblem(option.value, value, matcher), index + 2];
}

/** Parse the command's own argv (after its route, global --json removed). */
export async function parseAgainstSchema(
  spec: InputSpec,
  tokens: string[],
  matcher: PatternMatcher,
): Promise<ParseResult> {
  const state: ParseState = { counts: new Map(), position: 0 };
  let afterDelimiter = false;
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index] ?? "";
    if (!afterDelimiter && token === "--") {
      afterDelimiter = true;
      index += 1;
      continue;
    }
    let result: ParseResult;
    if (!afterDelimiter && token.startsWith("-"))
      [result, index] = await optionStep(spec, tokens, index, state, matcher);
    else {
      const argument = spec.arguments[state.position];
      state.position += 1;
      index += 1;
      if (argument === undefined)
        return { kind: "refused", reason: "extra operand" };
      state.counts.set(argument.name, 1);
      result = await valueProblem(argument.value, token, matcher);
    }
    if (result.kind !== "accepted") return result;
  }
  const problem = constraintProblem(spec, state.counts);
  return problem === null ? ACCEPTED : { kind: "refused", reason: problem };
}

/** Split CLI argv into route-relative tokens with the global --json removed. */
export function commandTokens(
  argv: readonly string[],
  route: readonly string[],
): string[] | null {
  const delimiter = argv.indexOf("--");
  const tokens = argv.filter(
    (token, index) =>
      token !== "--json" || (delimiter >= 0 && index > delimiter),
  );
  if (route.some((token, index) => tokens[index] !== token)) return null;
  return tokens.slice(route.length);
}
