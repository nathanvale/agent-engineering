---
status: accepted
---

# Local state and domain storage boundaries

## Context and problem

Multiple agent harnesses (Antigravity, Codex, Claude Code), installed command-line tools, and concurrent coordinators share a single development machine across distinct trust boundaries: personal work, the open-source `my-agent-dojo` ecosystem, and separate private client or employer domains.

Without an explicit storage boundary contract, four distinct data lifecycles collide under generic local state: vendor harness transcripts, installed command operational files, cross-harness coordinator files, and disposable raw run or wiki logs. Private terms, personal mappings, and raw logs risk leaking into open-source repositories or Git history.

This public repository (`agent-engineering`) owns the cross-repository engineering ADRs and shared storage vocabulary for the open-source `my-agent-dojo` ecosystem, so every contributor reads the same decisions. Private domains keep their own records in their private domain homes.

Decision question: how should local machine storage, durable repository knowledge, and cross-domain work be separated so trust boundaries hold on a shared host and migrate cleanly to per-domain Linux VMs?

## Decision drivers

1. **Trust-boundary isolation.** Keep open-source `my-agent-dojo` repositories free of personal identifying data, private repository names, local home paths, and client or employer data. Keep private skills and private wikis inside their owning private domains.
2. **Single source of truth.** Keep durable knowledge in code repositories, private domain homes, or the project tracker. Never trap durable decisions only in ephemeral local state or duplicate definitions across owners.
3. **Namespace safety.** Prevent first-party command folders and agent coordination storage from colliding with each other or with third-party tools inside each XDG base directory.
4. **Cross-harness portability.** Keep operational coordination storage independent of vendor harness internals so Antigravity, Codex, Claude Code, and future per-domain Linux VMs use the same layout.
5. **Incremental migration path.** Allow active coordinators to finish in place and move cleanly onto per-domain Linux VMs without reworking third-party tools.

## Considered options

- **Option A.** Four storage layers with one XDG suite namespace (`<base>/my-agent-dojo/`) in each XDG base directory: every child named after its command (`<base>/my-agent-dojo/<command>/`), agent coordination split into fixed `personal/` and `open-source/` folders under `<base>/my-agent-dojo/agent-coordination/`, employer work kept outside `my-agent-dojo`, and third-party tools at their vendor default paths.
- **Option B.** Domain-first nesting for all tools using per-domain environment overrides on the shared host, placing each tool inside a separate per-domain state folder.
- **Option C.** One cross-domain `agent-home` repository holding all glossaries, ADRs, and coordination files.

## Decision

**Decision authority:** Nathan (project maintainer).

We recommend **Option A** because it satisfies trust-boundary isolation, namespace safety, cross-harness portability, single source of truth, and an incremental migration path without fighting third-party XDG conventions.

Target layout across the five XDG base directories:

```text
$XDG_CONFIG_HOME/my-agent-dojo/
├── <command>/                       one folder per command, for example doorway/settings.json
└── agent-coordination/              settings agents and coordinators read: test environments map,
                                     private-name scan pattern, the coordination rulebook
$XDG_DATA_HOME/my-agent-dojo/
├── <command>/                       for example skillshare/{claude,codex}/skills
├── <package-suite>/                 a public package mounted by its suite-root setting
└── agent-coordination/{personal,open-source}/archives/coordinators/
$XDG_STATE_HOME/my-agent-dojo/
├── <command>/                       for example verify-cli/diagnostics, journals at <command>/operations/
└── agent-coordination/
    ├── personal/{coordinators/<slug>/,runs/<date-slug>/}
    └── open-source/{coordinators/<slug>/,runs/<date-slug>/}
$XDG_CACHE_HOME/my-agent-dojo/
└── <command>/                       for example bun-typescript-template/agent-cli-kernel.git
<runtime>/my-agent-dojo/agent-coordination/coordinator-lease.lock
```

