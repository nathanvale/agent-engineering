// Glossary check. It reads term-table.json (beside this file) and fails when a
// word the living glossary says to avoid appears on a surface where the table
// bans it. The canonical meanings live in the Linear "Agent ecosystem glossary
// (living)"; term-table.json records which glossary date it follows.
//
// known-hits.json is a shrinking list: the hits that existed when the check
// was introduced. The check fails on any hit not in that list, and on any
// listed hit that no longer exists, so a fix must remove its entry in the same
// commit. When the list is empty, delete it and the check is absolute.
//
// Wire names, contract quotes and exempt paths never fire: string literals
// without spaces are not prose, backtick spans and cause-code or identity
// tokens are removed before matching, a double-quoted span on a line that
// cites a contract clause is a quote, and a line marked
// `glossary-quote: <clause-or-decision-id>` is skipped.
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const root = join(import.meta.dir, "..", "..");
const here = import.meta.dir;

const SURFACES = [
  "visible-text",
  "comment",
  "public-identifier",
  "internal-identifier",
  "test-title",
  "doc",
] as const;
type Surface = (typeof SURFACES)[number];

type Avoid = {
  readonly pattern: RegExp;
  readonly surfaces: readonly Surface[];
  readonly pathsOnly: readonly string[];
  readonly unlessAllowedForm: boolean;
  readonly firstUsePerFile: boolean;
  readonly message: string;
};
type Term = {
  readonly term: string;
  readonly allowed: readonly string[];
  readonly avoid: readonly Avoid[];
};
type Table = {
  readonly scope: readonly string[];
  readonly exempt: readonly string[];
  readonly terms: readonly Term[];
};
type TextRecord = {
  readonly line: number;
  readonly surface: Surface;
  readonly text: string;
};
type Hit = {
  readonly file: string;
  readonly line: number;
  readonly term: string;
  readonly surface: Surface;
  readonly text: string;
  readonly message: string;
};

// ---- reading the table without trusting its shape -------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function strings(value: unknown, where: string): string[] {
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string"))
    throw new Error(`${where} must be an array of strings.`);
  return value.filter((v): v is string => typeof v === "string");
}
function isSurface(value: string): value is Surface {
  return SURFACES.some((surface) => surface === value);
}
function parseTable(raw: unknown): Table {
  if (!isRecord(raw)) throw new Error("term-table.json must be an object.");
  const terms = raw.terms;
  if (!Array.isArray(terms)) throw new Error("terms must be an array.");
  return {
    scope: strings(raw.scope, "scope"),
    exempt: strings(raw.exempt, "exempt"),
    terms: terms.map((entry, index) => {
      if (!isRecord(entry) || typeof entry.term !== "string")
        throw new Error(`terms[${index}] needs a term.`);
      const avoid = entry.avoid;
      if (!Array.isArray(avoid))
        throw new Error(`terms[${index}].avoid must be an array.`);
      return {
        term: entry.term,
        allowed: strings(entry.allowed, `terms[${index}].allowed`),
        avoid: avoid.map((item, at) => {
          const where = `terms[${index}].avoid[${at}]`;
          if (
            !isRecord(item) ||
            typeof item.pattern !== "string" ||
            typeof item.message !== "string"
          )
            throw new Error(`${where} needs a pattern and a message.`);
          const surfaces = strings(item.surfaces, `${where}.surfaces`);
          if (!surfaces.every(isSurface))
            throw new Error(`${where}.surfaces names an unknown surface.`);
          return {
            pattern: new RegExp(item.pattern, "u"),
            surfaces: surfaces.filter(isSurface),
            pathsOnly:
              item.pathsOnly === undefined
                ? []
                : strings(item.pathsOnly, `${where}.pathsOnly`),
            unlessAllowedForm: item.unlessAllowedForm === true,
            firstUsePerFile: item.firstUsePerFile === true,
            message: item.message,
          };
        }),
      };
    }),
  };
}

// ---- extracting text by surface --------------------------------------------

const TITLE_CALLS = new Set(["test", "it", "describe"]);
const ERROR_OR_TEXT_PROPERTY =
  /^(message|reason|summary|trigger|repairAction|text|inspect|note)$/;

