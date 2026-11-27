import { expect, test } from "bun:test";
import { resolveLoopbackTest } from "./support/loopback-connect-probe.ts";

test("skips with reason when loopback connect is refused without CI, fails loudly under CI=true, and runs when allowed", async () => {
  const recorded: Array<{
    readonly mode: "run" | "skip";
    readonly name: string;
  }> = [];
  const registrar = {
    run(name: string, _fn: () => void | Promise<void>) {
      recorded.push({ mode: "run", name });
    },
    skip(name: string, _fn: () => void | Promise<void>) {
      recorded.push({ mode: "skip", name });
    },
  };

  const skippedTest = await resolveLoopbackTest({
    probe: () => Promise.resolve(false),
    env: {},
    register: registrar,
  });
  skippedTest("daemon loss check", () => undefined);
  expect(recorded).toEqual([
    {
      mode: "skip",
      name: "daemon loss check (loopback connect refused by sandbox)",
    },
  ]);

  let ciError: unknown;
  try {
    await resolveLoopbackTest({
      probe: () => Promise.resolve(false),
      env: { CI: "true" },
      register: registrar,
    });
  } catch (error) {
    ciError = error;
  }
  expect(ciError).toBeInstanceOf(Error);
  expect(ciError instanceof Error ? ciError.message : "").toMatch(
    /loopback-connect-probe.*loopback connect refused by sandbox/,
  );

  const liveTest = await resolveLoopbackTest({
    probe: () => Promise.resolve(true),
    env: { CI: "true" },
    register: registrar,
  });
  liveTest("daemon loss check", () => undefined);
  expect(recorded).toEqual([
    {
      mode: "skip",
      name: "daemon loss check (loopback connect refused by sandbox)",
    },
    {
      mode: "run",
      name: "daemon loss check",
    },
  ]);
});
