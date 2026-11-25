import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createConnection } from "node:net";
import { basename, join } from "node:path";

const gitTimeoutMs = 15_000;

const strippedGitEnv = new Set([
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_COMMON_DIR",
]);

function baseGitEnv(
  extra: Record<string, string> = {},
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !strippedGitEnv.has(key)) env[key] = value;
  }
  return {
    ...env,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_COUNT: "3",
    GIT_CONFIG_KEY_0: "maintenance.auto",
    GIT_CONFIG_VALUE_0: "false",
    GIT_CONFIG_KEY_1: "gc.auto",
    GIT_CONFIG_VALUE_1: "0",
    GIT_CONFIG_KEY_2: "protocol.file.allow",
    GIT_CONFIG_VALUE_2: "always",
    GIT_CONFIG_PARAMETERS: "",
    GIT_AUTHOR_NAME: "Fixture",
    GIT_AUTHOR_EMAIL: "fixture@example.invalid",
    GIT_COMMITTER_NAME: "Fixture",
    GIT_COMMITTER_EMAIL: "fixture@example.invalid",
    ...extra,
  };
}

export function runFixtureGit(
  cwd: string,
  args: readonly string[],
  extraEnv: Record<string, string> = {},
): string {
  const result = Bun.spawnSync(["git", ...args], {
    cwd,
    env: baseGitEnv(extraEnv),
    stdout: "pipe",
    stderr: "pipe",
    timeout: gitTimeoutMs,
    killSignal: "SIGKILL",
  });
  if (result.exitedDueToTimeout || result.exitCode !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed in ${cwd}: ${result.stderr.toString().trim()}`,
    );
  }
  return result.stdout.toString().trim();
}

export function initFixtureRepo(dir: string, commitMessage = "init"): void {
  mkdirSync(dir, { recursive: true });
  runFixtureGit(dir, ["init", "--quiet", "--initial-branch=main"]);
  writeFileSync(join(dir, "README.md"), `${basename(dir)}\n`);
  runFixtureGit(dir, ["add", "--", "README.md"]);
  runFixtureGit(dir, ["commit", "--quiet", "-m", commitMessage]);
}

export function writeFixtureEnv(
  root: string,
  extraGitConfig = "",
): Record<string, string> {
  const codexHome = join(root, "codex");
  const xdgStateHome = join(root, "state");
  const gitConfigGlobal = join(root, "gitconfig");
  mkdirSync(codexHome, { recursive: true });
  mkdirSync(xdgStateHome, { recursive: true });
  writeFileSync(gitConfigGlobal, extraGitConfig);
  const envMap = {
    FIXTURE: root,
    CODEX_HOME: codexHome,
    XDG_STATE_HOME: xdgStateHome,
    GIT_CONFIG_GLOBAL: gitConfigGlobal,
  };
  const envText = Object.entries(envMap)
    .map(([key, value]) => `export ${key}=${JSON.stringify(value)}`)
    .join("\n");
  writeFileSync(join(root, "env"), `${envText}\n`);
  writeFileSync(join(root, "stamp"), "");
  return envMap;
}

function allocatePort(): number {
  const server = Bun.listen({
    hostname: "127.0.0.1",
    port: 0,
    socket: {
      data() {
        return;
      },
    },
  });
  const port = server.port;
  server.stop(true);
  return port;
}

function probePort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForDaemon(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probePort(port)) return;
    await new Promise<void>((resolve) => {
      const timer = setInterval(() => {
        clearInterval(timer);
        resolve();
      }, 25);
    });
  }
  throw new Error(`git daemon on 127.0.0.1:${String(port)} did not listen`);
}

function createLossCases(
  root: string,
  remotesDir: string,
  lossDir: string,
  port: number,
): {
  readonly case07Bare: string;
  readonly forgeUrl: string;
  readonly case09: string;
} {
  const daemonUrl = (name: string) =>
    `git://127.0.0.1:${String(port)}/${name}.git`;

  runFixtureGit(root, [
    "clone",
    "--quiet",
    daemonUrl("case01"),
    join(lossDir, "01-clean"),
  ]);

  const c02 = join(lossDir, "02-untracked");
  runFixtureGit(root, ["clone", "--quiet", daemonUrl("case02"), c02]);
  writeFileSync(join(c02, "untracked.txt"), "unsaved\n");

  const c03 = join(lossDir, "03-stash");
  runFixtureGit(root, ["clone", "--quiet", daemonUrl("case03"), c03]);
  writeFileSync(join(c03, "README.md"), "stashed\n");
  runFixtureGit(c03, ["stash", "push", "--quiet", "-m", "wip"]);

  const c04 = join(lossDir, "04-unpushed");
  runFixtureGit(root, ["clone", "--quiet", daemonUrl("case04"), c04]);
  writeFileSync(join(c04, "local.txt"), "unpushed\n");
  runFixtureGit(c04, ["add", "--", "local.txt"]);
  runFixtureGit(c04, ["commit", "--quiet", "-m", "unpushed"]);

  const c05 = join(lossDir, "05-local-tag");
  runFixtureGit(root, ["clone", "--quiet", daemonUrl("case05"), c05]);
  const mainSha = runFixtureGit(c05, ["rev-parse", "HEAD"]);
  writeFileSync(join(c05, "tagged.txt"), "tagged\n");
  runFixtureGit(c05, ["add", "--", "tagged.txt"]);
  runFixtureGit(c05, ["commit", "--quiet", "-m", "tagged-only"]);
  runFixtureGit(c05, ["tag", "v-local"]);
  runFixtureGit(c05, ["reset", "--quiet", "--hard", mainSha]);

  const case06Bare = join(remotesDir, "case06.git");
  const c06 = join(lossDir, "06-deleted-remote-branch");
  runFixtureGit(root, ["clone", "--quiet", daemonUrl("case06"), c06]);
  runFixtureGit(c06, ["checkout", "--quiet", "feat"]);
  runFixtureGit(case06Bare, ["branch", "-D", "feat"]);

  const c07 = join(lossDir, "07-insteadof");
  const case07Bare = join(remotesDir, "case07.git");
  runFixtureGit(root, ["clone", "--quiet", case07Bare, c07]);
  const forgeUrl = "https://forge.example.invalid/org/case07.git";
  runFixtureGit(c07, ["remote", "set-url", "origin", forgeUrl]);

  const c08Unit = join(lossDir, "08-sibling");
  mkdirSync(c08Unit, { recursive: true });
  runFixtureGit(root, [
    "clone",
    "--quiet",
    daemonUrl("case08"),
    join(c08Unit, "repo"),
  ]);
  writeFileSync(join(c08Unit, "report.txt"), "unsaved report\n");

  const case09 = join(lossDir, "09-leased");
  runFixtureGit(root, ["clone", "--quiet", daemonUrl("case09"), case09]);

  return { case07Bare, forgeUrl, case09 };
}

export async function buildLossFixture(
  root: string,
): Promise<Record<string, string>> {
  const reposDir = join(root, "repos");
  const remotesDir = join(root, "remotes");
  const lossDir = join(root, "loss");
  for (const dir of [reposDir, remotesDir, lossDir]) {
    mkdirSync(dir, { recursive: true });
  }
  initFixtureRepo(join(reposDir, "anchor-repo"));

  const seed = join(root, "seed");
  initFixtureRepo(seed, "seed-init");
  for (const name of [
    "case01",
    "case02",
    "case03",
    "case04",
    "case05",
    "case06",
    "case07",
    "case08",
    "case09",
  ]) {
    const bare = join(remotesDir, `${name}.git`);
    runFixtureGit(root, ["clone", "--quiet", "--bare", seed, bare]);
  }

  const case06Bare = join(remotesDir, "case06.git");
  const case06Prep = join(root, "case06-prep");
  runFixtureGit(root, ["clone", "--quiet", case06Bare, case06Prep]);
  runFixtureGit(case06Prep, ["checkout", "--quiet", "-b", "feat"]);
  writeFileSync(join(case06Prep, "feat.txt"), "feat\n");
  runFixtureGit(case06Prep, ["add", "--", "feat.txt"]);
  runFixtureGit(case06Prep, ["commit", "--quiet", "-m", "feat"]);
  runFixtureGit(case06Prep, ["push", "--quiet", "origin", "feat"]);
  rmSync(case06Prep, { recursive: true, force: true });
  rmSync(seed, { recursive: true, force: true });

  const port = allocatePort();
  const gitDaemonBinary = join(
    runFixtureGit(root, ["--exec-path"]),
    "git-daemon",
  );
  const daemon = Bun.spawn(
    [
      gitDaemonBinary,
      "--listen=127.0.0.1",
      `--port=${String(port)}`,
      "--export-all",
      "--reuseaddr",
      `--base-path=${remotesDir}`,
      remotesDir,
    ],
    {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
      detached: false,
    },
  );
  writeFileSync(join(root, "daemon.pid"), `${String(daemon.pid)}\n`);
  await waitForDaemon(port, 5_000);

  const { case07Bare, forgeUrl, case09 } = createLossCases(
    root,
    remotesDir,
    lossDir,
    port,
  );

  const homes = {
    version: 1,
    repositories: [reposDir],
    noCopy: [],
    throwaway: [{ root: lossDir, maxAgeHours: 72 }],
    mirror: [],
    toolOwned: [],
    exceptions: [],
  };
  writeFileSync(
    join(root, "homes.json"),
    `${JSON.stringify(homes, null, 2)}\n`,
  );
  writeFileSync(join(root, "planted.txt"), "");

  const gitConfig = `[url "${case07Bare}"]\n\tinsteadOf = ${forgeUrl}\n`;
  const envMap = writeFixtureEnv(root, gitConfig);

  const leaseDir = join(
    root,
    "state",
    "my-agent-dojo",
    "agent-coordination",
    "open-source",
    "coordinators",
    "coord-09",
  );
  mkdirSync(leaseDir, { recursive: true });
  writeFileSync(
    join(leaseDir, "lease.json"),
    `${JSON.stringify(
      {
        version: 1,
        domain: "open-source",
        coordinator_slug: "coord-09",
        status: "paused",
        worktrees: [{ path: case09, keys: [] }],
      },
      null,
      2,
    )}\n`,
  );
  return envMap;
}
