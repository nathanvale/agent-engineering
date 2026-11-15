---
name: agent-cli-design
description: Command Contract 3.0 for Bun and TypeScript CLIs used by humans and agents. Use to read, review or qualify against the 3.0 envelope, next steps, discovery, versioning, lifecycle, add-ons or static gates.
---

# Agent CLI design

This skill owns Command Contract 3.0: the rules a CLI follows so a human or
an agent can tell what happened, what changed and what to do next.

## Status

The contract text is a **candidate**. Nathan has not accepted it. It binds no
repository, and nothing implements it.

- A CLI whose envelopes read `2.0.0` is maintained under the accepted 2.0
  contract and its own skill. Leave it there until its move is separately
  scoped.
- This repository's own CLI is 2.0 scaffolding. Leave it as generated.
- Build nothing from this text until Nathan accepts its exact bytes.

## Read the contract

Start at [the candidate index](references/contract-3/index.md). It routes each
task to one reference file and explains the tag on every clause: carried from
an accepted specification, following one of Nathan's decisions, proposed, or
open.

| To | Read |
| --- | --- |
| Review or accept the candidate | [decisions.md](references/contract-3/decisions.md), then [review.md](references/contract-3/review.md) |
| Check that no accepted rule was lost | [requirement-map.md](references/contract-3/requirement-map.md) |
| See how each rule would be proved | [verification.md](references/contract-3/verification.md) |

Completion criterion for any task that cites this contract: every claim names
its clause identifier, and a clause tagged proposed or open is reported as
unaccepted.
