import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { receiveLoanItemsWithEvidence } from "./loanCustody";
import { requireAcceptedConditionAssessment } from "./exhibitionPhysicalHandoff";
import { installObjectHandler } from "./exhibitionObjectLocation";
import {
  moveCollectionToLocation,
  requireCollectionInOrganization,
  requireUsableLocation,
} from "./locationIntegrity";

export async function markTransitItemCarrierArrivedInternal(
  ctx: MutationCtx,
  transitItem: Doc<"transitItems">,
  transitRecord: Doc<"transitRecords">,
  userId: Id<"users">,
): Promise<void> {
  if (transitItem.status === "received") {
    throw new Error("Transit item already received");
  }
  if (transitItem.status === "arrived") {
    return;
  }
  if (
    transitItem.status !== "pending" &&
    transitItem.status !== "in_transit" &&
    transitItem.status !== "delivered"
  ) {
    throw new Error("Transit item cannot be marked as carrier arrived");
  }

  const now = Date.now();
  await ctx.db.patch(transitItem._id, {
    status: "arrived",
    carrierArrivedAt: now,
    carrierArrivedBy: userId,
  });

  if (
    transitRecord.status === "cancelled" ||
    transitRecord.status === "draft"
  ) {
    throw new Error("Transit shipment must be active before carrier arrival");
  }
}

export async function recordTransitItemReceiptInternal(
  ctx: MutationCtx,
  args: {
    transitItem: Doc<"transitItems">;
    transitRecord: Doc<"transitRecords">;
    userId: Id<"users">;
    observedFromLocationId: Id<"locations"> | null;
    destinationLocationId: Id<"locations">;
    conditionAssessmentId?: Id<"conditionAssessments">;
    conditionIn?: string;
    notes?: string;
  },
): Promise<Id<"locationHistory">> {
  const {
    transitItem,
    transitRecord,
    userId,
    observedFromLocationId,
    destinationLocationId,
  } = args;

  if (transitItem.status === "received") {
    throw new Error("Transit item already received");
  }
  if (
    transitItem.status !== "arrived" &&
    transitItem.status !== "in_transit" &&
    transitItem.status !== "delivered"
  ) {
    throw new Error("Record carrier arrival before accountable receipt");
  }

  const collection = await requireCollectionInOrganization(
    ctx,
    transitItem.collectionId,
    transitRecord.organizationId,
  );
  await requireUsableLocation(
    ctx,
    transitRecord.organizationId,
    destinationLocationId,
  );

  const receiptConditionAssessmentId =
    await requireAcceptedConditionAssessment(
      ctx,
      args.conditionAssessmentId,
      transitItem.collectionId,
    );

  let movementId: Id<"locationHistory">;

  if (transitRecord.loanId && transitRecord.transitType === "return") {
    const loan = await ctx.db.get(transitRecord.loanId);
    if (!loan || loan.organizationId !== transitRecord.organizationId) {
      throw new Error("Linked loan not found");
    }
    const loanItem = await ctx.db
      .query("loanItems")
      .withIndex("by_loan", (q) => q.eq("loanId", transitRecord.loanId!))
      .filter((q) => q.eq(q.field("collectionId"), transitItem.collectionId))
      .first();
    if (!loanItem) {
      throw new Error("Loan item not found for transit collection");
    }
    await receiveLoanItemsWithEvidence(ctx, {
      loanId: transitRecord.loanId,
      organizationId: transitRecord.organizationId,
      loan,
      changedBy: userId,
      receipts: [
        {
          loanItemId: loanItem._id,
          destinationLocationId,
          incomingConditionAssessmentId: receiptConditionAssessmentId,
          conditionIn: args.conditionIn,
          notes: args.notes,
        },
      ],
    });
    const history = await ctx.db
      .query("locationHistory")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", transitItem.collectionId),
      )
      .collect();
    history.sort((a, b) => b.movedAt - a.movedAt);
    const latest = history[0];
    if (!latest) {
      throw new Error("Loan return did not record movement history");
    }
    movementId = latest._id;
  } else {
    const recorded = await moveCollectionToLocation(
      ctx,
      collection,
      destinationLocationId,
      userId,
      `Transit ${transitRecord.transitNumber} receipt`,
      {
        kind: "transit_receipt",
        expectedFromLocationId: observedFromLocationId,
        transitItemId: transitItem._id,
        checkCapacity: true,
        notes: args.notes,
      },
    );
    if (!recorded) {
      throw new Error("Transit receipt requires a location change");
    }
    movementId = recorded;
  }

  const receivedAt = Date.now();
  await ctx.db.patch(transitItem._id, {
    status: "received",
    receiptMovementId: movementId,
    receiptDestinationLocationId: destinationLocationId,
    receiptConditionAssessmentId,
    receivedAt,
    receivedBy: userId,
    conditionAtDelivery: args.conditionIn ?? transitItem.conditionAtDelivery,
  });

  return movementId;
}

