import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";

type DbCtx = MutationCtx | QueryCtx;

export function assertSameOrganization(
  docOrganizationId: Id<"organizations">,
  expectedOrganizationId: Id<"organizations">,
  label: string,
): void {
  if (docOrganizationId !== expectedOrganizationId) {
    throw new Error(`${label} belongs to a different organization`);
  }
}

export async function loadLibraryItemForOrg(
  ctx: DbCtx,
  itemId: Id<"libraryItems">,
  organizationId: Id<"organizations">,
): Promise<Doc<"libraryItems">> {
  const item = await ctx.db.get(itemId);
  if (!item) {
    throw new Error("Library item not found");
  }
  assertSameOrganization(item.organizationId, organizationId, "Library item");
  return item;
}

export async function loadCopyForOrg(
  ctx: DbCtx,
  copyId: Id<"itemCopies">,
  organizationId: Id<"organizations">,
): Promise<Doc<"itemCopies">> {
  const copy = await ctx.db.get(copyId);
  if (!copy) {
    throw new Error("Copy not found");
  }
  assertSameOrganization(copy.organizationId, organizationId, "Copy");
  return copy;
}

export async function loadLocationForOrg(
  ctx: DbCtx,
  locationId: Id<"locations">,
  organizationId: Id<"organizations">,
): Promise<Doc<"locations">> {
  const location = await ctx.db.get(locationId);
  if (!location) {
    throw new Error("Location not found");
  }
  assertSameOrganization(location.organizationId, organizationId, "Location");
  return location;
}
