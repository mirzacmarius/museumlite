import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireAuthenticatedUser } from "./authorizationContext";
import { capabilityUnavailableFromError } from "./capabilities";
import type { CaseTaskCaseType, CaseTaskStatus } from "./caseTaskValidators";
import { CASE_TYPES, type CaseRecord, caseReadPermissions } from "./caseTypes";
import { requireFeatureAccess } from "./featureGates";
import { seesIncident } from "./incidentAccess";
import {
  getUserPermissions,
  requireCapability,
  requirePermission,
} from "./permissions";
import { workError } from "./workErrors";

/**
 * Rules every reader and writer of case tasks shares: who may open a case
 * and the task audit trail. What each kind of case is lives in `caseTypes`.
 */

export const MAX_TASKS_PER_CASE = 100;
/** Queue sort key of an undated task, so dated work comes first. */
export const UNDATED = Number.MAX_SAFE_INTEGER;

export function displayName(user: Doc<"users"> | null) {
  return user?.name || user?.email || undefined;
}

export function isOpenStatus(status: CaseTaskStatus) {
  return status !== "done" && status !== "cancelled";
}

/**
 * The task title the organization audit log may show: a sensitive
 * incident's tasks are named by the incident number only (ADR 0015).
 */
async function auditedTitle(
  ctx: MutationCtx,
  task: Pick<Doc<"caseTasks">, "caseType" | "caseId" | "title">,
) {
  if (task.caseType !== "incident") return task.title;
  const incidentId = ctx.db.normalizeId("incidents", task.caseId);
  const incident = incidentId ? await ctx.db.get(incidentId) : null;
  return incident?.sensitive
    ? `Task on ${incident.incidentNumber}`
    : task.title;
}

export async function logTaskEvent(
  ctx: MutationCtx,
  task: Pick<
    Doc<"caseTasks">,
    "organizationId" | "caseType" | "caseId" | "title"
  >,
  taskId: Id<"caseTasks">,
  userId: Id<"users">,
  action: string,
  details: Record<string, unknown> = {},
) {
  const title = await auditedTitle(ctx, task);
  await ctx.runMutation(internal.audit.logAction, {
    organizationId: task.organizationId,
    userId,
    action,
    entityType: "caseTask",
    entityId: taskId,
    changes: {
      [`${CASE_TYPES[task.caseType].entityType}Id`]: task.caseId,
      caseType: task.caseType,
      title,
      ...details,
    },
  });
}

/**
 * Refuses callers who may not open cases of this kind: the case type's
 * Capability when it names one, otherwise its read permission, then its plan.
 */
async function requireCaseTypeAccess(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  caseType: CaseTaskCaseType,
) {
  const { capability, readPermission, feature } = CASE_TYPES[caseType];
  if (capability) {
    await requireCapability(
      ctx,
      organizationId,
      capability,
      caseReadPermissions(caseType),
    );
    return;
  }
  await requirePermission(ctx, organizationId, readPermission);
  if (feature) await requireFeatureAccess(ctx, organizationId, feature);
}

/** Whether the caller may open cases of this kind: loadCase's gate as a yes or no. */
export async function canOpenCaseType(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  caseType: CaseTaskCaseType,
) {
  try {
    await requireCaseTypeAccess(ctx, organizationId, caseType);
    return true;
  } catch (error) {
    // Members are refused with a coded failure; anything else is a fault.
    if (capabilityUnavailableFromError(error)) return false;
    throw error;
  }
}

export interface CaseViewer {
  userId: Id<"users">;
  permissions: ReadonlySet<string>;
}

/**
 * The case in this organization, or null when it is missing or hidden from
 * the viewer, as a sensitive incident is outside its scope (ADR 0015).
 * Callers check access to the case type first.
 */
export async function readVisibleCase<T extends CaseTaskCaseType>(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  caseType: T,
  caseId: string,
  viewer: CaseViewer,
): Promise<CaseRecord<T> | null> {
  const table: (typeof CASE_TYPES)[CaseTaskCaseType]["table"] =
    CASE_TYPES[caseType].table;
  const id = ctx.db.normalizeId(table, caseId);
  const doc = id ? await ctx.db.get(id) : null;
  if (!doc || doc.organizationId !== organizationId) return null;
  // The id was normalized against this case type's own table.
  const record = { caseType, doc } as CaseRecord;
  if (
    record.caseType === "incident" &&
    !seesIncident(record.doc, viewer.userId, viewer.permissions)
  )
    return null;
  return record as CaseRecord<T>;
}

/** Resolves the case for the caller, enforcing the case's read access. */
export async function loadCase<T extends CaseTaskCaseType>(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  caseType: T,
  caseId: string,
): Promise<CaseRecord<T>> {
  await requireCaseTypeAccess(ctx, organizationId, caseType);
  const [userId, permissions] = await Promise.all([
    requireAuthenticatedUser(ctx),
    getUserPermissions(ctx, organizationId),
  ]);
  const record = await readVisibleCase(ctx, organizationId, caseType, caseId, {
    userId,
    permissions: new Set(permissions),
  });
  if (!record)
    throw workError("CASE_NOT_FOUND", "Case not found in this organization");
  return record;
}
