# Development environment

## Commands

```bash
# Development
bun dev                    # All apps + Convex backend in parallel
bun dev:app                # Main app only (port 3000)
bun dev:web                # Marketing site only

# Quality checks
bun run lint               # Biome lint + sherif monorepo check + turbo boundaries
bun run typecheck          # TypeScript check all workspaces
bun run --cwd packages/backend typecheck # Standalone Convex backend compilation
bun run format             # Biome format (writes files)

# Testing
bun run test               # Run all workspace tests (app + backend)

# Testing (from packages/backend/)
bun test                   # Run backend tests once (finite vitest run)
bun test:watch             # Run backend tests in watch mode
bun test:once              # Placeholder guard, then vitest run
bun test loans.test.ts     # Run single test file
bun test -t "approve"      # Run tests matching pattern

# Utilities
bunx knip                  # Find unused exports/dependencies
```

## Project structure

```
apps/app/                  # Main product (dashboard, collections, loans)
apps/web/                  # Marketing site
packages/backend/convex/   # Convex functions, schema, HTTP endpoints
packages/ui/               # Shared shadcn/ui components
packages/email/            # React Email templates
```

## Services

| Service | Port | Start command | Notes |
| --- | --- | --- | --- |
| Main app (Next.js) | 3000 | `bun dev:app` | Redirects to `/login` without auth |
| Marketing site (Next.js) | 3001 | `bun dev:web` | Static marketing pages |
| Convex backend | N/A (cloud) | `cd packages/backend && bun dev` | Requires Convex auth |

In production only the app's Vercel build (`apps/app/vercel.json`) runs `convex deploy`. The marketing site's production build reads `NEXT_PUBLIC_CONVEX_URL` from its Vercel project, so a marketing deploy that succeeds while the app deploy is rejected (for example by the account's daily deployment limit) cannot leave the backend ahead of the app. The marketing site deploys from `main` only (`git.deploymentEnabled` in `apps/web/vercel.json`): branch previews used up the daily deployment limit, which the Vercel team shares with CoinsLite. A preview can still be made by hand with `vercel deploy` in `apps/web`.

Running `bun dev` at root starts `convex dev --tail-logs` against the cloud deployment. Without Convex auth, Next.js starts but cannot fetch data. Agents do not run it: they use `scripts/local-qa/README.md` for an isolated loopback backend and `bun run convex:local -- <args>` for Convex CLI commands. A bare `convex` command reads `packages/backend/.env.local`, which points at the cloud.

## Environment files

- `apps/app/.env` needs `NEXT_PUBLIC_CONVEX_URL` (required). `SKIP_ENV_VALIDATION=1` bypasses t3-env validation in dev when other vars are missing.
- `apps/web/.env` needs `NEXT_PUBLIC_CONVEX_URL`.
- These files are gitignored.

## Checks without Convex cloud

- `bun run lint`
- `bun run typecheck`
- `bun run test` (uses `convex-test`; no cloud)

`bun run check` runs everything CI runs except build and loopback deploy: lint (Biome check including formatting and import order, sherif, `turbo boundaries` (every imported package is declared in that workspace's `package.json`; deliberate exceptions carry a `// @boundaries-ignore <reason>` comment), no bare `TODO`/`FIXME`, runtime-breaking call patterns from `scripts/check-patterns.mjs`), react-doctor, typecheck including i18n (`typecheck:all`), workspace tests, and CI-policy tests (`test:ci-policy`). CI is the source of truth; if it gains a step that needs no backend, add it to the `check` script. Mark intentional follow-up work as `TODO(MUS-123)` instead of a bare `TODO`.

CI (`.github/workflows/check.yml`, check name `check`) runs on every pull request and every push to `main`, and can be dispatched by hand with `gh workflow run check.yml --ref <branch>` (dispatch checks every workspace). It uses one runner and installs dependencies once. Pull requests and pushes run each Turbo task with `--affected`, so only workspaces with changed files, and the workspaces that depend on them, are checked; changes to a `globalDependencies` file in `turbo.json` affect every workspace. Changes outside any workspace (docs, CI configuration, other root scripts) run only the repository guards. The loopback Convex deploy runs when `@v1/backend` is affected, and always on `main` pushes and manual runs. With the `TURBO_TOKEN` secret and `TURBO_TEAM` variable set, CI uses Vercel Remote Cache: pull requests read it and `main` writes it. On a developer machine, `npx turbo login` and `npx turbo link` connect the same cache. Superseded PR runs are cancelled; main-push runs are not.

Vercel builds use the same Remote Cache automatically when the Vercel project and the cache share a team. The app build hash leaves out `VERCEL_URL`, which changes on every deployment, so an unchanged app restores its `.next` output instead of rebuilding (`apps/web/turbo.json` keeps it for the marketing site, which can fall back to it for its canonical URL). `apps/app/vercel.json` runs `turbo-ignore` as the ignored build step, so commits that do not affect `@v1/app` or its workspace dependencies (for example docs or `.claude/` changes) skip the app deploy entirely.

The runner restores `.turbo` for lint, types, tests, and builds. Test and build hashes include upstream workspace source, shared configuration, dependency patches, environment files, and declared runtime variables. `bun run test:ci-policy` exercises the installed Turbo cache to verify invalidation.

When `@v1/backend` is affected, CI pushes `packages/backend/convex` to an isolated loopback backend, runs `bun run qa:seed`, and fails if `_generated` is stale. This is a throwaway local backend, not a Vercel or Convex cloud deployment. These steps always execute when selected and are never cached. Reproduce them with the commands in `scripts/local-qa/README.md`.

## Worktrees and agent runs

- The user reviews work on `localhost:3000`, served from the main checkout. Stack follow-up tweaks on the branch already checked out there, and do unrelated work in a separate git worktree; switching branches in the main checkout changes what the user is looking at.
- A new or stale git worktree needs `bun run worktree:setup` (syncs env files, runs `bun install --frozen-lockfile`, verifies declared dependencies). Run it after creating a worktree and after merging a branch that changed `package.json` or `bun.lock`. `bun run worktree:check` verifies without installing; a `Cannot find module` error for a declared dependency means this was skipped.
- Package scripts that touch the linked Convex cloud deployment (`dev`, `codegen`, `setup`, `seed` in `packages/backend`) refuse to run under a coding agent unless `ALLOW_CONVEX_CLOUD=1` is set, which requires explicit user authorization. Running `convex` directly bypasses this guard; the rule in `packages/backend/convex/AGENTS.md` still applies.
- After merging branches, regenerate `packages/backend/convex/_generated` with `bun run codegen:local` (against the loopback backend from `bun run qa:backend`) instead of hand-merging `_generated/api.d.ts`.
- Production Convex logs and function insights are readable through the Convex MCP plugin tools `logs` and `insights`. Use them read-only to confirm production-only failures; never mutate production from the plugin.

## Gotchas

- `postinstall` runs `node scripts/apply-patches.js` for `@xixixao/uploadstuff` / React 19.
- `@v1/app` typecheck may need `--max-old-space-size=8192`.
- Backend tests live under `packages/backend/tests/` and `packages/backend/convex/`.
