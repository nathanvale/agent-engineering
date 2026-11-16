// SUPPORTING TESTS (T6 Phase 2a). Real child processes exercise the
// single-execution runner and admission handling through runCheck, the
// major-agnostic command core. Not bound cases; no V row is proved here.
// Target programs are throwaway inline scripts written to a temp directory.

import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCheck } from "../../../../src/domains/contract3-check/command.ts";
import { PatternMatcher } from "../../../../src/domains/contract3-check/pattern.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function workspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "c3-checker-supporting-"));
  roots.push(root);
  return root;
}

const COUNTING_TARGET = `
import { appendFileSync } from "node:fs";
appendFileSync(process.env.COUNTER_PATH ?? "", "x");
const seen = { env: Object.keys(process.env).sort(), stdinBytes: 0 };
for await (const chunk of Bun.stdin.stream()) seen.stdinBytes += chunk.length;
await Bun.write(process.env.SEEN_PATH ?? "", JSON.stringify(seen));
process.stdout.write(process.env.OUTPUT ?? "");
`;

async function admit(
  root: string,
  output: string,
  extra: Record<string, unknown> = {},
) {
  await writeFile(join(root, "target.ts"), COUNTING_TARGET);
  const admission = {
    admissionVersion: 1,
    cli: "t",
    cases: [
      {
        caseId: "supporting.one",
        rules: ["json-framing"],
        role: "command",
        mode: "machine",
        target: {
          kind: "run",
          program: "bun-runtime",
          args: ["target.ts"],
          env: {
            COUNTER_PATH: join(root, "counter"),
            SEEN_PATH: join(root, "seen.json"),
            OUTPUT: output,
          },
        },
        ...extra,
      },
    ],
  };
  const path = join(root, "admission.json");
  await writeFile(path, JSON.stringify(admission));
  return path;
}

describe("single execution", () => {
  test("truncated output is refused after exactly one execution, with no inherited stdin or environment", async () => {
    const root = await workspace();
    process.env.C3_SUPPORTING_SENTINEL = "must-not-leak";
    const checked = await runCheck([
      "--admission",
      await admit(root, '{"contractVersion":"3.0.0"'),
    ]);
    delete process.env.C3_SUPPORTING_SENTINEL;
    expect(checked.station).toBe("invalid-input");
    expect(checked.data).toBeNull();
    expect(checked.message).toContain("did not and will not rerun");
    expect(await readFile(join(root, "counter"), "utf8")).toBe("x");
    const seen = JSON.parse(
      await readFile(join(root, "seen.json"), "utf8"),
    ) as { env: string[]; stdinBytes: number };
    expect(seen.stdinBytes).toBe(0);
    expect(seen.env).not.toContain("C3_SUPPORTING_SENTINEL");
    expect(seen.env).not.toContain("HOME");
  });

  test("a 2.0.0 envelope is refused as unsupported after one execution", async () => {
    const root = await workspace();
    const checked = await runCheck([
      "--admission",
      await admit(root, '{"contractVersion":"2.0.0","envelopeVersion":2}\n'),
    ]);
    expect(checked.station).toBe("unsupported-contract");
    expect(await readFile(join(root, "counter"), "utf8")).toBe("x");
  });
});

describe("admission refusals run no target", () => {
  test("an unknown rule is invalid input", async () => {
    const root = await workspace();
    const path = await admit(root, "", { rules: ["not-a-rule"] });
    const checked = await runCheck(["--admission", path]);
    expect(checked.station).toBe("invalid-input");
    expect(checked.message).toContain("not-a-rule");
    expect(await Bun.file(join(root, "counter")).exists()).toBe(false);
  });

  test("a harness-owned rule is refused with its owner named", async () => {
    const root = await workspace();
    const checked = await runCheck([
      "--admission",
      await admit(root, "", { rules: ["no-replay"] }),
    ]);
    expect(checked.station).toBe("invalid-input");
    expect(checked.message).toContain("process test harness");
  });

  test("a missing admission file is an unmet precondition", async () => {
    const root = await workspace();
    const checked = await runCheck(["--admission", join(root, "absent.json")]);
    expect(checked.station).toBe("precondition");
  });

  test("anything but one --admission value is usage", async () => {
    for (const args of [
      [],
      ["--admission"],
      ["--admission=x"],
      ["--admission", "a", "b"],
    ])
      expect((await runCheck(args)).station).toBe("usage");
  });
});

describe("pattern boundary", () => {
  test("catastrophic backtracking hits the finite budget and the reader stays responsive", async () => {
    const started = Date.now();
    const result = await new PatternMatcher().match("(a+)+b", "a".repeat(40));
    expect(result).toBe("budget");
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(await new PatternMatcher().match("[a-z]+", "abc")).toBe("match");
    expect(await new PatternMatcher().match("[a-z]+", "abc1")).toBe("no-match");
  });
});
