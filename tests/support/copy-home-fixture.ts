import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  buildLossFixture,
  initFixtureRepo,
  runFixtureGit,
  writeFixtureEnv,
} from "./copy-home-loss-fixture.ts";

export const fixtureScriptPath = import.meta.filename;

const staleHours = 125;

function initBare(dir: string): void {
  mkdirSync(dir, { recursive: true });
  runFixtureGit(dir, ["init", "--quiet", "--bare", "--initial-branch=main"]);
}

function formatTouchTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${String(date.getFullYear())}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `${pad(date.getHours())}${pad(date.getMinutes())}.${pad(date.getSeconds())}`
  );
}

function touchStale(target: string): void {
  const stamp = formatTouchTimestamp(
    new Date(Date.now() - staleHours * 3_600_000),
  );
  const result = Bun.spawnSync(["touch", "-t", stamp, target], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(`touch failed on ${target}: ${result.stderr.toString()}`);
  }
}

function stopPid(pid: number): void {
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return;
  }
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    return;
  }
}

function restoreUnreadable(fixtureDir: string): void {
  const unreadable = join(fixtureDir, "no-copy", "unreadable");
  if (!existsSync(unreadable)) return;
  try {
    chmodSync(unreadable, 0o755);
  } catch {
    return;
  }
}

function cleanupFixture(fixtureDir: string): void {
  const pidFile = join(fixtureDir, "daemon.pid");
  if (existsSync(pidFile)) {
    const pid = Number(readFileSync(pidFile, "utf8").trim());
    if (Number.isSafeInteger(pid) && pid > 0) stopPid(pid);
  }
  restoreUnreadable(fixtureDir);
  rmSync(fixtureDir, { recursive: true, force: true });
}

function plantViolations(params: {
  readonly root: string;
  readonly noCopyDir: string;
  readonly tmpDir: string;
  readonly scratchDir: string;
  readonly mainRepo: string;
  readonly realRepo: string;
  readonly exceptedRepo: string;
  readonly freshOuterClone: string;
  readonly freshProject: string;
}): readonly string[] {
  const {
    root,
    noCopyDir,
    tmpDir,
    scratchDir,
    mainRepo,
    realRepo,
    exceptedRepo,
    freshOuterClone,
    freshProject,
  } = params;
  const planted: string[] = [];
  const plant = (path: string) => {
    planted.push(path);
    return path;
  };

  initFixtureRepo(plant(join(noCopyDir, "stray-clone")));
  mkdirSync(plant(join(noCopyDir, "node_modules")), { recursive: true });
  initBare(plant(join(noCopyDir, "renamed-bare")));

  const bunCache = plant(join(noCopyDir, "bun-cache"));
  mkdirSync(join(bunCache, "pkg@1.0.0@@@1"), { recursive: true });
  initBare(plant(join(bunCache, "nested-bare")));

  const pyVenv = plant(join(noCopyDir, "py-venv"));
  mkdirSync(pyVenv, { recursive: true });
  writeFileSync(join(pyVenv, "pyvenv.cfg"), "home = /usr/bin\n");

  const projectTree = plant(join(noCopyDir, "project-tree"));
  mkdirSync(projectTree, { recursive: true });
  writeFileSync(join(projectTree, "bun.lock"), "{}\n");

  initFixtureRepo(plant(join(exceptedRepo, "nested-clone")));
  initFixtureRepo(plant(join(exceptedRepo, "node_modules", "nested-in-nm")));
  initFixtureRepo(plant(join(scratchDir, "scratch-clone")));
  initFixtureRepo(plant(join(mainRepo, "review", "repo")));

  const fakeSub = plant(join(mainRepo, "review", "fake-sub"));
  const sepGitDir = join(mainRepo, ".git", "modules", "review-sep");
  mkdirSync(join(mainRepo, "review"), { recursive: true });
  runFixtureGit(mainRepo, [
    "clone",
    "--quiet",
    "--separate-git-dir",
    sepGitDir,
    realRepo,
    fakeSub,
  ]);
  planted.push(sepGitDir);

  initFixtureRepo(plant(join(mainRepo, ".worktrees", "unregistered-clone")));

  for (const stalePath of [
    join(tmpDir, "stale-clone"),
    join(freshOuterClone, "stale-nested"),
    join(freshProject, "stale-in-project"),
  ]) {
    initFixtureRepo(plant(stalePath));
    touchStale(stalePath);
  }

  const outsideWt = plant(join(root, "outside-wt"));
  runFixtureGit(mainRepo, [
    "worktree",
    "add",
    "--quiet",
    "-b",
    "wt-out",
    outsideWt,
  ]);

  const claudeWt = plant(join(mainRepo, ".claude", "worktrees", "claude-wt"));
  mkdirSync(join(mainRepo, ".claude", "worktrees"), { recursive: true });
  runFixtureGit(mainRepo, [
    "worktree",
    "add",
    "--quiet",
    "-b",
    "wt-claude",
    claudeWt,
  ]);

  const danglingWt = join(root, "dangling-wt");
  runFixtureGit(mainRepo, [
    "worktree",
    "add",
    "--quiet",
    "-b",
    "wt-dangling",
    danglingWt,
  ]);
  rmSync(danglingWt, { recursive: true, force: true });

  const unreadable = plant(join(noCopyDir, "unreadable"));
  mkdirSync(unreadable, { recursive: true });
  chmodSync(unreadable, 0o000);

  return planted;
}

