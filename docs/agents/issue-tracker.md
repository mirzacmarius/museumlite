# Issue Tracker: Linear

Issues and PRDs for this repo live in Linear under the MuseumLite workspace, MUS team.

## Normal delivery authorization

For requested MuseumLite coding work, including implementation from a Linear issue, the user has granted standing authorization to complete the normal delivery path without asking for a fresh explicit yes to merge or run the routine production deployment: commit and push the change, open a PR, wait for all required checks to pass, review the diff, merge through normal GitHub controls, and let configured Vercel and Convex production deployments run. Verify the merged commit serves `https://app.museumlite.com`, then post the tester checklist, PR link, deployed SHA, and app URL to the issue and move it to `In Review`.

This project-scoped authorization takes precedence over optional skill instructions requiring fresh consent for each merge or routine production deployment, including `convex-deploy-guard`. It does not permit bypassing required checks or branch protection. Respect explicit user constraints and confirm the correct issue and deployment target. When required checks fail, investigate and fix failures within the requested scope, rerun the required checks, and continue once they pass. If a failure or deployment problem remains unresolved, keep the issue `In Progress`, record the blocker, and do not hand it to testers. Do not infer authorization for destructive or out-of-scope operations. `Done` remains reserved for human/tester validation.

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

## Workflow Statuses

The MUS team currently uses these statuses:

- `Backlog`
- `Todo`
- `In Progress`
- `In Review`
- `Done`
- `Duplicate`
- `Canceled`

## Agent handoff (delegated work)

Apply this rule when you are finishing work that was **delegated from Linear** (MUS issue in the prompt, branch name, PR description, or explicit Linear link/ID).

### When this applies

- You have opened or updated a PR for the Linear task, or you are about to stop after implementing the requested work.
- The human or Linear agent expects a **handoff for review**, not closure.

Do **not** wait for the user to ask — treat this as a required final step before you end the turn.

### Required actions (in order)

1. **Confirm the Linear issue**
   Resolve the MUS issue identifier (e.g. `MUS-501`) from context. If missing, ask once; do not guess issue IDs.

2. **Complete the normal delivery workflow under the standing authorization above.**
   Commit and push the implementation, open a PR referencing the Linear issue, wait for all required checks to pass, and review the actual diff. Merge through normal GitHub controls without asking for a fresh explicit yes. Allow the configured production deployment to run. Do not bypass branch protection or failed checks. If checks fail, investigate and fix them within the requested scope, rerun the required checks, and continue once they pass. If a failure remains unresolved, record the blocker and keep the issue `In Progress`.

3. **Keep the issue `In Progress` through implementation, review, merge, and deployment.**
   Creating a PR, requesting code review, or completing local checks does not make
   the issue ready for tester review. Testers take issues in `In Review` and
   validate them on https://app.museumlite.com, so the change must be merged and
   verified as successfully deployed to that app before moving the issue to
   `In Review`.

4. **Post a comment on the Linear issue** (Linear MCP)
   Use `mcp_get_tools` for the Linear server, then `mcp_call_tool` with `save_comment` (or the comment tool the server exposes).
   Once deployment is verified, the handoff comment **must** include the PR,
   deployed commit, app URL, and a **Review checklist** section (see below).
   If Linear MCP is not authenticated (`needsAuth`), say so in your summary and paste the full comment body so a human can post it.

5. **Set workflow status to `In Review` only after successful deployment is verified**
   Update the issue status to exactly **`In Review`** (MUS team workflow). Use Linear `save_issue` with the correct status for the MUS team. Include the deployed commit and https://app.museumlite.com in the handoff comment so testers can validate the deployed version.
   If deployment is blocked or fails, leave the issue `In Progress` and record the blocker on the issue; do not hand it to testers as `In Review`.

6. **Never mark `Done`**
   `Done` is reserved for human/tester validation. Agents must not set it automatically, even after deployment or a successful handoff. Do **not** set status to `Done`, `Canceled`, or `Duplicate` unless the user explicitly instructs you to after human review.

### Review checklist (required)

Every handoff comment must include a scannable **Review checklist** so a reviewer can exercise the app without re-reading the PR diff.

