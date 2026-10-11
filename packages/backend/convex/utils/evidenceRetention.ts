import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

const organizationDeletionAuditActions = new Set([
  "scheduled_organization_deletion",
  "requested_organization_deletion_approval",
  "cancelled_organization_deletion",
  "transferred_organization_ownership",
  "sent_organization_deletion_final_notice",
  "completed_organization_deletion",
  "confirmed_organization_plan",
]);

/** Permanent museum records have no supported destruction operation. */
export function rejectPermanentEvidenceDeletion(): never {
  throw new ConvexError(
    "Permanent evidence cannot be deleted. Withdraw the object from the catalog to archive it; retained records and originals remain available for review and restore.",
  );
}

export async function assertMuseumEvidenceDeletionAllowed(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
) {
  if (await isOrganizationEvidenceProtected(ctx, organizationId)) {
    rejectPermanentEvidenceDeletion();
  }
}

export async function isOrganizationEvidenceProtected(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
) {
  const organization = await ctx.db.get(organizationId);
  if (!organization || organization.type !== "library") return true;
  const evidence = await Promise.all(
    (
      [
        "collections",
        "accessions",
        "deaccessions",
        "mediaFiles",
        "mediaVersions",
        "appraisals",
        "conservationTreatments",
        "conservationAttachments",
        "loans",
        "exhibitions",
        "exhibitionObjects",
        "transitRecords",
        "installationTasks",
        "insurancePolicies",
        "insuranceClaims",
        "conditionDisputes",
        "mediaEditHistory",
        "accountDocuments",
        "objectComments",
        "workflowHistory",
        "caseHistoryState",
        "caseHistoryEntries",
        "workflowStepApprovals",
      ] as const
    ).map((table) =>
      ctx.db
        .query(table)
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId),
        )
        .first(),
    ),
  );
  if (evidence.some((record) => record !== null)) return true;
  const incident = await ctx.db
    .query("incidents")
    .withIndex("by_organization_and_open_and_reportedAt", (q) =>
      q.eq("organizationId", organizationId),
    )
    .first();
  if (incident) return true;

  const auditEntries = await ctx.db
    .query("auditLog")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .take(101);
  if (auditEntries.length > 100) return true;

  for (const entry of auditEntries) {
    if (
      entry.entityType !== "organization" ||
      !organizationDeletionAuditActions.has(entry.action)
    ) {
      return true;
    }
    if (entry.entityId === organizationId) continue;

    const deletionId = ctx.db.normalizeId(
      "organizationDeletions",
      entry.entityId,
    );
    const deletion = deletionId ? await ctx.db.get(deletionId) : null;
    if (deletion?.organizationId !== organizationId) return true;
  }

  return false;
}
