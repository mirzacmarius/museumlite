# pstack (vendored)

The pstack skills in `.claude/skills/`, the `poteto-agent` and `comment-sicko` agents in `.claude/agents/`, and `.claude/docs/harness/claude-code.md` come from the Claude Code harness tree of [cursor/plugins](https://github.com/cursor/plugins/tree/main/harness/pstack/claude-code), pstack 0.15.25 at commit `101b274dd991f694e1f7024be2157e5f3adf07de`. MIT licensed, see `LICENSE`.

Local changes:

- Left out `make-bot-ui` (Cursor Grok Bot) and its row in `poteto-help`.
- `claude-code.md`: paths and names for an unprefixed in-repo install, plus a MuseumLite rules section (no merges; repo docs win).
- `poteto-agent.md`: finds `poteto-mode` in `.claude/skills/` instead of `~/.cursor/plugins/`.

To update, copy the harness tree's `skills/` and `agents/` again and reapply these changes.
