# KPI Card Redesign

## Context
Refactoring `KpiCard` to match the new dashboard design aesthetics (reference: museumlite.aura.build.html).

## Decisions
- **Removed Sparklines**: The new design prioritizes a cleaner look with icon containers and specific typography over the complexity of sparklines.
- **Icon Containers**: Introduced colored backgrounds (`bg-{color}-500/10`) and borders for icons to improve visual hierarchy and brand alignment.
- **Typography Updates**: Switched to `text-[10px] uppercase tracking-wider` for labels to match the "technical/data" aesthetic of the new design.
- **Layout Change**: Moved from a vertical layout with footer to a horizontal `flex` layout for better space utilization.
- **Prop Removal**: Removed `sparklineData` prop to enforce the new design and simplify the component API. Backward compatibility for `change` prop kept but not currently rendered in the main view (as per reference).