1. **Four storage layers.**
   - **Domain home and public ecosystem repositories.** Each private domain stores durable wikis, instructions, optional domain CLI code, links to public and private skill repositories, and private terms in its private domain home, with zero raw run logs or live scratch. A domain's private domain home supersedes legacy personal note stores (such as a previously configured external vault). Existing placement guidance that points to a configured external vault resolves to the personal domain's domain home during transition until adapter documents update. The open-source `my-agent-dojo` domain has no private domain home; its durable documentation, shared storage glossary (`GLOSSARY.md`), and cross-repository ADRs live in its public repositories (`agent-engineering`, `bun-typescript-template`, `agent-doorway`, `agent-cli-kernel`, `agent-gates`, `skills`) and the project tracker. Private skill repositories stay inside their private domain and never enter `my-agent-dojo`.
   - **Harness state.** Vendor-owned directories (each harness's own state and configuration directories for Antigravity, Codex, and Claude Code) stay owned by each harness. Harnesses do not share or mutate each other's vendor state. Dedicated read-only inspection tools may read local transcripts without modifying vendor files or copying private data across domains.
   - **Tool runtime state.** First-party tools (the operator's own CLIs and daemons, not published as reusable packages) keep operational state under `$XDG_STATE_HOME/my-agent-dojo/<command>/`, including Command Contract 3 journals (`<command>/operations/`) and diagnostics. A first-party tool that also keeps configuration, durable data, or cache uses the same `<base>/my-agent-dojo/<command>/` form in `$XDG_CONFIG_HOME`, `$XDG_DATA_HOME`, or `$XDG_CACHE_HOME`. Where a first-party tool serves both personal and open-source work, it isolates them in `<command>/personal/` and `<command>/open-source/` subdirectories on shared hosts until per-domain Linux VMs isolate tools at the operating-system boundary. Third-party tools keep their vendor default paths on shared hosts because overriding them breaks vendor defaults. Public reusable packages follow decision point 3 instead. Folders that predate these rules stay where they are until the migration (decision point 7).
   - **Domain operational state.** All agent-authored local coordination storage lives inside the lowercase, non-dotted suite root `<base>/my-agent-dojo/`, under `<base>/my-agent-dojo/agent-coordination/`, never committed to Git, with private permissions (`0700` for directories, `0600` for user-scoped files). Settings that agents and coordinators read (such as the test environments map, private-name scan pattern, and coordination rulebook) live in `$XDG_CONFIG_HOME/my-agent-dojo/agent-coordination/`. Live state splits into `personal/` and `open-source/` under `$XDG_STATE_HOME/my-agent-dojo/agent-coordination/`. Each side has two fixed operational buckets in the state home and one archive bucket in the data home:
     - `coordinators/<coordinator-slug>/` for cross-harness coordinator instructions, decision logs, active prompts, handoffs, and durable `lease.json` records (lifecycle and locking rules live in ADR 0002).
     - `runs/<date-slug>/` for raw run logs, wiki ingest logs, screenshots, and unpromoted evidence (retention rules live in ADR 0002).
     - `$XDG_DATA_HOME/my-agent-dojo/agent-coordination/{personal,open-source}/archives/coordinators/` for archived coordinator records, which are durable records worth backing up (archive rules live in ADR 0002).
2. **Namespace reservation, command-name rule, slug grammar, and folder rules.** In each XDG base directory, `<base>/my-agent-dojo/` is the single reserved suite namespace, and no first-party command or agent coordination folder sits outside `my-agent-dojo/` at the root of an XDG base directory. Every child of `<base>/my-agent-dojo/` is named after the command that writes or reads it, never after a repository. `agent-coordination` is the folder of the `agent-coordination` command and of the agents and coordinators that use it. No other command may take that name. A public package mounted by its suite-root setting keeps its package suite name (decision point 3). Folders that predate this rule stay as they are until the migration (decision point 7). `<runtime>/my-agent-dojo/agent-coordination/` holds only the ADR 0002 lock file (`coordinator-lease.lock`). Command folders and mounted package-suite folders share one slug namespace under `<base>/my-agent-dojo/`: each name matches the slug grammar below and is unique, and only the `agent-coordination` command uses the name `agent-coordination`. Every `<command>`, `<package-suite>`, and `<coordinator-slug>` must match `^[a-z0-9][a-z0-9-]*$`. Tools create each missing folder with mode `0700` and leave the mode of an existing folder unchanged. An unset, empty, or relative XDG variable is invalid: tools ignore it and use the XDG Base Directory Specification v0.8 default for that variable. ADR 0002's runtime directory rule decides which runtime directory is usable.
3. **Public package suite root.** A public, reusable package never names `my-agent-dojo` in its code. It defaults to its own suite, `<base>/<package-suite>/<component>/` (for `nathanvale/skills`, `$XDG_DATA_HOME/nathanvale-skills/<component>/`). It first reads one absolute suite-root setting for each XDG base directory it uses (for example `NATHANVALE_SKILLS_DATA_HOME`, and `NATHANVALE_SKILLS_STATE_HOME` if it keeps state) and then places each component at `<suite-root>/<component>/`. An operator may mount the suite inside `my-agent-dojo` by pointing that setting, or a per-tool override, at or inside the suite's own child folder `<base>/my-agent-dojo/<package-suite>/` (for example `$XDG_DATA_HOME/my-agent-dojo/nathanvale-skills/`), never at `<base>/my-agent-dojo/` itself or at or under `agent-coordination/`. This is an operator rule: package code stays agnostic, and the hygiene check reports a violation. A per-tool override (for example `GOOGLE_CONTACTS_LEDGER_DIR`) wins over both. The package refuses a relative suite-root or per-tool value, because these settings are its own and a silent fallback would write records to a folder the operator did not choose.
4. **Data versus state.** Durable records worth backing up (for example a contact ledger or an archived coordinator record) go in `$XDG_DATA_HOME`, not `$XDG_STATE_HOME`. Logs, journals, diagnostics, leases, and raw run evidence stay in `$XDG_STATE_HOME`.
5. **Two sides of agent work and employer boundary.** Under `agent-coordination/`, `personal/` holds work on private repositories and notes, and `open-source/` holds work on public repositories. These two names are fixed, and no domain slug appears in any folder path. Work that touches both personal and open-source repositories is hosted under `personal/`. Never write personal evidence into `open-source/`. Employer work is outside `my-agent-dojo`: it keeps its own home, set by the employer's own tooling. A single coordinator must not span two distinct private domains; split such work into separate coordinators, one per private domain.
6. **Glossary ownership.** `agent-engineering/GLOSSARY.md` is the single public canonical owner of shared open-source storage vocabulary. Private tracker glossaries and machine adapter files link to it rather than copying diverging definitions.
7. **Nothing moves yet (forward-only cutover).** Existing folders stay where they are until a separate migration unit runs with the maintainer's explicit approval. Changing paths without that migration would break every running coordinator. Active coordinators finish in place under pre-cutover paths, and folders that predate the command-name rule or shipped outside `my-agent-dojo/` stay put until that migration pass. New first-party commands start under `<base>/my-agent-dojo/<command>/`.

## Consequences

- **Positive.** Public `my-agent-dojo` repositories stay clean of personal and client data. Each XDG base directory holds first-party command folders and `agent-coordination/` in one reserved suite folder (`my-agent-dojo/`), so they cannot collide with third-party tools at the top level. Naming folders after commands avoids repository-name confusion, and fixed `personal/` and `open-source/` folders make the trust split clear to both people and agents. Employer work stays cleanly outside `my-agent-dojo`. Public packages stay reusable on other machines because their code names only their own suite. Durable archives sit in the data home, where backups expect them. Raw logs stay out of Git history. The same path contract works unchanged inside future per-domain Linux VMs.
- **Negative.** First-party tools serving both personal and open-source work still require internal `personal/` and `open-source/` subdirectory discipline on shared hosts until VM isolation lands. Each public package carries one suite-root setting per XDG base directory it uses. The starter kit's folder check must accept a repository-declared suite name so a public package's own suite passes; that change is a follow-up in `bun-typescript-template`. Pre-cutover folders and shipped paths outside the namespace remain on disk until a separate, explicitly approved migration runs.
- **Neutral.** Personal machine setup repositories act only as thin adapters pointing to this public contract rather than owning storage vocabulary or architecture decisions.

## Options and tradeoffs

### Driver comparison matrix

| Driver | Option A (four layers + command-named suite root) | Option B (domain-first tool nesting) | Option C (single `agent-home` repo) |
| --- | --- | --- | --- |
| Trust-boundary isolation | Strong. Separates public repos, private domain homes, fixed `personal/` and `open-source/` agent work, and external employer homes. | Strong on disk, but fragile where third-party tools ignore custom XDG overrides. | Fails. Mixes personal, client, and open-source terms in one repository. |
| Single source of truth | Strong. Public glossary in `agent-engineering/GLOSSARY.md`; private knowledge in domain homes and tracker. | Partial. Solves local paths only; leaves glossary and durable doc ownership undefined. | Weak. Forces duplicate mirrors or leaks private context into public docs. |
| Namespace safety | Strong. One reserved `my-agent-dojo/` folder per XDG base directory holds command folders beside `agent-coordination/`, so command names, mounted suites, and agent work stay disjoint. | Moderate. Eliminates command-versus-domain root overlap by nesting all tools under domain folders, at high wrapper cost. | Does not address `$XDG_STATE_HOME` collisions. |
| Cross-harness portability | Strong. Works across Antigravity, Codex, Claude Code, and Linux VMs with standard XDG defaults. | Weak. Requires harness-specific wrappers to rewrite `$XDG_STATE_HOME` per invocation for every CLI. | Weak. Git commits cannot safely coordinate concurrent multi-harness local state. |
| Incremental migration path | Strong. Nothing moves until an approved migration; identical tree moves directly into per-domain VMs. | Weak. Duplicates VM isolation with brittle shell overrides that must be undone later. | Weak. Splitting leaked Git history out of one shared repo is costly. |

### Option A

- **Good.** Matches XDG Base Directory Specification v0.8 defaults for third-party tools, names every child of `my-agent-dojo/` after its command (`my-agent-dojo/<command>/`), keeps agent work under `my-agent-dojo/agent-coordination/{personal,open-source}/`, keeps employer work outside `my-agent-dojo`, keeps public packages free of `my-agent-dojo` paths, keeps `my-agent-dojo` open-source-safe, and migrates directly into per-domain Linux VMs.
- **Bad.** Third-party tools remain user-wide on a shared host until per-domain VMs isolate them; first-party tools serving both sides must enforce `<command>/personal/` and `<command>/open-source/` subdirectories on shared hosts.

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

### Implementation confirmation (verified when the `agent-coordination` command lands)

- **Namespace and permission check.** A read-only hygiene check reports the modes of `$XDG_STATE_HOME/my-agent-dojo/agent-coordination/` and its subdirectories (expected `0700`) and of user-scoped state files (expected `0600`) without changing an existing folder. It also verifies that all slugs match `^[a-z0-9][a-z0-9-]*$`, that every child of `<base>/my-agent-dojo/` follows the command-name rule and slug namespace in decision point 2, that only `personal/` and `open-source/` appear under `agent-coordination/` in state and data homes, that no suite-root setting or per-tool override points at `<base>/my-agent-dojo/` itself or at or under `agent-coordination/`, and that no new first-party command, coordinator, or dated proof directories appear at the root of an XDG base directory. A test with an empty or relative XDG variable shows the tool ignoring it and using the XDG default path.
- **Public package resolution check.** A public package's tests show that a per-tool override wins over the suite-root setting, that the suite-root setting wins over `<base>/<package-suite>/<component>/`, that a relative override or suite root is refused, and that each missing folder is created with mode `0700` while an existing folder keeps its mode.
- **Harness-state isolation review.** No first-party script or CLI writes inside another harness's vendor state directory.
- **First-party tool scoping check.** Each first-party tool that serves both sides verifies in tests that records stay inside `$XDG_STATE_HOME/my-agent-dojo/<command>/personal/` or `$XDG_STATE_HOME/my-agent-dojo/<command>/open-source/`.

### Revisit triggers

- **Per-domain Linux VM rollout.** When per-domain Linux VMs isolate each domain at the operating-system boundary, revisit whether first-party tools serving both sides still need internal `personal/` and `open-source/` subdirectories inside `$XDG_STATE_HOME/my-agent-dojo/<command>/`.
- **Shared wiki tooling (`agent-wiki-tools`).** When shared wiki tooling is created in `my-agent-dojo` for reuse across domain homes, verify its raw ingest logs route exclusively to `$XDG_STATE_HOME/my-agent-dojo/agent-coordination/{personal,open-source}/runs/`.
- **Composable domain connectors.** When composable service connectors (`agent-connectors` or per-service domain adapters) are introduced, revisit whether their runtime state stays under `$XDG_STATE_HOME/my-agent-dojo/<command>/{personal,open-source}/` or moves inside per-domain VM boundaries.

## References

- [ADR 0002: Coordinator leases and retention](0002-coordinator-leases-and-retention.md)
- [Public storage glossary](../../GLOSSARY.md)
- XDG Base Directory Specification v0.8 (`https://specifications.freedesktop.org/basedir/latest/`)
