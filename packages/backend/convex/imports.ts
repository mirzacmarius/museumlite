import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";
import { syncAccessionSearchDocument } from "./utils/accessionSearch";
import { requireAccountAdministration } from "./utils/accountAdministration";
import {
  buildAccountCreateDocument,
  validateAccountProfileForCreate,
} from "./utils/accountProfile";
import {
  createImportedCatalogObject,
  getCollectionGroupMembershipIds,
} from "./utils/catalogObjects";
import {
  collectionsToDublinCore,
  fromDublinCore,
  fromDublinCoreXML,
  toDublinCoreXML,
} from "./utils/dublinCore";
import {
  enforceExportQuota,
  recordExportUsage,
  requireModuleEnabled,
} from "./utils/featureGates";
import { toJSON, toXML } from "./utils/formatConverters";
import {
  ensureIdentifierAvailable,
  generateConfiguredIdentifier,
} from "./utils/identifiers";
import { importRefusal } from "./utils/importErrors";
import {
  type ImportEntityType,
  importEntityTypeValidator,
  importJobViewFields,
  importRowResultValidator,
  MAX_IMPORT_BATCH_ROWS,
  ROW_TRACKED_ENTITY_TYPES,
  requireWritableImportJob,
  runTrackedImportBatch,
  toImportJobView,
  validateImportJobTotal,
} from "./utils/importJobs";
import {
  normalizeAccessionImportRow,
  parseImportDate,
  parseImportDecimal,
} from "./utils/importRows";
import { getTemplate, listTemplates } from "./utils/legacyTemplates";
import { mutation } from "./utils/mutationBuilders";
import {
  generateNextAccountNumber,
  generateNextLoanNumber,
} from "./utils/numberGenerator";
import {
  hasPermission,
  requireLocationAdminPermission,
  requirePermission,
} from "./utils/permissions";
import { productionDateSummary } from "./utils/productionDates";
import { canReadRecord } from "./utils/recordAccess";
import { canonicalEdtf } from "./utils/recordEdits";
import {
  accessionsToSpectrumEntries,
  collectionsToSpectrum,
  entryToSpectrumXML,
  toSpectrumXML,
} from "./utils/spectrum";
import { csvTextCell } from "./utils/spreadsheetText";

const MAX_LOCATION_CODE_LENGTH = 50;

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

const IMPORT_ACCOUNT_TYPES = [
  "lender",
  "borrower",
  "both",
  "institution",
  "patron",
] as const;

function isImportAccountType(
  value: string | undefined,
): value is (typeof IMPORT_ACCOUNT_TYPES)[number] {
  return IMPORT_ACCOUNT_TYPES.some((type) => type === value);
}

function groupByLowerName<T extends { _id: string; name: string }>(
  records: T[],
) {
  const byName = new Map<string, Pick<T, "_id" | "name">[]>();
  for (const record of records) {
    const key = record.name.trim().toLowerCase();
    byName.set(key, [...(byName.get(key) ?? []), record]);
  }
  return byName;
}

/** Resolves a name to exactly one record; ambiguity is an error, not a guess. */
function resolveUniqueName<Id extends string>(
  byName: Map<string, { _id: Id; name: string }[]>,
  name: string,
  label: string,
) {
  const matches = byName.get(name.trim().toLowerCase()) ?? [];
  if (matches.length === 0) {
    throw new Error(
      `${label[0]?.toUpperCase()}${label.slice(1)} "${name}" not found`,
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `"${name}" matches more than one ${label}. Rename one or assign it after import.`,
    );
  }
  return matches[0] as { _id: Id; name: string };
}

/**
 * A CSV row's structured date made as stored. CSVs write EDTF that starts
 * with "-" behind an apostrophe, so exactly one is dropped; text that is not
 * EDTF the parser reads (see utils/productionDates.ts) fails the row.
 */
