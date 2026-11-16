// T6 Phase 2b harness: the independently bound cases, unmodified.
// Proof here is the bound expectation matched at BOTH layers (process
// through the real application CLI, component through the one pure
// judgement). Provisional bindings are reported as provisional, stopped
// cases as stopped; neither is counted as proof. Set C3_BINDINGS_RECEIPT to
// a file path to write the totals as JSON.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  admissionPath,
  checkerCommand,
  CHECKER_DIR,
  componentRows,
  disableRulePatch,
  type Expected,
  freshCopy,
  loadExpected,
  loadManifest,
  type Manifest,
  minorsFor,
  perturbedChecker,
  processProblems,
  REPO_ROOT,
  rowProblems,
  runChecker,
  verifyManifest,
} from "./suite.ts";
import {
  minorCompatibility,
  retainedTooling,
  snippetStatus,
  sourceAgreement,
} from "./static-checks.ts";

const MINUTE = 60_000;
let manifest: Manifest;
const receipt: Record<string, unknown> = {
  startedAt: new Date().toISOString(),
};
const outcomes = new Map<string, { matched: boolean; problems: string[] }>();

beforeAll(async () => {
  manifest = await loadManifest();
});

afterAll(async () => {
  const path = process.env.C3_BINDINGS_RECEIPT;
  if (path === undefined) return;
  const results = [...outcomes.entries()];
  const provisional = new Set(
    manifest.bindings
      .filter((binding) => binding.provisional.length > 0)
      .map((binding) => binding.id),
  );
  receipt.bindings = {
    run: results.length,
    passed: results.filter(
      ([id, result]) => result.matched && !provisional.has(id),
    ).length,
    provisionalMatched: results.filter(
      ([id, result]) => result.matched && provisional.has(id),
    ).length,
    failed: results.filter(([, result]) => !result.matched).length,
    notRun: manifest.totals.bindings - results.length,
    stopped: manifest.totals.stopped,
  };
  receipt.mismatches = Object.fromEntries(
    results
      .filter(([, result]) => !result.matched)
      .map(([id, result]) => [id, result.problems]),
  );
  receipt.finishedAt = new Date().toISOString();
  await Bun.write(path, JSON.stringify(receipt, null, 2));
});

test("manifest identity and every SHA-256 verify before any run", async () => {
  expect(await verifyManifest(manifest)).toEqual([]);
  expect(manifest.bindings).toHaveLength(550);
});

async function counterText(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "absent";
  }
}

describe("admitted bindings at both layers", () => {
  test(
    "every admitted binding matches its process and component expectation",
    async () => {
      const processCopy = await freshCopy();
      const componentCopy = await freshCopy();
      const rowTally: Record<string, number> = {};
      const counters: Record<string, string> = {};
      const exits: Record<string, number | null> = {};
      try {
        for (const binding of manifest.bindings) {
          const expected = await loadExpected(processCopy.root, binding.id);
          if (expected.checker === null) continue;
          const problems: string[] = [];
          const counter = expected.harness?.counter as
            | { file: string; before: string; after: string }
            | undefined;
          const counterPath =
            counter === undefined
              ? null
              : join(
                  processCopy.root,
                  "bindings/cases",
                  binding.id,
                  counter.file,
                );
          if (
            counterPath !== null &&
            (await counterText(counterPath)) !== counter?.before
          )
            problems.push("counter present before the run");
          const run = await runChecker(
            checkerCommand(
              expected.reader,
              admissionPath(processCopy.root, binding.id),
            ),
          );
          exits[binding.id] = run.exitCode;
          const processed = processProblems(expected.checker, run);
          problems.push(...processed.problems);
          if (processed.rows !== null)
            problems.push(
              ...rowProblems(expected, processed.rows).map(
                (problem) => `process rows: ${problem}`,
              ),
            );
          if (counterPath !== null) {
            counters[binding.id] = await counterText(counterPath);
            if (counters[binding.id] !== counter?.after)
              problems.push(
                `counter ${JSON.stringify(counters[binding.id])}, expected ${JSON.stringify(counter?.after)}`,
              );
          }
          problems.push(...timingProblems(expected, run.elapsedMs));
          if (expected.rows !== null && expected.rowsUnbound === null) {
            const component = await componentRows(
              componentCopy.root,
              binding.id,
              minorsFor(expected.reader),
            );
            if ("problem" in component) problems.push(component.problem);
            else {
              problems.push(
                ...rowProblems(expected, component.rows).map(
                  (problem) => `component rows: ${problem}`,
                ),
              );
              for (const row of component.rows)
                rowTally[row.status] = (rowTally[row.status] ?? 0) + 1;
            }
          }
          outcomes.set(binding.id, {
            matched: problems.length === 0,
            problems,
          });
        }
      } finally {
        await processCopy.dispose();
        await componentCopy.dispose();
      }
      receipt.componentRowTally = rowTally;
      receipt.noReplayCounters = counters;
      receipt.envelopeExits = Object.fromEntries(
        Object.entries(exits).filter(([id]) => id.startsWith("envelope-exits")),
      );
      const mismatched = [...outcomes.entries()].filter(
        ([, result]) => !result.matched,
      );
      expect(
        Object.fromEntries(
          mismatched.map(([id, result]) => [id, result.problems]),
        ),
      ).toEqual({});
      expect(outcomes.size).toBe(manifest.totals.admitted);
    },
    20 * MINUTE,
  );
});

