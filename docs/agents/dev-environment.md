# Development environment

## Commands

```bash
# Development
bun dev                    # All apps + Convex backend in parallel
bun dev:app                # Main app only (port 3000)
bun dev:web                # Marketing site only

# Quality checks
bun run lint               # Biome lint + sherif monorepo check
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

Running `bun dev` at root starts `convex dev --tail-logs` against the cloud deployment. Without Convex auth, Next.js starts but cannot fetch data.

## Environment files

- `apps/app/.env` needs `NEXT_PUBLIC_CONVEX_URL` (required). `SKIP_ENV_VALIDATION=1` bypasses t3-env validation in dev when other vars are missing.
- `apps/web/.env` needs `NEXT_PUBLIC_CONVEX_URL`.
- These files are gitignored.

## Checks without Convex cloud

- `bun run lint`
- `bun run typecheck`
- `bun run test` (uses `convex-test`; no cloud)

## Gotchas

- `postinstall` runs `node scripts/apply-patches.js` for `@xixixao/uploadstuff` / React 19.
- `@v1/app` typecheck may need `--max-old-space-size=8192`.
- Backend tests live under `packages/backend/tests/` and `packages/backend/convex/`.