function importedEdtf(value: string | undefined) {
  const text = value?.trim().replace(/^'(?=-)/, "");
  if (!text) return undefined;
  const edtf = canonicalEdtf(text);
  if (edtf === undefined) {
    throw new Error(
      "dateCreatedEdtf must be an EDTF date MuseumLite reads, such as 1850, 1850~, 185X or 1848/1852, without seasons or times, and an interval cannot end before it starts",
    );
  }
  return edtf;
}

const importBatchResultValidator = v.object({
  processed: v.number(),
  errors: v.array(v.string()),
  results: v.array(importRowResultValidator),
});

/** Permissions needed to run or inspect an import of each record type. */
const IMPORT_PERMISSIONS: Record<ImportEntityType, string[]> = {
  objects: ["collections.create"],
  accessions: ["collections.create"],
  locations: ["locations.create", "organization.manage_settings"],
  accounts: ["accounts.write"],
  loans: ["loans.create"],
};

type ImportJobType = "csv" | "media";

function importPermissions(
  entityType: ImportEntityType | undefined,
  type: ImportJobType,
) {
  // Media imports attach files to objects; they are run by media uploaders.
  if (type === "media") return ["media.upload"];
  // Legacy jobs predate entity types and stay collection-scoped.
  return entityType ? IMPORT_PERMISSIONS[entityType] : ["collections.create"];
}

async function canManageImport(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  entityType: ImportEntityType | undefined,
  type: ImportJobType,
) {
  const checks = await Promise.all(
    importPermissions(entityType, type).map((permission) =>
      hasPermission(ctx, organizationId, permission),
    ),
  );
  return checks.every(Boolean);
}

async function requireImportPermission(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  entityType: ImportEntityType | undefined,
  type: ImportJobType,
) {
  for (const permission of importPermissions(entityType, type)) {
    await requirePermission(ctx, organizationId, permission);
  }
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
    entityType: v.optional(importEntityTypeValidator),
    sourceName: v.optional(v.string()),
    sourceFingerprint: v.optional(v.string()),
  },
  returns: v.id("importJobs"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    await requireImportPermission(
      ctx,
      args.organizationId,
      args.entityType,
      args.type,
    );
    validateImportJobTotal(args.totalItems);
    if (
      args.sourceFingerprint !== undefined &&
      !/^[0-9a-f]{64}$/.test(args.sourceFingerprint)
    ) {
      throw new Error("Source fingerprint must be a SHA-256 hex digest");
    }

    const now = Date.now();
    const jobId = await ctx.db.insert("importJobs", {
      organizationId: args.organizationId,
      type: args.type,
      entityType: args.entityType,
      status: "pending",
      progress: 0,
      totalItems: args.totalItems,
      processedItems: 0,
      ...(args.entityType && ROW_TRACKED_ENTITY_TYPES.has(args.entityType)
        ? { attemptedItems: 0, acceptedItems: 0, failedItems: 0 }
        : {}),
      sourceName: args.sourceName?.trim().slice(0, 200) || undefined,
      sourceFingerprint: args.sourceFingerprint,
      errors: [],
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    return jobId;
  },
});

export const getImportJob = query({
  args: {
    jobId: v.id("importJobs"),
  },
  returns: v.union(v.object(importJobViewFields), v.null()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const job = await ctx.db.get(args.jobId);
    if (!job) return null;
    if (
      !(await canManageImport(
        ctx,
        job.organizationId,
        job.entityType,
        job.type,
      ))
    ) {
      return null;
    }

    return toImportJobView(job);
  },
});

export const listImportJobs = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(v.object(importJobViewFields)),
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
    const allowed = new Map<string, boolean>();
    const visible: ReturnType<typeof toImportJobView>[] = [];
    for (const job of jobs) {
      const key = `${job.type}:${job.entityType ?? ""}`;
      if (!allowed.has(key)) {
        allowed.set(
          key,
          await canManageImport(
            ctx,
            args.organizationId,
            job.entityType,
            job.type,
          ),
        );
      }
      if (allowed.get(key)) visible.push(toImportJobView(job));
    }
    return visible;
  },
});

/** The latest unfinished or partly failed import of the same source file. */
export const findResumableImportJob = query({
  args: {
    organizationId: v.id("organizations"),
    entityType: importEntityTypeValidator,
    sourceFingerprint: v.string(),
  },
  returns: v.union(v.object(importJobViewFields), v.null()),
  handler: async (ctx, args) => {
    await requireImportPermission(
      ctx,
      args.organizationId,
      args.entityType,
      "csv",
    );
    const jobs = await ctx.db
      .query("importJobs")
      .withIndex("by_organization_and_sourceFingerprint", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("sourceFingerprint", args.sourceFingerprint),
      )
      .order("desc")
      .take(10);
    const job = jobs.find(
      (candidate) =>
        candidate.entityType === args.entityType &&
        (candidate.status === "pending" ||
          candidate.status === "processing" ||
          candidate.status === "completed_with_errors"),
    );
    return job ? toImportJobView(job) : null;
  },
});

