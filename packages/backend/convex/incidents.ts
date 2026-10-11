import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, query } from "./_generated/server";
import { displayName, isOpenStatus } from "./utils/caseTaskRules";
import {
  COORDINATE_PERMISSION,
  incidentViewer,
  READ_PERMISSION,
  requireCoordinator,
  requireMover,
  requireOpen,
  requireVisibleIncident,
  requireWorker,
  seesIncident,
  WORK_PERMISSION,
} from "./utils/incidentAccess";
import {
  type IncidentEventAction,
  incidentAfterActionValidator,
  incidentEventActionValidator,
  incidentHandoffDirectionValidator,
  incidentImpactValidator,
  incidentKindValidator,
  incidentSeverityValidator,
  incidentStatusValidator,
} from "./utils/incidentValidators";
import { moveCollectionToLocation } from "./utils/locationIntegrity";
import {
  memberPermissionNames,
  rolePermissionNames,
} from "./utils/memberPermissions";
import { mutation } from "./utils/mutationBuilders";
import { dispatchNotification } from "./utils/notificationDispatch";
import { generateNextIncidentNumber } from "./utils/numberGenerator";
import { getUserIdsWithPermission } from "./utils/permissions";
import { suggestPreparation } from "./utils/preparation";
import { workError, workErrorFromError } from "./utils/workErrors";

const MAX_TITLE_LENGTH = 200;
const MAX_TEXT_LENGTH = 4000;
const MAX_LOCATIONS = 10;
export const MAX_INCIDENT_OBJECTS = 50;
const MAX_HANDOFFS = 200;
const EVENTS_SHOWN = 100;
const MAX_PAGE_SIZE = 50;
const MAX_RESPONDERS = 20;
const MAX_PLANS = 5;
/** Clock skew tolerated on a reported discovery time. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

// ============================================
// SHARED
// ============================================

function requiredText(value: string, maxLength: number, message: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength)
    throw workError("INVALID_INPUT", message);
  return trimmed;
}

function optionalText(value: string | undefined, message: string) {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.length > MAX_TEXT_LENGTH)
    throw workError("INVALID_INPUT", message);
  return trimmed || undefined;
}

function requireTime(value: number, message: string) {
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > Date.now() + FUTURE_TOLERANCE_MS
  )
    throw workError("INVALID_INPUT", message);
  return value;
}

/** Appends to the incident's own log and returns the entry's ordinal. */
export async function appendIncidentEvent(
  ctx: MutationCtx,
  incident: Doc<"incidents">,
  actorId: Id<"users">,
  action: IncidentEventAction,
  details: Partial<
    Pick<
      Doc<"incidentEvents">,
      | "note"
      | "objectId"
      | "fromLocationId"
      | "toLocationId"
      | "userId"
      | "value"
      | "count"
    >
  > = {},
) {
  const current = await ctx.db.get(incident._id);
  const ordinal = (current?.eventCount ?? incident.eventCount) + 1;
  const at = Date.now();
  await ctx.db.insert("incidentEvents", {
    organizationId: incident.organizationId,
    incidentId: incident._id,
    ordinal,
    action,
    actorId,
    at,
    ...details,
  });
  await ctx.db.patch(incident._id, { eventCount: ordinal, updatedAt: at });
  return ordinal;
}

/**
 * Records the incident action in the organization audit log. Only the
 * incident number and non-identifying fields are written there; the detail
 * stays in the incident's scoped event log (ADR 0014).
 */
export async function auditIncident(
  ctx: MutationCtx,
  incident: Doc<"incidents">,
  userId: Id<"users">,
  action: string,
  changes: Record<string, string | number | boolean | undefined> = {},
) {
  await ctx.runMutation(internal.audit.logAction, {
    organizationId: incident.organizationId,
    userId,
    action,
    entityType: "incident",
    entityId: incident._id,
    changes: {
      incidentNumber: incident.incidentNumber,
      sensitive: incident.sensitive,
      ...changes,
    },
  });
}

/** Headline a notification may carry: sensitive incidents name only their number. */
export function incidentHeadline(incident: Doc<"incidents">) {
  return incident.sensitive
    ? `${incident.incidentNumber} (restricted)`
    : `${incident.incidentNumber}: ${incident.title}`;
}

async function requireLocationsInOrganization(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  locationIds: Id<"locations">[],
) {
  const unique = [...new Set(locationIds)];
  if (unique.length > MAX_LOCATIONS)
    throw workError("LIMIT_REACHED", "Too many locations");
  const locations = await Promise.all(unique.map((id) => ctx.db.get(id)));
  for (const location of locations)
    if (!location || location.organizationId !== organizationId)
      throw workError(
        "INVALID_INPUT",
        "Location not found in this organization",
      );
  return unique;
}

export async function requireObjectsInOrganization(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  collectionIds: Id<"collections">[],
) {
  const unique = [...new Set(collectionIds)];
  if (unique.length > MAX_INCIDENT_OBJECTS)
    throw workError("LIMIT_REACHED", "Too many objects for one incident");
  const objects = await Promise.all(unique.map((id) => ctx.db.get(id)));
  return objects.map((object) => {
    if (!object || object.organizationId !== organizationId)
      throw workError("INVALID_INPUT", "Object not found in this organization");
    return object;
  });
}

