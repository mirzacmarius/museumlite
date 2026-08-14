# Plan 056: Publish a canonical MuseumLite identity map and stop starter-kit naming in docs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7146e556..HEAD -- docs/agents/platform-identity.md docs/agents/issue-tracker.md README.md AGENTS.md CLAUDE.md .env.example scripts/sync-worktree-env.mjs package.json plans/README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `7146e556`, 2026-08-14

## Why this matters

The product is MuseumLite. The GitHub repo is `mirzacmarius/ml-cursor`. Local clones and scripts use `ml`. npm packages are still `@v1/*` from the Convex starter kit. Vercel lives under team `orvibo` with projects `museumlite` / `museumlite-web`. Linear lives at `linear.app/museumlite` team `MUS`.

Agents and humans currently guess which name is canonical. That guess is already causing wrong Cursor automation titles, leftover GitHub deploy environments, and a README that still tells people they cloned `get-convex/v1`. A single identity doc plus README/AGENTS updates stops that drift without renaming packages or the GitHub repo in this plan.

## Current state

Linear **is connected to this GitHub repo**, not to a repo named `museumlite` or `ml`.

Evidence (live as of 2026-08-14):

- Git remotes and `gh repo view`: `https://github.com/mirzacmarius/ml-cursor` (private, homepage `https://museumlite.com`).
- User `mirzacmarius` has no other MuseumLite GitHub repo (`ml-cursor`, `midday`, `homeassistant-apavital` only).
- Linear GitHub App posts `<!-- linear-linkback -->` comments on PRs in `ml-cursor`, e.g. PR #113 links to `https://linear.app/museumlite/issue/MUS-541/log-in-registration-page`.
- Cursor Cloud environment name: `mirzacmarius/ml-cursor`, repos: `github.com/mirzacmarius/ml-cursor`.
- Codex env file `.codex/environments/environment.toml` has `name = "ml"`.
- Env sync fallback path is `~/Developer/ml` (`scripts/sync-worktree-env.mjs`).
- Vercel GitHub checks on PRs: `Vercel – museumlite` → `https://vercel.com/orvibo/museumlite/...` (rootDir `apps/app`) and `Vercel – museumlite-web` → `https://vercel.com/orvibo/museumlite-web/...`.
- Root `package.json` `"name": "v1"`; workspaces `@v1/app`, `@v1/web`, `@v1/backend`, etc.
- `README.md` still titles the product **Create v1** and links issues to `https://github.com/get-convex/v1/issues`.
- `docs/agents/issue-tracker.md` already says issues live in Linear MUS. There is no `docs/agents/platform-identity.md`. `CONTEXT.md` (mentioned by `docs/agents/domain.md`) does not exist.

Canonical names to document (do not invent a fourth brand):

| Surface | Canonical name | Keep as alias | Do not use for new work |
|---------|----------------|---------------|-------------------------|
| Product / domain | MuseumLite | — | Create v1, Convex v1 |
| Public sites | `museumlite.com`, `app.museumlite.com`, `www.museumlite.com` | — | — |
| Issue tracker | Linear workspace `museumlite`, team `MUS` | — | GitHub Issues |
| Git source | `github.com/mirzacmarius/ml-cursor` | local folder `ml` | a fictional `museumlite` GitHub repo |
| Vercel | team `orvibo`, projects `museumlite` + `museumlite-web` | — | leftover `ml-cursor-web` |
| npm workspaces | keep `@v1/*` until a dedicated rename | — | mixing `@museumlite/*` in one PR |
| Local clone | `~/Developer/ml` | `ML_ENV_SOURCE` | undocumented extra clones as source of truth |
| Cursor Cloud env | follows the GitHub repo name | — | — |
| Codex env | `ml` | — | — |

Relevant files:

- `README.md` — still the Convex v1 starter README (lines 1–16 title/links; clone instructions still `get-convex/v1`).
- `docs/agents/issue-tracker.md` — Linear is source of truth, but does not say which GitHub repo Linear is attached to.
- `AGENTS.md` / `CLAUDE.md` — product is MuseumLite; no identity table.
- `package.json` — `"name": "v1"` and `dev:jobs` filters `@v1/jobs` (that workspace does not exist).
- `scripts/sync-worktree-env.mjs` — fallback `~/Developer/ml`.
- `.github/PULL_REQUEST_TEMPLATE.md` — asks for `MUS-XXX` but not a `linear.app` URL.

