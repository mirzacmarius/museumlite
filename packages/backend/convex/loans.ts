import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requirePermission } from "./utils/permissions";

/**
 * Generate loan number
 */
async function generateLoanNumber(
  ctx: any,
  organizationId: Id<"organizations">,
  type: "incoming" | "outgoing",
): Promise<string> {
  const org = await ctx.db.get(organizationId);
  if (!org) {
    throw new Error("Organization not found");
  }

  const year = new Date().getFullYear();
  const orgSlug = org.slug.toUpperCase().substring(0, 3);
  const prefix = type === "incoming" ? "IN" : "OUT";

  // Count existing loans this year
  const existing = await ctx.db
    .query("loans")
    .withIndex("by_organization_and_type", (q) =>
      q.eq("organizationId", organizationId).eq("type", type),
    )
    .filter((q) =>
      q.eq(
        q.field("loanNumber"),
        `${prefix}-${orgSlug}-${year}-001`,
      ),
    )
    .collect();

  const sequence = String(existing.length + 1).padStart(3, "0");
  return `${prefix}-${orgSlug}-${year}-${sequence}`;
}

/**
 * Create loan record
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    loanNumber: v.optional(v.string()),
    type: v.union(v.literal("incoming"), v.literal("outgoing")),
    lenderBorrowerName: v.string(),
    lenderBorrowerContact: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    terms: v.optional(v.string()),
    insuranceValue: v.optional(v.number()),
    notes: v.optional(v.string()),
    useDetailedConditionReports: v.optional(v.boolean()),
  },
  returns: v.id("loans"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check permission
    await requirePermission(ctx, args.organizationId, "loans.create");

    // Generate or use provided loan number
    let loanNumber: string;
    if (args.loanNumber) {
      loanNumber = args.loanNumber;
    } else {
      loanNumber = await generateLoanNumber(
        ctx,
        args.organizationId,
        args.type,
      );
    }

    const loanId = await ctx.db.insert("loans", {
      organizationId: args.organizationId,
      loanNumber,
      type: args.type,
      lenderBorrowerName: args.lenderBorrowerName,
      lenderBorrowerContact: args.lenderBorrowerContact,
      startDate: args.startDate,
      endDate: args.endDate,
      status: "pending",
      terms: args.terms,
      insuranceValue: args.insuranceValue,
      notes: args.notes,
      useDetailedConditionReports: args.useDetailedConditionReports ?? false,
    });

    return loanId;
  },
});

/**
 * Add items to loan
 */
export const addItems = mutation({
  args: {
    loanId: v.id("loans"),
    collectionIds: v.array(v.id("collections")),
    conditionOut: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    // Check permission
    await requirePermission(ctx, loan.organizationId, "loans.update");

    if (loan.status !== "pending" && loan.status !== "active") {
      throw new Error("Can only add items to pending or active loans");
    }

    // Verify collections belong to organization and are active
    for (const collectionId of args.collectionIds) {
      const collection = await ctx.db.get(collectionId);
      if (!collection) {
        throw new Error(`Collection ${collectionId} not found`);
      }

      if (collection.organizationId !== loan.organizationId) {
        throw new Error(
          `Collection ${collectionId} does not belong to organization`,
        );
      }

      if (collection.status !== "active") {
        throw new Error(`Collection ${collectionId} is not active`);
      }

      // Check if already in a loan
      const existingLoanItem = await ctx.db
        .query("loanItems")
        .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
        .filter((q) => {
          // Check if collection is in an active loan
          const loanId = q.field("loanId");
          return loanId;
        })
        .first();

      if (existingLoanItem) {
        const existingLoan = await ctx.db.get(existingLoanItem.loanId);
        if (
          existingLoan &&
          (existingLoan.status === "pending" ||
            existingLoan.status === "active")
        ) {
          throw new Error(
            `Collection ${collectionId} is already in an active loan`,
          );
        }
      }

      // Create loan item
      await ctx.db.insert("loanItems", {
        loanId: args.loanId,
        collectionId,
        conditionOut: args.conditionOut,
      });

      // Update collection status to loaned
      await ctx.db.patch(collectionId, {
        status: "loaned",
        lastModifiedBy: userId,
        lastModifiedAt: Date.now(),
      });
    }

    return null;
  },
});

