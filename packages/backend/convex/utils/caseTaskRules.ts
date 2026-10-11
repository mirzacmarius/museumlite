import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { resolveCase } from "../auditLog";
import { CAPABILITY_MATRIX } from "./capabilities";
import type { CaseTaskCaseType, CaseTaskStatus } from "./caseTaskValidators";
import { findingLabel } from "./documentationFindings";
import { requireVisibleIncident } from "./incidentAccess";
import type { NotificationEntityType } from "./notificationTypes";
import { requireCapability } from "./permissions";
import { workError, workErrorFromError } from "./workErrors";

function workErrorCode(error: unknown) {
  return workErrorFromError(error)?.code;
}

/**
 * Rules every writer of case tasks shares: the case kinds' permissions and
 * notification links, owner eligibility and the task audit trail.
 */

export const MAX_TASKS_PER_CASE = 100;
/** Queue sort key of an undated task, so dated work comes first. */
export const UNDATED = Number.MAX_SAFE_INTEGER;

type CaseReadPermission = "loans.read" | "collections.read";
type CaseWorkPermission = "loans.update" | "collections.update";

export interface CaseConfig {
  readPermission: CaseReadPermission;
  workPermission: CaseWorkPermission;
  feature?: "loans" | "exhibitions" | "conservation";
  /** Key that files task audit events under the case (see auditEvidence). */
  auditKey: string;
  /** Entity type used by notification links to open the case. */
  notificationEntityType: NotificationEntityType;
}

export const CASE_CONFIG: Record<CaseTaskCaseType, CaseConfig> = {
  loan: {
    readPermission: "loans.read",
    workPermission: "loans.update",
    feature: "loans",
    auditKey: "loanId",
    notificationEntityType: "loan",
  },
  accession: {
    readPermission: "collections.read",
    workPermission: "collections.update",
    auditKey: "accessionId",
    notificationEntityType: "accession",
  },
  deaccession: {
    readPermission: "collections.read",
    workPermission: "collections.update",
    auditKey: "deaccessionId",
    notificationEntityType: "deaccession",
  },
  exhibition: {
    readPermission: "collections.read",
    workPermission: "collections.update",
    feature: "exhibitions",
    auditKey: "exhibitionId",
    notificationEntityType: "exhibition",
  },
  conservation: {
    readPermission: "collections.read",
    workPermission: "collections.update",
    feature: "conservation",
    auditKey: "conservationTreatmentId",
    notificationEntityType: "conservationTreatment",
  },
  documentationFinding: {
    readPermission: "collections.read",
    workPermission: "collections.update",
    auditKey: "documentationFindingId",
    notificationEntityType: "documentationFinding",
  },
  incident: {
    readPermission: "collections.read",
    workPermission: "collections.update",
    auditKey: "incidentId",
    notificationEntityType: "incident",
  },
};

/** Owners and reviewers need both the read and the work permission of the case kind. */
export function canWorkWith(
  permissions: Set<string> | null,
  caseType: CaseTaskCaseType,
) {
  const config = CASE_CONFIG[caseType];
  return (
    !!permissions &&
    permissions.has(config.readPermission) &&
    permissions.has(config.workPermission)
  );
}

export function displayName(user: Doc<"users"> | null) {
  return user?.name || user?.email || undefined;
}

export function isOpenStatus(status: CaseTaskStatus) {
  return status !== "done" && status !== "cancelled";
}

/**
 * The task title the organization audit log may show: a sensitive
 * incident's tasks are named by the incident number only (ADR 0014).
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
      [CASE_CONFIG[task.caseType].auditKey]: task.caseId,
      caseType: task.caseType,
      title,
      ...details,
    },
  });
}

export type CaseDoc =
  | Awaited<ReturnType<typeof resolveCase>>
  | Doc<"documentationFindings">
  | Doc<"incidents">;

export function isFinding(
  entity: CaseDoc,
): entity is Doc<"documentationFindings"> {
  return "lastCheckNumber" in entity;
}

export function isIncident(entity: CaseDoc): entity is Doc<"incidents"> {
  return "incidentNumber" in entity;
}

export function caseLabelOf(entity: CaseDoc): string {
  if (isFinding(entity)) return findingLabel(entity);
  if (isIncident(entity)) return entity.incidentNumber;
  if ("loanNumber" in entity) return entity.loanNumber;
  if ("deaccessionNumber" in entity) return entity.deaccessionNumber;
  if ("accessionNumber" in entity) return entity.accessionNumber;
  return entity.title;
}

/**
 * A documentation quality finding, for members with the documentation
 * quality capability.
 */
async function loadFindingCase(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  caseId: string,
) {
  await requireCapability(
    ctx,
    organizationId,
    "documentation_quality",
    CAPABILITY_MATRIX.documentation_quality.permissions,
  );
  const findingId = ctx.db.normalizeId("documentationFindings", caseId);
  const finding = findingId ? await ctx.db.get(findingId) : null;
  if (!finding || finding.organizationId !== organizationId)
    throw workError("CASE_NOT_FOUND", "Case not found in this organization");
  return finding;
}

/** An incident the caller may see; sensitive ones only within their scope. */
async function loadIncidentCase(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  caseId: string,
) {
  const incidentId = ctx.db.normalizeId("incidents", caseId);
  const caseMissing = () =>
    workError("CASE_NOT_FOUND", "Case not found in this organization");
  if (!incidentId) throw caseMissing();
  const visible = await requireVisibleIncident(ctx, incidentId).catch(
    (error: unknown) => {
      if (workErrorCode(error) === "INCIDENT_NOT_FOUND") throw caseMissing();
      throw error;
    },
  );
  if (visible.incident.organizationId !== organizationId) throw caseMissing();
  return visible.incident;
}

/** Resolves the case for the caller, enforcing the case's read access. */
export async function loadCase(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  caseType: CaseTaskCaseType,
  caseId: string,
): Promise<CaseDoc> {
  if (caseType === "documentationFinding")
    return await loadFindingCase(ctx, organizationId, caseId);
  if (caseType === "incident")
    return await loadIncidentCase(ctx, organizationId, caseId);
  try {
    return await resolveCase(ctx, {
      organizationId,
      caseType,
      entityId: caseId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Case not found")
      throw workError("CASE_NOT_FOUND", "Case not found in this organization");
    throw error;
  }
}
