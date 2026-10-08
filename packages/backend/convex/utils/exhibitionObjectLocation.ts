import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { rejectPermanentEvidenceDeletion } from "./evidenceRetention";
import {
  loadExhibitionMutationContext,
  loadExhibitionObjectMutationContext,
  requireExhibitionReadPermission,
} from "./exhibitionContext";
import { getExhibitionParticipants } from "./exhibitionParticipation";
import {
  executeExhibitionMovement,
  requireAcceptedConditionAssessment,
} from "./exhibitionPhysicalHandoff";
import { assertCollectionNotOnLoan } from "./loanOccupancy";
import {
  requireCollectionInOrganization,
  requireUsableLocation,
} from "./locationIntegrity";

export async function addExhibitionObjectHandler(
  ctx: MutationCtx,
  args: {
    exhibitionId: Id<"exhibitions">;
    collectionId: Id<"collections">;
    originalLocationId?: Id<"locations">;
    exhibitionLocationId?: Id<"locations">;
    role?: "featured" | "participant";
  },
) {
  const [{ userId, exhibition }, collection] = await Promise.all([
    loadExhibitionMutationContext(ctx, args.exhibitionId),
    ctx.db.get(args.collectionId),
  ] as const);
  if (!collection) {
    throw new Error("Collection object not found");
  }

  if (collection.organizationId !== exhibition.organizationId) {
    throw new Error("Object does not belong to the same organization");
  }
  if (exhibition.participationVersion !== "members") {
    throw new Error(
      "Review legacy exhibition participation before adding objects",
    );
  }

  await assertCollectionNotOnLoan(
    ctx,
    args.collectionId,
    "Cannot add an object that is currently on loan",
  );

  const existingEntry = await ctx.db
    .query("exhibitionObjects")
    .withIndex("by_exhibition", (q) => q.eq("exhibitionId", args.exhibitionId))
    .filter((q) => q.eq(q.field("collectionId"), args.collectionId))
    .first();

  if (existingEntry) {
    throw new Error("Object is already added to this exhibition");
  }

  const members = await getExhibitionParticipants(ctx, args.exhibitionId);
  if (
    args.role === "featured" &&
    members.some((member) => member.role === "featured")
  ) {
    throw new Error("Only one featured object is allowed");
  }

  const originalLocation =
    args.originalLocationId ?? collection.currentLocationId ?? undefined;

  if (originalLocation)
    await requireUsableLocation(
      ctx,
      exhibition.organizationId,
      originalLocation,
    );
  const exhibitionLocationId =
    args.exhibitionLocationId ?? exhibition.locationId;
  if (exhibitionLocationId)
    await requireUsableLocation(
      ctx,
      exhibition.organizationId,
      exhibitionLocationId,
    );
  const objectId = await ctx.db.insert("exhibitionObjects", {
    exhibitionId: args.exhibitionId,
    organizationId: exhibition.organizationId,
    collectionId: args.collectionId,
    role: args.role ?? "participant",
    order: members.length,
    originalLocationId: originalLocation,
    exhibitionLocationId,
    status: "pending",
  });

  await ctx.runMutation(internal.audit.logAction, {
    organizationId: exhibition.organizationId,
    userId,
    action: "added_exhibition_object",
    entityType: "exhibition",
    entityId: args.exhibitionId,
    changes: { collectionId: args.collectionId },
  });

  return objectId;
}

export async function removeExhibitionObjectHandler(
  ctx: MutationCtx,
  args: { exhibitionObjectId: Id<"exhibitionObjects"> },
) {
  const { userId, exhibitionObject, exhibition } =
    await loadExhibitionObjectMutationContext(ctx, args.exhibitionObjectId);
  if (exhibition.participationVersion !== "members") {
    throw new Error(
      "Review legacy exhibition participation before removing objects",
    );
  }
  const members = await getExhibitionParticipants(ctx, exhibition._id);
  if (members.length <= 1)
    throw new Error("Exhibition must have at least one participant");

  if (exhibitionObject.status !== "pending") {
    throw new Error("Cannot remove object that has been installed");
  }

  if (
    exhibitionObject.installedAt !== undefined ||
    exhibitionObject.deinstalledAt !== undefined ||
    exhibitionObject.returnedAt !== undefined ||
    exhibitionObject.conditionAtInstallation !== undefined ||
    exhibitionObject.conditionAtDeinstallation !== undefined
  ) {
    rejectPermanentEvidenceDeletion();
  }

  await Promise.all([
    ctx.db.delete(args.exhibitionObjectId),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "removed_exhibition_object",
      entityType: "exhibition",
      entityId: exhibitionObject.exhibitionId,
      changes: { collectionId: exhibitionObject.collectionId },
    }),
  ]);

  return null;
}

