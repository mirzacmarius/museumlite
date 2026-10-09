import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  type ObjectDraftTypeDetails,
  withoutBlankDetailValues,
} from "./collectionTypeDetailFields";
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
          ...withoutBlankDetailValues(typeDetails.fields),
        }),
      };
    case "wine":
      return {
        entityType: "wineDetails",
        entityId: await ctx.db.insert("wineDetails", {
          ...record,
          ...withoutBlankDetailValues(typeDetails.fields),
        }),
      };
    case "automotive":
      return {
        entityType: "vehicleDetails",
        entityId: await ctx.db.insert("vehicleDetails", {
          ...record,
          ...withoutBlankDetailValues(typeDetails.fields),
        }),
      };
    case "natural_history":
      return {
        entityType: "naturalHistoryDetails",
        entityId: await ctx.db.insert("naturalHistoryDetails", {
          ...record,
          ...withoutBlankDetailValues(typeDetails.fields),
        }),
      };
    case "archive":
      return {
        entityType: "archiveDetails",
        entityId: await ctx.db.insert("archiveDetails", {
          ...record,
          ...withoutBlankDetailValues(typeDetails.fields),
        }),
      };
    case "coins_stamps":
      return {
        entityType: "coinsStampsDetails",
        entityId: await ctx.db.insert("coinsStampsDetails", {
          ...record,
          ...withoutBlankDetailValues(typeDetails.fields),
        }),
      };
  }
}

/**
 * Creates the detail record captured on a validated accession draft for the
 * object published from it. Blank values are not recorded.
 */
export async function publishObjectDraftTypeDetails(
  ctx: MutationCtx,
  {
    collectionId,
    organizationId,
    typeDetails,
    publishedBy,
    publishedAt,
  }: {
    collectionId: Id<"collections">;
    organizationId: Id<"organizations">;
    typeDetails: ObjectDraftTypeDetails;
    publishedBy: Id<"users">;
    publishedAt: number;
  },
) {
  const fields = withoutBlankDetailValues(typeDetails.fields);
  if (Object.keys(fields).length === 0) return;

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
    changes: fields,
  });
}
