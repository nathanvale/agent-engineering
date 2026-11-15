# Decisions that are Nathan's

Candidate text for Command Contract 3.0. Not accepted, not binding. Read
[index.md](index.md) first for clause tags and status.

None of these is decided. Each clause tagged `[Q n]` shows one default so the
text can be read and reviewed whole. The default is the drafter's suggestion.
Each question lists the clauses its answer changes.

Two questions, Q4 and Q7, are different. Their defaults stay close to the
accepted rules and to your decision 11, and each names any proposed rule it
still contains. The larger option in each has no reviewed design. Review
found the drafter's designs unsafe, over two rounds for the lock reclaim and
four for settlement, so none is in this text. Each default leaves part of
decision 20 uncarried.

## Order

Ranked by how much of the build depends on the answer. The numbers are
stable identifiers, not ranks.

| Rank | Question |
| --- | --- |
| 1 | Q1. Stations declared once, selected by code |
| 2 | Q2. The step kinds |
| 3 | Q7. Whether the contract defines settlement |
| 4 | Q4. Reclaiming a dead owner's lock |
| 5 | Q3. Run values in guidance |
| 6 | Q5. The version rule |
| 7 | Q10. Killing started programs on exit |
| 8 | Q6. Smaller changes |
| 9 | Q8. Lint conditions |
| 10 | Q9. Where acceptance records live |

## Q1. Do commands declare their results once, as stations that code selects?

- **Why it is yours.** This is working answer 6. It came from a prototype.
  You were told and have not accepted it.
- **Yes (the default).** One copy of each station's words. Discovery, help
  and tests read the same declaration. The engine returns a selected station,
  which is the larger edit when existing CLIs move.
- **No.** Handlers build results and discovery keeps a second list. A helper
  can make the compiler insist the two agree, at the cost of writing every
  station's words twice. No also reopens part of decision 20: the base you
  accepted exposes a `station` function, and several of its compile-time
  gates assume handlers select declared stations.
- **What the evidence says.** Compile-time safety does not separate the two.
  Duplication does. The case for yes is a single copy, which is close to a
  preference.
- **Clauses.** DISC-9, CMD-5, CMD-10, LIFE-8, GATE-4, GATE-7 (S2 to S4).

## Q2. Which step kinds does 3.0.0 have?

- **Why it is yours.** You decided "structured next steps with text
  instructions when there's no command". The kinds, their fields and the key
  name were left to this text.
- **The default.** The key is `next`. Four kinds: `command`, `retry`,
  `instruction`, `done`. `retry` appears exactly when `retryable` is true.
  `done` only on success. Handoff inspection entries become structured and
  stay read-only. A request to a person is always a handoff.
- **Smaller.** Two kinds, `command` and `instruction`, as you first said. A
  reviewer encoded 38 real strings this way: 8 fit, 17 lost meaning, 13 could
  not be written. Retry would stay a sentence.
- **Larger.** Add a sequence, a choice and a caller-supplied value now. More
  to build and prove before any CLI uses them. A later minor can add each.
- **Also inside this question.** Command discovery lists no options, so a
  reader cannot check a step's arguments. Listing them would be a further
  addition to discovery.
- **Clauses.** WIRE-8, WIRE-9, WIRE-17, STEP-1 to STEP-8, STEP-12.

## Q7. Should the contract define how an unfinished change is settled?

- **Why it is yours.** You decided each changing command names a read-only
  command to run when no result arrives. The plan proposes that it reports
  unfinished work. Neither says what happens next.
- **What you decided, carried as is.** Each changing command names a
  read-only command to run when no result arrives.
- **Proposed on top (the default).** The key is `ifNoResult`, in command
  discovery, holding a `command` step. The named command, the report,
  returns `data.unfinished`: every change the journal shows started with no
  outcome recorded. A caller that gets no result runs the report first and
  never repeats the change first.
- **What the default leaves out.** When an unfinished change counts as
  finished, who may say so, and whether a CLI must refuse new changes until
  then. The plan classes these as starter behaviour, and each CLI decides
  them for itself, as today. Decision 20's state add-on includes "recovery".
  That part is not carried.
- **The cost of the default.** A run that is killed mid-change stays in the
  report for good. No command can remove it, a CLI's own recover command
  included. The report covers the whole CLI, so after one such crash every
  later careful caller that gets no result stops with a person. Nothing in
  the contract stops a careless caller. This is the first thing a settlement
  design would have to fix.