export async function installObjectHandler(
  ctx: MutationCtx,
  args: {
    exhibitionObjectId: Id<"exhibitionObjects">;
    observedFromLocationId: Id<"locations"> | null;
    conditionNotes?: string;
    exhibitionLocationId?: Id<"locations">;
    installationConditionAssessmentId?: Id<"conditionAssessments">;
  },
) {
  const { userId, exhibitionObject, exhibition } =
    await loadExhibitionObjectMutationContext(ctx, args.exhibitionObjectId);

  if (exhibitionObject.status !== "pending") {
    throw new Error("Object is not in pending status");
  }

  const collection = await requireCollectionInOrganization(
    ctx,
    exhibitionObject.collectionId,
    exhibition.organizationId,
  );
  await assertCollectionNotOnLoan(
    ctx,
    exhibitionObject.collectionId,
    "Cannot install an object that is currently on loan",
  );

  const destinationId =
    args.exhibitionLocationId ??
    exhibitionObject.exhibitionLocationId ??
    exhibition.locationId;
  if (!destinationId) {
    throw new Error("Exhibition installation requires a destination location");
  }
  await requireUsableLocation(ctx, exhibition.organizationId, destinationId);

  const installationConditionAssessmentId =
    await requireAcceptedConditionAssessment(
      ctx,
      args.installationConditionAssessmentId,
      exhibitionObject.collectionId,
      true,
    );

  const movementId = await executeExhibitionMovement(
    ctx,
    collection,
    destinationId,
    userId,
    {
      kind: "exhibition_install",
      observedFromLocationId: args.observedFromLocationId,
      exhibitionObjectId: args.exhibitionObjectId,
      reason: "Exhibition installation",
    },
  );

  const installedAt = Date.now();
  await ctx.db.patch(args.exhibitionObjectId, {
    status: "installed",
    installedAt,
    installedBy: userId,
    conditionAtInstallation: args.conditionNotes,
    exhibitionLocationId: destinationId,
    installationMovementId: movementId,
    installationConditionAssessmentId,
  });

  await ctx.runMutation(internal.audit.logAction, {
    organizationId: exhibition.organizationId,
    userId,
    action: "installed_exhibition_object",
    entityType: "exhibition",
    entityId: exhibitionObject.exhibitionId,
    changes: {
      collectionId: exhibitionObject.collectionId,
      currentLocationId: destinationId,
      movementId,
      installationConditionAssessmentId,
    },
  });

  return null;
}

export async function deinstallObjectHandler(
  ctx: MutationCtx,
  args: {
    exhibitionObjectId: Id<"exhibitionObjects">;
    conditionNotes?: string;
    deinstallationConditionAssessmentId?: Id<"conditionAssessments">;
  },
) {
  const { userId, exhibitionObject, exhibition } =
    await loadExhibitionObjectMutationContext(ctx, args.exhibitionObjectId);

  if (exhibitionObject.status !== "installed") {
    throw new Error("Object is not installed");
  }

  const deinstallationConditionAssessmentId =
    await requireAcceptedConditionAssessment(
      ctx,
      args.deinstallationConditionAssessmentId,
      exhibitionObject.collectionId,
      true,
    );

  await Promise.all([
    ctx.db.patch(args.exhibitionObjectId, {
      status: "deinstalled",
      deinstalledAt: Date.now(),
      deinstalledBy: userId,
      conditionAtDeinstallation: args.conditionNotes,
      deinstallationConditionAssessmentId,
    }),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "deinstalled_exhibition_object",
      entityType: "exhibition",
      entityId: exhibitionObject.exhibitionId,
      changes: {
        collectionId: exhibitionObject.collectionId,
        conditionNotes: args.conditionNotes,
      },
    }),
  ]);

  return null;
}

export async function returnObjectToOriginalLocationHandler(
  ctx: MutationCtx,
  args: {
    exhibitionObjectId: Id<"exhibitionObjects">;
    observedFromLocationId: Id<"locations"> | null;
    overrideLocationId?: Id<"locations">;
    returnConditionAssessmentId?: Id<"conditionAssessments">;
  },
) {
  const { userId, exhibitionObject, exhibition } =
    await loadExhibitionObjectMutationContext(ctx, args.exhibitionObjectId);

  if (exhibitionObject.status !== "deinstalled") {
    throw new Error("Object must be deinstalled before physical return");
  }

  const returnLocation =
    args.overrideLocationId ?? exhibitionObject.originalLocationId;
  if (!returnLocation) {
    throw new Error("Return requires a confirmed destination location");
  }
  await requireUsableLocation(ctx, exhibition.organizationId, returnLocation);

  const collection = await requireCollectionInOrganization(
    ctx,
    exhibitionObject.collectionId,
    exhibition.organizationId,
  );

  const returnConditionAssessmentId = await requireAcceptedConditionAssessment(
    ctx,
    args.returnConditionAssessmentId,
    exhibitionObject.collectionId,
    true,
  );

  const movementId = await executeExhibitionMovement(
    ctx,
    collection,
    returnLocation,
    userId,
    {
      kind: "exhibition_return",
      observedFromLocationId: args.observedFromLocationId,
      exhibitionObjectId: args.exhibitionObjectId,
      reason: "Exhibition return",
    },
  );

  const returnedAt = Date.now();
  await Promise.all([
    ctx.db.patch(args.exhibitionObjectId, {
      status: "returned",
      returnedToOriginalLocation:
        exhibitionObject.originalLocationId !== undefined &&
        returnLocation === exhibitionObject.originalLocationId,
      returnedAt,
      returnMovementId: movementId,
      returnConditionAssessmentId,
    }),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "returned_exhibition_object",
      entityType: "exhibition",
      entityId: exhibitionObject.exhibitionId,
      changes: {
        collectionId: exhibitionObject.collectionId,
        returnedToLocationId: returnLocation,
        movementId,
        returnConditionAssessmentId,
      },
    }),
  ]);

  return null;
}

