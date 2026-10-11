import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { type CustodyConflictCode, custodyConflict } from "./custodyErrors";
import { isLoanItemDispatched, isLoanItemReturned } from "./loanItemState";
import type { MovementIssue, MovementKind } from "./movementValidators";

export async function requireUsableLocation(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  locationId: Id<"locations">,
  options?: { allowRestricted?: boolean },
): Promise<Doc<"locations">> {
  const location = await ctx.db.get(locationId);
  if (!location || location.organizationId !== organizationId) {
    throw custodyConflict(
      "REFERENCE_NOT_FOUND",
      "Location not found in this organization",
    );
  }
  if (
    !location.isActive ||
    (location.status &&
      location.status !== "active" &&
      !(options?.allowRestricted && location.status === "restricted"))
  ) {
    throw custodyConflict(
      "DESTINATION_UNAVAILABLE",
      `Location ${location.name} is unavailable for moves`,
      { locationName: location.name },
    );
  }
  return location;
}

export interface MovementGuardOptions {
  /** Source the actor observed; null means "no recorded location". */
  expectedFromLocationId?: Id<"locations"> | null;
  /** Reviewer accepted a closed, renovating or restricted destination. */
  statusOverride?: boolean;
  /** Reviewer accepted a destination at or above capacity. */
  capacityOverride?: boolean;
  /** Enforce destination capacity (direct and requested moves). */
  checkCapacity?: boolean;
}

export interface CollectionMovementOptions extends MovementGuardOptions {
  /**
   * Internal movement authority. When set, the object must be in
   * institutional custody (not dispatched on an outgoing loan).
   * Loan and exhibition workflows own their own custody checks.
   */
  kind?: MovementKind;
  notes?: string;
  authorizedBy?: Id<"users">;
  moveRequestId?: Id<"locationMoveRequests">;
  batchJobId?: Id<"batchJobs">;
  exhibitionObjectId?: Id<"exhibitionObjects">;
  transitItemId?: Id<"transitItems">;
  inventoryExceptionId?: Id<"inventoryExceptions">;
  /**
   * This movement is the return that ends external custody, so the
   * outgoing-loan guard must not block it.
   */
  releasingExternalCustody?: boolean;
}

/**
 * True when the object is physically held by an outgoing borrower: either the
 * lifecycle projection says so or a dispatched outgoing loan item has not
 * been received back.
 */
export async function isCollectionInExternalCustody(
  ctx: QueryCtx,
  collection: Doc<"collections">,
): Promise<boolean> {
  if (collection.status === "loaned") return true;
  const loanItems = await ctx.db
    .query("loanItems")
    .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
    .collect();
  for (const item of loanItems) {
    if (isLoanItemReturned(item)) continue;
    const loan = await ctx.db.get(item.loanId);
    if (
      loan?.type === "outgoing" &&
      loan.status !== "cancelled" &&
      loan.status !== "returned" &&
      isLoanItemDispatched(item, loan.status)
    ) {
      return true;
    }
  }
  return false;
}

function describeLocation(location: Doc<"locations"> | null | undefined) {
  return location?.name ?? "no recorded location";
}

/**
 * Evaluates every guard for moving one object, without writing. Used by the
 * movement command, preflight checks and delayed request execution so that
 * all of them refuse the same conflicts.
 */
