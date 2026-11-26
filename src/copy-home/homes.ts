import { readFileSync, realpathSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import type {
  ExceptionEntry,
  Finding,
  ResolvedRoot,
  ThrowawayRoot,
} from "./rules.ts";

export type LoadedHomes =
  | {
      readonly ok: true;
      readonly repositories: readonly string[];
      readonly roots: readonly ResolvedRoot[];
      readonly exceptions: readonly ExceptionEntry[];
      readonly initialFindings: readonly Finding[];
    }
  | {
      readonly ok: false;
      readonly message: string;
    };

type ParsedHomes = {
  readonly repositories: readonly string[];
  readonly noCopy: readonly string[];
  readonly mirror: readonly string[];
  readonly toolOwned: readonly string[];
  readonly throwaway: readonly ThrowawayRoot[];
  readonly exceptions: readonly ExceptionEntry[];
};

function errorCode(error: unknown): string | undefined {
  const code: unknown = Reflect.get(Object(error), "code");
  return typeof code === "string" ? code : undefined;
}

function resolveEnvDir(name: string, fallback: string): string {
  const value = process.env[name];
  if (value !== undefined && value.length > 0 && isAbsolute(value)) {
    return value;
  }
  return fallback;
}

function defaultHomesPath(): string {
  const configHome = resolveEnvDir(
    "XDG_CONFIG_HOME",
    join(homedir(), ".config"),
  );
  return join(
    configHome,
    "my-agent-dojo",
    "agent-engineering",
    "copy-homes.json",
  );
}

function asPlainObject(value: unknown): object | undefined {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value;
  }
  return undefined;
}

function readField(record: object, key: string): unknown {
  return Reflect.get(record, key);
}

function readAbsoluteStringList(
  record: object,
  key: string,
):
  | { readonly ok: true; readonly values: readonly string[] }
  | { readonly ok: false; readonly message: string } {
  const raw = readField(record, key);
  if (raw === undefined) return { ok: true, values: [] };
  if (!Array.isArray(raw)) {
    return {
      ok: false,
      message: `Field ${key} in homes file must be an array.`,
    };
  }
  const values: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !isAbsolute(item)) {
      return {
        ok: false,
        message: `Every path in ${key} must be an absolute path.`,
      };
    }
    values.push(item);
  }
  return { ok: true, values };
}

function readThrowawayList(
  record: object,
):
  | { readonly ok: true; readonly values: readonly ThrowawayRoot[] }
  | { readonly ok: false; readonly message: string } {
  const raw = readField(record, "throwaway");
  if (raw === undefined) return { ok: true, values: [] };
  if (!Array.isArray(raw)) {
    return {
      ok: false,
      message: "Field throwaway in homes file must be an array.",
    };
  }
  const values: ThrowawayRoot[] = [];
  for (const item of raw) {
    const entry = asPlainObject(item);
    if (entry === undefined) {
      return { ok: false, message: "Each throwaway entry must be an object." };
    }
    const root = readField(entry, "root");
    const maxAgeHours = readField(entry, "maxAgeHours");
    if (typeof root !== "string" || !isAbsolute(root)) {
      return {
        ok: false,
        message: "Each throwaway root must be an absolute path.",
      };
    }
    if (
      typeof maxAgeHours !== "number" ||
      !Number.isFinite(maxAgeHours) ||
      maxAgeHours < 0
    ) {
      return {
        ok: false,
        message: "Each throwaway maxAgeHours must be a non-negative number.",
      };
    }
    values.push({ root, maxAgeHours });
  }
  return { ok: true, values };
}

function readExceptionsList(
  record: object,
):
  | { readonly ok: true; readonly values: readonly ExceptionEntry[] }
  | { readonly ok: false; readonly message: string } {
  const raw = readField(record, "exceptions");
  if (raw === undefined) return { ok: true, values: [] };
  if (!Array.isArray(raw)) {
    return {
      ok: false,
      message: "Field exceptions in homes file must be an array.",
    };
  }
  const values: ExceptionEntry[] = [];
  for (const item of raw) {
    const entry = asPlainObject(item);
    if (entry === undefined) {
      return { ok: false, message: "Each exception entry must be an object." };
    }
    const path = readField(entry, "path");
    const reason = readField(entry, "reason");
    if (typeof path !== "string" || !isAbsolute(path)) {
      return {
        ok: false,
        message: "Each exception path must be an absolute path.",
      };
    }
    if (typeof reason !== "string" || reason.trim().length === 0) {
      return {
        ok: false,
        message: "Each exception must carry a non-empty reason.",
      };
    }
    values.push({ path, reason });
  }
  return { ok: true, values };
}

function resolveRealOrSkip(
  rawPath: string,
  findings: Finding[],
): string | undefined {
  try {
    return realpathSync.native(rawPath);
  } catch (error) {
    const code = errorCode(error);
    if (code === "ENOENT") return undefined;
    findings.push({
      kind: "scan-incomplete",
      path: rawPath,
      reason: `Cannot resolve root (${code ?? "error"}).`,
    });
    return undefined;
  }
}

function addResolvedRoots(
  paths: readonly string[],
  role: "noCopy" | "mirror" | "toolOwned",
  roots: ResolvedRoot[],
  findings: Finding[],
): void {
  for (const p of paths) {
    const real = resolveRealOrSkip(p, findings);
    if (real !== undefined) roots.push({ role, path: real });
  }
}

