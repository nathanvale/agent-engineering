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

**CMD-3 `[D 18]` `[C0]` `[Q 4]` `[Q 7]`**

| The command | Rules that apply |
| --- | --- |
| Has effect class `inspect` | The base rules. Always `unchanged`, complete inventory, three empty collections ([WIRE-13](wire.md#effect-state-table)). |
| Has effect class `repository-local` or `external` | The base rules, plus: declared effects, declared stations, a journal (CMD-11), a lock (CMD-12) and an `ifNoResult` command (CMD-10). The plan also lists a recovery path. None is defined here (CMD-13a). |
| Runs another program | The programs add-on (CMD-14), whatever its effect class |
| Checks an approval or an identity | The approval add-on (CMD-15), whatever its effect class |
| Needs durable diagnostics | The diagnostics add-on (CMD-16) |

**CMD-4 `[TS4]` `[D 18]`** Being read-only waives nothing else. An approval
check or an identity boundary carries its own rules on an `inspect` command
too. This is the 2.0 rule "read-only does not waive other complex triggers",
restated per command.

## The base

**CMD-5 `[D 20]`** Every 3.0 CLI carries a stamped, dependency-free base, the
kernel, at `src/kernel/`. It owns routing, help, discovery with the built-in
commands declared, the lifecycle, the one writer, the complete validator and
the fallback. It exposes five functions: `contractFor`, `runProcess`,
`command`, `changing` and `station`.

**CMD-6 `[D 20]`** Ownership follows the path, so no file has two owners:

| Path | Owner |
| --- | --- |
| `src/kernel/**` | The template. Stamped. |
| `src/addons/<name>/**` | The template. Stamped. Present only when the add-on is installed. |
| `src/cli.ts`, `src/commands.ts`, `src/commands/**`, `src/domain/**`, tests | The host CLI |

`src/commands.ts` is the one command table (CMD-1).

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
5. Run each guard the command declares, such as the approval guard.
6. Attach the command's declared capabilities.
7. Run the handler.

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
- its stations ([DISC-9](discovery.md#stations)) `[Q 1]`;
- its held-lock refusal station (CMD-12) `[Q 4]`. A declaration without one
  is rejected;
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
  validation, stale-lock refusal and the recovery table are frozen before any
  change to storage.
- Evidence covers process crash and file flush only. It is never a power-loss
  or all-filesystem durability claim.

**CMD-12 `[LO]` `[Q 4]`** Lock:

- Two processes attempting one approved change produce exactly one effect.
  The other safely refuses `[LO]`.
- No stale lock is stolen automatically `[LO]`. A lock is released by the run
  that holds it, or cleared by a person `[P]`.
- No unsupported lock age is evidence that a writer is dead `[LO]`.
- Each changing command takes exactly one lock, for the state it changes.
  Commands that change the same state share it. The lock names the run that
  holds it and that run's process identifier and host `[P]`, so a person can
  check whether the owner is stopped.
- A command may wait a bounded time in-process for the lock before it
  refuses. A wait never takes a held lock and always ends: in the lock, in
  the refusal, or in a stop under the signal and deadline rows of
  [LIFE-3](lifecycle.md#lifecycle-table) `[P]`.
- A held lock is refused and unchanged, with a handoff `[P]`, as the 2.0
  exemplar does. The changing command declares that station under a cause it
  owns ([WIRE-19](wire.md#common-causes)), and the state add-on selects it.
  The add-on adds no cause of its own. No `retry` station is declared for a
  held lock, because a lock left by a crash never clears by itself
  ([STEP-15](next-steps.md#station-agreement)).
- The handoff says a run may still be working. Its inspection entry tells
  the person to inspect the lock's owner and the resource. It does not rely
  on the report, which can be empty while a live run has not yet recorded an
  intent. A person removes a lock only after confirming its owner is stopped:
  clearing a live run's lock makes two writers `[P]`. How a lock is cleared
  is the CLI's own documented procedure. The contract defines no clearing
  command.

Decision 20 accepted a state add-on described as "lock with dead-owner
reclaim". The accepted lifecycle specification says "No stale lock is stolen
automatically" and excludes "automatic stale-lock takeover". The two
disagree. This candidate carries the accepted rule and drafts no reclaim.
Two review rounds found the drafter's reclaim designs unsafe: a reclaim that
is not serialised lets two processes both take the lock, and proof that an
owner is dead fails across containers, shared host names and hidden process
lists. Whether to reclaim is Nathan's ([decisions.md](decisions.md), Q4). A
reclaim design, if he wants one, is drafted and reviewed separately.

**CMD-13 `[D 11]` `[Q 7]`** Unfinished changes:

- The report lists every unfinished change
  ([DISC-14](discovery.md#if-no-result)).
- For the report, an unfinished change is an intent the journal records with
  neither a completion record nor a confirmed not-applied record written by
  its own run `[P]`. A run still in progress is listed. A run that records a
  partial or unknown result is still listed. A run that completes is not.
- This candidate does not say when or how an unfinished change becomes
  finished after a crash. It does not require a CLI to refuse a new change
  while one is unfinished. The plan classes both as starter behaviour. What
  a CLI does about an unfinished change beyond the report is its own design.
  That design cannot take an entry out of the report (CMD-13a). The rules of
  CMD-11 still hold: never replay, and report only what is confirmed.

**CMD-13a `[Q 7]`** Open requirement: settlement.

- **What is missing.** A rule for when an unfinished change counts as
  finished, who may say so, and whether a CLI must refuse new changes until
  then. Decision 20's state add-on includes "recovery". That part is not
  carried.
- **Consequence today.** Only the run that recorded an intent can end its
  listing, and a killed run never will. Its entry stays in the report for
  good. No command can remove it, a CLI's own recover command included,
  because that is a later run. The report covers the whole CLI, and a caller
  cannot tell which entry is its own. So after one such crash, every later
  caller that follows [DISC-15](discovery.md#if-no-result) stops with a
  person. The default therefore fails the first scenario below. Letting a
  later run end a listing would be a settlement rule, so it is not written
  here.
- **Owner.** Nathan ([decisions.md](decisions.md), Q7).
- **Resolution step.** A settlement design, drafted and reviewed separately.
  Proposed review gate `[P]`: Nathan is asked to accept a design only after
  an independent review shows it passes every scenario below. Each one broke
  an earlier draft of this text in review.

| Scenario | The design fails if |
| --- | --- |
| A run is killed after its effect and before its record. A person clears the lock. Two more changes are attempted. | Either later change is refused, or the report still lists the first run once the design's own settlement step has run |
| A live run has recorded its intent and not yet written | The report omits it |
| A copy of a sent message is deleted by someone else | The effect reads as not applied and the next run sends again |
| An effect cannot be observed, or cannot be undone | The change blocks every later change for good with no stated end |
| A caller's own change was interrupted | The caller can declare it not applied and then repeat it |
| A command records a settlement | It is presented as read-only, or named as an `ifNoResult` command or an inspection entry |
| A run is still working | Another command settles its change |

## Programs add-on

**CMD-14 `[D 20]` `[P]` `[Q 6]` `[Q 10]`** A command runs another program only through the
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
- No started program outlives the CLI
  ([LIFE-11](lifecycle.md#started-programs)).
- A domain program has a handle only inside a recorded effect, so its run is
  journaled like any other effect (CMD-11).
- A command that runs a caller-supplied program says so in its `summary`.
  No new key carries the disclosure.
- Outside the add-on's own folder the generated lint configuration bans
  `node:child_process`, `Bun.spawn`, `Bun.spawnSync` and `Bun.$`. A CLI
  without the add-on gets no exception. The ban is a guard against accident.
  It is not isolation: lint does not stop code that reaches a program some
  other way.

## Approval add-on

**CMD-15 `[D 20]` `[LO]` `[P]` `[Q 6]`** A command that needs an exact-item grant
declares the approval add-on:

- The guard runs before the handler and after input validation (CMD-9).
- The grant is read as untrusted input, through a hardened read.
- Every denial is one identical result: `DOMAIN_AUTHORITY_REQUIRED`, refused
  and unchanged, with a handoff naming the authority owner. A missing, stale,
  consumed or mismatched grant are indistinguishable to the caller, so a
  denial reveals nothing about which grants exist.
- A grant is consumed at most once `[LO]`, and only once the command holds
  its lock `[Q 6]`. A held-lock refusal never uses up a grant.

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
if admission checks imports. No lock reclaim and no settlement or recovery
design exists in this candidate (CMD-12, CMD-13a). The prototype
behind decision 20 printed 2.0.0 envelopes with string next steps, so it
shows the shape and the behaviour, not the 3.0 wire.

## Illustrative declaration

Illustrative only. Not compiled, not an API. It shows where each rule above
lands in a host file.

```ts
// src/commands/apply.ts, host-owned
export const pending = state.pendingCommand({
  identity: "notes.pending", route: ["pending"],
  summary: "Report unfinished applies.",
});

export const apply = changing({
  identity: "notes.apply", effectClass: "repository-local",
  route: ["apply"], summary: "Apply one note.",
  effects: ["note.write"],
  ifNoResult: pending.unfinished,          // only the state add-on creates this
  stations: {
    applied: station.success("SUCCESS_COMPLETED", {
      trigger: "Written and read back.", next: { kind: "done" },
    }),
    lockHeld: station.refused("DOMAIN_NOTES_LOCK_HELD", {
      trigger: "The note store lock is held.",
      repair: "Remove the lock only after confirming its owner is stopped. Do not retry automatically.",
      handoff: {
        owner: "operator", reason: "Another run may still be working.",
        inspect: [{ kind: "instruction", text: "Inspect the lock's owner and the note store." }],
      },
    }),
  },
  // a state transaction that ends by selecting the declared station
  run: (input, ctx) => state.transaction(ctx, (tx) => tx.complete(ctx.stations.applied)),
});
```
