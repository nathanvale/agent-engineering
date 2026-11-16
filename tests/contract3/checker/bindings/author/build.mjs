// fallow-ignore-file unused-file -- binder authoring entry point; run by hand to regenerate bindings, never imported by product or test code
// fallow-ignore-file boundary-violation -- binder authoring source outside every boundary zone by design
//
// Usage, from the repository root:
//   bun tests/contract3/checker/bindings/author/build.mjs build
//   bun run format
//   bun tests/contract3/checker/bindings/author/build.mjs manifest
//   bun run format
// The committed bytes, not this script, are the binding. Regenerating must
// reproduce them exactly; any difference is a changed expectation that needs
// independent review (CHECKER_EXPECTATIONS.md).
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { BINDINGS, GROUP_OF, RULES, STOPPED } from "./framework.mjs";
import { BUDGETS, otherBindings } from "./other.mjs";
import { processBindings } from "./process.mjs";
import { shapeBindings } from "./shape.mjs";
import { TRIMMED, writeBinding, writeShared } from "./writer.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CHECKER = fileURLToPath(new URL("../..", import.meta.url));
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

function build() {
  shapeBindings();
  processBindings();
  otherBindings((id) => {
    const found = BINDINGS.find((b) => b.id === id);
    if (found === undefined) throw new Error(`missing ${id}`);
    return found;
  });
  rmSync(join(ROOT, "cases"), { recursive: true, force: true });
  writeShared(ROOT);
  for (const spec of BINDINGS) writeBinding(ROOT, spec);
  writeFileSync(
    join(ROOT, "STOPPED.json"),
    json({ stoppedVersion: 1, cases: STOPPED }),
  );
  writeFileSync(
    join(ROOT, "BUDGETS.json"),
    json({ budgetsVersion: 1, values: BUDGETS }),
  );
  process.stdout.write(
    `wrote ${BINDINGS.length} bindings, ${STOPPED.length} stopped; B5 trimmed ${JSON.stringify(TRIMMED)}\n`,
  );
}

const sha = (path) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");
const list = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? list(join(dir, entry.name)) : [join(dir, entry.name)],
  );

function manifest() {
  const casesDir = join(ROOT, "cases");
  const bindings = readdirSync(casesDir)
    .sort()
    .map((id) => {
      const dir = join(casesDir, id);
      const expected = JSON.parse(
        readFileSync(join(dir, "expected.json"), "utf8"),
      );
      const files = Object.fromEntries(
        list(dir)
          .sort()
          .map((path) => [relative(dir, path), sha(path)]),
      );
      const sharedUsed = new Set();
      const specimensUsed = new Set();
      if (expected.admission !== null) {
        const text = readFileSync(join(dir, "admission.json"), "utf8");
        for (const m of text.matchAll(/\.\.\/\.\.\/shared\/([\w.-]+)/g))
          sharedUsed.add(`shared/${m[1]}`);
        for (const m of text.matchAll(
          /\.\.\/\.\.\/\.\.\/specimens\/([\w.-]+)/g,
        ))
          specimensUsed.add(`specimens/${m[1]}`);
        for (const name of readdirSync(dir).filter((n) =>
          n.endsWith(".table.json"),
        )) {
          const table = readFileSync(join(dir, name), "utf8");
          for (const m of table.matchAll(/\.\.\/\.\.\/shared\/([\w.-]+)/g))
            sharedUsed.add(`shared/${m[1]}`);
        }
      }
      return {
        id,
        rule: expected.rule,
        group: expected.group,
        kind: expected.kind,
        verification: expected.verification,
        oracle: expected.oracle,
        reader: expected.reader,
        provisional: expected.provisional,
        caseIds:
          expected.rows === null ? [] : expected.rows.map((r) => r.caseId),
        counts: expected.counts,
        checkerExit: expected.checker?.exitCode ?? null,
        files,
        shared: [...sharedUsed].sort(),
        specimens: [...specimensUsed].sort(),
      };
    });
  const shared = Object.fromEntries(
    list(join(ROOT, "shared"))
      .sort()
      .map((p) => [relative(ROOT, p), sha(p)]),
  );
  const specimens = Object.fromEntries(
    list(join(CHECKER, "specimens"))
      .sort()
      .map((p) => [relative(CHECKER, p), sha(p)]),
  );
  const tally = (key) =>
    bindings.reduce((acc, b) => {
      const k = b[key] ?? "none";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
  const rows = bindings.reduce((acc, b) => {
    if (b.counts === null) return acc;
    for (const [k, v] of Object.entries(b.counts)) acc[k] = (acc[k] ?? 0) + v;
    return acc;
  }, {});
  const stopped = JSON.parse(
    readFileSync(join(ROOT, "STOPPED.json"), "utf8"),
  ).cases;
  const ruleCoverage = Object.fromEntries(
    Object.keys(RULES).map((rule) => {
      const own = bindings.filter((b) =>
        b.oracle.some((o) => o.startsWith(`rules/${rule}/`)),
      );
      const twin = own.some((b) =>
        b.oracle.includes(`rules/${rule}/validTwin`),
      );
      const negative = own.some((b) =>
        b.oracle.includes(`rules/${rule}/negative`),
      );
      const variations = RULES[rule].requiredVariations.map((_, i) =>
        own.some((b) =>
          b.oracle.includes(`rules/${rule}/requiredVariations/${i}`),
        ),
      );
      const stoppedHere = stopped
        .filter((s) => s.rule === rule)
        .map((s) => s.id);
      return [
        rule,
        {
          group: GROUP_OF[rule],
          bindings: own.length,
          validTwin: twin,
          negative,
          requiredVariations: variations,
          stopped: stoppedHere,
        },
      ];
    }),
  );
  const out = {
    manifestVersion: 1,
    status: "not_run",
    authority: {
      oracle: "tests/contract3/checker-expectations.json",
      interface:
        "tests/contract3/checker/INTERFACE.md at 7e08c0b45e1886bd6bf0802a444946463c71660f",
      review: "tests/contract3/checker/bindings/INTERFACE-REVIEW.md",
    },
    totals: {
      bindings: bindings.length,
      admitted: bindings.filter(
        (b) => b.caseIds.length > 0 || b.checkerExit !== null,
      ).length,
      static: bindings.filter((b) => b.kind.startsWith("static")).length,
      stopped: stopped.length,
      byGroup: tally("group"),
      byKind: tally("kind"),
      byReader: tally("reader"),
      rows,
    },
    ruleCoverage,
    shared,
    specimens,
    procedures: [
      {
        oracle: "additionalControls/checker-rule-disabled",
        verification: ["ROLL-8", "V-34"],
        appliesTo: bindings
          .filter((b) =>
            ["negative", "variation-negative", "control-negative"].includes(
              b.kind,
            ),
          )
          .map((b) => b.id),
        procedure:
          "For each listed binding, disable its target rule in the checker alone. Under option (i) the binding must stop matching at BOTH layers: the process result is no longer the bound refusal, and the component row loses its bound finding. Report each layer's count separately. Restore the rule and the binding must match again in the same test harness.",
      },
    ],
    budgets: "tests/contract3/checker/bindings/BUDGETS.json",
    stopped: "tests/contract3/checker/bindings/STOPPED.json",
    bindings,
  };
  writeFileSync(join(ROOT, "MANIFEST.json"), json(out));
  process.stdout.write(`manifest: ${bindings.length} bindings\n`);
}

const mode = process.argv[2] ?? "build";
if (mode === "build") build();
else if (mode === "manifest") manifest();
else throw new Error(`unknown mode ${mode}`);