function rootName(node: ts.Expression): string {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) return rootName(node.expression);
  if (ts.isCallExpression(node)) return rootName(node.expression);
  return "";
}
function exportedStatement(node: ts.Node): boolean {
  const statement = node.parent?.parent;
  const holder =
    ts.isVariableDeclaration(node) && statement !== undefined
      ? statement
      : node;
  if (!ts.canHaveModifiers(holder)) return false;
  return (
    ts
      .getModifiers(holder)
      ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ===
      true && ts.isSourceFile(holder.parent)
  );
}
function declaredName(node: ts.Node): string | undefined {
  if (
    ts.isFunctionDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isVariableDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isPropertySignature(node) ||
    ts.isPropertyDeclaration(node) ||
    ts.isParameter(node)
  )
    return node.name !== undefined && ts.isIdentifier(node.name)
      ? node.name.text
      : undefined;
  return undefined;
}

function scanSource(file: string, text: string): TextRecord[] {
  const production = !file.startsWith("tests/");
  if (file.endsWith(".md"))
    return text
      .split("\n")
      .flatMap((line, index) =>
        line.trim() === ""
          ? []
          : [{ line: index + 1, surface: "doc" as const, text: line.trim() }],
      );
  const kind =
    file.endsWith(".mjs") || file.endsWith(".js")
      ? ts.ScriptKind.JS
      : ts.ScriptKind.TS;
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    kind,
  );
  const lineOf = (position: number) =>
    source.getLineAndCharacterOfPosition(position).line + 1;
  const records: TextRecord[] = [];
  const seenComments = new Set<number>();
  const comments = (ranges: ts.CommentRange[] | undefined) => {
    for (const range of ranges ?? []) {
      if (seenComments.has(range.pos)) continue;
      seenComments.add(range.pos);
      const first = lineOf(range.pos);
      text
        .slice(range.pos, range.end)
        .split("\n")
        .forEach((raw, index) => {
          const body = raw
            .replace(/^\s*(\/\/+|\/\*+|\*+\/?|\*)\s?/u, "")
            .replace(/\*\/\s*$/u, "")
            .trim();
          if (body !== "")
            records.push({
              line: first + index,
              surface: "comment",
              text: body,
            });
        });
    }
  };
  const visit = (node: ts.Node) => {
    comments(ts.getLeadingCommentRanges(text, node.pos));
    comments(ts.getTrailingCommentRanges(text, node.end));
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateExpression(node)
    ) {
      const value = ts.isTemplateExpression(node)
        ? node.getText(source).slice(1, -1)
        : node.text;
      const parent = node.parent;
      const line = lineOf(node.getStart(source));
      const isTitle =
        ts.isCallExpression(parent) &&
        parent.arguments[0] === node &&
        TITLE_CALLS.has(rootName(parent.expression));
      if (isTitle) records.push({ line, surface: "test-title", text: value });
      else if (production && /\s/u.test(value.trim())) {
        const imported =
          ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent);
        const keyed =
          ts.isPropertyAssignment(parent) &&
          parent.name === node &&
          !ERROR_OR_TEXT_PROPERTY.test(value);
        if (!imported && !keyed)
          records.push({ line, surface: "visible-text", text: value });
      }
    }
    const name = declaredName(node);
    if (name !== undefined && production)
      records.push({
        line: lineOf(node.getStart(source)),
        surface:
          !ts.isParameter(node) && exportedStatement(node)
            ? "public-identifier"
            : "internal-identifier",
        text: name,
      });
    ts.forEachChild(node, visit);
  };
  visit(source);
  comments(ts.getLeadingCommentRanges(text, source.endOfFileToken.pos));
  return records;
}

// ---- matching --------------------------------------------------------------

const CLAUSE =
  /\b(?:LIFE|CMD|DISC|WIRE|STEP|REC|INPUT|VER|DIAG|GATE|ROLL|V)-\d+[a-z]?\b/u;
const MARKER =
  /glossary-quote: (?:(?:LIFE|CMD|DISC|WIRE|STEP|REC|INPUT|VER|DIAG|GATE|ROLL|V)-\d+[a-z]?|[BF]\d+)\b/u;

