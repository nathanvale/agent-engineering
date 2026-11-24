---
status: proposed
---

# Local state and domain storage boundaries

## Context and problem

Multiple agent harnesses (Antigravity, Codex, Claude Code), installed command-line tools, and concurrent coordinators share a single development machine across distinct trust boundaries: personal work, the open-source `my-agent-dojo` ecosystem, and separate private client or employer domains.

Without an explicit storage boundary contract, four distinct data lifecycles collide under generic local state: vendor harness transcripts, installed tool operational files, cross-harness coordinator files, and disposable raw run or wiki logs. Private terms, personal mappings, and raw logs risk leaking into open-source repositories or Git history.

This repository (`agent-engineering`) owns the public cross-repository engineering ADRs and shared storage vocabulary for `my-agent-dojo` because no private wiki exists for the open-source ecosystem.

Decision question: how should local machine storage, durable repository knowledge, and cross-domain work be separated so trust boundaries hold on a shared host and migrate cleanly to per-domain Linux VMs?

## Decision drivers

1. **Trust-boundary isolation.** Keep open-source `my-agent-dojo` repositories free of personal identifying data, private repository names, local home paths, and client or employer data. Keep private skills and private wikis inside their owning private domains.
2. **Single source of truth.** Keep durable knowledge in code repositories, private domain homes, or the project tracker. Never trap durable decisions only in ephemeral local state or duplicate definitions across owners.
3. **Namespace safety.** Prevent domain directories from colliding with installed command-line tools inside `$XDG_STATE_HOME`.
4. **Cross-harness portability.** Keep operational coordination storage independent of vendor harness internals so Antigravity, Codex, Claude Code, and future per-domain Linux VMs use the same layout.
5. **Incremental migration path.** Allow active coordinators to finish in place and move cleanly onto per-domain Linux VMs without reworking third-party tools.

## Considered options

- **Option A.** Four storage layers with one XDG suite namespace (`$XDG_STATE_HOME/my-agent-dojo/domains/<domain>/`) for agent-authored operational state and top-level `$XDG_STATE_HOME/<tool>/` reserved for installed tools.
- **Option B.** Domain-first nesting for all tools (`$XDG_STATE_HOME/<domain>/tools/<tool>/`) using per-domain environment overrides on the shared host.
- **Option C.** One cross-domain `agent-home` repository holding all glossaries, ADRs, and coordination files.

## Decision

**Decision authority:** Nathan (project maintainer).

We recommend **Option A** because it satisfies trust-boundary isolation, namespace safety, cross-harness portability, single source of truth, and an incremental migration path without fighting third-party XDG conventions.

1. **Four storage layers.**
   - **Domain home and public ecosystem repositories.** Each private domain stores durable wikis, instructions, optional domain CLI code, links to public and private skill repositories, and private terms in its private domain home, with zero raw run logs or live scratch. A domain's private domain home supersedes legacy personal note stores (such as a previously configured external vault). Existing placement guidance that points to a configured external vault resolves to the personal domain's domain home during transition until adapter documents update. The open-source `my-agent-dojo` domain has no private domain home; its durable documentation, shared storage glossary (`GLOSSARY.md`), and cross-repository ADRs live in its public repositories (`agent-engineering`, `bun-typescript-template`, `agent-doorway`, `agent-cli-kernel`, `agent-gates`, `skills`) and the project tracker. Private skill repositories stay inside their private domain and never enter `my-agent-dojo`.
   - **Harness state.** Vendor-owned directories (such as `~/.gemini/antigravity/brain/`, `~/.codex/`, and `~/.claude/`) stay owned by each harness. Harnesses do not share or mutate each other's vendor state. Dedicated read-only inspection tools may read local transcripts without modifying vendor files or copying private data across domains.
   - **Tool runtime state.** Top-level `$XDG_STATE_HOME/<tool>/` holds operational state owned by installed CLIs and daemons, including Command Contract 3 journals and diagnostics. First-party multi-domain tools isolate domains in subdirectories (`$XDG_STATE_HOME/<tool>/<domain>/`) on shared hosts until per-domain Linux VMs isolate tools at the operating-system boundary. Third-party tools keep their standard `$XDG_STATE_HOME/<tool>/` paths on shared hosts because overriding them breaks vendor defaults.
   - **Domain operational state.** All agent-authored local state lives under one lowercase, non-dotted XDG suite root at `$XDG_STATE_HOME/my-agent-dojo/domains/<domain>/`, never committed to Git, with private permissions (`0700` for directories, `0600` for user-scoped files). Each domain directory has two fixed operational buckets (plus an archive bucket defined in ADR 0002):
     - `coordinators/<coordinator-slug>/` for cross-harness coordinator instructions, decision logs, active prompts, handoffs, and durable `lease.json` records (lifecycle and locking rules live in ADR 0002).
     - `runs/<date-slug>/` for raw run logs, wiki ingest logs, screenshots, and unpromoted evidence (retention rules live in ADR 0002).
