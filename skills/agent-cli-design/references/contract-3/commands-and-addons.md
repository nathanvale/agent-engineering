# Commands, the base and add-ons

Candidate text for Command Contract 3.0. Not accepted, not binding. Read
[index.md](index.md) first for clause tags and status.

Nathan accepted the shape (decision 20): a stamped base in every CLI, four
add-on folders, rules that follow each command, and a compiler check on what
each command may do. The exact function signatures are engineering for the
build. Names below describe the accepted shape. They are not a frozen API.

## One CLI

**CMD-1 `[TS4]`** A repository has exactly one first-party application CLI,
workspace packages included. A new command joins that CLI through its
existing dispatch, help and command discovery owner. Nothing adds a parallel
command registry or a second entry point. When several application CLIs
exist, routes collide, or the existing CLI cannot safely take the command,
refuse before any write and name the conflict and its repair.

## Rules follow the command

**CMD-2 `[D 18]`** No label on the whole CLI selects its rules. Each
command's rules follow from its own declaration. The 2.0 profiles `simple`
and `complex` do not exist in 3.0.

**CMD-3 `[D 18]` `[C0]` `[P]`**

| The command                                       | Rules that apply                                                                                                                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Has effect class `inspect`                        | The base rules. Always `unchanged`, complete inventory, three empty collections ([WIRE-13](wire.md#effect-state-table)).                                                      |
| Has effect class `repository-local` or `external` | The base rules, plus: declared effects, declared stations, a journal (CMD-11), a lock (CMD-12) and an `ifNoResult` command (CMD-10). A recovery path follows REC-1 to REC-10. |
| Runs another program                              | The programs add-on (CMD-14), whatever its effect class                                                                                                                       |
| Checks an approval or an identity                 | The approval add-on (CMD-15), whatever its effect class                                                                                                                       |
| Needs durable diagnostics                         | The diagnostics add-on (CMD-16)                                                                                                                                               |

**CMD-4 `[TS4]` `[D 18]`** An `inspect` command performs no domain mutation,
including a single deterministic local-file write. Persisting a preview or
closing a recovery case makes a command changing. Only the explicit incidental
maintenance exclusions of DIAG-13 remain outside domain effects. Raw stream
retention classification stays open as listed in decisions.md. Being read-only
waives nothing else. An approval
check or an identity boundary carries its own rules on an `inspect` command
too. This is the 2.0 rule "read-only does not waive other complex triggers",
restated per command.

## The base

**CMD-5 `[D 20]`** Every 3.0 CLI carries a stamped, dependency-free base, the
kernel, at `src/kernel/`. It owns routing, help, discovery with the built-in
commands declared, the lifecycle, the one writer, the complete validator and
the fallback. It exposes five functions: `contractFor`, `runProcess`,
`command`, `changing` and `station`.

**CMD-6 `[D 20]` `[A 3]`** Ownership follows the path, so no file has two owners:

| Path                                                                                                        | Owner                                                             |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `src/kernel/**`                                                                                             | The template. Stamped.                                            |
| `src/addons/<name>/**`                                                                                      | The template. Stamped. Present only when the add-on is installed. |
| The existing CLI front door and registration, `src/commands/**`, `src/domain/**`, host `packages/**`, tests | The host CLI                                                      |

In a generated repository, `src/cli.ts` is the front door and `src/commands.ts`
is its command table. In an existing repository, preserve its actual front door
and registration owner (CMD-1). Small implementations may live in `src/`; large
ones may live in `packages/`. Neither layout creates another application CLI.
This is A5, not a prescribed size threshold. The 3.0 checker, composer and
exemplar live alongside this skill in agent-engineering behind that repository's
one CLI (A3). The separate template continues to own stamped starter sources.

**CMD-7 `[D 20]`** Stamped code is byte-identical to the pinned template
revision, and a check fails when one copy differs. A CLI never edits stamped
code for itself. A fix waits for a template revision. Nathan accepted that
cost with decision 20. The route by which an existing repository receives a
new revision is not designed.

**CMD-8 `[D 20]`** The handler's context is typed from the command's own
declaration. A capability, such as running a program or reading an approval,
exists on the context only when the command declares it and its add-on is
installed. Using an undeclared capability does not compile. This is the one
gate that reaches a host whose lint configuration the template does not
control.

## Dispatch order

**CMD-9 `[D 20]` `[P]`** The base processes an invocation in this order and
stops at the first refusal:

1. Read the global switches and the built-in options.
2. Resolve the route to one declared command, by exact match of route
   tokens. An unknown route is refused as `<cli>.dispatch` with
   `USAGE_UNKNOWN_COMMAND`.
3. Parse and validate the command's input from `unknown`. A host command's
   malformed input is refused under that command's identity with a usage or
   schema cause. A built-in option error is refused as `<cli>.dispatch`
   ([DISC-1](discovery.md#invocations)).
4. Refuse with `DOMAIN_DEADLINE_BEFORE_START` when a declared deadline has
   already passed.
5. Run non-consuming preflight guards. Approval is checked, not consumed.
6. Attach only the declared capabilities and enter the handler.
7. Before an approved effect, acquire exclusive coordination, revalidate the
   exact-item grant and current resource conditions, then atomically consume
   the grant. Only then begin the approved effect (CMD-15, A19).

Step 3 comes before step 5 on purpose. An approval guard runs before the
handler, so input the base has not validated would otherwise reach the guard.
A malformed request never reads or consumes a grant and never produces an
approval denial.

**CMD-9a `[C0]` `[SK]`** External data enters as `unknown` and is parsed
before use: argv, files, JSON, environment, network responses and persisted
state. Cycles and depth are guarded before any schema parsing. Argv is parsed
strictly `[SK]`.

## Changing commands

**CMD-10 `[D 11]` `[D 20]`** A changing command declares:

- its effect identifiers, at least one;
- its stations ([DISC-9](discovery.md#stations)) `[P]`;
- its held-lock refusal station (CMD-12) `[P]`. A declaration without one
  is rejected;
- a distinct unresolved-case refusal station for conflicting unfinished work,
  with a host-owned cause and a handoff to the declared recovery/history route
  (REC-2). It must not reuse the held-lock cause when the repair differs;
- its `ifNoResult` command ([DISC-13](discovery.md#if-no-result)). Only the
  state add-on can create the value that names it, so a changing command
  without one does not compile.

**CMD-10a `[D 20]`** Effect truth comes from the journal and the real
resource, independently of diagnostics `[C0]`. Decision 20's mechanism for
that: a changing command reports `completed` only through the state add-on's
transaction, after read-back. A handler cannot assert a transaction state. An
`inspect` command cannot open a transaction.

**CMD-10b `[SK]`** Preview and apply are separate for state-changing work. A
preview records the intended effect identifiers and the observed resource
revision without performing the change. An apply is bound to its unconsumed
preview, resource revision, authority and effect identifiers.

## State add-on

**CMD-11 `[LO]` `[C0]`** Journal:

- Persist the intent before each effect. Confirm resource read-back before
  recording completion.
- Never replay. Recovery reads the journal and the real resource, then
  reports what is confirmed.
- A fault between durable intent and the resource write is classified pending
  or unknown. A silent no-op never becomes a false completion. A truncated
  final record is never parsed as state.
- A read-back failure yields `unknown` and a safe handoff.
- Partial and unknown are told apart from independently observable
  resources, never from the journal alone.
- The journal version and records, lock ownership, length and checksum
  validation, lock refusal/qualified-reclaim transitions and the recovery table are frozen before any
  change to storage.
- Evidence covers process crash and file flush only. It is never a power-loss
  or all-filesystem durability claim.

**CMD-12 `[LO]` `[A 13]` `[P]`** Exclusive coordination follows
[REC-7](recovery.md#exclusive-coordination-and-reclaim). Age alone never proves
an owner stopped. Contenders cannot both acquire a live or reclaimed scope.
Bounded waiting ends in acquisition, refusal, signal or deadline. Every changing
command declares a held-lock refusal station owned by that CLI; the state
add-on adds no common cause. The handoff diagnoses owner and resource state,
not merely an empty pending report. Lock refusal is unchanged and preserves
the grant (CMD-15). Do not suggest manually unlinking a lock as safe takeover.

**CMD-13 `[D 11]` `[A 1]` `[A 2]` `[P]`** Unfinished changes are reported by
the read-only `ifNoResult` route (DISC-14). The state add-on also provides
separate changing recovery operations governed by REC-1 to REC-10. Observation,
closure and a new domain operation are distinct. Recovery never replays an effect.

**CMD-13a `[A 1]` `[A 2]` `[A 13]` `[P]`** The recovery design is now included
in [recovery.md](recovery.md). Prior review broke seven scenarios; all survive
as acceptance controls in REC-9 and V-42. The new text has no production proof.
State add-on engineering owns durable identity, scope, exclusive coordination
and closure records; the independent reviewer tests the evidence and races.
If a platform cannot establish the required proofs, return a human handoff.

## Programs add-on

**CMD-14 `[D 20]` `[A 14]` `[P]`** A command runs another program only through the
programs add-on:

- Three cases: a read-only program, a program the caller supplies, and a
  domain program that changes things.
- Every started program has a timeout and its own process group. Stopping is
  SIGTERM, then SIGKILL. The two exceptions are the repeated-signal and crash
  paths of LIFE-11, which send SIGKILL at once.
- A started program never inherits the CLI's stdin, stdout or stderr. Its
  stdin is closed. Its output is captured through pipes under a declared
  bound, and reaches the CLI's own streams only through the writer. A child
  that wrote straight to stdout would break the one-envelope rule
  ([LIFE-1](lifecycle.md#output-modes)).
- Owned programs receive bounded shutdown attempts under
  [LIFE-11](lifecycle.md#started-programs). Sending a signal is not proof of
  termination; escaped descendants and remote work are not guaranteed stopped.
- Acquiring a domain-program handle requires a recorded-effect capability
  (GATE-7 K3). A captured handle can outlive its callback, so acquisition alone
  does not authorise a later start. Immediately before every program start,
  the programs add-on verifies that the capability belongs to the current run
  and the still-active recorded effect. The state add-on owns that lifetime;
  the kernel's public capability interface connects the two without add-on
  imports. Coordinate start admission with effect closure so there is no
  unchecked gap between the lifetime check and starting the program. Reject
  expired or wrong-run/effect capabilities before creating a process. Every
  admitted run remains journaled under CMD-11. V-21 owns the process proof;
  validating an eventual output envelope is too late to enforce this rule.
- A command that runs a caller-supplied program says so in its `summary`.
  No new key carries the disclosure.
- Outside the add-on's own folder the generated lint configuration bans
  `node:child_process`, `Bun.spawn`, `Bun.spawnSync` and `Bun.$`. A CLI
  without the add-on gets no exception. The ban is a guard against accident.
  It is not isolation: lint does not stop code that reaches a program some
  other way.

## Approval add-on

**CMD-15 `[D 20]` `[LO]` `[P]` `[A 19]`** A command that needs an exact-item grant
declares the approval add-on:

- The guard runs before the handler and after input validation (CMD-9).
- The grant is read as untrusted input, through a hardened read.
- Every denial is one identical result: `DOMAIN_AUTHORITY_REQUIRED`, refused
  and unchanged, with a handoff naming the authority owner. A missing, stale,
  consumed or mismatched grant are indistinguishable to the caller, so a
  denial reveals nothing about which grants exist.
- A19 settles ordering: validate input, perform non-consuming checks, acquire
  the exclusive lock for the changing operation, revalidate the exact-item
  grant against current identity, resource revision and intended effects,
  atomically consume it, then begin the approved effect. No refusal caused
  by lock contention consumes it. Expiration can still make a retained grant
  invalid later.
- Consumption is atomic across contenders and durable before the effect. A
  crash after consumption neither refunds it nor authorises replay. Recovery
  reports the observed state under REC-1 to REC-10. This rule does not introduce
  changing-operation locks on read-only identity or approval inspection.

## Diagnostics add-on

**CMD-16 `[D 20]` `[LO]`** Durable diagnostics come only from the diagnostics
add-on. It keeps bounded private per-run logs under the limits of
[diagnostics.md](diagnostics.md), never decides an outcome, and is the only
add-on with a runtime dependency. Diagnostics custody stays separate from
the recovery journal `[SK]`.

## Composition

**CMD-17 `[D 20]`**

- An add-on is a folder that imports only the kernel's public index. It never
  imports another add-on, and never patches the kernel or another add-on.
- One manifest lists the installed add-ons. It is the only such list.
- One planner renders the lint bans, the dependency pins and the boundary
  zones from that list.
- A lockfile is committed per dependency set.
- Each add-on passes on the base alone. The full set passes together.
- Adding an add-on writes only the add-on's own paths, the pins, the lock,
  the regenerated configuration and the manifest. It never edits a host file.
  The agent registers the first command that uses it.

**CMD-18 `[D 19]` `[D 20]`** Admission checks the template's pins as a
subset. A CLI may add its own dependencies. The template stops shipping
Zod: the kernel's validator checks every result in every CLI
([LIFE-8](lifecycle.md#writer)). A CLI may add Zod as its own dependency to
parse its own input or state files. A published JSON Schema of the format,
which Zod could have exported, needs another source. None is chosen.

**CMD-19 `[D 21]`** Where several CLI packages share one workspace and one
root lint configuration, each package gets its own generated lint
configuration, written from its add-on list. This belongs to the later move
of existing CLIs, not to the foundation.

## Not verified

No one has run the following. Each is a build obligation, not a property this
text can claim: the lint rules on foundation code; static admission; the
add-on composer; per-dependency-set lockfiles; lock release when a signal
arrives mid-change; boundary zones per workspace package; whether the
boundary tool notices an installed add-on nothing uses, which it can only do
if admission checks imports. The proposed recovery and lock rules (REC-1 to REC-10) still need platform
qualification and independent process evidence. The prototype
behind decision 20 printed 2.0.0 envelopes with string next steps, so it
shows the shape and the behaviour, not the 3.0 wire.

## Illustrative declaration

Illustrative only. Not compiled, not an API. This fragment shows effect recording,
read-back and the two distinct coordination refusals. Input declarations,
preview/approval setup, cause-table entries and helper implementations are
omitted; it is not an admissible complete command by itself. The state add-on
supplies the inherited transaction and lifecycle machinery.

```ts
// src/commands/apply.ts, host-owned
export const pending = state.pendingCommand({
  identity: "notes.pending",
  route: ["pending"],
  summary: "Report unfinished applies.",
});

export const caseHistory = command({
  identity: "notes.case-history",
  route: ["case", "history"],
  summary: "Read one operation's retained evidence and recovery guidance.",
  input: {
    arguments: [
      textArgument("operationId", {
        required: true,
        minLength: 1,
        maxLength: 80,
      }),
    ],
    options: [],
  },
  run: (input) => readCaseHistory(input.operationId),
});

export const apply = changing({
  identity: "notes.apply",
  effectClass: "repository-local",
  route: ["apply"],
  summary: "Apply one note.",
  effects: ["note.write"],
  ifNoResult: pending.unfinished, // only the state add-on creates this
  stations: {
    applied: station.success("SUCCESS_COMPLETED", {
      trigger: "Written and read back.",
      next: { kind: "done" },
    }),
    lockHeld: station.refused("DOMAIN_NOTES_LOCK_HELD", {
      trigger: "The note store lock is held.",
      repair:
        "Inspect ownership and resource evidence. Use the authorised recovery route; never replay automatically.",
      handoff: {
        owner: "operator",
        reason: "Another run may still be working.",
        inspect: [
          {
            kind: "instruction",
            text: "Inspect the lock's owner and the note store.",
          },
        ],
      },
    }),
    unresolvedCase: station.refused("DOMAIN_NOTES_UNRESOLVED", {
      trigger: "An unfinished operation conflicts with this note change.",
      repair:
        "Inspect the blocking case and its retained history, then follow its authorised recovery route. Never replay the interrupted operation.",
      handoff: {
        owner: "operator",
        reason: "A conflicting earlier operation remains unresolved.",
        inspect: [
          {
            kind: "command",
            command: "notes.case-history",
            args: ["{binding.operationId}"],
          },
        ],
      },
    }),
  },
  run: (input, ctx) =>
    state.transaction(ctx, async (tx) => {
      await tx.effect(
        "note.write",
        (token) => tx.writeFile(token, target(input), bytes(input)),
        () => readBack(input),
      );
      return tx.complete(ctx.stations.applied, { path: target(input) });
    }),
});
```

The host registers all three commands through its existing command table.
`readCaseHistory` is read-only and reports retained evidence and the separately
authorised recovery route. The unresolved-case result supplies the validated
blocking `operationId` as its binding under STEP-10; the handler cannot replace
the station's fixed repair words. The input declaration shown belongs to the
history command; the apply command's input and preview checks remain omitted.
