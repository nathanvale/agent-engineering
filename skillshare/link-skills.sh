#!/bin/bash
# link-skills.sh link|unlink: one plain symbolic link per skill, from each agent's live skills folder
# to the dedicated folder Skillshare syncs. It owns only a live link whose text is exactly
# <dedicated folder>/<its own name>. Safe only while no other installer writes these folders.
set -euo pipefail
R="${XDG_DATA_HOME:-$HOME/.local/share}/my-agent-dojo/agent-engineering"
case "${1:-}" in
link)
  todo=""
  for a in claude codex; do live="$HOME/.$a/skills"; ded="$R/$a/skills"
    for s in "$ded"/*/; do s=${s%/}; [ -f "$s/SKILL.md" ] || continue
      l="$live/${s##*/}"
      [ "$(readlink "$l" || true)" = "$s" ] && continue
      if [ -e "$l" ] || [ -L "$l" ]; then echo "REFUSE $l exists; nothing changed"; exit 3; fi
      todo+="$s"$'\t'"$l"$'\n'
    done
  done
  printf '%s' "$todo" | while IFS=$'\t' read -r s l; do
    perl -e 'symlink($ARGV[0], $ARGV[1]) or die "REFUSE $ARGV[1]: $!\n"' "$s" "$l"; echo "linked $l"; done ;;
unlink)
  for a in claude codex; do live="$HOME/.$a/skills"; ded="$R/$a/skills"
    for l in "$live"/*; do
      [ -L "$l" ] && [ "$(readlink "$l")" = "$ded/${l##*/}" ] || continue
      rm "$l"; echo "removed $l"
    done
  done ;;
*) echo "usage: link-skills.sh link|unlink"; exit 64 ;;
esac
