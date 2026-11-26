import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { GitDirs } from "./git-config.ts";

const shaPattern = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/i;

export type LocalRefsResult =
  | {
      readonly ok: true;
      readonly hasStash: boolean;
      readonly shas: readonly string[];
    }
  | {
      readonly ok: false;
      readonly reason: string;
    };

type OptionalFileResult =
  | { readonly status: "absent" }
  | { readonly status: "invalid" }
  | { readonly status: "present"; readonly content: string };

type WalkResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

type PackedRefsState = {
  hasStash: boolean;
  lastRef: string | undefined;
  readonly refShas: Map<string, string>;
};

function errorCode(error: unknown): string | undefined {
  const code: unknown = Reflect.get(Object(error), "code");
  return typeof code === "string" ? code : undefined;
}

function readOptionalRegularFile(path: string): OptionalFileResult {
  try {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink() || !stat.isFile()) return { status: "invalid" };
    return { status: "present", content: readFileSync(path, "utf8") };
  } catch (error) {
    return errorCode(error) === "ENOENT"
      ? { status: "absent" }
      : { status: "invalid" };
  }
}

function checkStashFiles(
  dirs: GitDirs,
):
  | { readonly ok: true; readonly present: boolean }
  | { readonly ok: false; readonly reason: string } {
  const candidates = [
    join(dirs.commonDir, "refs", "stash"),
    join(dirs.commonDir, "logs", "refs", "stash"),
  ];
  if (dirs.gitDir !== dirs.commonDir) {
    candidates.push(join(dirs.gitDir, "refs", "stash"));
    candidates.push(join(dirs.gitDir, "logs", "refs", "stash"));
  }
  for (const candidate of candidates) {
    const result = readOptionalRegularFile(candidate);
    if (result.status === "invalid") {
      return { ok: false, reason: "cannot read stash state" };
    }
    if (result.status === "present" && result.content.trim().length > 0) {
      return { ok: true, present: true };
    }
  }
  return { ok: true, present: false };
}

function processPackedRefLine(line: string, state: PackedRefsState): void {
  if (line.length === 0 || line.startsWith("#")) return;
  if (line.startsWith("^")) {
    const peeled = line.slice(1).trim();
    if (state.lastRef !== undefined && shaPattern.test(peeled)) {
      state.refShas.set(state.lastRef, peeled);
    }
    return;
  }
  const space = line.indexOf(" ");
  if (space === -1) {
    state.lastRef = undefined;
    return;
  }
  const sha = line.slice(0, space);
  const refName = line.slice(space + 1).trim();
  if (!shaPattern.test(sha) || refName.length === 0) {
    state.lastRef = undefined;
    return;
  }
  if (refName === "refs/stash") {
    state.hasStash = true;
    state.lastRef = undefined;
    return;
  }
  if (refName.startsWith("refs/remotes/")) {
    state.lastRef = undefined;
    return;
  }
  state.refShas.set(refName, sha);
  state.lastRef = refName;
}

function readPackedRefs(
  commonDir: string,
  refShas: Map<string, string>,
):
  | { readonly ok: true; readonly hasStash: boolean }
  | { readonly ok: false; readonly reason: string } {
  const result = readOptionalRegularFile(join(commonDir, "packed-refs"));
  if (result.status === "invalid") {
    return { ok: false, reason: "cannot read packed-refs" };
  }
  if (result.status === "absent") return { ok: true, hasStash: false };

  const state: PackedRefsState = {
    hasStash: false,
    lastRef: undefined,
    refShas,
  };
  for (const rawLine of result.content.split("\n")) {
    processPackedRefLine(rawLine.trim(), state);
  }
  return { ok: true, hasStash: state.hasStash };
}

function readLooseRefFile(
  full: string,
  refName: string,
  refShas: Map<string, string>,
  symRefs: Map<string, string>,
): WalkResult {
  let content: string;
  try {
    content = readFileSync(full, "utf8").trim();
  } catch {
    return { ok: false, reason: "cannot read loose ref" };
  }
  if (content.startsWith("ref:")) {
    const target = content.slice("ref:".length).trim();
    if (target.length === 0) {
      return { ok: false, reason: "invalid symbolic ref" };
    }
    symRefs.set(refName, target);
    refShas.delete(refName);
    return { ok: true };
  }
  if (shaPattern.test(content)) {
    refShas.set(refName, content);
    symRefs.delete(refName);
    return { ok: true };
  }
  return { ok: false, reason: "invalid loose ref content" };
}

