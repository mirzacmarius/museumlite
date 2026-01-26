# Learnings - Sidebar Plan Information

## [2026-01-26] Task Completion

### Patterns Discovered

**Convex Query Pattern**:
- Always include both `args` and `returns` validators
- Use `.withIndex()` for performance (not `.filter()`)
- Query return type: `v.object()` with explicit structure
- Null handling: `v.union(v.number(), v.null())` for optional limits

**React Component Pattern**:
- Skip pattern for optional queries: `organizationId ? { organizationId } : "skip"`
- Null vs undefined: Context provides `null`, but component props use `undefined`
- Conversion: `currentOrganizationId ?? undefined`
- Loading states: Show skeleton with same structure as final component

**Testing Pattern**:
- Use `t.run()` for direct DB inserts (bypasses auth)
- Use `t.withIdentity()` when testing mutations that require auth
- Import pattern: No `.js` extensions needed despite LSP warnings
- Tests run fine with `bun test` even with LSP errors

### Styling Conventions

**Exact classes from HTML reference**:
- Container: `px-4 py-3 bg-zinc-950 border-t border-zinc-800/60`
- Gradient dot: `w-1.5 h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500`
- Metric labels: `text-[10px] text-zinc-500 font-medium`
- Metric values: `text-[10px] text-zinc-400 font-mono`
- Progress bars: Static colors per metric (indigo, amber, emerald)

### Helper Functions

**Formatting utilities**:
```typescript
formatBytes(bytes: number): string // Converts to GB
formatNumber(num: number): string  // Formats large numbers (142k)
calculatePercentage(used, limit): number // For progress bar width
getTierDisplayName(tier): string // "free" → "Free Plan"
```

### Enterprise Tier Handling

- Limit is `null` (not `undefined`)
- Show "Unlimited" text instead of fraction
- Do NOT render progress bar when limit is null
- Hide upgrade button for enterprise tier