2. **Namespace reservation and slug grammar.** Top-level `$XDG_STATE_HOME/my-agent-dojo/` is reserved exclusively for this suite namespace. Domain slugs live strictly under `my-agent-dojo/domains/<domain>/`, never at `$XDG_STATE_HOME/<domain>/`, making tool and domain roots disjoint by construction. Every `<domain>` and `<coordinator-slug>` must match `^[a-z0-9][a-z0-9-]*$`. Relative XDG environment paths are refused.
3. **Mixed-domain hosting rule.** When one coordinator or run spans a private domain and the open-source `my-agent-dojo` domain, host its coordinator folder and raw runs under that private domain (`domains/<private-domain>/`). A coordinator touching only open-source `my-agent-dojo` work lives under `domains/my-agent-dojo/`. Never write private domain evidence into `domains/my-agent-dojo/`. A single coordinator must not span two distinct private domains; split such work into separate coordinators, one per private domain.
4. **Glossary ownership.** `agent-engineering/GLOSSARY.md` is the single public canonical owner of shared open-source storage vocabulary. Private tracker glossaries and machine adapter files link to it rather than copying diverging definitions.
5. **Forward-only cutover.** Active coordinators finish in place under legacy flat `$XDG_STATE_HOME` paths. New coordinators use `$XDG_STATE_HOME/my-agent-dojo/domains/<domain>/`. Legacy directory cleanup runs later as a separate, explicitly approved pass.

## Consequences

- **Positive.** Public `my-agent-dojo` repositories stay clean of personal and client data. Top-level `$XDG_STATE_HOME` stays collision-free under one reserved suite folder (`my-agent-dojo/`). Raw logs stay out of Git history. The same path contract works unchanged inside future per-domain Linux VMs.
- **Negative.** First-party multi-domain tools still require internal `<domain>` subdirectory discipline on shared hosts until VM isolation lands. Legacy flat state folders remain on disk until a separate cleanup pass runs.
- **Neutral.** Personal machine setup repositories act only as thin adapters pointing to this public contract rather than owning storage vocabulary or architecture decisions.

## Options and tradeoffs

### Driver comparison matrix

| Driver | Option A (four layers + suite root) | Option B (domain-first tool nesting) | Option C (single `agent-home` repo) |
| --- | --- | --- | --- |
| Trust-boundary isolation | Strong. Separates public repos, private domain homes, and per-domain local state. | Strong on disk, but fragile where third-party tools ignore custom XDG overrides. | Fails. Mixes personal, client, and open-source terms in one repository. |
| Single source of truth | Strong. Public glossary in `agent-engineering/GLOSSARY.md`; private knowledge in domain homes and tracker. | Partial. Solves local paths only; leaves glossary and durable doc ownership undefined. | Weak. Forces duplicate mirrors or leaks private context into public docs. |
| Namespace safety | Strong. Single reserved `my-agent-dojo/` root keeps tool and domain slugs disjoint. | Moderate. Eliminates tool-vs-domain root overlap by nesting all tools under domains, at high wrapper cost. | Does not address `$XDG_STATE_HOME` collisions. |
| Cross-harness portability | Strong. Works across Antigravity, Codex, Claude Code, and Linux VMs with standard XDG defaults. | Weak. Requires harness-specific wrappers to rewrite `$XDG_STATE_HOME` per invocation for every CLI. | Weak. Git commits cannot safely coordinate concurrent multi-harness local state. |
| Incremental migration path | Strong. Forward-only cutover; identical tree moves directly into per-domain VMs. | Weak. Duplicates VM isolation with brittle shell overrides that must be undone later. | Weak. Splitting leaked Git history out of one shared repo is costly. |

