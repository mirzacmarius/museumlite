import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { requirePermission } from "./utils/permissions";

const accessionMethodValidator = v.union(
  v.literal("purchase"),
  v.literal("gift"),
  v.literal("loan"),
  v.literal("transfer"),
  v.literal("donation"),
  v.literal("other"),
  v.literal("bequest"),
);

type AccessionMethod =
  | "purchase"
  | "gift"
  | "loan"
  | "transfer"
  | "donation"
  | "other"
  | "bequest";

const VALID_METHODS: AccessionMethod[] = [
  "purchase",
  "gift",
  "loan",
  "transfer",
  "donation",
  "other",
  "bequest",
];

function parseMethod(value: string): AccessionMethod {
  const normalized = value.toLowerCase().trim();
  if (VALID_METHODS.includes(normalized as AccessionMethod)) {
    return normalized as AccessionMethod;
  }
  return "other";
}

function parseDate(value: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return Date.now();
  }
  return parsed;
}

function parseCost(value: string): number | undefined {
  if (!value || value.trim() === "") return undefined;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const num = Number.parseFloat(cleaned);
  return Number.isNaN(num) ? undefined : num;
}

export const createImportJob = mutation({
  args: {
    organizationId: v.id("organizations"),
    type: v.union(v.literal("csv"), v.literal("media")),
    totalItems: v.number(),
  },
  returns: v.id("importJobs"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "collections.create");

    const jobId = await ctx.db.insert("importJobs", {
      organizationId: args.organizationId,
      type: args.type,
      status: "pending",
      progress: 0,
      totalItems: args.totalItems,
      processedItems: 0,
      errors: [],
      createdBy: userId,
      createdAt: Date.now(),
    });

    return jobId;
  },
});

export const getImportJob = query({
  args: {
    jobId: v.id("importJobs"),
  },
  returns: v.union(
    v.object({
      _id: v.id("importJobs"),
      organizationId: v.id("organizations"),
      type: v.union(v.literal("csv"), v.literal("media")),
      status: v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed"),
      ),
      progress: v.number(),
      totalItems: v.number(),
      processedItems: v.number(),
      errors: v.optional(v.array(v.string())),
      createdAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const job = await ctx.db.get(args.jobId);
    if (!job) return null;

    return {
      _id: job._id,
      organizationId: job.organizationId,
      type: job.type,
      status: job.status,
      progress: job.progress,
      totalItems: job.totalItems,
      processedItems: job.processedItems,
      errors: job.errors,
      createdAt: job.createdAt,
    };
  },
});

export const listImportJobs = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("importJobs"),
      type: v.union(v.literal("csv"), v.literal("media")),
      status: v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed"),
      ),
      progress: v.number(),
      totalItems: v.number(),
      processedItems: v.number(),
      errors: v.optional(v.array(v.string())),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const jobs = await ctx.db
      .query("importJobs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .take(20);

    return jobs.map((job) => ({
      _id: job._id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      totalItems: job.totalItems,
      processedItems: job.processedItems,
      errors: job.errors,
      createdAt: job.createdAt,
    }));
  },
});