function timingProblems(expected: Expected, elapsedMs: number): string[] {
  const bounds: Record<string, number> = {
    "observer-exclusions": 5_000 + 500 + 5_000,
    "pattern-isolation": 5_000,
  };
  const rule = expected.harness?.rule as string | undefined;
  const bound = rule === undefined ? undefined : bounds[rule];
  return bound !== undefined && elapsedMs > bound
    ? [`checker took ${Math.round(elapsedMs)} ms, bound ${bound} ms`]
    : [];
}

describe("static blocks (group T)", () => {
  test(
    "minor tables, kept route, table agreement and snippets meet their bindings",
    async () => {
      const results: Record<string, string[]> = {};
      for (const binding of manifest.bindings.filter(
        (item) => item.group === "T",
      )) {
        const expected = await loadExpected(CHECKER_DIR, binding.id);
        const block = expected.static as Record<string, unknown>;
        const problems: string[] = [];
        if (block.input === "table.json") {
          const table = JSON.parse(
            await readFile(
              join(CHECKER_DIR, "bindings/cases", binding.id, "table.json"),
              "utf8",
            ),
          ) as Parameters<typeof minorCompatibility>[0];
          const findings = minorCompatibility(table);
          const wanted = block.findings as { code: string; mentions: string }[];
          const verdict = findings.length === 0 ? "compatible" : "incompatible";
          if (verdict !== block.expected)
            problems.push(
              `verdict ${verdict}, expected ${String(block.expected)}`,
            );
          if (
            findings.length !== wanted.length ||
            !wanted.every((want) =>
              findings.some(
                (finding) =>
                  finding.code === want.code &&
                  finding.message.includes(want.mentions),
              ),
            )
          )
            problems.push(`findings ${JSON.stringify(findings)}`);
        } else if (binding.rule === "retained-tooling") {
          const want = block.expected as Record<string, string>;
          const findings = await retainedTooling(want);
          if (findings.length > 0) problems.push(JSON.stringify(findings));
          const source = await readFile(
            join(REPO_ROOT, "src/domains/contract3-check/kept-checker.ts"),
            "utf8",
          );
          const perturbed = await retainedTooling(
            want,
            source.replace(want.path ?? "", "agent-engineering/src/cli.ts"),
          );
          if (
            !perturbed.some(
              (finding) => finding.code === "RETAINED_2_ROUTE_CHANGED",
            )
          )
            problems.push("negative control did not fail");
        } else if (binding.rule === "source-agreement") {
          const findings = await sourceAgreement(
            block.expected as Parameters<typeof sourceAgreement>[0],
          );
          if (findings.length > 0) problems.push(JSON.stringify(findings));
        } else if (binding.rule === "snippet-status") {
          const documents = {
            "INTERFACE.md": await readFile(
              join(CHECKER_DIR, "INTERFACE.md"),
              "utf8",
            ),
          };
          const status = snippetStatus(documents);
          if (status.findings.length > 0)
            problems.push(JSON.stringify(status.findings));
          receipt.snippetStatus = {
            snippets: status.snippets,
            typescript: status.typescript,
          };
          const negative = snippetStatus({
            probe: "```ts\nconst unproved = 1;\n```\n",
          });
          if (
            !negative.findings.some(
              (finding) => finding.code === "SNIPPET_PROOF_MISSING",
            )
          )
            problems.push("negative control did not fail");
        }
        results[binding.id] = problems;
        outcomes.set(binding.id, { matched: problems.length === 0, problems });
      }
      expect(Object.keys(results)).toHaveLength(manifest.totals.static);
      expect(
        Object.fromEntries(
          Object.entries(results).filter(([, problems]) => problems.length > 0),
        ),
      ).toEqual({});
    },
    MINUTE,
  );

  test("source-agreement negative control: one exit changed in the typed owner alone is drift", async () => {
    const perturbed = await perturbedChecker(
      "result-table.ts",
      "  transient: 75,\n",
      "  transient: 3,\n",
    );
    try {
      const findings = await sourceAgreement(
        {
          exitOwner: {
            success: 0,
            internal: 1,
            usage: 2,
            domain: 3,
            schema: 4,
            transient: 75,
          },
          signalExits: { "130": "SIGINT", "143": "SIGTERM" },
        },
        join(perturbed.cli, "../domains/contract3-check"),
      );
      expect(
        findings.some((finding) => finding.code === "CONTRACT_TABLE_DRIFT"),
      ).toBe(true);
    } finally {
      await perturbed.dispose();
    }
  });
});

