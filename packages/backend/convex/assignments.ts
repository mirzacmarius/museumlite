import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";
import {
  accessionStatusValidator,
  isAwaitingReview,
} from "./utils/accessionReview";
import { type CapabilityId, evaluateCapability } from "./utils/capabilities";
import { organizationAccess } from "./utils/featureGates";
import {
  PENDING_IMAGE_DELETION_LIMIT,
  resolveImageDeletionApproval,
} from "./utils/imageDeletion";
import {
  type ApprovalCaseType,
  getCurrentUserOrganization,
  getRolePermissionNames,
  hasPermission,
  resolveCaseApproval,
} from "./utils/permissions";

type ApprovalPageAccess = { permission: string } | { capability: CapabilityId };

const APPROVAL_PAGE_ACCESS: Record<ApprovalCaseType, ApprovalPageAccess> = {
  accession: { permission: "collections.read" },
  deaccession: { capability: "deaccession" },
  loan: { capability: "loans" },
  exhibition: { capability: "exhibitions" },
  conservation: { capability: "conservation" },
};

async function loadCanActOnApproval(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
) {
  const [membership, organization] = await Promise.all([
    getCurrentUserOrganization(ctx, organizationId),
    ctx.db.get(organizationId),
  ]);
  const permissions = membership
    ? await getRolePermissionNames(ctx, membership.roleId)
    : [];
  const canOpenPage = (caseType: ApprovalCaseType) => {
    const page = APPROVAL_PAGE_ACCESS[caseType];
    if ("permission" in page) return permissions.includes(page.permission);
    return (
      organization !== null &&
      evaluateCapability(
        page.capability,
        organizationAccess(organization),
        permissions,
      ).status === "available"
    );
  };
  const decisions = new Map<string, Promise<boolean>>();
  return (caseType: ApprovalCaseType, workflowStep: number | undefined) => {
    const key = `${caseType}:${workflowStep}`;
    let decision = decisions.get(key);
    if (!decision) {
      decision = canOpenPage(caseType)
        ? resolveCaseApproval(ctx, organizationId, caseType, workflowStep).then(
            (approval) => approval.allowed,
          )
        : Promise.resolve(false);
      decisions.set(key, decision);
    }
    return decision;
  };
}

/**
 * Image deletions waiting for approval, when the viewer may decide them and
 * open the page that lists them.
 */
async function loadPendingImageDeletions(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
) {
  const [canOpenPage, approval] = await Promise.all([
    hasPermission(ctx, organizationId, "media.read"),
    resolveImageDeletionApproval(ctx, organizationId),
  ]);
  if (!canOpenPage || !approval.allowed) return [];
  const requests = await ctx.db
    .query("mediaDeletionRequests")
    .withIndex("by_organization_and_status_and_requestedAt", (q) =>
      q.eq("organizationId", organizationId).eq("status", "pending"),
    )
    .take(PENDING_IMAGE_DELETION_LIMIT);
  return await Promise.all(
    requests.map(async (request) => ({
      ...request,
      objectTitle: (await ctx.db.get(request.collectionId))?.title,
    })),
  );
}

/**
 * Get user's assignments across the organization
 * Includes: pending workflow items, recently cataloged objects, items needing attention
 */
