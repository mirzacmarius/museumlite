import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

type CountCtx = Pick<QueryCtx, "db">;

/**
 * Count documents matching an indexed query without loading full documents.
 */
export async function countIndexedQuery<TableName extends string>(
  query: AsyncIterable<{ _id: Id<TableName> }>,
): Promise<number> {
  let count = 0;
  for await (const _ of query) {
    count += 1;
  }
  return count;
}

export async function countCollectionsByStatus(
  ctx: CountCtx,
  organizationId: Id<"organizations">,
  status: "active" | "loaned" | "deaccessioned" | "archived" | "deleted",
) {
  return countIndexedQuery(
    ctx.db
      .query("collections")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", organizationId).eq("status", status),
      ),
  );
}

export async function countLoansByStatus(
  ctx: CountCtx,
  organizationId: Id<"organizations">,
  status: "pending" | "active" | "dispatched" | "returned" | "cancelled",
) {
  return countIndexedQuery(
    ctx.db
      .query("loans")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", organizationId).eq("status", status),
      ),
  );
}

export async function countLoansByType(
  ctx: CountCtx,
  organizationId: Id<"organizations">,
  type: "incoming" | "outgoing",
) {
  return countIndexedQuery(
    ctx.db
      .query("loans")
      .withIndex("by_organization_and_type", (q) =>
        q.eq("organizationId", organizationId).eq("type", type),
      ),
  );
}

export async function countAccessionsByStatus(
  ctx: CountCtx,
  organizationId: Id<"organizations">,
  status: "pending" | "approved" | "rejected",
) {
  return countIndexedQuery(
    ctx.db
      .query("accessions")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", organizationId).eq("status", status),
      ),
  );
}

export async function countDeaccessionsByStatus(
  ctx: CountCtx,
  organizationId: Id<"organizations">,
  status: "pending" | "approved" | "rejected" | "cancelled",
) {
  return countIndexedQuery(
    ctx.db
      .query("deaccessions")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", organizationId).eq("status", status),
      ),
  );
}

export async function countOpenDeaccessionCollectionIds(
  ctx: CountCtx,
  organizationId: Id<"organizations">,
) {
  const collectionIds = new Set<Id<"collections">>();
  for (const status of ["pending", "approved"] as const) {
    const rows = ctx.db
      .query("deaccessions")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", organizationId).eq("status", status),
      );
    for await (const deaccession of rows) {
      collectionIds.add(deaccession.collectionId);
    }
  }
  return collectionIds;
}

export async function countCatalogObjects(
  ctx: CountCtx,
  organizationId: Id<"organizations">,
  openDeaccessionCollectionIds: Set<Id<"collections">>,
) {
  let total = 0;
  let active = 0;
  let loaned = 0;
  let onDisplay = 0;

  for (const status of ["active", "loaned", "archived"] as const) {
    const rows = ctx.db
      .query("collections")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", organizationId).eq("status", status),
      );
    for await (const collection of rows) {
      if (openDeaccessionCollectionIds.has(collection._id)) {
        continue;
      }
      total += 1;
      if (collection.status === "active") {
        active += 1;
        if (collection.displayStatus === "on_display") {
          onDisplay += 1;
        }
      } else if (collection.status === "loaned") {
        loaned += 1;
      }
    }
  }

  return { total, active, loaned, onDisplay };
}
