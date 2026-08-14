# Plan 057: Deploy Convex from the app Vercel project only

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7146e556..HEAD -- apps/app/vercel.json apps/web/vercel.json AGENTS.md docs/agents/platform-identity.md plans/README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: none (can land before or after 056; if 056 already added `docs/agents/platform-identity.md`, add one sentence there about Convex deploy ownership)
- **Category**: dx
- **Planned at**: commit `7146e556`, 2026-08-14

## Why this matters

This monorepo has two Vercel projects on the same GitHub repo: `orvibo/museumlite` (`apps/app`) and `orvibo/museumlite-web` (`apps/web`). Both `vercel.json` files run `npx convex deploy` as the build command.

Every marketing-site preview or production deploy can therefore push Convex functions. Concurrent app + web deploys race on the same Convex deployment. Preview builds can also push backend changes that production should own. Convex should be deployed once, from the app project that already holds `CONVEX_DEPLOY_KEY` for the product backend.

## Current state

`apps/app/vercel.json` today:

```json
{
  "buildCommand": "cd ../../packages/backend && npx convex deploy --cmd 'export NEXT_DISABLE_TYPECHECK=1 && cd ../../apps/app && turbo run build' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL"
}
```

`apps/web/vercel.json` today:

```json
{
  "buildCommand": "cd ../../packages/backend && npx convex deploy --cmd 'cd ../../apps/web && turbo run build' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL"
}
```

Vercel GitHub checks on PR #113 (2026-08):

- `Vercel – museumlite` → `https://vercel.com/orvibo/museumlite/...` (inspector comments show `rootDirectory: apps/app`)
- `Vercel – museumlite-web` → `https://vercel.com/orvibo/museumlite-web/...`

GitHub repo environments still list leftovers: `Preview`, `Production`, `Production – ml-cursor-web`, plus the current `museumlite` / `museumlite-web` preview and production names. Do not delete GitHub environments in this plan (plan 059).

CI (`.github/workflows/check.yml`) already builds with a placeholder `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud` and does **not** run `convex deploy`. Keep it that way.

`AGENTS.md` Cursor Cloud notes say Convex is cloud-hosted and `bun dev` runs `convex dev --tail-logs`. That is local/dev, not Vercel production deploy.

Repo conventions: keep `vercel.json` as a small JSON file next to each Next app. Do not add a root `vercel.json`. Match the app project's existing `--cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL` pattern for the app only.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| JSON sanity | `python3 -m json.tool apps/web/vercel.json` | prints valid JSON, exit 0 |
| JSON sanity | `python3 -m json.tool apps/app/vercel.json` | prints valid JSON, exit 0; still contains `convex deploy` |
| Web must not deploy Convex | `rg -n "convex deploy" apps/web/vercel.json` | no matches |
| App still deploys Convex | `rg -n "convex deploy" apps/app/vercel.json` | one match |
| Lint | `bun run lint` | exit 0 |

## Suggested executor toolkit

- Convex production deploy docs: https://docs.convex.dev/production/hosting/vercel
- Rule of thumb from this repo: **only `apps/app` may call `npx convex deploy`**.

## Scope

**In scope**:

- `apps/web/vercel.json`
- `apps/app/vercel.json` (only if a comment/field is required to keep behavior; prefer no change)
- `docs/agents/platform-identity.md` if it already exists from plan 056 (one sentence: web Vercel project must not run `convex deploy`)
- `AGENTS.md` Cursor Cloud / deployment notes: one sentence that production Convex deploy is owned by Vercel project `museumlite` (`apps/app`)
- `plans/README.md`

**Out of scope**:

- Changing Vercel dashboard settings (root directory, env vars) except documenting what a human must verify after merge.
- Adding `CONVEX_DEPLOY_KEY` to GitHub Actions.
- Renaming Vercel projects or deleting `ml-cursor-web`.
- Switching production Convex to `convex deploy` from CI instead of Vercel.
- Preview Convex deployments (`CONVEX_DEPLOY_KEY` preview vs production). If you discover the web project has a *different* deploy key pointing at a second Convex project, STOP — that is a split-brain backend, not a one-line JSON fix.

## Git workflow

- Branch: `cursor/057-stop-dual-convex-deploy` (or the batch identity branch).
- Commit message style: `fix(web): stop convex deploy from marketing Vercel project`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm the web project does not need Convex codegen at build

`apps/web` imports `@v1/backend/convex/_generated/api` (for example `apps/web/src/app/sitemap.ts`). Generated API files are committed under `packages/backend/convex/_generated/`. Building the web app needs `NEXT_PUBLIC_CONVEX_URL` in the environment; it does **not** need to push functions.

