import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

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
        "conditionDisputes",
        "mediaEditHistory",
        "workflowHistory",
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
  return evidence.some((record) => record !== null);
}
