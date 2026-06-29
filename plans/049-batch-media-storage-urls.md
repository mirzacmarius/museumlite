# Plan 049: Batch storage URL resolution for media browser list

> **Executor instructions**: Follow step by step. SKIP updating `plans/README.md`.
>
> **Drift check**: `git diff --stat 37e12dee..HEAD -- packages/backend/convex/media.ts apps/app/src/app/[locale]/(dashboard)/media/`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `37e12dee`, 2026-06-29

## Why this matters

`listByOrganization` calls `ctx.storage.getUrl` twice per row (url + thumbnail), causing 2× page size storage API work per request.

## Current state

- `packages/backend/convex/media.ts:740-747` — per-row getUrl in paginated list
- `apps/app/src/app/[locale]/(dashboard)/media/media-page-client.tsx:204-206` — uses `item.thumbnailUrl ?? item.url`

## Commands

| Purpose | Command | Expected |
|---------|---------|----------|
| Media tests | `cd packages/backend && bun run test media.test.ts` | pass |
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run lint` | exit 0 |

## Scope

**In scope**:
- `packages/backend/convex/media.ts` — new `getStorageUrls` query; remove getUrl from `listByOrganization` page mapping (keep storageId fields)
- `apps/app/src/app/[locale]/(dashboard)/media/media-page-client.tsx`
- `apps/app/src/app/[locale]/(dashboard)/media/media-detail-modal.tsx` if types break
- Tests in `media.test.ts`

**Out of scope**: `media.list` per-object path (follow-up); global media search

## Git workflow

- Branch: `advisor/049-batch-media-storage-urls`
- Commit: `perf(media): batch storage URLs for org media list`

## Steps

### Step 1: Add getStorageUrls query

```typescript
args: { storageIds: v.array(v.id("_storage")) }
returns: v.array(v.object({ storageId: v.id("_storage"), url: v.union(v.string(), v.null()) }))
```

Auth: require org membership if passing org-scoped IDs, OR accept only IDs already returned from authorized list query — simplest: require `organizationId` + verify each storageId belongs to org mediaFiles.

### Step 2: Slim listByOrganization return

Remove `url` and `thumbnailUrl` from list items (or make optional null). Update returns validator.

### Step 3: Update media-page-client

Collect storageIds from page; `useQuery(api.media.getStorageUrls, { organizationId, storageIds })`; build lookup map for grid thumbnails.

### Step 4: Tests + gates

Add test that listByOrganization handler does not call getUrl (grep comment ok); test getStorageUrls returns URLs for seeded file.

## Done criteria

- [ ] listByOrganization avoids per-row getUrl
- [ ] Client resolves URLs via batch query
- [ ] Media grid still shows thumbnails
- [ ] typecheck, lint, tests pass

## STOP conditions

- Return type change breaks preload SSR path — update `media-page-data.tsx` accordingly

## Maintenance notes

Apply same pattern to `media.list` in a follow-up plan.
