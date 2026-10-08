# Code style

Prefer simple, colocated code. Create abstractions when they remove real duplication or clarify a boundary. Use descriptive names. Do not add comments that restate code. Use lowercase kebab-case directories. Do not use emojis in project code or documentation.

## TypeScript

- `strict: true` and `noUncheckedIndexedAccess: true`
- Never cast to `any` or use `@ts-ignore`
- Prefer interfaces to object type aliases; prefer unions to enums
- Use named exports except for Next.js pages
- Use early returns and guard clauses
- Model expected errors as values; avoid unnecessary `try/catch`
- Use Zod for frontend form validation
- Biome organizes imports

## React and Next.js

- Prefer React Server Components; minimize client components, effects, and state
- Keep UI components focused and compose them into page flows
- Use `nuqs` for URL search state
- Wrap client components in `Suspense` with a fallback
- Dynamically load noncritical components; keep serialized RSC props small
- Use `next/font`, `next/script`, and `next/image` where appropriate
- Build mobile-first layouts with Tailwind v4 and shadcn/ui

## Product UI

- Black backgrounds and white text; `border-white/10` for subtle borders
- lucide-react icons at `h-4 w-4`
- Right-align timestamps with `text-white/60` and relative formatting
- Format activity as "You [action] [entity] [identifier]"

## File locations

| Task | Location |
| --- | --- |
| Add Convex function | `packages/backend/convex/` |
| Add UI component | `packages/ui/src/components/` |
| Add dashboard page | `apps/app/src/app/[locale]/(dashboard)/` |
| Add HTTP endpoint | `packages/backend/convex/http.ts` |
| Add locale | `apps/app/src/locales/` |

## Convex reminders

Full API rules live in `convex/_generated/ai/guidelines.md`. Public functions need `args` and `returns` validators. Prefer `.withIndex()` over `.filter()`. Use `Id<'tableName'>` for Convex IDs. Schedule with `crons.interval` for hourly work.
