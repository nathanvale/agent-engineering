// T6 Phase 2b test harness: the independently bound cases, unmodified.
// Proof here is the bound expectation matched at BOTH layers (process
// through the real application CLI, component through the one pure
// judgement). Provisional bindings are reported as provisional, stopped
// cases as stopped; neither is counted as proof. Set C3_BINDINGS_RECEIPT to
// a file path to write the totals as JSON.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { BUDGETS } from "../../../../src/domains/contract3-check/budgets.ts";
import { readFileSync } from "node:fs";
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
  type ProcessRun,
  processProblems,
  REPO_ROOT,
  rowProblems,
  runChecker,
  verifyManifest,
} from "./suite.ts";
import {
  EXIT_OWNER,
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
/** unproved: the binding matched but its property is vacuous or not observed; never counted as passed. */
const outcomes = new Map<string, { matched: boolean; problems: string[] }>();
/** Properties a passing test did not prove; each is reported, never counted as proof. */
const unprovedProperties: { id: string; reason: string }[] = [];

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
  // F6, F-1: one source. A binding in unprovedProperties is unproved and
  // never passed, whichever block recorded it.
  const unprovedIds = new Set(unprovedProperties.map((item) => item.id));
  receipt.bindings = {
    run: results.length,
    passed: results.filter(
      ([id, result]) =>
        result.matched && !provisional.has(id) && !unprovedIds.has(id),
    ).length,
    provisionalMatched: results.filter(
      ([id, result]) =>
        result.matched && provisional.has(id) && !unprovedIds.has(id),
    ).length,
    unproved: results.filter(
      ([id, result]) => result.matched && unprovedIds.has(id),
    ).length,
    failed: results.filter(([, result]) => !result.matched).length,
    notRun: manifest.totals.bindings - results.length,
    stopped: manifest.totals.stopped,
  };
  receipt.unprovedProperties = unprovedProperties;
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

interface CounterBlock {
  file: string;
  before: string;
  after: string;
}

/** Every counter a binding names: harness.counter and harness.additionalCounters (B4). */
function countersOf(expected: Expected): CounterBlock[] {
  const harness = expected.harness;
  if (harness === null) return [];
  const extra: unknown = harness.additionalCounters;
  const additional: unknown[] = Array.isArray(extra)
    ? extra.map((item: unknown) => item)
    : [];
  const blocks: unknown[] = [harness.counter, ...additional];
  return blocks.filter(
    (block): block is CounterBlock =>
      typeof block === "object" &&
      block !== null &&
      "file" in block &&
      typeof block.file === "string" &&
      "before" in block &&
      typeof block.before === "string" &&
      "after" in block &&
      typeof block.after === "string",
  );
}

async function counterText(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "absent";
  }
}

