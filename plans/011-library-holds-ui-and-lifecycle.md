# Plan 011: Surface library holds in the product and close the hold lifecycle

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 94f6b108..HEAD -- packages/backend/convex/library apps/app/src/app/[locale]/(dashboard)/library apps/app/src/components/app-sidebar-client.tsx packages/backend/convex/crons.ts`
> (Plan 014 merged on `main` @ `94f6b108` — expect `navAdministration` sidebar diff only.)
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M–L
- **Risk**: MED (touches the circulation check-in path)
- **Depends on**: none (plan 014 merged — edits `navLibrary` in `app-sidebar-client.tsx`, no conflict with 014's `navAdministration` changes)
- **Category**: direction
- **Planned at**: commit `6e3f1d1a`, 2026-06-12 — **reconciled** against `main` @ `94f6b108`, 2026-06-12 (finding unchanged; drift baseline updated)

## Why this matters

The holds backend is fully built — `packages/backend/convex/library/holds.ts` (559
lines) implements place/cancel/fulfill, queue positions, expiry, and statistics — but
**no UI calls any of it** (`rg 'library\.holds' apps/app/src` matches nothing; the
only traces are locale strings like `holds: "Holds"` at `apps/app/src/locales/en.ts:563`).
The integrations catalog even advertises "Hold queue management" as a library feature
(`packages/backend/convex/integrations.ts:30`). Worse, the lifecycle has a hole: when
a copy is **checked in**, it goes straight back to `available` without checking the
hold queue, so the only code path that ever marks a hold "available" is the expiry of
an *earlier* hold — and nothing (no cron, no UI) ever calls `expireOldHolds` either.
Circulation already half-respects holds (renewals are blocked when holds are pending,
`circulation.ts:649-662`), making the half-missing behavior inconsistent. This plan
wires check-in → next-hold activation, adds an expiry cron, and ships a holds page.

## Current state

- `packages/backend/convex/library/holds.ts` — complete API:
  - `place` (line 16): patron-only, hold limit, duplicate/checkout guards, queue position.
  - `cancel` (123), `fulfill` (168), `updatePickupLocation` (200).
  - Queries: `get` (232), `listByItem` (264), `list` (304, paginated, status filter,
    enriched with account/item/pickupLocation), `listAvailable` (354),
    `getStatistics` (394 — totals by status + placedToday).
  - `expireOldHolds` (438): public mutation, takes `organizationId`, expires
    `available` holds past `expirationDate` and promotes the next pending hold via the
    private helper `notifyNextInQueue` (506), which assigns an available copy, sets
    copy status `on_hold`, decrements `availableCopies`, and stamps
    `availableDate`/`expirationDate` from `librarySettings.holdExpirationDays` (default 7).
- **The lifecycle hole** — `checkin` in `packages/backend/convex/library/circulation.ts`
  returns the copy to general availability without consulting holds:

```179:192:packages/backend/convex/library/circulation.ts
    await Promise.all([
      ctx.db.patch(args.circulationId, {
        status: "returned",
        returnDate: now,
        checkedInBy: userId,
        notes: args.notes,
        fineAmount: fineAmount ?? circulation.fineAmount,
        fineStatus: fineAmount ? "billed" : "none",
      }),
      ctx.db.patch(copy._id, { status: "available" }),
      ctx.db.patch(item._id, {
        availableCopies: item.availableCopies + 1,
      }),
    ] as const);
```

- `packages/backend/convex/crons.ts` — nine crons, none for library hold expiry.
- Existing library UI: routes `library/` (dashboard), `library/catalog`,
  `library/circulation`, `library/fines`, `library/acquisitions`. The circulation
  desk's client hook is `library/circulation/_components/use-library-circulation.ts`
  (uses `api.library.circulation.checkout/checkin/renew`) — follow its structure for
  any new hook.
- Sidebar — the Library group where the new item goes:

```767:799:apps/app/src/components/app-sidebar-client.tsx
  const navLibrary = [
    { title: "Library Dashboard", url: "/library", icon: Library },
    {
      title: "Catalog & Search",
      url: "/library/catalog",
      icon: BookOpen,
      locked: !isLibraryModuleEnabled,
    },
    {
      title: "Circulation Desk",
      url: "/library/circulation",
      icon: IdCard,
      locked: !isLibraryModuleEnabled,
    },
    {
      title: "Patron Management",
      url: "/accounts?type=patron",
      icon: Users,
      locked: !isLibraryModuleEnabled,
    },
    {
      title: "Fines & Fees",
      url: "/library/fines",
      icon: Ticket,
      locked: !isLibraryModuleEnabled,
    },
    {
      title: "Acquisitions",
      url: "/library/acquisitions",
      icon: ShoppingCart,
      locked: !isLibraryModuleEnabled,
    },
  ];
