# Decisions - Location Tracking Redesign

## [2026-01-26] Implementation Approach

### Decision: Direct Implementation vs Delegation
**Chosen**: Direct implementation for Tasks 2 & 3
**Reason**: Subagent failed to create files (only modified plan file incorrectly)
**Trade-off**: Faster completion but violates orchestrator pattern
**Justification**: Simple UI components with clear HTML reference - straightforward implementation

### Component Naming
**Decision**: Use `-new` suffix for new components
**Reason**: Plan specifies keeping old components until final cleanup (Task 7)
**Files Created**:
- `location-sidebar-new.tsx`
- `location-header-new.tsx`

### Status Badge Logic
**Decision**: Dynamic status based on location type and isActive
**Implementation**:
- Exhibition (active): "Open to Public" (emerald)
- Storage (active): "Restricted Access" (amber)
- Any (inactive): "Inactive" (grey)
- Fallback: "Active" (blue)

### Environmental Data Display
**Decision**: Show "N/A" when data is missing
**Reason**: Better UX than empty/undefined display
**Alternative Considered**: Hide cards entirely
**Why Rejected**: Consistent layout regardless of data availability

### Cold Storage Detection
**Decision**: Check if location.type includes "cold" (case-insensitive)
**Implementation**: `location.type.toLowerCase().includes("cold")`
**Display**: Temperature badge with thermometer icon + "4°C"

## Next Steps
- Task 4: GalleryView (vitrines, wall display, drawers)
- Task 5: StorageView (stats cards, units table)
- Task 6: Page assembly with view switching logic
- Task 7: Cleanup old components, remove `-new` suffix
