import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { batchGetByIds, createLookupMap } from "./batchLookup";
import { requirePermission } from "./permissions";

const MAX_COLLECTION_BATCH_SIZE = 200;

export async function getAuthorizedCollectionBatch(
  ctx: QueryCtx,
  collectionIds: Array<Id<"collections">>,
  permission: "media.read" | "loans.read",
): Promise<Map<Id<"collections">, Doc<"collections">>> {
  if (collectionIds.length > MAX_COLLECTION_BATCH_SIZE) {
    throw new Error("Collection batch is too large");
  }

  const collections = await batchGetByIds(ctx, collectionIds, "collections");
  const organizationIds = new Set(
    collections.flatMap((collection) =>
      collection === null ? [] : [collection.organizationId],
    ),
  );
  if (organizationIds.size > 1) {
    throw new Error("Collections must belong to one organization");
  }
  const organizationId = organizationIds.values().next().value;
  if (organizationId) {
    await requirePermission(ctx, organizationId, permission);
  }

  return createLookupMap(collections);
}