export const listMyAssignments = query({
  args: {
    organizationId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    pendingApprovals: v.array(
      v.object({
        _id: v.string(),
        type: v.union(
          v.literal("accession"),
          v.literal("deaccession"),
          v.literal("loan"),
          v.literal("exhibition"),
          v.literal("conservation"),
          v.literal("imageDeletion"),
        ),
        title: v.string(),
        subtitle: v.optional(v.string()),
        status: v.string(),
        workflowStep: v.optional(v.number()),
        createdAt: v.number(),
        urgency: v.union(
          v.literal("low"),
          v.literal("medium"),
          v.literal("high"),
        ),
        slaDueAt: v.optional(v.number()),
        slaBreached: v.optional(v.boolean()),
      }),
    ),
    myAssignedAccessions: v.array(
      v.object({
        _id: v.id("accessions"),
        accessionNumber: v.string(),
        source: v.string(),
        status: accessionStatusValidator,
        workflowStep: v.optional(v.number()),
        dateReceived: v.number(),
      }),
    ),
    recentlyModified: v.array(
      v.object({
        _id: v.id("collections"),
        title: v.string(),
        accessionNumber: v.string(),
        lastModifiedAt: v.number(),
        thumbnailUrl: v.optional(v.string()),
      }),
    ),
    myCatalogedItems: v.array(
      v.object({
        _id: v.id("collections"),
        title: v.string(),
        accessionNumber: v.string(),
        catalogedAt: v.number(),
        thumbnailUrl: v.optional(v.string()),
        status: v.union(
          v.literal("active"),
          v.literal("loaned"),
          v.literal("deaccessioned"),
          v.literal("archived"),
          v.literal("deleted"),
        ),
      }),
    ),
    stats: v.object({
      totalPendingApprovals: v.number(),
      pendingApprovalsByType: v.object({
        accession: v.number(),
        deaccession: v.number(),
        loan: v.number(),
        exhibition: v.number(),
        conservation: v.number(),
        imageDeletion: v.number(),
      }),
      totalAssignedAccessions: v.number(),
      totalCatalogedItems: v.number(),
      itemsModifiedThisWeek: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Collect pending approvals the user can act on
    const pendingApprovals: Array<{
      _id: string;
      type:
        | "accession"
        | "deaccession"
        | "loan"
        | "exhibition"
        | "conservation"
        | "imageDeletion";
      title: string;
      subtitle?: string;
      status: string;
      workflowStep?: number;
      createdAt: number;
      urgency: "low" | "medium" | "high";
      slaDueAt?: number;
      slaBreached?: boolean;
    }> = [];

    const getSlaConfig = (workflowType: string) =>
      slaConfigs.find((c) => c.workflowType === workflowType);

    const calculateSlaDue = (
      createdAt: number,
      workflowType: string,
    ): { slaDueAt?: number; slaBreached?: boolean } => {
      const config = getSlaConfig(workflowType);
      if (!config?.slaDays) return {};
      const slaDueAt = createdAt + config.slaDays * 24 * 60 * 60 * 1000;
      return { slaDueAt, slaBreached: Date.now() > slaDueAt };
    };

    const [
      userId,
      canActOn,
      slaConfigs,
      pendingAccessions,
      pendingDeaccessions,
      pendingLoans,
      pendingExhibitions,
      pendingConservation,
      pendingImageDeletions,
    ] = await Promise.all([
      getAuthUserId(ctx),
      loadCanActOnApproval(ctx, args.organizationId),
      ctx.db
        .query("workflowSlaConfigs")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect(),
      ctx.db
        .query("accessions")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", args.organizationId).eq("status", "pending"),
        )
        .collect(),
      ctx.db
        .query("deaccessions")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", args.organizationId).eq("status", "pending"),
        )
        .collect(),
      ctx.db
        .query("loans")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", args.organizationId).eq("status", "pending"),
        )
        .collect(),
      ctx.db
        .query("exhibitions")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", args.organizationId).eq("status", "proposed"),
        )
        .collect(),
      ctx.db
        .query("conservationTreatments")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", args.organizationId).eq("status", "proposed"),
        )
        .collect(),
      loadPendingImageDeletions(ctx, args.organizationId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const approvalChecks = await Promise.all([
      ...pendingAccessions.flatMap((accession) => {
        if (!isAwaitingReview(accession)) return [];
        const currentStep = accession.workflowStep ?? 1;
        return canActOn("accession", accession.workflowStep).then(
          (canApprove) => ({
            canApprove,
            type: "accession" as const,
            entity: accession,
            currentStep,
          }),
        );
      }),
      ...pendingDeaccessions.map((deaccession) => {
        const currentStep = deaccession.workflowStep ?? 1;
        return canActOn("deaccession", deaccession.workflowStep).then(
          (canApprove) => ({
            canApprove,
            type: "deaccession" as const,
            entity: deaccession,
            currentStep,
          }),
        );
      }),
      ...pendingLoans.map((loan) => {
        const currentStep = loan.workflowStep ?? 1;
        return canActOn("loan", loan.workflowStep).then((canApprove) => ({
          canApprove,
          type: "loan" as const,
          entity: loan,
          currentStep,
        }));
      }),
      ...pendingExhibitions.map((exhibition) => {
        const currentStep = exhibition.workflowStep ?? 1;
        return canActOn("exhibition", exhibition.workflowStep).then(
          (canApprove) => ({
            canApprove,
            type: "exhibition" as const,
            entity: exhibition,
            currentStep,
          }),
        );
      }),
      ...pendingConservation.map((treatment) => {
        const currentStep = treatment.workflowStep ?? 1;
        return canActOn("conservation", treatment.workflowStep).then(
          (canApprove) => ({
            canApprove,
            type: "conservation" as const,
            entity: treatment,
            currentStep,
          }),
        );
      }),
    ]);

    for (const check of approvalChecks) {
      if (!check.canApprove) {
        continue;
      }

      if (check.type === "accession") {
        const entity = check.entity;
        const dateReceived = entity.dateReceived;
        const slaInfo = calculateSlaDue(dateReceived, "accession");
        const age = Date.now() - dateReceived;
        const urgency: "low" | "medium" | "high" = slaInfo.slaBreached
          ? "high"
          : age > 7 * 24 * 60 * 60 * 1000
            ? "high"
            : age > 3 * 24 * 60 * 60 * 1000
              ? "medium"
              : "low";

        pendingApprovals.push({
          _id: entity._id,
          type: "accession",
          title: `Accession ${entity.accessionNumber}`,
          subtitle: entity.source,
          status: "pending",
          workflowStep: check.currentStep,
          createdAt: dateReceived,
          urgency,
          ...slaInfo,
        });
        continue;
      }

      if (check.type === "deaccession") {
        const entity = check.entity;
        const dateDeaccessioned = entity.dateDeaccessioned;
        const slaInfo = calculateSlaDue(dateDeaccessioned, "deaccession");
        const age = Date.now() - dateDeaccessioned;
        const urgency: "low" | "medium" | "high" = slaInfo.slaBreached
          ? "high"
          : age > 7 * 24 * 60 * 60 * 1000
            ? "high"
            : age > 3 * 24 * 60 * 60 * 1000
              ? "medium"
              : "low";

        pendingApprovals.push({
          _id: entity._id,
          type: "deaccession",
          title: `Deaccession ${entity.deaccessionNumber}`,
          subtitle: entity.reason,
          status: "pending",
          workflowStep: check.currentStep,
          createdAt: dateDeaccessioned,
          urgency,
          ...slaInfo,
        });
        continue;
      }

      if (check.type === "loan") {
        const entity = check.entity;
        const startDate = entity.startDate;
        const slaInfo = calculateSlaDue(startDate, "loan");
        const age = Date.now() - startDate;
        const urgency: "low" | "medium" | "high" = slaInfo.slaBreached
          ? "high"
          : age > 7 * 24 * 60 * 60 * 1000
            ? "high"
            : age > 3 * 24 * 60 * 60 * 1000
              ? "medium"
              : "low";

        pendingApprovals.push({
          _id: entity._id,
          type: "loan",
          title: `Loan ${entity.loanNumber}`,
          subtitle: `${entity.type === "incoming" ? "From" : "To"} ${entity.lenderBorrowerName}`,
          status: "pending",
          workflowStep: check.currentStep,
          createdAt: startDate,
          urgency,
          ...slaInfo,
        });
        continue;
      }

      if (check.type === "exhibition") {
        const entity = check.entity;
        const startDate = entity.startDate;
        const slaInfo = calculateSlaDue(startDate, "exhibition");
        const age = Date.now() - startDate;
        const urgency: "low" | "medium" | "high" = slaInfo.slaBreached
          ? "high"
          : age > 7 * 24 * 60 * 60 * 1000
            ? "high"
            : age > 3 * 24 * 60 * 60 * 1000
              ? "medium"
              : "low";

        pendingApprovals.push({
          _id: entity._id,
          type: "exhibition",
          title: entity.title,
          subtitle: entity.location,
          status: "proposed",
          workflowStep: check.currentStep,
          createdAt: startDate,
          urgency,
          ...slaInfo,
        });
        continue;
      }

      const entity = check.entity;
      const performedAt = entity.performedAt;
      const slaInfo = calculateSlaDue(performedAt, "conservation");
      const age = Date.now() - performedAt;
      const urgency: "low" | "medium" | "high" = slaInfo.slaBreached
        ? "high"
        : age > 7 * 24 * 60 * 60 * 1000
          ? "high"
          : age > 3 * 24 * 60 * 60 * 1000
            ? "medium"
            : "low";

      pendingApprovals.push({
        _id: entity._id,
        type: "conservation",
        title: entity.title,
        subtitle: entity.treatmentType,
        status: "proposed",
        workflowStep: check.currentStep,
        createdAt: performedAt,
        urgency,
        ...slaInfo,
      });
    }

    for (const request of pendingImageDeletions) {
      const age = Date.now() - request.requestedAt;
      pendingApprovals.push({
        _id: request._id,
        type: "imageDeletion",
        title: request.fileName,
        subtitle: request.objectTitle,
        status: "pending",
        createdAt: request.requestedAt,
        urgency:
          age > 7 * 24 * 60 * 60 * 1000
            ? "high"
            : age > 3 * 24 * 60 * 60 * 1000
              ? "medium"
              : "low",
      });
    }

    // Sort by: SLA breached first, then urgency (high first), then age (oldest first)
    // Kinds without an SLA leave slaBreached unset, which counts as not breached.
    pendingApprovals.sort((a, b) => {
      if (Boolean(a.slaBreached) !== Boolean(b.slaBreached)) {
        return a.slaBreached ? -1 : 1;
      }
      const urgencyOrder = { high: 0, medium: 1, low: 2 };
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      }
      return a.createdAt - b.createdAt || a._id.localeCompare(b._id);
    });

    // Get accessions directly assigned to the user
    const assignedAccessions = await ctx.db
      .query("accessions")
      .withIndex("by_assigned_to", (q) => q.eq("assignedTo", userId))
      .collect();

    const myAssignedAccessions = assignedAccessions
      .filter(
        (a) =>
          a.organizationId === args.organizationId && a.status === "pending",
      )
      .slice(0, limit)
      .map((a) => ({
        _id: a._id,
        accessionNumber: a.accessionNumber,
        source: a.source,
        status: a.status,
        workflowStep: a.workflowStep,
        dateReceived: a.dateReceived,
      }));

    // Get items recently modified by the user
    const allCollections = await ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const recentlyModifiedByUser = allCollections
      .filter(
        (c) =>
          c.lastModifiedBy === userId &&
          c.lastModifiedAt &&
          c.lastModifiedAt > oneWeekAgo,
      )
      .sort((a, b) => (b.lastModifiedAt ?? 0) - (a.lastModifiedAt ?? 0))
      .slice(0, limit);

    // Get thumbnails for recently modified
    const recentlyModified = await Promise.all(
      recentlyModifiedByUser.map(async (c) => {
        const primaryMedia = await ctx.db
          .query("mediaFiles")
          .withIndex("by_collection", (q) => q.eq("collectionId", c._id))
          .filter((q) => q.eq(q.field("isPrimary"), true))
          .first();

        let thumbnailUrl: string | undefined;
        if (primaryMedia?.storageId) {
          const url = await ctx.storage.getUrl(primaryMedia.storageId);
          thumbnailUrl = url ?? undefined;
        }

        return {
          _id: c._id,
          title: c.title,
          accessionNumber: c.accessionNumber,
          lastModifiedAt: c.lastModifiedAt!,
          thumbnailUrl,
        };
      }),
    );

    // Get items cataloged by the user
    const myCatalogedCollections = allCollections
      .filter((c) => c.catalogedBy === userId)
      .sort((a, b) => b.catalogedAt - a.catalogedAt)
      .slice(0, limit);

    const myCatalogedItems = await Promise.all(
      myCatalogedCollections.map(async (c) => {
        const primaryMedia = await ctx.db
          .query("mediaFiles")
          .withIndex("by_collection", (q) => q.eq("collectionId", c._id))
          .filter((q) => q.eq(q.field("isPrimary"), true))
          .first();

        let thumbnailUrl: string | undefined;
        if (primaryMedia?.storageId) {
          const url = await ctx.storage.getUrl(primaryMedia.storageId);
          thumbnailUrl = url ?? undefined;
        }

        return {
          _id: c._id,
          title: c.title,
          accessionNumber: c.accessionNumber,
          catalogedAt: c.catalogedAt,
          thumbnailUrl,
          status: c.status,
        };
      }),
    );

    // Calculate stats
    const itemsModifiedThisWeek = allCollections.filter(
      (c) =>
        c.lastModifiedBy === userId &&
        c.lastModifiedAt &&
        c.lastModifiedAt > oneWeekAgo,
    ).length;

    const totalCatalogedItems = allCollections.filter(
      (c) => c.catalogedBy === userId,
    ).length;

    const pendingApprovalsByType = {
      accession: 0,
      deaccession: 0,
      loan: 0,
      exhibition: 0,
      conservation: 0,
      imageDeletion: 0,
    } satisfies Record<(typeof pendingApprovals)[number]["type"], number>;
    for (const approval of pendingApprovals) {
      pendingApprovalsByType[approval.type] += 1;
    }

    return {
      pendingApprovals: pendingApprovals.slice(0, limit),
      myAssignedAccessions,
      recentlyModified,
      myCatalogedItems,
      stats: {
        totalPendingApprovals: pendingApprovals.length,
        pendingApprovalsByType,
        totalAssignedAccessions: myAssignedAccessions.length,
        totalCatalogedItems,
        itemsModifiedThisWeek,
      },
    };
  },
});

