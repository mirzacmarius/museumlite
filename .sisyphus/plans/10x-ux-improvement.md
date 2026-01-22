# 10x UX Improvement Plan

## Overview

A comprehensive initiative to elevate the museum/library management dashboard from "functional" to "exceptional" across all UX dimensions. This plan addresses loading states, error handling, accessibility, form experience, data discovery, and micro-interactions.

### Current State Assessment

| Area | Current State | Target State |
|------|---------------|--------------|
| **Loading States** | Inconsistent - mix of skeletons, spinners, and plain text | Polished skeleton screens + route-level loading for all pages |
| **Error Handling** | Toasts + inline errors, no route-level error boundaries | Comprehensive error boundaries + recovery flows |
| **Accessibility** | Good aria-label coverage, some keyboard issues | WCAG 2.1 AA compliant |
| **Form Experience** | Zod validation, manual save, mixed patterns | Auto-save, consistent patterns, URL state |
| **Data Discovery** | Good filter/search, URL state not fully utilized | Full URL state persistence + advanced discovery |
| **Micro-interactions** | Basic transitions, optimistic updates | Polished motion design + feedback |

---

## Context

### User Requirements
- **Focus Areas**: All UX dimensions (loading, errors, a11y, forms, data discovery, micro-interactions)
- **Target Users**: Museum/library staff - non-technical users who need intuitive workflows
- **Goal**: 10x improvement in perceived quality and usability

### Research Findings

**Loading States:**
- Skeleton components exist (`SkeletonCard`, `KanbanColumnSkeleton`, `TransportStatusSkeleton`)
- `Loader2` with `animate-spin` is standard for inline loading
- No route-level `loading.tsx` files found - all rely on component Suspense
- `animate-pulse` is used for skeleton backgrounds

**Error Handling:**
- `sonner` for toast notifications
- `react-error-boundary` used in high-risk components only
- No route-level `error.tsx` files
- Mixed form validation patterns (zod + custom backend validation)

**Accessibility:**
- `aria-label` consistently applied to icon buttons
- `focus-visible:ring-ring` on all inputs/buttons
- Some list rows use `onRowClick` with `window.location.href` (breaks middle-click, screen readers)

**Form Experience:**
- `zod` with `zodResolver` for validation
- Modal editing via `Dialog`/`AlertDialog` for quick actions
- Multi-step forms for import workflows
- **No auto-save patterns** found
- **URL state via `nuqs` exists but not fully utilized** - some pages use local React state for filters

**Data Discovery:**
- `EmptyState` component standardized
- Search bar + tab-style filters pattern
- Convex cursor-based pagination ("Load More" pattern)
- View modes (list/grid) with `userPreferences` persistence
- `ColumnConfigDropdown` + `BulkActionsBar` for table controls

**Micro-interactions:**
- Optimistic updates via Convex `withOptimisticUpdate`
- Standard Shadcn/Tailwind transitions

---

## Work Objectives

### Core Objective
Transform the dashboard from a functional but inconsistent interface into a polished, accessible, and intuitive workspace that delights museum/library staff and reduces training time.

### Concrete Deliverables
1. Route-level loading and error boundaries for all dashboard pages
2. Standardized skeleton library and consistent loading states
3. Comprehensive accessibility audit and fixes
4. Form auto-save and improved validation patterns
5. Full URL state persistence for all list pages
6. Enhanced micro-interactions and motion design

### Definition of Done
- [ ] All dashboard pages have route-level `loading.tsx` and `error.tsx`
- [ ] Consistent skeleton usage on all data-fetching pages
- [ ] WCAG 2.1 AA audit passes
- [ ] All filter/search state persists in URL
- [ ] Forms auto-save with visual feedback
- [ ] No `window.location.href` row clicks - all use Link or accessible handlers

---

## Verification Strategy

### Test Infrastructure
- **Infrastructure exists**: YES
- **Framework**: vitest
- **QA approach**: Manual verification + accessibility audit

### Acceptance Criteria Format

For each task, acceptance criteria includes:
1. **Visual verification**: Screenshot of the improved UI
2. **Functional verification**: Test the specific interaction
3. **Accessibility verification**: Axe DevTools or equivalent audit
4. **Cross-page verification**: Check consistency across related pages

---

## Task Flow

```
Loading & Errors → Accessibility → Forms → Data Discovery → Micro-interactions
     ↓                   ↓            ↓              ↓               ↓
  Foundation        Inclusivity    Core Tasks    Information    Polish
```