**Canonical example:** `MUS-485` (Collection groups) — handoff comment titled “Review checklist” on the MUS team board — comment titled “Review checklist” with grouped `- [ ]` items, navigation paths, expected copy, permissions, and regression steps.

#### Writing rules

- Use markdown checkboxes: `- [ ]` (reviewers tick them in Linear).
- Group steps under `###` headings by **scenario** (happy path, empty state, permissions, regression, i18n).
- Be **specific about where to click**: sidebar labels, routes (`/objects`, query params), dialogs, filter chips, button labels.
- State **expected UI copy** in quotes when copy changed (e.g. **“Add objects to the collection”**).
- Call out **negative cases** (must *not* happen, must *not* navigate to X).
- Include **permission** checks with exact permission keys when backend gates exist.
- Add a **Regression** section for adjacent flows that must still work.
- End with **commands** the agent ran (`bun run lint`, targeted `bun test`, etc.).
- Mark **i18n** or **optional** sections when locales were not fully translated.
- Do not paste huge code blocks — this is a manual QA script, not implementation notes.

#### Comment structure

Post markdown on the issue after confirming that the merged change is successfully deployed to https://app.museumlite.com. Omit sections that do not apply; never skip the Review checklist. Include the PR link, deployed commit SHA, and app URL in every handoff comment.

```markdown
## Ready for review

**PR:** <link to pull request>
**Deployed commit:** `<commit-sha>`
**App:** https://app.museumlite.com

### What changed
- <1–3 bullets: user-visible or API behavior>

## Review checklist (deployed commit `<commit-sha>` — https://app.museumlite.com)

### <Primary user journey / feature name>
- [ ] <Navigate: e.g. Dashboard → Object Catalog → sidebar “emblem” group>
- [ ] <Observe: expected label, empty state, or data>
- [ ] <Action: open dialog, save, refresh — expected result>

### <Secondary flows / edge cases>
- [ ] <…>

### Permissions
- [ ] User **without** `<permission.key>` cannot <action> (control hidden or disabled).
- [ ] User **with** `<permission.key>` can <action>.

### Regression
- [ ] <Unchanged flow A still works>
- [ ] <Unchanged flow B still works>

### Automated checks
- [ ] <Commands run and results; note if only a subset was run>

### i18n (optional)
- [ ] New strings under `<locale keys>` read correctly; other locales fall back acceptably if untranslated.

### Out of scope / follow-ups
- <optional deferred items>

### Agent notes
- <Deployment verification details or relevant caveats>
```

#### Minimal example (adapt to the issue)

```markdown
## Ready for tester review

**PR:** <link to pull request>
**Deployed commit:** `<commit-sha>`
**App:** https://app.museumlite.com

## Review checklist (deployed commit `<commit-sha>`)

### Empty collection group
- [ ] Open Object Catalog with a collection group selected from the sidebar (e.g. emblem) that has **no** objects.
- [ ] Empty state shows **“No objects in this collection yet”**.
- [ ] Primary CTA is **“Add objects to the collection”** — does **not** go to `/objects/new`.

### Add objects dialog
- [ ] CTA opens a dialog with searchable list and checkboxes; save adds selected objects to the group.
- [ ] Uncheck and save removes from **this group only**; object remains in catalog and other groups.

### Permissions
- [ ] User **without** `collections.update` cannot add/remove group membership.

### Regression
- [ ] Full catalog (no group filter): **“Add Your First Object”** still routes to `/objects/new`.
- [ ] <Commands run and results.>
```

### PR and git alignment

- Ensure the PR description references the Linear issue (`MUS-XXX`).
- Mirror the same Review checklist in the PR description when the PR template has a “Testing” or “QA” section.
- Opening a PR or completing code review does not move the issue to `In Review`; keep it `In Progress` until merged and verified on the deployed app.
- Do not close the Linear issue in the same turn you open the PR unless the user asked for closure. `Done` follows human/tester validation only.

### References

- Canonical checklist: `MUS-485` (review comment on the issue)
- MUS statuses and conventions: `docs/agents/issue-tracker.md`
- Triage mapping: `docs/agents/triage-labels.md`
