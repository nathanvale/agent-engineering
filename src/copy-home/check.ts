import type { CauseTable, ParsedPath } from "agent-cli-kernel";
import { command, commonCauses, station } from "agent-cli-kernel";
import type { LossStepDeadlines } from "./ancestry.ts";
import { runCopyHomeCheck } from "./scan.ts";

export const copyHomeCauses = {
  ...commonCauses,
  DOMAIN_COPY_HOME_FINDINGS: {
    outcome: "refused",
    transactionState: "unchanged",
    failureClass: "domain",
    exitCode: 3,
    retryable: false,
    guidance: "next",
    carriesData: true,
  },
  DOMAIN_COPY_HOME_INVALID_HOMES: {
    outcome: "refused",
    transactionState: "unchanged",
    failureClass: "domain",
    exitCode: 3,
    retryable: false,
    guidance: "next",
  },
} as const satisfies CauseTable;

const stationWords = {
  retryDelayPolicy: { kind: "none" },
  reachability: "required",
  unreachableRationale: null,
} as const;

const noEffects = {
  completed: [],
  remaining: [],
  uncertain: [],
  inventoryComplete: true,
} as const;

const identity = "agent-engineering.copy-home-check" as const;

export function createCopyHomeCheck(
  getEnvExecutable: () => ParsedPath | undefined,
  lossDeadlines?: LossStepDeadlines,
) {
  return command({
    identity,
    route: ["copy-home", "check"],
    summary:
      "Check agent copies against their configured homes and report findings without modifying anything.",
    input: {
      arguments: [],
      options: [
        {
          name: "--homes",
          aliases: [],
          summary: "Absolute path to the version 1 copy homes JSON file.",
          required: false,
          repeatable: false,
          value: {
            kind: "string",
            minLength: 1,
            maxLength: 4096,
            choices: null,
            pattern: null,
          },
        },
        {
          name: "--remote",
          aliases: [],
          summary:
            "Read live remote tips with git ls-remote during loss checks.",
          required: false,
          repeatable: false,
          value: null,
        },
      ],
      constraints: [],
      deadlineSupported: false,
      additionalArguments: false,
      additionalOptions: false,
    },
    capabilities: { programs: true },
    stations: [
      station(copyHomeCauses, {
        ...stationWords,
        commandIdentity: identity,
        causeCode: "SUCCESS_UNCHANGED" satisfies keyof typeof commonCauses,
        trigger:
          "All scanned copies are in their allowed homes and within age limits.",
        repairAction: null,
        guidance: { next: { kind: "done" } },
        independentObservable: "agent-engineering.copy-home-check:clean",
      }),
      station(copyHomeCauses, {
        ...stationWords,
        commandIdentity: identity,
        causeCode: "DOMAIN_COPY_HOME_FINDINGS",
        trigger:
          "One or more stray copies, stray worktrees, expired throwaways, dangling registrations, or scan-incomplete errors were found.",
        repairAction:
          "Inspect each finding and its loss verdict before moving or removing any copy by hand.",
        guidance: {
          next: {
            kind: "instruction",
            text: "Review the findings list and each copy's loss verdict, then resolve or remove strays manually.",
          },
        },
        independentObservable: "agent-engineering.copy-home-check:findings",
      }),
      station(copyHomeCauses, {
        ...stationWords,
        commandIdentity: identity,
        causeCode: "DOMAIN_COPY_HOME_INVALID_HOMES",
        trigger:
          "The homes path is relative or the homes file cannot be parsed as version 1.",
        repairAction:
          "Pass an absolute path to a valid version 1 copy homes JSON file.",
        guidance: {
          next: {
            kind: "instruction",
            text: "Provide an absolute --homes path pointing to a valid version 1 JSON file with absolute paths.",
          },
        },
        independentObservable:
          "agent-engineering.copy-home-check:invalid-homes",
      }),
    ],
    run: async (input, context) => {
      const outcome = await runCopyHomeCheck({
        homesPath: input["--homes"],
        checkRemote: input["--remote"] === true,
        programs: context.programs,
        envExecutable: getEnvExecutable(),
        lossDeadlines,
      });
      if (!outcome.ok) {
        return context.result(
          {
            commandIdentity: identity,
            causeCode: "DOMAIN_COPY_HOME_INVALID_HOMES",
          },
          {
            message: outcome.message,
            data: null,
            effects: noEffects,
          },
        );
      }
      const { report } = outcome;
      if (report.findings.length > 0) {
        return context.result(
          {
            commandIdentity: identity,
            causeCode: "DOMAIN_COPY_HOME_FINDINGS",
          },
          {
            message: `Found ${String(report.findings.length)} copy-home finding(s).`,
            data: report,
            effects: noEffects,
          },
        );
      }
      return context.result(
        {
          commandIdentity: identity,
          causeCode: "SUCCESS_UNCHANGED" satisfies keyof typeof commonCauses,
        },
        {
          message: `Checked ${String(report.copies.length)} copy/copies with no findings.`,
          data: report,
          effects: noEffects,
        },
      );
    },
  });
}
