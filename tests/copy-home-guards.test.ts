import { describe, expect, setDefaultTimeout, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  initFixtureRepo,
  runFixtureGit,
  startLocalGitDaemon,
  writeFixtureEnv,
} from "./support/copy-home-loss-fixture.ts";
import {
  copyLossReasons,
  copyLossVerdict,
  fingerprintTree,
  listFromData,
  runCheckJson,
} from "./support/copy-home-test-helpers.ts";
import { testFolder } from "./support/test-folder.ts";

setDefaultTimeout(60_000);

describe("copy-home check guards", () => {
  test("never runs repository-configured Git programs and reports unknown with unchanged fingerprint", () => {
    const sandbox = realpathSync.native(testFolder("copy-home-git-safe-"));
    try {
      const reposDir = join(sandbox, "repos");
      const noCopyDir = join(sandbox, "no-copy");
      const scriptsDir = join(sandbox, "scripts");
      mkdirSync(reposDir, { recursive: true });
      mkdirSync(noCopyDir, { recursive: true });
      mkdirSync(scriptsDir, { recursive: true });
      initFixtureRepo(join(reposDir, "anchor-repo"));

      const markerPath = join(sandbox, "marker-written");
      const markerScript = join(scriptsDir, "trap.sh");
      writeFileSync(
        markerScript,
        `#!/bin/sh\nprintf "ran\\n" >> ${JSON.stringify(markerPath)}\nexit 0\n`,
      );
      chmodSync(markerScript, 0o755);

      const fsmonitorCopy = join(noCopyDir, "fsmonitor-copy");
      initFixtureRepo(fsmonitorCopy);
      runFixtureGit(fsmonitorCopy, [
        "remote",
        "add",
        "origin",
        "https://127.0.0.1:1/repo.git",
      ]);
      runFixtureGit(fsmonitorCopy, ["config", "core.fsmonitor", markerScript]);

      const cleanFilterCopy = join(noCopyDir, "clean-filter-copy");
      initFixtureRepo(cleanFilterCopy);
      runFixtureGit(cleanFilterCopy, [
        "remote",
        "add",
        "origin",
        "https://127.0.0.1:1/repo.git",
      ]);
      writeFileSync(
        join(cleanFilterCopy, ".gitattributes"),
        "*.txt filter=trap\n",
      );
      writeFileSync(join(cleanFilterCopy, "data.txt"), "hello\n");
      runFixtureGit(cleanFilterCopy, [
        "add",
        "--",
        ".gitattributes",
        "data.txt",
      ]);
      runFixtureGit(cleanFilterCopy, ["commit", "--quiet", "-m", "add filter"]);
      runFixtureGit(cleanFilterCopy, [
        "config",
        "filter.trap.clean",
        markerScript,
      ]);
      writeFileSync(join(cleanFilterCopy, "data.txt"), "modified\n");

      const processFilterCopy = join(noCopyDir, "process-filter-copy");
      initFixtureRepo(processFilterCopy);
      runFixtureGit(processFilterCopy, [
        "remote",
        "add",
        "origin",
        "https://127.0.0.1:1/repo.git",
      ]);
      writeFileSync(
        join(processFilterCopy, ".gitattributes"),
        "*.txt filter=proctrap\n",
      );
      writeFileSync(join(processFilterCopy, "data.txt"), "hello\n");
      runFixtureGit(processFilterCopy, [
        "add",
        "--",
        ".gitattributes",
        "data.txt",
      ]);
      runFixtureGit(processFilterCopy, [
        "commit",
        "--quiet",
        "-m",
        "add process filter",
      ]);
      runFixtureGit(processFilterCopy, [
        "config",
        "filter.proctrap.process",
        markerScript,
      ]);
      writeFileSync(join(processFilterCopy, "data.txt"), "modified\n");

      const sshCommandCopy = join(noCopyDir, "ssh-command-copy");
      initFixtureRepo(sshCommandCopy);
      runFixtureGit(sshCommandCopy, [
        "remote",
        "add",
        "origin",
        "ssh://127.0.0.1:1/repo.git",
      ]);
      runFixtureGit(sshCommandCopy, [
        "config",
        "core.sshCommand",
        markerScript,
      ]);

      const credHelperCopy = join(noCopyDir, "credential-helper-copy");
      initFixtureRepo(credHelperCopy);
      runFixtureGit(credHelperCopy, [
        "remote",
        "add",
        "origin",
        "https://127.0.0.1:1/repo.git",
      ]);
      runFixtureGit(credHelperCopy, [
        "config",
        "credential.helper",
        `!${markerScript}`,
      ]);

      const homesFile = join(sandbox, "homes.json");
      writeFileSync(
        homesFile,
        `${JSON.stringify(
          {
            version: 1,
            repositories: [reposDir],
            noCopy: [noCopyDir],
            throwaway: [],
            mirror: [],
            toolOwned: [],
            exceptions: [],
          },
          null,
          2,
        )}\n`,
      );
      const envMap = writeFixtureEnv(sandbox);
      const before = fingerprintTree(sandbox);
      const { exitCode, data } = runCheckJson(homesFile, envMap, ["--remote"]);
      const after = fingerprintTree(sandbox);

      expect(exitCode).toBe(3);
      expect(after).toBe(before);
      expect(existsSync(markerPath)).toBe(false);
      for (const target of [
        fsmonitorCopy,
        cleanFilterCopy,
        processFilterCopy,
        sshCommandCopy,
        credHelperCopy,
      ]) {
        expect(copyLossVerdict(data, target)).toBe("unknown");
      }
      for (const target of [
        fsmonitorCopy,
        cleanFilterCopy,
        processFilterCopy,
      ]) {
        expect(
          copyLossReasons(data, target).some((reason) =>
            reason.includes("skipped git status due to repository config"),
          ),
        ).toBe(true);
      }
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  test("walks repository roots themselves and judges nested clones, bare repos, project trees, and unreadable folders", () => {
    const sandbox = realpathSync.native(testFolder("copy-home-repo-root-"));
    const unreadable = join(sandbox, "repos", "unreadable");
    try {
      const reposDir = join(sandbox, "repos");
      mkdirSync(reposDir, { recursive: true });

      const mainRepo = join(reposDir, "main-repo");
      initFixtureRepo(mainRepo);

      const nestedClone = join(reposDir, "wrapper", "nested-clone");
      initFixtureRepo(nestedClone);

      const bareRepo = join(reposDir, "bare-repo");
      mkdirSync(bareRepo, { recursive: true });
      runFixtureGit(bareRepo, [
        "init",
        "--quiet",
        "--bare",
        "--initial-branch=main",
      ]);

      const projectTree = join(reposDir, "project-tree");
      mkdirSync(projectTree, { recursive: true });
      writeFileSync(join(projectTree, "bun.lock"), "{}\n");

      mkdirSync(unreadable, { recursive: true });
      chmodSync(unreadable, 0o000);

      const homesFile = join(sandbox, "homes.json");
      writeFileSync(
        homesFile,
        `${JSON.stringify(
          {
            version: 1,
            repositories: [reposDir],
            noCopy: [],
            throwaway: [],
            mirror: [],
            toolOwned: [],
            exceptions: [],
          },
          null,
          2,
        )}\n`,
      );
      const envMap = writeFixtureEnv(sandbox);
      const { exitCode, data } = runCheckJson(homesFile, envMap);

      expect(exitCode).toBe(3);
      expect(Reflect.get(Object(data), "complete")).toBe(false);

      const findings = listFromData(data, "findings").map((item) => ({
        kind: String(Reflect.get(Object(item), "kind")),
        path: String(Reflect.get(Object(item), "path")),
      }));
      expect(findings).toContainEqual({
        kind: "stray-copy",
        path: nestedClone,
      });
      expect(findings).toContainEqual({ kind: "stray-copy", path: bareRepo });
      expect(findings).toContainEqual({
        kind: "stray-copy",
        path: projectTree,
      });
      expect(findings).toContainEqual({
        kind: "scan-incomplete",
        path: unreadable,
      });

      const mainRecord = listFromData(data, "copies").find(
        (item) => String(Reflect.get(Object(item), "path")) === mainRepo,
      );
      expect(mainRecord).toMatchObject({ home: "repository", verdict: "ok" });
    } finally {
      if (existsSync(unreadable)) chmodSync(unreadable, 0o755);
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  test("propagates nested copy work-found and unreadable nested folder unknown to the outer copy", async () => {
    const sandbox = realpathSync.native(testFolder("copy-home-nested-loss-"));
    const unreadable = join(
      sandbox,
      "no-copy",
      "outer-unreadable",
      "unreadable",
    );
    let stopDaemon: (() => void) | undefined;
    try {
      const reposDir = join(sandbox, "repos");
      const remotesDir = join(sandbox, "remotes");
      const noCopyDir = join(sandbox, "no-copy");
      for (const dir of [reposDir, remotesDir, noCopyDir]) {
        mkdirSync(dir, { recursive: true });
      }
      initFixtureRepo(join(reposDir, "anchor-repo"));

      const seed = join(sandbox, "seed");
      initFixtureRepo(seed);
      writeFileSync(join(seed, ".gitignore"), "nested/\nunreadable/\n");
      runFixtureGit(seed, ["add", "--", ".gitignore"]);
      runFixtureGit(seed, ["commit", "--quiet", "-m", "ignore nested"]);

      const bareRemote = join(remotesDir, "outer.git");
      runFixtureGit(sandbox, ["clone", "--quiet", "--bare", seed, bareRemote]);
      rmSync(seed, { recursive: true, force: true });

      const daemon = await startLocalGitDaemon(remotesDir);
      stopDaemon = daemon.stop;
      const remoteUrl = `git://127.0.0.1:${String(daemon.port)}/outer.git`;

      const outerWork = join(noCopyDir, "outer-work");
      runFixtureGit(sandbox, ["clone", "--quiet", remoteUrl, outerWork]);
      const nestedDirty = join(outerWork, "nested");
      initFixtureRepo(nestedDirty);
      writeFileSync(join(nestedDirty, "unsaved.txt"), "unsaved\n");

      const outerUnreadable = join(noCopyDir, "outer-unreadable");
      runFixtureGit(sandbox, ["clone", "--quiet", remoteUrl, outerUnreadable]);
      mkdirSync(unreadable, { recursive: true });
      chmodSync(unreadable, 0o000);

      const homesFile = join(sandbox, "homes.json");
      writeFileSync(
        homesFile,
        `${JSON.stringify(
          {
            version: 1,
            repositories: [reposDir],
            noCopy: [noCopyDir],
            throwaway: [],
            mirror: [],
            toolOwned: [],
            exceptions: [],
          },
          null,
          2,
        )}\n`,
      );
      const envMap = writeFixtureEnv(sandbox);
      const { exitCode, data } = runCheckJson(homesFile, envMap, ["--remote"]);

      expect(exitCode).toBe(3);
      expect(copyLossVerdict(data, outerWork)).toBe("work-found");
      expect(
        copyLossReasons(data, outerWork).some((reason) =>
          reason.includes("uncommitted or untracked changes"),
        ),
      ).toBe(true);
      expect(copyLossVerdict(data, outerUnreadable)).toBe("unknown");
      expect(
        copyLossReasons(data, outerUnreadable).some((reason) =>
          reason.includes("unreadable path"),
        ),
      ).toBe(true);
    } finally {
      stopDaemon?.();
      if (existsSync(unreadable)) chmodSync(unreadable, 0o755);
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  test("a registered task worktree inside a more specific no-copy root reports stray-worktree", () => {
    const sandbox = realpathSync.native(testFolder("copy-home-wt-spec-"));
    try {
      const reposDir = join(sandbox, "repos");
      mkdirSync(reposDir, { recursive: true });
      const mainRepo = join(reposDir, "main-repo");
      initFixtureRepo(mainRepo);

      const blockedDir = join(mainRepo, ".worktrees", "blocked");
      mkdirSync(blockedDir, { recursive: true });
      const taskWt = join(blockedDir, "wt-task");
      runFixtureGit(mainRepo, [
        "worktree",
        "add",
        "--quiet",
        "-b",
        "wt-blocked",
        taskWt,
      ]);

      const homesFile = join(sandbox, "homes.json");
      writeFileSync(
        homesFile,
        `${JSON.stringify(
          {
            version: 1,
            repositories: [reposDir],
            noCopy: [blockedDir],
            throwaway: [],
            mirror: [],
            toolOwned: [],
            exceptions: [],
          },
          null,
          2,
        )}\n`,
      );
      const envMap = writeFixtureEnv(sandbox);
      const { exitCode, data } = runCheckJson(homesFile, envMap);

      expect(exitCode).toBe(3);
      const findings = listFromData(data, "findings").map((item) => ({
        kind: String(Reflect.get(Object(item), "kind")),
        path: String(Reflect.get(Object(item), "path")),
      }));
      expect(findings).toContainEqual({
        kind: "stray-worktree",
        path: taskWt,
      });
      const wtRecord = listFromData(data, "copies").find(
        (item) => String(Reflect.get(Object(item), "path")) === taskWt,
      );
      expect(wtRecord).toMatchObject({
        home: "noCopy",
        verdict: "stray-worktree",
      });
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  test("must-refuse inputs report work-found or unknown without modifying the fixture", () => {
    const sandbox = realpathSync.native(testFolder("copy-home-must-refuse-"));
    const unreadableGit = join(sandbox, "no-copy", "unreadable-copy", ".git");
    try {
      const reposDir = join(sandbox, "repos");
      const noCopyDir = join(sandbox, "no-copy");
      mkdirSync(reposDir, { recursive: true });
      mkdirSync(noCopyDir, { recursive: true });
      initFixtureRepo(join(reposDir, "anchor-repo"));

      const unpushedCopy = join(noCopyDir, "unpushed-copy");
      initFixtureRepo(unpushedCopy, "unpushed-commit");

      const dirtyCopy = join(noCopyDir, "dirty-copy");
      initFixtureRepo(dirtyCopy);
      writeFileSync(join(dirtyCopy, "draft.txt"), "uncommitted\n");

      const unreadableCopy = join(noCopyDir, "unreadable-copy");
      initFixtureRepo(unreadableCopy);
      chmodSync(unreadableGit, 0o000);

      const homesFile = join(sandbox, "homes.json");
      writeFileSync(
        homesFile,
        `${JSON.stringify(
          {
            version: 1,
            repositories: [reposDir],
            noCopy: [noCopyDir],
            throwaway: [],
            mirror: [],
            toolOwned: [],
            exceptions: [],
          },
          null,
          2,
        )}\n`,
      );
      const envMap = writeFixtureEnv(sandbox);
      const before = fingerprintTree(sandbox);
      const { exitCode, data } = runCheckJson(homesFile, envMap, ["--remote"]);
      const after = fingerprintTree(sandbox);

      expect(exitCode).toBe(3);
      expect(after).toBe(before);
      expect(copyLossVerdict(data, unpushedCopy)).toBe("work-found");
      expect(copyLossVerdict(data, dirtyCopy)).toBe("work-found");
      expect(copyLossVerdict(data, unreadableCopy)).toBe("unknown");
    } finally {
      if (existsSync(unreadableGit)) chmodSync(unreadableGit, 0o755);
      rmSync(sandbox, { recursive: true, force: true });
    }
  });
});
