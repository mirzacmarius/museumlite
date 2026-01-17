# Plan: Modules Settings Page

## Overview
Create Settings > Modules page to allow users to enable/disable collection modules.

## Requirements
- New Modules page under Settings
- List all modules: accounts, fine_art, wine, automotive, natural_history, archive, library
- Gate toggles by `organization.manage_settings` permission
- Show descriptions and icons for each module
- No confirmation dialogs needed
- Library module gated by Library integration subscription

## Tasks

- [x] Create modules page at `apps/app/src/app/[locale]/(dashboard)/settings/modules/page.tsx`
  - Use existing integrations page as reference pattern
  - Include all 7 modules with icons and descriptions
  - Use `organizations.update` mutation to toggle `settings.enabledModules`
  - Gate library module by checking `integrations.getEnabled` includes "library"
  - Show "View Integrations" link for locked library module

- [x] Add Modules nav entry to settings layout at `apps/app/src/app/[locale]/(dashboard)/settings/layout.tsx`
  - Add between "Integrations" and "Billing" nav items
  - Use same styling pattern as other nav items

## Reference Files
- `apps/app/src/app/[locale]/(dashboard)/settings/integrations/page.tsx` - UI pattern
- `apps/app/src/app/[locale]/(dashboard)/settings/layout.tsx` - Nav structure
- `packages/backend/convex/schema.ts` - enabledModules field (line 47-58)