export const listImportRowResults = query({
  args: {
    jobId: v.id("importJobs"),
    status: v.optional(v.union(v.literal("accepted"), v.literal("failed"))),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        rowNumber: v.number(),
        status: v.union(v.literal("accepted"), v.literal("failed")),
        recordId: v.optional(v.string()),
        identifier: v.optional(v.string()),
        errors: v.array(v.string()),
        attempts: v.number(),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Import job not found");
    await requireImportPermission(
      ctx,
      job.organizationId,
      job.entityType,
      job.type,
    );
    const paginationOpts = {
      ...args.paginationOpts,
      numItems: Math.min(Math.max(args.paginationOpts.numItems, 1), 200),
    };
    const status = args.status;
    const result = status
      ? await ctx.db
          .query("importRowResults")
          .withIndex("by_job_and_status_and_rowNumber", (q) =>
            q.eq("jobId", args.jobId).eq("status", status),
          )
          .paginate(paginationOpts)
      : await ctx.db
          .query("importRowResults")
          .withIndex("by_job_and_rowNumber", (q) => q.eq("jobId", args.jobId))
          .paginate(paginationOpts);
    return {
      isDone: result.isDone,
      continueCursor: result.continueCursor,
      page: result.page.map((row) => ({
        rowNumber: row.rowNumber,
        status: row.status,
        recordId: row.recordId,
        identifier: row.identifier,
        errors: row.errors,
        attempts: row.attempts,
      })),
    };
  },
});

export const importAccessionsBatch = mutation({
  args: {
    organizationId: v.id("organizations"),
    jobId: v.id("importJobs"),
    rows: v.array(
      v.object({
        rowNumber: v.optional(v.number()),
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
  returns: importBatchResultValidator,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "collections.create");
    const job = await requireWritableImportJob(
      ctx,
      args.jobId,
      args.organizationId,
      "accessions",
    );

    return await runTrackedImportBatch(
      ctx,
      job,
      args.rows,
      args.batchIndex,
      async (row, rowNumber) => {
        const normalizedRow = normalizeAccessionImportRow(row, rowNumber);
        const rowErrors = normalizedRow.issues.filter(
          (issue) => issue.severity === "error",
        );
        if (rowErrors.length > 0 || normalizedRow.normalized === null) {
          throw new Error(rowErrors.map((issue) => issue.message).join("; "));
        }

        const accessionNumber = row.accessionNumber?.trim()
          ? row.accessionNumber
          : await generateConfiguredIdentifier(
              ctx,
              args.organizationId,
              "accession",
            );
        const normalizedIdentifier = await ensureIdentifierAvailable(
          ctx,
          args.organizationId,
          "accession",
          accessionNumber,
        );
        const accessionId = await ctx.db.insert("accessions", {
          organizationId: args.organizationId,
          accessionNumber,
          normalizedIdentifier,
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
              comment: `Imported via CSV (job ${job._id}, row ${rowNumber})`,
            },
          ],
        });
        await syncAccessionSearchDocument(ctx, accessionId);
        return { recordId: accessionId, identifier: accessionNumber };
      },
    );
  },
});