function buildStandardFixture(root: string): Record<string, string> {
  const reposDir = join(root, "repos");
  const noCopyDir = join(root, "no-copy");
  const tmpDir = join(root, "tmp");
  const scratchDir = join(tmpDir, "scratch");
  const mirrorsDir = join(root, "mirrors");
  const toolOwnedDir = join(root, "tool-owned");
  for (const dir of [
    reposDir,
    noCopyDir,
    tmpDir,
    scratchDir,
    mirrorsDir,
    toolOwnedDir,
  ]) {
    mkdirSync(dir, { recursive: true });
  }

  const subSource = join(root, "sub-source");
  initFixtureRepo(subSource, "sub-init");

  const mainRepo = join(reposDir, "main-repo");
  initFixtureRepo(mainRepo, "main-init");
  runFixtureGit(mainRepo, [
    "submodule",
    "add",
    "--quiet",
    subSource,
    "submodules/valid-sub",
  ]);
  runFixtureGit(mainRepo, ["commit", "--quiet", "-m", "add submodule"]);
  rmSync(subSource, { recursive: true, force: true });

  mkdirSync(join(mainRepo, ".worktrees"), { recursive: true });
  runFixtureGit(mainRepo, [
    "worktree",
    "add",
    "--quiet",
    "-b",
    "wt-task",
    join(mainRepo, ".worktrees", "wt-task"),
  ]);
  runFixtureGit(mainRepo, [
    "worktree",
    "add",
    "--quiet",
    "-b",
    "wt-tool",
    join(toolOwnedDir, "wt-tool"),
  ]);

  const realRepo = join(reposDir, "real-repo");
  initFixtureRepo(realRepo, "real-init");
  mkdirSync(join(realRepo, ".worktrees"), { recursive: true });
  runFixtureGit(realRepo, [
    "worktree",
    "add",
    "--quiet",
    "-b",
    "wt-real",
    join(realRepo, ".worktrees", "wt-real"),
  ]);
  symlinkSync(realRepo, join(reposDir, "linked-repo"));

  initBare(join(mirrorsDir, "cached-mirror"));
  initFixtureRepo(join(tmpDir, "fresh-clone"));

  const exceptedRepo = join(noCopyDir, "excepted-repo");
  initFixtureRepo(exceptedRepo);
  mkdirSync(join(exceptedRepo, "node_modules"), { recursive: true });

  const freshOuterClone = join(tmpDir, "fresh-outer-clone");
  initFixtureRepo(freshOuterClone);

  const freshProject = join(tmpDir, "fresh-project");
  mkdirSync(freshProject, { recursive: true });
  writeFileSync(join(freshProject, "bun.lock"), "{}\n");

  const planted = plantViolations({
    root,
    noCopyDir,
    tmpDir,
    scratchDir,
    mainRepo,
    realRepo,
    exceptedRepo,
    freshOuterClone,
    freshProject,
  });

  const homes = {
    version: 1,
    repositories: [reposDir],
    noCopy: [noCopyDir, scratchDir],
    throwaway: [{ root: tmpDir, maxAgeHours: 72 }],
    mirror: [mirrorsDir],
    toolOwned: [toolOwnedDir],
    exceptions: [{ path: exceptedRepo, reason: "fixture exception" }],
  };
  writeFileSync(
    join(root, "homes.json"),
    `${JSON.stringify(homes, null, 2)}\n`,
  );
  writeFileSync(join(root, "planted.txt"), `${planted.join("\n")}\n`);
  return writeFixtureEnv(root);
}

