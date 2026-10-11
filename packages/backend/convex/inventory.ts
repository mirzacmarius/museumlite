import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, query } from "./_generated/server";
import { CAPABILITY_MATRIX } from "./utils/capabilities";
import { custodyConflict } from "./utils/custodyErrors";
import { normalizeIdentifier } from "./utils/identifiers";
import { inventoryError } from "./utils/inventoryErrors";
import {
  type InventoryExceptionResolution,
  type InventoryObservationOutcome,
  inventoryCaptureMethodValidator,
  inventoryExceptionKindValidator,
  inventoryExceptionResolutionValidator,
  inventoryExceptionStatusValidator,
  inventoryObservationOutcomeValidator,
  inventorySessionStatusValidator,
} from "./utils/inventoryValidators";
import {
  isCollectionInExternalCustody,
  moveCollectionToLocation,
} from "./utils/locationIntegrity";
import { mutation } from "./utils/mutationBuilders";
import { hasPermission, requireCapability } from "./utils/permissions";

/**
 * Inventory sessions (MUS-662, ADR 0014): staff compare the objects recorded
 * in a location scope with what they observe there. Observations are
 * evidence; they never move an object.
 */

const VIEW_PERMISSIONS = CAPABILITY_MATRIX.inventory.permissions;
/** Scanning and resolving change custody evidence, like moving does. */
const WORK_PERMISSION = "locations.update";

export const MAX_SCOPE_LOCATIONS = 200;
export const MAX_EXPECTED_OBJECTS = 1000;
const MAX_NAME_LENGTH = 120;

async function requireInventoryAccess(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  extra: readonly string[] = [],
) {
  await requireCapability(ctx, organizationId, "inventory", [
    ...VIEW_PERMISSIONS,
    ...extra,
  ]);
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

/** The session, for a member who may follow inventory in its organization. */
async function loadSession(
  ctx: QueryCtx | MutationCtx,
  sessionId: Id<"inventorySessions">,
  extra: readonly string[] = [],
) {
  const session = await ctx.db.get(sessionId);
  if (!session)
    throw inventoryError("SESSION_NOT_FOUND", "Inventory session not found");
  const userId = await requireInventoryAccess(
    ctx,
    session.organizationId,
    extra,
  );
  return { session, userId };
}

function requiredName(value: string) {
  const name = value.trim();
  if (!name) throw inventoryError("NAME_REQUIRED", "A name is required");
  if (name.length > MAX_NAME_LENGTH)
    throw inventoryError("TEXT_TOO_LONG", "The name is too long", {
      limit: MAX_NAME_LENGTH,
    });
  return name;
}

function byPlacement(a: Doc<"locations">, b: Doc<"locations">) {
  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
}

/** The scope Location, then everything below it in tree order. */
async function scopeLocations(
  ctx: QueryCtx,
  root: Doc<"locations">,
  includeSublocations: boolean,
) {
  const scope: Doc<"locations">[] = [];
  const visit = async (location: Doc<"locations">) => {
    if (scope.length >= MAX_SCOPE_LOCATIONS)
      throw inventoryError(
        "SCOPE_TOO_LARGE",
        "The scope has too many locations",
        { limit: MAX_SCOPE_LOCATIONS },
      );
    scope.push(location);
    if (!includeSublocations) return;
    const children = await ctx.db
      .query("locations")
      .withIndex("by_parentLocation", (q) =>
        q.eq("parentLocationId", location._id),
      )
      .take(MAX_SCOPE_LOCATIONS + 1);
    for (const child of children
      .filter((row) => row.organizationId === root.organizationId)
      .sort(byPlacement))
      await visit(child);
  };
  await visit(root);
  return scope;
}

/** Collection objects whose record places them in the scope. */
async function expectedObjects(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  scope: Doc<"locations">[],
) {
  const expected: Doc<"collections">[] = [];
  for (const location of scope) {
    const rows = await ctx.db
      .query("collections")
      .withIndex("by_organization_and_location", (q) =>
        q
          .eq("organizationId", organizationId)
          .eq("currentLocationId", location._id),
      )
      .take(MAX_EXPECTED_OBJECTS * 2);
    expected.push(...rows.filter((row) => row.status === "active"));
    if (
      expected.length > MAX_EXPECTED_OBJECTS ||
      rows.length >= MAX_EXPECTED_OBJECTS * 2
    )
      throw inventoryError(
        "SCOPE_TOO_LARGE",
        "The scope holds too many objects for one session",
        { limit: MAX_EXPECTED_OBJECTS },
      );
  }
  return expected;
}

export const startSession = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    scopeLocationId: v.id("locations"),
    includeSublocations: v.boolean(),
  },
  returns: v.id("inventorySessions"),
  handler: async (ctx, args) => {
    const userId = await requireInventoryAccess(ctx, args.organizationId, [
      WORK_PERMISSION,
    ]);
    const name = requiredName(args.name);
    const root = await ctx.db.get(args.scopeLocationId);
    if (!root || root.organizationId !== args.organizationId)
      throw inventoryError(
        "LOCATION_NOT_FOUND",
        "Location not found in this organization",
      );
    const scope = await scopeLocations(ctx, root, args.includeSublocations);
    const objects = await expectedObjects(ctx, args.organizationId, scope);

    const now = Date.now();
    const sessionId = await ctx.db.insert("inventorySessions", {
      organizationId: args.organizationId,
      name,
      scopeLocationId: root._id,
      includeSublocations: args.includeSublocations,
      scopeLocationIds: scope.map((location) => location._id),
      status: "scanning",
      expectedCount: objects.length,
      observedExpectedCount: 0,
      observationCount: 0,
      openExceptionCount: 0,
      exceptionCount: 0,
      startedBy: userId,
      startedAt: now,
    });
    for (const object of objects) {
      if (!object.currentLocationId) continue;
      await ctx.db.insert("inventoryExpectedObjects", {
        organizationId: args.organizationId,
        sessionId,
        collectionId: object._id,
        expectedLocationId: object.currentLocationId,
      });
    }
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "started_inventory_session",
      entityType: "inventorySession",
      entityId: sessionId,
      changes: {
        name,
        scopeLocationId: root._id,
        includeSublocations: args.includeSublocations,
        expectedCount: objects.length,
      },
    });
    return sessionId;
  },
});