- **Larger.** The contract defines settlement. No reviewed design exists.
  Four review rounds each broke the drafter's attempt. CMD-13a lists the
  seven scenarios a design must pass, such as: a crash after a write must
  not block later changes for good; a caller must not be able to declare its
  own interrupted change "not applied" and repeat it; an effect that cannot
  be observed must have a stated end. A design would be drafted and reviewed
  separately. It would also need to keep the recover step that the CLI
  guarding vault writes relies on after a partial finish. Whether it could
  arrive in a later 3.x minor without changing an existing meaning is not
  established.
- **A consequence of parking decision 12.** An empty report does not say
  whether the lost run completed, and a nonempty one does not say which
  listed run was the caller's.
- **Clauses.** DISC-7, DISC-13 to DISC-15, DISC-14a, CMD-13, CMD-13a, V-19.

## Q4. May a lock be reclaimed when its owner is dead?

- **Why it is yours.** The accepted lifecycle specification says "No stale
  lock is stolen automatically". The design you accepted in decision 20
  includes "lock with dead-owner reclaim". The two disagree.
- **Accepted, carried as is.** No stale lock is stolen automatically, and
  the other process "safely refuses".
- **Proposed on top (the default).** A held lock is refused with a handoff
  and never given a retry step, as the 2.0 exemplar does. A command may wait
  a bounded time in-process first. A person removes a lock only after
  confirming its owner is stopped. The plan classes the stale lock as
  starter behaviour. The text makes this a contract rule.
- **The cost of the default.** Every crash that leaves a lock needs a
  person. Ordinary contention between two runs also ends in a handoff once
  the wait runs out. The CLI that guards vault writes, the first to move,
  behaves differently today: it waits about two seconds and then refuses
  with a retry step. It would change.
- **Middle option.** Keep a retry step for a held lock, as that CLI has
  today. Without a reclaim, a lock left by a crash then makes a caller retry
  without end.
- **Yes.** Reclaim a dead owner's lock. No reviewed design exists. A design
  would have to show: two processes that both judge a lock dead cannot both
  take it; a live owner is never judged dead across containers, shared host
  names or hidden process lists; any doubt counts as "cannot tell"; it works
  on local filesystems only; it works on macOS, where the process list is
  not readable the same way. It would be drafted and reviewed separately.
  The CLI that guards vault writes is also the one that reclaims a dead
  owner's lock today. The reviews report that it judges by process identity
  and uses age in one part, which the accepted rule forbids. Whether a
  reclaim could arrive in a later 3.x minor without changing an existing
  meaning is not established.
- **Clauses.** CMD-12, STEP-15, V-22.

## Q3. May guidance carry values from the run?

- **Why it is yours.** The accepted contract allows five substitutions and
  says any other needs an explicit revision. Fourteen real next-step strings
  need a run value.
- **Yes (the default).** A `bindings` key on the result and a
  `{binding.<name>}` token, so a step can say "apply preview `pv-7f3a`" as a
  command a machine can run. A binding fills only a whole argument or a
  resource identifier, never guidance text. Its value cannot begin with `-`,
  cannot hold control or invisible characters, and cannot equal a command's
  route word. One limit stays open: a value may still equal a keyword that a
  command treats specially, which only review of that command catches. The
  five existing substitutions also apply inside structured arguments, under
  the same value rule, so a caller-chosen key cannot become an option
  either.
- **No.** Keep the five. A step that needs a run value becomes a text
  instruction pointing at `message` or `data`.
- **Trade-off.** Yes adds one wire key and several validation rules. No keeps
  the wire smaller and leaves those steps unreadable to a machine.
- **Clauses.** STEP-9a, STEP-10, WIRE-7 (`bindings`), V-14, V-39.

## Q5. Is the version rule as written?

- **Why it is yours.** You decided "Accept older 3.x". Everything else in
  the rule is proposed wording.
- **The default.** A version is exactly `3.<minor>.0`. A reader refuses a
  newer minor and any other major. A minor may add optional keys and union
  members and never changes a meaning. A minor never adds a common cause. A
  CLI stamps its own minor and readers upgrade first. The fallback always
  declares 3.0.0. A malformed version is reported as invalid input, apart
  from a newer one. The observed version is reported in `message`.
- **Alternatives inside it.** Stamp the lowest minor an envelope fits
  (smoother for readers, more complex for producers). Give "newer" and
  "malformed" their own cause codes in place of reusing two existing ones.
