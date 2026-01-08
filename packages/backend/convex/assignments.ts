import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
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
      totalCatalogedItems: v.number(),
      itemsModifiedThisWeek: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const limit = args.limit ?? 10;
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Collect pending approvals the user can act on
    const pendingApprovals: Array<{
      _id: string;
      type: "accession" | "loan" | "exhibition" | "conservation";
      title: string;
      subtitle?: string;
      status: string;
      workflowStep?: number;
      createdAt: number;
      urgency: "low" | "medium" | "high";
    }> = [];

    // Check accessions
    const pendingAccessions = await ctx.db
      .query("accessions")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "pending"),
      )
      .collect();

    for (const accession of pendingAccessions) {
      const currentStep = accession.workflowStep ?? 1;
      const canApprove = await canApproveAtStep(
        ctx,
        args.organizationId,
        "accession",
        currentStep,
      );

      if (canApprove) {
        // Calculate urgency based on age
        const age = Date.now() - accession.dateReceived;
        const urgency: "low" | "medium" | "high" =
          age > 7 * 24 * 60 * 60 * 1000
            ? "high"
            : age > 3 * 24 * 60 * 60 * 1000
              ? "medium"
              : "low";

        pendingApprovals.push({
          _id: accession._id,
          type: "accession",
          title: `Accession ${accession.accessionNumber}`,
          subtitle: accession.source,
          status: "pending",
          workflowStep: currentStep,
          createdAt: accession.dateReceived,
          urgency,
        });
      }
    }

    // Check loans
    const pendingLoans = await ctx.db
      .query("loans")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "pending"),
      )
      .collect();

    for (const loan of pendingLoans) {
      const currentStep = loan.workflowStep ?? 1;
      const canApprove = await canApproveAtStep(
        ctx,
        args.organizationId,
        "loan",
        currentStep,
      );

      if (canApprove) {
        const age = Date.now() - loan.startDate;
        const urgency: "low" | "medium" | "high" =
          age > 7 * 24 * 60 * 60 * 1000
            ? "high"
            : age > 3 * 24 * 60 * 60 * 1000
              ? "medium"
              : "low";

        pendingApprovals.push({
          _id: loan._id,
          type: "loan",
          title: `Loan ${loan.loanNumber}`,
          subtitle: `${loan.type === "incoming" ? "From" : "To"} ${loan.lenderBorrowerName}`,
          status: "pending",
          workflowStep: currentStep,
          createdAt: loan.startDate,
          urgency,
        });
      }
    }

    // Check exhibitions
    const pendingExhibitions = await ctx.db
      .query("exhibitions")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "proposed"),
      )
      .collect();

    for (const exhibition of pendingExhibitions) {
      const currentStep = exhibition.workflowStep ?? 1;
      const canApprove = await canApproveAtStep(
        ctx,
        args.organizationId,
        "exhibition",
        currentStep,
      );

      if (canApprove) {
        const age = Date.now() - exhibition.startDate;
        const urgency: "low" | "medium" | "high" =
          age > 7 * 24 * 60 * 60 * 1000
            ? "high"
            : age > 3 * 24 * 60 * 60 * 1000
              ? "medium"
              : "low";

        pendingApprovals.push({
          _id: exhibition._id,
          type: "exhibition",
          title: exhibition.title,
          subtitle: exhibition.location,
          status: "proposed",
          workflowStep: currentStep,
          createdAt: exhibition.startDate,
          urgency,
        });
      }
    }

    // Check conservation treatments
    const pendingConservation = await ctx.db
      .query("conservationTreatments")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "proposed"),
      )
      .collect();

    for (const treatment of pendingConservation) {
      const currentStep = treatment.workflowStep ?? 1;
      const canApprove = await canApproveAtStep(
        ctx,
        args.organizationId,
        "conservation",
        currentStep,
      );

      if (canApprove) {
        const age = Date.now() - treatment.performedAt;
        const urgency: "low" | "medium" | "high" =
          age > 7 * 24 * 60 * 60 * 1000
            ? "high"
            : age > 3 * 24 * 60 * 60 * 1000
              ? "medium"
              : "low";

        pendingApprovals.push({
          _id: treatment._id,
          type: "conservation",
          title: treatment.title,
          subtitle: treatment.treatmentType,
          status: "proposed",
          workflowStep: currentStep,
          createdAt: treatment.performedAt,
          urgency,
        });
      }
    }

    // Sort by urgency (high first) then by age (oldest first)
    pendingApprovals.sort((a, b) => {
      const urgencyOrder = { high: 0, medium: 1, low: 2 };
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      }
      return a.createdAt - b.createdAt;
    });

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
      recentlyModified,
      myCatalogedItems,
      stats: {
        totalPendingApprovals: pendingApprovals.length,
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
    urgentItems: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { pendingApprovals: 0, urgentItems: 0 };
    }

    let pendingCount = 0;
    let urgentCount = 0;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Count pending accessions user can approve
    const pendingAccessions = await ctx.db
      .query("accessions")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "pending"),
      )
      .collect();

    for (const accession of pendingAccessions) {
      const currentStep = accession.workflowStep ?? 1;
      const canApprove = await canApproveAtStep(
        ctx,
        args.organizationId,
        "accession",
        currentStep,
      );

      if (canApprove) {
        pendingCount++;
        if (accession.dateReceived < sevenDaysAgo) {
          urgentCount++;
        }
      }
    }

    // Count pending loans user can approve
    const pendingLoans = await ctx.db
      .query("loans")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "pending"),
      )
      .collect();

    for (const loan of pendingLoans) {
      const currentStep = loan.workflowStep ?? 1;
      const canApprove = await canApproveAtStep(
        ctx,
        args.organizationId,
        "loan",
        currentStep,
      );

      if (canApprove) {
        pendingCount++;
        if (loan.startDate < sevenDaysAgo) {
          urgentCount++;
        }
      }
    }

    return {
      pendingApprovals: pendingCount,
      urgentItems: urgentCount,
    };
  },
});