function displayName(user: Doc<"users"> | null) {
  return user?.name || user?.email || undefined;
}

const scopeLocationValidator = v.object({
  _id: v.id("locations"),
  name: v.string(),
  locationCode: v.optional(v.string()),
  parentLocationId: v.optional(v.id("locations")),
});

const sessionViewValidator = v.object({
  _id: v.id("inventorySessions"),
  organizationId: v.id("organizations"),
  name: v.string(),
  status: inventorySessionStatusValidator,
  scopeLocationId: v.id("locations"),
  includeSublocations: v.boolean(),
  scopeLocations: v.array(scopeLocationValidator),
  progress: v.object({
    expected: v.number(),
    observed: v.number(),
    remaining: v.number(),
  }),
  observationCount: v.number(),
  exceptionCount: v.number(),
  openExceptionCount: v.number(),
  startedAt: v.number(),
  startedByName: v.optional(v.string()),
  finishedAt: v.optional(v.number()),
  finishedByName: v.optional(v.string()),
  reconciledAt: v.optional(v.number()),
  cancelledAt: v.optional(v.number()),
  cancelledByName: v.optional(v.string()),
  cancelReason: v.optional(v.string()),
  /** The viewer may scan, finish, cancel and resolve exceptions. */
  canWork: v.boolean(),
});

/** Null when the session does not exist (the page shows its recovery state). */
export const getSession = query({
  args: { sessionId: v.id("inventorySessions") },
  returns: v.union(sessionViewValidator, v.null()),
  handler: async (ctx, args) => {
    if (!(await ctx.db.get(args.sessionId))) return null;
    const { session } = await loadSession(ctx, args.sessionId);
    const [locations, startedBy, finishedBy, cancelledBy, canWork] =
      await Promise.all([
        Promise.all(session.scopeLocationIds.map((id) => ctx.db.get(id))),
        ctx.db.get(session.startedBy),
        session.finishedBy ? ctx.db.get(session.finishedBy) : null,
        session.cancelledBy ? ctx.db.get(session.cancelledBy) : null,
        hasPermission(ctx, session.organizationId, WORK_PERMISSION),
      ]);
    return {
      _id: session._id,
      organizationId: session.organizationId,
      name: session.name,
      status: session.status,
      scopeLocationId: session.scopeLocationId,
      includeSublocations: session.includeSublocations,
      scopeLocations: locations.flatMap((location) =>
        location && location.organizationId === session.organizationId
          ? [
              {
                _id: location._id,
                name: location.name,
                locationCode: location.locationCode,
                parentLocationId: location.parentLocationId,
              },
            ]
          : [],
      ),
      progress: {
        expected: session.expectedCount,
        observed: session.observedExpectedCount,
        remaining: session.expectedCount - session.observedExpectedCount,
      },
      observationCount: session.observationCount,
      exceptionCount: session.exceptionCount,
      openExceptionCount: session.openExceptionCount,
      startedAt: session.startedAt,
      startedByName: displayName(startedBy),
      finishedAt: session.finishedAt,
      finishedByName: displayName(finishedBy),
      reconciledAt: session.reconciledAt,
      cancelledAt: session.cancelledAt,
      cancelledByName: displayName(cancelledBy),
      cancelReason: session.cancelReason,
      canWork,
    };
  },
});

const expectedRowValidator = v.object({
  _id: v.id("inventoryExpectedObjects"),
  collectionId: v.id("collections"),
  accessionNumber: v.string(),
  title: v.string(),
  expectedLocationId: v.id("locations"),
  expectedLocationName: v.string(),
  observed: v.boolean(),
  observedAt: v.optional(v.number()),
  observedLocationName: v.optional(v.string()),
});

