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

## Workflow statuses

`Backlog`, `Todo`, `In Progress`, `In Review`, `Done`, `Duplicate`, `Canceled`

## Agent handoff (delegated Linear work)

Apply when finishing work tied to a MUS issue (prompt, branch, PR, or link).

1. Resolve the MUS id (for example `MUS-501`). Ask once if missing.
2. Complete the normal delivery path under standing authorization in `AGENTS.md` (commit, PR, required checks, merge, production deploy).
3. Keep the issue `In Progress` until the change is verified on https://app.museumlite.com.
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
