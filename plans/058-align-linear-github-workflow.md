# Plan 058: Make Linear the only issue tracker and fix agent/GitHub workflow glue

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7146e556..HEAD -- .github/ISSUE_TEMPLATE .github/PULL_REQUEST_TEMPLATE.md docs/agents/issue-tracker.md docs/APP-IDEEA.md .cursor/rules/linear-delegation-handoff.mdc AGENTS.md plans/README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/056-canonical-platform-identity.md (identity URLs). If 056 is not done, still use `https://github.com/mirzacmarius/ml-cursor` and `https://linear.app/museumlite/team/MUS/active`.
- **Category**: dx
- **Planned at**: commit `7146e556`, 2026-08-14

## Why this matters

Issues already live in Linear (`MUS`), and the Linear GitHub App is attached to `mirzacmarius/ml-cursor` (`linear[bot]` linkback comments on PRs). GitHub Issues is still enabled, and the only issue template is named "Linear Issue" — so people can file tickets in the wrong tracker.

Cursor automations that implement Linear issues name every branch `cursor/mus-XXX-linear-issue-triage-automation-*` even when the work is unrelated to triage (PRs #110, #112, #113). Duplicate PRs from the same branch have already landed (#109 and #111 for MUS-519). Cloud agents in this environment have **no Linear MCP**, so the required handoff in `.cursor/rules/linear-delegation-handoff.mdc` cannot run.

This plan fixes the in-repo glue (templates, docs, stale Linear MCP examples). Dashboard steps (disable GitHub Issues, rename the Cursor automation, enable Linear MCP for Cloud Agents) are listed as operator checks, not silent API calls.

## Current state

`.github/ISSUE_TEMPLATE/linear.md` (whole file is the template). Front matter:

```yaml
name: Linear Issue
about: Standard issue template following MUS-263 taxonomy
```

It tells people to file a GitHub issue using Linear's label taxonomy. That is the opposite of `docs/agents/issue-tracker.md`.

`.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## Related Issue
<!-- Link to Linear issue: MUS-XXX -->
```

It does not require a `https://linear.app/museumlite/issue/MUS-...` URL. Linear still attaches via the GitHub App if the identifier is present, but agents often omit it (merged plan PRs #93–#104 have `hasMus: false` in the body).

`docs/APP-IDEEA.md` Linear examples (around lines 256–268) use `--team "Engineering"`, issue ids like `ACC-123`, and `mcp_linear_create_issue` — none of that matches team `MUS`.

`gh repo view` reports `hasIssuesEnabled: true`. Collaborators: only `mirzacmarius`.

Cursor Cloud `GetMcpTools` catalog in the 2026-08-14 identity audit: only `cursor-cloud`. No Linear server. Handoff rule says: if MCP `needsAuth`, paste the comment for a human.

Live Linear-linked PRs (evidence the GitHub connection is this repo):

- PR #113 `cursor/mus-541-linear-issue-triage-automation-93d7` — `linear[bot]` → MUS-541
- PR #112 `cursor/mus-540-linear-issue-triage-automation-77fc` — `linear[bot]` → MUS-540

Repo conventions: keep GitHub templates in `.github/`. Agent docs in `docs/agents/`. Do not add a second issue tracker.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Lint | `bun run lint` | exit 0 (markdown-only should be clean) |
| Template exists | `test -f .github/ISSUE_TEMPLATE/config.yml && test -f .github/ISSUE_TEMPLATE/linear.md` | exit 0 |
| No fake team keys in APP-IDEEA Linear section | `rg -n 'team \"Engineering\"|ACC-123|mcp_linear_create_issue' docs/APP-IDEEA.md` | no matches after the edit |

## Suggested executor toolkit

- GitHub blank-issues config: https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository#configuring-the-template-chooser
- Linear GitHub sync: https://linear.app/docs/github
- Handoff rule: `.cursor/rules/linear-delegation-handoff.mdc`

## Scope

**In scope**:

- `.github/ISSUE_TEMPLATE/config.yml` (create)
- `.github/ISSUE_TEMPLATE/linear.md` (replace with a redirect to Linear, or delete if `config.yml` disables issues)
- `.github/PULL_REQUEST_TEMPLATE.md`
- `docs/agents/issue-tracker.md` (GitHub Issues policy + Cloud Linear MCP caveat + branch naming)
- `docs/APP-IDEEA.md` (fix the Linear MCP example block only)
- `.cursor/rules/linear-delegation-handoff.mdc` (when Linear MCP is missing, still put MUS URL + checklist in the PR body)
- `AGENTS.md` (one short "Issues" bullet if not already covered by 056)
- `plans/README.md`

**Out of scope**:

- Calling GitHub API to set `has_issues=false` (operator checkbox; the token in Cloud Agents cannot always write repo settings).
- Renaming or editing the Cursor Automation in the Cursor dashboard (operator checkbox).
- Installing Linear MCP credentials.
- Deleting 72 leftover `advisor/` / `cursor/` remote branches (plan 059).
- Changing Linear workflow statuses.

## Git workflow

- Branch: `cursor/058-linear-github-workflow` (or the batch identity branch).
- Commit message style: `docs(github): route issues to Linear MUS`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Stop GitHub Issues from looking like the tracker

Create `.github/ISSUE_TEMPLATE/config.yml`:

```yaml
blank_issues_enabled: false
contact_links:
  - name: MuseumLite Linear (MUS)
    url: https://linear.app/museumlite/team/MUS/active
    about: File and track all product work in Linear. This GitHub repo is code-only; Linear is attached to mirzacmarius/ml-cursor.
```

Replace `.github/ISSUE_TEMPLATE/linear.md` with a stub that cannot be used as a real ticket:

```markdown
---
name: Do not use GitHub Issues
about: Product work lives in Linear MUS
---

Do not file issues here. Open a MUS issue instead:

https://linear.app/museumlite/team/MUS/active

This GitHub repository (`mirzacmarius/ml-cursor`) is the git remote Linear is connected to. GitHub Issues is not the tracker.
```

If GitHub still shows the old "Linear Issue" template after this, that is expected until `has_issues` is disabled in settings (Step 6).

**Verify**: `python3 -c "import pathlib; print(pathlib.Path('.github/ISSUE_TEMPLATE/config.yml').read_text())"` → contains `blank_issues_enabled: false`. `rg -n "File and track all product work in Linear" .github/ISSUE_TEMPLATE/config.yml` → match.

### Step 2: Require a Linear URL on PRs

In `.github/PULL_REQUEST_TEMPLATE.md`, change Related Issue to:

```markdown
## Related Issue

- Linear: https://linear.app/museumlite/issue/MUS-XXX/...
- Identifier: MUS-XXX

PRs without a MUS issue are allowed only for docs/chore with **no Linear issue** called out explicitly.
```

Keep the rest of the Definition of Done / Verification lists.

**Verify**: `rg -n "linear.app/museumlite/issue" .github/PULL_REQUEST_TEMPLATE.md` → match.

### Step 3: Update issue-tracker + handoff for Cloud Agents

In `docs/agents/issue-tracker.md`, add two subsections after Conventions:

```markdown
## GitHub

- Code: `https://github.com/mirzacmarius/ml-cursor`
- Linear GitHub App: connected to that repo (`linear[bot]` PR comments).
- Do not use GitHub Issues. If GitHub Issues is still enabled, it is a leftover; redirect to Linear.

## Cursor Cloud / MCP

- Linear MCP is **not** always present in Cursor Cloud (catalog may only include `cursor-cloud`).
- If Linear MCP is missing or `needsAuth`, still write the Review checklist into the **PR body** and the agent summary. Do not skip the checklist.
- Do not invent a second GitHub repo named `museumlite` for Linear.

## Branch names for Linear-delegated work

Prefer `cursor/mus-XXX-short-topic-<suffix>` (topic from the issue title).
Do not reuse a generic automation slug like `linear-issue-triage-automation` for unrelated issues.
```

In `.cursor/rules/linear-delegation-handoff.mdc`, in "Required actions", after the MCP `needsAuth` sentence, add: if Linear MCP is absent entirely, treat it the same as `needsAuth` — PR body + summary must contain the full Review checklist and the `https://linear.app/museumlite/issue/MUS-XXX` URL.

**Verify**: `rg -n "linear-issue-triage-automation" docs/agents/issue-tracker.md` → match (as the anti-pattern). `rg -n "MCP is absent" .cursor/rules/linear-delegation-handoff.mdc` → match (or equivalent wording).

### Step 4: Fix APP-IDEEA Linear examples

In `docs/APP-IDEEA.md`, replace the example block that uses `Engineering`, `ACC-123`, and `mcp_linear_create_issue` with MUS-team examples:

- Team: `MUS` (or "MuseumLite")
- Identifier pattern: `MUS-123`
- Tooling: "Linear MCP `save_issue` / `create_issue` after `mcp_get_tools`" — do not document a CLI named `mcp_linear_create_issue` unless it exists in this repo (`rg mcp_linear_create_issue` should become empty).

Do not rewrite the rest of APP-IDEEA.

**Verify**: `rg -n "mcp_linear_create_issue|ACC-123|team \"Engineering\"" docs/APP-IDEEA.md` → no matches.

### Step 5: Lint + index

`bun run lint`. Update `plans/README.md` row 058.

**Verify**: lint exit 0.

### Step 6: Operator checkboxes (document in the PR, do not execute unless asked)

```markdown
- [ ] GitHub repo Settings → General → Features → uncheck Issues
  (`gh api -X PATCH repos/mirzacmarius/ml-cursor -f has_issues=false` if the token allows writes; Cloud `gh` is often read-only)
- [ ] Linear → Settings → Integrations → GitHub: confirm the only connected repo is `mirzacmarius/ml-cursor`
- [ ] Cursor Dashboard → Cloud Agents / MCP: authenticate Linear for Cloud Agents
- [ ] Cursor Automation that implements Linear issues: rename from "Linear issue triage automation" to "Linear issue implementation"; set branch prefix to `cursor/mus-{{issue.identifier}}-{{issue.title}}` (or Cursor's equivalent) so PRs stop saying "triage automation"
- [ ] Confirm the automation does not open a second PR on a branch that already has an open PR (MUS-519 produced #109 and #111)
```

**Verify**: those five bullets appear in the PR body.

## Test plan

- No application tests.
- Manual: GitHub "New issue" UI should show the Linear contact link, not a usable product-bug form.
- Manual: next Linear-delegated PR includes a `linear.app` URL in the body so `linear[bot]` is redundant, not required.
- Pattern: none.

## Done criteria

- [ ] `.github/ISSUE_TEMPLATE/config.yml` disables blank issues and links Linear MUS
- [ ] `.github/ISSUE_TEMPLATE/linear.md` is a redirect, not a taxonomy form
- [ ] PR template requires a `linear.app/museumlite/issue/MUS-` URL
- [ ] `docs/APP-IDEEA.md` Linear examples use MUS, not Engineering/ACC-123
- [ ] Handoff rule covers missing Linear MCP
- [ ] `bun run lint` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- GitHub already has other issue templates besides `linear.md` — include them in the redirect, do not delete unknown templates.
- Linear's connected repo is **not** `ml-cursor` when the operator checks (then the identity map is wrong; update plan 056 first).
- You do not have permission to edit `.cursor/rules/` — still do the GitHub templates and `docs/agents/issue-tracker.md`.

## Maintenance notes

- After GitHub repo rename, update the contact_links URL path (`mirzacmarius/<new-name>`). Linear's GitHub App follows GitHub renames; verify once.
- Reviewers should reject PRs that re-introduce GitHub issue forms for product work.
- The Cursor automation rename is the highest-leverage dashboard fix; in-repo docs cannot stop bad branch names by themselves.
