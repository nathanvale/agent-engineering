# Contract 3.0 independent expectations

[expectations.json](expectations.json) is the test-owned requirement oracle for
foundation T0, criterion C3-FND-1. It records independently authored expected
observations, failing controls and proof owners. It contains no observed
Contract 3.0 behaviour: every observation is `not_run`.

The accepted authority is commit
`5693651d19c6fba2430c904688e583266dbe58a0`, manifest SHA-256
`c162c9850ca506fd839ce36b2b1a8172f064516b0f229dd34a5678b366b02b9d`.
The later [acceptance record](../../skills/agent-cli-design/references/contract-3/acceptance-2026-11-15.md)
supersedes historical candidate labels without rewriting the frozen bytes.
The accepted foundation scope is retained by the vault's
`projects/cli-design-skill/specs/contract-3-foundation.md`.

## Independence and use

The expectation author read the accepted contract and foundation brief before
production implementation. Values are hand-authored from those sources and
command requirements. Never replace them with production-generated catalogues,
validator results, schema projections or checker output. A shared wrong parser
and schema, or a shared wrong catalogue and implementation, must still fail the
independent cases. Preserve intentionally restated constants as oracle data.

There are exactly 49 verification identities, 20 common causes and 34 compiler
locks. The truth table expands grouped classes into 20 concrete legal rows.
The lock set includes the 17 inherited locks, 14 further/carrying identifiers
in GATE-7 and three exemplar domain locks. P1 through P3 introduce no common
cause. `N` means exactly `next`; `H` means exactly `handoff`. A station chooses
one arm where the truth table allows either. Null metadata in expected
compiler diagnostics means unbound, never accepted or passed.

Each verification row names sources, final proof owner, proof layer, expected
behaviour and a negative perturbation. Supporting matrices cover versions,
lifecycle, programs, recovery, diagnostics, input, runtime correlations and
navigation. Clause prefixes resolve through the frozen contract index. V-36
also follows the frozen requirement map. The matrices are requirements to
instantiate, not executable specimen commands or a competing implementation
plan. The fixture creates no production command, package, dependency or checker
report vocabulary.

Before claiming a row covered, bind its exact candidate, independently authored
specimen, command, input, startup/phase barrier, expected result and evidence
owner. Retain real stdout, stderr, exit and before/after resource state. Demonstrate
the negative control fails and the valid twin passes in the same harness. Assert
expected identities before iterating results; empty collections must fail.
Never substitute compiler/helper success for a required process or host proof.

Store execution receipts under the coordinator's existing runtime evidence owner,
not in this requirement fixture. Keep skipped, missing, timed-out, failed and
reviewed-impossible rows distinct. Pin covered and skipped counts. Optional
capabilities disabled by accepted scope are excluded explicitly, not passed.

## Binding boundary

T0 requires the independent semantic oracle, accepted source identity,
scaffold/kept-consumer admission, actual planning and execution binding,
evidence retention route, applicability review and independent review.
This fixture supplies the semantic oracle; it does not assert that the other
admission work has happened.

Exact numeric compiler diagnostics and locations require admitted lock programs
and real interfaces. GATE-8 requires those values for the corresponding
implementation proof. Their absence while the interfaces do not exist is not
itself a T0 blocker. T1 freezes those expectations independently before using
lock results as evidence. Do not invent diagnostic numbers or message text.
T6 must independently freeze its checker report row/finding-code interface and
sensitivity expectations before implementing that checker, as required by
ROLL-8. VER-14 leaves that report interface checker-owned. Neither gap permits
production code to generate its own expected answers.

Command-specific causes, station applicability and reviewed unreachable reasons
still belong to admitted command briefs. Held-lock and unresolved-case causes
are distinct host-owned causes. Preserve the exact V-37 run-count wording until
its owner resolves how it applies; this fixture does not silently choose an agent
count. EPIPE phases require deterministic evidence; an indistinguishable timing
case stays unproved and returns to its owner.

Human closure requires qualified authority independent of caller credentials.
Reclaim and human-assisted takeover require the named environment's mechanical
exclusivity qualification. A test fixture cannot enable either production
capability. Raw-stream retention, arbitrary template-code installation,
post-vault relocation and existing-CLI migration remain disabled or excluded
under their accepted owners.

## Static validation only

From the repository root, this dependency-free command checks fixture structure
and clause references. It executes zero Contract 3.0 behavioural tests. The
existing Contract 2.0 baseline remains unchanged.

```sh
python3 - <<'PY'
import json
import re
from pathlib import Path

fixture = json.loads(Path('tests/contract3/expectations.json').read_text())
contract = Path('skills/agent-cli-design/references/contract-3')
clauses = set()
for path in contract.glob('*.md'):
    clauses.update(re.findall(r'\*\*((?:WIRE|STEP|DISC|VER|LIFE|DIAG|CMD|INPUT|REC|GATE|ROLL)-\d+[a-z]?)\b', path.read_text()))
    clauses.update(re.findall(r'^\| (V-\d+)\s*\|', path.read_text(), re.M))
assert {row['id'] for row in fixture['verification']} == {
    f'V-{number}' for number in range(1, 50)
}
for items, key, expected in (
    (fixture['verification'], 'id', 49),
    (fixture['common_causes']['rows'], 'causeCode', 20),
    (fixture['compiler_locks'], 'id', 34),
):
    assert len(items) == len({row[key] for row in items}) == expected

def check(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if key == 'sources':
                assert child and all(item in clauses for item in child), child
            if key == 'observed_status':
                assert child == 'not_run', child
            check(child)
    elif isinstance(value, list):
        for child in value:
            check(child)

check(fixture)
print('Static oracle structure valid; behavioural observations remain not_run.')
PY
```

A structure check cannot establish source acceptance, runtime sensitivity,
authority, durability, concurrency, installation or activation. Those remain
separate required observations under the row's owner.