### Phase 1: Loading & Error Foundation
Tasks 1-6 establish the foundation for all other improvements.

### Phase 2: Accessibility
Tasks 7-10 ensure the app is usable by everyone.

### Phase 3: Form Experience  
Tasks 11-16 improve the most common user actions.

### Phase 4: Data Discovery
Tasks 17-22 make information easy to find and manage.

### Phase 5: Micro-interactions
Tasks 23-28 add polish and delight.

---

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A | 1, 2 | Create shared components first |
| B | 3, 4 | Route files can be done in parallel |
| C | 7, 8 | A11y audit + fixes to onRowClick |
| D | 11, 12 | Form patterns build on each other |

---

## TODOs

### Phase 1: Loading & Error States (Foundation)

- [x] 1. Create route-level loading.tsx for all dashboard segments

  **What to do**:
  - Create `apps/app/src/app/[locale]/(dashboard)/loading.tsx`
  - Add loading.tsx to key sub-routes: accounts, collections, objects, loans, accessions, locations, etc.
  - Use standardized skeleton layout that matches page structure

  **Pattern References**:
  - `packages/ui/src/components/skeleton.tsx` - Base skeleton component
  - `packages/ui/src/components/skeleton-variants.tsx` - SkeletonCard, PageHeaderSkeleton
  - `apps/app/src/app/[locale]/(dashboard)/accessions/accessions-page-skeleton.tsx` - Existing pattern

  **Acceptance Criteria**:
  - [x] Navigate to any dashboard route → See appropriate skeleton loading state
  - [x] Loading animation is smooth (no layout shifts)
  - [x] Matches page structure (header, content area, sidebar if applicable)

- [x] 2. Create route-level error.tsx for all dashboard segments

  **What to do**:
  - Create `apps/app/src/app/[locale]/(dashboard)/error.tsx` with ErrorBoundary
  - Add error.tsx to sub-routes: accounts, collections, objects, loans, accessions, locations
  - Implement error recovery options (retry, go back, contact support)

  **Pattern References**:
  - `apps/app/src/app/[locale]/(dashboard)/loans/_components/admin-overview.tsx:11` - react-error-boundary usage
  - Next.js error.tsx documentation for App Router

  **Acceptance Criteria**:
  - [x] Simulate an error → See friendly error UI (not raw error)
  - [x] "Try Again" button retries the failed action
  - [x] Error details are logged but not exposed to users
  - [x] User can navigate away safely

- [x] 3. Create comprehensive skeleton component library

  **What to do**:
  - Expand `packages/ui/src/components/skeleton.tsx` with:
    - `SkeletonTable` - For table loading states
    - `SkeletonList` - For list/grid loading
    - `SkeletonForm` - For form field placeholders
    - `SkeletonStats` - For KPI card loading
    - `SkeletonTimeline` - For activity feeds

  **Must NOT do**:
  - Create new design system (follow existing Shadcn patterns)
  - Change base skeleton animation (keep `animate-pulse`)

  **Pattern References**:
  - `packages/ui/src/components/skeleton.tsx` - Base implementation
  - `apps/app/src/app/[locale]/(dashboard)/analytics/page.tsx:70-85` - Existing skeleton usage

  **Acceptance Criteria**:
  - [x] All skeleton components use `animate-pulse` consistently
  - [x] Skeletons match real component dimensions
  - [x] No FOUC (Flash of Unstyled Content)

- [x] 4. Standardize inline loading states across app

  **What to do**:
  - Audit all inline spinners and replace with standardized pattern
  - Create `LoadingButton` component that shows spinner inside button
  - Create `InlineLoader` for small loading indicators
  - Add loading states to:
    - All form submission buttons
    - Search inputs with debounce
    - Filter applications
    - Save operations

  **Pattern References**:
  - `apps/app/src/app/[locale]/(dashboard)/accounts/page.tsx:26` - Loader2 import pattern
  - `lucide-react` - Loader2 component with `animate-spin`

  **Acceptance Criteria**:
  - [x] All buttons with async actions show loading state
  - [x] Loading states disable button interaction
  - [x] Loading spinners are consistent in size and color

- [x] 5. Implement page transition animations

  **What to do**:
  - Add `template.tsx` with motion animations for page transitions
  - Use Framer Motion or CSS transitions for smooth navigation
  - Add progress bar for navigation feedback

  **Pattern References**:
  - `apps/app/src/app/[locale]/layout.tsx` - Root layout
  - Next.js `template.tsx` documentation for per-page layouts

  **Acceptance Criteria**:
  - [x] Page transitions feel smooth (no jarring cuts)
  - [x] Navigation feedback (progress bar) shows during load
  - [x] Back/forward navigation is equally smooth

