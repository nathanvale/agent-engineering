# Recovery, scoped blocking and closure

Candidate wording for A1, A2, A13 and A19. Not implementation proof. Read
[index.md](index.md) for status. Earlier failed designs are evidence for the
controls below, not authority to weaken the inherited no-replay contract.

## Identity and evidence

**REC-1 `[LO]` `[A 1]` `[P]`** The state add-on assigns a durable operation
identity before its first intent. Bind the record to command identity, run,
intended effect identifiers, validated resource scopes, observed revisions and
approval reference where applicable. Effects are declared actions; resource
scopes identify what concurrent operations can affect. They are different.
Never store a credential or approval secret as a reference.

Record intent before effects and confirm completion from journal plus
independent resource read-back (CMD-11). Unknown or torn records stay uncertain.
Current absence does not establish that an earlier effect never happened:
a message may have been sent and later deleted. Evidence for non-application
must rule out the attempted effect, not merely fail to observe it now.

## What blocks new work

**REC-2 `[A 2]` `[P]`** A changing operation declares its complete conflict
scope from validated input before acquiring coordination or beginning effects.
The scope covers operation identity, affected resources and shared invariants.
Canonicalise aliases to the same resource identity. Different command names,
paths or opaque IDs alone never prove independence.

The state add-on checks unresolved operations and live ownership under the
same exclusive coordination that protects admission. Two operations can run
independently only when all affected resources and shared invariants are
provably disjoint. Unknown or incomplete scope conservatively conflicts with
any operation whose independence cannot be proved. Read-only inspection stays
available. A whole-repository lock may be used briefly to protect the admission
index; it must not turn an unrelated unresolved case into a permanent global
block. Resource locks and the admission index have one documented ordering.

A refused overlapping operation reports the blocking case and read-only
inspection route through existing guidance. Diagnostics may describe observed
facts and suspected causes separately. Removing diagnostics never changes
admission, scope, authority or recovery outcome.

## Recovery is observation, then a separate change

**REC-3 `[LO]` `[A 1]` `[P]`** `ifNoResult` is strictly read-only. It never
closes, repairs or replays an operation. The state add-on declares separate
recovery commands behind the existing CLI. These are changing commands with
input schemas, stations, their own read-only lost-response routes and an
explicit effect for the recovery-state change. Closure is not hidden as log
maintenance. Exact route words belong to the host, not this contract.

A recovery command takes exclusive coordination over the original case and
its scopes. Every recovery command requires the stopped-owner condition for
all owners able to continue that case. REC-7 defines the runtime proof;
REC-7a leaves open whether an authorised person's attestation can establish
that condition when runtime proof is unavailable. This applies equally to a
command invoked by a person. Re-read journal and resource evidence under
exclusive coordination.
It may record newly confirmed facts and close a case; it never performs the
original domain effect. A compensating domain action is a separately declared,
explicitly authorised operation with its own intent, not an inspection or an
automatic consequence of recovery.

## Durable closure

**REC-4 `[A 1]` `[A 2]` `[P]`** A closure is a monotonic, append-only disposition
of one operation. The proposed disposition vocabulary is `completed`,
`not-applied`, or `outcome-unknown`. It is recovery metadata, not a new
`transactionState` or envelope outcome. Keep the original effect-state evidence separate from this administrative
disposition. For a known partial case, an authorised person may end further
resolution under `outcome-unknown` while the case continues to report its
confirmed partial effects and known remainder. The label means the full
operation was not established as completed or wholly not-applied; it does not
convert known partial facts into uncertain effects or success.

- `completed` needs independent evidence for every intended effect.
- `not-applied` needs evidence excluding every attempted effect. Mere current
  absence, an empty report, caller assertion or a missing final record fails.
- `outcome-unknown` requires the authorised-person boundary in REC-5 and
  retains all known completed, remaining and uncertain facts unchanged.

Persist closure under exclusive coordination, with operation identity, closure
identity, reason, evidence references and observations, authority evidence where
required, and the journal revision it closes. Publish it atomically under the
frozen storage rules of CMD-11. A crash or torn closure cannot create a valid
closure. A retry of the _closure request_ with the same closure identity returns
its prior disposition without another domain effect; it does not retry the
original operation. Conflicting closure content is refused. This internal
identity does not introduce the parked universal caller key (D12).

