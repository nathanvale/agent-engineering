# Agent Engineering Glossary

Canonical public vocabulary for storage boundaries, coordinator leases, and recovery lifecycle across the open-source `my-agent-dojo` ecosystem.

## Language

### Storage boundaries

**Domain**:
A private or open-source context of work with its own trust boundary, guidance, and access, such as personal work, the open-source ecosystem, or a single client or employer.
_Avoid_: space, tenant, workspace (when a trust boundary is meant)

**Domain home**:
The private Git repository that holds one private domain's durable wiki, instructions, optional domain CLI, links to public and private skill repositories, and private terms, with zero raw run logs or live scratch.
_Avoid_: home repo (unqualified), vault

**Harness state**:
Vendor-owned local storage written by one agent harness (such as transcripts, vendor scratch, and native board state) that is never shared or mutated across harnesses.
_Avoid_: state (unqualified), coordinator state

**Tool runtime state**:
Machine-local operational state owned by an installed CLI or daemon under `$XDG_STATE_HOME/<tool>/`, including Command Contract 3 journals and diagnostics, scoped by `<domain>` subdirectory for first-party multi-domain tools on a shared host.
_Avoid_: state (unqualified), domain state

**Domain operational state**:
Machine-local, uncommitted storage under `$XDG_STATE_HOME/my-agent-dojo/domains/<domain>/` holding one domain's cross-harness coordinator folders (`coordinators/<slug>/`), raw run or wiki logs (`runs/<date-slug>/`), and coordinator archives (`archives/coordinators/`).
_Avoid_: state (unqualified), vault state, durable memory

### Leases and recovery

**Coordinator lease**:
The durable machine-local `lease.json` record inside a coordinator folder declaring its owning conversation, harness, host, process identity, heartbeat, lifecycle status (`active`, `paused`, or `stopped`), and claimed repositories, branches, worktrees, and ports.
_Avoid_: lock (unqualified), coordination lock (reserved for Command Contract 3)

**Acquisition lock**:
The transient operating-system exclusive lock under `$XDG_RUNTIME_DIR/my-agent-dojo/` that serializes host-wide conflict checks and atomic coordinator lease updates and clears automatically on crash or reboot.
_Avoid_: lease (for a transient runtime lock)

**Recovery case**:
An unresolved incident requiring preserved raw run evidence for diagnosis or repair, marked by a run-local `RECOVERY-OPEN.json` file or an open Command Contract 3 `operations/` journal record.
_Avoid_: incident log, open ticket (for local recovery protection)