function removePlanted(fixtureDir: string): void {
  restoreUnreadable(fixtureDir);
  const plantedFile = join(fixtureDir, "planted.txt");
  if (existsSync(plantedFile)) {
    const lines = readFileSync(plantedFile, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    for (const target of lines) {
      rmSync(target, { recursive: true, force: true });
    }
  }
  const reposDir = join(fixtureDir, "repos");
  if (!existsSync(reposDir)) return;
  for (const entry of readdirSync(reposDir)) {
    const candidate = join(reposDir, entry);
    if (
      lstatSync(candidate).isDirectory() &&
      existsSync(join(candidate, ".git"))
    ) {
      runFixtureGit(candidate, ["worktree", "prune"]);
    }
  }
}

async function runWatchdog(fixtureDir: string): Promise<void> {
  const onSignal = () => {
    cleanupFixture(fixtureDir);
    process.exit(0);
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  process.on("SIGHUP", onSignal);
  await new Promise<void>((resolve) => {
    process.stdin.resume();
    process.stdin.once("end", resolve);
    process.stdin.once("close", resolve);
  });
  cleanupFixture(fixtureDir);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const watchdogTarget = args[1];
  if (args[0] === "--watchdog" && watchdogTarget !== undefined) {
    await runWatchdog(watchdogTarget);
    return;
  }
  const targetDir = args[0];
  if (!targetDir) {
    throw new Error(
      "Usage: copy-home-fixture.ts <dir> [--loss|--remove-planted] [-- <cmd...>]",
    );
  }
  if (args.includes("--remove-planted")) {
    removePlanted(realpathSync.native(targetDir));
    return;
  }
  const sepIndex = args.indexOf("--");
  const isLoss = args
    .slice(1, sepIndex === -1 ? undefined : sepIndex)
    .includes("--loss");
  const commandArgs = sepIndex === -1 ? [] : args.slice(sepIndex + 1);
  if (commandArgs.length === 0) {
    throw new Error("Expected -- <command...> after fixture folder.");
  }

  mkdirSync(targetDir, { recursive: true });
  const root = realpathSync.native(targetDir);

  const watchdog = Bun.spawn(
    [process.execPath, import.meta.filename, "--watchdog", root],
    {
      stdin: "pipe",
      stdout: "ignore",
      stderr: "ignore",
      detached: false,
    },
  );

  let cleaned = false;
  const finish = () => {
    if (cleaned) return;
    cleaned = true;
    cleanupFixture(root);
    void watchdog.stdin.end();
  };

  const onSignal = (signal: NodeJS.Signals) => {
    finish();
    process.exit(signal === "SIGINT" ? 130 : 143);
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  process.on("SIGHUP", onSignal);

  let exitCode: number | undefined;
  try {
    const envMap = isLoss
      ? await buildLossFixture(root)
      : buildStandardFixture(root);
    const child = Bun.spawn(commandArgs, {
      env: { ...process.env, ...envMap },
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
      detached: false,
    });
    exitCode = await child.exited;
  } finally {
    finish();
    await watchdog.exited;
  }
  process.exit(exitCode ?? 1);
}

if (import.meta.main) {
  await main();
}
