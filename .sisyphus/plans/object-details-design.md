# Object Details Page Design Implementation

## Context

### Original Request
Implement the missing parts from object-page-content-design.html in the object details page. Do not remove functionality if not needed, make it show location of object too. Pay attention to all details, plan to implement missing functionality and fully complete it if missing.

### Interview Summary
**Key Discussions**:
- User wants FULL implementation including schema changes for verification badge
- ALL items on page should match the design HTML exactly
- Existing functionality must be preserved

**Research Findings**:
- Audit log already returns `userImage` and `changes` fields - not currently displayed
- Media system supports `fileType: "document"` with `fileSize` field
- Collections table has NO verification fields currently
- Insurance coverage table has verification pattern to follow

### Metis Review
**Identified Gaps** (addressed):
- Action categorization strategy: Pattern matching on action string
- Changes field parsing: Defensive handling with fallback display
- Verification workflow: Users with collections.update permission can verify
- User deletion risk: Handle null verifier gracefully in UI

---

## Work Objectives

### Core Objective
Bring the object details page into complete visual and functional alignment with object-page-content-design.html, including adding record verification capability.

### Concrete Deliverables
1. Enhanced Logs Tab with colored action badges, user avatars, and change details
2. Enhanced Digital Assets Tab showing documents from media table with file sizes
3. Record Verified badge in sidebar footer with verifier information
4. Schema addition of verification fields to collections table

### Definition of Done
- [ ] Logs tab shows colored action badges matching design colors
- [ ] Logs tab displays user photos when available (fallback to initials)
- [ ] Logs tab shows previous/new values from changes field
- [ ] Digital Assets tab shows documents (PDF, 3D files) with file sizes
- [ ] Sidebar shows "Record Verified" badge when collection.verified is true
- [ ] Schema has verified/verifiedBy/verifiedAt fields on collections table
- [ ] All visual styling matches design HTML
- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes

### Must Have
- Schema backward compatibility (all new fields optional)
- Graceful handling of missing data (null user images, empty changes)
- Existing functionality preserved

### Must NOT Have (Guardrails)
- NO new backend queries for audit logs (data already exists)
- NO changes to audit log schema or logging behavior
- NO verification mutation (edit page scope, not this page)
- NO new tabs or tab restructuring
- NO modifications to non-object-detail pages
- NO i18n keys for new badge text (hardcoded strings acceptable)

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (vitest in packages/backend)
- **User wants tests**: Manual verification primary
- **Framework**: vitest for backend, manual for UI

### Manual QA Procedures

**For Schema Changes:**
- Run `bunx convex dev` and verify schema pushes without errors
- Query collections table and verify new fields are present

**For UI Changes:**
- Navigate to `/objects/[id]` with a real object
- Verify each tab matches design visually
- Test with objects that have and don't have the new fields

---

## Task Flow

