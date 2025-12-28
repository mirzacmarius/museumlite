# Convex API Design

## Overview

Well-designed Convex APIs are intuitive, consistent, type-safe, and leverage real-time reactivity. This standard defines Convex function design principles for building scalable and developer-friendly backends.

## When to Apply

- Designing new Convex functions (queries, mutations, actions)
- Refactoring existing Convex functions
- Creating function documentation
- Reviewing Convex function pull requests
- Planning function organization

## Core Principles

1. **Function Types** - Use queries for reads, mutations for writes, actions for external APIs
2. **File-Based Routing** - Functions organized by file, referenced via `api.module.function`
3. **Type Safety** - Always include validators for args and returns
4. **Consistency** - Predictable patterns across all functions
5. **Real-time First** - Leverage automatic reactivity in queries

## ✅ DO

### DO: Use Appropriate Function Types

**✅ DO**:
```typescript
// Query - read-only, reactive, auto-updates
export const list = query({
  args: {},
  returns: v.array(v.object({ _id: v.id("users"), name: v.string() })),
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

// Mutation - write operations, transactional
export const create = mutation({
  args: { name: v.string(), email: v.string() },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", args);
  },
});

// Action - external APIs, Node.js runtime
export const sendEmail = action({
  args: { to: v.string(), subject: v.string(), body: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Use external APIs, Node.js modules
    await sendEmailViaService(args);
    return null;
  },
});
```

### DO: Always Include Validators

**✅ DO**:
```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getUser = query({
  args: { id: v.id("users") }, // Always validate args
  returns: v.union(
    v.object({
      _id: v.id("users"),
      name: v.string(),
      email: v.string(),
    }),
    v.null()
  ), // Always validate returns
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Even if function returns nothing, include returns validator
export const deleteUser = mutation({
  args: { id: v.id("users") },
  returns: v.null(), // Required even for void functions
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return null;
  },
});
```

### DO: Use File-Based Organization

**✅ DO**:
```typescript
// convex/users.ts
export const list = query({ ... });
export const get = query({ ... });
export const create = mutation({ ... });

// convex/organizations.ts
export const list = query({ ... });
export const create = mutation({ ... });

// Usage: api.users.list, api.organizations.create
```

### DO: Use Indexes for Queries

**✅ DO**:
```typescript
export const listByStatus = query({
  args: { status: v.string() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    // Use withIndex instead of filter
    return await ctx.db
      .query("users")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect();
  },
});
```

### DO: Use Pagination for Large Datasets

**✅ DO**:
```typescript
import { paginationOptsValidator } from "convex/server";

export const listPaginated = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(v.any()),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
```

### DO: Use Internal Functions for Private Operations

**✅ DO**:
```typescript
// Internal function - only callable from other Convex functions
export const cleanupOldData = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Private cleanup logic
    return null;
  },
});

// Public function can call internal
export const scheduleCleanup = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.scheduler.runAfter(0, internal.users.cleanupOldData, {});
    return null;
  },
});
```

### DO: Use HTTP Router for Custom Endpoints

**✅ DO**:
```typescript
// convex/http.ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = httpRouter();

http.route({
  path: "/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    // Handle webhook
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
```

## ❌ DON'T

### DON'T: Use Filter Instead of Indexes

**❌ DON'T**:
```typescript
// Slow - scans all documents
export const listByStatus = query({
  args: { status: v.string() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("status"), args.status)) // Slow!
      .collect();
  },
});
```

**✅ Better**:
```typescript
// Fast - uses index
export const listByStatus = query({
  args: { status: v.string() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect();
  },
});
```

### DON'T: Omit Validators

**❌ DON'T**:
```typescript
// Missing validators - not type-safe
export const getUser = query({
  handler: async (ctx, args: { id: string }) => {
    return await ctx.db.get(args.id);
  },
});
```

**✅ Better**:
```typescript
export const getUser = query({
  args: { id: v.id("users") },
  returns: v.union(v.object({ ... }), v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
```

