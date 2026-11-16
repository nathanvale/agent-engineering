# Examples

**Illustrative only.** Every JSON block below parses as JSON. None has been
checked by a 3.0 validator, because none exists. Where an example and a
clause disagree, the clause is right and the example is a defect. The CLI
`notes` and its commands are invented.

The examples illustrate the accepted directions and proposed exact shapes in
[decisions.md](decisions.md). They do not accept a production API.

## 1. A read succeeds and nothing follows

```json
{
  "contractVersion": "3.0.0",
  "message": "Listed 2 notes.",
  "availablePaths": [
    "notes.apply",
    "notes.command-discovery",
    "notes.discovery",
    "notes.dispatch",
    "notes.help",
    "notes.list",
    "notes.pending",
    "notes.preview"
  ],
  "result": {
    "runId": "run-01",
    "commandIdentity": "notes.list",
    "outcome": "success",
    "effectClass": "inspect",
    "transactionState": "unchanged",
    "causeCode": "SUCCESS_UNCHANGED",
    "failureClass": null,
    "exitCode": 0,
    "data": { "notes": ["a.md", "b.md"] },
    "retryable": false,
    "repairAction": null,
    "effects": {
      "completed": [],
      "remaining": [],
      "uncertain": [],
      "inventoryComplete": true
    },
    "next": { "kind": "done" }
  }
}
```

## 2. A preview names the command to run next, with a run value

The station's declared template is
`{ "kind": "command", "command": "notes.apply", "args": ["--preview", "{binding.previewId}"] }`.
The step suggests the apply. It grants no authority to run it. This example
persists an unconsumed preview, so it is a changing command whose own effect
is `preview.record`, separate from the proposed later `note.write`.

```json
{
  "contractVersion": "3.0.0",
  "message": "Previewed 1 change to a.md.",
  "availablePaths": ["notes.apply", "notes.pending", "notes.preview"],
  "result": {
    "runId": "run-02",
    "commandIdentity": "notes.preview",
    "outcome": "success",
    "effectClass": "repository-local",
    "transactionState": "completed",
    "causeCode": "SUCCESS_COMPLETED",
    "failureClass": null,
    "exitCode": 0,
    "data": { "previewId": "pv-7f3a", "effects": ["note.write"] },
    "retryable": false,
    "repairAction": null,
    "effects": {
      "completed": ["preview.record"],
      "remaining": [],
      "uncertain": [],
      "inventoryComplete": true
    },
    "bindings": { "previewId": "pv-7f3a" },
    "next": {
      "kind": "command",
      "command": "notes.apply",
      "args": ["--preview", "pv-7f3a"]
    }
  }
}
```

## 3. A temporary refusal the caller may retry

This station is a service condition known to clear without repair, with no
intent or effect started. It is not the generic held-lock station in example 5,
whose stopped-owner and takeover facts are unknown.

```json
{
  "contractVersion": "3.0.0",
  "message": "A sync of the note store is in progress.",
  "availablePaths": ["notes.apply", "notes.pending"],
  "result": {
    "runId": "run-03",
    "commandIdentity": "notes.apply",
    "outcome": "refused",
    "effectClass": "repository-local",
    "transactionState": "unchanged",
    "causeCode": "TRANSIENT_NOT_STARTED",
    "failureClass": "transient",
    "exitCode": 75,
    "data": null,
    "retryable": true,
    "retryDelayMilliseconds": 500,
    "repairAction": "Wait for the sync to finish.",
    "effects": {
      "completed": [],
      "remaining": [],
      "uncertain": [],
      "inventoryComplete": true
    },
    "next": { "kind": "retry" }
  }
}
```

## 4. A change whose effect could not be confirmed

A person must act, so this is a handoff. The station is one the fallback can
select, so its words are the base's fixed words and carry nothing from the
run. Its inspection entry is the command's `ifNoResult` command. `message`
is a run fact.

