# Skillshare configuration

This folder holds the repository's pinned Skillshare lockfile (`skills.lock.json`), local audit override (`audit-rules.yaml`), and Skillshare ignore rules (`.gitignore`).

## Requirements

- **Skillshare version:** Install `skillshare` 0.30.10 or newer (`v0.30.13` verified). Starting in `v0.30.10` (`runkids/skillshare#914`), `skillshare sync` in `merge` or `copy` mode keeps unowned broken symlinks and foreign same-name skill symlinks untouched unless you pass `--force`, so direct Skillshare sync replaces the retired wrapper script.
- **Single writer per target folder:** Point only one Skillshare configuration at any live skills directory (such as `~/.claude/skills` or `~/.codex/skills`). `.skillshare-manifest.json` records no owner identity, so two Skillshare configurations writing to the same target directory overwrite or prune each other's skills.
- **Skills scope only for coexistence:** The `v0.30.10` ownership check protects `skillshare sync` for skills. `skillshare sync agents` and `skillshare sync extras` still prune broken symlinks and replace same-name symlinks without `--force`.

## Kept files

- **`skills.lock.json`:** Pins the exact upstream commit and tree hash for each installed skill.
- **`audit-rules.yaml`:** Keeps a narrow local exclusion for JavaScript `root:` properties inside Markdown code fences until upstream resolves `runkids/skillshare#999`.
- **`.gitignore`:** Keeps machine-local `config.yaml`, logs, backups, and installed skill payloads out of Git.
