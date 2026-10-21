import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { custodyConflict } from "./custodyErrors";
import {
  moveCollectionToLocation,
  requireCollectionInOrganization,
} from "./locationIntegrity";
import { objectMoveError } from "./objectMoveErrors";

export interface TransferScopeSnapshot {
  sourceOrganizationId: Id<"organizations">;
  observedSourceLocationId: Id<"locations"> | null;
  legacyCollectionGroupId?: Id<"collectionGroups">;
  collectionGroupIds: Id<"collectionGroups">[];
  collectionGroupMemberships: Array<{
    collectionGroupId: Id<"collectionGroups">;
    role?: "primary" | "secondary";
  }>;
  accessionNumberAtTransfer: string;
}

export async function buildTransferScopeSnapshot(
  ctx: QueryCtx | MutationCtx,
  collection: Doc<"collections">,
): Promise<TransferScopeSnapshot> {
  const membershipRows = await ctx.db
    .query("collectionGroupItems")
    .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
    .collect();

  return {
    sourceOrganizationId: collection.organizationId,
    observedSourceLocationId: collection.currentLocationId ?? null,
    legacyCollectionGroupId: collection.collectionGroupId,
    collectionGroupIds: membershipRows.map((row) => row.collectionGroupId),
    collectionGroupMemberships: membershipRows.map((row) =>
      row.role
        ? { collectionGroupId: row.collectionGroupId, role: row.role }
        : { collectionGroupId: row.collectionGroupId },
    ),
    accessionNumberAtTransfer: collection.accessionNumber,
  };
}

export function assertObservedSourceLocationMatches(
  collection: Doc<"collections">,
  approvedSourceLocationId: Id<"locations"> | null | undefined,
) {
  if (approvedSourceLocationId === undefined) {
    throw objectMoveError(
      "SOURCE_LOCATION_CHANGED",
      "Transfer has no observed source location. The source organization must re-approve before acceptance.",
    );
  }
  const observed = collection.currentLocationId ?? null;
  const expected = approvedSourceLocationId ?? null;
  if (observed !== expected) {
    throw objectMoveError(
      "SOURCE_LOCATION_CHANGED",
      "Object is no longer at the source location observed when the transfer was approved.",
    );
  }
}

export async function requireTargetTransferLocation(
  ctx: QueryCtx | MutationCtx,
  targetOrganizationId: Id<"organizations">,
  targetLocationId: Id<"locations">,
): Promise<Doc<"locations">> {
  const location = await ctx.db.get(targetLocationId);
  if (!location || location.organizationId !== targetOrganizationId) {
    throw custodyConflict(
      "REFERENCE_NOT_FOUND",
      "Destination location must belong to the receiving organization.",
    );
  }
  const status = location.status ?? "active";
  if (!location.isActive || (status !== "active" && status !== "restricted")) {
    throw custodyConflict(
      "DESTINATION_UNAVAILABLE",
      `Location ${location.name} is unavailable for receipt.`,
      { locationName: location.name },
    );
  }
  return location;
}

export async function recordTransferCustodyEvent(
  ctx: MutationCtx,
  args: {
    moveRequestId: Id<"organizationMoveRequests">;
    collectionId: Id<"collections">;
    organizationId: Id<"organizations">;
    phase: "source_departure" | "target_arrival";
    observedLocationId: Id<"locations"> | null;
    actorId: Id<"users">;
    notes?: string;
  },
) {
  await ctx.db.insert("organizationTransferCustodyEvents", {
    moveRequestId: args.moveRequestId,
    collectionId: args.collectionId,
    organizationId: args.organizationId,
    phase: args.phase,
    observedLocationId: args.observedLocationId ?? undefined,
    actorId: args.actorId,
    recordedAt: Date.now(),
    notes: args.notes,
  });
}

export async function moveConditionAssessmentRecords(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
  targetOrganizationId: Id<"organizations">,
) {
  const assessments = await ctx.db
    .query("conditionAssessments")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();

  await Promise.all(
    assessments.map((assessment) =>
      ctx.db.patch(assessment._id, {
        organizationId: targetOrganizationId,
      }),
    ),
  );
}

export async function recordTargetTransferArrival(
  ctx: MutationCtx,
  args: {
    collectionId: Id<"collections">;
    targetOrganizationId: Id<"organizations">;
    targetLocationId: Id<"locations">;
    userId: Id<"users">;
    moveRequestId: Id<"organizationMoveRequests">;
    reason: string;
  },
): Promise<Id<"locationHistory">> {
  const collection = await requireCollectionInOrganization(
    ctx,
    args.collectionId,
    args.targetOrganizationId,
  );
  const destination = await requireTargetTransferLocation(
    ctx,
    args.targetOrganizationId,
    args.targetLocationId,
  );
  const movementId = await moveCollectionToLocation(
    ctx,
    collection,
    args.targetLocationId,
    args.userId,
    args.reason,
    {
      kind: "institution_transfer",
      authorizedBy: args.userId,
      expectedFromLocationId: null,
      checkCapacity: true,
      statusOverride: destination.status === "restricted",
      notes: `Institution transfer receipt (request ${args.moveRequestId})`,
    },
  );
  if (!movementId)
    throw new Error("Transfer receipt requires a location change");
  return movementId;
}