/** The session's expected objects in scope order, with what was observed. */
export const listExpected = query({
  args: { sessionId: v.id("inventorySessions") },
  returns: v.array(expectedRowValidator),
  handler: async (ctx, args) => {
    const { session } = await loadSession(ctx, args.sessionId);
    const rows = await ctx.db
      .query("inventoryExpectedObjects")
      .withIndex("by_session_and_collection", (q) =>
        q.eq("sessionId", session._id),
      )
      .take(MAX_EXPECTED_OBJECTS);
    const locationOrder = new Map(
      session.scopeLocationIds.map((id, index) => [id, index] as const),
    );
    const locationNames = new Map<Id<"locations">, string>();
    for (const id of session.scopeLocationIds) {
      const location = await ctx.db.get(id);
      if (location) locationNames.set(id, location.name);
    }
    const result = await Promise.all(
      rows.map(async (row) => {
        const [object, observation] = await Promise.all([
          ctx.db.get(row.collectionId),
          row.firstObservationId ? ctx.db.get(row.firstObservationId) : null,
        ]);
        return {
          _id: row._id,
          collectionId: row.collectionId,
          accessionNumber: object?.accessionNumber ?? "",
          title: object?.title ?? "",
          expectedLocationId: row.expectedLocationId,
          expectedLocationName: locationNames.get(row.expectedLocationId) ?? "",
          observed: !!observation,
          observedAt: observation?.observedAt,
          observedLocationName: observation
            ? locationNames.get(observation.observedLocationId)
            : undefined,
        };
      }),
    );
    return result.sort(
      (a, b) =>
        (locationOrder.get(a.expectedLocationId) ?? 0) -
          (locationOrder.get(b.expectedLocationId) ?? 0) ||
        a.accessionNumber.localeCompare(b.accessionNumber, undefined, {
          numeric: true,
        }),
    );
  },
});

const MAX_SCANNED_VALUE_LENGTH = 500;
const MAX_CLIENT_ID_LENGTH = 100;
const MAX_NOTE_LENGTH = 1000;
export const MAX_OBSERVATIONS = 3000;

function optionalNote(value: string | undefined) {
  const note = value?.trim();
  if (!note) return undefined;
  if (note.length > MAX_NOTE_LENGTH)
    throw inventoryError("TEXT_TOO_LONG", "The note is too long", {
      limit: MAX_NOTE_LENGTH,
    });
  return note;
}

/** The object id in an object label URL (`…/objects/<id>`), if any. */
function objectIdFromLabel(value: string) {
  try {
    const segments = new URL(value).pathname.split("/").filter(Boolean);
    const index = segments.lastIndexOf("objects");
    return index === -1 ? undefined : segments[index + 1];
  } catch {
    return undefined;
  }
}

/**
 * Resolves a scanned label or typed identifier to one of the organization's
 * objects. An identifier several objects share resolves to the one the
 * session expects, otherwise to nothing.
 */
async function resolveScannedObject(
  ctx: QueryCtx,
  session: Doc<"inventorySessions">,
  value: string,
) {
  const labelId = objectIdFromLabel(value);
  if (labelId !== undefined) {
    const id = ctx.db.normalizeId("collections", labelId);
    const object = id ? await ctx.db.get(id) : null;
    return object?.organizationId === session.organizationId ? object : null;
  }
  const exact = await ctx.db
    .query("collections")
    .withIndex("by_organization_and_accessionNumber", (q) =>
      q
        .eq("organizationId", session.organizationId)
        .eq("accessionNumber", value),
    )
    .take(10);
  const candidates =
    exact.length > 0
      ? exact
      : await ctx.db
          .query("collections")
          .withIndex("by_organization_and_normalizedIdentifier", (q) =>
            q
              .eq("organizationId", session.organizationId)
              .eq("normalizedIdentifier", normalizeIdentifier(value)),
          )
          .take(10);
  if (candidates.length === 1) return candidates[0] ?? null;
  for (const candidate of candidates) {
    if (await expectedRow(ctx, session._id, candidate._id)) return candidate;
  }
  return null;
}

async function expectedRow(
  ctx: QueryCtx,
  sessionId: Id<"inventorySessions">,
  collectionId: Id<"collections">,
) {
  return await ctx.db
    .query("inventoryExpectedObjects")
    .withIndex("by_session_and_collection", (q) =>
      q.eq("sessionId", sessionId).eq("collectionId", collectionId),
    )
    .unique();
}

const observationResultValidator = v.object({
  observationId: v.id("inventoryObservations"),
  outcome: inventoryObservationOutcomeValidator,
  object: v.optional(
    v.object({
      collectionId: v.id("collections"),
      accessionNumber: v.string(),
      title: v.string(),
      recordedLocationName: v.optional(v.string()),
    }),
  ),
  alreadyRecorded: v.boolean(),
});