function inspectLooseRefEntry(
  full: string,
  refName: string,
  refShas: Map<string, string>,
  symRefs: Map<string, string>,
): WalkResult {
  let childStat: ReturnType<typeof lstatSync>;
  try {
    childStat = lstatSync(full);
  } catch {
    return { ok: false, reason: "cannot read loose ref" };
  }
  if (childStat.isSymbolicLink()) {
    return { ok: false, reason: "cannot read loose ref" };
  }
  if (childStat.isDirectory()) {
    return walkLooseRefsDir(full, refName, refShas, symRefs, false);
  }
  if (!childStat.isFile()) {
    return { ok: false, reason: "cannot read loose ref" };
  }
  return readLooseRefFile(full, refName, refShas, symRefs);
}

function walkLooseRefsDir(
  dir: string,
  prefix: string,
  refShas: Map<string, string>,
  symRefs: Map<string, string>,
  allowMissingRoot: boolean,
): WalkResult {
  let stat: ReturnType<typeof lstatSync>;
  try {
    stat = lstatSync(dir);
  } catch (error) {
    if (allowMissingRoot && errorCode(error) === "ENOENT") {
      return { ok: true };
    }
    return { ok: false, reason: "cannot read loose refs directory" };
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    return { ok: false, reason: "cannot read loose refs directory" };
  }

  let entries: readonly string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return { ok: false, reason: "cannot read loose refs directory" };
  }

  for (const name of entries) {
    const refName = `${prefix}/${name}`;
    if (refName === "refs/remotes" || refName === "refs/stash") continue;
    const step = inspectLooseRefEntry(
      join(dir, name),
      refName,
      refShas,
      symRefs,
    );
    if (!step.ok) return step;
  }
  return { ok: true };
}

function resolveSymbolicRef(
  target: string,
  refShas: ReadonlyMap<string, string>,
  symRefs: ReadonlyMap<string, string>,
): string | undefined {
  let current = target;
  for (let depth = 0; depth < 8; depth++) {
    const direct = refShas.get(current);
    if (direct !== undefined) return direct;
    const next = symRefs.get(current);
    if (next === undefined) return undefined;
    current = next;
  }
  return undefined;
}

function readHeadSha(
  gitDir: string,
  refShas: ReadonlyMap<string, string>,
  symRefs: ReadonlyMap<string, string>,
):
  | { readonly ok: true; readonly sha: string | undefined }
  | { readonly ok: false; readonly reason: string } {
  const result = readOptionalRegularFile(join(gitDir, "HEAD"));
  if (result.status !== "present") {
    return { ok: false, reason: "cannot read HEAD" };
  }
  const content = result.content.trim();
  if (content.startsWith("ref:")) {
    const target = content.slice("ref:".length).trim();
    if (target.length === 0) return { ok: false, reason: "invalid HEAD" };
    return {
      ok: true,
      sha: resolveSymbolicRef(target, refShas, symRefs),
    };
  }
  if (shaPattern.test(content)) {
    return { ok: true, sha: content };
  }
  return { ok: false, reason: "invalid HEAD" };
}

export function readCopyRefsAndStash(dirs: GitDirs): LocalRefsResult {
  const stashCheck = checkStashFiles(dirs);
  if (!stashCheck.ok) return stashCheck;

  const refShas = new Map<string, string>();
  const symRefs = new Map<string, string>();

  const packed = readPackedRefs(dirs.commonDir, refShas);
  if (!packed.ok) return packed;

  const commonLoose = walkLooseRefsDir(
    join(dirs.commonDir, "refs"),
    "refs",
    refShas,
    symRefs,
    true,
  );
  if (!commonLoose.ok) return commonLoose;

  if (dirs.gitDir !== dirs.commonDir) {
    const worktreeLoose = walkLooseRefsDir(
      join(dirs.gitDir, "refs"),
      "refs",
      refShas,
      symRefs,
      true,
    );
    if (!worktreeLoose.ok) return worktreeLoose;
  }

  const head = readHeadSha(dirs.gitDir, refShas, symRefs);
  if (!head.ok) return head;

  const uniqueShas = new Set<string>(refShas.values());
  for (const target of symRefs.values()) {
    const resolved = resolveSymbolicRef(target, refShas, symRefs);
    if (resolved !== undefined) uniqueShas.add(resolved);
  }
  if (head.sha !== undefined) uniqueShas.add(head.sha);

  return {
    ok: true,
    hasStash: stashCheck.present || packed.hasStash,
    shas: [...uniqueShas],
  };
}
