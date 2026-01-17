# Learnings
- `packages/ui` uses a `utils` folder with `index.ts` instead of `lib/utils.ts`.
- `bun run typecheck` in `packages/ui` checks reachable code including `packages/backend` due to imports in `feature-guard.tsx`.
- There are pre-existing type errors in `packages/backend` (`locations.ts`, `mediaThumbnails.ts`) that cause `bun run typecheck` to fail in `packages/ui`.

# Decisions
- Created `AuraGlassPanel` in `packages/ui/src/components/aura/glass-panel.tsx`.
- Used `../../utils` for `cn` import to match existing patterns.
- Exported from `packages/ui/src/components/aura/index.ts`.
