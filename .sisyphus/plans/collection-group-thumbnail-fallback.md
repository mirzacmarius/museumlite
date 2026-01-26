# Collection Group Thumbnail Fallback

## Context

### Original Request
When a collection/gallery/group doesn't have its own thumbnail image, show a random (primary preferred) image from an item within that collection that has a thumbnail.

### User Decisions
- **Fallback Priority**: Use `isPrimary` image first, then any image
- **Scope**: Apply to BOTH overview page AND collections list page
- **Final Fallback**: Keep Package icon when no images exist

### Current Implementation
- Collection groups have `imageId: v.optional(v.id("_storage"))` for direct thumbnail
- When `imageId` is null, a generic Package icon is shown
- Collection items use `mediaFiles` table with `thumbnailStorageId` and `isPrimary` flag
- No automatic fallback exists currently

### Files to Modify
- `packages/backend/convex/dashboard.ts` - Dashboard analytics query
- `packages/backend/convex/collectionGroups.ts` - Collection groups list query

---

## Work Objectives

### Core Objective
Add automatic thumbnail fallback logic: when a collection group has no `imageId`, fetch a thumbnail from items within that collection (prioritizing primary images).

### Concrete Deliverables
- Updated `dashboard.ts` with fallback image resolution for `recentCollectionGroups`
- Updated `collectionGroups.ts` with fallback image resolution for `list` query
- Helper function to avoid code duplication

### Definition of Done
- [ ] Collection groups without `imageId` show item thumbnails
- [ ] Primary images are prioritized over non-primary
- [ ] Package icon still shows when no images exist
- [ ] `bun run typecheck` passes
- [ ] No console errors

### Must Have
- Fallback logic: group.imageId → item.isPrimary → any item thumbnail → null
- Apply to both dashboard and collections list queries
- Maintain existing return types (backward compatible)

### Must NOT Have (Guardrails)
- Do NOT change the schema (no migrations)
- Do NOT modify frontend components (they already handle null imageUrl)
- Do NOT add new API endpoints (modify existing queries)
- Do NOT affect performance significantly (use indexes)

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (bun test in packages/backend)
- **User wants tests**: TDD approach
- **Framework**: vitest with convex-test

### Manual QA
- Navigate to overview page, verify collection groups without imageId show item thumbnails
- Navigate to collections page, verify same behavior
- Test collection with no items (should show Package icon)
- Test collection with items but no images (should show Package icon)

---

## Task Flow

```
Task 1 (Helper) → Task 2 (Dashboard Query) → Task 3 (CollectionGroups Query) → Task 4 (Verify)
```

## Parallelization

| Task | Depends On | Reason |
|------|------------|--------|
| 1 | None | Helper function first |
| 2 | 1 | Uses helper |
| 3 | 1 | Uses helper |
| 4 | 2, 3 | Final verification |

---

## TODOs

- [x] 1. Create helper function for fallback thumbnail resolution

  **What to do**:
  - Create internal helper function `getCollectionGroupThumbnailUrl` in `collectionGroups.ts`
  - Logic:
    1. If group has `imageId`, return `ctx.storage.getUrl(imageId)`
    2. Query `collections` table for items in this group
    3. Query `mediaFiles` for primary image (`isPrimary=true`) of any item
    4. If no primary, get any image with `thumbnailStorageId`
    5. Return thumbnail URL or null
  - Use existing indexes: `mediaFiles.by_collection`

  **Must NOT do**:
  - Create new indexes (use existing ones)
  - Expose as public query (internal helper only)

  **Parallelizable**: NO (foundation task)

  **References**:
  - `packages/backend/convex/collectionGroups.ts` - Existing queries
  - `packages/backend/convex/media.ts:getPrimaryImageUrl` (lines 513-551) - Pattern for fetching primary image
  - `packages/backend/convex/schema.ts:461-561` - mediaFiles schema with indexes

  **Acceptance Criteria**:
  - [ ] Helper function created
  - [ ] Returns group's imageUrl if exists
  - [ ] Falls back to item primary image
  - [ ] Falls back to any item thumbnail
  - [ ] Returns null if no images
  - [ ] `lsp_diagnostics` clean

  **Commit**: YES
  - Message: `feat(backend): add helper for collection group thumbnail fallback`
  - Files: `collectionGroups.ts`

- [x] 2. Update dashboard query to use fallback

  **What to do**:
  - Modify `getAnalytics` query in `dashboard.ts`
  - Replace simple `ctx.storage.getUrl(g.imageId)` with helper function call
  - Ensure `recentCollectionGroups.imageUrl` uses fallback logic

  **Must NOT do**:
  - Change return type (keep `imageUrl: v.optional(v.string())`)
  - Add new fields to response
  - Break existing consumers

  **Parallelizable**: YES (with task 3, after task 1)

  **References**:
  - `packages/backend/convex/dashboard.ts` - Current implementation
  - Lines 55-65: recentCollectionGroups return type
  - Lines where imageUrl is resolved

  **Acceptance Criteria**:
  - [ ] Dashboard query uses fallback helper
  - [ ] Groups without imageId show item thumbnails
  - [ ] Return type unchanged
  - [ ] `lsp_diagnostics` clean

  **Commit**: YES
  - Message: `feat(backend): use thumbnail fallback in dashboard query`
  - Files: `dashboard.ts`

- [x] 3. Update collectionGroups list query to use fallback

  **What to do**:
  - Modify `list` query in `collectionGroups.ts`
  - Replace simple `ctx.storage.getUrl(g.imageId)` with helper function call
  - Ensure each group's `imageUrl` uses fallback logic

  **Must NOT do**:
  - Change return type
  - Add new fields to response
  - Break existing consumers

  **Parallelizable**: YES (with task 2, after task 1)

  **References**:
  - `packages/backend/convex/collectionGroups.ts:list` (lines 83-161)
  - Current imageUrl resolution pattern

  **Acceptance Criteria**:
  - [ ] List query uses fallback helper
  - [ ] Groups without imageId show item thumbnails
  - [ ] Return type unchanged
  - [ ] `lsp_diagnostics` clean

  **Commit**: YES
  - Message: `feat(backend): use thumbnail fallback in collectionGroups list`
  - Files: `collectionGroups.ts`

- [x] 4. Verify all changes

  **What to do**:
  - Run `bun run typecheck`
  - Run `bun test` in packages/backend
  - Manual QA:
    - Overview page: verify fallback thumbnails
    - Collections page: verify fallback thumbnails
    - Test edge cases (no items, no images)

  **Parallelizable**: NO (final step)

  **Acceptance Criteria**:
  - [ ] `bun run typecheck` → 0 errors
  - [ ] `bun test` → all pass
  - [ ] Manual QA confirms expected behavior

  **Commit**: NO (verification only)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(backend): add helper for collection group thumbnail fallback` | collectionGroups.ts | lsp_diagnostics |
| 2 | `feat(backend): use thumbnail fallback in dashboard query` | dashboard.ts | lsp_diagnostics |
| 3 | `feat(backend): use thumbnail fallback in collectionGroups list` | collectionGroups.ts | lsp_diagnostics |
| 4 | - | - | typecheck + tests |

---

## Success Criteria

### Verification Commands
```bash
bun run typecheck  # Expected: 0 errors
cd packages/backend && bun test  # Expected: all pass
```

### Final Checklist
- [ ] Helper function works correctly
- [ ] Dashboard shows fallback thumbnails
- [ ] Collections page shows fallback thumbnails
- [ ] Package icon still appears when no images
- [ ] TypeScript passes
- [ ] Tests pass
