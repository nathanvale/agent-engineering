import { describe, expect, setDefaultTimeout, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmSync,
  utimesSync,
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
  noExecutionCases,
  runCheckJson,
} from "./support/copy-home-test-helpers.ts";
import { testFolder } from "./support/test-folder.ts";

setDefaultTimeout(60_000);

describe("copy-home check guards", () => {
  test("never executes planted Git triggers or fetches packs with --remote and leaves fixture untouched", async () => {
    const sandbox = realpathSync.native(testFolder("copy-home-git-safe-"));
    let stopDaemon: (() => void) | undefined;
    try {
      const reposDir = join(sandbox, "repos");
      const remotesDir = join(sandbox, "remotes");
      const noCopyDir = join(sandbox, "no-copy");
      const scriptsDir = join(sandbox, "scripts");
      for (const dir of [reposDir, remotesDir, noCopyDir, scriptsDir]) {
        mkdirSync(dir, { recursive: true });
      }
      initFixtureRepo(join(reposDir, "anchor-repo"));

      const partialSeed = join(sandbox, "partial-seed");
      initFixtureRepo(partialSeed, "base");
      const partialBare = join(remotesDir, "partial.git");
      runFixtureGit(sandbox, [
        "clone",
        "--quiet",
        "--bare",
        partialSeed,
        partialBare,
      ]);
      writeFileSync(join(partialSeed, "extra.txt"), "extra\n");
      runFixtureGit(partialSeed, ["add", "--", "extra.txt"]);
      runFixtureGit(partialSeed, [
        "commit",
        "--quiet",
        "-m",
        "missing-on-client",
      ]);
      const missingCommitSha = runFixtureGit(partialSeed, [
        "rev-parse",
        "HEAD",
      ]);
      writeFileSync(join(partialSeed, "tip.txt"), "tip\n");
      runFixtureGit(partialSeed, ["add", "--", "tip.txt"]);
      runFixtureGit(partialSeed, ["commit", "--quiet", "-m", "remote-tip"]);
      runFixtureGit(partialSeed, [
        "push",
        "--quiet",
        partialBare,
        "HEAD:refs/heads/other",
      ]);
      rmSync(partialSeed, { recursive: true, force: true });

      const daemon = await startLocalGitDaemon(remotesDir);
      stopDaemon = daemon.stop;
      const partialRemoteUrl = `git://127.0.0.1:${String(daemon.port)}/partial.git`;

      const markerPath = join(sandbox, "marker-written");
      const markerScript = join(scriptsDir, "trap.sh");
      writeFileSync(
        markerScript,
        `#!/bin/sh\nprintf "ran\\n" >> ${JSON.stringify(markerPath)}\nexit 0\n`,
      );
      chmodSync(markerScript, 0o755);

      const remoteHelper = join(scriptsDir, "git-remote-probe");
      writeFileSync(
        remoteHelper,
        `#!/bin/sh\nprintf "remote-probe\\n" >> ${JSON.stringify(markerPath)}\nexit 0\n`,
      );
      chmodSync(remoteHelper, 0o755);

      const copyDirs = noExecutionCases.map((entry) => {
        const copyDir = join(noCopyDir, entry.name);
        entry.plant(copyDir, markerScript, partialRemoteUrl, missingCommitSha);
        return copyDir;
      });
      const partialPackDir = join(
        noCopyDir,
        "partial-clone-copy",
        ".git",
        "objects",
        "pack",
      );
      const packsBefore = existsSync(partialPackDir)
        ? readdirSync(partialPackDir)
        : [];

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
      const globalFilterConfig = `[filter "globaltrap"]\n\tclean = ${markerScript}\n`;
      const envMap = {
        ...writeFixtureEnv(sandbox, globalFilterConfig),
        PATH: `${scriptsDir}:${process.env.PATH ?? ""}`,
      };
      const before = fingerprintTree(sandbox);
      const { exitCode, data } = runCheckJson(homesFile, envMap, ["--remote"]);
      const after = fingerprintTree(sandbox);
      const packsAfter = existsSync(partialPackDir)
        ? readdirSync(partialPackDir)
        : [];

      expect(exitCode).toBe(3);
      expect(after).toBe(before);
      expect(existsSync(markerPath)).toBe(false);
      expect(packsAfter).toEqual(packsBefore);
      for (const copyDir of copyDirs) {
        expect(copyLossVerdict(data, copyDir)).toBe("unknown");
      }
      expect(
        copyLossReasons(data, join(noCopyDir, "partial-clone-copy")),
      ).toContain("partial clone ancestry not checked");
    } finally {
      stopDaemon?.();
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  test("TMPDIR inside a 100-hour-old throwaway clone still reports expired-throwaway with unchanged mtime", () => {
    const sandbox = realpathSync.native(testFolder("copy-home-tmpdir-mtime-"));
    try {
      const reposDir = join(sandbox, "repos");
      const throwawayDir = join(sandbox, "throwaway");
      mkdirSync(reposDir, { recursive: true });
      mkdirSync(throwawayDir, { recursive: true });
      initFixtureRepo(join(reposDir, "anchor-repo"));

      const staleClone = join(throwawayDir, "stale-clone");
      initFixtureRepo(staleClone);
      const hundredHoursAgo = new Date(Date.now() - 100 * 3_600_000);
      utimesSync(staleClone, hundredHoursAgo, hundredHoursAgo);
      const beforeMtime = lstatSync(staleClone).mtimeMs;

      const homesFile = join(sandbox, "homes.json");
      writeFileSync(
        homesFile,
        `${JSON.stringify(
          {
            version: 1,
            repositories: [reposDir],
            noCopy: [],
            throwaway: [{ root: throwawayDir, maxAgeHours: 72 }],
            mirror: [],
            toolOwned: [],
            exceptions: [],
          },
          null,
          2,
        )}\n`,
      );
      const envMap = {
        ...writeFixtureEnv(sandbox),
        TMPDIR: staleClone,
      };
      const { exitCode, data } = runCheckJson(homesFile, envMap);
      const afterMtime = lstatSync(staleClone).mtimeMs;

      expect(exitCode).toBe(3);
      expect(afterMtime).toBe(beforeMtime);
      const findings = listFromData(data, "findings").map((item) => ({
        kind: String(Reflect.get(Object(item), "kind")),
        path: String(Reflect.get(Object(item), "path")),
      }));
      expect(findings).toContainEqual({
        kind: "expired-throwaway",
        path: staleClone,
      });
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
          reason.includes("local commits with no remote configured"),
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
