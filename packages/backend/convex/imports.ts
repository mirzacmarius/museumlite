import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { collectionsToDublinCore, toDublinCoreXML } from "./utils/dublinCore";
import { enforceExportQuota, recordExportUsage } from "./utils/featureGates";
import { toJSON, toXML } from "./utils/formatConverters";
import { normalizeAccessionImportRow } from "./utils/importRows";
import {
  type FieldMapping,
  type ImportTemplate,
  getTemplate,
  listTemplates,
} from "./utils/legacyTemplates";
import { requirePermission } from "./utils/permissions";
import {
  accessionsToSpectrumEntries,
  collectionsToSpectrum,
  entryToSpectrumXML,
  toSpectrumXML,
} from "./utils/spectrum";

const MAX_LOCATION_CODE_LENGTH = 50;

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

function normalizeLocationCode(locationCode: string) {
  return locationCode.trim().toLowerCase();
}

function validateLocationCode(locationCode: string) {
  const trimmedLocationCode = locationCode.trim();
  if (!trimmedLocationCode) {
    throw new Error("Please enter a location ID");
  }
  if (trimmedLocationCode.length > MAX_LOCATION_CODE_LENGTH) {
    throw new Error("Location ID must be 50 characters or fewer");
  }
  return {
    locationCode: trimmedLocationCode,
    locationCodeNormalized: normalizeLocationCode(trimmedLocationCode),
  };
}

function getFallbackLocationCode(locationId: Id<"locations">) {
  return `LEGACY-${locationId.slice(-6).toUpperCase()}`;
}

