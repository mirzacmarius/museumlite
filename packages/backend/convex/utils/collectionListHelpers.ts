import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { countOpenDeaccessionCollectionIds } from "./indexedCounts";

/**
 * Whether catalog list pagination can use org/status indexes only (no filters).
 */
export function shouldUseIndexedCollectionsPagination(args: {
  collectionGroupId?: Id<"collectionGroups">;
  culture?: string;
  period?: string;
  materials?: string;
  search?: string;
  catalogedFrom?: number;
  catalogedTo?: number;
}) {
  return (
    !args.collectionGroupId &&
    !args.culture &&
    !args.period &&
    !args.materials &&
    !args.search?.trim() &&
    !args.catalogedFrom &&
    !args.catalogedTo
  );
}

export async function getCollectionsWithOpenDeaccessions(
  ctx: Pick<QueryCtx, "db">,
  organizationId: Id<"organizations">,
) {
  return countOpenDeaccessionCollectionIds(ctx, organizationId);
}
