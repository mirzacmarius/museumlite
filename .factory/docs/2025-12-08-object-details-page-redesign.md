## Overview
Adapt the object details page (`apps/app/src/app/[locale]/(dashboard)/objects/[id]/page.tsx`) to match the new HTML design, focusing on enhanced visual hierarchy and parent/sibling object visualization.

## Key Changes

### 1. Hero Section Enhancements
- Add **visibility badge** (Public/Private) next to status badge with emerald/red styling
- Move **alternate accession numbers** to hero row with styled chips showing prefix labels (ID:, LC:, etc.)
- Enhance **parent/sibling visualization** with tree-like structure:
  - Parent object shown as pill with thumbnail avatar
  - Siblings shown as circular avatars with connector lines
  - Current object highlighted with accent ring
  - "+N" indicator for additional siblings

### 2. Tab Navigation
- Keep existing 8 tabs (General, Physical, Media, Digital Assets, Provenance, Conservation, Exhibitions, Logs)
- Update styling: border-b-2 indicator with accent color for active tab
- Sticky positioning below header

### 3. Tab Content Updates
**General Tab:**
- Keep Classification & Metadata card structure
- Add download status indicator at bottom

**Physical Tab:**
- 3-column stats grid (Materials, Technique, Condition)
- Dimensions grid with large font numbers
- Inscriptions & Marks section

**Media Tab:**
- Gallery grid with 4 columns on desktop
- Hover overlay with expand icon

**Provenance Tab:**
- Acquisition Information card (Method, Source/Donor, Date, Credit Line)
- Ownership History timeline with connected nodes

**Other tabs:** Minor styling refinements

### 4. Right Sidebar (RecordContextSidebar)
- Tags section with clickable chips
- Related Objects with thumbnails and relationship labels
- Recent Activity timeline
- "Record Verified" footer badge

## Files to Modify
1. `apps/app/src/app/[locale]/(dashboard)/objects/[id]/page.tsx` - Main page with hero, tabs, tab content
2. `apps/app/src/app/[locale]/(dashboard)/objects/[id]/_components/record-context-sidebar.tsx` - Right sidebar refinements
3. `apps/app/src/app/[locale]/(dashboard)/objects/[id]/_components/media-gallery.tsx` - Gallery styling updates

## Color Mapping (HTML -> Project)
- `bg-zinc-950` -> `bg-background`
- `bg-zinc-900/20` -> `bg-secondary/20`
- `border-zinc-800/60` -> `border-border/60`
- `text-zinc-100/200` -> `text-foreground`
- `text-zinc-400/500` -> `text-muted-foreground`
- `text-indigo-*` -> `text-accent`
- `border-indigo-500` -> `border-accent`

## Implementation Order
1. Update hero section with visibility badge and alternate accession numbers
2. Enhance parent/sibling object visualization
3. Refine tab navigation styling
4. Update tab content components (General, Physical, Provenance)
5. Update Media gallery styling
6. Refine right sidebar

## Note
The existing codebase already has most of the structure - this is primarily a styling and visual refinement task with enhanced parent/sibling visualization being the main new feature.