function getExportLocationCode(location: {
  _id: Id<"locations">;
  locationCode?: string;
}) {
  return location.locationCode ?? getFallbackLocationCode(location._id);
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

    const importResults = await Promise.all(
      args.rows.map(async (row, i) => {
        if (!row) {
          return { processed: false, errors: [] as string[] };
        }

        const rowNum = args.batchIndex * 50 + i + 2;

        try {
          const normalizedRow = normalizeAccessionImportRow(row, rowNum);
          const rowErrors = normalizedRow.issues.filter(
            (issue) => issue.severity === "error",
          );

          if (rowErrors.length > 0 || normalizedRow.normalized === null) {
            return {
              processed: false,
              errors: rowErrors.map(
                (issue) => `Row ${rowNum}: ${issue.message}`,
              ),
            };
          }

          await ctx.db.insert("accessions", {
            organizationId: args.organizationId,
            accessionNumber:
              normalizedRow.normalized.accessionNumber ??
              `IMP-${Date.now()}-${i}`,
            dateReceived: normalizedRow.normalized.dateReceived,
            source: normalizedRow.normalized.source,
            method: normalizedRow.normalized.method,
            cost: normalizedRow.normalized.cost,
            notes: normalizedRow.normalized.notes,
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

          return { processed: true, errors: [] as string[] };
        } catch (err) {
          return {
            processed: false,
            errors: [
              `Row ${rowNum}: ${err instanceof Error ? err.message : "Unknown error"}`,
            ],
          };
        }
      }),
    );

    const errors: string[] = [];
    let processed = 0;
    for (const result of importResults) {
      errors.push(...result.errors);
      if (result.processed) {
        processed++;
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

export const exportAccessions = mutation({
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
    format: v.optional(
      v.union(
        v.literal("csv"),
        v.literal("json"),
        v.literal("xml"),
        v.literal("dublincore"),
        v.literal("spectrum"),
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

    await enforceExportQuota(ctx, args.organizationId);

    const accessionsQuery = ctx.db
      .query("accessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      );

    const accessions = await accessionsQuery.collect();

    const filtered = args.status
      ? accessions.filter((a) => a.status === args.status)
      : accessions;

    const exportRows = filtered.map((a) => ({
      accessionNumber: a.accessionNumber,
      dateReceived: a.dateReceived,
      source: a.source,
      method: a.method,
      cost: a.cost,
      notes: a.notes,
      status: a.status,
      createdAt: a._creationTime,
    }));

    await recordExportUsage(ctx, args.organizationId);

    return exportRows;
  },
});

export const exportLocations = mutation({
  args: {
    organizationId: v.id("organizations"),
    format: v.optional(
      v.union(
        v.literal("csv"),
        v.literal("json"),
        v.literal("xml"),
        v.literal("dublincore"),
        v.literal("spectrum"),
      ),
    ),
  },
  returns: v.array(
    v.object({
      name: v.string(),
      locationCode: v.string(),
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
    await Promise.all([
      requirePermission(ctx, args.organizationId, "locations.read"),
      enforceExportQuota(ctx, args.organizationId),
    ]);
    const locations = await ctx.db
      .query("locations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const locationMap = new Map(locations.map((l) => [l._id, l.name]));

    const exportRows = locations.map((l) => ({
      name: l.name,
      locationCode: getExportLocationCode(l),
      type: l.type,
      parentLocation: l.parentLocationId
        ? locationMap.get(l.parentLocationId)
        : undefined,
      address: l.address,
      capacity: l.capacity,
      isActive: l.isActive,
      notes: l.notes,
    }));

    await recordExportUsage(ctx, args.organizationId);

    return exportRows;
  },
});

export const exportAccounts = mutation({
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
    format: v.optional(
      v.union(
        v.literal("csv"),
        v.literal("json"),
        v.literal("xml"),
        v.literal("dublincore"),
        v.literal("spectrum"),
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
    await Promise.all([
      requirePermission(ctx, args.organizationId, "loans.read"),
      enforceExportQuota(ctx, args.organizationId),
    ]);
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const filtered = args.accountType
      ? accounts.filter((a) => a.accountType === args.accountType)
      : accounts;

    const exportRows = filtered.map((a) => ({
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

    await recordExportUsage(ctx, args.organizationId);

    return exportRows;
  },
});

export const exportObjects = mutation({
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
    format: v.optional(
      v.union(
        v.literal("csv"),
        v.literal("json"),
        v.literal("xml"),
        v.literal("dublincore"),
        v.literal("spectrum"),
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
    await Promise.all([
      requirePermission(ctx, args.organizationId, "collections.read"),
      enforceExportQuota(ctx, args.organizationId),
    ]);
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

    const exportRows = filtered.map((o) => ({
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

    await recordExportUsage(ctx, args.organizationId);

    return exportRows;
  },
});

export const importLocationsBatch = mutation({
  args: {
    organizationId: v.id("organizations"),
    jobId: v.id("importJobs"),
    rows: v.array(
      v.object({
        name: v.string(),
        locationCode: v.string(),
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
    const siblingLocationCodeMap = new Set(
      existingLocations.map(
        (location) =>
          `${location.parentLocationId ?? "root"}:${location.locationCodeNormalized}`,
      ),
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

        let locationCode: string;
        let locationCodeNormalized: string;
        try {
          const validatedLocationCode = validateLocationCode(row.locationCode);
          locationCode = validatedLocationCode.locationCode;
          locationCodeNormalized = validatedLocationCode.locationCodeNormalized;
        } catch (error) {
          errors.push(
            `Row ${rowNum}: ${error instanceof Error ? error.message : "Invalid location ID"}`,
          );
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

        const siblingCodeKey = `${parentLocationId ?? "root"}:${locationCodeNormalized}`;
        if (siblingLocationCodeMap.has(siblingCodeKey)) {
          errors.push(
            `Row ${rowNum}: Location ID already exists in this parent location`,
          );
          continue;
        }

        const capacity = row.capacity
          ? Number.parseInt(row.capacity, 10)
          : undefined;

        const newLocId = await ctx.db.insert("locations", {
          organizationId: args.organizationId,
          name: row.name.trim(),
          locationCode,
          locationCodeNormalized,
          type: row.type.trim(),
          parentLocationId,
          address: row.address?.trim(),
          capacity: Number.isNaN(capacity ?? 0) ? undefined : capacity,
          notes: row.notes?.trim(),
          isActive: true,
          sortOrder: existingLocations.length + processed,
        });

        locationNameMap.set(row.name.toLowerCase(), newLocId);
        siblingLocationCodeMap.add(siblingCodeKey);
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

    await requirePermission(ctx, args.organizationId, "loans.create");

    const job = await ctx.db.get(args.jobId);
    if (!job || job.organizationId !== args.organizationId) {
      throw new Error("Import job not found");
    }

    await ctx.db.patch(args.jobId, { status: "processing" });

    const validTypes = ["lender", "borrower", "both", "institution", "patron"];

    const accountImportResults = await Promise.all(
      args.rows.map(async (row, i) => {
        if (!row) {
          return { processed: false, errors: [] as string[] };
        }

        const rowNum = args.batchIndex * 50 + i + 2;

        try {
          const accountType = row.accountType?.toLowerCase().trim();
          if (!accountType || !validTypes.includes(accountType)) {
            return {
              processed: false,
              errors: [
                `Row ${rowNum}: Invalid accountType "${row.accountType}". Use: lender, borrower, both, institution, or patron`,
              ],
            };
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

          return { processed: true, errors: [] as string[] };
        } catch (err) {
          return {
            processed: false,
            errors: [
              `Row ${rowNum}: ${err instanceof Error ? err.message : "Unknown error"}`,
            ],
          };
        }
      }),
    );

    const errors: string[] = [];
    let processed = 0;
    for (const result of accountImportResults) {
      errors.push(...result.errors);
      if (result.processed) {
        processed++;
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

export const exportLoans = mutation({
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
    format: v.optional(
      v.union(
        v.literal("csv"),
        v.literal("json"),
        v.literal("xml"),
        v.literal("dublincore"),
        v.literal("spectrum"),
      ),
    ),
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
    await Promise.all([
      requirePermission(ctx, args.organizationId, "loans.read"),
      enforceExportQuota(ctx, args.organizationId),
    ]);
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

    await recordExportUsage(ctx, args.organizationId);

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

export const importLoansBatch = mutation({
  args: {
    organizationId: v.id("organizations"),
    jobId: v.id("importJobs"),
    rows: v.array(
      v.object({
        loanNumber: v.optional(v.string()),
        type: v.string(),
        lenderBorrowerName: v.string(),
        lenderBorrowerContact: v.optional(v.string()),
        startDate: v.string(),
        endDate: v.optional(v.string()),
        terms: v.optional(v.string()),
        insuranceValue: v.optional(v.string()),
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

    await requirePermission(ctx, args.organizationId, "loans.create");

    const job = await ctx.db.get(args.jobId);
    if (!job || job.organizationId !== args.organizationId) {
      throw new Error("Import job not found");
    }

    await ctx.db.patch(args.jobId, { status: "processing" });

    const validTypes = ["incoming", "outgoing"];

    const loanImportResults = await Promise.all(
      args.rows.map(async (row, i) => {
        if (!row) {
          return { processed: false, errors: [] as string[] };
        }

        const rowNum = args.batchIndex * 50 + i + 2;

        try {
          const loanType = row.type?.toLowerCase().trim();
          if (!loanType || !validTypes.includes(loanType)) {
            return {
              processed: false,
              errors: [
                `Row ${rowNum}: Invalid type "${row.type}". Use: incoming or outgoing`,
              ],
            };
          }

          if (!row.lenderBorrowerName || row.lenderBorrowerName.trim() === "") {
            return {
              processed: false,
              errors: [`Row ${rowNum}: Lender/Borrower name is required`],
            };
          }

          const startDate = parseDate(row.startDate);
          const endDate = row.endDate ? parseDate(row.endDate) : undefined;
          const insuranceValue = parseCost(row.insuranceValue || "");

          const loanNumber =
            row.loanNumber || `LN-${Date.now()}-${args.batchIndex}-${i}`;

          await ctx.db.insert("loans", {
            organizationId: args.organizationId,
            loanNumber,
            type: loanType as "incoming" | "outgoing",
            lenderBorrowerName: row.lenderBorrowerName.trim(),
            lenderBorrowerContact: row.lenderBorrowerContact?.trim(),
            startDate,
            endDate,
            terms: row.terms?.trim(),
            insuranceValue,
            notes: row.notes?.trim(),
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

          return { processed: true, errors: [] as string[] };
        } catch (err) {
          return {
            processed: false,
            errors: [
              `Row ${rowNum}: ${err instanceof Error ? err.message : "Unknown error"}`,
            ],
          };
        }
      }),
    );

    const errors: string[] = [];
    let processed = 0;
    for (const result of loanImportResults) {
      errors.push(...result.errors);
      if (result.processed) {
        processed++;
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

// ============================================
// MULTI-FORMAT EXPORT MUTATIONS
// ============================================

export const exportAccessionsWithFormat = mutation({
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
    format: v.union(
      v.literal("csv"),
      v.literal("json"),
      v.literal("xml"),
      v.literal("spectrum"),
    ),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "collections.read");
    await enforceExportQuota(ctx, args.organizationId);

    const accessionsQuery = ctx.db
      .query("accessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      );

    const accessions = await accessionsQuery.collect();

    const filtered = args.status
      ? accessions.filter((a) => a.status === args.status)
      : accessions;

    const exportRows = filtered.map((a) => ({
      accessionNumber: a.accessionNumber,
      dateReceived: a.dateReceived,
      source: a.source,
      method: a.method,
      cost: a.cost,
      notes: a.notes,
      status: a.status,
      createdAt: a._creationTime,
    }));

    await recordExportUsage(ctx, args.organizationId);

    // Convert to requested format
    if (args.format === "json") {
      return toJSON(exportRows, { pretty: true });
    }

    if (args.format === "xml") {
      return toXML(exportRows, {
        pretty: true,
        rootTag: "accessions",
        itemTag: "accession",
      });
    }

    if (args.format === "spectrum") {
      const spectrumEntries = accessionsToSpectrumEntries(filtered);
      // Return as XML array
      const xmlEntries = spectrumEntries
        .map((entry) => entryToSpectrumXML(entry))
        .join("\n");
      return `<?xml version="1.0" encoding="UTF-8"?>\n<spectrum:entries xmlns:spectrum="http://www.collectionstrust.org.uk/spectrum/entry">\n${xmlEntries}\n</spectrum:entries>`;
    }

    // Default: CSV format
    const headers = [
      "accessionNumber",
      "dateReceived",
      "source",
      "method",
      "cost",
      "notes",
      "status",
      "createdAt",
    ];
    const csvRows = [headers.join(",")];
    for (const row of exportRows) {
      const values = [
        row.accessionNumber,
        new Date(row.dateReceived).toISOString(),
        row.source,
        row.method,
        row.cost?.toString() || "",
        row.notes || "",
        row.status,
        new Date(row.createdAt).toISOString(),
      ];
      csvRows.push(values.map((v) => `"${v}"`).join(","));
    }
    return csvRows.join("\n");
  },
});

export const exportObjectsWithFormat = mutation({
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
    format: v.union(
      v.literal("csv"),
      v.literal("json"),
      v.literal("xml"),
      v.literal("dublincore"),
      v.literal("spectrum"),
    ),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    await Promise.all([
      requirePermission(ctx, args.organizationId, "collections.read"),
      enforceExportQuota(ctx, args.organizationId),
    ]);
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

    const exportRows = filtered.map((o) => ({
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

    await recordExportUsage(ctx, args.organizationId);

    // Convert to requested format
    if (args.format === "json") {
      return toJSON(exportRows, { pretty: true });
    }

    if (args.format === "xml") {
      return toXML(exportRows, {
        pretty: true,
        rootTag: "collections",
        itemTag: "collection",
      });
    }

    if (args.format === "dublincore") {
      const dcRecords = collectionsToDublinCore(filtered);
      // Return as XML array
      const xmlRecords = dcRecords
        .map((record) => toDublinCoreXML(record))
        .join("\n");
      return `<?xml version="1.0" encoding="UTF-8"?>\n<dublincore:records xmlns:dublincore="http://purl.org/dc/elements/1.1/">\n${xmlRecords}\n</dublincore:records>`;
    }

    if (args.format === "spectrum") {
      const spectrumRecords = collectionsToSpectrum(filtered);
      // Return as XML array
      const xmlRecords = spectrumRecords
        .map((record) => toSpectrumXML(record))
        .join("\n");
      return `<?xml version="1.0" encoding="UTF-8"?>\n<spectrum:objects xmlns:spectrum="http://www.collectionstrust.org.uk/spectrum/object">\n${xmlRecords}\n</spectrum:objects>`;
    }

    // Default: CSV format
    const headers = [
      "accessionNumber",
      "title",
      "alternativeTitle",
      "creator",
      "objectType",
      "objectName",
      "culture",
      "period",
      "dateCreated",
      "materials",
      "technique",
      "dimensions",
      "description",
      "condition",
      "provenance",
      "location",
      "collectionGroup",
      "status",
      "createdAt",
    ];
    const csvRows = [headers.join(",")];
    for (const row of exportRows) {
      const values = [
        row.accessionNumber,
        row.title,
        row.alternativeTitle || "",
        row.creator || "",
        row.objectType || "",
        row.objectName || "",
        row.culture || "",
        row.period || "",
        row.dateCreated || "",
        row.materials || "",
        row.technique || "",
        row.dimensions || "",
        row.description || "",
        row.condition || "",
        row.provenance || "",
        row.location || "",
        row.collectionGroup || "",
        row.status || "",
        new Date(row.createdAt).toISOString(),
      ];
      csvRows.push(values.map((v) => `"${v.replace(/"/g, '""')}"`).join(","));
    }
    return csvRows.join("\n");
  },
});

export const exportLocationsWithFormat = mutation({
  args: {
    organizationId: v.id("organizations"),
    format: v.union(v.literal("csv"), v.literal("json"), v.literal("xml")),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    await Promise.all([
      requirePermission(ctx, args.organizationId, "locations.read"),
      enforceExportQuota(ctx, args.organizationId),
    ]);
    const locations = await ctx.db
      .query("locations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const locationMap = new Map(locations.map((l) => [l._id, l.name]));

    const exportRows = locations.map((l) => ({
      name: l.name,
      locationCode: getExportLocationCode(l),
      type: l.type,
      parentLocation: l.parentLocationId
        ? locationMap.get(l.parentLocationId)
        : undefined,
      address: l.address,
      capacity: l.capacity,
      isActive: l.isActive,
      notes: l.notes,
    }));

    await recordExportUsage(ctx, args.organizationId);

    // Convert to requested format
    if (args.format === "json") {
      return toJSON(exportRows, { pretty: true });
    }

    if (args.format === "xml") {
      return toXML(exportRows, {
        pretty: true,
        rootTag: "locations",
        itemTag: "location",
      });
    }

    // Default: CSV format
    const headers = [
      "name",
      "locationCode",
      "type",
      "parentLocation",
      "address",
      "capacity",
      "isActive",
      "notes",
    ];
    const csvRows = [headers.join(",")];
    for (const row of exportRows) {
      const values = [
        row.name,
        row.locationCode,
        row.type,
        row.parentLocation || "",
        row.address || "",
        row.capacity?.toString() || "",
        row.isActive.toString(),
        row.notes || "",
      ];
      csvRows.push(
        values.map((value = "") => `"${value.replace(/"/g, '""')}"`).join(","),
      );
    }
    return csvRows.join("\n");
  },
});

export const exportAccountsWithFormat = mutation({
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
    format: v.union(v.literal("csv"), v.literal("json"), v.literal("xml")),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    await Promise.all([
      requirePermission(ctx, args.organizationId, "loans.read"),
      enforceExportQuota(ctx, args.organizationId),
    ]);
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const filtered = args.accountType
      ? accounts.filter((a) => a.accountType === args.accountType)
      : accounts;

    const exportRows = filtered.map((a) => ({
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

    await recordExportUsage(ctx, args.organizationId);

    // Convert to requested format
    if (args.format === "json") {
      return toJSON(exportRows, { pretty: true });
    }

    if (args.format === "xml") {
      return toXML(exportRows, {
        pretty: true,
        rootTag: "accounts",
        itemTag: "account",
      });
    }

    // Default: CSV format
    const headers = [
      "accountNumber",
      "accountType",
      "businessName",
      "firstName",
      "lastName",
      "email",
      "phone",
      "address",
      "city",
      "zipCode",
      "country",
      "contactPerson",
      "contactEmail",
      "notes",
      "createdAt",
    ];
    const csvRows = [headers.join(",")];
    for (const row of exportRows) {
      const values = [
        row.accountNumber,
        row.accountType || "",
        row.businessName || "",
        row.firstName || "",
        row.lastName || "",
        row.email || "",
        row.phone || "",
        row.address || "",
        row.city || "",
        row.zipCode || "",
        row.country || "",
        row.contactPerson || "",
        row.contactEmail || "",
        row.notes || "",
        new Date(row.createdAt).toISOString(),
      ];
      csvRows.push(values.map((v) => `"${v.replace(/"/g, '""')}"`).join(","));
    }
    return csvRows.join("\n");
  },
});

export const exportLoansWithFormat = mutation({
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
    format: v.union(v.literal("csv"), v.literal("json"), v.literal("xml")),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    await Promise.all([
      requirePermission(ctx, args.organizationId, "loans.read"),
      enforceExportQuota(ctx, args.organizationId),
    ]);
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

    await recordExportUsage(ctx, args.organizationId);

    // Convert to requested format
    if (args.format === "json") {
      return toJSON(loansWithCounts, { pretty: true });
    }

    if (args.format === "xml") {
      return toXML(loansWithCounts, {
        pretty: true,
        rootTag: "loans",
        itemTag: "loan",
      });
    }

    // Default: CSV format
    const headers = [
      "loanNumber",
      "type",
      "status",
      "lenderBorrowerName",
      "lenderBorrowerContact",
      "startDate",
      "endDate",
      "terms",
      "insuranceValue",
      "itemCount",
      "notes",
      "createdAt",
    ];
    const csvRows = [headers.join(",")];
    for (const row of loansWithCounts) {
      const values = [
        row.loanNumber,
        row.type,
        row.status,
        row.lenderBorrowerName,
        row.lenderBorrowerContact || "",
        new Date(row.startDate).toISOString(),
        row.endDate ? new Date(row.endDate).toISOString() : "",
        row.terms || "",
        row.insuranceValue?.toString() || "",
        row.itemCount.toString(),
        row.notes || "",
        new Date(row.createdAt).toISOString(),
      ];
      csvRows.push(values.map((v) => `"${v.replace(/"/g, '""')}"`).join(","));
    }
    return csvRows.join("\n");
  },
});

// ============================================
// CSV TEMPLATES
// ============================================

export const getImportTemplateByType = query({
  args: {
    type: v.union(
      v.literal("objects"),
      v.literal("accessions"),
      v.literal("locations"),
      v.literal("accounts"),
      v.literal("loans"),
    ),
  },
  returns: v.object({
    headers: v.array(v.string()),
    exampleRow: v.array(v.string()),
    requiredFields: v.array(v.string()),
    description: v.string(),
  }),
  handler: async (_ctx, args) => {
    type TemplateType =
      | "objects"
      | "accessions"
      | "locations"
      | "accounts"
      | "loans";
    const templates: Record<
      TemplateType,
      {
        headers: string[];
        exampleRow: string[];
        requiredFields: string[];
        description: string;
      }
    > = {
      objects: {
        headers: [
          "accessionNumber",
          "title",
          "alternativeTitle",
          "creator",
          "objectType",
          "objectName",
          "culture",
          "period",
          "dateCreated",
          "materials",
          "technique",
          "dimensions",
          "description",
          "condition",
          "provenance",
          "location",
          "collectionGroup",
        ],
        exampleRow: [
          "2024.001",
          "Untitled Landscape",
          "Landscape Study",
          "John Smith",
          "Painting",
          "Oil on canvas",
          "American",
          "19th Century",
          "1850",
          "Oil, Canvas",
          "Oil painting",
          "24 x 36 inches",
          "A landscape painting depicting...",
          "Good",
          "Gift from the Smith Estate",
          "Gallery A",
          "American Art",
        ],
        requiredFields: ["title"],
        description:
          "Import collection objects. Location and collectionGroup must match existing names.",
      },
      accessions: {
        headers: [
          "accessionNumber",
          "dateReceived",
          "source",
          "method",
          "cost",
          "notes",
        ],
        exampleRow: [
          "2024.001",
          "2024-01-15",
          "John Smith Estate",
          "bequest",
          "5000",
          "Part of the Smith Collection",
        ],
        requiredFields: ["source"],
        description:
          "Import accession records. Method must be: purchase, gift, loan, transfer, donation, bequest, or other.",
      },
      locations: {
        headers: [
          "name",
          "locationCode",
          "type",
          "parentLocation",
          "address",
          "capacity",
          "notes",
        ],
        exampleRow: [
          "Gallery A",
          "G-001",
          "Gallery",
          "Main Building",
          "123 Museum St",
          "50",
          "Main exhibition gallery",
        ],
        requiredFields: ["name", "locationCode", "type"],
        description:
          "Import locations. Parent location must match an existing location name.",
      },
      accounts: {
        headers: [
          "accountNumber",
          "accountType",
          "businessName",
          "firstName",
          "lastName",
          "email",
          "phone",
          "address",
          "city",
          "zipCode",
          "country",
          "contactPerson",
          "contactEmail",
          "notes",
        ],
        exampleRow: [
          "ACC-001",
          "lender",
          "Smith Gallery",
          "",
          "",
          "info@smithgallery.com",
          "555-0100",
          "456 Art Lane",
          "New York",
          "10001",
          "USA",
          "Jane Smith",
          "jane@smithgallery.com",
          "Major lender",
        ],
        requiredFields: ["accountType"],
        description:
          "Import accounts. Type must be: lender, borrower, both, institution, or patron.",
      },
      loans: {
        headers: [
          "loanNumber",
          "type",
          "lenderBorrowerName",
          "lenderBorrowerContact",
          "startDate",
          "endDate",
          "terms",
          "insuranceValue",
          "notes",
        ],
        exampleRow: [
          "LN-2024-001",
          "incoming",
          "Smith Gallery",
          "jane@smithgallery.com",
          "2024-01-15",
          "2024-06-15",
          "Standard loan agreement",
          "50000",
          "Five paintings for summer exhibition",
        ],
        requiredFields: ["type", "lenderBorrowerName", "startDate"],
        description:
          "Import loans. Type must be: incoming or outgoing. Dates in YYYY-MM-DD format.",
      },
    };

    return templates[args.type] ?? templates.objects;
  },
});

// ============================================
// FIELD MAPPING CONFIGURATIONS
// ============================================

export const saveFieldMapping = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    entityType: v.union(
      v.literal("objects"),
      v.literal("accessions"),
      v.literal("locations"),
      v.literal("accounts"),
      v.literal("loans"),
    ),
    mappings: v.array(
      v.object({
        sourceField: v.string(),
        targetField: v.string(),
        transformType: v.optional(
          v.union(
            v.literal("none"),
            v.literal("date"),
            v.literal("number"),
            v.literal("boolean"),
            v.literal("uppercase"),
            v.literal("lowercase"),
            v.literal("trim"),
          ),
        ),
        defaultValue: v.optional(v.string()),
        required: v.optional(v.boolean()),
      }),
    ),
    isDefault: v.optional(v.boolean()),
  },
  returns: v.id("importFieldMappings"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "collections.create");

    // If marking as default, unset any existing defaults for this entity type
    if (args.isDefault) {
      const existingDefaults = await ctx.db
        .query("importFieldMappings")
        .withIndex("by_organization_and_type", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("entityType", args.entityType),
        )
        .filter((q) => q.eq(q.field("isDefault"), true))
        .collect();

      await Promise.all(
        Array.from(existingDefaults).map(async (existing) => {
          await ctx.db.patch(existing._id, { isDefault: false });
        }),
      );
    }

    const mappingId = await ctx.db.insert("importFieldMappings", {
      organizationId: args.organizationId,
      name: args.name,
      description: args.description,
      entityType: args.entityType,
      mappings: args.mappings,
      isDefault: args.isDefault || false,
      createdBy: userId,
      createdAt: Date.now(),
    });

    return mappingId;
  },
});

export const updateFieldMapping = mutation({
  args: {
    mappingId: v.id("importFieldMappings"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    mappings: v.optional(
      v.array(
        v.object({
          sourceField: v.string(),
          targetField: v.string(),
          transformType: v.optional(
            v.union(
              v.literal("none"),
              v.literal("date"),
              v.literal("number"),
              v.literal("boolean"),
              v.literal("uppercase"),
              v.literal("lowercase"),
              v.literal("trim"),
            ),
          ),
          defaultValue: v.optional(v.string()),
          required: v.optional(v.boolean()),
        }),
      ),
    ),
    isDefault: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const mapping = await ctx.db.get(args.mappingId);
    if (!mapping) {
      throw new Error("Field mapping not found");
    }

    await requirePermission(ctx, mapping.organizationId, "collections.create");

    // If marking as default, unset any existing defaults for this entity type
    if (args.isDefault) {
      const existingDefaults = await ctx.db
        .query("importFieldMappings")
        .withIndex("by_organization_and_type", (q) =>
          q
            .eq("organizationId", mapping.organizationId)
            .eq("entityType", mapping.entityType),
        )
        .filter((q) => q.eq(q.field("isDefault"), true))
        .collect();

      await Promise.all(
        Array.from(existingDefaults).map(async (existing) => {
          if (existing._id !== args.mappingId) {
            await ctx.db.patch(existing._id, { isDefault: false });
          }
        }),
      );
    }

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.mappings !== undefined) updates.mappings = args.mappings;
    if (args.isDefault !== undefined) updates.isDefault = args.isDefault;

    await ctx.db.patch(args.mappingId, updates);

    return null;
  },
});

export const getFieldMapping = query({
  args: {
    mappingId: v.id("importFieldMappings"),
  },
  returns: v.union(
    v.object({
      _id: v.id("importFieldMappings"),
      organizationId: v.id("organizations"),
      name: v.string(),
      description: v.optional(v.string()),
      entityType: v.union(
        v.literal("objects"),
        v.literal("accessions"),
        v.literal("locations"),
        v.literal("accounts"),
        v.literal("loans"),
      ),
      mappings: v.array(
        v.object({
          sourceField: v.string(),
          targetField: v.string(),
          transformType: v.optional(
            v.union(
              v.literal("none"),
              v.literal("date"),
              v.literal("number"),
              v.literal("boolean"),
              v.literal("uppercase"),
              v.literal("lowercase"),
              v.literal("trim"),
            ),
          ),
          defaultValue: v.optional(v.string()),
          required: v.optional(v.boolean()),
        }),
      ),
      isDefault: v.optional(v.boolean()),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const mapping = await ctx.db.get(args.mappingId);
    if (!mapping) return null;

    return mapping;
  },
});

export const listFieldMappings = query({
  args: {
    organizationId: v.id("organizations"),
    entityType: v.optional(
      v.union(
        v.literal("objects"),
        v.literal("accessions"),
        v.literal("locations"),
        v.literal("accounts"),
        v.literal("loans"),
      ),
    ),
  },
  returns: v.array(
    v.object({
      _id: v.id("importFieldMappings"),
      name: v.string(),
      description: v.optional(v.string()),
      entityType: v.union(
        v.literal("objects"),
        v.literal("accessions"),
        v.literal("locations"),
        v.literal("accounts"),
        v.literal("loans"),
      ),
      mappings: v.array(
        v.object({
          sourceField: v.string(),
          targetField: v.string(),
          transformType: v.optional(
            v.union(
              v.literal("none"),
              v.literal("date"),
              v.literal("number"),
              v.literal("boolean"),
              v.literal("uppercase"),
              v.literal("lowercase"),
              v.literal("trim"),
            ),
          ),
          defaultValue: v.optional(v.string()),
          required: v.optional(v.boolean()),
        }),
      ),
      isDefault: v.optional(v.boolean()),
      createdAt: v.number(),
      updatedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const query = ctx.db
      .query("importFieldMappings")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      );

    const mappings = await query.collect();

    const filtered = args.entityType
      ? mappings.filter((m) => m.entityType === args.entityType)
      : mappings;

    return filtered.map((m) => ({
      _id: m._id,
      name: m.name,
      description: m.description,
      entityType: m.entityType,
      mappings: m.mappings,
      isDefault: m.isDefault,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));
  },
});

export const deleteFieldMapping = mutation({
  args: {
    mappingId: v.id("importFieldMappings"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const mapping = await ctx.db.get(args.mappingId);
    if (!mapping) {
      throw new Error("Field mapping not found");
    }

    await requirePermission(ctx, mapping.organizationId, "collections.create");

    await ctx.db.delete(args.mappingId);

    return null;
  },
});

const fieldMappingValidator = v.object({
  sourceField: v.string(),
  targetField: v.string(),
  transform: v.optional(
    v.union(
      v.literal("date"),
      v.literal("cost"),
      v.literal("method"),
      v.literal("array"),
      v.literal("dimensions"),
    ),
  ),
  required: v.optional(v.boolean()),
  description: v.optional(v.string()),
});

const importTemplateValidator = v.object({
  name: v.string(),
  description: v.string(),
  system: v.union(
    v.literal("PastPerfect"),
    v.literal("TMS"),
    v.literal("custom"),
  ),
  collectionMappings: v.array(fieldMappingValidator),
  accessionMappings: v.array(fieldMappingValidator),
});

export const getImportTemplate = query({
  args: {
    templateName: v.optional(v.string()),
  },
  returns: v.union(importTemplateValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    if (!args.templateName) {
      return null;
    }

    const template = getTemplate(args.templateName);
    return template || null;
  },
});

export const listImportTemplates = query({
  args: {},
  returns: v.array(importTemplateValidator),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return listTemplates();
  },
});