### DON'T: Use Public Functions for Internal Operations

**❌ DON'T**:
```typescript
// Exposed to public - security risk
export const deleteAllUsers = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Dangerous if public!
  },
});
```

**✅ Better**:
```typescript
// Internal - only callable from other functions
export const deleteAllUsers = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Safe - only internal calls
  },
});
```

### DON'T: Access Database in Actions

**❌ DON'T**:
```typescript
export const processData = action({
  args: { data: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Actions don't have ctx.db!
    await ctx.db.insert("data", { content: args.data }); // Error!
  },
});
```

**✅ Better**:
```typescript
export const processData = action({
  args: { data: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Process data, then call mutation
    const processed = await process(args.data);
    await ctx.runMutation(internal.data.save, { content: processed });
    return null;
  },
});
```

## Patterns & Examples

### Pattern 1: Type-Safe Function References

**Use Case**: Call functions from other functions with type safety

**Implementation**:
```typescript
import { api, internal } from "./_generated/api";

export const processUsers = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Type-safe function call
    const users = await ctx.runQuery(api.users.list, {});
    for (const user of users) {
      await ctx.runMutation(internal.users.processUser, { userId: user._id });
    }
    return null;
  },
});
```

### Pattern 2: Optimistic Updates

**Use Case**: Update UI immediately, sync with server

**Implementation**:
```typescript
// Frontend
const updateUser = useMutation(api.users.update);
const [optimisticName, setOptimisticName] = useState(name);

const handleUpdate = async () => {
  setOptimisticName(newName); // Optimistic update
  try {
    await updateUser({ id: userId, name: newName });
  } catch (error) {
    setOptimisticName(name); // Rollback on error
  }
};
```

### Pattern 3: Error Handling

**Use Case**: Handle errors gracefully in Convex functions

**Implementation**:
```typescript
export const getUser = query({
  args: { id: v.id("users") },
  returns: v.union(v.object({ ... }), v.null()),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.id);
    if (!user) {
      throw new Error("User not found"); // Convex handles errors
    }
    return user;
  },
});
```

## Common Mistakes

1. **Forgetting Validators**
   - Problem: No type safety, runtime errors
   - Solution: Always include `args` and `returns` validators

2. **Using Filter Instead of Indexes**
   - Problem: Slow queries, poor performance
   - Solution: Define indexes in schema, use `withIndex`

3. **Exposing Internal Functions**
   - Problem: Security risk, API pollution
   - Solution: Use `internalQuery`, `internalMutation`, `internalAction`

4. **Accessing Database in Actions**
   - Problem: Actions don't have `ctx.db`
   - Solution: Use `ctx.runMutation` or `ctx.runQuery` from actions

5. **Not Handling Loading States**
   - Problem: Poor UX, undefined errors
   - Solution: Check for `undefined` from `useQuery` (means loading)

## Testing Standards

```typescript
// Test Convex functions
describe("Users API", () => {
  it("list should return array of users", async () => {
    const result = await convex.query(api.users.list, {});
    expect(result).toBeInstanceOf(Array);
  });

  it("get should return user or null", async () => {
    const result = await convex.query(api.users.get, {
      id: "invalid-id" as Id<"users">,
    });
    expect(result).toBeNull();
  });

  it("create should return user id", async () => {
    const id = await convex.mutation(api.users.create, {
      name: "John",
      email: "john@example.com",
    });
    expect(id).toBeDefined();
  });
});
```

## Resources

- [Convex Functions Documentation](https://docs.convex.dev/functions)
- [Convex Validators](https://docs.convex.dev/database/validators)
- [Convex Queries](https://docs.convex.dev/database/reading-data)
- [Convex Mutations](https://docs.convex.dev/database/writing-data)
- [Convex Actions](https://docs.convex.dev/functions/actions)
- [Convex HTTP Endpoints](https://docs.convex.dev/functions/http-actions)
