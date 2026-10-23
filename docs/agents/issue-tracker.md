# Issue Tracker: Linear

Issues and PRDs live in Linear under the MuseumLite workspace, MUS team.

- Team active board: https://linear.app/museumlite/team/MUS/active
- Team key: `MUS`
- Primary project: `Museumlite Development`

Standing delivery authorization (merge, deploy, then In Review) is defined in root `AGENTS.md`. Follow that text; do not weaken it here.

## Conventions

- Create implementation issues on the MUS team in Linear.
- Prefer existing labels (`Bug`, `Feature`, `Improvement`, `Task`, `Docs`, `module/...`).
- Use Linear priorities when known: urgent, high, medium, low, or none.
- Use MUS workflow statuses only. Cap active `In Progress` work; park the rest in `Todo` or `Backlog`.

## Operations for the engineering skills

Skills such as `/to-spec`, `/to-tickets`, `/triage`, `/implement` and `/wayfinder` read and write MUS issues through the Linear MCP tools (`mcp__Linear__*`). Without them, use the Linear web app and say so.

- **Create an issue**: `save_issue` with `team: "MUS"`, `title`, `description` (Markdown, real newlines), and labels from the conventions above.
- **Read an issue**: `get_issue` with the `MUS-nnn` id (`includeRelations: true` when blockers matter), plus `list_comments` for its discussion.
- **List issues**: `list_issues` with `team: "MUS"` and `state`, `label`, `parentId` or `query` filters.
- **Make an issue a sub-issue of a parent**: `save_issue` with `parentId: "MUS-nnn"`, on create or later.
- **Comment on an issue**: `save_comment` with `issueId`.
- **Apply / remove labels**: `save_issue` with `id` plus `addLabels` / `removeLabels` (never `labels`, which replaces the whole set).
- **Close**: move the issue to the status the role calls for (see [triage-labels.md](triage-labels.md)) with a comment saying why. Agents never set `Done`, `Canceled` or `Duplicate` on their own (see **Agent handoff** below).

**PRs as a request surface: no.** _(MUS work starts in Linear; `/triage` reads this flag. External PRs are reviewed on GitHub, not triaged here.)_

### When a skill says "publish to the issue tracker"

Create a MUS issue in Linear.

### When a skill says "fetch the relevant ticket"

Read it as in **Read an issue** above. Branches and PRs name it as `MUS-nnn`.

### Wayfinding operations

Used by `/wayfinder`. The **map** is one MUS issue with **child** issues as tickets.

- **Map**: an issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body.
- **Child ticket**: a sub-issue of the map (`parentId`), labelled `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, it is assigned to the driving dev.
- **Blocking**: Linear's native relations, `save_issue` with `blockedBy: ["MUS-nnn"]`. A ticket is unblocked when every blocker is `In Review`, `Done` or `Canceled`.
- **Frontier query**: `list_issues` with `parentId` set to the map, open statuses only; drop any with an open blocker (`get_issue` with `includeRelations`) or an assignee; first in map order wins.
- **Claim**: `save_issue` with `assignee: "me"`, the session's first write.
- **Resolve**: comment the answer with `save_comment`, move the ticket to `In Review` (a human sets `Done`), then append a context pointer (gist + link) to the map's Decisions-so-far.

The `wayfinder:*` labels don't exist in MUS yet; create them with `create_issue_label` the first time `/wayfinder` needs one.

## Workflow statuses

`Backlog`, `Todo`, `In Progress`, `In Review`, `Done`, `Duplicate`, `Canceled`

## Agent handoff (delegated Linear work)

Apply when finishing work tied to a MUS issue (prompt, branch, PR, or link).

1. Resolve the MUS id (for example `MUS-501`). Ask once if missing.
2. Complete the normal delivery path under standing authorization in `AGENTS.md` (commit, Standards and Spec review, PR, `Check / check`, merge, production deploy).
3. Keep the issue `In Progress` until the deploy is verified. Locally, `node scripts/verify-deploy.mjs <merge-sha>` does it: it finds the Vercel production deployment for the commit, fails within 3 minutes if none started, waits for READY and confirms https://app.museumlite.com serves it. Claude Code cloud sessions have no `vercel` CLI, so they check the same three things with the Vercel connector: a production deployment of project `museumlite` (team `orvibo`) for the full 40-character merge SHA, its state reaching `READY`, and the `app.museumlite.com` alias pointing at it. No deployment within 3 minutes is a failed deploy. Do not poll GitHub commit statuses for this; Vercel can skip a commit without posting one.
4. Comment on the issue with PR link, deployed commit SHA, app URL, and a **Review checklist**.
5. Move the issue to `In Review` only after that deploy verification.
6. Never set `Done`, `Canceled`, or `Duplicate` unless a human asks after review.

### Review checklist

Use markdown checkboxes (`- [ ]`). Group under `###` scenario headings. Name routes, labels, expected copy, permission keys, and regressions. End with commands you ran. Canonical shape: comment on `MUS-485`.

```markdown
## Ready for review

**PR:** <link>
**Deployed commit:** `<sha>`
**App:** https://app.museumlite.com

### What changed
- <1–3 bullets>

## Review checklist (deployed commit `<sha>`)

### <Primary journey>
- [ ] <Navigate / observe / act>

### Permissions
- [ ] User without `<permission.key>` cannot <action>
- [ ] User with `<permission.key>` can <action>

### Regression
- [ ] <Adjacent flow still works>

### Automated checks
- [ ] <commands and outcome>
```

### PR alignment

- Reference `MUS-XXX` in the PR.
- Opening a PR does not move the issue to `In Review`.
- See also [triage-labels.md](triage-labels.md).