### Option A

- **Good.** Matches XDG Base Directory Specification v0.8 defaults for third-party tools, guarantees disjoint tool and domain paths under `my-agent-dojo/domains/<domain>/`, keeps `my-agent-dojo` open-source-safe, and migrates directly into per-domain Linux VMs.
- **Bad.** Third-party tools remain user-wide on a shared host until per-domain VMs isolate them; first-party multi-domain tools must enforce `<domain>` subdirectories on shared hosts.

### Option B

- **Good.** Groups every tool's state under one domain folder on a shared machine.
- **Bad.** Requires wrapping third-party tools (`gh`, `pnpm`, and vendor CLIs) with non-standard environment overrides, breaks when a tool ignores XDG overrides, and duplicates isolation that per-domain Linux VMs provide cleanly.

### Option C

- **Good.** Single repository to search across all domains.
- **Bad.** Violates trust-boundary isolation, risks leaking personal or client data into open-source history, and leaves local operational state unsolved.

## Confirmation

### Design acceptance gate (moves status from `proposed` to `accepted`)

- Independent cross-model design review passes with zero P0 and zero P1 findings across ADR 0001, ADR 0002, `GLOSSARY.md`, and the companion specification.
- Automated privacy scan confirms zero personal local paths, private repository names, private tracker keys, or client names in public `my-agent-dojo` files.
- Decision authority (Nathan) explicitly approves transitioning ADR 0001 to `accepted`.

### Implementation confirmation (verified when the follow-up CLI lands)

- **Namespace and permission check.** A read-only hygiene check verifies that `$XDG_STATE_HOME/my-agent-dojo/domains/` and its subdirectories use mode `0700`, user-scoped state files use mode `0600`, all slugs match `^[a-z0-9][a-z0-9-]*$`, relative XDG paths are refused, and no new un-namespaced coordinator or dated proof directories appear at the root of `$XDG_STATE_HOME`.
- **Harness-state isolation review.** No first-party script or CLI writes inside another harness's vendor state directory.
- **First-party tool scoping check.** Each first-party multi-domain tool test suite verifies domain records stay inside `$XDG_STATE_HOME/<tool>/<domain>/`.

### Revisit triggers

- **Per-domain Linux VM rollout.** When per-domain Linux VMs isolate each domain at the operating-system boundary, revisit whether first-party multi-domain tools still need internal `<domain>` subdirectories inside `$XDG_STATE_HOME/<tool>/`.
- **Shared wiki tooling (`agent-wiki-tools`).** When shared wiki tooling is created in `my-agent-dojo` for reuse across domain homes, verify its raw ingest logs route exclusively to `$XDG_STATE_HOME/my-agent-dojo/domains/<domain>/runs/`.
- **Composable domain connectors.** When composable service connectors (`agent-connectors` or per-service domain adapters) are introduced, revisit whether their runtime state stays under `$XDG_STATE_HOME/<tool>/<domain>/` or moves inside per-domain VM boundaries.

## References

- [ADR 0002: Coordinator leases and retention](0002-coordinator-leases-and-retention.md)
- [Public storage glossary](../../GLOSSARY.md)
- XDG Base Directory Specification v0.8 (`https://specifications.freedesktop.org/basedir/latest/`)
