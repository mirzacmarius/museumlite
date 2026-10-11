import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { IncidentEventAction } from "./incidentValidators";

/** Records an incident keeps: its affected objects, log and audit entries. */

export const MAX_INCIDENT_OBJECTS = 50;

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