async function processWith(
  cli: string,
  id: string,
): Promise<{ problems: string[]; counter: string; elapsedMs: number }> {
  const copy = await freshCopy();
  try {
    const expected = await loadExpected(copy.root, id);
    const run = await runChecker(
      checkerCommand(expected.reader, admissionPath(copy.root, id), cli),
    );
    const processed =
      expected.checker === null
        ? { problems: ["no checker block"], rows: null }
        : processProblems(expected.checker, run);
    const problems = [
      ...processed.problems,
      ...(processed.rows === null ? [] : rowProblems(expected, processed.rows)),
    ];
    const counter = expected.harness?.counter as { file: string } | undefined;
    return {
      problems,
      counter:
        counter === undefined
          ? "none"
          : await counterText(
              join(copy.root, "bindings/cases", id, counter.file),
            ),
      elapsedMs: run.elapsedMs,
    };
  } finally {
    await copy.dispose();
  }
}

describe("harness blocks and their sensitivity controls", () => {
  test(
    "no-replay: a checker that reruns the target makes the counter 2 and the harness fails",
    async () => {
      const perturbed = await perturbedChecker(
        "command.ts",
        "    const observation = await observeCase(item);\n",
        '    const observation = await observeCase(item);\n    if (item.target.kind === "run") await observeCase(item);\n',
      );
      const counters: Record<string, string> = {};
      try {
        for (const binding of manifest.bindings.filter(
          (item) => item.rule === "no-replay",
        )) {
          const result = await processWith(perturbed.cli, binding.id);
          counters[binding.id] = result.counter;
        }
      } finally {
        await perturbed.dispose();
      }
      receipt.noReplaySensitivity = counters;
      expect(Object.values(counters)).toHaveLength(10);
      expect(
        Object.values(counters).every((counter) => counter === "2\n"),
      ).toBe(true);
    },
    5 * MINUTE,
  );

  test(
    "observer-exclusions: dropping timed_out rows fails the identity set",
    async () => {
      const perturbed = await perturbedChecker(
        "book.ts",
        "    return cases.flatMap((item) =>\n",
        '    return cases.flatMap((item) =>\n      item.caseId.endsWith("/hang") ? [] :\n',
      );
      try {
        const result = await processWith(
          perturbed.cli,
          "observer-exclusions.valid",
        );
        expect(
          result.problems.some((problem) =>
            problem.includes("identity set differs"),
          ),
        ).toBe(true);
      } finally {
        await perturbed.dispose();
      }
    },
    2 * MINUTE,
  );

  test("open-cause: a checker that rejects unknown host causes no longer matches", async () => {
    const perturbed = await perturbedChecker(
      "process-rules.ts",
      '    c.touch("open-cause");\n',
      '    c.fail("open-cause", "perturbed: unknown cause rejected");\n',
    );
    try {
      const result = await processWith(perturbed.cli, "open-cause.valid");
      expect(result.problems.length).toBeGreaterThan(0);
    } finally {
      await perturbed.dispose();
    }
  });

  test("raw-retention: no file appears or changes in the copy or the repository", async () => {
    const copy = await freshCopy();
    try {
      const before = await listing([
        copy.root,
        join(REPO_ROOT, "src"),
        join(REPO_ROOT, "tests"),
      ]);
      const run = await runChecker(
        checkerCommand(
          "production-3.0.0",
          admissionPath(copy.root, "raw-retention.valid"),
        ),
      );
      const after = await listing([
        copy.root,
        join(REPO_ROOT, "src"),
        join(REPO_ROOT, "tests"),
      ]);
      expect(run.exitCode).toBe(0);
      expect(after).toEqual(before);
    } finally {
      await copy.dispose();
    }
    const perturbed = await perturbedChecker(
      "runner.ts",
      "  await child.exited;\n  clearTimeout(timer);\n",
      "  await child.exited;\n  clearTimeout(timer);\n  await Bun.write(`${spec.cwd}/retained.stdout`, stdout.bytes);\n",
    );
    const leakCopy = await freshCopy();
    try {
      const before = await listing([leakCopy.root]);
      await runChecker(
        checkerCommand(
          "production-3.0.0",
          admissionPath(leakCopy.root, "raw-retention.valid"),
          perturbed.cli,
        ),
      );
      expect(await listing([leakCopy.root])).not.toEqual(before);
    } finally {
      await leakCopy.dispose();
      await perturbed.dispose();
    }
  });

  test(
    "pattern-isolation lifecycle: SIGTERM during the second target run ends the checker with 143 within 500 ms",
    async () => {
      const copy = await freshCopy();
      try {
        let signalledAt: number | null = null;
        const run = await runChecker(
          checkerCommand(
            "production-3.0.0",
            admissionPath(copy.root, "pattern-isolation.lifecycle"),
          ),
          (child) => {
            const poll = setInterval(() => {
              if (secondTargetRunning(child.pid)) {
                clearInterval(poll);
                signalledAt = performance.now();
                child.kill("SIGTERM");
              }
            }, 5);
            void child.exited.then(() => clearInterval(poll));
          },
        );
        const finishedAt = performance.now();
        receipt.lifecycle = {
          exitCode: run.exitCode,
          signal: run.signal,
          signalled: signalledAt !== null,
          msAfterSignal:
            signalledAt === null ? null : Math.round(finishedAt - signalledAt),
        };
        if (signalledAt === null) expect(run.exitCode).toBe(4);
        else {
          expect(run.exitCode === 143 || run.signal === "SIGTERM").toBe(true);
          expect(run.stdout).toBe("");
          expect(finishedAt - signalledAt).toBeLessThan(500 + 250);
        }
      } finally {
        await copy.dispose();
      }
    },
    MINUTE,
  );

  test(
    "pattern-isolation sensitivity: a synchronous match with no budget breaks the elapsed bound",
    async () => {
      const perturbed = await perturbedChecker(
        "pattern.ts",
        '    if (patternTooLarge(source)) return Promise.resolve("budget");\n',
        '    return Promise.resolve(new RegExp(`^(?:${source})$`, "u").test(subject) ? "match" : "no-match");\n    if (patternTooLarge(source)) return Promise.resolve("budget");\n',
      );
      try {
        const result = await processWith(
          perturbed.cli,
          "pattern-isolation.elapsed",
        );
        receipt.patternIsolationSensitivity = {
          problems: result.problems.slice(0, 3),
          elapsedMs: Math.round(result.elapsedMs),
        };
        expect(result.problems.length > 0 || result.elapsedMs > 5_000).toBe(
          true,
        );
      } finally {
        await perturbed.dispose();
      }
    },
    5 * MINUTE,
  );
});

