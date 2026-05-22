import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { canApproveAtStep } from "./utils/permissions";

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
        status: v.union(
          v.literal("pending"),
          v.literal("approved"),
          v.literal("rejected"),
        ),
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
        | "conservation";
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
      slaConfigs,
      pendingAccessions,
      pendingDeaccessions,
      pendingLoans,
      pendingExhibitions,
      pendingConservation,
    ] = await Promise.all([
      getAuthUserId(ctx),
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
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const approvalChecks = await Promise.all([
      ...Array.from(pendingAccessions).map((accession) => {
        const currentStep = accession.workflowStep ?? 1;
        return canApproveAtStep(
          ctx,
          args.organizationId,
          "accession",
          currentStep,
        ).then((canApprove) => ({
          canApprove,
          type: "accession" as const,
          entity: accession,
          currentStep,
        }));
      }),
      ...Array.from(pendingDeaccessions).map((deaccession) => {
        const currentStep = deaccession.workflowStep ?? 1;
        return canApproveAtStep(
          ctx,
          args.organizationId,
          "deaccession",
          currentStep,
        ).then((canApprove) => ({
          canApprove,
          type: "deaccession" as const,
          entity: deaccession,
          currentStep,
        }));
      }),
      ...Array.from(pendingLoans).map((loan) => {
        const currentStep = loan.workflowStep ?? 1;
        return canApproveAtStep(
          ctx,
          args.organizationId,
          "loan",
          currentStep,
        ).then((canApprove) => ({
          canApprove,
          type: "loan" as const,
          entity: loan,
          currentStep,
        }));
      }),
      ...Array.from(pendingExhibitions).map((exhibition) => {
        const currentStep = exhibition.workflowStep ?? 1;
        return canApproveAtStep(
          ctx,
          args.organizationId,
          "exhibition",
          currentStep,
        ).then((canApprove) => ({
          canApprove,
          type: "exhibition" as const,
          entity: exhibition,
          currentStep,
        }));
      }),
      ...Array.from(pendingConservation).map((treatment) => {
        const currentStep = treatment.workflowStep ?? 1;
        return canApproveAtStep(
          ctx,
          args.organizationId,
          "conservation",
          currentStep,
        ).then((canApprove) => ({
          canApprove,
          type: "conservation" as const,
          entity: treatment,
          currentStep,
        }));
      }),
    ]);

    for (const check of approvalChecks) {
      if (!check.canApprove) {
        continue;
      }

      if (check.type === "accession") {
        const slaInfo = calculateSlaDue(check.entity.dateReceived, "accession");
        const age = Date.now() - check.entity.dateReceived;
        const urgency: "low" | "medium" | "high" = slaInfo.slaBreached
          ? "high"
          : age > 7 * 24 * 60 * 60 * 1000
            ? "high"
            : age > 3 * 24 * 60 * 60 * 1000
              ? "medium"
              : "low";

        pendingApprovals.push({
          _id: check.entity._id,
          type: "accession",
          title: `Accession ${check.entity.accessionNumber}`,
          subtitle: check.entity.source,
          status: "pending",
          workflowStep: check.currentStep,
          createdAt: check.entity.dateReceived,
          urgency,
          ...slaInfo,
        });
        continue;
      }

      if (check.type === "deaccession") {
        const slaInfo = calculateSlaDue(
          check.entity.dateDeaccessioned,
          "deaccession",
        );
        const age = Date.now() - check.entity.dateDeaccessioned;
        const urgency: "low" | "medium" | "high" = slaInfo.slaBreached
          ? "high"
          : age > 7 * 24 * 60 * 60 * 1000
            ? "high"
            : age > 3 * 24 * 60 * 60 * 1000
              ? "medium"
              : "low";

        pendingApprovals.push({
          _id: check.entity._id,
          type: "deaccession",
          title: `Deaccession ${check.entity.deaccessionNumber}`,
          subtitle: check.entity.reason,
          status: "pending",
          workflowStep: check.currentStep,
          createdAt: check.entity.dateDeaccessioned,
          urgency,
          ...slaInfo,
        });
        continue;
      }

      if (check.type === "loan") {
        const slaInfo = calculateSlaDue(check.entity.startDate, "loan");
        const age = Date.now() - check.entity.startDate;
        const urgency: "low" | "medium" | "high" = slaInfo.slaBreached
          ? "high"
          : age > 7 * 24 * 60 * 60 * 1000
            ? "high"
            : age > 3 * 24 * 60 * 60 * 1000
              ? "medium"
              : "low";

        pendingApprovals.push({
          _id: check.entity._id,
          type: "loan",
          title: `Loan ${check.entity.loanNumber}`,
          subtitle: `${check.entity.type === "incoming" ? "From" : "To"} ${check.entity.lenderBorrowerName}`,
          status: "pending",
          workflowStep: check.currentStep,
          createdAt: check.entity.startDate,
          urgency,
          ...slaInfo,
        });
        continue;
      }

      if (check.type === "exhibition") {
        const slaInfo = calculateSlaDue(check.entity.startDate, "exhibition");
        const age = Date.now() - check.entity.startDate;
        const urgency: "low" | "medium" | "high" = slaInfo.slaBreached
          ? "high"
          : age > 7 * 24 * 60 * 60 * 1000
            ? "high"
            : age > 3 * 24 * 60 * 60 * 1000
              ? "medium"
              : "low";

        pendingApprovals.push({
          _id: check.entity._id,
          type: "exhibition",
          title: check.entity.title,
          subtitle: check.entity.location,
          status: "proposed",
          workflowStep: check.currentStep,
          createdAt: check.entity.startDate,
          urgency,
          ...slaInfo,
        });
        continue;
      }

      const slaInfo = calculateSlaDue(check.entity.performedAt, "conservation");
      const age = Date.now() - check.entity.performedAt;
      const urgency: "low" | "medium" | "high" = slaInfo.slaBreached
        ? "high"
        : age > 7 * 24 * 60 * 60 * 1000
          ? "high"
          : age > 3 * 24 * 60 * 60 * 1000
            ? "medium"
            : "low";

      pendingApprovals.push({
        _id: check.entity._id,
        type: "conservation",
        title: check.entity.title,
        subtitle: check.entity.treatmentType,
        status: "proposed",
        workflowStep: check.currentStep,
        createdAt: check.entity.performedAt,
        urgency,
        ...slaInfo,
      });
    }

    // Sort by: SLA breached first, then urgency (high first), then age (oldest first)
    pendingApprovals.sort((a, b) => {
      if (a.slaBreached !== b.slaBreached) {
        return a.slaBreached ? -1 : 1;
      }
      const urgencyOrder = { high: 0, medium: 1, low: 2 };
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      }
      return a.createdAt - b.createdAt;
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

    return {
      pendingApprovals: pendingApprovals.slice(0, limit),
      myAssignedAccessions,
      recentlyModified,
      myCatalogedItems,
      stats: {
        totalPendingApprovals: pendingApprovals.length,
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

    const [pendingAccessions, pendingLoans, assignedAccessions] =
      await Promise.all([
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
          const currentStep = accession.workflowStep ?? 1;
          const canApprove = await canApproveAtStep(
            ctx,
            args.organizationId,
            "accession",
            currentStep,
          );

          if (!canApprove) {
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
          const currentStep = loan.workflowStep ?? 1;
          const canApprove = await canApproveAtStep(
            ctx,
            args.organizationId,
            "loan",
            currentStep,
          );

          if (!canApprove) {
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