async function observationResult(
  ctx: QueryCtx,
  observation: Doc<"inventoryObservations">,
  alreadyRecorded: boolean,
) {
  const [object, recordedLocation] = await Promise.all([
    observation.collectionId ? ctx.db.get(observation.collectionId) : null,
    observation.recordedLocationId
      ? ctx.db.get(observation.recordedLocationId)
      : null,
  ]);
  return {
    observationId: observation._id,
    outcome: observation.outcome,
    object: object
      ? {
          collectionId: object._id,
          accessionNumber: object.accessionNumber,
          title: object.title,
          recordedLocationName: recordedLocation?.name,
        }
      : undefined,
    alreadyRecorded,
  };
}

/**
 * Records that a label was scanned (or an identifier typed) at a Location in
 * scope. The observation is evidence only: the object's record is not
 * changed. Retrying with the same `clientObservationId` returns the first
 * result.
 */
export const recordObservation = mutation({
  args: {
    sessionId: v.id("inventorySessions"),
    clientObservationId: v.string(),
    scannedValue: v.string(),
    method: inventoryCaptureMethodValidator,
    observedLocationId: v.id("locations"),
    note: v.optional(v.string()),
  },
  returns: observationResultValidator,
  handler: async (ctx, args) => {
    const { session, userId } = await loadSession(ctx, args.sessionId, [
      WORK_PERMISSION,
    ]);
    const clientObservationId = args.clientObservationId.trim();
    if (
      !clientObservationId ||
      clientObservationId.length > MAX_CLIENT_ID_LENGTH
    )
      throw inventoryError(
        "SCAN_VALUE_REQUIRED",
        "Each scan needs an identifier",
      );
    const previous = await ctx.db
      .query("inventoryObservations")
      .withIndex("by_session_and_clientObservationId", (q) =>
        q
          .eq("sessionId", session._id)
          .eq("clientObservationId", clientObservationId),
      )
      .unique();
    if (previous) return await observationResult(ctx, previous, true);

    if (session.status !== "scanning")
      throw inventoryError(
        "SESSION_NOT_SCANNING",
        "This session is no longer scanning",
      );
    if (!session.scopeLocationIds.includes(args.observedLocationId))
      throw inventoryError(
        "LOCATION_OUT_OF_SCOPE",
        "That location is not in this session's scope",
      );
    const scannedValue = args.scannedValue.trim();
    if (!scannedValue)
      throw inventoryError("SCAN_VALUE_REQUIRED", "Nothing was scanned");
    if (scannedValue.length > MAX_SCANNED_VALUE_LENGTH)
      throw inventoryError("TEXT_TOO_LONG", "The scanned value is too long", {
        limit: MAX_SCANNED_VALUE_LENGTH,
      });
    if (session.observationCount >= MAX_OBSERVATIONS)
      throw inventoryError(
        "OBSERVATION_LIMIT_REACHED",
        "This session has reached its observation limit",
        { limit: MAX_OBSERVATIONS },
      );
    const note = optionalNote(args.note);

    const object = await resolveScannedObject(ctx, session, scannedValue);
    const expected = object
      ? await expectedRow(ctx, session._id, object._id)
      : null;
    const seenBefore = object
      ? await ctx.db
          .query("inventoryObservations")
          .withIndex("by_session_and_collection", (q) =>
            q.eq("sessionId", session._id).eq("collectionId", object._id),
          )
          .first()
      : null;
    const outcome: InventoryObservationOutcome = !object
      ? "unknown"
      : seenBefore
        ? "repeat"
        : !expected
          ? "unexpected"
          : expected.expectedLocationId === args.observedLocationId
            ? "expected"
            : "misplaced";

    const observationId = await ctx.db.insert("inventoryObservations", {
      organizationId: session.organizationId,
      sessionId: session._id,
      clientObservationId,
      scannedValue,
      method: args.method,
      observedLocationId: args.observedLocationId,
      observedBy: userId,
      observedAt: Date.now(),
      note,
      collectionId: object?._id,
      recordedLocationId: expected
        ? expected.expectedLocationId
        : object?.currentLocationId,
      outcome,
    });
    const firstSighting = expected && !expected.firstObservationId;
    if (firstSighting)
      await ctx.db.patch(expected._id, { firstObservationId: observationId });
    await ctx.db.patch(session._id, {
      observationCount: session.observationCount + 1,
      observedExpectedCount:
        session.observedExpectedCount + (firstSighting ? 1 : 0),
    });
    const observation = await ctx.db.get(observationId);
    if (!observation) throw new Error("Observation was not recorded");
    return await observationResult(ctx, observation, false);
  },
});

const MAX_OBSERVATIONS_LISTED = 200;

