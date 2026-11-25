---
status: proposed
---

# Where a skill lives

## Context and problem

Agent skills currently sit in three places: installable plugins, loose folders inside harness user skills folders, and copies committed inside repositories. A read-only check on the maintainer's machine found 63 floating skills outside plugins.

This spread causes three failures. Copied skills drift from their upstream source or package version. Unscoped skills load in unrelated sessions and consume each harness's skill listing budget (1% of the context window in Claude Code, and 2% in Codex, which silently omits overflow skills). Package skills copied into a user folder or repository decouple from the installed package version when that package upgrades.

Decision question: where should each skill live so one source serves Claude Code, Codex, and Antigravity without floating user-folder skills, cross-project leaks, or stale copies?

## Decision drivers

1. **Single source across harnesses.** One skill folder serves Claude Code, Codex, and Antigravity without a build step or per-harness copies.
2. **Version alignment with code.** A skill that describes one repository or package upgrades and branches with that repository or package.
3. **Trust-boundary and project isolation.** Public skills stay free of private context, project-group skills stay out of unrelated sessions, and no skill floats in a harness user skills folder.
4. **Predictable invocation and listing budget.** Typed-only skills stay hidden from automatic model selection, remain invocable by name, and do not crowd out automatic skills.
5. **Clear ownership for third-party skills.** Third-party skills stay separate from maintainer-authored skills so updates and licences remain easy to track.

## Considered options

- **Option A.** First-match placement across five skill homes (repository `.agents/skills/`, installed package, private project-group plugin, private vendored third-party plugin, and maintainer public or private skills plugin) with dual manifests, dual typed-only markers, and zero floating skills.
- **Option B.** One global plugin holding every skill, including repository-only and package skills.
- **Option C.** Copy every needed skill into each repository that uses it.

## Decision

**Decision authority:** The maintainer.

We choose **Option A** because it satisfies all five decision drivers.

Every skill is placed by the first rule that matches:

1. A skill that describes only one repository lives in that repository's `.agents/skills/`, regardless of who owns the repository.
2. A skill shipped by a package (for example `agent-cli-kernel`) comes from the installed package version and upgrades with that package. Never copy the skill.
3. The maintainer's own skills for one project group whose repository is not owned by the maintainer alone live in a private plugin for that project group.
4. A skill written by a third party lives in the private plugin of vendored third-party skills.
5. Every other skill lives in the maintainer's public skills plugin (`nathanvale-skills`) or the maintainer's private skills plugin, chosen by privacy.

The maintainer keeps the map from these private plugin roles to concrete plugin names privately.

### Cross-harness plugin contract

- **Zero floating skills.** No `SKILL.md` sits in any harness user skills folder.
- **Dual static manifests.** Each plugin home (rules 3 to 5) is an installable plugin carrying `.claude-plugin/plugin.json` (read by Claude Code and Codex) and `plugin.json` (read by Antigravity).
- **Dual typed-only markers.** Each typed-only skill sets `disable-model-invocation: true` in `SKILL.md` frontmatter (read by Claude Code and Antigravity) and `policy.allow_implicit_invocation: false` in `agents/openai.yaml` (read by Codex).
- **Enabled plugins for typed-only skills.** Do not place typed-only skills in a turned-off plugin. A turned-off Antigravity or Codex plugin's skills cannot be invoked by typing.
- **Project-only wiring.** Each harness activates a project-group plugin differently. Claude Code enables the plugin in `.claude/settings.local.json`. Codex sets `enabled = false` in user settings and `enabled = true` in the trusted project's `.codex/config.toml`. Antigravity loads a plugin folder placed in the project's `.agents/plugins/`.

## Consequences

- **Positive.** Eliminates floating skills and stale copies. Couples repository and package skills to the exact code version in use. Serves all three harnesses from one source without a build step. Keeps typed-only and project-group skills out of unrelated session listings, avoiding silent skill drops in Codex and description truncation in Claude Code.
- **Negative.** Each plugin must maintain two static manifest files. Each typed-only skill must carry two invocation markers. Project-only activation requires one harness-specific configuration step per tool.
- **Neutral.** Concrete names for private plugins and skill-to-group assignments stay outside this public repository.

