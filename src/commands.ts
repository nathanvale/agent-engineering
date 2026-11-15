import type { CommandDefinition } from "./commands-contract.ts";
import {
  checkerStations,
  executeCheck,
} from "./domains/contract3-check/host-adapter.ts";

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
    commandIdentity: "example.contract3.check",
    effectClass: "inspect",
    route: ["contract3", "check"],
    summary:
      "Judge a Contract 3 CLI's output against an admitted case set without rerunning it.",
    acceptsArguments: true,
    execute: (args) => executeCheck("example.contract3.check", args),
    stations: () => checkerStations("example.contract3.check"),
  },
];
