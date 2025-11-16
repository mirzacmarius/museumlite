# Location Management UI/UX Improvements

## Overview
Replace the current basic collapsible tree with a modern, professional tree component using `@headless-tree/react` and add inline action buttons for better UX.

## Key Improvements

### 1. **Install Dependencies**
- Add `@headless-tree/core` and `@headless-tree/react` packages
- Install tree component from @coss registry: `npx shadcn@latest add https://coss.com/origin/r/tree.json`

### 2. **Replace LocationTree Component**
Transform `location-tree.tsx` to use @headless-tree with:
- **Better visual hierarchy** with proper indentation lines (like the registry example)
- **Smooth expand/collapse** animations with folder icons
- **Keyboard navigation** support (built into @headless-tree)
- **Initial expanded state** for first-level items

### 3. **Add Inline Action Buttons**
Each location row will have small icon buttons (visible on hover):
- **Edit** (Pencil icon) - navigates to edit page
- **Add Child** (Plus icon) - quick dialog to add child location
- **Move** (Move icon) - dialog to select new parent location
- **Delete** (Trash icon) - confirmation dialog for deletion

Action buttons will:
- Only show with proper permissions (PermissionGate)
- Appear on hover to reduce clutter
- Use Tooltip component for clarity
- Be disabled for deactivated locations

### 4. **Add Quick Add Child Dialog**
Create new `add-child-location-dialog.tsx`:
- Simplified inline form (name, type, basic info)
- Pre-fills parent location
- Quick creation without navigation

### 5. **Add Move Location Dialog**
Create new `move-location-dialog.tsx`:
- Tree selector for new parent location
- Prevents circular references (built into backend validation)
- Shows current hierarchy path

### 6. **Visual Enhancements**
- Folder/FolderOpen icons for expandable items
- MapPin/Building2 icons based on location type
- Visual indentation lines (using CSS grid pattern)
- Hover states and smooth transitions
- Better spacing and typography

## Files to Modify
1. `apps/app/src/app/[locale]/(dashboard)/locations/_components/location-tree.tsx` - Complete rewrite with @headless-tree
2. Create: `apps/app/src/app/[locale]/(dashboard)/locations/_components/add-child-location-dialog.tsx`
3. Create: `apps/app/src/app/[locale]/(dashboard)/locations/_components/move-location-dialog.tsx`
4. Update: `packages/ui/components.json` - Add @coss registry components

## Technical Approach
- Use `useTree` hook from @headless-tree with `syncDataLoaderFeature`, `selectionFeature`, `hotkeysCoreFeature`
- Implement custom data loader that fetches children on-demand
- Preserve existing Convex API calls (`api.locations.list`, `api.locations.create`, `api.locations.update`, `api.locations.deleteLocation`)
- Maintain all permission checks and error handling

## User Experience
- **Before**: Basic collapse/expand, navigate away to perform actions
- **After**: Professional tree UI with inline actions, quick operations, better visual hierarchy