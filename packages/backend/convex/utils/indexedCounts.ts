import { ConvexError } from "convex/values";
import type { Id, TableNames } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { isUnaccessionedEntryObject } from "./objectEntryLifecycle";

type CountCtx = Pick<QueryCtx, "db">;

const MAX_INVENTORY_LOAN_LINKS = 32;

/** Inventory classification evidence for one bounded page of catalog rows. */
export async function getPageInventoryEvidence(
  ctx: CountCtx,
  organizationId: Id<"organizations">,
  rows: Array<{ _id: Id<"collections"> }>,
) {
  const openDeaccessionCollectionIds = new Set<Id<"collections">>();
  const inventoryLoanAssociations = {
    incoming: new Set<Id<"collections">>(),
    outgoing: new Set<Id<"collections">>(),
  };
  for (const row of rows) {
    const links = await ctx.db
      .query("loanItems")
      .withIndex("by_collection", (q) => q.eq("collectionId", row._id))
      .take(MAX_INVENTORY_LOAN_LINKS + 1);
    if (links.length > MAX_INVENTORY_LOAN_LINKS)
      throw new ConvexError(
        `Inventory-scope views support at most ${MAX_INVENTORY_LOAN_LINKS} loan associations per object. Export explicit selected objects instead.`,
      );
    for (const link of links) {
      const loan = await ctx.db.get(link.loanId);
      if (loan?.organizationId === organizationId)
        inventoryLoanAssociations[loan.type].add(row._id);
    }
    // Property held under an entry is incoming until it is accessioned.
    if (await isUnaccessionedEntryObject(ctx, row._id))
      inventoryLoanAssociations.incoming.add(row._id);
    for (const status of ["pending", "approved"] as const) {
      const deaccession = await ctx.db
        .query("deaccessions")
        .withIndex("by_organization_and_collection_and_status", (q) =>
          q
            .eq("organizationId", organizationId)
            .eq("collectionId", row._id)
            .eq("status", status),
        )
        .first();
      if (deaccession) openDeaccessionCollectionIds.add(row._id);
    }
  }
  return { openDeaccessionCollectionIds, inventoryLoanAssociations };
}

/**
 * Count documents matching an indexed query without loading full documents.
 */
export async function countIndexedQuery<TableName extends TableNames>(
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
  status: "pending" | "approved" | "rejected",
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
