#!/bin/bash
# After Claude edits a file, apply Biome's safe fixes (format, import order)
# to that file. Files Biome ignores, and remaining lint findings, are left for
# `bun run lint` and CI to report.
set -uo pipefail

file=$(jq -r '.tool_input.file_path // empty')
case "$file" in
  *.ts | *.tsx | *.js | *.jsx | *.mjs | *.cjs | *.json | *.jsonc | *.css) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0

biome="$CLAUDE_PROJECT_DIR/node_modules/.bin/biome"
[ -x "$biome" ] || exit 0

cd "$CLAUDE_PROJECT_DIR"
"$biome" check --write --no-errors-on-unmatched --files-ignore-unknown=true "$file" >/dev/null 2>&1 || true
exit 0
