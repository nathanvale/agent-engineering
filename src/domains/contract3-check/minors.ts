// Shape vocabulary per contract minor (VER-3 to VER-7, VER-15).
// Minor 0 restates wire.md, next-steps.md, discovery.md, input-schema.md and
// diagnostics.md. Later minors only add keys and union members (VER-5). The
// production reader knows minor 0 only; a test-only minor is supplied by a
// fixture through createMinorTable and never ships.

export type ObjectKind =
  | "envelope"
  | "result"
  | "effects"
  | "handoff"
  | "resource"
  | "step.command"
  | "step.retry"
  | "step.instruction"
  | "step.done"
  | "inspect.command"
  | "inspect.instruction"
  | "diagnostics.available"
  | "diagnostics.unavailable"
  | "diagnostics.trusted"
  | "help"
  | "command-summary"
  | "option-summary"
  | "discovery"
  | "command-discovery"
  | "station"
  | "retry-policy.none"
  | "retry-policy.bounded"
  | "guidance.next"
  | "guidance.handoff"
  | "input"
  | "input.argument"
  | "input.option"
  | "value.string"
  | "value.integer"
  | "constraint.requires"
  | "constraint.exclusive";

export type UnionKind =
  | "outcome"
  | "effectClass"
  | "transactionState"
  | "failureClass"
  | "exitCode"
  | "stepKind"
  | "inspectKind"
  | "owner"
  | "diagnosticsStatus"
  | "sinkFailure"
  | "unavailableReason"
  | "reachability"
  | "retryPolicyKind"
  | "valueKind"
  | "constraintKind"
  | "semantics";

// fallow-ignore-next-line unused-type -- VER-15 seam: a test-only minor exists only in reader test fixtures.
export interface MinorAdditions {
  keys: Partial<Record<ObjectKind, readonly string[]>>;
  members: Partial<Record<UnionKind, readonly (string | number)[]>>;
}

const DIAGNOSTIC_FIELDS = [
  "file",
  "sinkFailure",
  "droppedRecords",
  "unflushedRecords",
  "truncatedRecords",
  "countsComplete",
  "closed",
] as const;

const BASE_KEYS: Record<ObjectKind, readonly string[]> = {
  envelope: [
    "contractVersion",
    "message",
    "availablePaths",
    "result",
    "diagnostics",
  ],
  result: [
    "runId",
    "commandIdentity",
    "outcome",
    "effectClass",
    "transactionState",
    "causeCode",
    "failureClass",
    "exitCode",
    "data",
    "retryable",
    "retryDelayMilliseconds",
    "repairAction",
    "effects",
    "next",
    "handoff",
    "bindings",
    "idempotencyKey",
    "attemptedEffect",
  ],
  effects: ["completed", "remaining", "uncertain", "inventoryComplete"],
  handoff: ["owner", "reason", "inspect", "resource"],
  resource: ["kind", "id"],
  "step.command": ["kind", "command", "args"],
  "step.retry": ["kind"],
  "step.instruction": ["kind", "text"],
  "step.done": ["kind"],
  "inspect.command": ["kind", "command", "args"],
  "inspect.instruction": ["kind", "text"],
  "diagnostics.available": ["status", ...DIAGNOSTIC_FIELDS],
  "diagnostics.unavailable": ["status", "reason", "trusted"],
  "diagnostics.trusted": DIAGNOSTIC_FIELDS,
  help: ["usage", "summary", "commands", "options"],
  "command-summary": ["commandIdentity", "route", "summary", "effectClass"],
  "option-summary": ["name", "valueName", "summary"],
  discovery: [
    "contractVersion",
    "commands",
    "exitMeanings",
    "signalExits",
    "effectExclusions",
  ],
  "command-discovery": [
    "command",
    "semantics",
    "ifNoResult",
    "input",
    "stations",
  ],
  station: [
    "commandIdentity",
    "outcome",
    "causeCode",
    "failureClass",
    "exitCode",
    "effectClass",
    "transactionState",
    "retryable",
    "retryDelayPolicy",
    "trigger",
    "guidance",
    "repairAction",
    "reachability",
    "unreachableRationale",
  ],
  "retry-policy.none": ["kind"],
  "retry-policy.bounded": [
    "kind",
    "minimumMilliseconds",
    "maximumMilliseconds",
  ],
  "guidance.next": ["next"],
  "guidance.handoff": ["handoff"],
  input: [
    "arguments",
    "options",
    "constraints",
    "deadlineSupported",
    "additionalArguments",
    "additionalOptions",
  ],
  "input.argument": ["name", "summary", "required", "value"],
  "input.option": [
    "name",
    "aliases",
    "summary",
    "required",
    "repeatable",
    "value",
  ],
  "value.string": ["kind", "minLength", "maxLength", "choices", "pattern"],
  "value.integer": ["kind", "minimum", "maximum"],
  "constraint.requires": ["kind", "ifPresent", "thenPresent"],
  "constraint.exclusive": ["kind", "members"],
};

