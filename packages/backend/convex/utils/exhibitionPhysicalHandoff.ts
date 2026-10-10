import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { custodyConflict } from "./custodyErrors";
import { moveCollectionToLocation } from "./locationIntegrity";

export async function requireAcceptedConditionAssessment(
  ctx: MutationCtx,
  assessmentId: Id<"conditionAssessments"> | undefined,
  collectionId: Id<"collections">,
  required = false,
): Promise<Id<"conditionAssessments"> | undefined> {
  if (assessmentId === undefined) {
    if (required)
      throw custodyConflict(
        "ASSESSMENT_REQUIRED",
        "Link an accepted condition assessment for this handoff",
      );
    return undefined;
  }
  const assessment = await ctx.db.get(assessmentId);
  if (!assessment || assessment.collectionId !== collectionId) {
    throw custodyConflict(
      "REFERENCE_NOT_FOUND",
      "Condition assessment not found for this object",
    );
  }
  if (assessment.status !== "accepted") {
    throw custodyConflict(
      "ASSESSMENT_NOT_ACCEPTED",
      "Link an accepted condition assessment",
    );
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
    throw custodyConflict(
      "ALREADY_AT_DESTINATION",
      "Exhibition handoff requires a location change",
    );
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

interface ExhibitionHandoffEvent {
  exhibitionObjectId: Id<"exhibitionObjects">;
  collectionId: Id<"collections">;
  phase: "installed" | "deinstalled" | "returned" | "exception";
  recordedAt: number;
  actorId?: Id<"users">;
  actorName?: string;
  conditionAssessmentId?: Id<"conditionAssessments">;
  movementId?: Id<"locationHistory">;
  notes?: string;
}

export async function getExhibitionPhysicalHandoffSummary(
  ctx: QueryCtx,
  exhibitionId: Id<"exhibitions">,
  organizationId: Id<"organizations">,
) {
  const exhibitionObjects = await ctx.db
    .query("exhibitionObjects")
    .withIndex("by_exhibition", (q) => q.eq("exhibitionId", exhibitionId))
    .collect();

  const timeline: ExhibitionHandoffEvent[] = [];
  for (const object of exhibitionObjects) {
    const common = {
      exhibitionObjectId: object._id,
      collectionId: object.collectionId,
    };
    if (object.installedAt !== undefined)
      timeline.push({
        ...common,
        phase: "installed",
        recordedAt: object.installedAt,
        actorId: object.installedBy,
        conditionAssessmentId: object.installationConditionAssessmentId,
        movementId: object.installationMovementId,
        notes: object.conditionAtInstallation,
      });
    if (object.deinstalledAt !== undefined)
      timeline.push({
        ...common,
        phase: "deinstalled",
        recordedAt: object.deinstalledAt,
        actorId: object.deinstalledBy,
        conditionAssessmentId: object.deinstallationConditionAssessmentId,
        notes: object.conditionAtDeinstallation,
      });
    if (object.returnedAt !== undefined) {
      const movement = object.returnMovementId
        ? await ctx.db.get(object.returnMovementId)
        : null;
      timeline.push({
        ...common,
        phase: "returned",
        recordedAt: object.returnedAt,
        actorId: movement?.movedBy,
        conditionAssessmentId: object.returnConditionAssessmentId,
        movementId: object.returnMovementId,
      });
    }
    if (object.returnException)
      timeline.push({
        ...common,
        phase: "exception",
        recordedAt: object.returnException.authorizedAt,
        actorId: object.returnException.authorizedBy,
        notes: object.returnException.reason,
      });
  }
  for (const event of timeline) {
    const actor = event.actorId ? await ctx.db.get(event.actorId) : null;
    event.actorName = actor?.name ?? actor?.username;
  }
  timeline.sort((a, b) => a.recordedAt - b.recordedAt);

  const participants = await Promise.all(
    exhibitionObjects.map(async (obj) => {
      const collection = await ctx.db.get(obj.collectionId);
      return {
        exhibitionObjectId: obj._id,
        collectionId: obj.collectionId,
        collectionTitle:
          collection?.organizationId === organizationId
            ? collection.title
            : undefined,
        collectionAccessionNumber:
          collection?.organizationId === organizationId
            ? collection.accessionNumber
            : undefined,
        status: obj.status,
        role: obj.role ?? ("participant" as const),
        order: obj.order ?? 0,
        hasReturnException: obj.returnException !== undefined,
        installationMovementId: obj.installationMovementId,
        returnMovementId: obj.returnMovementId,
        installationConditionAssessmentId:
          obj.installationConditionAssessmentId,
        deinstallationConditionAssessmentId:
          obj.deinstallationConditionAssessmentId,
        returnConditionAssessmentId: obj.returnConditionAssessmentId,
        installedAt: obj.installedAt,
        deinstalledAt: obj.deinstalledAt,
        returnedAt: obj.returnedAt,
        originalLocationId: obj.originalLocationId,
        // Where the object is recorded now: the observed source staff confirm.
        currentLocationId:
          collection?.organizationId === organizationId
            ? collection.currentLocationId
            : undefined,
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
    timeline,
  };
}