Repo conventions: named exports, Biome, docs for agents live under `docs/agents/`. Match the tone of `docs/agents/issue-tracker.md` (short, factual, URLs, no marketing).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Lint | `bun run lint` | exit 0 |
| Format | `bun run format` | exit 0, only in-scope files change if anything |
| Identity grep | `rg -n "Create v1\|get-convex/v1\|github.com/get-convex/v1" README.md AGENTS.md CLAUDE.md docs/agents` | no matches in those files after the edit |
| Jobs script | `rg -n "dev:jobs\|@v1/jobs" package.json` | `dev:jobs` line gone |

Do not run `bun run typecheck` unless you touch TypeScript. This plan is docs + `package.json` script cleanup only.

## Suggested executor toolkit

- Read `docs/agents/issue-tracker.md` before writing the new identity doc; match its structure.
- Do not use Linear MCP for this plan (docs only). Linear MCP is often unauthenticated in Cursor Cloud.

## Scope

**In scope**:

- `docs/agents/platform-identity.md` (create)
- `docs/agents/issue-tracker.md` (add a "GitHub connection" section pointing at `mirzacmarius/ml-cursor`)
- `README.md` (replace starter-kit header and issue links with MuseumLite + this repo; keep the technical Getting Started that is still accurate)
- `AGENTS.md` (add a short identity table near Project Structure)
- `CLAUDE.md` (one-line pointer to `docs/agents/platform-identity.md` in Project Overview)
- `package.json` (remove dead `dev:jobs` script only)
- `plans/README.md` (status row)

**Out of scope**:

- Renaming the GitHub repo (human dashboard; plan 059).
- Renaming npm packages `@v1/*` (large mechanical churn; rejected for this round).
- Changing Vercel project names or Convex deployment names.
- Editing `apps/app/vercel.json` / `apps/web/vercel.json` (plan 057).
- GitHub issue/PR templates (plan 058).
- Rewriting all of `docs/APP-IDEEA.md` Linear MCP examples (mention the wrong `Engineering` / `ACC-123` keys in the identity doc as a known stale example; do not rewrite the whole product plan).

## Git workflow

- Branch: `cursor/056-canonical-platform-identity` (or continue on an existing `cursor/platform-identity-consistency-*` branch if the operator already created one for this batch).
- Commit style from `git log`: `docs(agents): add platform identity map` / `docs: replace Convex v1 README header`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create `docs/agents/platform-identity.md`

Create the file with this content (adjust only if a URL in the table is proven wrong at execution time — do not invent extra brands):

