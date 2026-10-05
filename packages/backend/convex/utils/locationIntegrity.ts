import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export async function requireUsableLocation(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  locationId: Id<"locations">,
  options?: { allowRestricted?: boolean },
): Promise<Doc<"locations">> {
  const location = await ctx.db.get(locationId);
  if (!location || location.organizationId !== organizationId) {
    throw new Error("Location not found in this organization");
  }
  if (
    !location.isActive ||
    (location.status &&
      location.status !== "active" &&
      !(options?.allowRestricted && location.status === "restricted"))
  ) {
    throw new Error(`Location ${location.name} is unavailable for moves`);
  }
  return location;
}

export async function moveCollectionToLocation(
  ctx: MutationCtx,
  collection: Doc<"collections">,
  toLocationId: Id<"locations">,
  userId: Id<"users">,
  reason: string,
): Promise<void> {
  await requireUsableLocation(ctx, collection.organizationId, toLocationId);
  if (collection.currentLocationId === toLocationId) return;
  const movedAt = Date.now();
  await ctx.db.insert("locationHistory", {
    collectionId: collection._id,
    fromLocationId: collection.currentLocationId,
    toLocationId,
    movedBy: userId,
    movedAt,
    reason,
  });
  await ctx.db.patch(collection._id, {
    currentLocationId: toLocationId,
    lastModifiedBy: userId,
    lastModifiedAt: movedAt,
  });
}

export async function requireCollectionInOrganization(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
  organizationId: Id<"organizations">,
): Promise<Doc<"collections">> {
  const collection = await ctx.db.get(collectionId);
  if (!collection || collection.organizationId !== organizationId)
    throw new Error("Collection not found in this organization");
  return collection;
}

export async function validateObjectReferences(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  references: {
    parentObjectId?: Id<"collections">;
    currentLocationId?: Id<"locations">;
    collectionGroupId?: Id<"collectionGroups">;
    collectionGroupIds?: Id<"collectionGroups">[];
  },
) {
  if (references.parentObjectId)
    await requireCollectionInOrganization(
      ctx,
      references.parentObjectId,
      organizationId,
    );
  if (references.currentLocationId)
    await requireUsableLocation(
      ctx,
      organizationId,
      references.currentLocationId,
    );
  for (const groupId of new Set([
    ...(references.collectionGroupIds ?? []),
    ...(references.collectionGroupId ? [references.collectionGroupId] : []),
  ])) {
    const group = await ctx.db.get(groupId);
    if (!group || group.organizationId !== organizationId)
      throw new Error("Collection group not found in this organization");
  }
}
