# Plan 014: Surface Analytics and Accounts/CRM in navigation; delete dead account page

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6e3f1d1a..HEAD -- apps/app/src/components/app-sidebar-client.tsx apps/app/src/app/[locale]/\(dashboard\)/accounts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (note: edits `app-sidebar-client.tsx`, same file as plan 011 — execute 011 and 014 sequentially, either order)
- **Category**: direction
- **Planned at**: commit `6e3f1d1a`, 2026-06-12

## Why this matters

Two fully built features are invisible. The analytics page (inventory valuation, loan
calendar, compliance report, location utilization, CSV exports — a flagship Pro
surface) has **no sidebar entry**; the only way in is a quick-action link on the
dashboard (`apps/app/src/app/[locale]/(dashboard)/page.tsx:99`). The Accounts/CRM
module (list, import, detail with contacts/documents/relationships/timeline) is
reachable only through the Library group's "Patron Management" link, which filters to
`?type=patron` — lenders, donors, and vendors have no entry point at all. A stale
`page-old.tsx` also ships next to the accounts detail page. Two nav items and one
deletion make paid features discoverable.

## Current state

- Sidebar groups live in `apps/app/src/components/app-sidebar-client.tsx`. The
  Administration group, where both new items go:

```801:815:apps/app/src/components/app-sidebar-client.tsx
  const navAdministration = [
    {
      title: "Public Portal",
      url: "/portal",
      icon: Globe,
      locked: !hasFeature("public_portal"),
    },
    { title: "Digital Assets", url: "/media", icon: Image },
    {
      title: "Preferences",
      url: "/settings/preferences",
      icon: SlidersHorizontal,
    },
    { title: "Settings", url: "/settings/organization", icon: Settings2 },
  ];
```

  The component already has `hasFeature` in scope (see the `locked: !hasFeature("public_portal")`
  entry above and `locked: !hasFeature("loans")` at lines 725-737). Icons are imported
  from `lucide-react` near the top of the file.
- The analytics page gates itself with `hasFeature("reporting")`
  (`analytics/page.tsx:81,108-118` renders a `FeatureGuard` paywall when locked), so a
  locked-state nav entry is consistent with existing behavior.
- The existing patron link (do not remove it) is in the Library group:

```781:786:apps/app/src/components/app-sidebar-client.tsx
    {
      title: "Patron Management",
      url: "/accounts?type=patron",
      icon: Users,
      locked: !isLibraryModuleEnabled,
    },
```

- Dead file: `apps/app/src/app/[locale]/(dashboard)/accounts/[id]/page-old.tsx` exists
  alongside `page.tsx`; `rg page-old apps/app/src` shows nothing imports or references
  it (Next.js does not route non-`page.tsx` files, so it is shipped dead code).
- Accounts routes that the new nav item points at: `/accounts` (list + filters),
  `/accounts/new`, `/accounts/import`, `/accounts/[id]`.

## Commands you will need

| Purpose   | Command (repo root)   | Expected on success |
|-----------|-----------------------|---------------------|
| Lint      | `bun run lint`        | exit 0              |
| Typecheck | `bun run typecheck`   | exit 0              |

(No backend changes — backend tests are not required, but `cd packages/backend && bun test:once` must still pass untouched.)

## Scope

**In scope** (the only files you should modify/delete):
- `apps/app/src/components/app-sidebar-client.tsx`
- `apps/app/src/app/[locale]/(dashboard)/accounts/[id]/page-old.tsx` (delete)

**Out of scope** (do NOT touch):
- The "Patron Management" link — it stays; patrons remain a library-context entry.
- The dashboard quick-action link to `/analytics` — keep it; nav and quick action coexist.
- Any page content, locale files (nav titles in this file are hardcoded English strings —
  match that existing pattern), or the command palette.
- Plan 011 adds a "Holds" item to `navLibrary` in this same file — do not add it here.

## Git workflow

- Branch: `advisor/014-nav-quick-wins`
- Conventional commits, e.g. `feat(nav): surface Analytics and Accounts in sidebar`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add Analytics and Accounts to the Administration group

In `app-sidebar-client.tsx`, edit `navAdministration` so it reads (new entries first,
existing entries preserved):

```typescript
const navAdministration = [
  {
    title: "Analytics & Reports",
    url: "/analytics",
    icon: ChartColumn,
    locked: !hasFeature("reporting"),
  },
  { title: "Accounts & CRM", url: "/accounts", icon: Contact },
  {
    title: "Public Portal",
    url: "/portal",
    icon: Globe,
    locked: !hasFeature("public_portal"),
  },
  { title: "Digital Assets", url: "/media", icon: Image },
  {
    title: "Preferences",
    url: "/settings/preferences",
    icon: SlidersHorizontal,
  },
  { title: "Settings", url: "/settings/organization", icon: Settings2 },
];
```

Add `ChartColumn` and `Contact` to the existing `lucide-react` import. If either name
collides with an icon already imported, choose another unused lucide icon
(`BarChart3`, `ContactRound`) and keep going.

One interaction to check: `isPathActive` (lines 817-824) uses `pathname?.startsWith(url)`.
`/accounts` would also highlight for `/accounts?type=patron` navigation — that is
acceptable (both point at the same route); no special-casing needed. Verify
`/analytics` does not prefix-collide with any other nav URL (it doesn't today).

**Verify**: `bun run typecheck` → exit 0; `bun run lint` → exit 0.

### Step 2: Delete the dead account detail page

Delete `apps/app/src/app/[locale]/(dashboard)/accounts/[id]/page-old.tsx`.

**Verify**: `rg "page-old" apps/app/src` → no matches; `bun run typecheck` → exit 0
(confirms nothing imported it).

### Step 3: Full gates

**Verify**: `bun run lint` → exit 0; `bun run typecheck` → exit 0;
`cd packages/backend && bun test:once` → all pass (untouched, regression check only).

## Test plan

No new automated tests (pure nav wiring; the repo has no sidebar test suite). Manual
QA note for the reviewer: with a Free-tier org, "Analytics & Reports" shows the locked
state (same treatment as "Public Portal"); clicking it on a Pro org lands on the
analytics page; "Accounts & CRM" lists all account types, not just patrons.

## Done criteria

- [ ] `grep -n '"/analytics"' apps/app/src/components/app-sidebar-client.tsx` → 1 match with `locked: !hasFeature("reporting")`
- [ ] `grep -n '"Accounts & CRM"' apps/app/src/components/app-sidebar-client.tsx` → 1 match
- [ ] `apps/app/src/app/[locale]/(dashboard)/accounts/[id]/page-old.tsx` does not exist
- [ ] `bun run lint`, `bun run typecheck` exit 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `navAdministration` no longer matches the excerpt (drifted — e.g. plan 011 or other
  work restructured the sidebar); re-derive placement, but if the group structure
  itself changed, report instead.
- Deleting `page-old.tsx` breaks typecheck (something imports it after all) — restore
  and report what imports it.

## Maintenance notes

- If the maintainer later prefers Accounts under a new "Operations" group (with
  Transit/Insurance), that's an IA decision — this plan takes the cheapest correct
  placement.
- Nav titles in this file are hardcoded English (pre-existing pattern, not introduced
  here); when the sidebar is internationalized, these two entries join that sweep.
- Plan 011 (library holds) edits the same file; whichever lands second rebases trivially
  (different arrays).