A run may also end its own listing with its valid completion record or its own
independently confirmed not-applied record, as in the inherited contract. This
preserves safe transient-unchanged retries. A later run may not invent such a
record on the original run's behalf; it uses the closure protocol instead.
For a case needing recovery, only a valid durable closure removes it from
`unfinished` and releases
its unresolved-case barrier. Keep the original intent and closure history
readable. Never reopen a settled case simply because a later legitimate change
alters the resource. Evidence records what was confirmed at closure time.
Closure cannot release a live writer's exclusion. Recording closure does not
claim that the original domain operation succeeded; the recovery command's
own success describes only its explicitly declared recovery-state effect.

## Human authority for unknown outcomes

**REC-5 `[A 1]` `[A 19]` `[P]`** The approval add-on verifies authority from a
trusted source independent of caller arguments. Bind the exact-item grant to
this operation, proposed `outcome-unknown` disposition, evidence snapshot and
resource scope. Tell the person the known effects, uncertainty and which
future operations the closure will unblock. Reject changed evidence or scope
unless the authorisation covers that exact current item.

A caller boolean, TypeScript brand, actor name, diagnostic entry or writable
file is not proof of human approval. Validation of a request's shape is not
authorisation. Preserve the grant on lock refusal, revalidate it under the
lock and atomically consume it before recording closure (CMD-15). If authority is unavailable, keep the case unresolved and hand off. If
automated stopped-owner proof is unavailable, keep protection and invoke the
handoff in REC-7a; no manual override policy is selected by this draft.

The foundation supplies the hardened verifier and a negative-test fixture; a
host owns its trusted authority source and qualification of that integration. A source qualifies only when the
calling process cannot create or alter a valid grant using its own credentials
and permissions. Test attempted forgery under those actual credentials; a
same-user writable `grantedBy: "human"` file or a test fixture alone does not
qualify. A host without this separation cannot enable human closure.
REC-5 adds a specific human-closure qualification. Ordinary approval grants
still follow CMD-15 and their host authority contract; a hardened same-user
file is not thereby proof of a human decision. This draft does not upgrade
those older grants to the human-closure guarantee by implication.
Selecting a real credential provider is separate deployment work, not a new
dependency chosen by this text. No integration may advertise unknown closure
as enabled until its authority verification passes V-42.

## Reporting and next actions

**REC-6 `[D 11]` `[A 1]` `[A 2]` `[P]`** DISC-14 reports unresolved cases.
A separately declared read-only case/history route exposes retained intent,
closure disposition, observed evidence and scope without secrets. Discovery
and fixed guidance link to that route; validated operation IDs can fill its
arguments under STEP-10. A case that needs human closure provides a handoff.
Diagnostic hints distinguish observations from hypotheses and name a read-only
next step before any separately authorised repair.

A caller that lost its run ID may be unable to identify its own operation.
An empty unresolved report does not resolve that ambiguity. Never infer safe
repetition from it. The report does not itself authorise future work: admission
checks live locks and conflict scopes even after history was inspected.

## Exclusive coordination and reclaim

**REC-7 `[LO]` `[A 13]` `[P]`** Automatic reclaim requires both stopped-owner
proof and exclusive takeover. Lock age, PID absence in a restricted process
view, shared host names and a sent kill signal are insufficient. Process
identity must distinguish reuse, host/boot identity and the supported process
namespace. Proof includes delegated writers able to continue the operation;
a dead parent with a live child is not a stopped operation.

The implementation qualifies a local locking primitive and ownership protocol
that prevents two reclaimers, the old owner and a new contender from acquiring
the same scope concurrently. The ownership check and takeover cannot race with
a replacement owner. A stale snapshot never authorises unlinking the current
lock. Freeze lock records, acquisition/release order, incarnation checks,
atomic takeover and crash transitions before changing storage. Unsupported or
ambiguous filesystem/process environments hand off without taking ownership.

Reclaim grants coordination only. It does not close an unresolved operation,
consume an approval, report completion or permit replay. After reclaim, inspect
the journal and resources under REC-3. A new affected domain operation remains
blocked until a valid closure and its own authority checks. Unrelated work
uses REC-2. A person is not advised to bypass this protocol by deleting files.

### Manual stop attestation is an open choice