export const importAccessionsBatch = mutation({
  args: {
    organizationId: v.id("organizations"),
    jobId: v.id("importJobs"),
    rows: v.array(
      v.object({
        accessionNumber: v.optional(v.string()),
        dateReceived: v.string(),
        source: v.string(),
        method: v.string(),
        cost: v.optional(v.string()),
        notes: v.optional(v.string()),
      }),
    ),
    batchIndex: v.number(),
  },
  returns: v.object({
    processed: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "collections.create");

    const job = await ctx.db.get(args.jobId);
    if (!job || job.organizationId !== args.organizationId) {
      throw new Error("Import job not found");
    }

    await ctx.db.patch(args.jobId, { status: "processing" });

    const errors: string[] = [];
    let processed = 0;

    for (let i = 0; i < args.rows.length; i++) {
      const row = args.rows[i];
      if (!row) continue;

      const rowNum = args.batchIndex * 50 + i + 2;

      try {
        if (!row.source || row.source.trim() === "") {
          errors.push(`Row ${rowNum}: Source is required`);
          continue;
        }

        const dateReceived = parseDate(row.dateReceived);
        const method = parseMethod(row.method);
        const cost = parseCost(row.cost || "");

        await ctx.db.insert("accessions", {
          organizationId: args.organizationId,
          accessionNumber: row.accessionNumber || `IMP-${Date.now()}-${i}`,
          dateReceived,
          source: row.source.trim(),
          method,
          cost,
          notes: row.notes?.trim() || undefined,
          status: "pending",
          workflowStep: 0,
          workflowHistory: [
            {
              step: 0,
              approvedBy: userId,
              approvedAt: Date.now(),
              comment: "Imported via CSV",
            },
          ],
        });

        processed++;
      } catch (err) {
        errors.push(
          `Row ${rowNum}: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    }

    const newProcessedItems = job.processedItems + processed;
    const newProgress = Math.round((newProcessedItems / job.totalItems) * 100);
    const allErrors = [...(job.errors || []), ...errors];

    await ctx.db.patch(args.jobId, {
      processedItems: newProcessedItems,
      progress: newProgress,
      errors: allErrors.slice(-100),
      status: newProcessedItems >= job.totalItems ? "completed" : "processing",
    });

    return { processed, errors };
  },
});

export const cancelImportJob = mutation({
  args: {
    jobId: v.id("importJobs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Import job not found");
    }

    await requirePermission(ctx, job.organizationId, "collections.create");

    if (job.status === "pending" || job.status === "processing") {
      await ctx.db.patch(args.jobId, { status: "failed" });
    }

    return null;
  },
});

export const exportAccessions = query({
  args: {
    organizationId: v.id("organizations"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("cataloged"),
      ),
    ),
  },
  returns: v.array(
    v.object({
      accessionNumber: v.string(),
      dateReceived: v.number(),
      source: v.string(),
      method: v.string(),
      cost: v.optional(v.number()),
      notes: v.optional(v.string()),
      status: v.string(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "collections.read");

    const accessionsQuery = ctx.db
      .query("accessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      );

    const accessions = await accessionsQuery.collect();

    const filtered = args.status
      ? accessions.filter((a) => a.status === args.status)
      : accessions;

    return filtered.map((a) => ({
      accessionNumber: a.accessionNumber,
      dateReceived: a.dateReceived,
      source: a.source,
      method: a.method,
      cost: a.cost,
      notes: a.notes,
      status: a.status,
      createdAt: a._creationTime,
    }));
  },
});

export const exportLocations = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      name: v.string(),
      type: v.string(),
      parentLocation: v.optional(v.string()),
      address: v.optional(v.string()),
      capacity: v.optional(v.number()),
      isActive: v.boolean(),
      notes: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "locations.read");

    const locations = await ctx.db
      .query("locations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const locationMap = new Map(locations.map((l) => [l._id, l.name]));

    return locations.map((l) => ({
      name: l.name,
      type: l.type,
      parentLocation: l.parentLocationId
        ? locationMap.get(l.parentLocationId)
        : undefined,
      address: l.address,
      capacity: l.capacity,
      isActive: l.isActive,
      notes: l.notes,
    }));
  },
});

export const exportAccounts = query({
  args: {
    organizationId: v.id("organizations"),
    accountType: v.optional(
      v.union(
        v.literal("lender"),
        v.literal("borrower"),
        v.literal("both"),
        v.literal("institution"),
        v.literal("patron"),
      ),
    ),
  },
  returns: v.array(
    v.object({
      accountNumber: v.string(),
      accountType: v.optional(v.string()),
      businessName: v.optional(v.string()),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      address: v.optional(v.string()),
      city: v.optional(v.string()),
      zipCode: v.optional(v.string()),
      country: v.optional(v.string()),
      contactPerson: v.optional(v.string()),
      contactEmail: v.optional(v.string()),
      notes: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "accounts.read");

    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const filtered = args.accountType
      ? accounts.filter((a) => a.accountType === args.accountType)
      : accounts;

    return filtered.map((a) => ({
      accountNumber: a.accountNumber,
      accountType: a.accountType,
      businessName: a.businessName,
      firstName: a.firstName,
      lastName: a.lastName,
      email: a.email,
      phone: a.phone,
      address: a.address,
      city: a.city,
      zipCode: a.zipCode,
      country: a.country,
      contactPerson: a.contactPerson,
      contactEmail: a.contactEmail,
      notes: a.notes,
      createdAt: a._creationTime,
    }));
  },
});

export const exportObjects = query({
  args: {
    organizationId: v.id("organizations"),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("loaned"),
        v.literal("deaccessioned"),
        v.literal("in_conservation"),
      ),
    ),
  },
  returns: v.array(
    v.object({
      accessionNumber: v.string(),
      title: v.string(),
      alternativeTitle: v.optional(v.string()),
      creator: v.optional(v.string()),
      objectType: v.optional(v.string()),
      objectName: v.optional(v.string()),
      culture: v.optional(v.string()),
      period: v.optional(v.string()),
      dateCreated: v.optional(v.string()),
      materials: v.optional(v.string()),
      technique: v.optional(v.string()),
      dimensions: v.optional(v.string()),
      description: v.optional(v.string()),
      condition: v.optional(v.string()),
      provenance: v.optional(v.string()),
      location: v.optional(v.string()),
      collectionGroup: v.optional(v.string()),
      status: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "collections.read");

    const objects = await ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const filtered = args.status
      ? objects.filter((o) => o.status === args.status)
      : objects;

    const locations = await ctx.db
      .query("locations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();
    const locationMap = new Map(locations.map((l) => [l._id, l.name]));

    const groups = await ctx.db
      .query("collectionGroups")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();
    const groupMap = new Map(groups.map((g) => [g._id, g.name]));

    return filtered.map((o) => ({
      accessionNumber: o.accessionNumber,
      title: o.title,
      alternativeTitle: o.alternativeTitle,
      creator: o.creator,
      objectType: o.objectType,
      objectName: o.objectName,
      culture: o.culture,
      period: o.period,
      dateCreated: o.dateCreated,
      materials: o.materials,
      technique: o.technique,
      dimensions: o.dimensions,
      description: o.description,
      condition: o.condition,
      provenance: o.provenance,
      location: o.currentLocationId
        ? locationMap.get(o.currentLocationId)
        : undefined,
      collectionGroup: o.collectionGroupId
        ? groupMap.get(o.collectionGroupId)
        : undefined,
      status: o.status,
      createdAt: o._creationTime,
    }));
  },
});

export const importLocationsBatch = mutation({
  args: {
    organizationId: v.id("organizations"),
    jobId: v.id("importJobs"),
    rows: v.array(
      v.object({
        name: v.string(),
        type: v.string(),
        parentLocation: v.optional(v.string()),
        address: v.optional(v.string()),
        capacity: v.optional(v.string()),
        notes: v.optional(v.string()),
      }),
    ),
    batchIndex: v.number(),
  },
  returns: v.object({
    processed: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "locations.create");

    const job = await ctx.db.get(args.jobId);
    if (!job || job.organizationId !== args.organizationId) {
      throw new Error("Import job not found");
    }

    await ctx.db.patch(args.jobId, { status: "processing" });

    const existingLocations = await ctx.db
      .query("locations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const locationNameMap = new Map(
      existingLocations.map((l) => [l.name.toLowerCase(), l._id]),
    );

    const errors: string[] = [];
    let processed = 0;

    for (let i = 0; i < args.rows.length; i++) {
      const row = args.rows[i];
      if (!row) continue;

      const rowNum = args.batchIndex * 50 + i + 2;

      try {
        if (!row.name || row.name.trim() === "") {
          errors.push(`Row ${rowNum}: Name is required`);
          continue;
        }

        if (!row.type || row.type.trim() === "") {
          errors.push(`Row ${rowNum}: Type is required`);
          continue;
        }

        let parentLocationId: Id<"locations"> | undefined;
        if (row.parentLocation) {
          const parentId = locationNameMap.get(
            row.parentLocation.toLowerCase(),
          );
          if (!parentId) {
            errors.push(
              `Row ${rowNum}: Parent location "${row.parentLocation}" not found`,
            );
            continue;
          }
          parentLocationId = parentId;
        }

        const capacity = row.capacity
          ? Number.parseInt(row.capacity, 10)
          : undefined;

        const newLocId = await ctx.db.insert("locations", {
          organizationId: args.organizationId,
          name: row.name.trim(),
          type: row.type.trim(),
          parentLocationId,
          address: row.address?.trim(),
          capacity: Number.isNaN(capacity ?? 0) ? undefined : capacity,
          notes: row.notes?.trim(),
          isActive: true,
          sortOrder: existingLocations.length + processed,
        });

        locationNameMap.set(row.name.toLowerCase(), newLocId);
        processed++;
      } catch (err) {
        errors.push(
          `Row ${rowNum}: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    }

    const newProcessedItems = job.processedItems + processed;
    const newProgress = Math.round((newProcessedItems / job.totalItems) * 100);
    const allErrors = [...(job.errors || []), ...errors];

    await ctx.db.patch(args.jobId, {
      processedItems: newProcessedItems,
      progress: newProgress,
      errors: allErrors.slice(-100),
      status: newProcessedItems >= job.totalItems ? "completed" : "processing",
    });

    return { processed, errors };
  },
});

export const importAccountsBatch = mutation({
  args: {
    organizationId: v.id("organizations"),
    jobId: v.id("importJobs"),
    rows: v.array(
      v.object({
        accountNumber: v.optional(v.string()),
        accountType: v.string(),
        businessName: v.optional(v.string()),
        firstName: v.optional(v.string()),
        lastName: v.optional(v.string()),
        email: v.optional(v.string()),
        phone: v.optional(v.string()),
        address: v.optional(v.string()),
        city: v.optional(v.string()),
        zipCode: v.optional(v.string()),
        country: v.optional(v.string()),
        contactPerson: v.optional(v.string()),
        contactEmail: v.optional(v.string()),
        notes: v.optional(v.string()),
      }),
    ),
    batchIndex: v.number(),
  },
  returns: v.object({
    processed: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "accounts.create");

    const job = await ctx.db.get(args.jobId);
    if (!job || job.organizationId !== args.organizationId) {
      throw new Error("Import job not found");
    }

    await ctx.db.patch(args.jobId, { status: "processing" });

    const validTypes = ["lender", "borrower", "both", "institution", "patron"];

    const errors: string[] = [];
    let processed = 0;

    for (let i = 0; i < args.rows.length; i++) {
      const row = args.rows[i];
      if (!row) continue;

      const rowNum = args.batchIndex * 50 + i + 2;

      try {
        const accountType = row.accountType?.toLowerCase().trim();
        if (!accountType || !validTypes.includes(accountType)) {
          errors.push(
            `Row ${rowNum}: Invalid accountType "${row.accountType}". Use: lender, borrower, both, institution, or patron`,
          );
          continue;
        }

        const accountNumber =
          row.accountNumber || `ACC-${Date.now()}-${args.batchIndex}-${i}`;

        await ctx.db.insert("accounts", {
          organizationId: args.organizationId,
          accountNumber,
          accountType: accountType as
            | "lender"
            | "borrower"
            | "both"
            | "institution"
            | "patron",
          businessName: row.businessName?.trim(),
          firstName: row.firstName?.trim(),
          lastName: row.lastName?.trim(),
          email: row.email?.trim(),
          phone: row.phone?.trim(),
          address: row.address?.trim(),
          city: row.city?.trim(),
          zipCode: row.zipCode?.trim(),
          country: row.country?.trim(),
          contactPerson: row.contactPerson?.trim(),
          contactEmail: row.contactEmail?.trim(),
          notes: row.notes?.trim(),
          createdBy: userId,
          createdAt: Date.now(),
        });

        processed++;
      } catch (err) {
        errors.push(
          `Row ${rowNum}: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    }

    const newProcessedItems = job.processedItems + processed;
    const newProgress = Math.round((newProcessedItems / job.totalItems) * 100);
    const allErrors = [...(job.errors || []), ...errors];

    await ctx.db.patch(args.jobId, {
      processedItems: newProcessedItems,
      progress: newProgress,
      errors: allErrors.slice(-100),
      status: newProcessedItems >= job.totalItems ? "completed" : "processing",
    });

    return { processed, errors };
  },
});

export const exportLoans = query({
  args: {
    organizationId: v.id("organizations"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("active"),
        v.literal("dispatched"),
        v.literal("returned"),
        v.literal("cancelled"),
      ),
    ),
    type: v.optional(v.union(v.literal("incoming"), v.literal("outgoing"))),
  },
  returns: v.array(
    v.object({
      loanNumber: v.string(),
      type: v.string(),
      status: v.string(),
      lenderBorrowerName: v.string(),
      lenderBorrowerContact: v.optional(v.string()),
      startDate: v.number(),
      endDate: v.optional(v.number()),
      terms: v.optional(v.string()),
      insuranceValue: v.optional(v.number()),
      itemCount: v.number(),
      notes: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "loans.read");

    const loans = await ctx.db
      .query("loans")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    let filtered = loans;
    if (args.status) {
      filtered = filtered.filter((l) => l.status === args.status);
    }
    if (args.type) {
      filtered = filtered.filter((l) => l.type === args.type);
    }

    const loansWithCounts = await Promise.all(
      filtered.map(async (loan) => {
        const items = await ctx.db
          .query("loanItems")
          .withIndex("by_loan", (q) => q.eq("loanId", loan._id))
          .collect();

        return {
          loanNumber: loan.loanNumber,
          type: loan.type,
          status: loan.status,
          lenderBorrowerName: loan.lenderBorrowerName,
          lenderBorrowerContact: loan.lenderBorrowerContact,
          startDate: loan.startDate,
          endDate: loan.endDate,
          terms: loan.terms,
          insuranceValue: loan.insuranceValue,
          itemCount: items.length,
          notes: loan.notes,
          createdAt: loan._creationTime,
        };
      }),
    );

    return loansWithCounts;
  },
});

export const importObjectsBatch = mutation({
  args: {
    organizationId: v.id("organizations"),
    jobId: v.id("importJobs"),
    rows: v.array(
      v.object({
        accessionNumber: v.optional(v.string()),
        title: v.string(),
        alternativeTitle: v.optional(v.string()),
        creator: v.optional(v.string()),
        objectType: v.optional(v.string()),
        objectName: v.optional(v.string()),
        culture: v.optional(v.string()),
        period: v.optional(v.string()),
        dateCreated: v.optional(v.string()),
        materials: v.optional(v.string()),
        technique: v.optional(v.string()),
        dimensions: v.optional(v.string()),
        description: v.optional(v.string()),
        condition: v.optional(v.string()),
        provenance: v.optional(v.string()),
        location: v.optional(v.string()),
        collectionGroup: v.optional(v.string()),
      }),
    ),
    batchIndex: v.number(),
  },
  returns: v.object({
    processed: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "collections.create");

    const job = await ctx.db.get(args.jobId);
    if (!job || job.organizationId !== args.organizationId) {
      throw new Error("Import job not found");
    }

    await ctx.db.patch(args.jobId, { status: "processing" });

    const locations = await ctx.db
      .query("locations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();
    const locationNameMap = new Map(
      locations.map((l) => [l.name.toLowerCase(), l._id]),
    );

    const groups = await ctx.db
      .query("collectionGroups")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();
    const groupNameMap = new Map(
      groups.map((g) => [g.name.toLowerCase(), g._id]),
    );

    const errors: string[] = [];
    let processed = 0;

    for (let i = 0; i < args.rows.length; i++) {
      const row = args.rows[i];
      if (!row) continue;

      const rowNum = args.batchIndex * 50 + i + 2;

      try {
        if (!row.title || row.title.trim() === "") {
          errors.push(`Row ${rowNum}: Title is required`);
          continue;
        }

        let currentLocationId: Id<"locations"> | undefined;
        if (row.location) {
          currentLocationId = locationNameMap.get(row.location.toLowerCase());
          if (!currentLocationId) {
            errors.push(`Row ${rowNum}: Location "${row.location}" not found`);
            continue;
          }
        }

        let collectionGroupId: Id<"collectionGroups"> | undefined;
        if (row.collectionGroup) {
          collectionGroupId = groupNameMap.get(
            row.collectionGroup.toLowerCase(),
          );
          if (!collectionGroupId) {
            errors.push(
              `Row ${rowNum}: Collection group "${row.collectionGroup}" not found`,
            );
            continue;
          }
        }

        const accessionNumber =
          row.accessionNumber || `IMP-${Date.now()}-${args.batchIndex}-${i}`;

        await ctx.db.insert("collections", {
          organizationId: args.organizationId,
          accessionNumber,
          title: row.title.trim(),
          alternativeTitle: row.alternativeTitle?.trim(),
          creator: row.creator?.trim(),
          objectType: row.objectType?.trim(),
          objectName: row.objectName?.trim(),
          culture: row.culture?.trim(),
          period: row.period?.trim(),
          dateCreated: row.dateCreated?.trim(),
          materials: row.materials?.trim(),
          technique: row.technique?.trim(),
          dimensions: row.dimensions?.trim(),
          description: row.description?.trim(),
          condition: row.condition?.trim(),
          provenance: row.provenance?.trim(),
          currentLocationId,
          collectionGroupId,
          status: "active",
          catalogedBy: userId,
          catalogedAt: Date.now(),
        });

        processed++;
      } catch (err) {
        errors.push(
          `Row ${rowNum}: ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    }

    const newProcessedItems = job.processedItems + processed;
    const newProgress = Math.round((newProcessedItems / job.totalItems) * 100);
    const allErrors = [...(job.errors || []), ...errors];

    await ctx.db.patch(args.jobId, {
      processedItems: newProcessedItems,
      progress: newProgress,
      errors: allErrors.slice(-100),
      status: newProcessedItems >= job.totalItems ? "completed" : "processing",
    });

    return { processed, errors };
  },
});