/**
 * Remove items from loan
 */
export const removeItems = mutation({
  args: {
    loanId: v.id("loans"),
    loanItemIds: v.array(v.id("loanItems")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    // Check permission
    await requirePermission(ctx, loan.organizationId, "loans.update");

    if (loan.status !== "pending") {
      throw new Error("Can only remove items from pending loans");
    }

    for (const loanItemId of args.loanItemIds) {
      const loanItem = await ctx.db.get(loanItemId);
      if (!loanItem || loanItem.loanId !== args.loanId) {
        throw new Error(`Loan item ${loanItemId} not found or invalid`);
      }

      // Update collection status back to active
      await ctx.db.patch(loanItem.collectionId, {
        status: "active",
        lastModifiedBy: userId,
        lastModifiedAt: Date.now(),
      });

      // Delete loan item
      await ctx.db.delete(loanItemId);
    }

    return null;
  },
});

/**
 * List loans with filters
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("active"),
        v.literal("returned"),
        v.literal("cancelled"),
      ),
    ),
    type: v.optional(v.union(v.literal("incoming"), v.literal("outgoing"))),
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("loans"),
        loanNumber: v.string(),
        type: v.union(v.literal("incoming"), v.literal("outgoing")),
        lenderBorrowerName: v.string(),
        startDate: v.number(),
        endDate: v.optional(v.number()),
        status: v.union(
          v.literal("pending"),
          v.literal("active"),
          v.literal("returned"),
          v.literal("cancelled"),
        ),
        itemCount: v.number(),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "loans.read");

    let query = ctx.db
      .query("loans")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      );

    if (args.status) {
      query = query.filter((q) => q.eq(q.field("status"), args.status));
    }

    if (args.type) {
      query = query.filter((q) => q.eq(q.field("type"), args.type));
    }

    const results = await query.order("desc").paginate(args.paginationOpts);

    // Get item counts for each loan
    const loansWithCounts = await Promise.all(
      results.page.map(async (loan) => {
        const items = await ctx.db
          .query("loanItems")
          .withIndex("by_loan", (q) => q.eq("loanId", loan._id))
          .collect();

        return {
          _id: loan._id,
          loanNumber: loan.loanNumber,
          type: loan.type,
          lenderBorrowerName: loan.lenderBorrowerName,
          startDate: loan.startDate,
          endDate: loan.endDate,
          status: loan.status,
          itemCount: items.length,
        };
      }),
    );

    return {
      page: loansWithCounts,
      isDone: results.isDone,
      continueCursor: results.continueCursor,
    };
  },
});

/**
 * Get loan with items
 */
export const get = query({
  args: {
    loanId: v.id("loans"),
  },
  returns: v.union(
    v.object({
      _id: v.id("loans"),
      organizationId: v.id("organizations"),
      loanNumber: v.string(),
      type: v.union(v.literal("incoming"), v.literal("outgoing")),
      lenderBorrowerName: v.string(),
      lenderBorrowerContact: v.optional(v.string()),
      startDate: v.number(),
      endDate: v.optional(v.number()),
      status: v.union(
        v.literal("pending"),
        v.literal("active"),
        v.literal("returned"),
        v.literal("cancelled"),
      ),
      terms: v.optional(v.string()),
      insuranceValue: v.optional(v.number()),
      approvedBy: v.optional(v.id("users")),
      approvedAt: v.optional(v.number()),
      notes: v.optional(v.string()),
      useDetailedConditionReports: v.optional(v.boolean()),
      items: v.array(
        v.object({
          _id: v.id("loanItems"),
          collectionId: v.id("collections"),
          accessionNumber: v.string(),
          title: v.string(),
          conditionOut: v.optional(v.string()),
          conditionIn: v.optional(v.string()),
          notes: v.optional(v.string()),
          conditionReportId: v.optional(v.id("conditionReports")),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      return null;
    }

    await requirePermission(ctx, loan.organizationId, "loans.read");

    // Get loan items
    const loanItems = await ctx.db
      .query("loanItems")
      .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
      .collect();

    // Enrich with collection details
    const items = await Promise.all(
      loanItems.map(async (item) => {
        const collection = await ctx.db.get(item.collectionId);
        return {
          _id: item._id,
          collectionId: item.collectionId,
          accessionNumber: collection?.accessionNumber ?? "",
          title: collection?.title ?? "",
          conditionOut: item.conditionOut,
          conditionIn: item.conditionIn,
          notes: item.notes,
          conditionReportId: item.conditionReportId,
        };
      }),
    );

    return {
      _id: loan._id,
      organizationId: loan.organizationId,
      loanNumber: loan.loanNumber,
      type: loan.type,
      lenderBorrowerName: loan.lenderBorrowerName,
      lenderBorrowerContact: loan.lenderBorrowerContact,
      startDate: loan.startDate,
      endDate: loan.endDate,
      status: loan.status,
      terms: loan.terms,
      insuranceValue: loan.insuranceValue,
      approvedBy: loan.approvedBy,
      approvedAt: loan.approvedAt,
      notes: loan.notes,
      useDetailedConditionReports: loan.useDetailedConditionReports,
      items,
    };
  },
});

/**
 * Update loan details
 */
export const update = mutation({
  args: {
    loanId: v.id("loans"),
    lenderBorrowerName: v.optional(v.string()),
    lenderBorrowerContact: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    terms: v.optional(v.string()),
    insuranceValue: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    // Check permission
    await requirePermission(ctx, loan.organizationId, "loans.update");

    if (loan.status !== "pending") {
      throw new Error("Can only update pending loans");
    }

    const updates: {
      lenderBorrowerName?: string;
      lenderBorrowerContact?: string;
      startDate?: number;
      endDate?: number;
      terms?: string;
      insuranceValue?: number;
      notes?: string;
    } = {};

    if (args.lenderBorrowerName !== undefined)
      updates.lenderBorrowerName = args.lenderBorrowerName;
    if (args.lenderBorrowerContact !== undefined)
      updates.lenderBorrowerContact = args.lenderBorrowerContact;
    if (args.startDate !== undefined) updates.startDate = args.startDate;
    if (args.endDate !== undefined) updates.endDate = args.endDate;
    if (args.terms !== undefined) updates.terms = args.terms;
    if (args.insuranceValue !== undefined)
      updates.insuranceValue = args.insuranceValue;
    if (args.notes !== undefined) updates.notes = args.notes;

    await ctx.db.patch(args.loanId, updates);

    return null;
  },
});

/**
 * Approve loan
 */
export const approve = mutation({
  args: {
    loanId: v.id("loans"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    // Check permission
    await requirePermission(ctx, loan.organizationId, "loans.approve");

    if (loan.status !== "pending") {
      throw new Error("Loan is not pending");
    }

    await ctx.db.patch(args.loanId, {
      status: "active",
      approvedBy: userId,
      approvedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Mark loan as returned
 */
export const returnLoan = mutation({
  args: {
    loanId: v.id("loans"),
    conditionIn: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    // Check permission
    await requirePermission(ctx, loan.organizationId, "loans.update");

    if (loan.status !== "active") {
      throw new Error("Loan is not active");
    }

    // Update loan status
    await ctx.db.patch(args.loanId, {
      status: "returned",
    });

    // Update collection statuses back to active
    const loanItems = await ctx.db
      .query("loanItems")
      .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
      .collect();

    for (const item of loanItems) {
      await ctx.db.patch(item.collectionId, {
        status: "active",
        lastModifiedBy: userId,
        lastModifiedAt: Date.now(),
      });

      // Update condition in if provided
      if (args.conditionIn !== undefined) {
        await ctx.db.patch(item._id, {
          conditionIn: args.conditionIn,
        });
      }
    }

    return null;
  },
});

/**
 * Cancel loan
 */
export const cancel = mutation({
  args: {
    loanId: v.id("loans"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    // Check permission
    await requirePermission(ctx, loan.organizationId, "loans.update");

    if (loan.status !== "pending" && loan.status !== "active") {
      throw new Error("Can only cancel pending or active loans");
    }

    // Update loan status
    await ctx.db.patch(args.loanId, {
      status: "cancelled",
    });

    // Update collection statuses back to active
    const loanItems = await ctx.db
      .query("loanItems")
      .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
      .collect();

    for (const item of loanItems) {
      await ctx.db.patch(item.collectionId, {
        status: "active",
        lastModifiedBy: userId,
        lastModifiedAt: Date.now(),
      });
    }

    return null;
  },
});

/**
 * Create detailed condition report for loan item
 */
export const createConditionReport = mutation({
  args: {
    loanItemId: v.id("loanItems"),
    reportType: v.union(v.literal("out"), v.literal("in")),
    conditionDescription: v.string(),
    damages: v.optional(
      v.array(
        v.object({
          type: v.string(),
          location: v.string(),
          severity: v.string(),
          notes: v.optional(v.string()),
        }),
      ),
    ),
    photos: v.optional(v.array(v.id("_storage"))),
  },
  returns: v.id("conditionReports"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const loanItem = await ctx.db.get(args.loanItemId);
    if (!loanItem) {
      throw new Error("Loan item not found");
    }

    const loan = await ctx.db.get(loanItem.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    // Check if loan uses detailed condition reports
    if (!loan.useDetailedConditionReports) {
      throw new Error("Loan does not use detailed condition reports");
    }

    // Check permission
    await requirePermission(ctx, loan.organizationId, "loans.update");

    const reportId = await ctx.db.insert("conditionReports", {
      loanItemId: args.loanItemId,
      reportType: args.reportType,
      conditionDescription: args.conditionDescription,
      damages: args.damages,
      photos: args.photos,
      assessedBy: userId,
      assessedAt: Date.now(),
    });

    // Link report to loan item
    await ctx.db.patch(args.loanItemId, {
      conditionReportId: reportId,
    });

    return reportId;
  },
});

/**
 * Update condition report
 */
export const updateConditionReport = mutation({
  args: {
    reportId: v.id("conditionReports"),
    conditionDescription: v.optional(v.string()),
    damages: v.optional(
      v.array(
        v.object({
          type: v.string(),
          location: v.string(),
          severity: v.string(),
          notes: v.optional(v.string()),
        }),
      ),
    ),
    photos: v.optional(v.array(v.id("_storage"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Condition report not found");
    }

    const loanItem = await ctx.db.get(report.loanItemId);
    if (!loanItem) {
      throw new Error("Loan item not found");
    }

    const loan = await ctx.db.get(loanItem.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    // Check permission
    await requirePermission(ctx, loan.organizationId, "loans.update");

    const updates: {
      conditionDescription?: string;
      damages?: Array<{
        type: string;
        location: string;
        severity: string;
        notes?: string;
      }>;
      photos?: Array<Id<"_storage">>;
    } = {};

    if (args.conditionDescription !== undefined)
      updates.conditionDescription = args.conditionDescription;
    if (args.damages !== undefined) updates.damages = args.damages;
    if (args.photos !== undefined) updates.photos = args.photos;

    await ctx.db.patch(args.reportId, updates);

    return null;
  },
});

/**
 * Get condition report
 */
export const getConditionReport = query({
  args: {
    reportId: v.id("conditionReports"),
  },
  returns: v.union(
    v.object({
      _id: v.id("conditionReports"),
      loanItemId: v.id("loanItems"),
      reportType: v.union(v.literal("out"), v.literal("in")),
      conditionDescription: v.string(),
      damages: v.optional(
        v.array(
          v.object({
            type: v.string(),
            location: v.string(),
            severity: v.string(),
            notes: v.optional(v.string()),
          }),
        ),
      ),
      photos: v.optional(v.array(v.id("_storage"))),
      photoUrls: v.optional(v.array(v.union(v.string(), v.null()))),
      assessedBy: v.id("users"),
      assessedAt: v.number(),
      assessorName: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) {
      return null;
    }

    const loanItem = await ctx.db.get(report.loanItemId);
    if (!loanItem) {
      return null;
    }

    const loan = await ctx.db.get(loanItem.loanId);
    if (!loan) {
      return null;
    }

    await requirePermission(ctx, loan.organizationId, "loans.read");

    // Get photo URLs
    const photoUrls = report.photos
      ? await Promise.all(
          report.photos.map(async (photoId) =>
            ctx.storage.getUrl(photoId),
          ),
        )
      : undefined;

    // Get assessor name
    const assessor = await ctx.db.get(report.assessedBy);

    return {
      _id: report._id,
      loanItemId: report.loanItemId,
      reportType: report.reportType,
      conditionDescription: report.conditionDescription,
      damages: report.damages,
      photos: report.photos,
      photoUrls,
      assessedBy: report.assessedBy,
      assessedAt: report.assessedAt,
      assessorName: assessor?.name || assessor?.username || undefined,
    };
  },
});

/**
 * Upload loan document
 */
export const uploadLoanDocument = mutation({
  args: {
    loanId: v.id("loans"),
    storageId: v.id("_storage"),
    documentType: v.union(
      v.literal("agreement"),
      v.literal("insurance"),
      v.literal("other"),
    ),
    fileName: v.string(),
  },
  returns: v.id("loanDocuments"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    // Check permission
    await requirePermission(ctx, loan.organizationId, "loans.update");

    const documentId = await ctx.db.insert("loanDocuments", {
      loanId: args.loanId,
      storageId: args.storageId,
      documentType: args.documentType,
      fileName: args.fileName,
      uploadedBy: userId,
      uploadedAt: Date.now(),
    });

    return documentId;
  },
});

/**
 * List loan documents
 */
export const listLoanDocuments = query({
  args: {
    loanId: v.id("loans"),
  },
  returns: v.array(
    v.object({
      _id: v.id("loanDocuments"),
      storageId: v.id("_storage"),
      documentType: v.union(
        v.literal("agreement"),
        v.literal("insurance"),
        v.literal("other"),
      ),
      fileName: v.string(),
      url: v.union(v.string(), v.null()),
      uploadedBy: v.id("users"),
      uploadedAt: v.number(),
      uploaderName: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const loan = await ctx.db.get(args.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    await requirePermission(ctx, loan.organizationId, "loans.read");

    const documents = await ctx.db
      .query("loanDocuments")
      .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
      .collect();

    const documentsWithUrls = await Promise.all(
      documents.map(async (doc) => {
        const url = await ctx.storage.getUrl(doc.storageId);
        const uploader = await ctx.db.get(doc.uploadedBy);

        return {
          _id: doc._id,
          storageId: doc.storageId,
          documentType: doc.documentType,
          fileName: doc.fileName,
          url,
          uploadedBy: doc.uploadedBy,
          uploadedAt: doc.uploadedAt,
          uploaderName: uploader?.name || uploader?.username || undefined,
        };
      }),
    );

    return documentsWithUrls;
  },
});

/**
 * Delete loan document
 */
export const deleteLoanDocument = mutation({
  args: {
    documentId: v.id("loanDocuments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    const loan = await ctx.db.get(document.loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    // Check permission
    await requirePermission(ctx, loan.organizationId, "loans.update");

    // Delete from storage
    await ctx.storage.delete(document.storageId);

    // Delete record
    await ctx.db.delete(args.documentId);

    return null;
  },
});

/**
 * Get loans for a specific collection object
 */
export const getLoansForCollection = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.array(
    v.object({
      _id: v.id("loans"),
      loanNumber: v.string(),
      type: v.union(v.literal("incoming"), v.literal("outgoing")),
      lenderBorrowerName: v.string(),
      startDate: v.number(),
      endDate: v.optional(v.number()),
      status: v.union(
        v.literal("pending"),
        v.literal("active"),
        v.literal("returned"),
        v.literal("cancelled"),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      throw new Error("Collection not found");
    }

    await requirePermission(ctx, collection.organizationId, "loans.read");

    // Get all loan items for this collection
    const loanItems = await ctx.db
      .query("loanItems")
      .withIndex("by_collection", (q) => q.eq("collectionId", args.collectionId))
      .collect();

    // Get unique loan IDs
    const loanIds = [...new Set(loanItems.map((item) => item.loanId))];

    // Get loan details
    const loans = await Promise.all(
      loanIds.map(async (loanId) => {
        const loan = await ctx.db.get(loanId);
        if (!loan) return null;
        return {
          _id: loan._id,
          loanNumber: loan.loanNumber,
          type: loan.type,
          lenderBorrowerName: loan.lenderBorrowerName,
          startDate: loan.startDate,
          endDate: loan.endDate,
          status: loan.status,
        };
      }),
    );

    return loans.filter((loan): loan is NonNullable<typeof loan> => loan !== null);
  },
});