- **Clauses.** VER-1 to VER-11, VER-6a, WIRE-18
  (`SCHEMA_UNSUPPORTED_CONTRACT`).

## Q10. May the CLI kill programs it started when it exits?

- **Why it is yours.** It changes five accepted lifecycle rows. A repeated
  signal today means "immediate termination" with no cleanup promise, and a
  crash allows one emergency recording attempt "only".
- **Yes (the default).** Started programs are stopped on a first signal and
  killed on a repeated signal and on a crash, before the CLI exits. The
  prototype behind decision 20 found a started program still running after
  the CLI was gone. No envelope, flush or journal guarantee changes.
- **No.** Keep the rows as accepted. A started program can outlive the CLI
  after a second Ctrl+C. No also reopens part of decision 20, whose design
  says "programs must be killed on exit".
- **A limit either way.** When something kills the CLI outright, a program it
  started in another process group survives.
- **Clauses.** LIFE-11, the lifecycle table in LIFE-3, CMD-14, V-21.

## Q6. Are these smaller changes accepted?

- **Why it is yours.** Each changes accepted text beyond decisions 1, 2 and
  8, and the plan says any such change goes to you first.
- **Three keys removed (the default).** `envelopeVersion`: it duplicates the
  major, and the version rule allows one version field. `profile` in
  discovery: decision 18 retired the profiles, and each command already
  carries its effect class. `generationConventionVersion` in discovery.
- **Six meanings stated (the default).**
  - `availablePaths` lists declared commands, all of them or a relevant
    subset, sorted by code unit. It grants and forbids nothing.
  - The built-in commands must appear in discovery. Help's command list holds
    host commands only.
  - A root command with an empty route must take an option or an operand, so
    running the CLI with no arguments is always a usage refusal.
  - Results the base produces, such as usage refusals, appear among each
    command's stations, with default words a command may replace. The
    fallback's words are the base's and cannot be replaced. A command's
    identity is at most 128 bytes, so the fallback always fits.
  - A read-only command with no station table has one derived result:
    success with nothing further to do.
  - An approval grant is used up only once the command holds its lock. A
    command that runs a program the caller supplies says so in its summary.
- **Also proposed wording.** The three successor criteria that replace
  CDS-CE-1 to CDS-CE-3 ([ROLL-8](adoption.md#successor-criteria)).
- **Alternatives.** Keep `envelopeVersion` as the integer `3`. Replace
  `profile` with a list of installed add-ons. Keep the generation marker as a
  copy of the version.
- **Clauses.** WIRE-6, WIRE-6a, DISC-4, DISC-5, DISC-6, DISC-10, DISC-11,
  DISC-11b, CMD-14, CMD-15, ROLL-8.

## Q8. Which earlier lint conditions still apply?

- **Why it is yours.** In September the project concluded lint "adds little"
  and set conditions on adopting it. You have since chosen two rules. The
  brief asks the text to say which conditions survive.
- **The default.** Carry two: an unresolved disagreement between the two
  compilers blocks activation, and locks compare diagnostic codes. Leave the
  performance budget to the template revision.
- **Also inside this question.** A review verified two further lint rules
  that close an `Object.assign` and an array-covariance bypass. You selected
  two rules and no others. Adding them is your call.
- **Clauses.** GATE-9a, GATE-13, GATE-14.

## Q9. Where do the acceptance records live once the vault is deprecated?

- **Why it is yours.** Accepting this text means recording a hash, a
  contract specification revision, a template specification revision and the
  decision log entries. Today those live in the vault. You have said the
  vault will be deprecated.
- **No default.** The text names no home. This does not block the review. It
  blocks steps 5 to 8 of
  [ROLL-9](adoption.md#what-makes-this-text-binding).

## Yours, during the build

Not needed to accept the text. The design's own judge filed the first three
as owner questions.

- Whether adding an add-on may run template code, and what happens when a
  check fails after it. It bears on recovery.
- Which version of the logging library the diagnostics add-on pins. It is a
  lasting dependency.
- Whether a retained stream file is an effect or an exclusion, and whether an
  `inspect` command may create one. It bears on privacy.
- Which existing CLIs retire, beyond the one that stays (decision 16).
- The verification skill's name, place, invocation and fault fixtures.
- Whether the one CLI still on 1.0.0 ever moves.

## Engineering, not yours

Settled by the build with evidence: the kernel's exact function signatures;
how shared types reach a per-CLI cause table; a design without the six double
casts; the composer, admission and lockfile mechanics; who owns the table
comparison checks.