/**
 * Get summary counts for assignments badge
 */
export const getAssignmentCounts = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    pendingApprovals: v.number(),
    assignedAccessions: v.number(),
    urgentItems: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { pendingApprovals: 0, assignedAccessions: 0, urgentItems: 0 };
    }

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const [canActOn, pendingAccessions, pendingLoans, assignedAccessions] =
      await Promise.all([
        loadCanActOnApproval(ctx, args.organizationId),
        ctx.db
          .query("accessions")
          .withIndex("by_organization_and_status", (q) =>
            q.eq("organizationId", args.organizationId).eq("status", "pending"),
          )
          .collect(),
        ctx.db
          .query("loans")
          .withIndex("by_organization_and_status", (q) =>
            q.eq("organizationId", args.organizationId).eq("status", "pending"),
          )
          .collect(),
        ctx.db
          .query("accessions")
          .withIndex("by_assigned_to", (q) => q.eq("assignedTo", userId))
          .collect(),
      ] as const);

    const [accessionCounts, loanCounts] = await Promise.all([
      Promise.all(
        pendingAccessions.map(async (accession) => {
          if (
            !isAwaitingReview(accession) ||
            !(await canActOn("accession", accession.workflowStep))
          ) {
            return { pending: 0, urgent: 0 };
          }

          return {
            pending: 1,
            urgent: accession.dateReceived < sevenDaysAgo ? 1 : 0,
          };
        }),
      ),
      Promise.all(
        pendingLoans.map(async (loan) => {
          if (!(await canActOn("loan", loan.workflowStep))) {
            return { pending: 0, urgent: 0 };
          }

          return {
            pending: 1,
            urgent: loan.startDate < sevenDaysAgo ? 1 : 0,
          };
        }),
      ),
    ]);

    const pendingCount =
      accessionCounts.reduce((sum, count) => sum + count.pending, 0) +
      loanCounts.reduce((sum, count) => sum + count.pending, 0);
    const urgentCount =
      accessionCounts.reduce((sum, count) => sum + count.urgent, 0) +
      loanCounts.reduce((sum, count) => sum + count.urgent, 0);

    const assignedCount = assignedAccessions.filter(
      (a) => a.organizationId === args.organizationId && a.status === "pending",
    ).length;

    return {
      pendingApprovals: pendingCount,
      assignedAccessions: assignedCount,
      urgentItems: urgentCount,
    };
  },
});