const observationRowValidator = v.object({
  _id: v.id("inventoryObservations"),
  scannedValue: v.string(),
  method: inventoryCaptureMethodValidator,
  outcome: inventoryObservationOutcomeValidator,
  observedAt: v.number(),
  observedByName: v.optional(v.string()),
  observedLocationId: v.id("locations"),
  observedLocationName: v.optional(v.string()),
  recordedLocationName: v.optional(v.string()),
  collectionId: v.optional(v.id("collections")),
  accessionNumber: v.optional(v.string()),
  title: v.optional(v.string()),
  note: v.optional(v.string()),
});

/** The most recent observations first (at most 200). */
export const listObservations = query({
  args: { sessionId: v.id("inventorySessions") },
  returns: v.array(observationRowValidator),
  handler: async (ctx, args) => {
    const { session } = await loadSession(ctx, args.sessionId);
    const rows = await ctx.db
      .query("inventoryObservations")
      .withIndex("by_session_and_observedAt", (q) =>
        q.eq("sessionId", session._id),
      )
      .order("desc")
      .take(MAX_OBSERVATIONS_LISTED);
    const names = new NameCache(ctx, session.organizationId);
    return await Promise.all(
      rows.map(async (row) => {
        const object = row.collectionId
          ? await ctx.db.get(row.collectionId)
          : null;
        return {
          _id: row._id,
          scannedValue: row.scannedValue,
          method: row.method,
          outcome: row.outcome,
          observedAt: row.observedAt,
          observedByName: await names.user(row.observedBy),
          observedLocationId: row.observedLocationId,
          observedLocationName: await names.location(row.observedLocationId),
          recordedLocationName: await names.location(row.recordedLocationId),
          collectionId: object?._id,
          accessionNumber: object?.accessionNumber,
          title: object?.title,
          note: row.note,
        };
      }),
    );
  },
});

/** Reads each user and location name once per query. */
class NameCache {
  private users = new Map<Id<"users">, Promise<string | undefined>>();
  private locations = new Map<Id<"locations">, Promise<string | undefined>>();

  constructor(
    private ctx: QueryCtx,
    private organizationId: Id<"organizations">,
  ) {}

  user(id: Id<"users"> | undefined) {
    if (!id) return Promise.resolve(undefined);
    let name = this.users.get(id);
    if (!name) {
      name = this.ctx.db.get(id).then(displayName);
      this.users.set(id, name);
    }
    return name;
  }

  location(id: Id<"locations"> | undefined) {
    if (!id) return Promise.resolve(undefined);
    let name = this.locations.get(id);
    if (!name) {
      name = this.ctx.db
        .get(id)
        .then((location) =>
          location?.organizationId === this.organizationId
            ? location.name
            : undefined,
        );
      this.locations.set(id, name);
    }
    return name;
  }
}

type NewException = Omit<
  Doc<"inventoryExceptions">,
  | "_id"
  | "_creationTime"
  | "organizationId"
  | "sessionId"
  | "status"
  | "detectedAt"
  | "label"
>;

/** The differences between the expectation and what was observed. */
async function detectExceptions(
  ctx: QueryCtx,
  session: Doc<"inventorySessions">,
): Promise<NewException[]> {
  const [expectedRows, observations] = await Promise.all([
    ctx.db
      .query("inventoryExpectedObjects")
      .withIndex("by_session_and_collection", (q) =>
        q.eq("sessionId", session._id),
      )
      .take(MAX_EXPECTED_OBJECTS),
    ctx.db
      .query("inventoryObservations")
      .withIndex("by_session_and_observedAt", (q) =>
        q.eq("sessionId", session._id),
      )
      .take(MAX_OBSERVATIONS),
  ]);
  const byObject = new Map<Id<"collections">, Doc<"inventoryObservations">[]>();
  const unknownLabels = new Map<string, Doc<"inventoryObservations">>();
  for (const observation of observations) {
    if (observation.collectionId) {
      const seen = byObject.get(observation.collectionId) ?? [];
      seen.push(observation);
      byObject.set(observation.collectionId, seen);
    } else {
      const key = normalizeIdentifier(observation.scannedValue);
      if (!unknownLabels.has(key)) unknownLabels.set(key, observation);
    }
  }

  const exceptions: NewException[] = [];
  const expectedIds = new Set<Id<"collections">>();
  for (const row of expectedRows) {
    expectedIds.add(row.collectionId);
    const seen = byObject.get(row.collectionId) ?? [];
    const [first] = seen;
    if (!first) {
      exceptions.push({
        kind: "missing",
        collectionId: row.collectionId,
        recordedLocationId: row.expectedLocationId,
      });
    } else if (
      !seen.some(
        (observation) =>
          observation.observedLocationId === row.expectedLocationId,
      )
    ) {
      exceptions.push({
        kind: "misplaced",
        collectionId: row.collectionId,
        recordedLocationId: row.expectedLocationId,
        observedLocationId: first.observedLocationId,
        observationId: first._id,
      });
    }
  }
  for (const [collectionId, seen] of byObject) {
    const [first] = seen;
    if (expectedIds.has(collectionId) || !first) continue;
    exceptions.push({
      kind: "unexpected",
      collectionId,
      recordedLocationId: first.recordedLocationId,
      observedLocationId: first.observedLocationId,
      observationId: first._id,
    });
  }
  for (const observation of unknownLabels.values()) {
    exceptions.push({
      kind: "unknown_label",
      scannedValue: observation.scannedValue,
      observedLocationId: observation.observedLocationId,
      observationId: observation._id,
    });
  }
  return exceptions;
}