export async function recordTransitItemInstallationInternal(
  ctx: MutationCtx,
  args: {
    transitItem: Doc<"transitItems">;
    transitRecord: Doc<"transitRecords">;
    userId: Id<"users">;
    observedFromLocationId: Id<"locations"> | null;
    exhibitionLocationId?: Id<"locations">;
    installationConditionAssessmentId?: Id<"conditionAssessments">;
    conditionNotes?: string;
  },
): Promise<void> {
  if (args.transitItem.status !== "received") {
    throw new Error("Record accountable receipt before installation");
  }
  if (!args.transitRecord.exhibitionId) {
    throw new Error("Transit record is not linked to an exhibition");
  }

  const exhibitionObject = await ctx.db
    .query("exhibitionObjects")
    .withIndex("by_exhibition", (q) =>
      q.eq("exhibitionId", args.transitRecord.exhibitionId!),
    )
    .filter((q) =>
      q.eq(q.field("collectionId"), args.transitItem.collectionId),
    )
    .first();
  if (!exhibitionObject) {
    throw new Error("Exhibition participant not found for this object");
  }

  await installObjectHandler(ctx, {
    exhibitionObjectId: exhibitionObject._id,
    observedFromLocationId: args.observedFromLocationId,
    exhibitionLocationId: args.exhibitionLocationId,
    installationConditionAssessmentId: args.installationConditionAssessmentId,
    conditionNotes: args.conditionNotes,
  });

  const refreshed = await ctx.db.get(exhibitionObject._id);
  const installedAt = Date.now();
  await ctx.db.patch(args.transitItem._id, {
    installedAt,
    installedBy: args.userId,
    linkedExhibitionObjectId: exhibitionObject._id,
    installationMovementId: refreshed?.installationMovementId,
  });
}

export async function getTransitHandoffSummaryForRecord(
  ctx: QueryCtx,
  transitRecordId: Id<"transitRecords">,
) {
  const transitItems = await ctx.db
    .query("transitItems")
    .withIndex("by_transitRecord", (q) => q.eq("transitRecordId", transitRecordId))
    .collect();

  const items = await Promise.all(
    transitItems.map(async (item) => {
      const collection = await ctx.db.get(item.collectionId);
      return {
        transitItemId: item._id,
        collectionId: item.collectionId,
        accessionNumber: collection?.accessionNumber,
        title: collection?.title,
        status: item.status,
        carrierArrivedAt: item.carrierArrivedAt,
        receivedAt: item.receivedAt,
        installedAt: item.installedAt,
        receiptMovementId: item.receiptMovementId,
        installationMovementId: item.installationMovementId,
      };
    }),
  );

  const outstandingReceipt = items.filter(
    (item) =>
      item.status !== "received" &&
      item.status !== "missing" &&
      item.status !== "damaged",
  );
  const outstandingInstallation = items.filter(
    (item) => item.status === "received" && item.installedAt === undefined,
  );

  return {
    itemCount: items.length,
    outstandingReceiptCount: outstandingReceipt.length,
    outstandingInstallationCount: outstandingInstallation.length,
    items,
    outstandingReceipt,
    outstandingInstallation,
  };
}
