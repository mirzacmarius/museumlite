#!/bin/bash
# Install workspace dependencies in Claude Code cloud sessions so lint,
# typecheck and tests work from the first command. Local sessions skip it.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
bun install --frozen-lockfile
