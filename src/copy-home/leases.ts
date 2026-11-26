import { readdirSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

export type LeaseClaim = {
  readonly coordinator: string;
  readonly status: "active" | "paused";
  readonly path: string;
};

export type LeaseLoadResult =
  | { readonly ok: true; readonly claims: readonly LeaseClaim[] }
  | { readonly ok: false; readonly reason: string };

const leaseDomains = ["personal", "open-source"] as const;

function errorCode(error: unknown): string | undefined {
  const code: unknown = Reflect.get(Object(error), "code");
  return typeof code === "string" ? code : undefined;
}

function stateHomeDir(): string {
  const value = process.env.XDG_STATE_HOME;
  if (value !== undefined && value.length > 0 && isAbsolute(value)) {
    return value;
  }
  return join(homedir(), ".local", "state");
}

function resolveMaybeReal(path: string): string {
  try {
    return realpathSync.native(path);
  } catch {
    return path;
  }
}

function parseWorktreeClaims(
  worktrees: readonly unknown[],
  filePath: string,
  coordinatorSlug: string,
  status: "active" | "paused",
): LeaseLoadResult {
  const claims: LeaseClaim[] = [];
  for (const item of worktrees) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return {
        ok: false,
        reason: `Lease ${filePath} has invalid worktree claim.`,
      };
    }
    const rawPath: unknown = Reflect.get(item, "path");
    if (typeof rawPath !== "string" || rawPath.length === 0) {
      return {
        ok: false,
        reason: `Lease ${filePath} has invalid worktree path.`,
      };
    }
    claims.push({
      coordinator: coordinatorSlug,
      status,
      path: resolveMaybeReal(rawPath),
    });
  }
  return { ok: true, claims };
}

function readLeaseJson(
  filePath: string,
):
  | { readonly ok: true; readonly value: object | undefined }
  | { readonly ok: false; readonly reason: string } {
  let rawText: string;
  try {
    rawText = readFileSync(filePath, "utf8");
  } catch (error) {
    const code = errorCode(error);
    if (code === "ENOENT") return { ok: true, value: undefined };
    return {
      ok: false,
      reason: `Cannot read lease ${filePath} (${code ?? "error"}).`,
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, reason: `Malformed JSON in lease ${filePath}.` };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, reason: `Lease ${filePath} must be a JSON object.` };
  }
  return { ok: true, value: parsed };
}

function parseLeaseFile(
  filePath: string,
  coordinatorSlug: string,
): LeaseLoadResult {
  const loaded = readLeaseJson(filePath);
  if (!loaded.ok) return loaded;
  if (loaded.value === undefined) return { ok: true, claims: [] };

  const status: unknown = Reflect.get(loaded.value, "status");
  if (status !== "active" && status !== "paused" && status !== "stopped") {
    return { ok: false, reason: `Lease ${filePath} has invalid status.` };
  }
  const worktrees: unknown = Reflect.get(loaded.value, "worktrees");
  if (!Array.isArray(worktrees)) {
    return { ok: false, reason: `Lease ${filePath} has invalid worktrees.` };
  }
  if (status === "stopped") return { ok: true, claims: [] };
  return parseWorktreeClaims(worktrees, filePath, coordinatorSlug, status);
}

export function loadLeases(): LeaseLoadResult {
  const base = join(stateHomeDir(), "my-agent-dojo", "agent-coordination");
  const claims: LeaseClaim[] = [];
  for (const domain of leaseDomains) {
    const coordinatorsDir = join(base, domain, "coordinators");
    let entries;
    try {
      entries = readdirSync(coordinatorsDir, { withFileTypes: true });
    } catch (error) {
      const code = errorCode(error);
      if (code === "ENOENT") continue;
      return {
        ok: false,
        reason: `Cannot read coordinators directory ${coordinatorsDir} (${code ?? "error"}).`,
      };
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const leasePath = join(coordinatorsDir, entry.name, "lease.json");
      const loaded = parseLeaseFile(leasePath, `${domain}/${entry.name}`);
      if (!loaded.ok) return loaded;
      claims.push(...loaded.claims);
    }
  }
  return { ok: true, claims };
}