## Options and tradeoffs

| Driver | Option A (first-match skill homes) | Option B (one global plugin) | Option C (copy into each repository) |
| --- | --- | --- | --- |
| Single source across harnesses | Strong. Dual static manifests and dual markers serve all three harnesses directly. | Strong. One plugin serves all three harnesses. | Weak. Every shared skill is duplicated across repositories. |
| Version alignment with code | Strong. Repository skills travel with Git and package skills upgrade with the package. | Fails. Package and repository skills decouple from checked-out code. | Partial. Local edits stay in Git, but package skills decouple on upgrade. |
| Trust-boundary and project isolation | Strong. Private, public, and project-group skills stay in separate homes with zero floating skills. | Fails. Mixes public, private, and project-only skills in every session. | Moderate. Isolates per repository, but risks committing private skills into shared repositories. |
| Predictable invocation and listing budget | Strong. Dual markers hide typed-only skills and project plugins load only in matching projects. | Weak. Project-only skills load everywhere and consume listing budget. | Moderate. Scoped per repository, but every repository repeats marker maintenance. |
| Clear ownership for third-party skills | Strong. Third-party skills stay isolated in one vendored plugin. | Weak. Mixes third-party and maintainer skills in one plugin. | Fails. Third-party copies scatter across repositories with no central update path. |

### Option A

- **Good.** Keeps every skill coupled to its true owner, eliminates floating skills, and works across all three harnesses with static files.
- **Bad.** Requires maintaining two manifest files per plugin, two markers per typed-only skill, and per-harness project wiring.

### Option B

- **Good.** Simple to install because only one plugin exists.
- **Bad.** Decouples repository and package skills from code, leaks project-only skills into every session, and mixes trust boundaries.

### Option C

- **Good.** Every repository is self-contained without plugin installation.
- **Bad.** Duplicates shared skills across repositories, decouples package skills on upgrade, and scatters third-party maintenance.

## Confirmation

### Design acceptance gate

- Independent cross-model review passes with zero P0 and zero P1 findings.
- Automated privacy scan confirms zero private plugin names, employer names, private repositories, or local home paths in this ADR and `GLOSSARY.md`.
- The maintainer approves transitioning status from `proposed` to `accepted`.

### Implementation confirmation

An automated guard enforces four rules and exits non-zero on any failure. The guard was proven in throwaway homes, and its repository home is undecided.

- `floating-skill`: catches any `SKILL.md` in any of the three harnesses' user skills folders.
- `typed-drift`: catches any skill declared typed-only that is missing either `disable-model-invocation: true` or `agents/openai.yaml` with `policy.allow_implicit_invocation: false`.
- `auto-drift`: catches any automatic skill that carries either typed-only marker.
- `undeclared`: catches any plugin skill missing from the declaration file.

### Revisit triggers

- Codex honours `disable-model-invocation: true`, removing the need for `agents/openai.yaml`.
- Antigravity adds per-skill disabling, or testing confirms whether `.agents/plugins/` accepts symlinks.
- A harness drops support for `.claude-plugin/plugin.json` or changes its plugin manifest path.

## Open questions

- **Third-party typed-only skills in Codex.** Codex ignores `disable-model-invocation: true`, so third-party skills without `agents/openai.yaml` still appear in Codex's automatic listing. Options are turning those skills off by name with `[[skills.config]]` or asking upstream authors to add `agents/openai.yaml`.
- **Private mapping and guard home.** Concrete plugin names, skill-to-group membership, and the repository home for the guard remain for the maintainer to assign.

## References

- [ADR 0001: Local state and domain storage boundaries](0001-local-state-and-domain-storage-boundaries.md)
- [Agent Engineering glossary](../../GLOSSARY.md)
