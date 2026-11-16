// D3 test-only 3.1 reader specimen (binder ruling D3, G20; implementer-owned).
// PROVISIONAL: the fixture minor table is the binder's proposal in
// bindings/cases/minor.valid/table.json (3.1.0 adds optional result key
// fixtureNote) and still needs the kernel owner's (T1) agreement.
//
// It accepts the same invocation and admission as the application command
// (`contract3 check --admission PATH [--json]`) and prints the host CLI's
// envelope. It is never registered in src/commands.ts. The production
// checker cannot reach this table: only this file passes it, in code.

import { randomUUID } from "node:crypto";
import {
  builtInCommandSummaries,
  commandSummaries,
} from "../../../../../src/commands-contract.ts";
import { commands } from "../../../../../src/commands.ts";
import { executeCheck } from "../../../../../src/domains/contract3-check/host-adapter.ts";
import { createMinorTable } from "../../../../../src/domains/contract3-check/minors.ts";

export const FIXTURE_MINORS = createMinorTable([
  { keys: { result: ["fixtureNote"] }, members: {} },
]);

const ROUTE = ["contract3", "check"];

async function main(argv: string[]): Promise<number> {
  const delimiter = argv.indexOf("--");
  const json = argv.some(
    (token, index) =>
      token === "--json" && (delimiter < 0 || index < delimiter),
  );
  const args = argv.filter(
    (token, index) =>
      token !== "--json" || (delimiter >= 0 && index > delimiter),
  );
  if (ROUTE.some((token, index) => args[index] !== token)) {
    process.stderr.write("reader-3.1: expected contract3 check.\n");
    return 2;
  }
  const { message, ...facts } = await executeCheck(
    "example.contract3.check",
    args.slice(ROUTE.length),
    FIXTURE_MINORS,
  );
  const availablePaths = [
    ...builtInCommandSummaries(),
    ...commandSummaries(commands),
  ]
    .map((command) => command.commandIdentity)
    .sort();
  const envelope = {
    availablePaths,
    contractVersion: "2.0.0",
    envelopeVersion: 2,
    message,
    result: { ...facts, runId: randomUUID() },
  };
  process.stdout.write(json ? `${JSON.stringify(envelope)}\n` : `${message}\n`);
  return facts.exitCode;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