- [x] 6. Create Toast notification system improvements

  **What to do**:
  - Extend sonner configuration with consistent styling
  - Add success/error icons to toasts
  - Add undo/cancel actions to relevant toasts (e.g., delete)
  - Implement toast queue management for multiple notifications

  **Pattern References**:
  - `apps/app/src/app/[locale]/layout.tsx` - Toaster configuration
  - `apps/app/src/app/[locale]/(dashboard)/accounts/page.tsx:25` - sonner import

  **Acceptance Criteria**:
  - [x] All actions that modify data show toast feedback
  - [x] Toast duration matches action importance
  - [x] Actionable toasts (undo) work correctly

### Phase 2: Accessibility (Inclusivity)

- [x] 7. Comprehensive accessibility audit and fixes

  **What to do**:
  - Run axe DevTools on all pages
  - Audit color contrast (especially in dark mode)
  - Check focus order on all interactive elements
  - Verify screen reader announcements for dynamic content

  **Pattern References**:
  - `apps/app/src/app/[locale]/(dashboard)/accessions/page.tsx` - Complex page to audit
  - `apps/app/src/app/[locale]/(dashboard)/objects/page.tsx` - Data-heavy page

  **Acceptance Criteria**:
  - [x] Zero critical accessibility violations
  - [x] Color contrast ratio ≥ 4.5:1 for text
  - [x] All interactive elements have visible focus state

- [x] 8. Fix all onRowClick handlers to use accessible patterns

  **What to do**:
  - Find all `onClick={() => window.location.href}` patterns
  - Replace with `Link` component or proper button wrappers
  - Ensure keyboard navigation works (Enter to select, Space to toggle)
  - Add `aria-label` to row actions

  **Pattern References**:
  - `apps/app/src/app/[locale]/(dashboard)/accounts/page.tsx:288` - Link-based row navigation (good example)

  **Files to Fix** (estimated):
  - Collections list rows
  - Objects list rows  
  - Loans list rows
  - Locations list rows

  **Acceptance Criteria**:
  - [x] Middle-click opens in new tab
  - [x] Right-click context menu works
  - [x] Screen readers announce row selection properly
  - [x] Keyboard users can navigate rows

- [x] 9. Implement Skip Navigation pattern

  **What to do**:
  - Add "Skip to main content" link at top of all pages
  - Add "Skip to search" link
  - Add "Skip to sidebar" link where applicable
  - Make skip links visible on focus only

  **Pattern References**:
  - WCAG 2.4.1 - Bypass Blocks
  - `apps/app/src/app/[locale]/layout.tsx` - Root layout for global additions

  **Acceptance Criteria**:
  - [x] Tab key shows skip links on first focus
  - [x] Skip links disappear after use
  - [x] All major sections are skippable

- [x] 10. Enhance keyboard navigation and focus management

  **What to do**:
  - Add keyboard shortcuts for common actions (Ctrl+N for new item)
  - Implement focus trapping in modals/dialogs
  - Add focus return after dialog closes (return focus to trigger)
  - Document keyboard shortcuts in help menu

  **Pattern References**:
  - `apps/app/src/components/deaccession-dialog.tsx` - Dialog pattern
  - `apps/app/src/app/[locale]/(dashboard)/settings/organization/page.tsx:600` - Dialog usage

  **Acceptance Criteria**:
  - [x] Modal dialogs trap focus correctly
  - [x] Focus returns to trigger element after dialog closes
  - [x] Keyboard shortcuts are discoverable (documented)
  - [x] No focus loss during page transitions

### Phase 3: Form Experience (Core Tasks)

- [x] 11. Implement form auto-save pattern

  **What to do**:
  - Create `useAutoSave` hook for form state persistence
  - Add visual indicator (saved/saving icon) in forms
  - Implement debounced auto-save (every 30 seconds or on blur)
  - Add manual save option for important forms

  **Pattern References**:
  - `apps/app/src/app/[locale]/(dashboard)/settings/organization/page.tsx` - Existing form without auto-save
  - `apps/app/src/app/[locale]/(dashboard)/collections/[id]/edit/page.tsx` - Edit form pattern

  **Acceptance Criteria**:
  - [ ] Form changes persist automatically
  - [ ] User sees "Saving..." → "Saved" feedback
  - [ ] Changes survive page refresh
  - [ ] No data loss on browser close

