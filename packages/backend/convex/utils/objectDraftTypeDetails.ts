import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { ObjectDraftTypeDetails } from "./collectionTypeDetailFields";
import { requireCollectionTypeModuleEnabled } from "./featureGates";
import type { CollectionType } from "./moduleCatalog";

/** Stable codes clients map to translated copy; `message` is for logs. */
export type ObjectDraftTypeDetailsErrorCode = "TYPE_DETAILS_MISMATCH";

function objectDraftTypeDetailsError(
  code: ObjectDraftTypeDetailsErrorCode,
  message: string,
) {
  return new ConvexError({ code, message });
}

/**
 * A draft follows the same rules as creating its object: a module-backed
 * collection type needs its module. Details for any collection type other
 * than the draft's own are refused so they cannot be published on the wrong
 * kind of object.
 */
export async function validateObjectDraftTypeDetails(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  objectData: {
    collectionType?: CollectionType;
    typeDetails?: ObjectDraftTypeDetails;
  },
) {
  if (
    objectData.typeDetails &&
    objectData.typeDetails.collectionType !== objectData.collectionType
  ) {
    throw objectDraftTypeDetailsError(
      "TYPE_DETAILS_MISMATCH",
      "Type-specific details do not match the draft's collection type",
    );
  }
  await requireCollectionTypeModuleEnabled(
    ctx,
    organizationId,
    objectData.collectionType,
  );
}

function hasDetailValues(fields: ObjectDraftTypeDetails["fields"]) {
  return Object.values(fields).some((value) => value !== undefined);
}

async function insertTypeDetails(
  ctx: MutationCtx,
  typeDetails: ObjectDraftTypeDetails,
  record: {
    collectionId: Id<"collections">;
    organizationId: Id<"organizations">;
    createdAt: number;
  },
) {
  switch (typeDetails.collectionType) {
    case "fine_art":
      return {
        entityType: "fineArtDetails",
        entityId: await ctx.db.insert("fineArtDetails", {
          ...record,
          ...typeDetails.fields,
        }),
      };
    case "wine":
      return {
        entityType: "wineDetails",
        entityId: await ctx.db.insert("wineDetails", {
          ...record,
          ...typeDetails.fields,
        }),
      };
    case "automotive":
      return {
        entityType: "vehicleDetails",
        entityId: await ctx.db.insert("vehicleDetails", {
          ...record,
          ...typeDetails.fields,
        }),
      };
    case "natural_history":
      return {
        entityType: "naturalHistoryDetails",
        entityId: await ctx.db.insert("naturalHistoryDetails", {
          ...record,
          ...typeDetails.fields,
        }),
      };
    case "archive":
      return {
        entityType: "archiveDetails",
        entityId: await ctx.db.insert("archiveDetails", {
          ...record,
          ...typeDetails.fields,
        }),
      };
    case "coins_stamps":
      return {
        entityType: "coinsStampsDetails",
        entityId: await ctx.db.insert("coinsStampsDetails", {
          ...record,
          ...typeDetails.fields,
        }),
      };
  }
}

/**
 * Creates the detail record captured on an accession draft for the object
 * being published from it. Only details for the object's own collection type
 * are published.
 */
export async function publishObjectDraftTypeDetails(
  ctx: MutationCtx,
  {
    collectionId,
    organizationId,
    collectionType,
    typeDetails,
    publishedBy,
    publishedAt,
  }: {
    collectionId: Id<"collections">;
    organizationId: Id<"organizations">;
    collectionType: CollectionType | undefined;
    typeDetails: ObjectDraftTypeDetails | undefined;
    publishedBy: Id<"users">;
    publishedAt: number;
  },
) {
  if (
    !typeDetails ||
    typeDetails.collectionType !== collectionType ||
    !hasDetailValues(typeDetails.fields)
  ) {
    return;
  }

  const { entityType, entityId } = await insertTypeDetails(ctx, typeDetails, {
    collectionId,
    organizationId,
    createdAt: publishedAt,
  });
  await ctx.runMutation(internal.audit.logAction, {
    organizationId,
    userId: publishedBy,
    action: "created",
    entityType,
    entityId,
    changes: typeDetails.fields,
  });
}
