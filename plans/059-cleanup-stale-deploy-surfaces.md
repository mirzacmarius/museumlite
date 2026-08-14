# Plan 059: Clean leftover Vercel/GitHub deploy names and decide the GitHub slug

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7146e556..HEAD -- docs/agents/platform-identity.md AGENTS.md plans/README.md`
> If those docs changed, update URLs in this runbook to match; do not recreate a second identity doc.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED
- **Depends on**: plans/056-canonical-platform-identity.md (so the runbook is not fighting the identity map)
- **Category**: dx
- **Planned at**: commit `7146e556`, 2026-08-14

## Why this matters

GitHub Environments on `mirzacmarius/ml-cursor` still list seven Vercel-created names, including leftovers from the first import:

| GitHub environment | Likely Vercel project | Status |
|--------------------|----------------------|--------|
| Preview | original repo-named project | leftover |
| Production | original repo-named project | leftover |
| Production – ml-cursor-web | old web project | leftover |
| Preview – museumlite | current app | keep |
| Production – museumlite | current app | keep |
| Preview – museumlite-web | current web | keep |
| Production – museumlite-web | current web | keep |

Live PR checks only report `Vercel – museumlite` and `Vercel – museumlite-web` under team `orvibo`. The extra environments confuse "which production is real?"

Separately, 83 remote branches exist; ~72 are `advisor/` or `cursor/` agent leftovers. That slows PR search and confuses Linear's GitHub attachment.

This plan is a **human runbook**. The executor writes the checklist into `docs/agents/platform-identity.md` (or creates a short `docs/agents/deploy-surfaces.md` if 056 has not landed) and does **not** delete production Vercel projects or force-push.

## Current state

Evidence collected 2026-08-14 with read-only `gh`:

```text
gh api repos/mirzacmarius/ml-cursor/environments
# names: Preview, Preview – museumlite, Preview – museumlite-web,
#         Production, Production – ml-cursor-web, Production – museumlite,
#         Production – museumlite-web
```

```text
gh pr checks 113
# Vercel – museumlite     https://vercel.com/orvibo/museumlite/...
# Vercel – museumlite-web https://vercel.com/orvibo/museumlite-web/...
```

Recommended GitHub slug (operator decision, default this unless they already renamed):

- Keep git history.
- Rename `mirzacmarius/ml-cursor` → `mirzacmarius/museumlite` **or** move to a `museumlite` GitHub org as `museumlite/museumlite`.
- Do **not** create a second empty `museumlite` repo and point Linear at it — Linear is already attached to this repo.
- Keep local folder `~/Developer/ml` as the short alias (already in `scripts/sync-worktree-env.mjs`).

Do not rename `@v1/*` packages in this plan.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| List GitHub environments | `gh api repos/mirzacmarius/ml-cursor/environments --jq '.environments[].name'` | prints the seven names (or fewer after cleanup) |
| List Vercel checks on a recent PR | `gh pr checks <n> --repo mirzacmarius/ml-cursor` | only `museumlite` and `museumlite-web` Vercel checks |
| Count agent branches | `git ls-remote --heads origin \| rg -c 'refs/heads/(advisor\|cursor)/'` | number; after optional cleanup, lower |
| Lint | `bun run lint` | exit 0 |

The executor **must not** run `gh api -X DELETE` on environments, `vercel rm`, or `git push --delete` unless the operator explicitly said to perform the dashboard cleanup in this session.

## Suggested executor toolkit

- GitHub rename: https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository (redirects old URLs; update Linear/Vercel/Cursor if they do not follow)
- Vercel project delete: dashboard → project → Settings → Advanced → Delete
- Identity map from plan 056

## Scope

**In scope**:

- `docs/agents/platform-identity.md` **or** `docs/agents/deploy-surfaces.md` if the identity file does not exist yet — add a "Deploy surfaces cleanup" section with the tables above and operator checkboxes
- `AGENTS.md` — one line pointing at that section
- `plans/README.md`

**Out of scope**:

- Actually renaming the GitHub repo unless the operator's instruction for *this execution* is "do the rename now".
- Deleting Vercel projects without operator confirmation.
- Mass-deleting remote branches without a list approved in the PR.
- Package rename `@v1/*`.
- Changing Convex project names in the Convex dashboard (unknown from this audit; do not guess).

## Git workflow

- Branch: `cursor/059-deploy-surface-cleanup` (or the batch identity branch).
- Commit message style: `docs(agents): record Vercel and GitHub leftover deploy names`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Record the leftover surfaces in-repo

Add this section to `docs/agents/platform-identity.md` (create the file from plan 056 first if missing):

```markdown
## Deploy surfaces (cleanup)

Active:

- GitHub: `mirzacmarius/ml-cursor` (Linear connected here)
- Vercel team `orvibo`: project `museumlite` (app), `museumlite-web` (marketing/portal)
- Convex: single backend, deployed from Vercel project `museumlite` only

Leftover GitHub Environments (safe to delete in GitHub Settings → Environments after confirming no protection rules):

- `Preview`
- `Production`
- `Production – ml-cursor-web`

Leftover Vercel (delete in Vercel dashboard only after the two `museumlite*` projects are confirmed serving production domains):

- any project named `ml-cursor-web` or a project that still maps to GitHub environment `Production – ml-cursor-web`

GitHub slug decision (pick one, then update this doc):

1. Keep `ml-cursor` forever and treat it as an implementation detail (document only).
2. Rename to `mirzacmarius/museumlite` (recommended if staying on a personal account).
3. Transfer to org `museumlite/museumlite` (recommended if adding collaborators later).

After a rename: Vercel Git integration, Linear GitHub App, Cursor Cloud environment, and git remotes all need a check. GitHub redirects the old clone URL.
```

**Verify**: `rg -n "ml-cursor-web" docs/agents/platform-identity.md` → match.

### Step 2: Operator runbook in the PR body (do not execute)

```markdown
### Vercel
- [ ] Confirm production domains: app → `museumlite`, web/portal → `museumlite-web`
- [ ] Delete leftover Vercel project that created GitHub env `Production – ml-cursor-web` if it still exists
- [ ] Confirm no third Vercel project is still building this repo

### GitHub
- [ ] Delete unused Environments: `Preview`, `Production`, `Production – ml-cursor-web`
- [ ] Decide repo slug (keep / rename to museumlite / move to org)
- [ ] If renaming: update Cursor Cloud environment, Vercel git connection, Linear GitHub integration
- [ ] Disable GitHub Issues (plan 058)

### Branches
- [ ] Close stale agent PRs
- [ ] Delete merged `advisor/*` and old `cursor/*` branches in batches (do not delete branches with open PRs: #106, #107, #112, #113 as of 2026-08-14)

### Convex
- [ ] In Convex dashboard, note the production deployment name in this doc (do not paste deploy keys)
- [ ] Confirm only one production deployment is used by both `NEXT_PUBLIC_CONVEX_URL` values in Vercel
```

**Verify**: PR body contains the four subsections.

### Step 3: Optional — list stale branches for the operator

Run `git ls-remote --heads origin` and write a bullet list of `advisor/*` branches that have no open PR (`gh pr list --state open --json headRefName`). Put the list in the PR body, not in the identity doc (it will rot).

Do not `git push origin --delete`.

**Verify**: `gh pr list --repo mirzacmarius/ml-cursor --state open --json number,headRefName` → list matches what you claimed still must be kept.

### Step 4: Lint + index

`bun run lint`. Mark 059 DONE for the *documentation* part. If the operator also completed dashboard cleanup, say so in the plans index note; otherwise leave a "dashboard remaining" note.

**Verify**: lint exit 0. `plans/README.md` row 059 updated.

## Test plan

- No application tests.
- After dashboard cleanup: `gh api repos/mirzacmarius/ml-cursor/environments --jq '.environments[].name'` should only show museumlite / museumlite-web preview+production (four names) or the post-rename equivalents.
- `gh pr checks` on a new PR should not mention `ml-cursor-web`.

## Done criteria

- [ ] Identity/deploy doc lists leftover GitHub environment names and the keep vs delete rule
- [ ] PR body has the operator runbook
- [ ] Open PR branches are listed as do-not-delete
- [ ] `bun run lint` exits 0
- [ ] No production Vercel/GitHub/Convex resources were deleted by the executor
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- A GitHub environment has protection rules (`protection_rules` non-empty). The 2026-08-14 dump showed empty rules; if that changed, do not delete.
- Production domains are still attached to `ml-cursor-web` — then that project is not leftover; update the identity map instead of deleting.
- The operator asks to rename the GitHub repo in the same breath as deleting environments — do rename first, then cleanup, and update every URL in `docs/agents/platform-identity.md` in the same PR.

## Maintenance notes

- New Vercel projects auto-create GitHub Environments named `Preview – <project>` / `Production – <project>`. After adding a project, update the identity doc.
- Reviewers should not require the executor to have deleted cloud resources. The plan is done when the runbook is accurate.
- Reject `@v1` package rename bundled into this cleanup.
