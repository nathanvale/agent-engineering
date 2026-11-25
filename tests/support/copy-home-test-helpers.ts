import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const cliPath = join(import.meta.dir, "../../src/cli.ts");

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function fingerprintTree(root: string): string {
  const lines: string[] = [];
  const walk = (dir: string, rel: string) => {
    const stat = lstatSync(dir);
    lines.push(
      `d|${rel}|${String(stat.mode)}|${String(stat.mtimeMs)}|${String(stat.size)}`,
    );
    let names: string[];
    try {
      names = readdirSync(dir).sort(compareStrings);
    } catch {
      lines.push(`u|${rel}`);
      return;
    }
    for (const name of names) {
      const full = join(dir, name);
      const childRel = rel === "" ? name : `${rel}/${name}`;
      const childStat = lstatSync(full);
      if (childStat.isSymbolicLink()) {
        lines.push(
          `l|${childRel}|${String(childStat.mode)}|${String(childStat.mtimeMs)}`,
        );
      } else if (childStat.isDirectory()) {
        walk(full, childRel);
      } else {
        let digest: string;
        try {
          digest = createHash("sha256")
            .update(readFileSync(full))
            .digest("hex");
        } catch {
          digest = "unreadable";
        }
        lines.push(
          `f|${childRel}|${String(childStat.mode)}|${String(childStat.mtimeMs)}|${String(childStat.size)}|${digest}`,
        );
      }
    }
  };
  walk(root, "");
  return lines.join("\n");
}

export function runCheckJson(
  homesFile: string,
  envMap: Record<string, string>,
  extraArgs: readonly string[] = [],
): { readonly exitCode: number; readonly data: unknown } {
  const ran = Bun.spawnSync(
    [
      process.execPath,
      "run",
      cliPath,
      "copy-home",
      "check",
      "--homes",
      homesFile,
      ...extraArgs,
      "--json",
    ],
    {
      env: { ...process.env, ...envMap },
      stdout: "pipe",
      stderr: "pipe",
      timeout: 60_000,
      killSignal: "SIGKILL",
    },
  );
  const envelope: unknown = JSON.parse(ran.stdout.toString());
  const data: unknown = Reflect.get(
    Object(Reflect.get(Object(envelope), "result")),
    "data",
  );
  return { exitCode: ran.exitCode, data };
}

export function listFromData(data: unknown, field: string): readonly unknown[] {
  const value: unknown = Reflect.get(Object(data), field);
  return Array.isArray(value) ? value : [];
}

export function copyLossVerdict(
  data: unknown,
  copyPath: string,
): string | undefined {
  const entry = listFromData(data, "copies").find(
    (item) => String(Reflect.get(Object(item), "path")) === copyPath,
  );
  if (entry === undefined) return undefined;
  return String(
    Reflect.get(Object(Reflect.get(Object(entry), "loss")), "verdict"),
  );
}

export function copyLossReasons(
  data: unknown,
  copyPath: string,
): readonly string[] {
  const entry = listFromData(data, "copies").find(
    (item) => String(Reflect.get(Object(item), "path")) === copyPath,
  );
  if (entry === undefined) return [];
  const reasons: unknown = Reflect.get(
    Object(Reflect.get(Object(entry), "loss")),
    "reasons",
  );
  return Array.isArray(reasons) ? reasons.map((item) => String(item)) : [];
}