// Wire names and code inside prose: backtick spans, UPPER_SNAKE cause codes,
// and dotted identities such as <cli>.dispatch are removed before matching.
function withoutWire(text: string): string {
  return text
    .replace(/`[^`]*`/gu, " ")
    .replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/gu, " ")
    .replace(/[\w<>${}-]+(?:\.[\w<>${}-]+)+/gu, " ");
}
// Identifiers are also matched as words: admitCommands reads "admit Commands".
function words(identifier: string): string {
  return identifier
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/gu, "$1 $2")
    .replace(/_/gu, " ");
}
function quotedSpans(text: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  for (const match of text.matchAll(/"[^"]*"/gu))
    spans.push([match.index, match.index + match[0].length]);
  return spans;
}
function inScope(file: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => new Bun.Glob(pattern).match(file));
}

function hitsIn(
  table: Table,
  file: string,
  records: readonly TextRecord[],
  lines: readonly string[] = [],
): Hit[] {
  const hits: Hit[] = [];
  for (const term of table.terms)
    for (const avoid of term.avoid) {
      if (avoid.pathsOnly.length > 0 && !inScope(file, avoid.pathsOnly))
        continue;
      let qualifiedInFile = false;
      const found: Hit[] = [];
      for (const record of records) {
        if (!avoid.surfaces.includes(record.surface)) continue;
        if (
          MARKER.test(record.text) ||
          MARKER.test(lines[record.line - 2] ?? "")
        )
          continue;
        let text = record.surface.endsWith("identifier")
          ? record.text
          : withoutWire(record.text);
        if (avoid.unlessAllowedForm)
          for (const form of term.allowed)
            text = text.split(form).join(" ".repeat(form.length));
        if (
          avoid.firstUsePerFile &&
          term.allowed.some((form) =>
            record.text.toLowerCase().includes(form.toLowerCase()),
          )
        )
          qualifiedInFile = true;
        const match =
          avoid.pattern.exec(text) ??
          (record.surface.endsWith("identifier")
            ? avoid.pattern.exec(words(record.text))
            : null);
        if (match === null) continue;
        if (
          CLAUSE.test(record.text) &&
          quotedSpans(record.text).some(
            ([start, end]) => match.index > start && match.index < end,
          )
        )
          continue;
        found.push({
          file,
          line: record.line,
          term: term.term,
          surface: record.surface,
          text: record.text,
          message: avoid.message,
        });
      }
      if (avoid.firstUsePerFile) {
        if (!qualifiedInFile && found[0] !== undefined) hits.push(found[0]);
      } else hits.push(...found);
    }
  return hits;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function loadTable(): Table {
  return parseTable(readJson(join(here, "term-table.json")));
}

function filesInScope(table: Table): string[] {
  const files = new Set<string>();
  for (const pattern of table.scope)
    for (const file of new Bun.Glob(pattern).scanSync({ cwd: root }))
      if (!inScope(file, table.exempt)) files.add(file);
  return [...files].sort();
}

function treeHits(table: Table): Hit[] {
  return filesInScope(table).flatMap((file) => {
    const text = readFileSync(join(root, file), "utf8");
    return hitsIn(table, file, scanSource(file, text), text.split("\n"));
  });
}

// ---- the shrinking list ----------------------------------------------------

type Known = {
  readonly file: string;
  readonly term: string;
  readonly surface: string;
  readonly text: string;
  readonly count: number;
};
const KNOWN_PATH = join(here, "known-hits.json");

function keyOf(hit: {
  file: string;
  term: string;
  surface: string;
  text: string;
}): string {
  return [hit.file, hit.term, hit.surface, hit.text].join("\u001f");
}
function loadKnown(): Known[] {
  if (!existsSync(KNOWN_PATH)) return [];
  const raw = readJson(KNOWN_PATH);
  if (!isRecord(raw) || !Array.isArray(raw.hits))
    throw new Error("known-hits.json needs a hits array.");
  return raw.hits.map((item, index) => {
    if (
      !isRecord(item) ||
      typeof item.file !== "string" ||
      typeof item.term !== "string" ||
      typeof item.surface !== "string" ||
      typeof item.text !== "string" ||
      typeof item.count !== "number"
    )
      throw new Error(`known-hits.json hits[${index}] is malformed.`);
    return {
      file: item.file,
      term: item.term,
      surface: item.surface,
      text: item.text,
      count: item.count,
    };
  });
}

describe("glossary check", () => {
  const table = loadTable();

  test("every exempt and scope pattern names something that exists", () => {
    const missing = [...table.scope, ...table.exempt].filter(
      (pattern) =>
        [...new Bun.Glob(pattern).scanSync({ cwd: root, onlyFiles: true })]
          .length === 0,
    );
    expect(missing).toEqual([]);
  });

  test("no avoid-word appears outside the shrinking known-hits list", () => {
    const counts = new Map<string, { hit: Hit; count: number }>();
    for (const hit of treeHits(table)) {
      const entry = counts.get(keyOf(hit));
      if (entry) entry.count += 1;
      else counts.set(keyOf(hit), { hit, count: 1 });
    }
    const known = new Map(loadKnown().map((item) => [keyOf(item), item]));
    const unexpected: string[] = [];
    for (const [key, { hit, count }] of counts) {
      const listed = known.get(key)?.count ?? 0;
      if (count > listed)
        unexpected.push(
          `${hit.file}:${hit.line} [${hit.term} / ${hit.surface}] ${hit.message} Text: ${hit.text}`,
        );
    }
    const fixed: string[] = [];
    for (const [key, item] of known) {
      const now = counts.get(key)?.count ?? 0;
      if (now < item.count)
        fixed.push(
          `${item.file} [${item.term} / ${item.surface}] is fixed (${now} of ${item.count} left): remove or lower it in known-hits.json. Text: ${item.text}`,
        );
    }
    expect(unexpected).toEqual([]);
    expect(fixed).toEqual([]);
  });
});

// ---- proof that the check fires, and where it must not ---------------------

describe("glossary check proof", () => {
  const table = loadTable();
  const terms = (file: string, text: string) =>
    hitsIn(table, file, scanSource(file, text), text.split("\n")).map(
      (hit) => `${hit.term} / ${hit.surface}`,
    );

  test.each([
    [
      "visible-text",
      "starters/contract3/src/kernel/probe.ts",
      'throw new Error("Nothing was dispatched.");\n',
      "Handler entry / visible-text",
    ],
    [
      "comment",
      "starters/contract3/src/kernel/probe.ts",
      "// see the Phase 2b handoff\nexport const a = 1;\n",
      "Handoff / comment",
    ],
    [
      "public-identifier",
      "starters/contract3/src/addons/state/probe.ts",
      "export type CloseOutcome = { readonly kind: string };\n",
      "Outcome / public-identifier",
    ],
    [
      "internal-identifier",
      "starters/contract3/src/kernel/probe.ts",
      "const noResultRoute = Symbol();\nexport const b = noResultRoute;\n",
      "If no result / internal-identifier",
    ],
    [
      "test-title",
      "tests/contract3/probe.test.ts",
      'test("the step passed before dispatch", () => {});\n',
      "Handler entry / test-title",
    ],
    [
      "doc",
      "starters/contract3/src/addons/state/DESIGN.md",
      "## 12. Interface for other components\n",
      "Module (design words) / doc",
    ],
  ])("an avoid-word in %s turns the check red", (_surface, file, text, hit) => {
    expect(terms(file, text)).toContain(hit);
  });

  test("the frozen contract folder is never scanned", () => {
    const frozen = "skills/agent-cli-design/references/contract-3/lifecycle.md";
    expect(!inScope(frozen, table.scope) || inScope(frozen, table.exempt)).toBe(
      true,
    );
  });

  test("quoted contract text does not fire", () => {
    expect(
      terms(
        "starters/contract3/src/kernel/probe.ts",
        '// LIFE-3 says "hooks are installed before dispatch".\nexport const c = 1;\n',
      ),
    ).toEqual([]);
    expect(
      terms(
        "starters/contract3/src/kernel/probe.ts",
        "// glossary-quote: LIFE-6\n// before dispatch the deadline is checked\nexport const d = 1;\n",
      ),
    ).toEqual([]);
  });

  test("wire names do not fire", () => {
    const source = [
      'export const phase = "dispatched";',
      'export const identity = `${"cli"}.dispatch`;',
      'export const words = "Refused with DOMAIN_DEADLINE_BEFORE_START by canary.dispatch.";',
      'export const layer = { layer: "harness" };',
      "// The `dispatched` literal and `--admission` are wire names.",
      "",
    ].join("\n");
    expect(terms("starters/contract3/src/kernel/probe.ts", source)).toEqual([]);
  });
});
