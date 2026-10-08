import type { Id, TableNames } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { classifyInventoryRecord } from "./collectionMetrics";

type CountCtx = Pick<QueryCtx, "db">;

export async function getInventoryLoanAssociations(
  ctx: CountCtx,
  organizationId: Id<"organizations">,
) {
  const incoming = new Set<Id<"collections">>();
  const outgoing = new Set<Id<"collections">>();
  const loans = ctx.db
    .query("loans")
    .withIndex("by_organization", (q) =>
      q.eq("organizationId", organizationId),
    );
  for await (const loan of loans) {
    const items = ctx.db
      .query("loanItems")
      .withIndex("by_loan", (q) => q.eq("loanId", loan._id));
    for await (const item of items) {
      (loan.type === "incoming" ? incoming : outgoing).add(item.collectionId);
    }
  }
  return { incoming, outgoing };
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

export async function countCatalogObjects(
  ctx: CountCtx,
  organizationId: Id<"organizations">,
  openDeaccessionCollectionIds: Set<Id<"collections">>,
  loanAssociations: Awaited<ReturnType<typeof getInventoryLoanAssociations>>,
) {
  let total = 0;
  let active = 0;
  let loaned = 0;
  let onDisplay = 0;
  let incomingLoanExcluded = 0;
  let ownershipUnclassified = 0;

  for (const status of ["active", "loaned", "archived"] as const) {
    const rows = ctx.db
      .query("collections")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", organizationId).eq("status", status),
      );
    for await (const collection of rows) {
      const ownership = classifyInventoryRecord({
        status: collection.status,
        hasOpenDeaccession: openDeaccessionCollectionIds.has(collection._id),
        linkedToIncomingLoan: loanAssociations.incoming.has(collection._id),
        linkedToOutgoingLoan: loanAssociations.outgoing.has(collection._id),
      });
      if (ownership === "incoming") incomingLoanExcluded += 1;
      if (ownership === "unclassified") ownershipUnclassified += 1;
      if (ownership !== "owned") continue;
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

  return {
    total,
    active,
    loaned,
    onDisplay,
    incomingLoanExcluded,
    ownershipUnclassified,
  };
}