**Verify**: `rg -n "from \"@v1/backend" apps/web/src | head` → imports exist; `test -f packages/backend/convex/_generated/api.d.ts` → file exists in git.

If `_generated` is missing from git at execution time, STOP. Do not "fix" that by keeping `convex deploy` on the web project.

### Step 2: Change `apps/web/vercel.json` to a Next build only

Replace the file contents with:

```json
{
  "buildCommand": "cd ../.. && bunx turbo run build --filter=@v1/web"
}
```

Rationale: the web app already has `NEXT_PUBLIC_CONVEX_URL` from Vercel env. Turbo build from the monorepo root matches `apps/web/package.json` `"build": "next build"`. Using `bunx turbo` matches the rest of the repo (Bun, not npm).

Do **not** keep `npx convex deploy` on this project.

Leave `apps/app/vercel.json` unchanged unless the drift check shows it was already edited.

**Verify**: `python3 -m json.tool apps/web/vercel.json` → exit 0. `rg -n "convex deploy" apps/web/vercel.json` → no matches. `rg -n "convex deploy" apps/app/vercel.json` → still present.

### Step 3: Document deploy ownership

If `docs/agents/platform-identity.md` exists, add under Convex:

```markdown
Production/preview **function deploys** run only from Vercel project `museumlite` (`apps/app/vercel.json`).
`museumlite-web` builds against `NEXT_PUBLIC_CONVEX_URL` and must not call `npx convex deploy`.
```

In `AGENTS.md` Cursor Cloud specific instructions, add one bullet under Gotchas:

```markdown
- Only the `museumlite` Vercel project (`apps/app`) should run `npx convex deploy`. The `museumlite-web` project builds the marketing/portal app only.
```

**Verify**: `rg -n "convex deploy" AGENTS.md docs/agents/platform-identity.md` → the warning exists in at least one of those files.

### Step 4: Human verification note (do not perform dashboard writes)

In the PR body, include this checklist for the operator (do not try to click Vercel yourself unless the operator asked):

- [ ] Vercel project `museumlite-web` → Settings → General → Root Directory is `apps/web`
- [ ] `museumlite-web` has `NEXT_PUBLIC_CONVEX_URL` (production + preview) and does **not** need `CONVEX_DEPLOY_KEY`
- [ ] Vercel project `museumlite` → Root Directory `apps/app`, has `CONVEX_DEPLOY_KEY` for the production Convex deployment
- [ ] After merge to `main`, one production deploy of `museumlite` succeeds and `museumlite-web` succeeds without a Convex CLI login/deploy error

**Verify**: PR body or commit message contains the four dashboard checks. No Vercel API mutations from the executor.

### Step 5: Lint + index

Run `bun run lint`. Update `plans/README.md` row 057.

**Verify**: lint exit 0.

## Test plan

- No backend tests. Convex behavior is unchanged; only *who* deploys it changes.
- After merge, operator confirms Vercel `museumlite-web` build logs show `turbo run build --filter=@v1/web` and do not show `convex deploy`.
- Operator confirms `museumlite` production deploy still runs `convex deploy` then the app build.
- Pattern: none; this is config.

## Done criteria

- [ ] `apps/web/vercel.json` has no `convex deploy`
- [ ] `apps/app/vercel.json` still has `convex deploy`
- [ ] `python3 -m json.tool` succeeds on both JSON files
- [ ] AGENTS or platform-identity doc states app-only Convex deploy
- [ ] `bun run lint` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `packages/backend/convex/_generated/` is not in git (web build would break without Convex codegen).
- The web Vercel project is the only project with `CONVEX_DEPLOY_KEY` (then removing deploy from web would stop all production Convex deploys). Check by reading Vercel build logs on a recent `main` deploy of both projects if you have `gh` check-run URLs; if you cannot tell, say so in the PR and keep the web `convex deploy` until a human confirms.
- `apps/web` build currently relies on `convex deploy --cmd-url-env-var-name` to *inject* `NEXT_PUBLIC_CONVEX_URL`. If Vercel env does not already set that variable on `museumlite-web`, adding it is a dashboard step — document it, do not copy secrets.
- You are tempted to add `npx convex deploy` to GitHub Actions in this plan — that is a different architecture.

## Maintenance notes

- New Vercel projects attached to this repo must not get a copy-pasted `convex deploy` build command.
- Preview Convex (per-PR backends) if added later should be owned by the app project only.
- Reviewers: the risk is accidentally leaving production with no Convex deploy. Confirm `museumlite` still deploys Convex before merging if the last `main` web deploy was the one that actually pushed functions.
