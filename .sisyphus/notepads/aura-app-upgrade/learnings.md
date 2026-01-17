# Aura App Upgrade - Learnings

## [2026-01-17T17:08] Task 1: AuraKpiCard

**What worked:**

- Component structure with forwardRef pattern
- Aura styling: bg-zinc-900/40, border-zinc-800/60, rounded-xl
- Loading skeleton with animate-pulse
- Subpath export in package.json: "./aura": "./src/components/aura/index.ts"

**Conventions discovered:**

- Use cn() utility from @v1/ui/utils for className merging
- Export both component and types: export { Component, type ComponentProps }
- Barrel export pattern in index.ts for clean imports

**Technical notes:**

- Pre-existing typecheck errors in backend/locations.ts and mediaThumbnails.ts (unrelated)
- UI package typecheck is clean for new components
