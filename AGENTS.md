# `AGENTS.md - Coding Agent Guidelines

Museum/Library collection management SaaS. Turborepo monorepo: Convex backend, Next.js 15 App Router, Bun, Biome.

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

# Testing (from packages/backend/)
bun test                   # Run all tests (vitest)
bun test:once              # Run once without watch
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

## Middleware Note

Non-standard location: `apps/app/src/proxy.ts` (not `middleware.ts`)

## Cursor Cloud specific instructions

### Convex Agent Mode

Cloud agents use `CONVEX_AGENT_MODE=anonymous` which provisions an isolated local Convex deployment. The update script handles `bun install`; agents must start services manually each session:

```bash
# 1. Start Convex backend (creates .env.local with CONVEX_URL automatically)
cd packages/backend && CONVEX_AGENT_MODE=anonymous bunx convex dev --tail-logs &
# Wait for "Convex functions ready!" before starting frontends

# 2. Set frontend env (use the URL from packages/backend/.env.local)
echo "NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210" > apps/app/.env.local
echo "NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210" > apps/web/.env.local

# 3. Start Next.js apps
cd apps/app && bun dev &   # port 3000
cd apps/web && bun dev &   # port 3001
```

### Gotchas

- `convex dev` in agent mode prompts "Set up Convex AI files?" — answer **n** (non-interactive: pipe `echo n` or use `yes n |`).
- The Convex MCP tool requires cloud deployment auth and does **not** work with anonymous local deployments. Use `bunx convex run --url http://127.0.0.1:3210 <function> '<args>'` instead.
- `bun run typecheck` has pre-existing errors in `@v1/analytics` (missing `PostEventPayload` export from `@openpanel/nextjs`) which cascade to `@v1/web` and `@v1/app`. These are not caused by agent changes.
- Backend tests (`cd packages/backend && bun test:once`) run entirely in-memory via `convex-test` and do not require the Convex dev server to be running.
- The `postinstall` script (`node scripts/apply-patches.js`) applies a patch to `@xixixao/uploadstuff`; it runs automatically on `bun install`.
