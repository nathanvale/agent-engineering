// Version classification (VER-1, VER-3, VER-10). Classification happens
// before any other key is interpreted.

import type { MinorTable } from "./minors.ts";
import type { Json } from "./types.ts";

const WELL_FORMED = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

export type VersionClass =
  | { kind: "malformed"; observed: Json | undefined }
  | { kind: "other-major"; observed: string; major: string }
  | { kind: "newer-minor"; observed: string }
  | { kind: "accepted"; observed: string; minor: number };

export function classifyVersion(
  value: Json | undefined,
  table: MinorTable,
): VersionClass {
  if (typeof value !== "string") return { kind: "malformed", observed: value };
  const match = WELL_FORMED.exec(value);
  if (match === null) return { kind: "malformed", observed: value };
  const [, major = "", minor = "", patch = ""] = match;
  if (major !== "3") return { kind: "other-major", observed: value, major };
  if (patch !== "0") return { kind: "malformed", observed: value };
  const minorNumber = Number(minor);
  if (!Number.isSafeInteger(minorNumber) || minorNumber > table.readerMinor)
    return { kind: "newer-minor", observed: value };
  return { kind: "accepted", observed: value, minor: minorNumber };
}
