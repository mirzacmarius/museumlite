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

## Localization

The app ships English, Spanish, French, Norwegian and Romanian (`apps/app/src/locales/`). Use the glossary's words, including its Translations table, and keep each rule below:

- **Dictionaries.** `en.ts` is the source. Every key exists in every locale with the same interpolation values, no locale keeps keys English lacks, and no locale repeats an English phrase (`translations.test.ts`). Nothing falls back to English at runtime; a missing translation fails the tests instead. A path without a supported locale prefix is served in the saved or browser language when the app has it, otherwise English (`proxy.ts`).
- **Errors.** Never show server error text: production replaces a plain `Error` with "Server Error", and the text is English anyway. Throw a coded `ConvexError` for user-recoverable failures and map the code to copy in a hook. `useActionErrorMessage` explains custody conflicts, approval refusals, case tasks, loan objects and missing capabilities, then falls back to the caller's translated message. Record forms use `useRecordSaveFailure`, which also explains identifier refusals.
- **Stored values.** Names, notes and other text staff entered are shown as entered. Backend enum values (statuses, location types) go through `lib/record-enum-labels.ts`; an organization's own values, such as a custom location type, read as stored. Notifications: known English titles and messages are localized by `lib/notification-copy.ts`, others read as stored. Email chrome is localized, but generic notification email bodies are still the stored English text.
- **Dates and numbers.** Format with `lib/format-date.ts`, `lib/format-number.ts` and `lib/relative-time-formatters.ts` in the app locale (Norwegian is `nb-NO`). Calendar dates entered as `yyyy-MM-dd` display in UTC (`CALENDAR_DATE_OPTIONS`).
- **Money.** Show an amount in its recorded currency with `formatMoney` or `MoneyCell`. Never assume a currency: without one, show the bare number and say "Currency not recorded". Total per currency (`totalsByCurrency`); never add or convert across currencies.
- **Counts.** There are no plural keys. Do not add English `{s}` suffixes; write count-neutral copy such as "Awaiting receipt: {count}" that reads correctly in every locale.
- **Long text.** Translations run up to about a third longer than English. Labels and buttons wrap rather than truncate; where a single line must truncate, the full text stays in the accessible name or `title`. Check new screens at 360 px in Norwegian or Romanian.

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
