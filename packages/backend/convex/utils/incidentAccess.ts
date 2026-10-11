import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { requireAuthenticatedUser } from "./authorizationContext";
import { memberPermissionNames } from "./memberPermissions";
import {
  getCurrentUserOrganization,
  getRolePermissionNames,
  requireCapability,
} from "./permissions";
import { workError } from "./workErrors";

/**
 * Who may see and work on an incident (ADR 0014). Collection readers see
 * ordinary incidents and may report one; a sensitive incident is visible only
 * to coordinators, its reporter, its lead and its named responders.
 */

export const READ_PERMISSION = "collections.read";
export const WORK_PERMISSION = "collections.update";
export const COORDINATE_PERMISSION = "collections.coordinate_incidents";
export const MOVE_PERMISSION = "locations.update";

type ScopeFields = Pick<
  Doc<"incidents">,
  "sensitive" | "reportedBy" | "leadId" | "responderIds"
>;

/** Named on a sensitive incident: its reporter, lead or a responder. */
export function isNamedOn(incident: ScopeFields, userId: Id<"users">) {
  return (
    incident.reportedBy === userId ||
    incident.leadId === userId ||
    incident.responderIds.includes(userId)
  );
}

/** Whether a member holding `permissions` may see this incident at all. */
export function seesIncident(
  incident: ScopeFields,
  userId: Id<"users">,
  permissions: ReadonlySet<string> | null,
) {
  if (!permissions?.has(READ_PERMISSION)) return false;
  if (!incident.sensitive) return true;
  return permissions.has(COORDINATE_PERMISSION) || isNamedOn(incident, userId);
}

export interface IncidentViewer {
  userId: Id<"users">;
  permissions: ReadonlySet<string>;
  coordinator: boolean;
  /** Holds the case work permission (tasks, evidence, impacts). */
  worker: boolean;
  /** May record evacuation and recovery movements. */
  mover: boolean;
}

/**
 * The caller as a member of the organization who can read incidents. Refuses
 * anonymous callers, non-members and members without collection access.
 */
export async function incidentViewer(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
): Promise<IncidentViewer> {
  const userId = await requireAuthenticatedUser(ctx);
  await requireCapability(ctx, organizationId, "incidents", READ_PERMISSION);
  const membership = await getCurrentUserOrganization(ctx, organizationId);
  const permissions = new Set(
    membership ? await getRolePermissionNames(ctx, membership.roleId) : [],
  );
  const worker = permissions.has(WORK_PERMISSION);
  return {
    userId,
    permissions,
    worker,
    coordinator: worker && permissions.has(COORDINATE_PERMISSION),
    mover: worker && permissions.has(MOVE_PERMISSION),
  };
}

export function incidentNotFound() {
  return workError("INCIDENT_NOT_FOUND", "Incident not found");
}

/**
 * Loads an incident the caller may see. Missing, foreign and out-of-scope
 * incidents all read as not found, so nothing about them is disclosed.
 */
export async function requireVisibleIncident(
  ctx: QueryCtx,
  incidentId: Id<"incidents">,
) {
  const incident = await ctx.db.get(incidentId);
  if (!incident) {
    await requireAuthenticatedUser(ctx);
    throw incidentNotFound();
  }
  const membership = await getCurrentUserOrganization(
    ctx,
    incident.organizationId,
  );
  if (!membership) {
    await requireAuthenticatedUser(ctx);
    throw incidentNotFound();
  }
  const viewer = await incidentViewer(ctx, incident.organizationId);
  if (!seesIncident(incident, viewer.userId, viewer.permissions))
    throw incidentNotFound();
  return { incident, viewer };
}

export function requireCoordinator(viewer: IncidentViewer) {
  if (!viewer.coordinator)
    throw workError(
      "NOT_INCIDENT_COORDINATOR",
      "Only incident coordinators can do this",
    );
}

export function requireWorker(viewer: IncidentViewer) {
  if (!viewer.worker)
    throw workError(
      "NOT_INCIDENT_RESPONDER",
      "You need collection edit access to respond to incidents",
    );
}

export function requireMover(viewer: IncidentViewer) {
  if (!viewer.mover)
    throw workError(
      "NOT_INCIDENT_RESPONDER",
      "You need permission to move objects to evacuate or recover them",
    );
}

export function requireOpen(incident: Doc<"incidents">) {
  if (!incident.open)
    throw workError("STATUS_CHANGED", "This incident is closed");
}

/**
 * Whether another member may be given work on the incident: they can work on
 * collection cases and, when it is sensitive, they are in its scope.
 */
export async function memberCanWorkOn(
  ctx: QueryCtx,
  incident: ScopeFields & { organizationId: Id<"organizations"> },
  userId: Id<"users">,
) {
  const permissions = await memberPermissionNames(
    ctx,
    incident.organizationId,
    userId,
  );
  return (
    !!permissions &&
    permissions.has(WORK_PERMISSION) &&
    seesIncident(incident, userId, permissions)
  );
}