describe("bound cases at both layers", () => {
  test(
    "every bound case matches its process and component expectation",
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
          const counterBlocks = countersOf(expected);
          const counterPath = (block: CounterBlock) =>
            join(processCopy.root, "bindings/cases", binding.id, block.file);
          for (const block of counterBlocks)
            if ((await counterText(counterPath(block))) !== block.before)
              problems.push(`counter ${block.file} present before the run`);
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
          for (const block of counterBlocks) {
            const text = await counterText(counterPath(block));
            counters[`${binding.id}:${block.file}`] = text;
            if (text !== block.after)
              problems.push(
                `counter ${block.file} ${JSON.stringify(text)}, expected ${JSON.stringify(block.after)}`,
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
  // Binder bound: run budget + kill grace + 5,000 ms checker slack.
  const blockedTargetBound =
    BUDGETS.TARGET_RUN_MAX_MS + BUDGETS.TARGET_KILL_GRACE_MS + 5_000;
  const bounds: Record<string, number> = {
    "observer-exclusions": blockedTargetBound,
    "pattern-isolation": 5_000,
  };
  const rule = expected.harness?.rule as string | undefined;
  // B8: a binding that announces a blocked target run (harness.announce) is
  // unsignalled in the main loop, so its target runs to TARGET_RUN_MAX_MS.
  const bound =
    expected.harness?.announce !== undefined
      ? blockedTargetBound
      : rule === undefined
        ? undefined
        : bounds[rule];
  return bound !== undefined && elapsedMs > bound
    ? [`checker took ${Math.round(elapsedMs)} ms, bound ${bound} ms`]
    : [];
}

/** S5: the checker's help (human and machine) and its interface documentation. */
async function checkerHelpAndDocumentation(): Promise<Record<string, string>> {
  const help = (json: boolean) =>
    Bun.spawnSync({
      cmd: [
        process.execPath,
        "run",
        join(REPO_ROOT, "src/cli.ts"),
        "--help",
        ...(json ? ["--json"] : []),
      ],
      cwd: REPO_ROOT,
    }).stdout.toString();
  const discovery = Bun.spawnSync({
    cmd: [
      process.execPath,
      "run",
      join(REPO_ROOT, "src/cli.ts"),
      "--discover-command",
      "example.contract3.check",
      "--json",
    ],
    cwd: REPO_ROOT,
  }).stdout.toString();
  return {
    "INTERFACE.md": await readFile(join(CHECKER_DIR, "INTERFACE.md"), "utf8"),
    "help (human)": help(false),
    "help (machine)": help(true),
    "command discovery": discovery,
  };
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
          const documents = await checkerHelpAndDocumentation();
          const status = snippetStatus(documents);
          if (status.findings.length > 0)
            problems.push(JSON.stringify(status.findings));
          receipt.snippetStatus = {
            documents: Object.keys(documents),
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
          if (status.typescript === 0) {
            const reason = `UNPROVED (vacuous): the checker's help and documentation hold ${status.snippets} fenced snippets and no TypeScript snippet, so no snippet's proof status is exercised.`;
            unprovedProperties.push({ id: binding.id, reason });
          }
        } else problems.push(`unhandled static rule ${binding.rule}`);
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
          exitOwner: { ...EXIT_OWNER },
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

function messageOf(stdout: string): string {
  try {
    const envelope: unknown = JSON.parse(stdout);
    return typeof envelope === "object" &&
      envelope !== null &&
      "message" in envelope &&
      typeof envelope.message === "string"
      ? envelope.message
      : "";
  } catch {
    return "";
  }
}

function causeOf(stdout: string): string | null {
  try {
    const envelope: unknown = JSON.parse(stdout);
    if (
      typeof envelope !== "object" ||
      envelope === null ||
      !("result" in envelope)
    )
      return null;
    const result: unknown = envelope.result;
    return typeof result === "object" &&
      result !== null &&
      "causeCode" in result &&
      typeof result.causeCode === "string"
      ? result.causeCode
      : null;
  } catch {
    return null;
  }
}

async function processWith(
  cli: string,
  id: string,
): Promise<{
  problems: string[];
  counters: Record<string, string>;
  elapsedMs: number;
  exitCode: number | null;
  causeCode: string | null;
}> {
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
    const counters: Record<string, string> = {};
    for (const block of countersOf(expected))
      counters[block.file] = await counterText(
        join(copy.root, "bindings/cases", id, block.file),
      );
    return {
      problems,
      counters,
      elapsedMs: run.elapsedMs,
      exitCode: run.exitCode,
      causeCode: causeOf(run.stdout),
    };
  } finally {
    await copy.dispose();
  }
}

describe("harness blocks and their sensitivity controls", () => {
  test(
    "no-replay: a checker that reruns its targets makes every counter 2 and the harness fails",
    async () => {
      const perturbed = await perturbedChecker(
        "observe.ts",
        "    const observation = await observeCase(item);\n",
        '    const observation = await observeCase(item);\n    if (item.target.kind === "run") await observeCase(item);\n',
      );
      const counters: Record<string, string> = {};
      try {
        for (const binding of manifest.bindings.filter(
          (item) => item.rule === "no-replay",
        )) {
          const result = await processWith(perturbed.cli, binding.id);
          for (const [file, text] of Object.entries(result.counters))
            counters[`${binding.id}:${file}`] = text;
        }
      } finally {
        await perturbed.dispose();
      }
      receipt.noReplaySensitivity = counters;
      // 12 counted targets in 10 bindings (B4 adds the input run's counter).
      expect(Object.values(counters)).toHaveLength(12);
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
    "pattern-isolation lifecycle: SIGTERM after the announcement ends the checker with 143 within 500 ms and no target survives",
    async () => {
      const result = await lifecycleRun();
      const problems = lifecycleProblems(result);
      receipt.lifecycle = {
        announced: result.announced,
        exitCode: result.run.exitCode,
        signal: result.run.signal,
        msAfterSignal: result.msAfterSignal,
        targetPids: result.targetPids.length,
        survivors: result.survivors.length,
        problems,
      };
      const verdict = !result.announced
        ? "UNPROVED"
        : problems.length === 0
          ? "PROVED"
          : "FAILED";
      // An explicit line for the hosted run: which path the binding took.
      process.stdout.write(
        `C3-LIFECYCLE binding=${LIFECYCLE_ID} platform=${process.platform}-${process.arch} path=${result.announced ? "signal-after-announcement" : "no-announcement"} exit=${String(result.run.exitCode)} signal=${String(result.run.signal)} msAfterSignal=${String(result.msAfterSignal)} survivors=${result.survivors.length} verdict=${verdict}\n`,
      );
      if (!result.announced) {
        // B8: never signalled, so the property was not observed. Reported,
        // never counted as passed.
        unprovedProperties.push({
          id: LIFECYCLE_ID,
          reason:
            "UNPROVED: the second target run's announcement (harness.announce) was never read, so SIGTERM was not sent while that run was in flight.",
        });
        return;
      }
      if (problems.length > 0) {
        // The main loop's unsignalled match is not enough: the binding failed.
        const prior = outcomes.get(LIFECYCLE_ID)?.problems ?? [];
        outcomes.set(LIFECYCLE_ID, {
          matched: false,
          problems: [...prior, ...problems.map((item) => `lifecycle: ${item}`)],
        });
      }
      expect(problems).toEqual([]);
    },
    MINUTE,
  );

  test(
    "pattern-isolation lifecycle sensitivity: a checker that ignores SIGTERM during a target run, or does not forward it, fails the assertion",
    async () => {
      // The binding's two named controls (B8), each in its own perturbed copy.
      const controls = {
        "ignore-sigterm-while-target-runs": [
          "runner.ts",
          '  process.on("SIGTERM", () => stop(143));\n',
          '  process.on("SIGTERM", () => {\n    if (activeChild === null) stop(143);\n  });\n',
        ],
        "no-forwarding-to-target": [
          "runner.ts",
          '    if (child === null) process.exit(exitCode);\n    child.kill("SIGTERM");\n',
          "    process.exit(exitCode);\n",
        ],
      } as const;
      const measured: Record<string, unknown> = {};
      for (const [name, [file, find, replace]] of Object.entries(controls)) {
        const perturbed = await perturbedChecker(file, find, replace);
        try {
          const result = await lifecycleRun(perturbed.cli);
          const problems = lifecycleProblems(result);
          measured[name] = {
            announced: result.announced,
            exitCode: result.run.exitCode,
            msAfterSignal: result.msAfterSignal,
            survivors: result.survivors.length,
            problems,
          };
          expect(result.announced).toBe(true);
          expect(problems).not.toEqual([]);
        } finally {
          await perturbed.dispose();
        }
      }
      receipt.lifecycleSensitivity = measured;
    },
    2 * MINUTE,
  );

  test(
    "pattern-isolation sensitivity: a synchronous match with no budget fails by the time bound or by a wrong exit or cause",
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
          exitCode: result.exitCode,
          causeCode: result.causeCode,
          elapsedMs: Math.round(result.elapsedMs),
        };
        // The corrected binding's control (B1): the bound refusal (exit 4,
        // SCHEMA_INVALID_INPUT within 5,000 ms) must not hold.
        const boundRefusal =
          result.elapsedMs <= 5_000 &&
          result.exitCode === 4 &&
          result.causeCode === "SCHEMA_INVALID_INPUT";
        expect(boundRefusal).toBe(false);
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
        const sent = { at: 0, pids: [] as number[] };
        const run = await runChecker(
          checkerCommand(
            "production-3.0.0",
            admissionPath(copy.root, "observer-exclusions.valid"),
          ),
          (child) => {
            setTimeout(() => {
              sent.pids = targetProcesses(child.pid);
              sent.at = performance.now();
              child.kill("SIGTERM");
            }, 1_000);
          },
        );
        const elapsed = performance.now() - sent.at;
        const survivors = await survivingProcesses(sent.pids);
        receipt.signalForwarding = {
          exitCode: run.exitCode,
          signal: run.signal,
          msAfterSignal: Math.round(elapsed),
          targetPids: sent.pids.length,
          survivors: survivors.length,
        };
        expect(run.exitCode === 143 || run.signal === "SIGTERM").toBe(true);
        expect(run.stdout).toBe("");
        expect(elapsed).toBeLessThan(500 + 250);
        expect(sent.pids).not.toEqual([]);
        expect(survivors).toEqual([]);
      } finally {
        await copy.dispose();
      }
    },
    MINUTE,
  );
});

const LIFECYCLE_ID = "pattern-isolation.lifecycle";

interface LifecycleRun {
  /** The harness read harness.announce before the checker ended. */
  announced: boolean;
  run: ProcessRun;
  msAfterSignal: number | null;
  /** Target processes under the checker when the announcement was read. */
  targetPids: number[];
  survivors: number[];
}

/**
 * B8: run the lifecycle binding, poll its harness.announce file, and send
 * SIGTERM only after reading the announced line. A run whose announcement
 * never appears is unsignalled and reported as not announced.
 */
async function lifecycleRun(cli?: string): Promise<LifecycleRun> {
  const copy = await freshCopy();
  try {
    const expected = await loadExpected(copy.root, LIFECYCLE_ID);
    const announce = expected.harness?.announce;
    if (
      typeof announce !== "object" ||
      announce === null ||
      !("file" in announce) ||
      typeof announce.file !== "string" ||
      !("line" in announce) ||
      typeof announce.line !== "string"
    )
      throw new Error(`${LIFECYCLE_ID} has no harness.announce { file, line }`);
    const statePath = join(
      copy.root,
      "bindings/cases",
      LIFECYCLE_ID,
      announce.file,
    );
    const line = announce.line;
    const sent = { at: null as number | null, pids: [] as number[] };
    const run = await runChecker(
      checkerCommand(
        expected.reader,
        admissionPath(copy.root, LIFECYCLE_ID),
        cli,
      ),
      (child) => {
        const poll = setInterval(() => {
          if (!announcedIn(statePath, line)) return;
          clearInterval(poll);
          sent.pids = targetProcesses(child.pid);
          sent.at = performance.now();
          child.kill("SIGTERM");
        }, 5);
        void child.exited.then(() => clearInterval(poll));
      },
    );
    const finishedAt = performance.now();
    const survivors = await survivingProcesses(sent.pids);
    // Never leave a perturbed checker's orphaned target running.
    for (const pid of survivors) process.kill(pid, "SIGKILL");
    return {
      announced: sent.at !== null,
      run,
      msAfterSignal: sent.at === null ? null : Math.round(finishedAt - sent.at),
      targetPids: sent.pids,
      survivors,
    };
  } finally {
    await copy.dispose();
  }
}

/** The binding's assertion on an announced run; empty means it holds. */
function lifecycleProblems(result: LifecycleRun): string[] {
  if (!result.announced) return [];
  const { run } = result;
  const problems: string[] = [];
  if (!(run.exitCode === 143 || run.signal === "SIGTERM"))
    problems.push(
      `exit ${String(run.exitCode)} signal ${String(run.signal)}, expected 143`,
    );
  if (run.stdout !== "")
    problems.push(`stdout ${run.stdout.length} chars, expected empty`);
  if (result.msAfterSignal === null || result.msAfterSignal > 500)
    problems.push(
      `ended ${String(result.msAfterSignal)} ms after the signal, bound 500 ms`,
    );
  if (result.targetPids.length === 0)
    problems.push("no target process found when the announcement was read");
  if (result.survivors.length > 0)
    problems.push(`${result.survivors.length} target process(es) survived`);
  return problems;
}

function announcedIn(path: string, line: string): boolean {
  try {
    return readFileSync(path, "utf8").split("\n").includes(line);
  } catch {
    return false;
  }
}

/** Specimen target processes descended from the checker, by process id. */
function targetProcesses(checkerPid: number): number[] {
  const rows = Bun.spawnSync(["ps", "-A", "-o", "pid=,ppid=,command="])
    .stdout.toString()
    .split("\n")
    .map((row) => row.trim().split(/\s+/))
    .filter((cells) => cells.length >= 3)
    .map(([pid, ppid, ...command]) => ({
      pid: Number(pid),
      ppid: Number(ppid),
      command: command.join(" "),
    }));
  const descendants = new Set([checkerPid]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const row of rows)
      if (descendants.has(row.ppid) && !descendants.has(row.pid)) {
        descendants.add(row.pid);
        grew = true;
      }
  }
  return rows
    .filter(
      (row) => descendants.has(row.pid) && row.command.includes("target.mjs"),
    )
    .map((row) => row.pid);
}

/** Processes still alive after a short reaping grace (an exited child may linger until reaped). */
async function survivingProcesses(pids: number[]): Promise<number[]> {
  const alive = () =>
    pids.filter((pid) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    });
  const deadline = performance.now() + 250;
  while (alive().length > 0 && performance.now() < deadline)
    await Bun.sleep(10);
  return alive();
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
      const sensitiveByExitAndCause: string[] = [];
      const sensitiveByMessageOnly: string[] = [];
      const overDetermined: Record<
        string,
        { cause: string; process: string; message: string }
      > = {};
      const unexplained: string[] = [];
      const rules = [...new Set(applies.map((id) => byId.get(id)?.rule ?? ""))];
      for (const rule of rules) {
        const perturbed = await perturbedChecker(...disableRulePatch(rule));
        const copy = await freshCopy();
        const processCopy = await freshCopy();
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
            // Process layer: the perturbed real CLI on the same admission.
            const run = await runChecker(
              checkerCommand(
                expected.reader,
                admissionPath(processCopy.root, id),
                perturbed.cli,
                perturbed.reader,
              ),
            );
            const processed =
              expected.checker === null
                ? { problems: ["no checker block"], rows: null }
                : processProblems(expected.checker, run);
            const exitOrCauseChanged =
              expected.checker !== null &&
              (run.exitCode !== expected.checker.exitCode ||
                causeOf(run.stdout) !== expected.checker.causeCode);
            if (exitOrCauseChanged) sensitiveByExitAndCause.push(id);
            else if (processed.problems.length > 0)
              sensitiveByMessageOnly.push(id);
            else {
              // F-2: the cause comes from the perturbed judgement's own failed
              // rule ids, never from a list.
              const others =
                "problem" in component
                  ? []
                  : component.failedRules.filter((other) => other !== rule);
              const kind =
                "problem" in component ? null : component.refusalKind;
              const classified =
                kind === "malformed" ||
                kind === "other-major" ||
                kind === "newer-minor";
              const admissionRefused = "problem" in component;
              const cause = admissionRefused
                ? "refused by admission validation before any observation; no rule finding exists"
                : others.length > 0
                  ? `also refused by always-judged rules: ${others.join(", ")}`
                  : classified
                    ? `refused by the VER-10 version classification (${String(kind)}) before any finding`
                    : kind === "broken"
                      ? "refused by the framing or stream-budget check itself before any finding"
                      : `refused with no remaining finding (refusal kind ${String(kind)})`;
              if (
                !admissionRefused &&
                others.length === 0 &&
                !classified &&
                kind !== "broken"
              )
                unexplained.push(id);
              overDetermined[id] = {
                cause,
                process: `exit ${String(run.exitCode)} ${String(causeOf(run.stdout))}`,
                message: messageOf(run.stdout).slice(0, 300),
              };
            }
          }
        } finally {
          await copy.dispose();
          await processCopy.dispose();
          await perturbed.dispose();
        }
      }
      receipt.ruleDisabledSweep = {
        negatives: applies.length,
        rules: rules.length,
        componentStillMatching: stillMatching,
        processSensitiveByExitAndCause: sensitiveByExitAndCause.length,
        processSensitiveByMessageOnly: sensitiveByMessageOnly,
        processOverDetermined: Object.keys(overDetermined).length,
        processNotMeasured: 0,
        overDetermined,
      };
      expect(applies).toHaveLength(334);
      expect(stillMatching).toEqual([]);
      // Every negative is measured at the process layer (F4) and lands in
      // exactly one class; every over-determined refusal is explained by the
      // judgement's own failed rules or by classification (F-2).
      expect(
        sensitiveByExitAndCause.length +
          sensitiveByMessageOnly.length +
          Object.keys(overDetermined).length,
      ).toBe(applies.length);
      expect(unexplained).toEqual([]);
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