```json
{
  "contractVersion": "3.0.0",
  "message": "The write to a.md could not be confirmed.",
  "availablePaths": ["notes.pending"],
  "result": {
    "runId": "run-04",
    "commandIdentity": "notes.apply",
    "outcome": "failed",
    "effectClass": "repository-local",
    "transactionState": "unknown",
    "causeCode": "INTERNAL_RESULT_UNKNOWN",
    "failureClass": "internal",
    "exitCode": 1,
    "data": null,
    "retryable": false,
    "repairAction": "Inspect the unfinished change before any further change.",
    "effects": {
      "completed": [],
      "remaining": [],
      "uncertain": ["note.write"],
      "inventoryComplete": true
    },
    "attemptedEffect": "note.write",
    "handoff": {
      "owner": "operator",
      "reason": "The effect state could not be confirmed.",
      "inspect": [{ "kind": "command", "command": "notes.pending", "args": [] }]
    }
  }
}
```

## 5. Command discovery for a changing command

`data` only, and trimmed to three stations. A real response lists every
station, the base's included. The second station is this command's refusal
of a held lock. The command declares it under a cause of its own, and the
state add-on selects it.

```json
{
  "command": {
    "commandIdentity": "notes.apply",
    "route": ["apply"],
    "summary": "Apply one previewed note change.",
    "effectClass": "repository-local"
  },
  "semantics": "possible-outcomes",
  "ifNoResult": {
    "kind": "command",
    "command": "notes.pending",
    "args": []
  },
  "stations": [
    {
      "commandIdentity": "notes.apply",
      "outcome": "success",
      "causeCode": "SUCCESS_COMPLETED",
      "failureClass": null,
      "exitCode": 0,
      "effectClass": "repository-local",
      "transactionState": "completed",
      "retryable": false,
      "retryDelayPolicy": {
        "kind": "none"
      },
      "trigger": "The note was written and read back.",
      "guidance": {
        "next": {
          "kind": "done"
        }
      },
      "repairAction": null,
      "reachability": "required",
      "unreachableRationale": null
    },
    {
      "commandIdentity": "notes.apply",
      "outcome": "refused",
      "causeCode": "DOMAIN_NOTES_LOCK_HELD",
      "failureClass": "domain",
      "exitCode": 3,
      "effectClass": "repository-local",
      "transactionState": "unchanged",
      "retryable": false,
      "retryDelayPolicy": {
        "kind": "none"
      },
      "trigger": "The note store lock is held.",
      "guidance": {
        "handoff": {
          "owner": "operator",
          "reason": "Another run may still be working on the note store.",
          "inspect": [
            {
              "kind": "instruction",
              "text": "Inspect the lock's owner and the note store."
            }
          ]
        }
      },
      "repairAction": "Inspect the lock owner and resource evidence, then follow the authorised recovery handoff. Never replay automatically.",
      "reachability": "required",
      "unreachableRationale": null
    },
    {
      "commandIdentity": "notes.apply",
      "outcome": "refused",
      "causeCode": "TRANSIENT_NOT_STARTED",
      "failureClass": "transient",
      "exitCode": 75,
      "effectClass": "repository-local",
      "transactionState": "unchanged",
      "retryable": true,
      "retryDelayPolicy": {
        "kind": "bounded",
        "minimumMilliseconds": 250,
        "maximumMilliseconds": 2000
      },
      "trigger": "A sync of the note store is in progress.",
      "guidance": {
        "next": {
          "kind": "retry"
        }
      },
      "repairAction": "Wait for the sync to finish.",
      "reachability": "required",
      "unreachableRationale": null
    }
  ],
  "input": {
    "arguments": [],
    "options": [
      {
        "name": "--preview",
        "aliases": [],
        "summary": "Use this unconsumed preview.",
        "required": true,
        "repeatable": false,
        "value": {
          "kind": "string",
          "minLength": 1,
          "maxLength": 80,
          "choices": null,
          "pattern": null
        }
      }
    ],
    "constraints": [],
    "deadlineSupported": false,
    "additionalArguments": false,
    "additionalOptions": false
  }
}
```

