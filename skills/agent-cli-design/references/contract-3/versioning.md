# Versioning

Candidate text for Command Contract 3.0. Not accepted, not binding. Read
[index.md](index.md) first for clause tags and status.

Nathan decided two things. Decision 1: a new public 3.0.0 wire, with no
requirement to support the existing contract. Decision 8: "Accept older 3.x".
Every other rule in this file is proposed wording for him to accept or change
([decisions.md](decisions.md), Q5).

## The version value

**VER-1 `[D 1]` `[Q 5]`** A 3.x version is exactly `3.<minor>.0`. Decision 1
gives `3.0.0`. The form for later minors is proposed. A reader classifies a
version value in two steps:

1. Well formed means it matches
   `^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$`. Anything else is
   malformed: a missing value, a non-string, two parts, a pre-release or
   build suffix, a leading zero, or surrounding whitespace.
2. The first number is the major. A well-formed version whose major is not
   `3` is another major, whatever its other numbers. A 3.x reader does not
   know another major's rules. With major `3`, a patch other than `0` is
   malformed.

**VER-2 `[Q 5]`** The patch is always `0` on the wire. A fix that changes no
wire shape and no meaning changes no version.

**VER-2a `[Q 5]`** `contractVersion` on the envelope is the one version field.
Any copy, such as `DiscoveryData.contractVersion`, equals it. An envelope
whose copies disagree is invalid.

## What a reader accepts

**VER-3 `[D 8]` `[D 1]` `[Q 5]`** A reader built for `3.M.0` accepts `3.m.0`
for every `m` from `0` to `M` `[D 8]`. It refuses every other major, `2.0.0`
included, and never adapts what it refuses `[D 1]` `[C0]`. It refuses a newer
minor `[Q 5]`: that rule is the planner's wording of decision 8, not
Nathan's.

**VER-4 `[Q 5]`** An accepted envelope is judged against the shape of the
minor it declares. A key or union member that minor does not list is an
error, even when the reader's own minor lists it.

**VER-4a `[Q 5]`** A reader keeps the shape of every older minor for as long
as 3.x lives.

## What a minor may change

**VER-5 `[Q 5]`** A minor may add:

- an optional or conditional key;
- a member of a union the contract owns, such as a new step kind.

This is safe because no reader accepts a minor newer than its own. It also
means the step kinds are not frozen at 3.0.0.

**VER-6 `[Q 5]`** A minor never removes a key, renames one, makes one
required, or changes a meaning. A key added in `3.N`, when absent, means what
`3.(N-1)` meant. A later minor never reinterprets an older envelope: a rule
such as "read-only unless stated", added later, would let a reader run an
older CLI's changing step as if it were safe.

