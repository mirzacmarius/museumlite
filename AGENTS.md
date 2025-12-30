# PROJECT KNOWLEDGE BASE

**Generated:** 2025-12-30
**Commit:** fb9c3a1
**Branch:** main

## OVERVIEW

Museum/Library collection management SaaS ("MuseumLite"). Turborepo monorepo with Convex backend, Next.js 16 App Router, Bun package manager, Biome linting.

## STRUCTURE

```
v1/
├── apps/
│   ├── app/              # Main product (dashboard, collections, loans, library)
│   └── web/              # Marketing site
├── packages/
│   ├── backend/          # Convex (API, Auth, DB, Storage, Jobs)
│   │   └── convex/       # All Convex functions, schema, HTTP endpoints
│   ├── ui/               # Shared shadcn/ui components
│   ├── email/            # React Email templates
│   ├── analytics/        # OpenPanel integration
│   └── logger/           # Logging utilities
├── tooling/typescript/   # Shared TS configs
├── turbo.json            # Turborepo config
└── biome.json            # Linter/formatter config
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add Convex query/mutation | `packages/backend/convex/` | Use new function syntax with validators |
| Add UI component | `packages/ui/src/components/` | Export via package.json |
| Add dashboard page | `apps/app/src/app/[locale]/(dashboard)/` | Route groups: `(dashboard)`, `(public)` |
| Add API endpoint | `packages/backend/convex/http.ts` | No Next.js API routes - use Convex HTTP actions |
| Library integration | `packages/backend/convex/library/` | Patrons, circulation, holds, fines |
| Add locale | `apps/app/src/locales/` | Support: en, fr, es |

## RULES REFERENCE

Detailed coding rules in `.cursor/rules/`:
- **`coding_rules.mdc`**: React, Tailwind, Next.js, TypeScript conventions
- **`convex_rules.mdc`**: Convex function syntax, validators, schema design, full examples

**Always consult these files for implementation details.**

## CONVENTIONS

### General
- Only create abstractions when actually needed
- Prefer clear function/variable names over inline comments
- Avoid helper functions when simple inline expression suffices
- Don't use emojis in code or commits

### TypeScript
- `strict: true` + `noUncheckedIndexedAccess: true` enabled
- Never cast to `any`
- Don't unnecessarily add `try`/`catch`
- Use `Id<'tableName'>` for Convex document IDs, not `string`
- Prefer interfaces over types, avoid enums (use union types)

### React/Next.js
- RSC-first: minimize `use client`, `useEffect`, `useState`
- Avoid massive JSX blocks - compose smaller components
- Colocate components that change together
- URL state via `nuqs` for search params
- Named exports only (no default exports)
- Use `next/font`, `next/script` when applicable
- `next/image` above fold: use `priority` sparingly
- Be mindful of serialized prop size for RSC → child components

### Styling
- Tailwind v4 with shadcn/ui dark theme (Vercel-inspired)
- Prefer built-in values, occasionally dynamic, rarely globals
- Use `border-white/10` for subtle borders
- Timestamps: right-aligned, `text-white/60`, relative format

### Middleware
- **Non-standard**: Located at `apps/app/src/proxy.ts` (not `middleware.ts`)
- Chains `convexAuthNextjsMiddleware` + `createI18nMiddleware`

## ANTI-PATTERNS (THIS PROJECT)

| Pattern | Why | Alternative |
|---------|-----|-------------|
| `.filter()` in Convex queries | Performance | Use `.withIndex()` |
| `ctx.db` in actions | Actions lack DB access | Use `ctx.runQuery`/`ctx.runMutation` |
| `v.bigint()` | Deprecated | Use `v.int64()` |
| `ctx.storage.getMetadata` | Deprecated | Query `_storage` system table |
| `crons.hourly/daily/weekly` | Removed | Use `crons.interval` or `crons.cron` |
| Missing return validators | Required | Always add `returns: v.null()` minimum |
| `useEffect` for data | React anti-pattern | Fetch in RSC or use event handlers |

## UNIQUE STYLES

- **Convex Function Syntax**: Always use object form `query({ args, returns, handler })`
- **Discriminated Unions**: Use `as const` for string literals
- **Activity Descriptions**: Format as "You [action] [entity] [identifier]"
- **Design System**: Black background, white text, `border-white/10`, lucide-react icons

## COMMANDS

```bash
bun dev              # All apps + backend in parallel
bun dev:app          # Main app only (port 3000)
bun dev:web          # Marketing site only
bun run lint         # Turbo lint + sherif monorepo check
bun run typecheck    # TypeScript check all workspaces
bun run format       # Biome format
bun run test         # Vitest (edge-runtime for backend)
```

**Available Tools:**
- `gh` CLI installed - use for GitHub operations
- `knip` - use to remove unused code when making large changes

## BUILD & DEPLOY

- **CI**: GitHub Actions runs `lint` + `typecheck` on push
- **Deploy**: Vercel with custom build - deploys Convex backend first, injects URL
- **Patches**: `postinstall` runs `scripts/apply-patches.js` for node_modules fixes
- **Monorepo Health**: Use `bun lint:repo` (sherif) for dependency consistency

## NOTES

- Multi-tenant: Organizations with roles/permissions
- Schema: 1391 lines, 50+ tables (collections, loans, library integration)
- Auth: `@convex-dev/auth` with Google OAuth
- Billing: Polar.sh integration via webhooks
- Invitation emails: TODO in `organizations.ts`
- Tests: Colocated in `packages/backend/convex/*.test.ts`, uses `convex-test`