describe("SUPPORTING (not a binding): signal forwarding while a target runs", () => {
  test(
    "SIGTERM during the hanging target run stops the target and the checker exits 143 with no envelope",
    async () => {
      const copy = await freshCopy();
      try {
        let signalledAt = 0;
        const run = await runChecker(
          checkerCommand(
            "production-3.0.0",
            admissionPath(copy.root, "observer-exclusions.valid"),
          ),
          (child) => {
            setTimeout(() => {
              signalledAt = performance.now();
              child.kill("SIGTERM");
            }, 1_000);
          },
        );
        const elapsed = performance.now() - signalledAt;
        const survivors = Bun.spawnSync(["ps", "-A", "-o", "command="])
          .stdout.toString()
          .split("\n")
          .filter((line) => line.includes(copy.root));
        receipt.signalForwarding = {
          exitCode: run.exitCode,
          signal: run.signal,
          msAfterSignal: Math.round(elapsed),
          survivors: survivors.length,
        };
        expect(run.exitCode === 143 || run.signal === "SIGTERM").toBe(true);
        expect(run.stdout).toBe("");
        expect(elapsed).toBeLessThan(500 + 250);
        expect(survivors).toEqual([]);
      } finally {
        await copy.dispose();
      }
    },
    MINUTE,
  );
});