export async function assessCollectionMovement(
  ctx: QueryCtx,
  collection: Doc<"collections">,
  toLocationId: Id<"locations">,
  options: MovementGuardOptions & { requireInstitutionalCustody?: boolean },
): Promise<{ issues: MovementIssue[]; toLocation: Doc<"locations"> | null }> {
  const issues: MovementIssue[] = [];
  const toLocation = await ctx.db.get(toLocationId);
  if (!toLocation || toLocation.organizationId !== collection.organizationId) {
    return {
      toLocation: null,
      issues: [
        {
          type: "location_missing",
          message: "Destination location not found in this organization",
          canOverride: false,
        },
      ],
    };
  }

  const currentLocationId = collection.currentLocationId ?? null;
  if (
    options.expectedFromLocationId !== undefined &&
    options.expectedFromLocationId !== currentLocationId
  ) {
    const current = currentLocationId
      ? await ctx.db.get(currentLocationId)
      : null;
    issues.push({
      type: "source_changed",
      message: `Object is now at ${describeLocation(current)}, not the source observed for this move`,
      canOverride: false,
    });
  } else if (currentLocationId === toLocationId) {
    issues.push({
      type: "already_at_destination",
      message: `Object is already at ${toLocation.name}`,
      canOverride: false,
    });
  }

  if (
    options.requireInstitutionalCustody &&
    (await isCollectionInExternalCustody(ctx, collection))
  ) {
    issues.push({
      type: "external_custody",
      message:
        "Object is out on loan; record its loan return before moving it internally",
      canOverride: false,
    });
  }

  const status = toLocation.status ?? "active";
  // Same wording as requireUsableLocation; the issue type names the reason.
  const unavailableMessage = `Location ${toLocation.name} is unavailable for moves`;
  if (!options.statusOverride) {
    if (!toLocation.isActive || status === "closed") {
      issues.push({
        type: "status_closed",
        message: unavailableMessage,
        canOverride: true,
      });
    } else if (status === "renovation") {
      issues.push({
        type: "status_renovation",
        message: unavailableMessage,
        canOverride: true,
      });
    } else if (status === "restricted") {
      issues.push({
        type: "status_restricted",
        message: unavailableMessage,
        canOverride: true,
      });
    }
  }

  if (
    options.checkCapacity &&
    toLocation.capacity &&
    !options.capacityOverride
  ) {
    const occupants = await ctx.db
      .query("collections")
      .withIndex("by_currentLocation", (q) =>
        q.eq("currentLocationId", toLocationId),
      )
      .take(toLocation.capacity);
    if (occupants.length >= toLocation.capacity) {
      issues.push({
        type: "capacity_exceeded",
        message: `${toLocation.name} is at capacity (${occupants.length}/${toLocation.capacity})`,
        canOverride: true,
      });
    }
  }

  return { issues, toLocation };
}

/** Null when there is no recorded location; omitted when it is not visible. */
export function visibleLocationName(
  location: Doc<"locations"> | null,
  organizationId: Id<"organizations">,
): string | null | undefined {
  if (!location) return null;
  return location.organizationId === organizationId ? location.name : undefined;
}

const MOVEMENT_ISSUE_CODES: Record<MovementIssue["type"], CustodyConflictCode> =
  {
    location_missing: "REFERENCE_NOT_FOUND",
    status_closed: "DESTINATION_UNAVAILABLE",
    status_renovation: "DESTINATION_UNAVAILABLE",
    status_restricted: "DESTINATION_UNAVAILABLE",
    capacity_exceeded: "DESTINATION_FULL",
    source_changed: "SOURCE_CHANGED",
    external_custody: "EXTERNAL_CUSTODY",
    already_at_destination: "ALREADY_AT_DESTINATION",
  };

async function movementIssueConflict(
  ctx: QueryCtx,
  issue: MovementIssue,
  collection: Doc<"collections">,
  toLocation: Doc<"locations"> | null,
) {
  const code = MOVEMENT_ISSUE_CODES[issue.type];
  if (code === "SOURCE_CHANGED") {
    const current = collection.currentLocationId
      ? await ctx.db.get(collection.currentLocationId)
      : null;
    return custodyConflict(code, issue.message, {
      currentLocationName: visibleLocationName(
        current,
        collection.organizationId,
      ),
    });
  }
  if (
    code === "REFERENCE_NOT_FOUND" ||
    code === "EXTERNAL_CUSTODY" ||
    !toLocation
  )
    return custodyConflict(code, issue.message);
  return custodyConflict(code, issue.message, {
    locationName: toLocation.name,
    capacity: code === "DESTINATION_FULL" ? toLocation.capacity : undefined,
  });
}