```
Task 1 (Schema) 
    ↓
Task 2 (Digital Assets Tab) ← Independent after schema
    ↓
Task 3 (Logs Tab) ← Independent after schema  
    ↓
Task 4 (Verified Badge) ← Depends on schema
    ↓
Task 5 (Verification)
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A | 2, 3 | Independent UI changes after schema |

| Task | Depends On | Reason |
|------|------------|--------|
| 2 | 1 | Needs schema pushed to test |
| 3 | 1 | Needs schema pushed to test |
| 4 | 1 | Uses new verified fields |
| 5 | 2, 3, 4 | Final verification |

---

## TODOs

- [ ] 1. Add verification fields to collections schema

  **What to do**:
  - Add `verified: v.optional(v.boolean())` to collections table
  - Add `verifiedBy: v.optional(v.id("users"))` to collections table
  - Add `verifiedAt: v.optional(v.number())` to collections table
  - Push schema changes to Convex

  **Must NOT do**:
  - Do NOT add verification mutation
  - Do NOT change any existing field types
  - Do NOT add indexes for these fields

  **Parallelizable**: NO (other tasks depend on this)

  **References**:

  **Pattern References**:
  - `packages/backend/convex/schema.ts:2987-2990` - Insurance coverage verification pattern to follow
  - `packages/backend/convex/schema.ts:254-380` - Collections table structure

  **External References**:
  - Convex optional fields docs: fields can be added as optional without migration

  **Acceptance Criteria**:
  - [ ] `bunx convex dev` runs successfully in packages/backend
  - [ ] Schema diff shows 3 new optional fields on collections table
  - [ ] No type errors in existing code

  **Commit**: YES
  - Message: `feat(schema): add verification fields to collections table`
  - Files: `packages/backend/convex/schema.ts`
  - Pre-commit: `bun run typecheck`

---

- [ ] 2. Enhance Digital Assets Tab to show documents

  **What to do**:
  - Query media table for documents (filter by `fileType: "document"`)
  - Display documents in a card list similar to design
  - Show file name, type, and file size (format bytes to readable)
  - Add download icon linking to file URL
  - Keep existing external links display

  **Must NOT do**:
  - Do NOT remove external links functionality
  - Do NOT create new backend query (use existing api.media.list)
  - Do NOT add upload functionality (that's edit page)

  **Parallelizable**: YES (with task 3)

  **References**:

  **Pattern References**:
  - `apps/app/src/app/[locale]/(dashboard)/objects/[id]/_components/digital-assets-tab.tsx` - Current implementation to modify
  - `apps/app/src/app/[locale]/(dashboard)/objects/[id]/_components/media-gallery.tsx:61-75` - How media is queried
  - `/Users/marius/Developer/ml/object-page-content-design.html:780-876` - Design HTML for Digital Assets tab

  **API References**:
  - `api.media.list` - Returns media with fileType, fileSize, url
  - Media fileType values: `"image"` | `"document"`

  **Utility References**:
  - File size formatting: Use standard JS `Intl.NumberFormat` or simple division

  **WHY Each Reference Matters**:
  - digital-assets-tab.tsx: The file you're modifying - understand current structure
  - media-gallery.tsx: Shows how to query media for a collection
  - Design HTML: The exact visual target to match

  **Acceptance Criteria**:
  - [ ] Navigate to Digital Assets tab on an object with documents
  - [ ] Documents show with file icon, name, type (e.g., "PDF"), and size (e.g., "2.4 MB")
  - [ ] Download icon links to document URL (opens in new tab)
  - [ ] External links still display as before
  - [ ] Empty state shows if no documents and no links
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(objects): show documents in Digital Assets tab`
  - Files: `apps/app/src/app/[locale]/(dashboard)/objects/[id]/_components/digital-assets-tab.tsx`
  - Pre-commit: `bun run typecheck`

---

