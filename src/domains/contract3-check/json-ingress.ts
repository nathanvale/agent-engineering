// Reader ingress for target machine output (WIRE-1, WIRE-4).
// Bytes become a JSON object or a framing finding. Values that JSON cannot
// carry faithfully (overflowed numbers, lone surrogates, excess depth) are
// json-values findings.

import type { Finding, Json, JsonObject } from "./types.ts";

export type Ingress =
  | { ok: true; value: JsonObject; findings: Finding[] }
  | { ok: false; findings: Finding[] };

function framing(message: string): Ingress {
  return { ok: false, findings: [{ ruleId: "json-framing", message }] };
}

function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasLoneSurrogate(text: string): boolean {
  return !text.isWellFormed();
}

/** Depth counts the envelope as level 0 and every nested value (B2). */
function valueFindings(root: Json, maxDepth: number): Finding[] {
  const findings: Finding[] = [];
  const pending: { value: Json; depth: number; path: string }[] = [
    { value: root, depth: 0, path: "" },
  ];
  while (pending.length > 0) {
    const item = pending.pop();
    if (item === undefined) break;
    const { value, depth, path } = item;
    if (depth > maxDepth) {
      findings.push({
        ruleId: "json-values",
        message: `Value at ${path || "/"} exceeds nesting depth ${maxDepth}.`,
      });
      continue;
    }
    if (typeof value === "number" && !Number.isFinite(value))
      findings.push({
        ruleId: "json-values",
        message: `Number at ${path} is not a finite JSON number.`,
      });
    if (typeof value === "string" && hasLoneSurrogate(value))
      findings.push({
        ruleId: "json-values",
        message: `String at ${path} holds a lone surrogate.`,
      });
    if (Array.isArray(value))
      value.forEach((child, index) =>
        pending.push({
          value: child,
          depth: depth + 1,
          path: `${path}/${index}`,
        }),
      );
    else if (isObject(value))
      for (const [key, child] of Object.entries(value)) {
        if (hasLoneSurrogate(key))
          findings.push({
            ruleId: "json-values",
            message: `Key under ${path || "/"} holds a lone surrogate.`,
          });
        pending.push({
          value: child,
          depth: depth + 1,
          path: `${path}/${key}`,
        });
      }
  }
  return findings;
}

export function readEnvelope(bytes: Uint8Array, maxDepth: number): Ingress {
  const text = decodeUtf8(bytes);
  if (text === null) return framing("Machine output is not valid UTF-8.");
  if (text.length === 0) return framing("Machine output is empty.");
  if (!text.endsWith("\n"))
    return framing("Machine output does not end with one newline.");
  const body = text.slice(0, -1);
  if (body.trim() !== body || body.length === 0)
    return framing(
      "Machine output has whitespace or lines outside the one JSON object.",
    );
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return framing(
      "Machine output is not exactly one JSON value (truncated, extra object or trailing text).",
    );
  }
  if (!isObject(parsed))
    return framing("Machine output root is not a JSON object.");
  return { ok: true, value: parsed, findings: valueFindings(parsed, maxDepth) };
}
