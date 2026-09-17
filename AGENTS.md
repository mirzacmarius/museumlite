Scope note: the Next.js block below covers UI and routing only. All data, auth, storage, and scheduled work stays in Convex per the rules in this file.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This project runs Next.js 16.2, and its APIs, conventions, and file structure differ from your training data. Before any Next.js UI or routing work, find and read the relevant doc in `node_modules/next/dist/docs/` (resolved from the repository root). Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# `AGENTS.md - Coding Agent Guidelines

Museum/Library collection management SaaS. Turborepo monorepo: Convex backend, Next.js 16 App Router, Bun, Biome.

## Philosophy

This codebase will outlive you. Every shortcut becomes someone else's burden. Every hack compounds into technical debt that slows the whole team down.

You are not just writing code. You are shaping the future of this project. The patterns you establish will be copied. The corners you cut will be cut again.

Fight entropy. Leave the codebase better than you found it.

## Commands

```bash
# Development
bun dev                    # All apps + Convex backend in parallel
bun dev:app                # Main app only (port 3000)
bun dev:web                # Marketing site only

# Quality checks
bun run lint               # Biome lint + sherif monorepo check
bun run typecheck          # TypeScript check all workspaces
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
gh pr create               # GitHub CLI is available
```

## Project Structure

```
apps/app/                  # Main product (dashboard, collections, loans)
apps/web/                  # Marketing site
packages/backend/convex/   # Convex functions, schema, HTTP endpoints
packages/ui/               # Shared shadcn/ui components
packages/email/            # React Email templates
```

## Code Style

### TypeScript

- `strict: true` + `noUncheckedIndexedAccess: true` enabled
- **Never** cast to `any` or use `@ts-ignore`
- Use `Id<'tableName'>` for Convex IDs, not `string`
- Prefer interfaces over types; use union types instead of enums
- Don't wrap in unnecessary `try/catch`

### Naming

- Directories: lowercase with dashes (`components/auth-wizard`)
- Variables: descriptive with auxiliaries (`isLoading`, `hasError`)
- Named exports only (no default exports except pages)

### Imports (Biome auto-organizes)

```typescript
// External packages first, then internal
import { query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
```

### React/Next.js

- RSC-first: minimize `"use client"`, `useEffect`, `useState`
- Compose smaller components; avoid massive JSX blocks
- URL state via `nuqs` for search params
- Wrap client components in `Suspense` with fallback

### Styling

- Tailwind v4 + shadcn/ui dark theme
- Use `border-white/10` for subtle borders
- Timestamps: right-aligned, `text-white/60`, relative format

## Convex Functions (CRITICAL)

