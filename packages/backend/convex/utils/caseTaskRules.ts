import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { resolveCase } from "../auditLog";
import { CAPABILITY_MATRIX } from "./capabilities";
import type { CaseTaskCaseType, CaseTaskStatus } from "./caseTaskValidators";
import { findingLabel } from "./documentationFindings";
import type { NotificationEntityType } from "./notificationTypes";
import { requireCapability } from "./permissions";
import { workError } from "./workErrors";

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
  await ctx.runMutation(internal.audit.logAction, {
    organizationId: task.organizationId,
    userId,
    action,
    entityType: "caseTask",
    entityId: taskId,
    changes: {
      [CASE_CONFIG[task.caseType].auditKey]: task.caseId,
      caseType: task.caseType,
      title: task.title,
      ...details,
    },
  });
}

export type CaseDoc =
  | Awaited<ReturnType<typeof resolveCase>>
  | Doc<"documentationFindings">;

export function isFinding(
  entity: CaseDoc,
): entity is Doc<"documentationFindings"> {
  return "lastCheckNumber" in entity;
}

export function caseLabelOf(entity: CaseDoc): string {
  if (isFinding(entity)) return findingLabel(entity);
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

/** Resolves the case for the caller, enforcing the case's read access. */
export async function loadCase(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  caseType: CaseTaskCaseType,
  caseId: string,
): Promise<CaseDoc> {
  if (caseType === "documentationFinding")
    return await loadFindingCase(ctx, organizationId, caseId);
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