/**
 * Ends scanning and records every difference as an open exception, in one
 * bounded transaction. A session without differences is reconciled at once.
 * Finishing again returns without change.
 */
export const finishScanning = mutation({
  args: { sessionId: v.id("inventorySessions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { session, userId } = await loadSession(ctx, args.sessionId, [
      WORK_PERMISSION,
    ]);
    if (session.status === "reviewing" || session.status === "reconciled")
      return null;
    if (session.status !== "scanning")
      throw inventoryError(
        "SESSION_NOT_SCANNING",
        "This session is no longer scanning",
      );
    const exceptions = await detectExceptions(ctx, session);
    const now = Date.now();
    for (const exception of exceptions) {
      const object = exception.collectionId
        ? await ctx.db.get(exception.collectionId)
        : null;
      await ctx.db.insert("inventoryExceptions", {
        ...exception,
        label: object?.accessionNumber ?? exception.scannedValue ?? "",
        organizationId: session.organizationId,
        sessionId: session._id,
        status: "open",
        detectedAt: now,
      });
    }
    await ctx.db.patch(session._id, {
      status: exceptions.length === 0 ? "reconciled" : "reviewing",
      finishedBy: userId,
      finishedAt: now,
      reconciledAt: exceptions.length === 0 ? now : undefined,
      exceptionCount: exceptions.length,
      openExceptionCount: exceptions.length,
    });
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: session.organizationId,
      userId,
      action: "finished_inventory_session",
      entityType: "inventorySession",
      entityId: session._id,
      changes: {
        expectedCount: session.expectedCount,
        observedExpectedCount: session.observedExpectedCount,
        observationCount: session.observationCount,
        exceptionCount: exceptions.length,
      },
    });
    return null;
  },
});

/** Stops a scanning session. Its observations stay as evidence. */
export const cancelSession = mutation({
  args: { sessionId: v.id("inventorySessions"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { session, userId } = await loadSession(ctx, args.sessionId, [
      WORK_PERMISSION,
    ]);
    const reason = optionalNote(args.reason);
    if (!reason)
      throw inventoryError("REASON_REQUIRED", "A reason is required");
    if (session.status === "cancelled") return null;
    if (session.status !== "scanning")
      throw inventoryError(
        "SESSION_NOT_SCANNING",
        "Only a scanning session can be cancelled",
      );
    await ctx.db.patch(session._id, {
      status: "cancelled",
      cancelledBy: userId,
      cancelledAt: Date.now(),
      cancelReason: reason,
    });
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: session.organizationId,
      userId,
      action: "cancelled_inventory_session",
      entityType: "inventorySession",
      entityId: session._id,
      changes: { reason, observationCount: session.observationCount },
    });
    return null;
  },
});

const EXCEPTION_KIND_ORDER = [
  "missing",
  "misplaced",
  "unexpected",
  "unknown_label",
] as const;
const MAX_EXCEPTIONS_LISTED = 1000;

const exceptionRowValidator = v.object({
  _id: v.id("inventoryExceptions"),
  sessionId: v.id("inventorySessions"),
  kind: inventoryExceptionKindValidator,
  status: inventoryExceptionStatusValidator,
  collectionId: v.optional(v.id("collections")),
  accessionNumber: v.optional(v.string()),
  title: v.optional(v.string()),
  scannedValue: v.optional(v.string()),
  recordedLocationId: v.optional(v.id("locations")),
  recordedLocationName: v.optional(v.string()),
  observedLocationId: v.optional(v.id("locations")),
  observedLocationName: v.optional(v.string()),
  observedAt: v.optional(v.number()),
  observedByName: v.optional(v.string()),
  detectedAt: v.number(),
  resolution: v.optional(inventoryExceptionResolutionValidator),
  resolvedAt: v.optional(v.number()),
  resolvedByName: v.optional(v.string()),
});

