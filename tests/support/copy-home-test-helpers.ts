import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { LocalShaStatus } from "../../src/copy-home/ancestry.ts";
import { initFixtureRepo, runFixtureGit } from "./copy-home-loss-fixture.ts";

export type NoExecutionCase = {
  readonly name: string;
  readonly plant: (
    copyDir: string,
    markerScript: string,
    partialRemoteUrl: string,
    missingCommitSha: string,
  ) => void;
};

function setupFilterRepo(
  copyDir: string,
  filterName: string,
  filterAttr: "clean" | "process" | undefined,
  markerScript: string,
): void {
  initFixtureRepo(copyDir);
  runFixtureGit(copyDir, [
    "remote",
    "add",
    "origin",
    "https://127.0.0.1:1/repo.git",
  ]);
  writeFileSync(
    join(copyDir, ".gitattributes"),
    `*.txt filter=${filterName}\n`,
  );
  writeFileSync(join(copyDir, "data.txt"), "hello\n");
  runFixtureGit(copyDir, ["add", "--", ".gitattributes", "data.txt"]);
  runFixtureGit(copyDir, ["commit", "--quiet", "-m", "add filter"]);
  if (filterAttr !== undefined) {
    runFixtureGit(copyDir, [
      "config",
      `filter.${filterName}.${filterAttr}`,
      markerScript,
    ]);
  }
  writeFileSync(join(copyDir, "data.txt"), "world\n");
}

function setupPartialCloneRepo(
  copyDir: string,
  partialRemoteUrl: string,
  missingCommitSha: string,
): void {
  runFixtureGit(join(copyDir, ".."), [
    "clone",
    "--quiet",
    partialRemoteUrl,
    copyDir,
  ]);
  runFixtureGit(copyDir, ["config", "core.repositoryformatversion", "1"]);
  runFixtureGit(copyDir, ["config", "extensions.partialClone", "origin"]);
  runFixtureGit(copyDir, ["config", "remote.origin.promisor", "true"]);
  writeFileSync(
    join(copyDir, ".git", "refs", "tags", "missing-remote-commit"),
    `${missingCommitSha}\n`,
  );
  const objFile = join(
    copyDir,
    ".git",
    "objects",
    missingCommitSha.slice(0, 2),
    missingCommitSha.slice(2),
  );
  if (existsSync(objFile)) rmSync(objFile, { force: true });
}

export const noExecutionCases: readonly NoExecutionCase[] = [
  {
    name: "fsmonitor-copy",
    plant: (copyDir, markerScript) => {
      initFixtureRepo(copyDir);
      runFixtureGit(copyDir, [
        "remote",
        "add",
        "origin",
        "https://127.0.0.1:1/repo.git",
      ]);
      runFixtureGit(copyDir, ["config", "core.fsmonitor", markerScript]);
    },
  },
  {
    name: "clean-filter-copy",
    plant: (copyDir, markerScript) => {
      setupFilterRepo(copyDir, "trap", "clean", markerScript);
    },
  },
  {
    name: "process-filter-copy",
    plant: (copyDir, markerScript) => {
      setupFilterRepo(copyDir, "proctrap", "process", markerScript);
    },
  },
  {
    name: "gitproxy-copy",
    plant: (copyDir, markerScript) => {
      initFixtureRepo(copyDir);
      runFixtureGit(copyDir, [
        "remote",
        "add",
        "origin",
        "git://127.0.0.1:1/repo.git",
      ]);
      runFixtureGit(copyDir, ["config", "core.gitproxy", markerScript]);
    },
  },
  {
    name: "remote-vcs-copy",
    plant: (copyDir) => {
      initFixtureRepo(copyDir);
      runFixtureGit(copyDir, [
        "remote",
        "add",
        "origin",
        "https://127.0.0.1:1/repo.git",
      ]);
      runFixtureGit(copyDir, ["config", "remote.origin.vcs", "probe"]);
    },
  },
  {
    name: "partial-clone-copy",
    plant: (copyDir, _markerScript, partialRemoteUrl, missingCommitSha) => {
      setupPartialCloneRepo(copyDir, partialRemoteUrl, missingCommitSha);
    },
  },
  {
    name: "global-filter-copy",
    plant: (copyDir, markerScript) => {
      setupFilterRepo(copyDir, "globaltrap", undefined, markerScript);
    },
  },
];