- [x] 12. Standardize form validation error display

  **What to do**:
  - Create `FormError` component for consistent error display
  - Standardize error message placement (below field, not above)
  - Add field-level validation with inline feedback
  - Create validation summary for multi-field errors

  **Pattern References**:
  - `apps/app/src/app/[locale]/(dashboard)/settings/organization/page.tsx:180` - Custom validation example
  - `zod` validation patterns used throughout

  **Acceptance Criteria**:
  - [ ] All form validation errors look consistent
  - [ ] Errors are visible and clearly associated with fields
  - [ ] First error is auto-focused on form submit
  - [ ] Error messages are user-friendly (no jargon)

- [x] 13. Implement inline field validation

  **What to do**:
  - Add real-time validation as users type (debounced)
  - Show success state (green checkmark) when field is valid
  - Show error state immediately on blur
  - Validate unique constraints (e.g., slug uniqueness) via API

  **Pattern References**:
  - `apps/app/src/app/[locale]/(dashboard)/settings/organization/page.tsx:180-197` - Template name validation

  **Acceptance Criteria**:
  - [ ] Users get feedback within 300ms of typing
  - [ ] Valid fields show success indicator
  - [ ] Server-side unique checks work correctly

- [x] 14. Create multi-step wizard component

  **What to do**:
  - Build reusable `Wizard` component with steps, progress, and navigation
  - Add step validation before proceeding
  - Implement step persistence (return to last incomplete step)
  - Add "Save and continue later" functionality

  **Pattern References**:
  - `apps/app/src/app/[locale]/(dashboard)/accessions/new/page.tsx` - Existing multi-step pattern
  - `apps/app/src/app/[locale]/(dashboard)/collections/new/page.tsx` - Another multi-step example

  **Acceptance Criteria**:
  - [ ] Wizard works consistently across all multi-step forms
  - [ ] Progress is clearly shown
  - [ ] Validation prevents moving forward unless complete
  - [ ] Users can navigate back and edit

- [x] 15. Improve save/cancel button UX

  **What to do**:
  - Add "Save" button to sticky footer on long forms
  - Implement "unsaved changes" prompt on navigation
  - Add "Cancel" with confirmation if changes exist
  - Add "Save & Add Another" pattern for efficiency

  **Pattern References**:
  - `apps/app/src/app/[locale]/(dashboard)/accounts/new/page.tsx` - New account form
  - `apps/app/src/app/[locale]/(dashboard)/collections/new/page.tsx` - Collection form

  **Acceptance Criteria**:
  - [ ] Save button always accessible (sticky or prominent)
  - [ ] Unsaved changes warning prevents accidental loss
  - [ ] Confirmation dialog is clear and actionable

- [ ] 16. Create rich text editor for notes fields (DEFERRED - requires TipTap/Lexical integration)

  **What to do**:
  - Implement markdown editor with toolbar (bold, italic, lists, links)
  - Add preview mode
  - Auto-save draft while editing
  - Support copy/paste from documents

  **Pattern References**:
  - `apps/app/src/app/[locale]/(dashboard)/collections/[id]/page.tsx` - Notes field location

  **Acceptance Criteria**:
  - [ ] Rich text editing works without formatting issues
  - [ ] Markdown syntax support for power users
  - [ ] Preview shows rendered content accurately

### Phase 4: Data Discovery (Information Architecture)

- [ ] 17. Migrate all list page filters to URL state

  **What to do**:
  - Audit all list pages using local state for filters
  - Migrate filter state to URL using `nuqs`
  - Add filter persistence (bookmarkable URLs)
  - Implement "share filtered view" functionality

  **Pattern References**:
  - `apps/app/src/app/[locale]/(dashboard)/objects/page.tsx` - Uses local state (needs migration)
  - `apps/app/src/app/[locale]/(dashboard)/loans/page.tsx` - Good example to follow

  **Pages to Fix**:
  - Objects list
  - Collections list
  - Accessions list
  - Loans list
  - Accounts list

  **Acceptance Criteria**:
  - [ ] Filter state persists on refresh
  - [ ] Users can share filtered URLs
  - [ ] Browser back/forward works with filters
  - [ ] Deep links to filtered views work