## 6. What the lost-response command reports

`data` only, from `notes.pending` after an apply was interrupted. The
envelope's `next` is the report's one fixed step, chosen by this CLI:
`{ "kind": "instruction", "text": "Inspect the unresolved case and follow its recovery handoff. Never repeat the interrupted operation automatically." }`.

```json
{
  "unfinished": [
    {
      "commandIdentity": "notes.apply",
      "runId": "run-05",
      "effects": ["note.write"],
      "operationId": "operation-05"
    }
  ]
}
```

## 7. Discovery

`data` only.

```json
{
  "contractVersion": "3.0.0",
  "commands": [
    {
      "commandIdentity": "notes.help",
      "route": ["--help"],
      "summary": "Describe usage and commands.",
      "effectClass": "inspect"
    },
    {
      "commandIdentity": "notes.discovery",
      "route": ["--discover"],
      "summary": "Describe the contract and every command.",
      "effectClass": "inspect"
    },
    {
      "commandIdentity": "notes.command-discovery",
      "route": ["--discover-command"],
      "summary": "Describe one command and its stations.",
      "effectClass": "inspect"
    },
    {
      "commandIdentity": "notes.dispatch",
      "route": [],
      "summary": "Route an invocation to one command.",
      "effectClass": "inspect"
    },
    {
      "commandIdentity": "notes.list",
      "route": ["list"],
      "summary": "List notes.",
      "effectClass": "inspect"
    },
    {
      "commandIdentity": "notes.preview",
      "route": ["preview"],
      "summary": "Preview one note change.",
      "effectClass": "repository-local"
    },
    {
      "commandIdentity": "notes.apply",
      "route": ["apply"],
      "summary": "Apply one previewed note change.",
      "effectClass": "repository-local"
    },
    {
      "commandIdentity": "notes.pending",
      "route": ["pending"],
      "summary": "Report unfinished applies.",
      "effectClass": "inspect"
    }
  ],
  "exitMeanings": {
    "0": "success",
    "1": "internal",
    "2": "usage",
    "3": "domain",
    "4": "schema",
    "75": "transient"
  },
  "signalExits": {
    "130": "SIGINT",
    "143": "SIGTERM"
  },
  "effectExclusions": ["journal maintenance"]
}
```

## 8. Closure does not mean the original effect succeeded

Illustrative TypeScript, not compiled. This is an internal semantic sketch,
not a new envelope schema or promised API:

```ts
type Closure =
  | { disposition: "completed"; evidence: readonly string[] }
  | { disposition: "not-applied"; evidence: readonly string[] }
  | { disposition: "outcome-unknown"; approvalReference: string };

const decision = {
  disposition: "outcome-unknown",
  approvalReference: "approval-42",
} as const satisfies Closure;

// The type accepts this reference. It cannot prove a person approved it.
// Runtime recovery verifies the grant, stopped writers and exclusive ownership,
// then durably records closure. It never calls the original effect again.
```

An unrelated note operation can proceed only after conflict-scope admission
proves independence. A later change to the resource does not erase or reopen
the retained unknown history (REC-2, REC-4).

## 9. Approval ordering

Illustrative TypeScript, not compiled; names describe ordering only:

```ts
const input = parseUnknownInput(argv);
const grant = await inspectGrant(input); // no consumption
const lock = await acquireExclusive(input); // refusal preserves the grant
try {
  await revalidateExactItem(grant, input);
  await consumeAtomically(grant); // durable before effect
  await performApprovedEffect(input);
} finally {
  await releaseOwnedLock(lock);
}
```

The sketch omits required journaling and lifecycle machinery, so it is not a
production recipe. A crash after consumption does not refund approval or
permit replay. V-20 tests those crash boundaries and competing processes.