async function exceptionRow(
  ctx: QueryCtx,
  names: NameCache,
  exception: Doc<"inventoryExceptions">,
) {
  const [object, observation] = await Promise.all([
    exception.collectionId ? ctx.db.get(exception.collectionId) : null,
    exception.observationId ? ctx.db.get(exception.observationId) : null,
  ]);
  const visibleObject =
    object?.organizationId === exception.organizationId ? object : null;
  return {
    _id: exception._id,
    sessionId: exception.sessionId,
    kind: exception.kind,
    status: exception.status,
    collectionId: exception.collectionId,
    accessionNumber: visibleObject?.accessionNumber,
    title: visibleObject?.title,
    scannedValue: exception.scannedValue,
    recordedLocationId: exception.recordedLocationId,
    recordedLocationName: await names.location(exception.recordedLocationId),
    observedLocationId: exception.observedLocationId,
    observedLocationName: await names.location(exception.observedLocationId),
    observedAt: observation?.observedAt,
    observedByName: await names.user(observation?.observedBy),
    detectedAt: exception.detectedAt,
    resolution: exception.resolution,
    resolvedAt: exception.resolvedAt,
    resolvedByName: await names.user(exception.resolvedBy),
  };
}

export const listExceptions = query({
  args: { sessionId: v.id("inventorySessions") },
  returns: v.array(exceptionRowValidator),
  handler: async (ctx, args) => {
    const { session } = await loadSession(ctx, args.sessionId);
    const rows = await ctx.db
      .query("inventoryExceptions")
      .withIndex("by_session_and_kind", (q) => q.eq("sessionId", session._id))
      .take(MAX_EXCEPTIONS_LISTED);
    const names = new NameCache(ctx, session.organizationId);
    const result = await Promise.all(
      rows.map((row) => exceptionRow(ctx, names, row)),
    );
    const label = (row: (typeof result)[number]) =>
      row.accessionNumber ?? row.scannedValue ?? "";
    return result.sort(
      (a, b) =>
        EXCEPTION_KIND_ORDER.indexOf(a.kind) -
          EXCEPTION_KIND_ORDER.indexOf(b.kind) ||
        label(a).localeCompare(label(b), undefined, { numeric: true }),
    );
  },
});

/** The exception, for a member who may resolve exceptions in its organization. */
async function loadExceptionForWork(
  ctx: MutationCtx,
  exceptionId: Id<"inventoryExceptions">,
) {
  const exception = await ctx.db.get(exceptionId);
  if (!exception)
    throw inventoryError(
      "EXCEPTION_NOT_FOUND",
      "Inventory exception not found",
    );
  const userId = await requireInventoryAccess(ctx, exception.organizationId, [
    WORK_PERMISSION,
  ]);
  const session = await ctx.db.get(exception.sessionId);
  if (!session) throw inventoryError("SESSION_NOT_FOUND", "Session not found");
  return { exception, session, userId };
}

/**
 * Closes an open exception with its resolution, and reconciles the session
 * when it was the last one.
 */
async function closeException(
  ctx: MutationCtx,
  session: Doc<"inventorySessions">,
  exception: Doc<"inventoryExceptions">,
  userId: Id<"users">,
  resolution: InventoryExceptionResolution,
) {
  const now = Date.now();
  await ctx.db.patch(exception._id, {
    status: resolution.kind === "accepted" ? "accepted" : "resolved",
    resolution,
    resolvedBy: userId,
    resolvedAt: now,
  });
  const openExceptionCount = Math.max(0, session.openExceptionCount - 1);
  await ctx.db.patch(session._id, {
    openExceptionCount,
    ...(openExceptionCount === 0
      ? { status: "reconciled" as const, reconciledAt: now }
      : {}),
  });
  await ctx.runMutation(internal.audit.logAction, {
    organizationId: session.organizationId,
    userId,
    action:
      resolution.kind === "accepted"
        ? "accepted_inventory_exception"
        : "resolved_inventory_exception",
    entityType: "inventoryException",
    entityId: exception._id,
    changes: {
      inventorySessionId: session._id,
      kind: exception.kind,
      collectionId: exception.collectionId,
      resolution: resolution.kind,
      ...(resolution.kind === "moved"
        ? { movementId: resolution.movementId }
        : {}),
      ...(resolution.kind === "accepted" ? { reason: resolution.reason } : {}),
    },
  });
}

const resolutionResultValidator = v.object({
  resolution: inventoryExceptionResolutionValidator,
  alreadyResolved: v.boolean(),
});

/**
 * Records that a misplaced or unexpected object is where it was observed,
 * through the guarded movement command: the recorded location the exception
 * names must still be the object's source, and the destination and custody
 * guards apply. A refusal leaves the exception open. Repeating it after it
 * succeeded returns the first resolution.
 */