- [ ] 18. Implement advanced search with filters panel

  **What to do**:
  - Create collapsible "Advanced Filters" panel on list pages
  - Add date range picker for temporal queries
  - Add multi-select for tags/categories
  - Add "Save filter preset" functionality

  **Pattern References**:
  - `apps/app/src/app/[locale]/(dashboard)/activity/_components/activity-filters.tsx` - Reusable filter pattern

  **Acceptance Criteria**:
  - [ ] Advanced filters are discoverable
  - [ ] Date ranges work correctly
  - [ ] Users can save and reuse filter presets
  - [ ] Filter combinations work correctly

- [ ] 19. Enhance empty states with contextual help

  **What to do**:
  - Audit all empty states for completeness
  - Add "getting started" guidance in empty states
  - Add video tutorials or documentation links
  - Implement "first run" wizard for new organizations

  **Pattern References**:
  - `packages/ui/src/components/empty-state.tsx` - Base component
  - `apps/app/src/app/[locale]/(dashboard)/accounts/page.tsx:236-252` - Good empty state example

  **Acceptance Criteria**:
  - [ ] Empty states guide users to next action
  - [ ] Contextual help is relevant to current view
  - [ ] First-time users see onboarding guidance

- [ ] 20. Implement virtual scrolling for large lists

  **What to do**:
  - Add `react-window` or similar for virtual scrolling
  - Implement on-demand data loading
  - Add "jump to" navigation for large datasets
  - Optimize performance for 1000+ item lists

  **Pattern References**:
  - `apps/app/src/app/[locale]/(dashboard)/objects/page.tsx` - Large list example

  **Acceptance Criteria**:
  - [ ] Lists with 1000+ items scroll smoothly
  - [ ] No memory bloat with large datasets
  - [ ] Keyboard navigation works with virtual list

- [ ] 21. Add bulk operations for list management

  **What to do**:
  - Enhance `BulkActionsBar` component with more actions
  - Add bulk edit functionality
  - Implement bulk export (CSV, Excel)
  - Add "select all" with "select visible" toggle

  **Pattern References**:
  - `apps/app/src/app/[locale]/(dashboard)/objects/page.tsx` - Existing bulk actions pattern

  **Acceptance Criteria**:
  - [ ] Bulk actions bar appears on selection
  - [ ] Bulk delete shows confirmation
  - [ ] Bulk operations show progress
  - [ ] Bulk edit opens modal with mass updates

- [ ] 22. Implement advanced table features

  **What to do**:
  - Add column resize functionality
  - Add column reorder (drag and drop)
  - Implement sticky headers for scrolling
  - Add row selection via checkbox column

  **Pattern References**:
  - `apps/app/src/app/[locale]/(dashboard)/objects/page.tsx` - Table implementation
  - `ColumnConfigDropdown` component reference

  **Acceptance Criteria**:
  - [ ] Columns can be resized without breaking layout
  - [ ] Column order persists to user preferences
  - [ ] Headers stay visible during scroll
  - [ ] Checkbox column enables bulk selection

### Phase 5: Micro-interactions (Polish)

- [ ] 23. Implement button micro-interactions

  **What to do**:
  - Add subtle scale animation on button press
  - Add loading state transition
  - Add success feedback animation (green check pulse)
  - Add hover state for icon buttons

  **Pattern References**:
  - `apps/app/src/app/[locale]/(dashboard)/accounts/page.tsx:124-138` - Button patterns

  **Acceptance Criteria**:
  - [ ] Buttons feel responsive to touch/click
  - [ ] Loading state transition is smooth
  - [ ] Success actions feel rewarding

- [ ] 24. Create hover card/preview interactions

  **What to do**:
  - Add hover cards for entity previews (hover over item to see details)
  - Implement "quick view" for list items
  - Add context menu on right-click
  - Implement tooltip system for all icons and abbreviations

  **Pattern References**:
  - `apps/app/src/components/info-tooltip.tsx` - Existing tooltip pattern

  **Acceptance Criteria**:
  - [ ] Hover cards appear within 200ms
  - [ ] Quick view provides essential info without opening item
  - [ ] Tooltips explain non-obvious UI elements

- [ ] 25. Implement drag and drop for reordering

  **What to do**:
  - Add drag-and-drop for list reordering (e.g., collection groups, locations)
  - Add visual feedback during drag (ghost element, drop zone)
  - Implement reorder persistence
  - Add keyboard reordering (up/down arrows, space to grab)

  **Pattern References**:
  - `apps/app/src/app/[locale]/(dashboard)/collections/page.tsx` - Collection groups that could be reordered

  **Acceptance Criteria**:
  - [ ] Drag and drop works smoothly
  - [ ] Drop zone is clearly indicated
  - [ ] Order persists after refresh
  - [ ] Keyboard users can also reorder

