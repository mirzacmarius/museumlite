import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
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