**Always use this syntax:**

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const myFunction = query({
  args: { id: v.id("items") },
  returns: v.object({ title: v.string() }),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    return { title: doc?.title ?? "" };
  },
});
```

### Convex Rules

- **Always** include `args` and `returns` validators
- Return `null` with `returns: v.null()` when no return value
- Use `.withIndex()` not `.filter()` for queries (performance)
- Actions: add `"use node";` at top; no `ctx.db` access (use `ctx.runQuery`)
- Use `v.int64()` not `v.bigint()` (deprecated)
- Query `_storage` system table, not `ctx.storage.getMetadata` (deprecated)

### Function Types


| Type                                                | Usage      | Reference                |
| --------------------------------------------------- | ---------- | ------------------------ |
| `query`/`mutation`/`action`                         | Public API | `api.file.function`      |
| `internalQuery`/`internalMutation`/`internalAction` | Private    | `internal.file.function` |


## Anti-Patterns


| Don't                         | Do Instead                       |
| ----------------------------- | -------------------------------- |
| `.filter()` in queries        | `.withIndex()` with schema index |
| `ctx.db` in actions           | `ctx.runQuery`/`ctx.runMutation` |
| `v.bigint()`                  | `v.int64()`                      |
| `as any`, `@ts-ignore`        | Proper typing                    |
| `useEffect` for data fetching | Fetch in RSC                     |
| `crons.hourly()`              | `crons.interval({ hours: 1 })`   |
| Missing return validator      | `returns: v.null()` minimum      |


## Testing

Tests use `convex-test` with edge-runtime. Location: `packages/backend/convex/*.test.ts`

```typescript
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

test("should create and retrieve item", async () => {
  const t = convexTest(schema);
  const id = await t.mutation(api.items.create, { title: "Test" });
  const item = await t.query(api.items.get, { id });
  expect(item?.title).toBe("Test");
});
```

## File Locations


| Task                | Location                                 |
| ------------------- | ---------------------------------------- |
| Add Convex function | `packages/backend/convex/`               |
| Add UI component    | `packages/ui/src/components/`            |
| Add dashboard page  | `apps/app/src/app/[locale]/(dashboard)/` |
| Add HTTP endpoint   | `packages/backend/convex/http.ts`        |
| Add locale          | `apps/app/src/locales/` (en, fr, es)     |


## Schema Conventions

- Index names include all fields: `by_organization_and_status`
- Use discriminated unions with `v.literal()`:

```typescript
status: v.union(v.literal("pending"), v.literal("active"))
```

## Error Handling

- Use early returns and guard clauses
- Validate entity existence before operations
- Model expected errors as return values, not exceptions
- Use Zod for form validation in frontend

## Design System

- Background: black, text: white
- Borders: `border-white/10`
- Icons: lucide-react, `h-4 w-4`
- Activity format: "You [action] [entity] [identifier]"

## Proxy Note

Next.js 16 standard location: `apps/app/src/proxy.ts` (the framework renamed `middleware.ts` to `proxy.ts`; do not create `middleware.ts`).

## Cursor Cloud specific instructions

### Services overview

| Service | Port | Start command | Notes |
|---------|------|--------------|-------|
| Main app (Next.js) | 3000 | `bun dev:app` | Redirects to `/login` without auth |
| Marketing site (Next.js) | 3001 | `bun dev:web` | Static marketing pages |
| Convex backend | N/A (cloud) | `cd packages/backend && bun dev` | Requires Convex auth — see below |

### Convex backend (cloud-hosted)

The Convex backend runs in the cloud, not locally. Running `bun dev` at root starts `convex dev --tail-logs` which syncs local functions to the Convex cloud deployment. This requires Convex authentication — the `CONVEX_DEPLOY_KEY` or interactive `npx convex dev` login must be configured. Without Convex auth, the Next.js apps will start but cannot fetch data.

### Environment files

- `apps/app/.env` needs `NEXT_PUBLIC_CONVEX_URL` (required) and `SKIP_ENV_VALIDATION=1` to bypass t3-env validation in dev when other env vars are missing.
- `apps/web/.env` needs `NEXT_PUBLIC_CONVEX_URL`.
- These `.env` files are gitignored and must be created per-environment.

### Running quality checks without Convex

Lint, typecheck, and tests all work without Convex authentication:
- `bun run lint` — Biome lint + sherif monorepo check
- `bun run typecheck` — TypeScript checking across all workspaces
- `bun run test` — app + backend Vitest suites using `convex-test` (no cloud needed)

### Gotchas

- The `postinstall` script runs `node scripts/apply-patches.js` to patch `@xixixao/uploadstuff` for React 19 compatibility. This runs automatically on `bun install`.
- `bun run typecheck` for `@v1/app` uses `--max-old-space-size=8192` — it can be memory-intensive.
- Backend tests are in both `packages/backend/tests/` and `packages/backend/convex/` directories.

## Linear handoff

When finishing work delegated from a MUS Linear issue: post a **Review checklist** on the issue (grouped `- [ ]` QA steps with navigation paths and expected UI — canonical example: `MUS-485`), plus PR link and branch; set status to **In Review**; do **not** mark **Done**. See `.cursor/rules/linear-delegation-handoff.mdc` and `docs/agents/issue-tracker.md`.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