/**
 * The single accountable movement command: records actor, observed source,
 * destination, time, reason and authorizing case in the same transaction as
 * the current-location projection. Returns the history entry, or null when
 * the object is already at the destination (no movement happened).
 *
 * Without `options.kind` the legacy destination rule applies (exhibition and
 * loan workflows). With a kind, every guard from `assessCollectionMovement`
 * applies and the first issue is thrown; re-stating the current location
 * without an observed source is a no-op.
 */
export async function moveCollectionToLocation(
  ctx: MutationCtx,
  collection: Doc<"collections">,
  toLocationId: Id<"locations">,
  userId: Id<"users">,
  reason: string,
  options: CollectionMovementOptions = {},
): Promise<Id<"locationHistory"> | null> {
  if (options.kind) {
    const isUnobservedNoOp =
      options.expectedFromLocationId === undefined &&
      collection.currentLocationId === toLocationId;
    if (isUnobservedNoOp) return null;
    const { issues, toLocation } = await assessCollectionMovement(
      ctx,
      collection,
      toLocationId,
      {
        ...options,
        requireInstitutionalCustody: options.releasingExternalCustody !== true,
      },
    );
    const [blocking] = issues;
    if (blocking)
      throw await movementIssueConflict(ctx, blocking, collection, toLocation);
  } else {
    await requireUsableLocation(ctx, collection.organizationId, toLocationId);
  }
  if (collection.currentLocationId === toLocationId) return null;
  const movedAt = Date.now();
  const movementId = await ctx.db.insert("locationHistory", {
    collectionId: collection._id,
    fromLocationId: collection.currentLocationId,
    toLocationId,
    movedBy: userId,
    movedAt,
    reason,
    notes: options.notes,
    movementKind: options.kind,
    authorizedBy: options.authorizedBy,
    moveRequestId: options.moveRequestId,
    batchJobId: options.batchJobId,
    exhibitionObjectId: options.exhibitionObjectId,
    transitItemId: options.transitItemId,
    inventoryExceptionId: options.inventoryExceptionId,
  });
  await ctx.db.patch(collection._id, {
    currentLocationId: toLocationId,
    lastModifiedBy: userId,
    lastModifiedAt: movedAt,
  });
  return movementId;
}

/**
 * Records an object leaving institutional custody. The history row cites the
 * last on-site place and has no destination, and the location projection is
 * cleared in the same write.
 */
export async function recordCustodyDeparture(
  ctx: MutationCtx,
  collection: Doc<"collections">,
  userId: Id<"users">,
  reason: string,
  options: {
    kind: MovementKind;
    fromLocationId?: Id<"locations">;
    transitItemId?: Id<"transitItems">;
    notes?: string;
  },
): Promise<Id<"locationHistory"> | null> {
  const fromLocationId = options.fromLocationId ?? collection.currentLocationId;
  if (!fromLocationId) return null;
  const movedAt = Date.now();
  const movementId = await ctx.db.insert("locationHistory", {
    collectionId: collection._id,
    fromLocationId,
    movedBy: userId,
    movedAt,
    reason,
    notes: options.notes,
    movementKind: options.kind,
    transitItemId: options.transitItemId,
  });
  await ctx.db.patch(collection._id, {
    currentLocationId: undefined,
    lastModifiedBy: userId,
    lastModifiedAt: movedAt,
  });
  return movementId;
}

export async function requireCollectionInOrganization(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
  organizationId: Id<"organizations">,
): Promise<Doc<"collections">> {
  const collection = await ctx.db.get(collectionId);
  if (!collection || collection.organizationId !== organizationId)
    throw custodyConflict(
      "REFERENCE_NOT_FOUND",
      "Collection not found in this organization",
    );
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
