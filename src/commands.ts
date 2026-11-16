import type { CommandDefinition } from "./commands-contract.ts";
import {
  checkerStations,
  executeCheck,
} from "./domains/contract3-check/host-adapter.ts";

const CHECKER_IDENTITY = "example.contract3.check";

export const commands: CommandDefinition[] = [
  {
    commandIdentity: "example.status",
    effectClass: "inspect",
    route: ["status"],
    summary: "Inspect the starter without changing data.",
    execute: async () => (await import("./domains/status.ts")).inspectStatus(),
    stations: () => [],
  },
  {
    commandIdentity: "example.template.info",
    effectClass: "inspect",
    route: ["template", "info"],
    summary: "Inspect the template convention.",
    execute: async () =>
      (await import("./domains/template.ts")).inspectTemplate(),
    stations: () => [],
  },
  {
    commandIdentity: CHECKER_IDENTITY,
    effectClass: "inspect",
    route: ["contract3", "check"],
    summary:
      "Judge a Contract 3 CLI's output against an admitted case set without rerunning it.",
    acceptsArguments: true,
    execute: (args) => executeCheck(CHECKER_IDENTITY, args),
    stations: () => checkerStations(CHECKER_IDENTITY),
  },
];