**REC-7a `[A 13]` `[P]`** Automatic reclaim still requires both proofs in
REC-7. Nathan has not yet chosen the manual path when runtime stopped-owner
proof is unavailable. Two viable policies remain; neither is selected:

1. An authorised person may attest that the specific owner and its delegated
   writers have stopped, with reason and evidence, through the REC-5 authority
   boundary. The state add-on may use that attestation for the stopped-owner
   condition only. Exclusive takeover is still mechanically guaranteed; no
   blind unlink, live-owner override or replay is authorised. An incorrect
   human attestation risks concurrent writers, which must be disclosed.
2. Keep the affected scope blocked until runtime stopped-owner proof becomes
   available. The person can diagnose or stop writers and repair observability,
   but cannot replace the proof with an attestation. This can leave an affected
   scope unavailable indefinitely; proven-independent work still continues.

This is a choice about the source of stop evidence, not whether uncertain
effects may be closed under A1. The handoff names inspection and repair steps;
it must not pretend either unresolved policy has already been selected.
Resolve REC-7a before exact-text acceptance. No implementation may enable a
manual override merely because this draft describes option 1.

**REC-7b `[A 13]` `[P]`** State add-on engineering owns a reviewed environment
qualification table before reclaim is enabled. The proposed support boundary
is local filesystems with trustworthy process/boot identity in the same host
and namespace and a qualified exclusive locking primitive. Network/shared
filesystems, hidden process views, cross-container identity and ambiguous
ownership are unsupported for automatic reclaim. No named OS/filesystem pair
is yet qualified. Record exact OS, filesystem, primitive and process-identity
mechanism, its failure cases and evidence in that table; independent process
review must pass V-22 and V-42 for each supported row. Until then automatic
reclaim remains unavailable with a handoff. This is missing engineering proof,
not permission to substitute age or parent PID absence.

## Engineering qualification

**REC-8 `[P]`** State add-on engineering owns storage and coordination; the
approval add-on owns authority verification; the host owns scope declarations
and independent domain observations; the checker verifies public routes and
wire behaviour. An independent process reviewer judges race, crash, privacy
and effect evidence from separately authored expectations. Before enabling
recovery, freeze a transition table and test each transition and crash boundary.
If the mechanism cannot satisfy a rule, leave the capability unavailable with
a handoff; report the missing proof rather than changing policy.

## Required adversarial scenarios

**REC-9 `[A 1]` `[A 2]` `[A 13]` `[P]`** V-42 covers each row with independent
resource observations, stdout, stderr, exit and before/after state:

| Scenario                                                                    | Required result                                                                                                                                         |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kill after effect before record, then recover and perform two later changes | Confirm or authorise closure, preserve intended effect exactly once, remove only that case from unfinished, and allow both later authorised operations. |
| Live run paused after intent                                                | Report it, block overlapping work, reject closure/reclaim, permit proven-independent work.                                                              |
| Sent message later deleted                                                  | Do not infer not-applied; no resend.                                                                                                                    |
| Unobservable or irreversible effect                                         | Authorised unknown closure ends the case without falsifying history or replaying it.                                                                    |
| Caller supplies its own closure authority                                   | Reject the forged grant and perform no closure.                                                                                                         |
| Recovery records closure                                                    | Classify its own state change honestly; never expose it as inspect or ifNoResult.                                                                       |
| Two concurrent reclaimers, PID reuse or ambiguous process namespace         | At most one exclusive owner; uncertainty gives handoff and no write.                                                                                    |
| Later legitimate resource change after closure                              | Historical case stays closed; no automatic replay or false renewed barrier.                                                                             |
| Torn intent or closure, crash before/after grant consumption                | Uncertain evidence stays uncertain; no refund, duplicate effect or false durable closure.                                                               |
| Remove diagnostic files; rename an alias to the same resource               | Same recovery truth; same conflict scope.                                                                                                               |
| Incomplete or unknown scope                                                 | Refuse any operation whose independence cannot be established; missing scope is never treated as disjoint.                                              |
| Crash during takeover                                                       | Preserve exclusivity across old, replacement and concurrent owners; retain evidence and allow only safe refusal or qualified recovery.                  |
| Dead parent and surviving writer                                            | Reclaim and closure remain blocked until stopped-writer proof.                                                                                          |