- [ ] 26. Add notification badge animations

  **What to do**:
  - Animate notification badge on new items
  - Add "pulse" animation for unread items
  - Implement notification preview on bell hover
  - Add sound option for important notifications

  **Pattern References**:
  - `apps/app/src/components/notification-bell.tsx` - Notification pattern

  **Acceptance Criteria**:
  - [ ] New notification badges animate
  - [ ] Unread items have visual indicator
  - [ ] Notification preview works on hover

- [ ] 27. Implement optimistic UI for all mutations

  **What to do**:
  - Audit all mutations for optimistic update coverage
  - Add optimistic updates where missing
  - Implement rollback animation for failed updates
  - Add "undo" capability for destructive actions

  **Pattern References**:
  - `apps/app/src/app/[locale]/(dashboard)/accounts/page.tsx:50-52` - Optimistic pattern via Convex

  **Acceptance Criteria**:
  - [ ] UI updates immediately on action
  - [ ] Failed updates show clear error and rollback
  - [ ] Undo works within time window (e.g., 5 seconds)

- [ ] 28. Create celebration animations for achievements

  **What to do**:
  - Add subtle celebration for first item created
  - Implement milestone badges (10 items, 100 items, etc.)
  - Add onboarding completion animation
  - Add "power user" achievement system (hidden)

  **Pattern References**:
  - `apps/app/src/app/[locale]/(dashboard)/accounts/page.tsx:245-250` - Empty state with create action

  **Acceptance Criteria**:
  - [ ] First creation feels special (confetti or animation)
  - [ ] Milestones are rewarding
  - [ ] Achievements are discoverable

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 3 | `feat(ui): add comprehensive skeleton component library` | packages/ui/src/components/skeleton*.tsx | `bun run lint` |
| 4 | `feat(ui): standardize inline loading states` | packages/ui/src/components/loading-*.tsx | `bun run typecheck` |
| 5 | `feat(layout): add page transition animations` | apps/app/src/app/\[locale\]/(dashboard)/template.tsx | Manual verification |
| 7 | `fix(a11y): comprehensive accessibility audit fixes` | Multiple files | Axe DevTools audit |
| 11 | `feat(forms): implement auto-save pattern` | hooks/useAutoSave.ts, form components | Manual testing |
| 17 | `feat(url-state): migrate filters to URL state` | List pages (objects, collections, etc.) | URL persistence test |
| 23 | `feat(ui): add button micro-interactions` | Button components | Visual verification |

---

## Success Criteria

### Quantitative Metrics
- **Page Load Time**: P95 < 2s (Core Web Vitals)
- **Interaction Latency**: < 100ms feedback on user actions
- **Error Rate**: < 0.1% form validation errors
- **Accessibility**: 100% WCAG 2.1 A, 95% AA

### Qualitative Metrics
- **User Satisfaction**: Reduced support tickets for "how do I..."
- **Task Completion**: Faster time-to-task for common workflows
- **Perceived Quality**: App feels polished and professional

---

## Dependencies

1. **Phase 1** (Loading/Errors) → Required foundation for all other phases
2. **Phase 2** (A11y) → Should be completed early for testing
3. **Phase 3** (Forms) → Depends on Phase 1 for loading states
4. **Phase 4** (Discovery) → Depends on Phase 1 and URL state pattern
5. **Phase 5** (Polish) → Can be done in parallel or last

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Performance degradation from animations | Medium | Test on low-end devices, use CSS transforms |
| Form auto-save conflicts with validation | Medium | Clear visual state for auto-save vs validation |
| Accessibility fixes break layout | Medium | Test on multiple screen sizes |
| URL state migration breaks existing links | Low | Maintain backward compatibility, redirect old URLs |

---

## Timeline Estimate

| Phase | Tasks | Estimated Effort |
|-------|-------|------------------|
| Phase 1: Loading & Error | 6 tasks | 2-3 days |
| Phase 2: Accessibility | 4 tasks | 2-3 days |
| Phase 3: Forms | 6 tasks | 4-5 days |
| Phase 4: Data Discovery | 6 tasks | 3-4 days |
| Phase 5: Micro-interactions | 6 tasks | 2-3 days |
| **Total** | **28 tasks** | **~15-18 days** |

---

## Next Steps

1. User reviews and prioritizes this plan
2. Start with Phase 1 (foundation) or Phase 3 (forms) based on user preference
3. Set up tracking for metrics (Core Web Vitals, error rates)
4. Begin implementation with small wins (loading states) to build momentum
