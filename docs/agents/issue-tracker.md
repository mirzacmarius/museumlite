# Issue Tracker: Linear

Issues and PRDs for this repo live in Linear under the MuseumLite workspace, MUS team.

- Team active board: https://linear.app/museumlite/team/MUS/active
- Team key: `MUS`
- Primary project observed in current issues: `Museumlite Development`

## Conventions

- Create new implementation issues directly in Linear for the MUS team.
- When a skill says "publish to the issue tracker", create the issue in Linear unless the user explicitly asks for a local draft.
- When a skill says "fetch the relevant ticket", read the referenced MUS issue from Linear.
- Team members may create issues directly in Linear. Agents should treat existing MUS issues as actionable work when the user asks to start, triage, diagnose, or implement from the queue.
- Prefer existing MUS labels for issue type and module, such as `Bug`, `Feature`, `Improvement`, `Task`, `Docs`, and `module/...`.
- Use Linear priority values when priority is known: urgent, high, medium, low, or none.
- Move issues through the MUS workflow statuses rather than inventing new statuses.

## Agent handoff (delegated work)

When an agent finishes implementation for a Linear-delegated task:

1. **Comment** on the issue with review steps (PR link, how to test, commands run, follow-ups). Use the template in `.cursor/rules/linear-delegation-handoff.mdc`.
2. **Set status** to `In Review`.
3. **Do not** set status to `Done` — a human closes the issue after review.

Agents should use the Linear MCP after `mcp_get_tools` discovery. If MCP is unavailable, paste the comment in the agent summary for manual posting.

## Workflow Statuses

The MUS team currently uses these statuses:

- `Backlog`
- `Todo`
- `In Progress`
- `In Review`
- `Done`
- `Duplicate`
- `Canceled`
