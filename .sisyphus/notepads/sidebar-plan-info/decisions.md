# Decisions - Sidebar Plan Information

## [2026-01-26] Architecture Decisions

### Component Location
**Decision**: Embed `PlanUsageStats` inside `app-sidebar.tsx` (not separate file)
**Reason**: Component is < 200 lines and tightly coupled to sidebar context
**Alternative Considered**: Separate file in `components/` directory
**Why Rejected**: Adds unnecessary file overhead for small component

### Data Fetching
**Decision**: Use `useQuery` with skip pattern (not preloaded query)
**Reason**: Organization ID comes from context, not layout params
**Pattern**: `organizationId ? { organizationId } : "skip"`

### Progress Bar Colors
**Decision**: Static colors per metric (no threshold-based changes)
**Colors**:
- Storage: `bg-indigo-500`
- Objects: `bg-amber-500/80`
- Exports: `bg-emerald-500/80`
**Reason**: Matches HTML reference design exactly

### Null vs Undefined
**Decision**: Convert `null` to `undefined` when passing to component
**Reason**: Context provides `Id | null`, but component expects `Id | undefined`
**Implementation**: `currentOrganizationId ?? undefined`

### Testing Approach
**Decision**: Use `t.run()` for direct DB inserts (not mutations)
**Reason**: Mutations require auth setup, direct inserts are simpler for unit tests
**Trade-off**: Tests don't verify mutation validators, but that's acceptable for query tests

### Lint Fix
**Decision**: Use template literals instead of string concatenation
**Before**: `tier.charAt(0).toUpperCase() + tier.slice(1) + " Plan"`
**After**: `` `${tier.charAt(0).toUpperCase()}${tier.slice(1)} Plan` ``
**Reason**: Biome lint rule `useTemplate` enforces this pattern
