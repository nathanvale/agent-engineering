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
Machine-local operational state owned by an installed CLI or daemon, including Command Contract 3 journals and diagnostics.
_Avoid_: state (unqualified), domain state

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