/** Links objects that are not on the incident yet; returns how many were added. */
export async function linkObjects(
  ctx: MutationCtx,
  incident: Doc<"incidents">,
  objects: Doc<"collections">[],
  impact: Doc<"incidentObjects">["impact"],
  userId: Id<"users">,
) {
  const existing = await incidentObjectRows(ctx, incident._id);
  const linked = new Set(existing.map((row) => row.collectionId));
  const added = objects.filter((object) => !linked.has(object._id));
  if (existing.length + added.length > MAX_INCIDENT_OBJECTS)
    throw workError("LIMIT_REACHED", "Too many objects for one incident");
  const now = Date.now();
  for (const object of added)
    await ctx.db.insert("incidentObjects", {
      organizationId: incident.organizationId,
      incidentId: incident._id,
      collectionId: object._id,
      impact,
      locationAtReportId: object.currentLocationId,
      addedBy: userId,
      addedAt: now,
      updatedAt: now,
    });
  return added.length;
}

export async function incidentObjectRows(
  ctx: QueryCtx,
  incidentId: Id<"incidents">,
) {
  return await ctx.db
    .query("incidentObjects")
    .withIndex("by_incident_and_collection", (q) =>
      q.eq("incidentId", incidentId),
    )
    .take(MAX_INCIDENT_OBJECTS);
}

/** Members who may see the incident, from `candidates`, minus the actor. */
export async function recipientsInScope(
  ctx: QueryCtx,
  incident: Doc<"incidents">,
  candidates: Iterable<Id<"users">>,
  actorId: Id<"users">,
) {
  const recipients: Id<"users">[] = [];
  for (const userId of new Set(candidates)) {
    if (userId === actorId) continue;
    const permissions = await memberPermissionNames(
      ctx,
      incident.organizationId,
      userId,
    );
    if (seesIncident(incident, userId, permissions)) recipients.push(userId);
  }
  return recipients;
}

// ============================================
// INTAKE
// ============================================

