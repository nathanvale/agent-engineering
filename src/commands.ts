import type { commonCauses, ParsedPath } from "agent-cli-kernel";
import { command, contractFor } from "agent-cli-kernel";
import { copyHomeCauses, createCopyHomeCheck } from "./copy-home/check.ts";

const noInput = {
  arguments: [],
  options: [],
  constraints: [],
  deadlineSupported: false,
  additionalArguments: false,
  additionalOptions: false,
} as const;

const noEffects = {
  completed: [],
  remaining: [],
  uncertain: [],
  inventoryComplete: true,
} as const;

const succeeded = "SUCCESS_UNCHANGED" satisfies keyof typeof commonCauses;

const status = command({
  identity: "agent-engineering.status",
  route: ["status"],
  summary: "Report that this command-line tool runs.",
  input: noInput,
  capabilities: {},
  run: (_input, context) =>
    context.result(
      {
        commandIdentity: "agent-engineering.status",
        causeCode: succeeded,
      },
      {
        message: "The command-line tool runs.",
        data: { ready: true },
        effects: noEffects,
      },
    ),
});

let envExecutable: ParsedPath | undefined;

const copyHomeCheck = createCopyHomeCheck(() => envExecutable);

export const commands = [status, copyHomeCheck] as const;

export const contract = contractFor({
  cli: "agent-engineering",
  commands,
  causes: copyHomeCauses,
  installedAddons: ["programs"],
});

const resolvedEnv = Bun.which("env");
if (resolvedEnv !== null) {
  envExecutable = contract.boundary.path(resolvedEnv);
}
