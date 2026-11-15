// Guidance templates and run values (STEP-9, STEP-9a, STEP-10, STEP-14).

import { isObject } from "./collector.ts";
import type { Json, JsonObject } from "./types.ts";

const FIXED_TOKENS = new Set([
  "runId",
  "completedEffects",
  "remainingEffects",
  "uncertainEffects",
  "idempotencyKey",
]);
const BINDING_TOKEN = /^binding\.([a-z][A-Za-z0-9]*)$/;
const ANY_TOKEN = /\{([^{}]*)\}/g;
const FORBIDDEN_CHARACTER = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
export const BINDING_NAME = /^[a-z][A-Za-z0-9]*$/;

/** Brace tokens that are neither a fixed substitution nor a valid binding. */
export function unknownTokens(text: string): string[] {
  const unknown: string[] = [];
  for (const match of text.matchAll(ANY_TOKEN)) {
    const inner = match[1] ?? "";
    if (!FIXED_TOKENS.has(inner) && !BINDING_TOKEN.test(inner))
      unknown.push(match[0]);
  }
  const rest = text.replace(ANY_TOKEN, "");
  if (rest.includes("{") || rest.includes("}")) unknown.push("unmatched brace");
  return unknown;
}

export function bindingNamesIn(text: string): string[] {
  const names: string[] = [];
  for (const match of text.matchAll(ANY_TOKEN)) {
    const binding = BINDING_TOKEN.exec(match[1] ?? "");
    if (binding?.[1] !== undefined) names.push(binding[1]);
  }
  return names;
}

export function hasAnyBraceToken(text: string): boolean {
  return /[{}]/.test(text);
}

/** STEP-10 value rule; null when the value is acceptable. */
export function bindingValueProblem(value: string): string | null {
  if (value.trim().length === 0) return "is empty or whitespace only";
  if (new TextEncoder().encode(value).length > 1024)
    return "exceeds 1024 UTF-8 bytes";
  if (FORBIDDEN_CHARACTER.test(value))
    return "holds a Cc, Cf, Zl or Zp character";
  if (value.startsWith("-")) return "begins with -";
  return null;
}

/** Where a template string sits inside station guidance (STEP-9a). */
export type Slot =
  | "repairAction"
  | "instruction.text"
  | "args"
  | "reason"
  | "resource.kind"
  | "resource.id"
  | "command"
  | "kind";

export interface TemplateString {
  slot: Slot;
  text: string;
  path: string;
}

function stepStrings(step: JsonObject, path: string): TemplateString[] {
  const strings: TemplateString[] = [];
  if (typeof step.kind === "string")
    strings.push({ slot: "kind", text: step.kind, path: `${path}/kind` });
  if (typeof step.command === "string")
    strings.push({
      slot: "command",
      text: step.command,
      path: `${path}/command`,
    });
  if (typeof step.text === "string")
    strings.push({
      slot: "instruction.text",
      text: step.text,
      path: `${path}/text`,
    });
  if (Array.isArray(step.args))
    step.args.forEach((arg, index) => {
      if (typeof arg === "string")
        strings.push({
          slot: "args",
          text: arg,
          path: `${path}/args/${index}`,
        });
    });
  return strings;
}

function handoffStrings(handoff: JsonObject, path: string): TemplateString[] {
  const strings: TemplateString[] = [];
  if (typeof handoff.reason === "string")
    strings.push({
      slot: "reason",
      text: handoff.reason,
      path: `${path}/reason`,
    });
  const resource = handoff.resource;
  if (isObject(resource)) {
    if (typeof resource.kind === "string")
      strings.push({
        slot: "resource.kind",
        text: resource.kind,
        path: `${path}/resource/kind`,
      });
    if (typeof resource.id === "string")
      strings.push({
        slot: "resource.id",
        text: resource.id,
        path: `${path}/resource/id`,
      });
  }
  if (Array.isArray(handoff.inspect))
    handoff.inspect.forEach((entry, index) => {
      if (isObject(entry))
        strings.push(...stepStrings(entry, `${path}/inspect/${index}`));
    });
  return strings;
}

/** Every template string a station declares, with its slot. */
export function stationStrings(station: JsonObject): TemplateString[] {
  const strings: TemplateString[] = [];
  if (typeof station.repairAction === "string")
    strings.push({
      slot: "repairAction",
      text: station.repairAction,
      path: "/repairAction",
    });
  const guidance = station.guidance;
  if (!isObject(guidance)) return strings;
  if (isObject(guidance.next))
    strings.push(...stepStrings(guidance.next, "/guidance/next"));
  if (isObject(guidance.handoff))
    strings.push(...handoffStrings(guidance.handoff, "/guidance/handoff"));
  return strings;
}

export function stationBindingNames(station: JsonObject): Set<string> {
  const names = new Set<string>();
  for (const item of stationStrings(station))
    for (const name of bindingNamesIn(item.text)) names.add(name);
  return names;
}

function canonicalArray(value: Json | undefined): string | null {
  return Array.isArray(value) ? JSON.stringify(value) : null;
}

type Substitution = (template: string) => string | null;

/** Render one template against a result's own fields and bindings. */
export function substitution(result: JsonObject): Substitution {
  const effects = isObject(result.effects) ? result.effects : {};
  const bindings = isObject(result.bindings) ? result.bindings : {};
  const fixed: Record<string, string | null> = {
    runId: typeof result.runId === "string" ? result.runId : null,
    completedEffects: canonicalArray(effects.completed),
    remainingEffects: canonicalArray(effects.remaining),
    uncertainEffects: canonicalArray(effects.uncertain),
    idempotencyKey:
      typeof result.idempotencyKey === "string" ? result.idempotencyKey : null,
  };
  return (template) => {
    let missing = false;
    const rendered = template.replace(ANY_TOKEN, (token, inner: string) => {
      const binding = BINDING_TOKEN.exec(inner)?.[1];
      const value =
        binding === undefined
          ? fixed[inner]
          : typeof bindings[binding] === "string"
            ? bindings[binding]
            : null;
      if (typeof value !== "string") {
        missing = true;
        return token;
      }
      return value;
    });
    return missing ? null : rendered;
  };
}

/** The declared guidance with every template string rendered, or null. */
export function renderGuidance(
  value: Json | undefined,
  render: Substitution,
  key = "",
): Json | undefined | null {
  if (typeof value === "string")
    return key === "command" || key === "kind" ? value : render(value);
  if (Array.isArray(value)) {
    const items = value.map((item) => renderGuidance(item, render));
    return items.some((item) => item === null || item === undefined)
      ? null
      : (items as Json[]);
  }
  if (isObject(value)) {
    const object: JsonObject = {};
    for (const [childKey, child] of Object.entries(value)) {
      const rendered = renderGuidance(child, render, childKey);
      if (rendered === null && child !== null) return null;
      if (rendered !== undefined) object[childKey] = rendered;
    }
    return object;
  }
  return value;
}

export function canonical(value: Json | undefined): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isObject(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  return value === undefined ? "undefined" : JSON.stringify(value);
}
