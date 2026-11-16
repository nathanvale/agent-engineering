// Records which rules a validation exercised and what each found.
// A rule is failed when it has findings, passed when it was exercised with
// none, and otherwise unproved for that observation.

import { BUDGETS } from "./budgets.ts";
import type { MinorTable, ObjectKind, UnionKind } from "./minors.ts";
import type { Finding, Json, JsonObject } from "./types.ts";

export function boundText(text: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  if (encoder.encode(text).length <= maxBytes) return text;
  let result = "";
  for (const char of text) {
    if (encoder.encode(`${result}${char}...`).length > maxBytes) break;
    result += char;
  }
  return `${result}...`;
}

export class Collector {
  readonly findings: Finding[] = [];
  readonly exercised = new Set<string>();
  /** Rules this observation cannot prove, with the reason. */
  readonly unprovable = new Map<string, string>();

  unproved(ruleId: string, reason: string): void {
    if (!this.unprovable.has(ruleId)) this.unprovable.set(ruleId, reason);
  }

  touch(...ruleIds: string[]): void {
    for (const ruleId of ruleIds) this.exercised.add(ruleId);
  }

  fail(ruleId: string, message: string): void {
    this.exercised.add(ruleId);
    this.findings.push({
      ruleId,
      message: boundText(message, BUDGETS.FINDING_MESSAGE_MAX_BYTES),
    });
  }

  check(ruleId: string, holds: boolean, message: () => string): boolean {
    this.exercised.add(ruleId);
    if (!holds) this.fail(ruleId, message());
    return holds;
  }
}

export interface ShapeContext {
  c: Collector;
  minors: MinorTable;
  declaredMinor: number;
}

export function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isNonEmptyString(value: Json | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isNonNegativeSafeInteger(
  value: Json | undefined,
): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function isStringArray(value: Json | undefined): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

export function has(object: JsonObject, key: string): boolean {
  return Object.hasOwn(object, key);
}

/** Unknown keys are strict-keys; keys of a later minor are declared-minor-shape. */
export function strictKeys(
  ctx: ShapeContext,
  kind: ObjectKind,
  object: JsonObject,
  path: string,
): void {
  ctx.c.touch("strict-keys", "declared-minor-shape");
  for (const key of Object.keys(object)) {
    const membership = ctx.minors.keyMembership(kind, key, ctx.declaredMinor);
    if (membership === "later-minor")
      ctx.c.fail(
        "declared-minor-shape",
        `${path}/${key} is not listed at declared minor 3.${ctx.declaredMinor}.0; remove it or declare the minor that lists it.`,
      );
    else if (membership === "unknown")
      ctx.c.fail(
        "strict-keys",
        `Unlisted key ${path}/${key}; remove that key.`,
      );
  }
}

/** A closed union member; unknown members fail ruleId. */
export function member(
  ctx: ShapeContext,
  kind: UnionKind,
  value: Json | undefined,
  path: string,
  ruleId = "closed-union",
): boolean {
  ctx.c.touch(ruleId);
  // An absent key is presence's finding alone (binder footprints).
  if (value === undefined) return false;
  if (typeof value !== "string" && typeof value !== "number") {
    ctx.c.fail(ruleId, `${path} is not a member of the closed ${kind} union.`);
    return false;
  }
  const membership = ctx.minors.memberMembership(
    kind,
    value,
    ctx.declaredMinor,
  );
  if (membership === "known") return true;
  if (membership === "later-minor")
    ctx.c.fail(
      "declared-minor-shape",
      `${path} member ${JSON.stringify(value)} is not listed at declared minor 3.${ctx.declaredMinor}.0.`,
    );
  else
    ctx.c.fail(
      ruleId,
      `${path} has unknown ${kind} member ${JSON.stringify(value)}.`,
    );
  return false;
}

export function requireKeys(
  ctx: ShapeContext,
  object: JsonObject,
  keys: readonly string[],
  path: string,
  ruleId = "presence",
): void {
  ctx.c.touch(ruleId);
  for (const key of keys)
    if (!has(object, key))
      ctx.c.fail(ruleId, `Required key ${path}/${key} is missing.`);
}

/** Optional and conditional keys are absent, never null (WIRE-2). */
export function notNull(
  ctx: ShapeContext,
  object: JsonObject,
  keys: readonly string[],
  path: string,
): void {
  ctx.c.touch("presence");
  for (const key of keys)
    if (has(object, key) && object[key] === null)
      ctx.c.fail(
        "presence",
        `Optional key ${path}/${key} is null; omit it instead.`,
      );
}

export function nonEmptyString(
  ctx: ShapeContext,
  value: Json | undefined,
  path: string,
  ruleId = "metadata-values",
): boolean {
  if (value === undefined) {
    ctx.c.touch(ruleId);
    return false;
  }
  return ctx.c.check(
    ruleId,
    isNonEmptyString(value),
    () => `${path} must be a string that is nonempty after trimming.`,
  );
}