export const recordObservedLocation = mutation({
  args: { exceptionId: v.id("inventoryExceptions") },
  returns: resolutionResultValidator,
  handler: async (ctx, args) => {
    const { exception, session, userId } = await loadExceptionForWork(
      ctx,
      args.exceptionId,
    );
    if (exception.status !== "open") {
      if (exception.resolution && exception.resolution.kind !== "accepted")
        return { resolution: exception.resolution, alreadyResolved: true };
      throw inventoryError("EXCEPTION_CLOSED", "This exception is closed");
    }
    if (
      (exception.kind !== "misplaced" && exception.kind !== "unexpected") ||
      !exception.collectionId ||
      !exception.observedLocationId
    )
      throw inventoryError(
        "EXCEPTION_NOT_MOVABLE",
        "Only an object observed in another place can be moved there",
      );
    const object = await ctx.db.get(exception.collectionId);
    if (!object || object.organizationId !== exception.organizationId)
      throw custodyConflict(
        "REFERENCE_NOT_FOUND",
        "Collection not found in this organization",
      );
    if (await isCollectionInExternalCustody(ctx, object))
      throw custodyConflict(
        "EXTERNAL_CUSTODY",
        "Object is out on loan; record its loan return before moving it internally",
      );

    let resolution: InventoryExceptionResolution;
    if (object.currentLocationId === exception.observedLocationId) {
      resolution = { kind: "location_confirmed" };
    } else {
      const movementId = await moveCollectionToLocation(
        ctx,
        object,
        exception.observedLocationId,
        userId,
        `Inventory: found during ${session.name}`,
        {
          kind: "inventory_reconciliation",
          expectedFromLocationId: exception.recordedLocationId ?? null,
          checkCapacity: true,
          authorizedBy: userId,
          inventoryExceptionId: exception._id,
        },
      );
      resolution = movementId
        ? { kind: "moved", movementId }
        : { kind: "location_confirmed" };
    }
    await closeException(ctx, session, exception, userId, resolution);
    return { resolution, alreadyResolved: false };
  },
});

/** Closes an exception as a reviewed exception, with the reviewer's reason. */
export const acceptException = mutation({
  args: { exceptionId: v.id("inventoryExceptions"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { exception, session, userId } = await loadExceptionForWork(
      ctx,
      args.exceptionId,
    );
    const reason = optionalNote(args.reason);
    if (!reason)
      throw inventoryError("REASON_REQUIRED", "A reason is required");
    if (exception.status !== "open")
      throw inventoryError("EXCEPTION_CLOSED", "This exception is closed");
    await closeException(ctx, session, exception, userId, {
      kind: "accepted",
      reason,
    });
    return null;
  },
});

export const getException = query({
  args: { exceptionId: v.id("inventoryExceptions") },
  returns: v.union(
    exceptionRowValidator.extend({
      organizationId: v.id("organizations"),
      label: v.string(),
      sessionName: v.string(),
      sessionStatus: inventorySessionStatusValidator,
      observationNote: v.optional(v.string()),
      observationMethod: v.optional(inventoryCaptureMethodValidator),
      canWork: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const exception = await ctx.db.get(args.exceptionId);
    if (!exception) return null;
    const { session } = await loadSession(ctx, exception.sessionId);
    const [row, observation, canWork] = await Promise.all([
      exceptionRow(ctx, new NameCache(ctx, session.organizationId), exception),
      exception.observationId ? ctx.db.get(exception.observationId) : null,
      hasPermission(ctx, session.organizationId, WORK_PERMISSION),
    ]);
    return {
      ...row,
      organizationId: session.organizationId,
      label: exception.label,
      sessionName: session.name,
      sessionStatus: session.status,
      observationNote: observation?.note,
      observationMethod: observation?.method,
      canWork,
    };
  },
});

const MAX_SESSIONS_LISTED = 100;

const sessionRowValidator = v.object({
  _id: v.id("inventorySessions"),
  name: v.string(),
  status: inventorySessionStatusValidator,
  scopeLocationId: v.id("locations"),
  scopeLocationName: v.optional(v.string()),
  includeSublocations: v.boolean(),
  progress: v.object({
    expected: v.number(),
    observed: v.number(),
    remaining: v.number(),
  }),
  observationCount: v.number(),
  openExceptionCount: v.number(),
  startedAt: v.number(),
  startedByName: v.optional(v.string()),
});

/** The organization's most recent sessions, newest first (at most 100). */
export const listSessions = query({
  args: { organizationId: v.id("organizations") },
  returns: v.array(sessionRowValidator),
  handler: async (ctx, args) => {
    await requireInventoryAccess(ctx, args.organizationId);
    const sessions = await ctx.db
      .query("inventorySessions")
      .withIndex("by_organization_and_startedAt", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .take(MAX_SESSIONS_LISTED);
    const names = new NameCache(ctx, args.organizationId);
    return await Promise.all(
      sessions.map(async (session) => ({
        _id: session._id,
        name: session.name,
        status: session.status,
        scopeLocationId: session.scopeLocationId,
        scopeLocationName: await names.location(session.scopeLocationId),
        includeSublocations: session.includeSublocations,
        progress: {
          expected: session.expectedCount,
          observed: session.observedExpectedCount,
          remaining: session.expectedCount - session.observedExpectedCount,
        },
        observationCount: session.observationCount,
        openExceptionCount: session.openExceptionCount,
        startedAt: session.startedAt,
        startedByName: await names.user(session.startedBy),
      })),
    );
  },
});