```markdown
# Platform identity

MuseumLite is one product. Names below are aliases of the same system, not separate apps.

## Canonical map

| Surface | Canonical | Notes |
|---------|-----------|-------|
| Product | MuseumLite | User-facing brand |
| Marketing site | https://museumlite.com | `apps/web`, Vercel project `museumlite-web` |
| App | https://app.museumlite.com | `apps/app`, Vercel project `museumlite` |
| Public portal | https://www.museumlite.com | same web app; `getPublicPortalBaseUrl()` |
| Issues | Linear workspace `museumlite`, team `MUS` | https://linear.app/museumlite/team/MUS/active |
| Git | `github.com/mirzacmarius/ml-cursor` | Linear GitHub App is connected **here**. There is no `museumlite` GitHub repo. |
| Vercel team | `orvibo` | Billing/team slug; not a product name |
| Vercel projects | `museumlite` (app), `museumlite-web` (marketing/portal) | Ignore leftover GitHub environment `Production – ml-cursor-web` |
| Convex | one backend in `packages/backend` | Deployed by the **app** Vercel project, not by both (see plan 057) |
| npm workspaces | `@v1/*` | Inherited from Convex `v1` starter; do not mix a second scope |
| Local clone | `~/Developer/ml` | Short folder name. `ML_ENV_SOURCE` points here. |
| Cursor Cloud env | `mirzacmarius/ml-cursor` | Follows the GitHub repo |
| Codex env | `ml` | `.codex/environments/environment.toml` |

## Source of truth by question

- "What should we build?" → Linear MUS issue (`MUS-xxx`), not GitHub Issues.
- "Where is the code?" → `mirzacmarius/ml-cursor`.
- "Where does production run?" → Vercel `orvibo/museumlite` + `orvibo/museumlite-web`, Convex production deployment used by `NEXT_PUBLIC_CONVEX_URL`.
- "Which repo is Linear attached to?" → `mirzacmarius/ml-cursor`. Confirm via `linear[bot]` PR comments (`linear-linkback`).

## Names that are *not* other products

- `ml-cursor` — GitHub repo slug chosen for Cursor Cloud. Same codebase.
- `ml` — local directory / Codex env name. Same codebase.
- `v1` / `@v1/*` — leftover starter-kit package names. Same codebase.
- `orvibo` — Vercel team slug. Same codebase.

## Do not

- File product bugs on GitHub Issues.
- Assume a GitHub repo named `museumlite` or `ml` exists.
- Create a second Convex project "for the web app".
- Rename packages to `@museumlite/*` in drive-by PRs.
```

**Verify**: `test -f docs/agents/platform-identity.md` → file exists; `rg -n "mirzacmarius/ml-cursor" docs/agents/platform-identity.md` → at least one match.

### Step 2: Point issue-tracker + AGENTS + CLAUDE at the map

In `docs/agents/issue-tracker.md`, immediately after the opening sentence, add:

```markdown
Linear's GitHub integration is attached to **`mirzacmarius/ml-cursor`** (this repo).
There is no separate `museumlite` GitHub repository. See `docs/agents/platform-identity.md`.
```

In `AGENTS.md`, after the "Museum/Library collection management SaaS..." paragraph, add a compact table copied from the Canonical map (Git, Linear, Vercel, local `ml` only — four rows).

In `CLAUDE.md` Project Overview, add: `Platform names: see docs/agents/platform-identity.md.`

**Verify**: `rg -n "platform-identity" AGENTS.md CLAUDE.md docs/agents/issue-tracker.md` → three files match.

### Step 3: Replace the README starter-kit identity

Change the `README.md` header (currently "Create v1" and `github.com/get-convex/v1/issues`) to MuseumLite:

- Title: **MuseumLite**
- One sentence: collection management SaaS (museum / gallery / library).
- Issues link: `https://linear.app/museumlite/team/MUS/active` (not GitHub Issues, not get-convex/v1).
- Code link: `https://github.com/mirzacmarius/ml-cursor`.
- Keep the directory structure and Bun/dev commands.
- Keep the worktree `~/Developer/ml` section; add one sentence that `ml` is the local folder alias for this repo.
- Remove or reword "create a new v1 project" CLI instructions so they cannot be read as the way to run MuseumLite. A short "this repo was bootstrapped from Convex v1" note is enough.

Do not delete the Detailed Service Setup section.

**Verify**: `rg -n "Create v1|get-convex/v1" README.md` → no matches.

### Step 4: Remove the dead `dev:jobs` script

In root `package.json`, delete the `"dev:jobs": "turbo jobs --filter=@v1/jobs"` line. There is no `apps/jobs` workspace and no `@v1/jobs` package.

Leave other `@v1/*` filters (`dev:app`, `dev:web`) unchanged.

**Verify**: `rg -n "@v1/jobs" package.json` → no matches. `bun run lint` → exit 0.

### Step 5: Update the plans index

Set plan 056 to DONE (or IN PROGRESS if you only finished some steps) in `plans/README.md`.

**Verify**: `rg -n "056" plans/README.md` → status row updated.

## Test plan

- No new automated tests. This is docs + a dead script removal.
- Manual: open `docs/agents/platform-identity.md` and confirm every URL in the table is the live URL, not a guess.
- Regression: `bun run lint` still passes (sherif may notice `package.json` script removal; that is expected and should be clean).

## Done criteria

- [ ] `docs/agents/platform-identity.md` exists and states Linear is attached to `mirzacmarius/ml-cursor`
- [ ] `README.md` does not mention Create v1 or get-convex/v1
- [ ] `AGENTS.md` and `docs/agents/issue-tracker.md` point at the identity doc
- [ ] `package.json` has no `dev:jobs` / `@v1/jobs`
- [ ] `bun run lint` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The Git remote is no longer `mirzacmarius/ml-cursor` (repo may have been renamed; update the identity doc to the new name instead of restoring `ml-cursor`).
- `bun run lint` fails for reasons unrelated to the `dev:jobs` deletion.
- You think you need to rename `@v1/*` packages to make the docs true — you do not; document the leftover instead.

## Maintenance notes

- After a GitHub repo rename, update this identity doc in the same PR that updates clone URLs.
- After a Vercel team rename, update the `orvibo` row.
- Reviewers should reject any new doc that treats `ml-cursor`, `ml`, and MuseumLite as different products.
- Package-scope rename `@v1` → `@museumlite` is a separate, large PR and must not sneak in here.