export const report = mutation({
  args: {
    organizationId: v.id("organizations"),
    /** Generated once per report form; a retry with it returns the first incident. */
    intakeKey: v.string(),
    kind: incidentKindValidator,
    title: v.string(),
    description: v.optional(v.string()),
    discoveredAt: v.number(),
    occurredAt: v.optional(v.number()),
    locationIds: v.array(v.id("locations")),
    collectionIds: v.array(v.id("collections")),
    impact: v.optional(incidentImpactValidator),
    sensitive: v.boolean(),
    alertEpisodeId: v.optional(v.id("alertEpisodes")),
  },
  returns: v.object({
    incidentId: v.id("incidents"),
    duplicate: v.boolean(),
    /** False when the existing incident is sensitive and the caller is not in its scope. */
    visible: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const viewer = await incidentViewer(ctx, args.organizationId);
    const intakeKey = requiredText(
      args.intakeKey,
      100,
      "Intake key is invalid",
    );
    const repeated = await ctx.db
      .query("incidents")
      .withIndex("by_organization_and_intakeKey", (q) =>
        q.eq("organizationId", args.organizationId).eq("intakeKey", intakeKey),
      )
      .first();
    if (repeated)
      return {
        incidentId: repeated._id,
        duplicate: true,
        visible: seesIncident(repeated, viewer.userId, viewer.permissions),
      };

    let locationIds = args.locationIds;
    let sourceKey: string | undefined;
    if (args.alertEpisodeId !== undefined) {
      if (!viewer.permissions.has("locations.read"))
        throw workError("INVALID_INPUT", "Alert episode not found");
      const episode = await ctx.db.get(args.alertEpisodeId);
      if (!episode || episode.organizationId !== args.organizationId)
        throw workError("INVALID_INPUT", "Alert episode not found");
      sourceKey = `alertEpisode:${episode._id}`;
      const existing = await ctx.db
        .query("incidents")
        .withIndex("by_organization_and_sourceKey", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("sourceKey", sourceKey),
        )
        .first();
      if (existing) {
        await appendIncidentEvent(
          ctx,
          existing,
          viewer.userId,
          "report_repeated",
        );
        return {
          incidentId: existing._id,
          duplicate: true,
          visible: seesIncident(existing, viewer.userId, viewer.permissions),
        };
      }
      locationIds = [episode.locationId, ...locationIds];
    }

    const title = requiredText(
      args.title,
      MAX_TITLE_LENGTH,
      "Describe what happened in 1-200 characters",
    );
    const description = optionalText(
      args.description,
      "Description is too long",
    );
    const discoveredAt = requireTime(
      args.discoveredAt,
      "Discovery time is invalid",
    );
    const occurredAt =
      args.occurredAt === undefined
        ? undefined
        : requireTime(args.occurredAt, "Time it happened is invalid");
    if (occurredAt !== undefined && occurredAt > discoveredAt)
      throw workError(
        "INVALID_INPUT",
        "It cannot have happened after it was discovered",
      );
    const locations = await requireLocationsInOrganization(
      ctx,
      args.organizationId,
      locationIds,
    );
    const objects = await requireObjectsInOrganization(
      ctx,
      args.organizationId,
      args.collectionIds,
    );
    if (locations.length === 0 && objects.length === 0)
      throw workError(
        "INVALID_INPUT",
        "Name at least one affected location or object",
      );

    const now = Date.now();
    const incidentNumber = await generateNextIncidentNumber(
      ctx,
      args.organizationId,
    );
    const incidentId = await ctx.db.insert("incidents", {
      organizationId: args.organizationId,
      incidentNumber,
      kind: args.kind,
      title,
      description,
      status: "reported",
      open: true,
      sensitive: args.sensitive,
      discoveredAt,
      occurredAt,
      locationIds: locations,
      reportedBy: viewer.userId,
      reportedAt: now,
      intakeKey,
      source:
        args.alertEpisodeId === undefined
          ? undefined
          : { kind: "alertEpisode", episodeId: args.alertEpisodeId },
      sourceKey,
      responderIds: [],
      plans: [],
      eventCount: 0,
      updatedAt: now,
    });
    const incident = (await ctx.db.get(incidentId))!;
    await linkObjects(
      ctx,
      incident,
      objects,
      args.impact ?? "at_risk",
      viewer.userId,
    );
    const ordinal = await appendIncidentEvent(
      ctx,
      incident,
      viewer.userId,
      "reported",
      { count: objects.length },
    );
    await auditIncident(ctx, incident, viewer.userId, "incident_reported", {
      kind: args.kind,
    });
    const coordinators = await getUserIdsWithPermission(
      ctx,
      args.organizationId,
      COORDINATE_PERMISSION,
    );
    await dispatchNotification(ctx, {
      organizationId: args.organizationId,
      type: "incident_reported",
      recipients: await recipientsInScope(
        ctx,
        incident,
        coordinators,
        viewer.userId,
      ),
      title: "Incident Reported",
      message: `${incidentHeadline(incident)} needs triage`,
      related: { entityType: "incident", entityId: incidentId },
      idempotencyKey: `incident:${incidentId}:${ordinal}`,
    });
    return { incidentId, duplicate: false, visible: true };
  },
});

// ============================================
// TRIAGE
// ============================================

async function requireMemberWith(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
  permissions: string[],
  message: string,
) {
  const held = await memberPermissionNames(ctx, organizationId, userId);
  if (!held || permissions.some((permission) => !held.has(permission)))
    throw workError("ASSIGNEE_NOT_ELIGIBLE", message);
  return held;
}

/** Active incident response plans of the organization, by id. */
async function requireAvailablePlans(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  recipeIds: Id<"preparationRecipes">[],
) {
  const unique = [...new Set(recipeIds)];
  if (unique.length > MAX_PLANS)
    throw workError("LIMIT_REACHED", "Choose at most five plans");
  const recipes = await Promise.all(unique.map((id) => ctx.db.get(id)));
  return recipes.map((recipe) => {
    if (
      !recipe ||
      recipe.organizationId !== organizationId ||
      recipe.trigger !== "incident_response" ||
      recipe.status !== "active"
    )
      throw workError(
        "PLAN_NOT_AVAILABLE",
        "Only active incident response plans can guide a response",
      );
    return { recipeId: recipe._id, name: recipe.name };
  });
}

/**
 * Open tasks on a sensitive incident must stay with people in its scope, so
 * restricting it never cuts someone off from their own work.
 */
async function requireTaskPeopleInScope(
  ctx: QueryCtx,
  incident: Doc<"incidents">,
) {
  const tasks = await ctx.db
    .query("caseTasks")
    .withIndex("by_organization_and_caseType_and_caseId", (q) =>
      q
        .eq("organizationId", incident.organizationId)
        .eq("caseType", "incident")
        .eq("caseId", incident._id),
    )
    .take(100);
  const people = new Set(
    tasks.flatMap((task) =>
      isOpenStatus(task.status)
        ? [task.ownerId, ...(task.reviewerId ? [task.reviewerId] : [])]
        : [],
    ),
  );
  for (const userId of people) {
    const permissions = await memberPermissionNames(
      ctx,
      incident.organizationId,
      userId,
    );
    if (!seesIncident(incident, userId, permissions))
      throw workError(
        "ASSIGNEE_NOT_ELIGIBLE",
        "Name everyone with open tasks as a responder before restricting the incident",
      );
  }
}

/**
 * Triage, or a later change to the response: severity, lead, responders,
 * sensitivity and the plans that guide it. Plans are only ever the ones the
 * coordinator chose here; choosing more later adds their steps, and a plan
 * once chosen stays on the record (ADR 0014).
 */
export const triage = mutation({
  args: {
    incidentId: v.id("incidents"),
    severity: incidentSeverityValidator,
    leadId: v.id("users"),
    responderIds: v.array(v.id("users")),
    sensitive: v.boolean(),
    plan: v.union(
      v.object({ kind: v.literal("none") }),
      v.object({
        kind: v.literal("plans"),
        recipeIds: v.array(v.id("preparationRecipes")),
      }),
    ),
    note: v.optional(v.string()),
  },
  returns: v.object({
    suggested: v.number(),
    existing: v.number(),
    skipped: v.array(
      v.object({
        recipeName: v.string(),
        stepTitle: v.string(),
        reason: v.union(v.literal("no_owner"), v.literal("limit_reached")),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const { incident, viewer } = await requireVisibleIncident(
      ctx,
      args.incidentId,
    );
    requireCoordinator(viewer);
    requireOpen(incident);
    const org = incident.organizationId;
    const note = optionalText(args.note, "Note is too long");
    await requireMemberWith(
      ctx,
      org,
      args.leadId,
      [READ_PERMISSION, WORK_PERMISSION],
      "The lead must be a member who can work on collection cases",
    );
    const responderIds = [...new Set(args.responderIds)].filter(
      (id) => id !== args.leadId,
    );
    if (responderIds.length > MAX_RESPONDERS)
      throw workError("LIMIT_REACHED", "Too many responders");
    for (const userId of responderIds)
      await requireMemberWith(
        ctx,
        org,
        userId,
        [READ_PERMISSION],
        "Responders must be members who can read the collection",
      );
    if (args.plan.kind === "plans" && args.plan.recipeIds.length === 0)
      throw workError(
        "INVALID_INPUT",
        "Choose a plan or record that none applies",
      );
    const chosen =
      args.plan.kind === "plans"
        ? await requireAvailablePlans(ctx, org, args.plan.recipeIds)
        : [];
    const known = new Set(incident.plans.map((plan) => plan.recipeId));
    const addedPlans = chosen.filter((plan) => !known.has(plan.recipeId));
    if (incident.plans.length + addedPlans.length > MAX_PLANS)
      throw workError("LIMIT_REACHED", "Choose at most five plans");

    const firstTriage = incident.triagedAt === undefined;
    const now = Date.now();
    const updated: Doc<"incidents"> = {
      ...incident,
      status: "responding",
      severity: args.severity,
      leadId: args.leadId,
      responderIds,
      sensitive: args.sensitive,
      triagedBy: incident.triagedBy ?? viewer.userId,
      triagedAt: incident.triagedAt ?? now,
      triageNote: note ?? incident.triageNote,
      plans: [...incident.plans, ...addedPlans],
    };
    if (updated.sensitive) await requireTaskPeopleInScope(ctx, updated);
    await ctx.db.patch(incident._id, {
      status: updated.status,
      severity: updated.severity,
      leadId: updated.leadId,
      responderIds: updated.responderIds,
      sensitive: updated.sensitive,
      triagedBy: updated.triagedBy,
      triagedAt: updated.triagedAt,
      triageNote: updated.triageNote,
      plans: updated.plans,
      updatedAt: now,
    });
    const ordinal = await appendIncidentEvent(
      ctx,
      updated,
      viewer.userId,
      firstTriage ? "triaged" : "response_updated",
      { value: args.severity, userId: args.leadId, note },
    );
    await auditIncident(
      ctx,
      updated,
      viewer.userId,
      firstTriage ? "incident_triaged" : "incident_response_updated",
      { severity: args.severity, planCount: updated.plans.length },
    );
    if (args.leadId !== incident.leadId && args.leadId !== viewer.userId)
      await dispatchNotification(ctx, {
        organizationId: org,
        type: "incident_lead_assigned",
        recipients: [args.leadId],
        title: "Incident Lead Assigned",
        message: `You lead the response to ${incidentHeadline(updated)}`,
        related: { entityType: "incident", entityId: incident._id },
        idempotencyKey: `incident:${incident._id}:${ordinal}`,
      });
    const outcome = await suggestPreparation(
      ctx,
      { organizationId: org, caseType: "incident", caseId: incident._id },
      viewer.userId,
    );
    if (addedPlans.length > 0)
      await appendIncidentEvent(ctx, updated, viewer.userId, "plans_applied", {
        value: addedPlans.map((plan) => plan.name).join(", "),
        count: outcome.suggested,
      });
    return outcome;
  },
});

// ============================================
// AFFECTED OBJECTS AND HANDOFFS
// ============================================

async function requireAffectedObject(
  ctx: QueryCtx,
  incident: Doc<"incidents">,
  collectionId: Id<"collections">,
) {
  const row = await ctx.db
    .query("incidentObjects")
    .withIndex("by_incident_and_collection", (q) =>
      q.eq("incidentId", incident._id).eq("collectionId", collectionId),
    )
    .unique();
  if (!row)
    throw workError(
      "OBJECT_NOT_AFFECTED",
      "Add the object to the incident first",
    );
  return row;
}

export const addObjects = mutation({
  args: {
    incidentId: v.id("incidents"),
    collectionIds: v.array(v.id("collections")),
    impact: incidentImpactValidator,
  },
  returns: v.object({ added: v.number() }),
  handler: async (ctx, args) => {
    const { incident, viewer } = await requireVisibleIncident(
      ctx,
      args.incidentId,
    );
    requireWorker(viewer);
    requireOpen(incident);
    if (args.collectionIds.length === 0)
      throw workError("INVALID_INPUT", "Choose at least one object");
    const objects = await requireObjectsInOrganization(
      ctx,
      incident.organizationId,
      args.collectionIds,
    );
    const added = await linkObjects(
      ctx,
      incident,
      objects,
      args.impact,
      viewer.userId,
    );
    if (added > 0) {
      await appendIncidentEvent(ctx, incident, viewer.userId, "objects_added", {
        count: added,
        value: args.impact,
      });
      await auditIncident(
        ctx,
        incident,
        viewer.userId,
        "incident_objects_added",
        {
          count: added,
        },
      );
    }
    return { added };
  },
});

export const setObjectImpact = mutation({
  args: {
    incidentId: v.id("incidents"),
    collectionId: v.id("collections"),
    impact: incidentImpactValidator,
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { incident, viewer } = await requireVisibleIncident(
      ctx,
      args.incidentId,
    );
    requireWorker(viewer);
    requireOpen(incident);
    const row = await requireAffectedObject(ctx, incident, args.collectionId);
    const note = optionalText(args.note, "Note is too long");
    if (row.impact === args.impact && row.note === note) return null;
    await ctx.db.patch(row._id, {
      impact: args.impact,
      note,
      updatedAt: Date.now(),
    });
    await appendIncidentEvent(ctx, incident, viewer.userId, "impact_changed", {
      objectId: args.collectionId,
      value: args.impact,
      note,
    });
    return null;
  },
});

/**
 * Evacuates an affected object to safety or recovers it, through the guarded
 * movement command: the mover's permission, the source they observed and the
 * destination's status and capacity are checked, and the movement row cites
 * the incident. A retry with the same key returns the first movement.
 */
export const recordHandoff = mutation({
  args: {
    incidentId: v.id("incidents"),
    collectionId: v.id("collections"),
    direction: incidentHandoffDirectionValidator,
    toLocationId: v.id("locations"),
    /** Where the mover saw the object; null when it had no recorded location. */
    expectedFromLocationId: v.union(v.id("locations"), v.null()),
    handoffKey: v.string(),
    notes: v.optional(v.string()),
    overrideStatus: v.optional(v.boolean()),
    overrideCapacity: v.optional(v.boolean()),
  },
  returns: v.object({
    movementId: v.id("locationHistory"),
    duplicate: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { incident, viewer } = await requireVisibleIncident(
      ctx,
      args.incidentId,
    );
    requireMover(viewer);
    const handoffKey = requiredText(
      args.handoffKey,
      100,
      "Handoff key is invalid",
    );
    const repeated = await ctx.db
      .query("incidentHandoffs")
      .withIndex("by_incident_and_handoffKey", (q) =>
        q.eq("incidentId", incident._id).eq("handoffKey", handoffKey),
      )
      .unique();
    if (repeated) return { movementId: repeated.movementId, duplicate: true };
    requireOpen(incident);
    await requireAffectedObject(ctx, incident, args.collectionId);
    const object = await ctx.db.get(args.collectionId);
    if (!object || object.organizationId !== incident.organizationId)
      throw workError("OBJECT_NOT_AFFECTED", "Object not found");
    const notes = optionalText(args.notes, "Notes are too long");
    const fromLocationId = object.currentLocationId;
    const movementId = await moveCollectionToLocation(
      ctx,
      object,
      args.toLocationId,
      viewer.userId,
      `${args.direction === "evacuation" ? "Evacuation" : "Recovery"} for ${incident.incidentNumber}`,
      {
        kind:
          args.direction === "evacuation"
            ? "incident_evacuation"
            : "incident_recovery",
        notes,
        expectedFromLocationId: args.expectedFromLocationId,
        statusOverride: args.overrideStatus,
        capacityOverride: args.overrideCapacity,
        checkCapacity: true,
        incidentId: incident._id,
      },
    );
    if (!movementId)
      throw workError("INVALID_INPUT", "The object is already there");
    const movedAt = Date.now();
    await ctx.db.insert("incidentHandoffs", {
      organizationId: incident.organizationId,
      incidentId: incident._id,
      collectionId: object._id,
      direction: args.direction,
      movementId,
      fromLocationId,
      toLocationId: args.toLocationId,
      handoffKey,
      movedBy: viewer.userId,
      movedAt,
    });
    await appendIncidentEvent(
      ctx,
      incident,
      viewer.userId,
      args.direction === "evacuation" ? "evacuated" : "recovered",
      {
        objectId: object._id,
        fromLocationId,
        toLocationId: args.toLocationId,
        note: notes,
      },
    );
    await auditIncident(
      ctx,
      incident,
      viewer.userId,
      `incident_${args.direction}`,
      { collectionId: object._id },
    );
    return { movementId, duplicate: false };
  },
});

// ============================================
// AFTER-ACTION
// ============================================

async function openTaskCount(ctx: QueryCtx, incident: Doc<"incidents">) {
  const open = await ctx.db
    .query("caseTasks")
    .withIndex("by_organization_and_caseType_and_caseId", (q) =>
      q
        .eq("organizationId", incident.organizationId)
        .eq("caseType", "incident")
        .eq("caseId", incident._id),
    )
    .take(100);
  return open.filter((task) => isOpenStatus(task.status)).length;
}

/** Lead and responders, who hear when the response ends. */
function responseTeam(incident: Doc<"incidents">) {
  return [
    ...(incident.leadId ? [incident.leadId] : []),
    ...incident.responderIds,
  ];
}

/**
 * Closes the incident with its after-action record. Every task must be done
 * or cancelled first; closing never moves, returns or reassesses an object.
 */
export const close = mutation({
  args: {
    incidentId: v.id("incidents"),
    summary: v.string(),
    whatWorked: v.optional(v.string()),
    improvements: v.optional(v.string()),
    followUp: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { incident, viewer } = await requireVisibleIncident(
      ctx,
      args.incidentId,
    );
    requireCoordinator(viewer);
    if (incident.status === "closed") return null;
    const summary = requiredText(
      args.summary,
      MAX_TEXT_LENGTH,
      "Summarize what happened and how the response went",
    );
    const afterAction = {
      summary,
      whatWorked: optionalText(args.whatWorked, "Text is too long"),
      improvements: optionalText(args.improvements, "Text is too long"),
      followUp: optionalText(args.followUp, "Text is too long"),
      recordedBy: viewer.userId,
      recordedAt: Date.now(),
    };
    const openCount = await openTaskCount(ctx, incident);
    if (openCount > 0)
      throw workError(
        "TASKS_OPEN",
        "Finish or cancel the incident's tasks first",
        { openCount },
      );
    await ctx.db.patch(incident._id, {
      status: "closed",
      open: false,
      afterAction,
      closedAt: afterAction.recordedAt,
    });
    const ordinal = await appendIncidentEvent(
      ctx,
      incident,
      viewer.userId,
      "closed",
      { note: summary },
    );
    await auditIncident(ctx, incident, viewer.userId, "incident_closed");
    await dispatchNotification(ctx, {
      organizationId: incident.organizationId,
      type: "incident_closed",
      recipients: await recipientsInScope(
        ctx,
        incident,
        responseTeam(incident),
        viewer.userId,
      ),
      title: "Incident Closed",
      message: `${incidentHeadline(incident)} was closed with its after-action review`,
      related: { entityType: "incident", entityId: incident._id },
      idempotencyKey: `incident:${incident._id}:${ordinal}`,
    });
    return null;
  },
});

/** Reopens a closed incident; its after-action record stays on file. */
export const reopen = mutation({
  args: { incidentId: v.id("incidents"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { incident, viewer } = await requireVisibleIncident(
      ctx,
      args.incidentId,
    );
    requireCoordinator(viewer);
    if (incident.status !== "closed") return null;
    const reason = requiredText(
      args.reason,
      MAX_TEXT_LENGTH,
      "Give a reason for reopening",
    );
    await ctx.db.patch(incident._id, {
      status: incident.triagedAt === undefined ? "reported" : "responding",
      open: true,
      afterAction: undefined,
      earlierAfterActions: [
        ...(incident.earlierAfterActions ?? []),
        ...(incident.afterAction ? [incident.afterAction] : []),
      ],
      closedAt: undefined,
    });
    await appendIncidentEvent(ctx, incident, viewer.userId, "reopened", {
      note: reason,
    });
    await auditIncident(ctx, incident, viewer.userId, "incident_reopened");
    return null;
  },
});

// ============================================
// QUERIES
// ============================================

const listRowValidator = v.object({
  _id: v.id("incidents"),
  incidentNumber: v.string(),
  kind: incidentKindValidator,
  title: v.string(),
  status: incidentStatusValidator,
  severity: v.optional(incidentSeverityValidator),
  sensitive: v.boolean(),
  reportedAt: v.number(),
  discoveredAt: v.number(),
  leadName: v.optional(v.string()),
});

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    filter: v.union(v.literal("open"), v.literal("closed")),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(listRowValidator),
  handler: async (ctx, args) => {
    const viewer = await incidentViewer(ctx, args.organizationId);
    const { numItems } = args.paginationOpts;
    if (!Number.isInteger(numItems) || numItems < 1 || numItems > MAX_PAGE_SIZE)
      throw workError("INVALID_INPUT", "Page size must be between 1 and 50");
    const result = await ctx.db
      .query("incidents")
      .withIndex("by_organization_and_open_and_reportedAt", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("open", args.filter === "open"),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    const visible = result.page.filter((incident) =>
      seesIncident(incident, viewer.userId, viewer.permissions),
    );
    const leads = await Promise.all(
      visible.map((incident) =>
        incident.leadId ? ctx.db.get(incident.leadId) : null,
      ),
    );
    return {
      ...result,
      page: visible.map((incident, index) => ({
        _id: incident._id,
        incidentNumber: incident.incidentNumber,
        kind: incident.kind,
        title: incident.title,
        status: incident.status,
        severity: incident.severity,
        sensitive: incident.sensitive,
        reportedAt: incident.reportedAt,
        discoveredAt: incident.discoveredAt,
        leadName: displayName(leads[index] ?? null),
      })),
    };
  },
});

const personValidator = v.object({
  userId: v.id("users"),
  name: v.optional(v.string()),
});

const detailValidator = v.object({
  _id: v.id("incidents"),
  organizationId: v.id("organizations"),
  incidentNumber: v.string(),
  kind: incidentKindValidator,
  title: v.string(),
  description: v.optional(v.string()),
  status: incidentStatusValidator,
  sensitive: v.boolean(),
  severity: v.optional(incidentSeverityValidator),
  discoveredAt: v.number(),
  occurredAt: v.optional(v.number()),
  reportedAt: v.number(),
  reportedByName: v.optional(v.string()),
  source: v.optional(
    v.object({
      kind: v.literal("alertEpisode"),
      episodeId: v.id("alertEpisodes"),
    }),
  ),
  locations: v.array(v.object({ _id: v.id("locations"), name: v.string() })),
  lead: v.optional(personValidator),
  responders: v.array(personValidator),
  triagedAt: v.optional(v.number()),
  triagedByName: v.optional(v.string()),
  triageNote: v.optional(v.string()),
  /** Null before triage; an empty list means staff chose no plan. */
  plans: v.union(
    v.null(),
    v.array(
      v.object({ recipeId: v.id("preparationRecipes"), name: v.string() }),
    ),
  ),
  afterAction: v.optional(
    v.object({
      ...incidentAfterActionValidator.fields,
      recordedByName: v.optional(v.string()),
    }),
  ),
  earlierAfterActions: v.array(incidentAfterActionValidator),
  closedAt: v.optional(v.number()),
  objects: v.array(
    v.object({
      collectionId: v.id("collections"),
      title: v.string(),
      accessionNumber: v.optional(v.string()),
      impact: incidentImpactValidator,
      note: v.optional(v.string()),
      locationAtReportId: v.optional(v.id("locations")),
      locationAtReportName: v.optional(v.string()),
      currentLocationId: v.optional(v.id("locations")),
      currentLocationName: v.optional(v.string()),
      lastHandoff: v.optional(
        v.object({
          direction: incidentHandoffDirectionValidator,
          toLocationName: v.optional(v.string()),
          movedAt: v.number(),
        }),
      ),
    }),
  ),
  handoffs: v.array(
    v.object({
      _id: v.id("incidentHandoffs"),
      collectionId: v.id("collections"),
      objectTitle: v.string(),
      direction: incidentHandoffDirectionValidator,
      fromLocationName: v.optional(v.string()),
      toLocationName: v.optional(v.string()),
      movedByName: v.optional(v.string()),
      movedAt: v.number(),
    }),
  ),
  events: v.array(
    v.object({
      ordinal: v.number(),
      action: incidentEventActionValidator,
      actorName: v.optional(v.string()),
      at: v.number(),
      note: v.optional(v.string()),
      objectTitle: v.optional(v.string()),
      fromLocationName: v.optional(v.string()),
      toLocationName: v.optional(v.string()),
      userName: v.optional(v.string()),
      value: v.optional(v.string()),
      count: v.optional(v.number()),
    }),
  ),
  viewer: v.object({
    canCoordinate: v.boolean(),
    canWork: v.boolean(),
    canMove: v.boolean(),
  }),
});

function nameCache(ctx: QueryCtx) {
  const users = new Map<Id<"users">, Promise<string | undefined>>();
  const locations = new Map<Id<"locations">, Promise<string | undefined>>();
  return {
    user(id: Id<"users"> | undefined) {
      if (!id) return Promise.resolve(undefined);
      let name = users.get(id);
      if (!name) {
        name = ctx.db.get(id).then((user) => displayName(user));
        users.set(id, name);
      }
      return name;
    },
    location(
      id: Id<"locations"> | undefined,
      organizationId: Id<"organizations">,
    ) {
      if (!id) return Promise.resolve(undefined);
      let name = locations.get(id);
      if (!name) {
        name = ctx.db
          .get(id)
          .then((location) =>
            location?.organizationId === organizationId
              ? location.name
              : undefined,
          );
        locations.set(id, name);
      }
      return name;
    },
  };
}

/**
 * The incident for its detail page; null when it does not exist or the
 * caller may not see it, so a restricted incident reads as missing.
 */
export const get = query({
  args: { incidentId: v.id("incidents") },
  returns: v.union(v.null(), detailValidator),
  handler: async (ctx, args) => {
    let visible: Awaited<ReturnType<typeof requireVisibleIncident>>;
    try {
      visible = await requireVisibleIncident(ctx, args.incidentId);
    } catch (error) {
      if (workErrorFromError(error)?.code === "INCIDENT_NOT_FOUND") return null;
      throw error;
    }
    const { incident, viewer } = visible;
    const org = incident.organizationId;
    const names = nameCache(ctx);
    const [objectRows, handoffRows, eventRows] = await Promise.all([
      incidentObjectRows(ctx, incident._id),
      ctx.db
        .query("incidentHandoffs")
        .withIndex("by_incident_and_collection", (q) =>
          q.eq("incidentId", incident._id),
        )
        .take(MAX_HANDOFFS),
      ctx.db
        .query("incidentEvents")
        .withIndex("by_incident_and_ordinal", (q) =>
          q.eq("incidentId", incident._id),
        )
        .order("desc")
        .take(EVENTS_SHOWN),
    ]);
    const objectDocs = new Map(
      (
        await Promise.all(objectRows.map((row) => ctx.db.get(row.collectionId)))
      ).flatMap((object) =>
        object && object.organizationId === org ? [[object._id, object]] : [],
      ),
    );
    const titleOf = (id: Id<"collections"> | undefined) =>
      id ? objectDocs.get(id)?.title : undefined;
    const handoffs = [...handoffRows].sort((a, b) => a.movedAt - b.movedAt);
    const lastHandoff = new Map(handoffs.map((row) => [row.collectionId, row]));

    const locations = (
      await Promise.all(
        incident.locationIds.map(async (id) => {
          const name = await names.location(id, org);
          return name ? { _id: id, name } : null;
        }),
      )
    ).flatMap((row) => (row ? [row] : []));

    return {
      _id: incident._id,
      organizationId: org,
      incidentNumber: incident.incidentNumber,
      kind: incident.kind,
      title: incident.title,
      description: incident.description,
      status: incident.status,
      sensitive: incident.sensitive,
      severity: incident.severity,
      discoveredAt: incident.discoveredAt,
      occurredAt: incident.occurredAt,
      reportedAt: incident.reportedAt,
      reportedByName: await names.user(incident.reportedBy),
      source: incident.source,
      locations,
      lead: incident.leadId
        ? { userId: incident.leadId, name: await names.user(incident.leadId) }
        : undefined,
      responders: await Promise.all(
        incident.responderIds.map(async (userId) => ({
          userId,
          name: await names.user(userId),
        })),
      ),
      triagedAt: incident.triagedAt,
      triagedByName: await names.user(incident.triagedBy),
      triageNote: incident.triageNote,
      plans: incident.triagedAt === undefined ? null : incident.plans,
      afterAction: incident.afterAction && {
        ...incident.afterAction,
        recordedByName: await names.user(incident.afterAction.recordedBy),
      },
      earlierAfterActions: incident.earlierAfterActions ?? [],
      closedAt: incident.closedAt,
      objects: await Promise.all(
        objectRows.flatMap((row) => {
          const object = objectDocs.get(row.collectionId);
          if (!object) return [];
          const handoff = lastHandoff.get(row.collectionId);
          return [
            (async () => ({
              collectionId: object._id,
              title: object.title,
              accessionNumber: object.accessionNumber,
              impact: row.impact,
              note: row.note,
              locationAtReportId: row.locationAtReportId,
              locationAtReportName: await names.location(
                row.locationAtReportId,
                org,
              ),
              currentLocationId: object.currentLocationId,
              currentLocationName: await names.location(
                object.currentLocationId,
                org,
              ),
              lastHandoff: handoff && {
                direction: handoff.direction,
                toLocationName: await names.location(handoff.toLocationId, org),
                movedAt: handoff.movedAt,
              },
            }))(),
          ];
        }),
      ),
      handoffs: await Promise.all(
        handoffs.map(async (row) => ({
          _id: row._id,
          collectionId: row.collectionId,
          objectTitle: titleOf(row.collectionId) ?? "",
          direction: row.direction,
          fromLocationName: await names.location(row.fromLocationId, org),
          toLocationName: await names.location(row.toLocationId, org),
          movedByName: await names.user(row.movedBy),
          movedAt: row.movedAt,
        })),
      ),
      events: await Promise.all(
        eventRows.map(async (row) => ({
          ordinal: row.ordinal,
          action: row.action,
          actorName: await names.user(row.actorId),
          at: row.at,
          note: row.note,
          objectTitle: titleOf(row.objectId),
          fromLocationName: await names.location(row.fromLocationId, org),
          toLocationName: await names.location(row.toLocationId, org),
          userName: await names.user(row.userId),
          value: row.value,
          count: row.count,
        })),
      ),
      viewer: {
        canCoordinate: viewer.coordinator,
        canWork: viewer.worker,
        canMove: viewer.mover,
      },
    };
  },
});

// ============================================
// PICKERS
// ============================================

/** Active incident response plans a coordinator may choose at triage. */
export const listPlanOptions = query({
  args: { organizationId: v.id("organizations") },
  returns: v.array(
    v.object({
      recipeId: v.id("preparationRecipes"),
      name: v.string(),
      steps: v.array(
        v.object({
          key: v.string(),
          title: v.string(),
          offsetHours: v.optional(v.number()),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const viewer = await incidentViewer(ctx, args.organizationId);
    requireCoordinator(viewer);
    const recipes = await ctx.db
      .query("preparationRecipes")
      .withIndex("by_organizationId_and_trigger_and_status", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("trigger", "incident_response")
          .eq("status", "active"),
      )
      .take(20);
    return recipes.map((recipe) => ({
      recipeId: recipe._id,
      name: recipe.name,
      steps: recipe.steps.map((step) => ({
        key: step.key,
        title: step.title,
        offsetHours: step.due?.offsetHours,
      })),
    }));
  },
});

const MEMBER_SCAN = 200;

/**
 * Members a coordinator may name on the incident: anyone who reads the
 * collection can be a responder; a lead must also be able to do case work.
 */
export const listTeamCandidates = query({
  args: { incidentId: v.id("incidents") },
  returns: v.array(
    v.object({
      userId: v.id("users"),
      name: v.string(),
      canLead: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const { incident, viewer } = await requireVisibleIncident(
      ctx,
      args.incidentId,
    );
    requireCoordinator(viewer);
    const memberships = await ctx.db
      .query("userOrganizations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", incident.organizationId),
      )
      .take(MEMBER_SCAN);
    const byRole = new Map<Id<"roles">, Promise<Set<string>>>();
    const candidates = await Promise.all(
      memberships.map(async (membership) => {
        let permissions = byRole.get(membership.roleId);
        if (!permissions) {
          permissions = rolePermissionNames(ctx, membership.roleId);
          byRole.set(membership.roleId, permissions);
        }
        const held = await permissions;
        if (!held.has(READ_PERMISSION)) return null;
        const user = await ctx.db.get(membership.userId);
        const name = displayName(user);
        if (!name || user?.deactivatedAt !== undefined) return null;
        return {
          userId: membership.userId,
          name,
          canLead: held.has(WORK_PERMISSION),
        };
      }),
    );
    return candidates
      .flatMap((candidate) => (candidate ? [candidate] : []))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

/** Incidents the caller may see that affect this object, newest first. */
export const listForObject = query({
  args: { collectionId: v.id("collections") },
  returns: v.array(listRowValidator),
  handler: async (ctx, args) => {
    const object = await ctx.db.get(args.collectionId);
    if (!object) return [];
    const viewer = await incidentViewer(ctx, object.organizationId);
    const rows = await ctx.db
      .query("incidentObjects")
      .withIndex("by_collection", (q) => q.eq("collectionId", object._id))
      .order("desc")
      .take(MAX_PAGE_SIZE);
    const incidents = await Promise.all(
      rows.map((row) => ctx.db.get(row.incidentId)),
    );
    const visible = incidents.flatMap((incident) =>
      incident &&
      incident.organizationId === object.organizationId &&
      seesIncident(incident, viewer.userId, viewer.permissions)
        ? [incident]
        : [],
    );
    return await Promise.all(
      visible.map(async (incident) => ({
        _id: incident._id,
        incidentNumber: incident.incidentNumber,
        kind: incident.kind,
        title: incident.title,
        status: incident.status,
        severity: incident.severity,
        sensitive: incident.sensitive,
        reportedAt: incident.reportedAt,
        discoveredAt: incident.discoveredAt,
        leadName: incident.leadId
          ? displayName(await ctx.db.get(incident.leadId))
          : undefined,
      })),
    );
  },
});