function appendFallbackSuiteRoots(
  roots: ResolvedRoot[],
  findings: Finding[],
): void {
  const home = homedir();
  const noCopyCandidates = [
    join(
      resolveEnvDir("XDG_CONFIG_HOME", join(home, ".config")),
      "my-agent-dojo",
    ),
    join(
      resolveEnvDir("XDG_DATA_HOME", join(home, ".local", "share")),
      "my-agent-dojo",
    ),
    join(
      resolveEnvDir("XDG_STATE_HOME", join(home, ".local", "state")),
      "my-agent-dojo",
    ),
  ];
  const cacheRoot = join(
    resolveEnvDir("XDG_CACHE_HOME", join(home, ".cache")),
    "my-agent-dojo",
  );
  const tempRoot = resolveEnvDir("TMPDIR", tmpdir());

  addResolvedRoots(noCopyCandidates, "noCopy", roots, findings);
  addResolvedRoots([cacheRoot], "mirror", roots, findings);
  const realTemp = resolveRealOrSkip(tempRoot, findings);
  if (realTemp !== undefined) {
    roots.push({ role: "throwaway", path: realTemp, maxAgeHours: 72 });
  }
}

function buildFallbackHomes(missingPath: string): LoadedHomes {
  const findings: Finding[] = [
    {
      kind: "scan-incomplete",
      path: missingPath,
      reason:
        "No homes file found; scanned ADR 0001 suite homes and TMPDIR only.",
    },
  ];
  const roots: ResolvedRoot[] = [];
  appendFallbackSuiteRoots(roots, findings);
  return {
    ok: true,
    repositories: [],
    roots,
    exceptions: [],
    initialFindings: findings,
  };
}

function parseHomesFields(
  record: object,
):
  | { readonly ok: true; readonly parsed: ParsedHomes }
  | { readonly ok: false; readonly message: string } {
  const repositories = readAbsoluteStringList(record, "repositories");
  if (!repositories.ok) return repositories;
  const noCopy = readAbsoluteStringList(record, "noCopy");
  if (!noCopy.ok) return noCopy;
  const mirror = readAbsoluteStringList(record, "mirror");
  if (!mirror.ok) return mirror;
  const toolOwned = readAbsoluteStringList(record, "toolOwned");
  if (!toolOwned.ok) return toolOwned;
  const throwaway = readThrowawayList(record);
  if (!throwaway.ok) return throwaway;
  const exceptions = readExceptionsList(record);
  if (!exceptions.ok) return exceptions;
  return {
    ok: true,
    parsed: {
      repositories: repositories.values,
      noCopy: noCopy.values,
      mirror: mirror.values,
      toolOwned: toolOwned.values,
      throwaway: throwaway.values,
      exceptions: exceptions.values,
    },
  };
}

function resolveParsedHomes(
  parsed: ParsedHomes,
  targetPath: string,
): LoadedHomes {
  const findings: Finding[] = [];
  const resolvedRepos: string[] = [];
  for (const repoRoot of parsed.repositories) {
    const real = resolveRealOrSkip(repoRoot, findings);
    if (real !== undefined) resolvedRepos.push(real);
  }
  const roots: ResolvedRoot[] = [];
  if (parsed.repositories.length === 0) {
    findings.push({
      kind: "scan-incomplete",
      path: targetPath,
      reason:
        "Homes file declares no repositories; also scanned ADR 0001 suite homes and TMPDIR.",
    });
    appendFallbackSuiteRoots(roots, findings);
  }

  addResolvedRoots(parsed.noCopy, "noCopy", roots, findings);
  addResolvedRoots(parsed.mirror, "mirror", roots, findings);
  addResolvedRoots(parsed.toolOwned, "toolOwned", roots, findings);
  for (const entry of parsed.throwaway) {
    const real = resolveRealOrSkip(entry.root, findings);
    if (real !== undefined) {
      roots.push({
        role: "throwaway",
        path: real,
        maxAgeHours: entry.maxAgeHours,
      });
    }
  }

  const resolvedExceptions: ExceptionEntry[] = [];
  for (const entry of parsed.exceptions) {
    const real = resolveRealOrSkip(entry.path, findings);
    if (real !== undefined) {
      resolvedExceptions.push({ path: real, reason: entry.reason });
    }
  }

  return {
    ok: true,
    repositories: [...new Set(resolvedRepos)],
    roots,
    exceptions: resolvedExceptions,
    initialFindings: findings,
  };
}

export function loadHomes(explicitPath: string | undefined): LoadedHomes {
  if (explicitPath !== undefined && !isAbsolute(explicitPath)) {
    return {
      ok: false,
      message: `Homes path must be absolute: ${explicitPath}`,
    };
  }
  const targetPath = explicitPath ?? defaultHomesPath();
  let rawText: string;
  try {
    rawText = readFileSync(targetPath, "utf8");
  } catch (error) {
    const code = errorCode(error);
    if (explicitPath === undefined && code === "ENOENT") {
      return buildFallbackHomes(targetPath);
    }
    return {
      ok: false,
      message: `Cannot read homes file ${targetPath} (${code ?? "error"}).`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, message: `Invalid JSON in homes file ${targetPath}.` };
  }
  const record = asPlainObject(parsed);
  if (record === undefined || readField(record, "version") !== 1) {
    return {
      ok: false,
      message: `Homes file ${targetPath} must be a JSON object with version 1.`,
    };
  }

  const fields = parseHomesFields(record);
  if (!fields.ok) return fields;
  return resolveParsedHomes(fields.parsed, targetPath);
}