export const cancelImportJob = mutation({
  args: {
    jobId: v.id("importJobs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, job] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.jobId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!job) {
      throw new Error("Import job not found");
    }

    await requireImportPermission(
      ctx,
      job.organizationId,
      job.entityType,
      job.type,
    );

    if (
      job.status === "pending" ||
      job.status === "processing" ||
      job.status === "completed_with_errors"
    ) {
      const now = Date.now();
      // Accepted rows stay in the register; only further rows are refused.
      await ctx.db.patch(args.jobId, {
        status: "cancelled",
        updatedAt: now,
        finishedAt: now,
      });
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
    const [userId] = await Promise.all([
      getAuthUserId(ctx),
      requirePermission(ctx, args.organizationId, "collections.read"),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }

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
    const [userId] = await Promise.all([
      getAuthUserId(ctx),

      requirePermission(ctx, args.organizationId, "locations.read"),
      enforceExportQuota(ctx, args.organizationId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
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
    const [userId] = await Promise.all([
      getAuthUserId(ctx),

      requirePermission(ctx, args.organizationId, "loans.read"),
      enforceExportQuota(ctx, args.organizationId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
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

/** Inline, import-ready CSV export; larger catalogs use the durable export job. */
const MAX_IMPORT_READY_OBJECT_EXPORT = 1000;

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
      /** The EDTF staff entered, so a re-import keeps it; never a reading. */
      dateCreatedEdtf: v.optional(v.string()),
      materials: v.optional(v.string()),
      technique: v.optional(v.string()),
      dimensions: v.optional(v.string()),
      description: v.optional(v.string()),
      condition: v.optional(v.string()),
      provenance: v.optional(v.string()),
      location: v.optional(v.string()),
      collectionGroup: v.optional(v.string()),
      collectionGroups: v.array(v.string()),
      status: v.optional(v.string()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const [userId] = await Promise.all([
      getAuthUserId(ctx),

      requirePermission(ctx, args.organizationId, "collections.read"),
      enforceExportQuota(ctx, args.organizationId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    const status = args.status;
    if (status === "in_conservation") return [];
    const filtered = await (status
      ? ctx.db
          .query("collections")
          .withIndex("by_organization_and_status", (q) =>
            q.eq("organizationId", args.organizationId).eq("status", status),
          )
      : ctx.db
          .query("collections")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId),
          )
    ).take(MAX_IMPORT_READY_OBJECT_EXPORT + 1);
    if (filtered.length > MAX_IMPORT_READY_OBJECT_EXPORT)
      throw new ConvexError(
        `This catalog has more than ${MAX_IMPORT_READY_OBJECT_EXPORT.toLocaleString("en-US")} objects. Use the complete catalog export job instead.`,
      );

    const locationMap = new Map<Id<"locations">, string | undefined>();
    const groupMap = new Map<Id<"collectionGroups">, string | undefined>();
    for (const object of filtered) {
      if (
        object.currentLocationId &&
        !locationMap.has(object.currentLocationId)
      )
        locationMap.set(
          object.currentLocationId,
          (await ctx.db.get(object.currentLocationId))?.name,
        );
    }

    const exportRows = await Promise.all(
      filtered.map(async (o) => {
        const membership = await getCollectionGroupMembershipIds(ctx, o);
        for (const groupId of membership.groupIds)
          if (!groupMap.has(groupId))
            groupMap.set(groupId, (await ctx.db.get(groupId))?.name);
        return {
          accessionNumber: o.accessionNumber,
          title: o.title,
          alternativeTitle: o.alternativeTitle,
          creator: o.creator,
          objectType: o.objectType,
          objectName: o.objectName,
          culture: o.culture,
          period: o.period,
          dateCreated: o.dateCreated,
          dateCreatedEdtf: o.dateCreatedEdtf,
          materials: o.materials,
          technique: o.technique,
          dimensions: o.dimensions,
          description: o.description,
          condition: o.condition,
          provenance: o.provenance,
          location: o.currentLocationId
            ? locationMap.get(o.currentLocationId)
            : undefined,
          collectionGroup: membership.primaryGroupId
            ? groupMap.get(membership.primaryGroupId)
            : undefined,
          collectionGroups: membership.groupIds.flatMap((id) => {
            const name = groupMap.get(id);
            return name ? [name] : [];
          }),
          status: o.status,
          createdAt: o._creationTime,
        };
      }),
    );

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
        rowNumber: v.optional(v.number()),
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
  returns: importBatchResultValidator,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requireLocationAdminPermission(
      ctx,
      args.organizationId,
      "locations.create",
    );
    const job = await requireWritableImportJob(
      ctx,
      args.jobId,
      args.organizationId,
      "locations",
    );

    const existingLocations = await ctx.db
      .query("locations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();
    const locationsByName = groupByLowerName(existingLocations);
    const siblingLocationCodes = new Set(
      existingLocations.map(
        (location) =>
          `${location.parentLocationId ?? "root"}:${location.locationCodeNormalized}`,
      ),
    );
    let nextSortOrder = existingLocations.length;

    return await runTrackedImportBatch(
      ctx,
      job,
      args.rows,
      args.batchIndex,
      async (row) => {
        const name = row.name.trim();
        if (!name) throw new Error("Name is required");
        const type = row.type.trim();
        if (!type) throw new Error("Type is required");
        const { locationCode, locationCodeNormalized } = validateLocationCode(
          row.locationCode,
        );

        let parentLocationId: Id<"locations"> | undefined;
        if (row.parentLocation?.trim()) {
          parentLocationId = resolveUniqueName(
            locationsByName,
            row.parentLocation,
            "parent location",
          )._id;
        }

        const siblingCodeKey = `${parentLocationId ?? "root"}:${locationCodeNormalized}`;
        if (siblingLocationCodes.has(siblingCodeKey)) {
          throw new Error("Location ID already exists in this parent location");
        }

        let capacity: number | undefined;
        if (row.capacity?.trim()) {
          const parsed = parseImportDecimal(row.capacity);
          if (parsed === null || !Number.isInteger(parsed) || parsed < 0) {
            throw new Error("Capacity must be a whole number of 0 or more");
          }
          capacity = parsed;
        }

        const location = {
          organizationId: args.organizationId,
          name,
          locationCode,
          locationCodeNormalized,
          type,
          parentLocationId,
          address: row.address?.trim() || undefined,
          capacity,
          notes: row.notes?.trim() || undefined,
          isActive: true,
          sortOrder: nextSortOrder,
        };
        const locationId = await ctx.db.insert("locations", location);
        nextSortOrder += 1;
        siblingLocationCodes.add(siblingCodeKey);
        const key = name.toLowerCase();
        locationsByName.set(key, [
          ...(locationsByName.get(key) ?? []),
          { _id: locationId, name },
        ]);
        return { recordId: locationId, identifier: locationCode };
      },
    );
  },
});

export const importAccountsBatch = mutation({
  args: {
    organizationId: v.id("organizations"),
    jobId: v.id("importJobs"),
    rows: v.array(
      v.object({
        rowNumber: v.optional(v.number()),
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
  returns: importBatchResultValidator,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Same gates as creating an account by hand.
    await requireModuleEnabled(ctx, args.organizationId, "accounts");
    await requirePermission(ctx, args.organizationId, "accounts.write");
    const job = await requireWritableImportJob(
      ctx,
      args.jobId,
      args.organizationId,
      "accounts",
    );

    return await runTrackedImportBatch(
      ctx,
      job,
      args.rows,
      args.batchIndex,
      async (row) => {
        const accountType = row.accountType?.toLowerCase().trim();
        if (!isImportAccountType(accountType)) {
          throw new Error(
            `Invalid accountType "${row.accountType}". Use: ${IMPORT_ACCOUNT_TYPES.join(", ")}`,
          );
        }
        const profile = {
          ...row,
          organizationId: args.organizationId,
          accountType,
        };
        validateAccountProfileForCreate(profile);
        await requireAccountAdministration(ctx, profile);

        let accountNumber = row.accountNumber?.trim();
        if (accountNumber) {
          const existing = await ctx.db
            .query("accounts")
            .withIndex("by_organization_and_accountNumber", (q) =>
              q
                .eq("organizationId", args.organizationId)
                .eq("accountNumber", accountNumber as string),
            )
            .first();
          if (existing) {
            throw new Error(
              `Account number ${accountNumber} is already in use`,
            );
          }
        } else {
          accountNumber = await generateNextAccountNumber(
            ctx,
            args.organizationId,
          );
        }

        const accountId = await ctx.db.insert(
          "accounts",
          buildAccountCreateDocument(profile, {
            accountNumber,
            createdBy: userId,
            createdAt: Date.now(),
          }),
        );
        await ctx.runMutation(internal.audit.logAction, {
          organizationId: args.organizationId,
          userId,
          action: "created_account",
          entityType: "account",
          entityId: accountId,
          changes: { accountType, accountNumber, source: "CSV import" },
        });
        return { recordId: accountId, identifier: accountNumber };
      },
    );
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
    const [userId] = await Promise.all([
      getAuthUserId(ctx),

      requirePermission(ctx, args.organizationId, "loans.read"),
      enforceExportQuota(ctx, args.organizationId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
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
        rowNumber: v.optional(v.number()),
        accessionNumber: v.optional(v.string()),
        title: v.string(),
        alternativeTitle: v.optional(v.string()),
        creator: v.optional(v.string()),
        objectType: v.optional(v.string()),
        objectName: v.optional(v.string()),
        culture: v.optional(v.string()),
        period: v.optional(v.string()),
        dateCreated: v.optional(v.string()),
        dateCreatedEdtf: v.optional(v.string()),
        materials: v.optional(v.string()),
        technique: v.optional(v.string()),
        dimensions: v.optional(v.string()),
        description: v.optional(v.string()),
        condition: v.optional(v.string()),
        provenance: v.optional(v.string()),
        location: v.optional(v.string()),
        collectionGroup: v.optional(v.string()),
        collectionGroups: v.optional(v.string()),
      }),
    ),
    batchIndex: v.number(),
  },
  returns: importBatchResultValidator,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "collections.create");
    const job = await requireWritableImportJob(
      ctx,
      args.jobId,
      args.organizationId,
      "objects",
    );

    const [locations, groups] = await Promise.all([
      ctx.db
        .query("locations")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect(),
      ctx.db
        .query("collectionGroups")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .collect(),
    ]);
    const locationsByName = groupByLowerName(locations);
    const groupsByName = groupByLowerName(groups);

    return await runTrackedImportBatch(
      ctx,
      job,
      args.rows,
      args.batchIndex,
      async (row, rowNumber) => {
        if (!row.title.trim()) throw new Error("Title is required");
        const dateCreatedEdtf = importedEdtf(row.dateCreatedEdtf);
        const locationId = row.location?.trim()
          ? resolveUniqueName(locationsByName, row.location, "location")._id
          : undefined;
        const collectionGroupId = row.collectionGroup?.trim()
          ? resolveUniqueName(
              groupsByName,
              row.collectionGroup,
              "collection group",
            )._id
          : undefined;
        let collectionGroupIds: Id<"collectionGroups">[] | undefined;
        if (row.collectionGroups?.trim()) {
          let parsed: unknown;
          try {
            parsed = JSON.parse(row.collectionGroups);
          } catch {
            throw new Error("Collection groups must be a JSON array of names");
          }
          if (
            !Array.isArray(parsed) ||
            !parsed.every((name) => typeof name === "string" && name.trim())
          ) {
            throw new Error("Collection groups must be a JSON array of names");
          }
          if (parsed.length > 0 && !collectionGroupId) {
            throw new Error(
              "A primary collection group is required when importing memberships",
            );
          }
          collectionGroupIds = [
            ...new Set(
              parsed.map(
                (name: string) =>
                  resolveUniqueName(groupsByName, name, "collection group")._id,
              ),
            ),
          ];
          if (
            collectionGroupId &&
            !collectionGroupIds.includes(collectionGroupId)
          ) {
            throw new Error(
              "The primary collection group must be included in collectionGroups",
            );
          }
        }
        const {
          location: _location,
          collectionGroup: _group,
          collectionGroups: _groups,
          ...fields
        } = row;
        const created = await createImportedCatalogObject(ctx, {
          organizationId: args.organizationId,
          userId,
          accessionNumber: row.accessionNumber,
          fields: { ...fields, dateCreatedEdtf },
          locationId,
          collectionGroupId,
          collectionGroupIds,
          sourceLabel: `CSV import (job ${job._id}, row ${rowNumber})`,
        });
        return {
          recordId: created.collectionId,
          identifier: created.accessionNumber,
        };
      },
    );
  },
});

export const importObjectsDublinCore = mutation({
  args: {
    organizationId: v.id("organizations"),
    jobId: v.id("importJobs"),
    xml: v.string(),
  },
  returns: importBatchResultValidator,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "collections.create");
    let job = await requireWritableImportJob(
      ctx,
      args.jobId,
      args.organizationId,
      "objects",
    );

    const metadataRecords = fromDublinCoreXML(args.xml);
    if (metadataRecords.length === 0) {
      throw importRefusal("DUBLIN_CORE_NO_RECORDS");
    }
    if (metadataRecords.length > MAX_IMPORT_BATCH_ROWS) {
      throw importRefusal("DUBLIN_CORE_TOO_MANY_RECORDS", {
        limit: MAX_IMPORT_BATCH_ROWS,
      });
    }
    if (job.totalItems !== metadataRecords.length) {
      if (toImportJobView(job).attemptedItems > 0) {
        throw importRefusal("DUBLIN_CORE_RECORD_COUNT_CHANGED");
      }
      await ctx.db.patch(job._id, {
        totalItems: metadataRecords.length,
        entityType: "objects",
      });
      job = { ...job, totalItems: metadataRecords.length };
    }

    // Each record's position in the file is its stable row identity.
    const rows = metadataRecords.map((metadata, index) => {
      const collection = fromDublinCore(metadata);
      return {
        rowNumber: index + 1,
        accessionNumber: collection.accessionNumber,
        fields: {
          title: collection.title ?? metadata.title ?? "",
          alternativeTitle: collection.alternativeTitle,
          creator: collection.creator,
          objectType: collection.objectType,
          objectName: collection.objectName,
          culture: collection.culture,
          period: collection.period,
          dateCreated: collection.dateCreated,
          dateCreatedEdtf: collection.dateCreatedEdtf,
          materials: collection.materials,
          technique: collection.technique,
          dimensions: collection.dimensions,
          description: collection.description,
          provenance: collection.provenance,
        },
      };
    });

    return await runTrackedImportBatch(
      ctx,
      job,
      rows,
      0,
      async (row, rowNumber) => {
        if (!row.fields.title.trim()) throw new Error("Title is required");
        const created = await createImportedCatalogObject(ctx, {
          organizationId: args.organizationId,
          userId,
          accessionNumber: row.accessionNumber,
          fields: row.fields,
          sourceLabel: `Dublin Core import (job ${job._id}, record ${rowNumber})`,
        });
        return {
          recordId: created.collectionId,
          identifier: created.accessionNumber,
        };
      },
    );
  },
});

export const importLoansBatch = mutation({
  args: {
    organizationId: v.id("organizations"),
    jobId: v.id("importJobs"),
    rows: v.array(
      v.object({
        rowNumber: v.optional(v.number()),
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
  returns: importBatchResultValidator,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, args.organizationId, "loans.create");
    const job = await requireWritableImportJob(
      ctx,
      args.jobId,
      args.organizationId,
      "loans",
    );

    return await runTrackedImportBatch(
      ctx,
      job,
      args.rows,
      args.batchIndex,
      async (row, rowNumber) => {
        const loanType = row.type?.toLowerCase().trim();
        if (loanType !== "incoming" && loanType !== "outgoing") {
          throw new Error(
            `Invalid type "${row.type}". Use: incoming or outgoing`,
          );
        }
        const lenderBorrowerName = row.lenderBorrowerName.trim();
        if (!lenderBorrowerName) {
          throw new Error("Lender/Borrower name is required");
        }
        const startDate = parseImportDate(row.startDate);
        if (startDate === null) {
          throw new Error("Start date must be a date in YYYY-MM-DD format");
        }
        let endDate: number | undefined;
        if (row.endDate?.trim()) {
          const parsedEnd = parseImportDate(row.endDate);
          if (parsedEnd === null) {
            throw new Error("End date must be a date in YYYY-MM-DD format");
          }
          if (parsedEnd < startDate) {
            throw new Error("End date cannot be before the start date");
          }
          endDate = parsedEnd;
        }
        let insuranceValue: number | undefined;
        if (row.insuranceValue?.trim()) {
          const parsedValue = parseImportDecimal(row.insuranceValue);
          if (parsedValue === null || parsedValue < 0) {
            throw new Error("Insurance value must be a number of 0 or more");
          }
          insuranceValue = parsedValue;
        }

        let loanNumber = row.loanNumber?.trim();
        if (loanNumber) {
          const existing = await ctx.db
            .query("loans")
            .withIndex("by_organization_and_loanNumber", (q) =>
              q
                .eq("organizationId", args.organizationId)
                .eq("loanNumber", loanNumber as string),
            )
            .first();
          if (existing) {
            throw new Error(`Loan number ${loanNumber} is already in use`);
          }
        } else {
          loanNumber = await generateNextLoanNumber(ctx, args.organizationId);
        }

        const loanId = await ctx.db.insert("loans", {
          organizationId: args.organizationId,
          loanNumber,
          type: loanType,
          lenderBorrowerName,
          lenderBorrowerContact: row.lenderBorrowerContact?.trim() || undefined,
          startDate,
          endDate,
          terms: row.terms?.trim() || undefined,
          insuranceValue,
          notes: row.notes?.trim() || undefined,
          status: "pending",
          workflowStep: 0,
          workflowHistory: [
            {
              step: 0,
              approvedBy: userId,
              approvedAt: Date.now(),
              comment: `Imported via CSV (job ${job._id}, row ${rowNumber})`,
            },
          ],
        });
        return { recordId: loanId, identifier: loanNumber };
      },
    );
  },
});

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
    const [userId] = await Promise.all([
      getAuthUserId(ctx),
      requirePermission(ctx, args.organizationId, "collections.read"),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
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
    const [userId] = await Promise.all([
      getAuthUserId(ctx),

      requirePermission(ctx, args.organizationId, "collections.read"),
      enforceExportQuota(ctx, args.organizationId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
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

    const exportRows = await Promise.all(
      filtered.map(async (o) => {
        const membership = await getCollectionGroupMembershipIds(ctx, o);
        const made = productionDateSummary(o);
        return {
          accessionNumber: o.accessionNumber,
          title: o.title,
          alternativeTitle: o.alternativeTitle,
          creator: o.creator,
          objectType: o.objectType,
          objectName: o.objectName,
          culture: o.culture,
          period: o.period,
          dateCreated: o.dateCreated,
          dateCreatedEdtf: o.dateCreatedEdtf,
          productionDateEdtf: made?.edtf,
          productionEarliestYear: made?.earliestYear,
          productionLatestYear: made?.latestYear,
          materials: o.materials,
          technique: o.technique,
          dimensions: o.dimensions,
          description: o.description,
          condition: o.condition,
          provenance: o.provenance,
          location: o.currentLocationId
            ? locationMap.get(o.currentLocationId)
            : undefined,
          collectionGroup: membership.primaryGroupId
            ? groupMap.get(membership.primaryGroupId)
            : undefined,
          collectionGroups: membership.groupIds.flatMap((id) => {
            const name = groupMap.get(id);
            return name ? [name] : [];
          }),
          status: o.status,
          createdAt: o._creationTime,
        };
      }),
    );

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
      "dateCreatedEdtf",
      "productionDateEdtf",
      "productionEarliestYear",
      "productionLatestYear",
      "materials",
      "technique",
      "dimensions",
      "description",
      "condition",
      "provenance",
      "location",
      "collectionGroup",
      "collectionGroups",
      "status",
      "createdAt",
    ];
    // Years are bare numbers: a text cell would turn -499 into '-499.
    const yearCell = (year: number | undefined) =>
      year === undefined ? "" : String(year);
    const csvRows = [headers.join(",")];
    for (const row of exportRows) {
      const cells = [
        ...[
          row.accessionNumber,
          row.title,
          row.alternativeTitle || "",
          row.creator || "",
          row.objectType || "",
          row.objectName || "",
          row.culture || "",
          row.period || "",
          row.dateCreated || "",
          row.dateCreatedEdtf || "",
          row.productionDateEdtf || "",
        ].map(csvTextCell),
        yearCell(row.productionEarliestYear),
        yearCell(row.productionLatestYear),
        ...[
          row.materials || "",
          row.technique || "",
          row.dimensions || "",
          row.description || "",
          row.condition || "",
          row.provenance || "",
          row.location || "",
          row.collectionGroup || "",
          JSON.stringify(row.collectionGroups),
          row.status || "",
          new Date(row.createdAt).toISOString(),
        ].map(csvTextCell),
      ];
      csvRows.push(cells.join(","));
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
    const [userId] = await Promise.all([
      getAuthUserId(ctx),

      requirePermission(ctx, args.organizationId, "locations.read"),
      enforceExportQuota(ctx, args.organizationId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
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
      csvRows.push(values.map((value = "") => csvTextCell(value)).join(","));
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
    const [userId] = await Promise.all([
      getAuthUserId(ctx),

      requirePermission(ctx, args.organizationId, "loans.read"),
      enforceExportQuota(ctx, args.organizationId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
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
      csvRows.push(values.map(csvTextCell).join(","));
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
    const [userId] = await Promise.all([
      getAuthUserId(ctx),

      requirePermission(ctx, args.organizationId, "loans.read"),
      enforceExportQuota(ctx, args.organizationId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
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
      csvRows.push(values.map(csvTextCell).join(","));
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
          "dateCreatedEdtf",
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
          "c. 1850",
          "1850~",
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
    const [userId] = await Promise.all([
      getAuthUserId(ctx),
      requirePermission(ctx, args.organizationId, "collections.create"),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }

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
    const [userId, mapping] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.mappingId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
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
    const mapping = await ctx.db.get(args.mappingId);
    if (
      !mapping ||
      !(await canReadRecord(ctx, mapping.organizationId, "collections.create"))
    ) {
      return null;
    }

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
    await requirePermission(ctx, args.organizationId, "collections.create");

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
    const [userId, mapping] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.mappingId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
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
