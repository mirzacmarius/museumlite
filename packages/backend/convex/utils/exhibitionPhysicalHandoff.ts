import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { moveCollectionToLocation } from "./locationIntegrity";

export async function requireAcceptedConditionAssessment(
  ctx: MutationCtx,
  assessmentId: Id<"conditionAssessments"> | undefined,
  collectionId: Id<"collections">,
): Promise<Id<"conditionAssessments"> | undefined> {
  if (assessmentId === undefined) return undefined;
  const assessment = await ctx.db.get(assessmentId);
  if (!assessment || assessment.collectionId !== collectionId) {
    throw new Error("Condition assessment not found for this object");
  }
  if (assessment.status !== "accepted") {
    throw new Error("Link an accepted condition assessment");
  }
  return assessmentId;
}

export async function executeExhibitionMovement(
  ctx: MutationCtx,
  collection: Doc<"collections">,
  toLocationId: Id<"locations">,
  userId: Id<"users">,
  args: {
    kind: "exhibition_install" | "exhibition_return";
    observedFromLocationId: Id<"locations"> | null;
    exhibitionObjectId: Id<"exhibitionObjects">;
    reason: string;
  },
): Promise<Id<"locationHistory">> {
  const movementId = await moveCollectionToLocation(
    ctx,
    collection,
    toLocationId,
    userId,
    args.reason,
    {
      kind: args.kind,
      expectedFromLocationId: args.observedFromLocationId,
      exhibitionObjectId: args.exhibitionObjectId,
      checkCapacity: true,
    },
  );
  if (!movementId) {
    throw new Error("Exhibition handoff requires a location change");
  }
  return movementId;
}

export function isExhibitionObjectOutcomeResolved(
  exhibitionObject: Doc<"exhibitionObjects">,
): boolean {
  return (
    exhibitionObject.status === "returned" ||
    exhibitionObject.returnException !== undefined
  );
}

export async function getExhibitionPhysicalHandoffSummary(
  ctx: QueryCtx,
  exhibitionId: Id<"exhibitions">,
) {
  const exhibitionObjects = await ctx.db
    .query("exhibitionObjects")
    .withIndex("by_exhibition", (q) => q.eq("exhibitionId", exhibitionId))
    .collect();

  const participants = await Promise.all(
    exhibitionObjects.map(async (obj) => {
      const collection = await ctx.db.get(obj.collectionId);
      return {
        exhibitionObjectId: obj._id,
        collectionId: obj.collectionId,
        collectionTitle: collection?.title,
        collectionAccessionNumber: collection?.accessionNumber,
        status: obj.status,
        role: obj.role ?? ("participant" as const),
        order: obj.order ?? 0,
        hasReturnException: obj.returnException !== undefined,
        installationMovementId: obj.installationMovementId,
        returnMovementId: obj.returnMovementId,
        installationConditionAssessmentId: obj.installationConditionAssessmentId,
        deinstallationConditionAssessmentId:
          obj.deinstallationConditionAssessmentId,
        returnConditionAssessmentId: obj.returnConditionAssessmentId,
        installedAt: obj.installedAt,
        deinstalledAt: obj.deinstalledAt,
        returnedAt: obj.returnedAt,
      };
    }),
  );

  participants.sort((a, b) => a.order - b.order);

  const outstanding = participants.filter(
    (participant) =>
      participant.status !== "returned" && !participant.hasReturnException,
  );

  return {
    participantCount: participants.length,
    outstandingCount: outstanding.length,
    canClose: outstanding.length === 0,
    participants,
    outstanding,
  };
}