```

- Conventions: pages are server components that render a `_components/*-page-client.tsx`
  client component (see `library/fines/page.tsx` as a small exemplar); pagination uses
  `usePaginatedQuery`; module gating server-side uses `requireModuleEnabled(ctx, orgId, "library")`
  (already present in every holds function). Tests: `packages/backend/tests/`, harness
  `testHarness.ts`, exemplar `conservation.test.ts` (permission setup) — note
  `library.test.ts` is all `expect(true).toBe(true)` placeholders; do not extend that
  file, create a new one.

## Commands you will need

| Purpose   | Command (repo root unless noted)                   | Expected on success |
|-----------|----------------------------------------------------|---------------------|
| Lint      | `bun run lint`                                     | exit 0              |
| Typecheck | `bun run typecheck`                                | exit 0              |
| Tests     | `cd packages/backend && bunx vitest run libraryHolds` | all pass         |
| All tests | `cd packages/backend && bun test:once`             | all pass            |

## Scope

**In scope** (the only files you should modify/create):
- `packages/backend/convex/library/holds.ts` (export queue-promotion helper, add internal expiry)
- `packages/backend/convex/library/circulation.ts` (`checkin` only)
- `packages/backend/convex/crons.ts` (one new cron)
- `apps/app/src/app/[locale]/(dashboard)/library/holds/` (create: `page.tsx`, `loading.tsx`, `_components/`)
- `apps/app/src/components/app-sidebar-client.tsx` (one nav item)
- `apps/app/src/locales/en.ts`, `fr.ts`, `es.ts`, `no.ts`, `ro.ts` (new strings under the library section)
- `packages/backend/tests/libraryHolds.test.ts` (create)

**Out of scope** (do NOT touch):
- `library.test.ts` placeholders (tracked separately as test-debt follow-up).
- Patron-facing self-service holds (public portal) — this is the staff desk view only.
- Email/notification on "hold available" — note as follow-up; the function name
  `notifyNextInQueue` is aspirational, it only patches DB state today.
- Renewal/recall logic in `circulation.ts` — already hold-aware; don't modify.

## Git workflow

- Branch: `advisor/011-library-holds`
- Conventional commits, e.g. `feat(library): activate next hold on check-in`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Check-in activates the next hold

In `holds.ts`, rename the private helper `notifyNextInQueue` (line 506) to
`promoteNextHold` and **export** it (it takes `(ctx: MutationCtx, itemId)` — keep that
signature). In `circulation.ts` `checkin` (line 110), after the existing
`Promise.all` patch block (lines 179-192), call:

```typescript
await promoteNextHold(ctx, circulation.itemId);
```

(import from `./holds`). Behavior consequence to preserve and understand:
`promoteNextHold` looks for an `available` copy — the patch above has just made this
copy available — and if a pending hold exists it will flip the copy to `on_hold` and
decrement `availableCopies` again. Net effect on a return with queued holds: copy ends
`on_hold`, counts stay consistent. With no pending holds it's a no-op.

Update the inline `notifyNextInQueue` call inside `expireOldHolds` to the new name.

**Verify**: `bun run typecheck` → exit 0; `cd packages/backend && bunx vitest run circulation` → existing circulation tests still pass.

### Step 2: Hold-expiry cron

In `holds.ts`, add an `internalMutation` `expireOldHoldsAllOrgs` (no args): iterate
distinct organizations that have `available` holds (query `libraryHolds` via the
`by_organization_and_status`-style index — confirm exact index names in `schema.ts`;
if a global scan is needed, bound it with `.take(500)` and note it), and run the same
expiry+promotion logic as `expireOldHolds`. Reuse the body by extracting a shared
`expireHoldsForOrg(ctx, organizationId)` helper called by both the public mutation and
the internal one. In `crons.ts` add:

```typescript
crons.interval(
  "expire-library-holds",
  { hours: 6 },
  internal.library.holds.expireOldHoldsAllOrgs,
);
```

**Verify**: `bun run typecheck` → exit 0; `bun run lint` → exit 0.

### Step 3: Holds page

Create `apps/app/src/app/[locale]/(dashboard)/library/holds/` with the repo's
page-shell + `_components/library-holds-page-client.tsx` pattern (copy the structure of
`library/fines/page.tsx` and its client). The client component:
- Statistics cards from `api.library.holds.getStatistics` (total, pending, available,
  fulfilled, expired, placedToday).
- Paginated table from `api.library.holds.list` via `usePaginatedQuery`, with a status
  filter (the `status` arg). Columns: item title, patron name, queue position, status,
  hold date, pickup location.
- Row actions: **Fulfill** (`api.library.holds.fulfill`, enabled only when status is
  `available`), **Cancel** (`api.library.holds.cancel`, enabled for `pending`/`available`).
- A "Place hold" dialog: patron picker + item picker (look at how the circulation
  desk's checkout dialog finds patrons/items — `library/circulation/_components/` —
  and reuse those search queries), calling `api.library.holds.place`.
- Module gating: mirror whatever guard the fines page uses for the library module.

Add locale keys under the library section of `en.ts` (a `holds:` subsection: title,
table headers, action labels, toasts) and mirror to the other four locale files.

**Verify**: `bun run typecheck` → exit 0; `bun run lint` → exit 0.

### Step 4: Sidebar entry

In `app-sidebar-client.tsx`, insert into `navLibrary` after "Circulation Desk":

```typescript
{
  title: "Holds",
  url: "/library/holds",
  icon: Bookmark,
  locked: !isLibraryModuleEnabled,
},
```

(`Bookmark` from `lucide-react` — add to the existing import; pick another unused
lucide icon if `Bookmark` is taken.)

**Verify**: `bun run typecheck` → exit 0.

### Step 5: Tests

Create `packages/backend/tests/libraryHolds.test.ts` modeled on
`conservation.test.ts` (harness usage) — you will need org + patron account + library
item + copy fixtures; check `testHarness.ts` for existing factory helpers and look at
how `library-circulation-rules.test.ts` builds library fixtures. Cover:
1. `place` → hold is `pending` with `queuePosition` 1; second patron's hold gets position 2.
2. Check-in with a pending hold → hold becomes `available`, copy becomes `on_hold`,
   `availableCopies` not inflated (the Step 1 behavior).
3. Check-in with no holds → copy `available` (regression guard).
4. `fulfill` on an `available` hold → `fulfilled`; on `pending` → throws "not ready".
5. `cancel` of an `available` hold releases the copy and re-queues the next hold.
6. `expireOldHoldsAllOrgs` expires past-`expirationDate` holds and promotes the next.

**Verify**: `cd packages/backend && bunx vitest run libraryHolds` → 6+ tests pass.

### Step 6: Full gates

**Verify**: `bun run lint` → exit 0; `bun run typecheck` → exit 0;
`cd packages/backend && bun test:once` → all pass.

## Test plan

Covered in Step 5; pattern files named there.

## Done criteria

- [ ] `bun run lint`, `bun run typecheck` exit 0; `bun test:once` passes with ≥6 new hold tests
- [ ] `grep -n "promoteNextHold" packages/backend/convex/library/circulation.ts` → 1 match (the check-in call)
- [ ] `grep -n "expire-library-holds" packages/backend/convex/crons.ts` → 1 match
- [ ] `ls apps/app/src/app/\[locale\]/\(dashboard\)/library/holds/page.tsx` → exists
- [ ] `grep -n '"/library/holds"' apps/app/src/components/app-sidebar-client.tsx` → 1 match
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `checkin` in `circulation.ts` no longer matches the excerpt (someone wired holds already).
- Importing `holds.ts` from `circulation.ts` creates a circular import that typecheck
  rejects — report; the fallback design (move `promoteNextHold` to a shared
  `library/holdQueue.ts`) is a structural decision the reviewer should confirm.
- The `libraryHolds` schema lacks `expirationDate`/`queuePosition`/`copyId` as this
  plan assumes.
- Test fixtures for library items/copies/patrons don't exist in the harness and would
  take more than ~50 lines to build — report with what's missing.

## Maintenance notes

- Follow-ups deferred: patron notification when a hold becomes available (email/in-app —
  `promoteNextHold` is the single hook point); portal self-service holds; surfacing
  hold queues on the catalog item detail page (`listByItem` is ready for it).
- Reviewer focus: the double-patch dance in Step 1 (copy `available` → `on_hold` in
  one mutation) keeps `availableCopies` consistent — verify with test 2; also confirm
  renewals still refuse items with pending holds (existing behavior, `circulation.ts:649-662`).
- If plan 014 (nav quick wins) runs in the same window, both edit
  `app-sidebar-client.tsx` — rebase carefully.