export async function authorizeReturnExceptionHandler(
  ctx: MutationCtx,
  args: {
    exhibitionObjectId: Id<"exhibitionObjects">;
    reason: string;
  },
) {
  const { userId, exhibitionObject, exhibition } =
    await loadExhibitionObjectMutationContext(ctx, args.exhibitionObjectId);

  if (
    exhibitionObject.status !== "installed" &&
    exhibitionObject.status !== "deinstalled"
  ) {
    throw new Error("Return exceptions apply only after deinstallation begins");
  }
  if (exhibitionObject.returnException) {
    throw new Error("Return exception is already recorded");
  }

  const reason = args.reason.trim();
  if (reason.length < 10) {
    throw new Error("Return exception reason must be at least 10 characters");
  }

  const authorizedAt = Date.now();
  await Promise.all([
    ctx.db.patch(args.exhibitionObjectId, {
      returnException: {
        reason,
        authorizedBy: userId,
        authorizedAt,
      },
    }),
    ctx.runMutation(internal.audit.logAction, {
      organizationId: exhibition.organizationId,
      userId,
      action: "authorized_exhibition_return_exception",
      entityType: "exhibition",
      entityId: exhibitionObject.exhibitionId,
      changes: {
        collectionId: exhibitionObject.collectionId,
        reason,
      },
    }),
  ]);

  return null;
}

export async function listExhibitionObjectsHandler(
  ctx: QueryCtx,
  args: { exhibitionId: Id<"exhibitions"> },
) {
  const exhibition = await ctx.db.get(args.exhibitionId);
  if (!exhibition) {
    return [];
  }

  await requireExhibitionReadPermission(ctx, exhibition.organizationId);

  const exhibitionObjects = await getExhibitionParticipants(
    ctx,
    args.exhibitionId,
  );

  return Promise.all(
    exhibitionObjects.map(async (obj) => {
      const collection = await ctx.db.get(obj.collectionId);
      const originalLocation = obj.originalLocationId
        ? await ctx.db.get(obj.originalLocationId)
        : null;
      const exhibitionLocation = obj.exhibitionLocationId
        ? await ctx.db.get(obj.exhibitionLocationId)
        : null;
      const installer = obj.installedBy
        ? await ctx.db.get(obj.installedBy)
        : null;
      const deinstaller = obj.deinstalledBy
        ? await ctx.db.get(obj.deinstalledBy)
        : null;

      return {
        _id: obj._id,
        collectionId: obj.collectionId,
        role: obj.role ?? "participant",
        order: obj.order ?? exhibitionObjects.indexOf(obj),
        collectionTitle:
          collection?.organizationId === exhibition.organizationId
            ? collection.title
            : undefined,
        collectionAccessionNumber:
          collection?.organizationId === exhibition.organizationId
            ? collection.accessionNumber
            : undefined,
        originalLocationId: obj.originalLocationId,
        originalLocationName:
          originalLocation?.organizationId === exhibition.organizationId
            ? originalLocation.name
            : undefined,
        exhibitionLocationId: obj.exhibitionLocationId,
        exhibitionLocationName:
          exhibitionLocation?.organizationId === exhibition.organizationId
            ? exhibitionLocation.name
            : undefined,
        status: obj.status,
        installedAt: obj.installedAt,
        installedByName: installer?.name ?? installer?.username ?? undefined,
        conditionAtInstallation: obj.conditionAtInstallation,
        deinstalledAt: obj.deinstalledAt,
        deinstalledByName:
          deinstaller?.name ?? deinstaller?.username ?? undefined,
        conditionAtDeinstallation: obj.conditionAtDeinstallation,
        returnedAt: obj.returnedAt,
        installationConditionAssessmentId:
          obj.installationConditionAssessmentId,
        deinstallationConditionAssessmentId:
          obj.deinstallationConditionAssessmentId,
        returnConditionAssessmentId: obj.returnConditionAssessmentId,
        returnExceptionReason: obj.returnException?.reason,
      };
    }),
  );
}

export async function bulkInstallObjectsHandler(
  _ctx: MutationCtx,
  _args: { exhibitionId: Id<"exhibitions"> },
): Promise<{ installedCount: number }> {
  throw new Error(
    "Record each exhibition object installation with observed source and movement evidence",
  );
}

export async function bulkReturnObjectsHandler(
  _ctx: MutationCtx,
  _args: { exhibitionId: Id<"exhibitions"> },
): Promise<{ returnedCount: number }> {
  throw new Error(
    "Record each exhibition object return with observed source and movement evidence",
  );
}
