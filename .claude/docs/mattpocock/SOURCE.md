# Matt Pocock's skills (vendored)

The 27 skills listed in `.claude-plugin/plugin.json` of [mattpocock/skills](https://github.com/mattpocock/skills), plugin version 1.3.1 at commit `49dd158d1076134a641b33efb035946536778336`, are copied into `.claude/skills/`. MIT licensed, see `LICENSE`. The `in-progress` and `misc` buckets are not included, because the plugin leaves them out too.

The repo is already configured for them: `docs/agents/issue-tracker.md` (Linear, MUS team), `docs/agents/triage-labels.md` and `docs/agents/domain.md`, linked from the "Agent skills" section of `CLAUDE.md`. Re-run `/setup-matt-pocock-skills` only to change those choices.

Local changes:

- Dropped every `agents/openai.yaml` (Codex-only metadata).
- Renamed three skills whose names were taken: `tdd` and `teach` by pstack, `code-review` by Claude Code's built-in review. They are `mp-tdd`, `mp-teach` and `mp-code-review` (folder and `name:`), and the references to them in `ask-matt`, `implement`, `implement-spec`, `mp-tdd` and `mp-teach` point at the new names.

None of these skills merges a PR to `main`. `implement-spec` merges subagent branches into its own integration branch only. The MuseumLite rule in `.claude/docs/harness/claude-code.md` still applies: never merge a PR or arm auto-merge; Marius approves each merge.

To update, copy each path in the upstream `plugin.json` into `.claude/skills/` again (without `agents/`) and reapply these changes.