**VER-6a `[Q 5]`** A minor never adds a common cause. A CLI may already own
a cause of that name with its own meaning ([WIRE-19](wire.md#common-causes)),
so adding it would change a meaning. The common causes change only with a
major.

## Closed and open vocabularies

**VER-7 `[Q 5]`** Unions the contract owns are closed at each minor: outcome,
effect class, transaction state, failure class, exit code, step kind, handoff
owner, the diagnostics variants and their enumerations, reachability and
retry delay policy kind. A reader handles them exhaustively
([GATE-11](static-gates.md#exhaustive-handling)).

Cause codes are open to a reader. A reader that meets a cause it does not
know handles it by `outcome` and `failureClass`. It never fails only because
the cause is new, and it never switches exhaustively on another CLI's causes.

## What a producer stamps

**VER-8 `[Q 5]`** A CLI stamps the minor of the base it carries on every
envelope except the fallback. Readers upgrade first: a reader moves to a new
minor before any producer it reads does. The alternative, stamping the lowest
minor an envelope fits, is smoother for readers and more complex for
producers. It is not the candidate's default.

## The fallback version

**VER-9 `[Q 5]`** The fallback envelope always declares `3.0.0` and uses only
keys and union members defined at 3.0.0
([LIFE-10](lifecycle.md#fallback)). It is the one result that tells a caller
to inspect effects, so every 3.x reader must be able to read it.

## Format cases

**VER-10 `[D 1]` `[D 8]` `[Q 5]`** A reader at `3.M.0` classifies what it is
given in this order. Version classification comes before any other key is
interpreted.

| Observed | Class | Reader's own result | What `message` reports |
| --- | --- | --- | --- |
| Missing or malformed version (VER-1), including `3.0.1` | Malformed | Refused, unchanged, schema, exit 4, `SCHEMA_INVALID_INPUT` | Report the safe observed value, or `null` when absent. Name `contractVersion` as the violated key. |
| Well-formed, another major (`2.0.0`, `1.0.0`, `4.1.2`) | Other major | Refused, unchanged, schema, exit 4, `SCHEMA_UNSUPPORTED_CONTRACT` | Report the exact observed string. Use a reader built for that major. No adapter. |
| `3.n.0` with `n` greater than `M` | Newer minor | Refused, unchanged, schema, exit 4, `SCHEMA_UNSUPPORTED_CONTRACT` | Report the exact observed string and the reader's own version. Upgrade the reader. |
| `3.m.0` with `m` at most `M`, broken | Broken | Refused, unchanged, schema, exit 4, `SCHEMA_INVALID_INPUT` | Report the observed version. Identify the violated key or correlation. |
| `3.m.0` with `m` at most `M`, valid | Accepted | Success, unchanged, exit 0 | Report the observed version and that it was accepted without adaptation |

Rows that share a cause share one station and one fixed guidance
([DISC-12](discovery.md#identity-and-reachability)). What differs between
them is carried in `message`.

Three things differ from the five 2.0 format cases. The first follows
decision 8. The other two are proposed:

- An older minor of the reader's major is accepted. In 2.0 only the exact
  string `2.0.0` was.
- A malformed version is `SCHEMA_INVALID_INPUT`, so a reader reports it apart
  from a newer one by cause. In 2.0 both were `SCHEMA_UNSUPPORTED_CONTRACT`.
  A two-part `1.0` is malformed under VER-1.
- `3.0.1` is malformed. In 2.0 any dotted numeric triple ordered above the
  supported version was newer, and so `SCHEMA_UNSUPPORTED_CONTRACT`. A
  triple of another major, such as `4.1.2`, is still unsupported.

One rule is unchanged: a broken envelope of an accepted version is never
reported as an unsupported version.

**VER-11 `[C0]` `[Q 5]`**

- Validation is read-only. Malformed target output creates no authority over
  the target.
- An observed version value is bounded and redacted by the input policy
  before it appears in any human guidance.
- The reader's result carries the observed version in `message`. Its
  `repairAction` is the station's fixed words and may refer the caller to
  `message` `[P]`. Failure `data` stays `null`. The 2.0 text said "message
  or repair guidance". A station's repair words are a template with no token
  for a version, so the value lives in `message`.
- A broken target that has already executed is never retried by the reader
  ([LIFE-13](lifecycle.md#no-result-received)).

**VER-12 `[D 1]` `[C0]`** No adapter, no dual-major support, no deprecation
window and no legacy command path exist. "No dual-version support" still
holds across majors. Decision 8 changes it only for minors of one major.

## The checker

**VER-13 `[D 9]` `[P]`** The 3.0 checker's refusal of a `2.0.0` CLI names the
kept 2.0 checker in `message` ([ROLL-4](adoption.md#the-kept-20-checker)).

**VER-14 `[P]`** The checker's own result is an ordinary envelope at the
checker's minor, with an inspect transaction. Its `data`, the row report, is
the checker's own interface: described by its help and changed only with a
checker release. It is outside this contract.

**VER-15 `[P]`** No minor above `3.0` exists yet. The first proof of VER-3 to
VER-6 uses a test-only minor: a field table that exists only in a reader's
test fixtures. No released producer stamps it and no wire label marks it.
