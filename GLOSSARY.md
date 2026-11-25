# Agent Engineering Glossary

Canonical public vocabulary for storage boundaries, coordinator leases, and recovery lifecycle across the open-source `my-agent-dojo` ecosystem.

## Language

### Storage boundaries

**Domain**:
A private or open-source context of work with its own trust boundary, guidance, and access, such as personal work, the open-source ecosystem, or a single client or employer.
_Avoid_: space, tenant, workspace (when a trust boundary is meant)

**Domain home**:
The private Git repository that holds one private domain's durable wiki, instructions, optional domain CLI, links to skill repositories, and private terms, excluding raw run logs and live scratch.
_Avoid_: home repo (unqualified), vault

**Harness state**:
Vendor-owned local storage written by one agent harness (such as transcripts, vendor scratch, and native board data) that belongs solely to that harness.
_Avoid_: state (unqualified), coordinator state

**Tool runtime state**:
Machine-local operational state that an installed CLI or daemon writes for its own runs, including Command Contract 3 journals and diagnostics. Durable records worth backing up are tool data, not tool runtime state.
_Avoid_: state (unqualified), domain state

**Suite root**:
The folder inside one XDG base directory that holds one folder for each component of a multi-tool suite: `<base>/<suite>/` by default, or the absolute folder named by the suite's root setting.
_Avoid_: base directory (for the XDG base itself), home (unqualified)

**Domain operational state**:
Machine-local, uncommitted storage holding one domain's cross-harness coordinator records, raw run logs, and coordinator archives.
_Avoid_: state (unqualified), vault state, durable memory

### Leases and recovery

**Coordinator lease**:
A durable machine-local ownership record declaring a coordinator's identity, lifecycle status, and claimed host resources.
_Avoid_: lock (unqualified), coordination lock (reserved for Command Contract 3)

**Acquisition lock**:
A transient operating-system exclusive lock that serializes host-wide coordinator lease conflict checks and updates.
_Avoid_: lease (for a transient runtime lock)

**Recovery case**:
An unresolved incident whose raw run evidence must remain preserved for diagnosis or repair.
_Avoid_: incident log, open ticket (for local recovery protection)

### Skills

**Skill home**:
One of the five allowed locations where an agent skill may live: a repository's `.agents/skills/` or `skills/`, an installed package version, a private project-group plugin, the private plugin of vendored third-party skills, or the maintainer's public or private skills plugin.
_Avoid_: skill location (unqualified), skill repo (when a package or plugin is meant)

**Floating skill**:
A `SKILL.md` file placed directly in a harness's user skills folder outside any repository, package, or installable plugin.
_Avoid_: loose skill, user skill, global skill

**Typed-only skill**:
A skill hidden from automatic model selection across harnesses by explicit invocation markers and loaded only when the user invokes it by name.
_Avoid_: manual skill, hidden skill, disabled skill

**Automatic skill**:
A skill whose name and description appear in the harness's initial skill listing so the model can load it without an explicit slash or dollar command.
_Avoid_: implicit skill, default skill, always-on skill

### Agent copies

**Agent copy**:
A repository checkout, linked Git worktree, bare repository, dependency tree, package cache, virtual environment, or non-Git project tree created on disk by an agent, harness, or build tool.
_Avoid_: clone (when worktrees or bulk copies are included), checkout (unqualified), temp repo

**Copy home**:
The single designated folder and lifecycle rule assigned to one kind of agent copy, defining its maker, time to live, cleanup trigger, and guard check.
_Avoid_: copy location, workspace folder, staging directory

**Throwaway copy**:
A temporary agent copy created inside a fresh `mktemp -d` folder under the system temp directory for one bounded job, deleted by its maker after saving evidence and never kept longer than 72 hours.
_Avoid_: scratch repo, temp clone (unqualified), backup clone

**Tool-owned home**:
A registered directory managed by an external tool whose storage path cannot be redirected, where the tool controls creation and cleanup and the guard accepts copies inside it.
_Avoid_: vendor folder, external repo dir, unmanaged worktree

**Stray copy**:
An agent copy found outside its designated copy home, including a copy inside a no-copy folder, an unregistered copy inside `<repo>/.worktrees/`, or a nested Git copy inside another copy or bulk folder.
_Avoid_: orphan repo, leftover clone, rogue checkout

**Loss check**:
A read-only assessment of a copy folder (or an entire throwaway `mktemp -d` folder) that advises the maintainer whether deleting it would lose work, reporting `nothing-found`, `work-found`, or `unknown` with reasons, without deleting anything.
_Avoid_: delete check, safe-to-delete flag, cleanup verdict

**DOMAIN_COPY_HOME_FINDINGS**:
The refused, unchanged domain result returned by `copy-home check` with exit code 3 when a scan reports any finding (such as a stray copy, expired throwaway, dangling registration, or incomplete scan), while still carrying the full findings report as data.
_Avoid_: findings error, check failure, non-zero clean exit

**DOMAIN_COPY_HOME_INVALID_HOMES**:
The refused, unchanged domain result returned by `copy-home check` with exit code 3 and no data when the `--homes` path is relative or the homes file cannot be read or validated as a version 1 copy homes JSON file.
_Avoid_: config error, bad homes file, invalid input (unqualified)