const BASE_MEMBERS: Record<UnionKind, readonly (string | number)[]> = {
  outcome: ["success", "refused", "failed"],
  effectClass: ["inspect", "repository-local", "external"],
  transactionState: [
    "unchanged",
    "completed",
    "partially-completed",
    "unknown",
  ],
  failureClass: ["internal", "usage", "domain", "schema", "transient"],
  exitCode: [0, 1, 2, 3, 4, 75],
  stepKind: ["command", "retry", "instruction", "done"],
  inspectKind: ["command", "instruction"],
  owner: ["human", "operator"],
  diagnosticsStatus: ["available", "unavailable"],
  sinkFailure: ["capacity", "setup", "write", "flush-timeout", "close"],
  unavailableReason: ["status-invalid", "status-unavailable"],
  reachability: ["required", "declared-unreachable"],
  retryPolicyKind: ["none", "bounded"],
  valueKind: ["string", "integer"],
  constraintKind: ["requires", "exclusive"],
  semantics: ["possible-outcomes"],
};

export type Membership = "known" | "later-minor" | "unknown";

export interface MinorTable {
  readerMinor: number;
  readerVersion: string;
  keyMembership(
    kind: ObjectKind,
    key: string,
    declaredMinor: number,
  ): Membership;
  memberMembership(
    kind: UnionKind,
    member: string | number,
    declaredMinor: number,
  ): Membership;
}

function membership(
  inBase: boolean,
  additions: readonly MinorAdditions[],
  declaredMinor: number,
  has: (addition: MinorAdditions) => boolean,
): Membership {
  if (inBase) return "known";
  let later = false;
  for (let minor = 1; minor <= additions.length; minor += 1) {
    const addition = additions[minor - 1];
    if (addition === undefined || !has(addition)) continue;
    if (minor <= declaredMinor) return "known";
    later = true;
  }
  return later ? "later-minor" : "unknown";
}

/**
 * Build a reader's table. additions[i] lists what minor i + 1 adds. The
 * production reader passes no additions and so reads 3.0.0 only.
 */
// fallow-ignore-next-line unused-export -- VER-15 seam: the fixture-only minor reader (D3) builds its table here.
export function createMinorTable(
  additions: readonly MinorAdditions[] = [],
): MinorTable {
  return {
    readerMinor: additions.length,
    readerVersion: `3.${additions.length}.0`,
    keyMembership(kind, key, declaredMinor) {
      return membership(
        BASE_KEYS[kind].includes(key),
        additions,
        declaredMinor,
        (addition) => addition.keys[kind]?.includes(key) ?? false,
      );
    },
    memberMembership(kind, member, declaredMinor) {
      return membership(
        BASE_MEMBERS[kind].includes(member),
        additions,
        declaredMinor,
        (addition) => addition.members[kind]?.includes(member) ?? false,
      );
    },
  };
}

export const PRODUCTION_MINORS: MinorTable = createMinorTable();