function secondTargetRunning(checkerPid: number): boolean {
  const table = Bun.spawnSync([
    "ps",
    "-A",
    "-o",
    "pid=,ppid=,command=",
  ]).stdout.toString();
  return table.split("\n").some((line) => {
    const [, ppid, ...command] = line.trim().split(/\s+/);
    return (
      Number(ppid) === checkerPid &&
      command.join(" ").includes("target.mjs find")
    );
  });
}

async function listing(roots: string[]): Promise<string[]> {
  const entries: string[] = [];
  for (const root of roots)
    for (const name of (await readdir(root, { recursive: true })).sort()) {
      const info = await stat(join(root, name));
      entries.push(`${name}:${info.isFile() ? info.size : "dir"}`);
    }
  return entries;
}

describe("rule sensitivity (checker-rule-disabled)", () => {
  test(
    "disabling each negative's target rule alone makes that binding stop matching",
    async () => {
      const applies = manifest.procedures[0]?.appliesTo ?? [];
      const byId = new Map(
        manifest.bindings.map((binding) => [binding.id, binding]),
      );
      const stillMatching: string[] = [];
      const rules = [...new Set(applies.map((id) => byId.get(id)?.rule ?? ""))];
      for (const rule of rules) {
        const perturbed = await perturbedChecker(...disableRulePatch(rule));
        const copy = await freshCopy();
        try {
          const modules = await perturbed.modules();
          for (const id of applies.filter(
            (item) => byId.get(item)?.rule === rule,
          )) {
            const expected = await loadExpected(copy.root, id);
            const component = await componentRows(
              copy.root,
              id,
              minorsFor(expected.reader),
              modules,
            );
            const problems =
              "problem" in component
                ? [component.problem]
                : rowProblems(expected, component.rows);
            if (problems.length === 0) stillMatching.push(id);
          }
        } finally {
          await copy.dispose();
          await perturbed.dispose();
        }
      }
      receipt.ruleDisabledSweep = {
        negatives: applies.length,
        rules: rules.length,
        stillMatching,
      };
      expect(applies).toHaveLength(334);
      expect(stillMatching).toEqual([]);
    },
    30 * MINUTE,
  );
});

test("stopped cases are reported as stopped, never run or passed", async () => {
  const stopped = JSON.parse(
    await readFile(join(CHECKER_DIR, "bindings/STOPPED.json"), "utf8"),
  ) as { cases: { id: string; reason: string }[] };
  receipt.stopped = stopped.cases.map((item) => ({
    id: item.id,
    reason: item.reason,
  }));
  expect(stopped.cases.map((item) => item.id).sort()).toEqual([
    "diagnostics-absent.negative",
    "diagnostics-absent.valid",
    "fallback-version.negative",
    "minor-meaning.negative",
  ]);
  expect(stopped.cases.every((item) => !outcomes.has(item.id))).toBe(true);
});