const cliPath = join(import.meta.dir, "../../src/cli.ts");

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function fingerprintTree(root: string): string {
  const lines: string[] = [];
  const walk = (dir: string, rel: string) => {
    const stat = lstatSync(dir);
    lines.push(
      `d|${rel}|${String(stat.mode)}|${String(stat.mtimeMs)}|${String(stat.size)}`,
    );
    let names: string[];
    try {
      names = readdirSync(dir).sort(compareStrings);
    } catch {
      lines.push(`u|${rel}`);
      return;
    }
    for (const name of names) {
      const full = join(dir, name);
      const childRel = rel === "" ? name : `${rel}/${name}`;
      const childStat = lstatSync(full);
      if (childStat.isSymbolicLink()) {
        lines.push(
          `l|${childRel}|${String(childStat.mode)}|${String(childStat.mtimeMs)}`,
        );
      } else if (childStat.isDirectory()) {
        walk(full, childRel);
      } else {
        let digest: string;
        try {
          digest = createHash("sha256")
            .update(readFileSync(full))
            .digest("hex");
        } catch {
          digest = "unreadable";
        }
        lines.push(
          `f|${childRel}|${String(childStat.mode)}|${String(childStat.mtimeMs)}|${String(childStat.size)}|${digest}`,
        );
      }
    }
  };
  walk(root, "");
  return lines.join("\n");
}

export function runCheckJson(
  homesFile: string,
  envMap: Record<string, string>,
  extraArgs: readonly string[] = [],
): { readonly exitCode: number; readonly data: unknown } {
  const ran = Bun.spawnSync(
    [
      process.execPath,
      "run",
      cliPath,
      "copy-home",
      "check",
      "--homes",
      homesFile,
      ...extraArgs,
      "--json",
    ],
    {
      env: { ...process.env, ...envMap },
      stdout: "pipe",
      stderr: "pipe",
      timeout: 60_000,
      killSignal: "SIGKILL",
    },
  );
  const envelope: unknown = JSON.parse(ran.stdout.toString());
  const data: unknown = Reflect.get(
    Object(Reflect.get(Object(envelope), "result")),
    "data",
  );
  return { exitCode: ran.exitCode, data };
}

export function listFromData(data: unknown, field: string): readonly unknown[] {
  const value: unknown = Reflect.get(Object(data), field);
  return Array.isArray(value) ? value : [];
}

export function copyLossVerdict(
  data: unknown,
  copyPath: string,
): string | undefined {
  const entry = listFromData(data, "copies").find(
    (item) => String(Reflect.get(Object(item), "path")) === copyPath,
  );
  if (entry === undefined) return undefined;
  return String(
    Reflect.get(Object(Reflect.get(Object(entry), "loss")), "verdict"),
  );
}

export function copyLossReasons(
  data: unknown,
  copyPath: string,
): readonly string[] {
  const entry = listFromData(data, "copies").find(
    (item) => String(Reflect.get(Object(item), "path")) === copyPath,
  );
  if (entry === undefined) return [];
  const reasons: unknown = Reflect.get(
    Object(Reflect.get(Object(entry), "loss")),
    "reasons",
  );
  return Array.isArray(reasons) ? reasons.map((item) => String(item)) : [];
}

export function oracleIsAncestor(
  gitDir: string,
  localSha: string,
  remoteTips: ReadonlySet<string>,
): LocalShaStatus {
  if (remoteTips.has(localSha)) return "contained";
  if (remoteTips.size === 0) return "unpushed";
  let anyUndecided = false;
  for (const tip of remoteTips) {
    const args = [
      "git",
      "--git-dir",
      gitDir,
      "merge-base",
      "--is-ancestor",
      localSha,
      tip,
    ];
    const proc = Bun.spawnSync(args, { stdout: "pipe", stderr: "pipe" });
    if (proc.exitCode === 0) return "contained";
    if (proc.exitCode !== 1) anyUndecided = true;
  }
  return anyUndecided ? "undecided" : "unpushed";
}
