# CONVEX BACKEND KNOWLEDGE

## OVERVIEW

Core backend: 37 function files, 1391-line schema, library integration. All API logic lives here.

**Rules Reference**: See `/.cursor/rules/convex_rules.mdc` for comprehensive Convex guidelines with full examples (validators, HTTP endpoints, pagination, file storage, crons, chat-app example).

## STRUCTURE

```
convex/
├── schema.ts           # 50+ tables, indexes, search indexes
├── http.ts             # HTTP routes (auth callbacks, webhooks)
├── auth.ts             # Google OAuth config
├── library/            # Library integration (11 files)
│   ├── circulation.ts  # Checkout/checkin
│   ├── patrons.ts      # Member management
│   ├── holds.ts        # Reservations
│   └── fines.ts        # Fee tracking
└── utils/              # Shared helpers
```

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Add query/mutation | Domain file (e.g., `loans.ts`) | Follow existing patterns |
| Add HTTP endpoint | `http.ts` | Use `httpAction` |
| Add scheduled job | Create cron in domain file | Use `crons.interval` |
| Add table | `schema.ts` | Include indexes |
| Library feature | `library/*.ts` | Separate module |
| Accession numbers | `utils/accessionCounter.ts` | Auto-generation logic |

## FUNCTION SYNTAX (MANDATORY)

```typescript
// ALWAYS this format - no exceptions
export const myQuery = query({
  args: { id: v.id("collections") },
  returns: v.object({ title: v.string() }),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    return { title: doc?.title ?? "" };
  },
});
```

## CONVENTIONS

### Queries
- Use `.withIndex()` not `.filter()` for performance
- Order matters: define indexes in schema for query patterns
- Use `.unique()` for single document retrieval

### Mutations
- Validate entity existence before operations
- Use `ctx.db.patch` for partial updates
- Return `null` with `returns: v.null()` when no return value

### Actions
- Add `"use node";` at top if using Node.js modules
- No `ctx.db` access - use `ctx.runQuery`/`ctx.runMutation`
- Minimize calls to queries/mutations (each is a transaction)

### Internal vs Public
- `query`/`mutation`/`action`: Public API (exposed to clients)
- `internalQuery`/`internalMutation`/`internalAction`: Private (server-only)
- Reference via `api.file.function` (public) or `internal.file.function` (private)

## ANTI-PATTERNS

| Pattern | Fix |
|---------|-----|
| `v.bigint()` | `v.int64()` |
| `ctx.storage.getMetadata()` | Query `_storage` system table |
| `crons.hourly()` | `crons.interval({ hours: 1 }, ...)` |
| Missing `returns` validator | Add `returns: v.null()` minimum |
| `.filter()` in queries | Add index, use `.withIndex()` |
| Returning `undefined` | Return `null` explicitly |

## SCHEMA PATTERNS

### Index Naming
Include all fields: `by_organization_and_status` for `["organizationId", "status"]`

### Search Indexes
```typescript
.searchIndex("search_index", {
  searchField: "title",
  filterFields: ["organizationId", "status"],
})
```

### Discriminated Unions
```typescript
status: v.union(
  v.literal("pending"),
  v.literal("active"),
  v.literal("completed"),
)
```

## KEY TABLES

| Table | Purpose | Key Indexes |
|-------|---------|-------------|
| `collections` | Main catalog items | `by_organization`, `by_accessionNumber` |
| `loans` | Loan records | `by_organization_and_status` |
| `accounts` | Lenders/borrowers | `by_organization` |
| `libraryItems` | Library catalog | `by_isbn`, `by_barcode` |
| `patrons` | Library members | `by_cardNumber` |
| `circulations` | Checkout records | `by_patron_and_status` |
| `auditLog` | Activity tracking | `by_organization`, `by_timestamp` |

## TESTING

```typescript
// packages/backend/convex/*.test.ts
import { convexTest } from "convex-test";
import schema from "./schema";

describe("feature", () => {
  it("works", async () => {
    const t = convexTest(schema);
    // Setup and assertions
  });
});
```

Run: `bun run test` (uses edge-runtime environment)

## NOTES

- HTTP routes in `http.ts` handle auth callbacks + Polar webhooks
- File storage: use `ctx.storage.getUrl()`, query `_storage` for metadata
- Pagination: use `paginationOptsValidator` from `convex/server`
- Type circular references: add explicit type annotation on return value
