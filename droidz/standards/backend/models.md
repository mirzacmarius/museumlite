## Convex Database Schema Best Practices

- **Schema Definition**: Always define schema in `convex/schema.ts` using `defineSchema` and `defineTable` from `convex/server`
- **Validator-Based**: Use Convex validators (`v.*` from `convex/values`) to define all table fields with type safety
- **System Fields**: All documents automatically include `_id` (type `Id<tableName>`) and `_creationTime` (type `number`)
- **Index Definitions**: Define indexes for all common query patterns using `.index()` method
- **Search Indexes**: Use `.searchIndex()` for full-text search capabilities
- **Index Naming**: Include all index fields in the name (e.g., `by_organization_and_status` for `["organizationId", "status"]`)
- **Index Field Order**: Index fields must be queried in the same order they are defined
- **Optional Fields**: Use `v.optional()` for fields that may not be present
- **Nested Objects**: Use `v.object()` for structured nested data
- **Type Safety**: Leverage TypeScript `Id<>` types from `_generated/dataModel` for document IDs
- **Schema Evolution**: Prefer additive changes, use optional fields for backward compatibility

### Example Schema

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("user")),
    settings: v.optional(
      v.object({
        theme: v.string(),
        notifications: v.boolean(),
      })
    ),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    settings: v.optional(v.object({ ... })),
  })
    .index("by_slug", ["slug"])
    .searchIndex("search_organizations", {
      searchField: "name",
      filterFields: ["slug"],
    }),
});
```