- [ ] 3. Enhance Logs Tab with colored badges, avatars, and change details

  **What to do**:
  - Add user avatar images using Avatar component (use userImage if available)
  - Add colored action type badges based on action string patterns:
    - Actions containing "moved"/"move" → indigo badge
    - Actions containing "added"/"add"/"create" → emerald badge
    - Actions containing "update"/"edit"/"change" → amber badge
    - Default → neutral/gray badge
  - Parse and display `changes` field when present:
    - If object with `previous`/`new` keys: show as "Previous: X"
    - If object with `fileName`: show as "File: filename"
    - Otherwise: show JSON stringified for debugging
  - Match design styling for table layout

  **Must NOT do**:
  - Do NOT modify the backend query
  - Do NOT change how audit logs are created
  - Do NOT add pagination (out of scope)

  **Parallelizable**: YES (with task 2)

  **References**:

  **Pattern References**:
  - `apps/app/src/app/[locale]/(dashboard)/objects/[id]/_components/logs-tab.tsx` - Current implementation to modify
  - `apps/app/src/app/[locale]/(dashboard)/objects/[id]/_components/record-context-sidebar.tsx:220-245` - Avatar usage pattern
  - `/Users/marius/Developer/ml/object-page-content-design.html:1136-1243` - Design HTML for Logs tab

  **API References**:
  - `api.auditLog.getByEntity` returns: `{ _id, action, timestamp, userName, changes }`
  - `changes` field is `v.any()` - handle defensively

  **Type References**:
  - Avatar component from `@v1/ui/avatar`
  - Badge colors: Use existing Tailwind classes (bg-indigo-500/10, text-indigo-400, etc.)

  **WHY Each Reference Matters**:
  - logs-tab.tsx: The file you're modifying
  - record-context-sidebar.tsx: Shows Avatar usage pattern in this codebase
  - Design HTML: Exact visual target with color codes

  **Acceptance Criteria**:
  - [ ] User avatars show image when available, initials fallback
  - [ ] Action badges show in correct colors:
    - "Moved Object to..." → indigo
    - "Added Record..." → emerald
    - "Updated Valuation" → amber
  - [ ] Previous values display when changes field has them
  - [ ] Table layout matches design (Date | User | Action Details columns)
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(objects): enhance Logs tab with badges, avatars, and changes`
  - Files: `apps/app/src/app/[locale]/(dashboard)/objects/[id]/_components/logs-tab.tsx`
  - Pre-commit: `bun run typecheck`

---

- [ ] 4. Add Record Verified badge to sidebar footer

  **What to do**:
  - Modify RecordContextSidebar to accept collection prop (need verified, verifiedBy)
  - Query verifier user details when verified is true (name for display)
  - Add conditional badge above Edit/Share buttons when verified
  - Style badge with green/emerald colors, ShieldCheck icon
  - Show "Record Verified" with subtitle "Approved by [Name]"

  **Must NOT do**:
  - Do NOT add verification toggle/button (that's edit page)
  - Do NOT show badge when not verified
  - Do NOT crash if verifiedBy user is deleted (show "Unknown")

  **Parallelizable**: NO (depends on schema)

  **References**:

  **Pattern References**:
  - `apps/app/src/app/[locale]/(dashboard)/objects/[id]/_components/record-context-sidebar.tsx` - File to modify
  - `apps/app/src/app/[locale]/(dashboard)/objects/[id]/page.tsx:851-859` - How sidebar is called with props
  - `/Users/marius/Developer/ml/object-page-content-design.html:1365-1380` - Design HTML for verified badge

  **API References**:
  - `api.users.get` or similar to fetch verifier name
  - Collections data already passed to sidebar contains new verified fields

  **Icon References**:
  - `ShieldCheck` from lucide-react (matches design)

  **WHY Each Reference Matters**:
  - record-context-sidebar.tsx: The file you're modifying
  - page.tsx: Shows how to pass additional props to sidebar
  - Design HTML: Exact visual target for the badge

  **Acceptance Criteria**:
  - [ ] Badge shows only when collection.verified is true
  - [ ] Badge shows verifier name (or "Curator" if name unavailable)
  - [ ] Badge has green/emerald styling with ShieldCheck icon
  - [ ] Badge positioned above Edit/Share buttons in footer
  - [ ] No badge visible when collection is not verified
  - [ ] No error if verifiedBy references deleted user
  - [ ] `bun run typecheck` passes

  **Commit**: YES
  - Message: `feat(objects): add Record Verified badge to sidebar`
  - Files: `apps/app/src/app/[locale]/(dashboard)/objects/[id]/_components/record-context-sidebar.tsx`, `apps/app/src/app/[locale]/(dashboard)/objects/[id]/page.tsx`
  - Pre-commit: `bun run typecheck`

---

- [ ] 5. Final verification and cleanup

  **What to do**:
  - Run full typecheck: `bun run typecheck`
  - Run linter: `bun run lint`
  - Visual comparison against design HTML for each modified component
  - Test with various data states (verified/unverified, with/without documents, etc.)

  **Must NOT do**:
  - Do NOT merge without all checks passing
  - Do NOT skip edge case testing

  **Parallelizable**: NO (final step)

  **References**:

  **Test Pages**:
  - `/objects/[id]` - Main object detail page
  - `/Users/marius/Developer/ml/object-page-content-design.html` - Reference design

  **Acceptance Criteria**:
  - [ ] `bun run typecheck` → 0 errors
  - [ ] `bun run lint` → 0 errors (warnings acceptable)
  - [ ] Digital Assets tab shows documents with sizes
  - [ ] Logs tab shows colored badges and user avatars
  - [ ] Verified badge appears in sidebar when applicable
  - [ ] All existing functionality still works

  **Commit**: NO (verification only)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(schema): add verification fields to collections table` | `packages/backend/convex/schema.ts` | `bunx convex dev` |
| 2 | `feat(objects): show documents in Digital Assets tab` | `digital-assets-tab.tsx` | `bun run typecheck` |
| 3 | `feat(objects): enhance Logs tab with badges, avatars, and changes` | `logs-tab.tsx` | `bun run typecheck` |
| 4 | `feat(objects): add Record Verified badge to sidebar` | `record-context-sidebar.tsx`, `page.tsx` | `bun run typecheck` |

---

## Success Criteria

### Verification Commands
```bash
bun run typecheck  # Expected: 0 errors
bun run lint       # Expected: 0 errors, warnings ok
bunx convex dev    # Expected: Schema push success (in packages/backend)
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All commits made with correct messages
- [ ] Visual match with design HTML confirmed
