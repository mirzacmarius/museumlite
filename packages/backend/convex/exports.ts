import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalQuery,
  type MutationCtx,
  type QueryCtx,
  query,
} from "./_generated/server";
import { AUDIT_READ_PERMISSION } from "./auditLog";
import schema from "./schema";
import { filterCatalogRows } from "./utils/catalogListing";
import { requireExportAccess } from "./utils/exportAccess";
import {
  exportFormat,
  exportSource,
  exportStatus,
  MAX_EXPORT_BYTES,
  RETENTION_MS,
  registerTotalsValidator,
} from "./utils/exportContract";
import {
  enforceExportQuota,
  hasFeatureAccess,
  recordExportUsage,
} from "./utils/featureGates";
import { internalMutation, mutation } from "./utils/mutationBuilders";
import { hasPermission, requirePermission } from "./utils/permissions";
import { readRegisterPage } from "./utils/registerPages";
import {
  REGISTER_FEATURES,
  REGISTER_PERMISSIONS,
} from "./utils/registerProfiles";
import { validateRegisterCriteria } from "./utils/registerSources";
import { mergeRegisterTotals } from "./utils/registerTotals";

const exportJobDoc = v.object({
  ...schema.tables.exportJobs.validator.fields,
  _id: v.id("exportJobs"),
  _creationTime: v.number(),
});
async function requireOwnJob(
  ctx: QueryCtx | MutationCtx,
  jobId: Id<"exportJobs">,
) {
  const userId = await getAuthUserId(ctx);
  const job = await ctx.db.get(jobId);
  const organization = job ? await ctx.db.get(job.organizationId) : null;
  const currentUser = userId ? await ctx.db.get(userId) : null;
  if (
    !job ||
    !organization ||
    !currentUser ||
    !userId ||
    job.creatorId !== userId
  )
    throw new ConvexError("Export unavailable");
  await requireExportAccess(ctx, job.organizationId, job.source, (permission) =>
    requirePermission(ctx, job.organizationId, permission),
  );
  return job;
}
async function requeueJob(ctx: MutationCtx, job: Doc<"exportJobs">) {
  const generation = job.generation + 1;
  await ctx.db.patch(job._id, {
    status: "queued",
    generation,
    leaseUntil: undefined,
    error: undefined,
  });
  await ctx.scheduler.runAfter(0, internal.exportActions.process, {
    jobId: job._id,
    generation,
  });
}
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    requestKey: v.string(),
    source: exportSource,
    format: exportFormat,
    selectedCount: v.optional(v.number()),
  },
  returns: v.id("exportJobs"),
  handler: async (ctx, args) => {
    await requireExportAccess(
      ctx,
      args.organizationId,
      args.source,
      (permission) => requirePermission(ctx, args.organizationId, permission),
    );
    const creatorId = await getAuthUserId(ctx);
    if (!creatorId) throw new ConvexError("Authentication required");
    if (!args.requestKey || args.requestKey.length > 100)
      throw new ConvexError("Invalid request key");
    const existing = await ctx.db
      .query("exportJobs")
      .withIndex("by_creatorId_and_requestKey", (q) =>
        q.eq("creatorId", creatorId).eq("requestKey", args.requestKey),
      )
      .unique();
    if (existing) {
      if (
        existing.organizationId !== args.organizationId ||
        JSON.stringify(existing.source) !== JSON.stringify(args.source) ||
        existing.format !== args.format ||
        existing.selectedCount !== args.selectedCount
      )
        throw new ConvexError(
          "Request key already used with a different scope",
        );
      return existing._id;
    }
    if (args.source.kind === "objects") {
      const filters = args.source.filters;
      if (
        [filters.catalogedFrom, filters.catalogedTo].some(
          (date) => date !== undefined && (!Number.isFinite(date) || date < 0),
        )
      )
        throw new ConvexError("Invalid catalog date");
      if (
        (filters.search?.length ?? 0) > 200 ||
        (filters.locationIds?.length ?? 0) > 100
      )
        throw new ConvexError("Export filters exceed limits");
      for (const id of [
        ...(filters.locationIds ?? []),
        ...(filters.collectionGroupId ? [filters.collectionGroupId] : []),
      ]) {
        const record = await ctx.db.get(id);
        if (!record || record.organizationId !== args.organizationId)
          throw new ConvexError("Filter outside organization");
      }
    } else if (args.source.kind === "register") {
      await validateRegisterCriteria(
        ctx,
        args.organizationId,
        args.source.profile,
        args.source.criteria,
        Date.now(),
      );
    } else {
      const filters = args.source.filters;
      if (filters.entityId && !filters.entityType)
        throw new ConvexError("Entity type required");
      if (
        [filters.fromDate, filters.toDate].some(
          (date) => date !== undefined && (!Number.isFinite(date) || date < 0),
        ) ||
        (filters.fromDate !== undefined &&
          filters.toDate !== undefined &&
          filters.fromDate > filters.toDate)
      )
        throw new ConvexError("Invalid date range");
      if (filters.objectId) {
        const object = await ctx.db.get(filters.objectId);
        if (!object || object.organizationId !== args.organizationId)
          throw new ConvexError("Filter outside organization");
      }
    }
    const isSelected =
      args.source.kind === "objects" && args.source.mode === "selected";
    if (
      isSelected &&
      (!Number.isSafeInteger(args.selectedCount) ||
        !args.selectedCount ||
        args.selectedCount < 1 ||
        args.selectedCount > 200000)
    )
      throw new ConvexError("Selected count must be 1–200,000");
    if (!isSelected && args.selectedCount !== undefined)
      throw new ConvexError("Selected count only applies to selected exports");
    if (
      args.source.kind === "objects" &&
      isSelected &&
      Object.values(args.source.filters).some((value) => value !== undefined)
    )
      throw new ConvexError("Selected exports use explicit IDs, not filters");
    await enforceExportQuota(ctx, args.organizationId);
    await recordExportUsage(ctx, args.organizationId);
    const now = Date.now();
    const jobId = await ctx.db.insert("exportJobs", {
      ...args,
      creatorId,
      schemaVersion: 1,
      asOf: now,
      captureStartedAt: now,
      expiresAt: now + RETENTION_MS,
      status: isSelected ? "selecting" : "queued",
      cursor: null,
      checkpoint: 0,
      chunksCommitted: 0,
      finalizeLevel: 0,
      finalizeAfter: -1,
      finalizeInputCount: 0,
      finalizeProduced: 0,
      rows: 0,
      scanned: 0,
      selected: 0,
      bytes: 0,
      attempts: 0,
      failedAttempts: 0,
      generation: 1,
      sourceDone: false,
    });
    if (!isSelected)
      await ctx.scheduler.runAfter(0, internal.exportActions.process, {
        jobId,
        generation: 1,
      });
    await ctx.scheduler.runAfter(RETENTION_MS, internal.exports.expire, {
      jobId,
    });
    return jobId;
  },
});
export const appendSelection = mutation({
  args: { jobId: v.id("exportJobs"), objectIds: v.array(v.id("collections")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await requireOwnJob(ctx, args.jobId);
    if (job.status !== "selecting" || args.objectIds.length > 100)
      throw new ConvexError("Selection closed or batch exceeds 100 objects");
    let added = 0;
    for (const objectId of args.objectIds) {
      const object = await ctx.db.get(objectId);
      if (
        !object ||
        object.organizationId !== job.organizationId ||
        object._creationTime > job.asOf
      )
        throw new ConvexError("Object outside export scope");
      const exists = await ctx.db
        .query("exportSelections")
        .withIndex("by_jobId_and_objectId", (q) =>
          q.eq("jobId", job._id).eq("objectId", objectId),
        )
        .unique();
      if (!exists) {
        await ctx.db.insert("exportSelections", { jobId: job._id, objectId });
        added++;
      }
    }
    if (job.selected + added > (job.selectedCount ?? 0))
      throw new ConvexError("Selection exceeds requested count");
    await ctx.db.patch(job._id, { selected: job.selected + added });
    return null;
  },
});
export const start = mutation({
  args: { jobId: v.id("exportJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await requireOwnJob(ctx, args.jobId);
    if (job.status === "selecting") {
      if (job.selected !== job.selectedCount)
        throw new ConvexError(
          "Selection upload incomplete; retry upload or create a new request",
        );
      await requeueJob(ctx, job);
    }
    return null;
  },
});
export const cancel = mutation({
  args: { jobId: v.id("exportJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await requireOwnJob(ctx, args.jobId);
    if (!["completed", "expired"].includes(job.status))
      await ctx.db.patch(job._id, {
        status: "cancelled",
        generation: job.generation + 1,
        leaseUntil: undefined,
      });
    return null;
  },
});
export const resume = mutation({
  args: { jobId: v.id("exportJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await requireOwnJob(ctx, args.jobId);
    if (Date.now() >= job.expiresAt)
      throw new ConvexError("Export expired; create a new request");
    if (
      job.status === "selecting" ||
      job.status === "completed" ||
      job.status === "expired"
    )
      throw new ConvexError("Export cannot resume");
    if (job.leaseUntil && job.leaseUntil > Date.now())
      throw new ConvexError("Export is still running");
    if (
      job.source.kind === "objects" &&
      job.source.mode === "selected" &&
      job.selected !== job.selectedCount
    ) {
      await ctx.db.patch(job._id, {
        status: "selecting",
        generation: job.generation + 1,
      });
    } else await requeueJob(ctx, job);
    return null;
  },
});
const publicStatus = v.object({
  jobId: v.id("exportJobs"),
  source: exportSource,
  format: exportFormat,
  schemaVersion: v.literal(1),
  asOf: v.number(),
  captureStartedAt: v.number(),
  captureCompletedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  status: exportStatus,
  rows: v.number(),
  scanned: v.number(),
  selected: v.number(),
  selectedCount: v.optional(v.number()),
  bytes: v.number(),
  checkpoint: v.number(),
  sourceDone: v.boolean(),
  attempts: v.number(),
  failedAttempts: v.number(),
  expiresAt: v.number(),
  sha256: v.optional(v.string()),
  error: v.optional(v.string()),
  leaseUntil: v.optional(v.number()),
  totals: v.optional(registerTotalsValidator),
});
function toPublicStatus(job: Doc<"exportJobs">) {
  return {
    jobId: job._id,
    source: job.source,
    format: job.format,
    schemaVersion: job.schemaVersion,
    asOf: job.asOf,
    captureStartedAt: job.captureStartedAt,
    captureCompletedAt: job.captureCompletedAt,
    completedAt: job.completedAt,
    status: job.status,
    rows: job.rows,
    scanned: job.scanned,
    selected: job.selected,
    selectedCount: job.selectedCount,
    bytes: job.bytes,
    checkpoint: job.checkpoint,
    sourceDone: job.sourceDone,
    attempts: job.attempts,
    failedAttempts: job.failedAttempts,
    expiresAt: job.expiresAt,
    sha256: job.sha256,
    error: job.error,
    leaseUntil: job.leaseUntil,
    totals: job.totals,
  };
}
export const status = query({
  args: { jobId: v.id("exportJobs") },
  returns: publicStatus,
  handler: async (ctx, args) =>
    toPublicStatus(await requireOwnJob(ctx, args.jobId)),
});
export const list = query({
  args: { organizationId: v.id("organizations") },
  returns: v.array(publicStatus),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");
    const creatorId = await getAuthUserId(ctx);
    if (!creatorId) return [];
    const auditAllowed =
      (await hasFeatureAccess(ctx, args.organizationId, "compliance")) &&
      (await hasPermission(ctx, args.organizationId, AUDIT_READ_PERMISSION));
    const granted = new Map<string, boolean>();
    const allows = async (key: string, check: () => Promise<boolean>) => {
      if (!granted.has(key)) granted.set(key, await check());
      return granted.get(key) === true;
    };
    const profileAllowed = async (
      profile: keyof typeof REGISTER_PERMISSIONS,
    ) => {
      for (const feature of REGISTER_FEATURES[profile])
        if (
          !(await allows(`feature:${feature}`, () =>
            hasFeatureAccess(ctx, args.organizationId, feature),
          ))
        )
          return false;
      for (const permission of REGISTER_PERMISSIONS[profile])
        if (
          !(await allows(permission, () =>
            hasPermission(ctx, args.organizationId, permission),
          ))
        )
          return false;
      return true;
    };
    const jobs = await ctx.db
      .query("exportJobs")
      .withIndex("by_organizationId_and_creatorId", (q) =>
        q.eq("organizationId", args.organizationId).eq("creatorId", creatorId),
      )
      .order("desc")
      .take(20);
    const visibleJobs: ReturnType<typeof toPublicStatus>[] = [];
    for (const job of jobs) {
      if (
        (job.source.kind !== "audit" || auditAllowed) &&
        (job.source.kind !== "register" ||
          (await profileAllowed(job.source.profile)))
      ) {
        visibleJobs.push(toPublicStatus(job));
      }
    }
    return visibleJobs;
  },
});
const EXPIRY_BATCH_SIZE = 50;
export const expire = internalMutation({
  args: { jobId: v.id("exportJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.expiresAt > Date.now()) return null;
    if (job.storageId) await ctx.storage.delete(job.storageId);
    const chunks = await ctx.db
      .query("exportChunks")
      .withIndex("by_jobId_and_sequence", (q) => q.eq("jobId", job._id))
      .take(EXPIRY_BATCH_SIZE);
    const parts = await ctx.db
      .query("exportParts")
      .withIndex("by_jobId_and_level_and_sequence", (q) =>
        q.eq("jobId", job._id),
      )
      .take(EXPIRY_BATCH_SIZE);
    const selections = await ctx.db
      .query("exportSelections")
      .withIndex("by_jobId", (q) => q.eq("jobId", job._id))
      .take(EXPIRY_BATCH_SIZE);
    for (const record of [...chunks, ...parts]) {
      if (record.storageId) await ctx.storage.delete(record.storageId);
      await ctx.db.delete(record._id);
    }
    for (const selection of selections) await ctx.db.delete(selection._id);
    if (job.status !== "expired" || job.storageId)
      await ctx.db.patch(job._id, {
        status: "expired",
        storageId: undefined,
        generation: job.generation + 1,
      });
    if (
      chunks.length === EXPIRY_BATCH_SIZE ||
      parts.length === EXPIRY_BATCH_SIZE ||
      selections.length === EXPIRY_BATCH_SIZE
    )
      await ctx.scheduler.runAfter(0, internal.exports.expire, args);
    return null;
  },
});

async function requireCreatorStillPermitted(
  ctx: QueryCtx | MutationCtx,
  job: Doc<"exportJobs">,
) {
  const user = await ctx.db.get(job.creatorId);
  const organization = await ctx.db.get(job.organizationId);
  if (!user || !organization)
    throw new ConvexError("Export permission revoked");
  await requireExportAccess(
    ctx,
    job.organizationId,
    job.source,
    async (permissionName) => {
      const permitted: boolean = await ctx.runQuery(
        internal.utils.permissions.checkOrgPermission,
        {
          userId: job.creatorId,
          organizationId: job.organizationId,
          permissionName,
        },
      );
      if (!permitted) throw new ConvexError("Export permission revoked");
    },
  );
}
export const claim = internalMutation({
  args: { jobId: v.id("exportJobs"), generation: v.number() },
  returns: v.union(exportJobDoc, v.null()),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (
      !job ||
      job.generation !== args.generation ||
      !["queued", "running", "finalizing"].includes(job.status) ||
      (job.leaseUntil && job.leaseUntil > Date.now())
    )
      return null;
    if (Date.now() >= job.expiresAt) return null;
    await requireCreatorStillPermitted(ctx, job);
    await ctx.db.patch(job._id, {
      status: job.sourceDone ? "finalizing" : "running",
      attempts: job.attempts + 1,
      leaseUntil: Date.now() + 120000,
    });
    return job;
  },
});
export const sourcePage = internalQuery({
  args: {
    jobId: v.id("exportJobs"),
    generation: v.number(),
    capturedAt: v.number(),
  },
  returns: v.object({
    rows: v.array(v.any()),
    cursor: v.union(v.string(), v.null()),
    done: v.boolean(),
    scanned: v.number(),
  }),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.generation !== args.generation || job.status !== "running")
      throw new ConvexError("Export interrupted");
    await requireCreatorStillPermitted(ctx, job);
    if (job.source.kind === "register")
      return await readRegisterPage(
        ctx,
        {
          organizationId: job.organizationId,
          profile: job.source.profile,
          criteria: job.source.criteria,
          asOf: job.source.criteria.asOf ?? job.asOf,
          capturedAt: args.capturedAt,
        },
        job.cursor,
      );
    if (job.source.kind !== "objects") throw new ConvexError("Invalid source");
    const opts = {
      numItems:
        job.source.mode === "selected" ||
        job.source.filters.inventoryMetricScope
          ? 10
          : 100,
      cursor: job.cursor,
      maximumRowsRead: 100,
      maximumBytesRead: 512 * 1024,
    };
    const capturedAt = args.capturedAt;
    if (job.source.mode === "selected") {
      const page = await ctx.db
        .query("exportSelections")
        .withIndex("by_jobId", (q) => q.eq("jobId", job._id))
        .paginate(opts);
      const rows: Array<Doc<"collections"> & { capturedAt: number }> = [];
      for (const item of page.page) {
        const row = await ctx.db.get(item.objectId);
        if (!row || row.organizationId !== job.organizationId)
          throw new ConvexError(
            "Selected object missing or outside authorized scope; create a new selection",
          );
        rows.push({ ...row, capturedAt });
      }
      return {
        rows,
        cursor: page.continueCursor,
        done: page.isDone,
        scanned: page.page.length,
      };
    }
    const page = await ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", job.organizationId),
      )
      .paginate(opts);
    // The same filters and search rule as the catalog list it exports.
    const filtered = await filterCatalogRows(
      ctx,
      { organizationId: job.organizationId, ...job.source.filters },
      page.page.filter((row) => row._creationTime <= job.asOf),
    );
    const rows = filtered.map(({ matchedField: _matchedField, ...row }) => ({
      ...row,
      capturedAt,
    }));
    return {
      rows,
      cursor: page.continueCursor,
      done: page.isDone,
      scanned: page.page.length,
    };
  },
});
export const commitChunk = internalMutation({
  args: {
    jobId: v.id("exportJobs"),
    generation: v.number(),
    checkpoint: v.number(),
    storageId: v.optional(v.id("_storage")),
    rows: v.number(),
    bytes: v.number(),
    sha256: v.string(),
    cursor: v.union(v.string(), v.null()),
    done: v.boolean(),
    scanned: v.number(),
    capturedAt: v.number(),
    totals: v.optional(registerTotalsValidator),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (
      !job ||
      job.generation !== args.generation ||
      job.checkpoint !== args.checkpoint ||
      job.status !== "running"
    )
      return false;
    await requireCreatorStillPermitted(ctx, job);
    if (job.bytes + args.bytes > MAX_EXPORT_BYTES)
      throw new ConvexError(
        `Export exceeds ${MAX_EXPORT_BYTES / 1024 / 1024} MiB. Reduce the filter or selection and create a new export.`,
      );
    if (
      args.done &&
      job.source.kind === "objects" &&
      job.source.mode === "selected" &&
      job.rows + args.rows !== job.selected
    )
      throw new ConvexError("Selected count reconciliation failed");
    if (job.checkpoint >= 10000 || job.chunksCommitted >= 1024)
      throw new ConvexError(
        "Export exceeds processing limits (10,000 pages / 1,024 chunks). Reduce filters or selection.",
      );
    if (args.storageId)
      await ctx.db.insert("exportChunks", {
        jobId: job._id,
        sequence: job.chunksCommitted,
        storageId: args.storageId,
        rows: args.rows,
        bytes: args.bytes,
        sha256: args.sha256,
        capturedAt: args.capturedAt,
      });
    await ctx.db.patch(job._id, {
      checkpoint: job.checkpoint + 1,
      chunksCommitted: job.chunksCommitted + (args.storageId ? 1 : 0),
      rows: job.rows + args.rows,
      scanned: job.scanned + args.scanned,
      bytes: job.bytes + args.bytes,
      cursor: args.cursor,
      sourceDone: args.done,
      finalizeInputCount: args.done
        ? job.chunksCommitted + (args.storageId ? 1 : 0)
        : 0,
      captureCompletedAt: args.done ? Date.now() : undefined,
      leaseUntil: undefined,
      status: args.done ? "finalizing" : "queued",
      totals: args.totals
        ? mergeRegisterTotals(job.totals ?? [], args.totals)
        : job.totals,
    });
    await ctx.scheduler.runAfter(0, internal.exportActions.process, {
      jobId: job._id,
      generation: job.generation,
    });
    return true;
  },
});
export const finalizePage = internalQuery({
  args: { jobId: v.id("exportJobs"), generation: v.number() },
  returns: v.array(
    v.object({
      sequence: v.number(),
      storageId: v.optional(v.id("_storage")),
      rows: v.number(),
      bytes: v.number(),
      sha256: v.string(),
      leafChunks: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (
      !job ||
      job.generation !== args.generation ||
      job.status !== "finalizing"
    )
      throw new ConvexError("Export interrupted");
    await requireCreatorStillPermitted(ctx, job);
    if (job.finalizeLevel === 0)
      return (
        await ctx.db
          .query("exportChunks")
          .withIndex("by_jobId_and_sequence", (q) =>
            q.eq("jobId", job._id).gt("sequence", job.finalizeAfter),
          )
          .take(16)
      ).map(({ sequence, storageId, rows, bytes, sha256 }) => ({
        sequence,
        storageId,
        rows,
        bytes,
        sha256,
        leafChunks: 1,
      }));
    return (
      await ctx.db
        .query("exportParts")
        .withIndex("by_jobId_and_level_and_sequence", (q) =>
          q
            .eq("jobId", job._id)
            .eq("level", job.finalizeLevel)
            .gt("sequence", job.finalizeAfter),
        )
        .take(16)
    ).map(({ sequence, storageId, rows, bytes, sha256, leafChunks }) => ({
      sequence,
      storageId,
      rows,
      bytes,
      sha256,
      leafChunks,
    }));
  },
});
export const complete = internalMutation({
  args: {
    jobId: v.id("exportJobs"),
    generation: v.number(),
    storageId: v.id("_storage"),
    sha256: v.string(),
    bytes: v.number(),
    rows: v.number(),
    chunks: v.number(),
    level: v.number(),
    after: v.number(),
    inputAfter: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (
      !job ||
      job.generation !== args.generation ||
      job.status !== "finalizing"
    )
      return false;
    await requireCreatorStillPermitted(ctx, job);
    if (job.finalizeLevel !== args.level || job.finalizeAfter !== args.after)
      return false;
    if (args.bytes > MAX_EXPORT_BYTES || args.chunks > job.chunksCommitted)
      throw new ConvexError("Artifact reconciliation failed");
    if (args.chunks !== job.chunksCommitted) {
      if (
        args.inputAfter <= job.finalizeAfter ||
        args.inputAfter - job.finalizeAfter > 16 ||
        args.chunks < 1
      )
        throw new ConvexError("Finalization checkpoint mismatch");
      await ctx.db.insert("exportParts", {
        jobId: job._id,
        level: job.finalizeLevel + 1,
        sequence: job.finalizeProduced,
        storageId: args.storageId,
        rows: args.rows,
        bytes: args.bytes,
        sha256: args.sha256,
        leafChunks: args.chunks,
      });
      const nextLevel = args.inputAfter === job.finalizeInputCount - 1;
      await ctx.db.patch(job._id, {
        finalizeLevel: nextLevel ? job.finalizeLevel + 1 : job.finalizeLevel,
        finalizeAfter: nextLevel ? -1 : args.inputAfter,
        finalizeInputCount: nextLevel
          ? job.finalizeProduced + 1
          : job.finalizeInputCount,
        finalizeProduced: nextLevel ? 0 : job.finalizeProduced + 1,
        leaseUntil: undefined,
      });
      await ctx.scheduler.runAfter(0, internal.exportActions.process, {
        jobId: job._id,
        generation: job.generation,
      });
      return true;
    }
    if (
      !job.sourceDone ||
      args.rows !== job.rows ||
      args.bytes !== job.bytes ||
      args.chunks !== job.chunksCommitted
    )
      throw new ConvexError("Artifact reconciliation failed");
    await ctx.db.patch(job._id, {
      status: "completed",
      completedAt: Date.now(),
      storageId: args.storageId,
      sha256: args.sha256,
      leaseUntil: undefined,
    });
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: job.organizationId,
      userId: job.creatorId,
      action: "export.completed",
      entityType: "exportJob",
      entityId: job._id,
      changes: {
        rows: job.rows,
        bytes: job.bytes,
        sha256: args.sha256,
        schemaVersion: job.schemaVersion,
        asOf: job.asOf,
        ...(job.source.kind === "register"
          ? {
              profile: job.source.profile,
              criteria: job.source.criteria,
              effectiveAsOf: job.source.criteria.asOf ?? job.asOf,
              ...(job.totals ? { totals: job.totals } : {}),
            }
          : {}),
      },
    });
    return true;
  },
});
export const fail = internalMutation({
  args: {
    jobId: v.id("exportJobs"),
    generation: v.number(),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (
      job &&
      job.generation === args.generation &&
      !["completed", "cancelled", "expired"].includes(job.status)
    )
      await ctx.db.patch(job._id, {
        status: "failed",
        leaseUntil: undefined,
        error: args.error.slice(0, 500),
        failedAttempts: job.failedAttempts + 1,
      });
    return null;
  },
});
export const downloadAccess = internalQuery({
  args: { jobId: v.string() },
  returns: v.union(exportJobDoc, v.null()),
  handler: async (ctx, args) => {
    const jobId = ctx.db.normalizeId("exportJobs", args.jobId);
    if (!jobId) return null;
    const job = await requireOwnJob(ctx, jobId);
    if (
      job.status !== "completed" ||
      !job.storageId ||
      Date.now() >= job.expiresAt
    )
      throw new ConvexError("Export not downloadable");
    return job;
  },
});

export const manifestChunks = internalQuery({
  args: { jobId: v.id("exportJobs"), after: v.number() },
  returns: v.array(
    v.object({
      sequence: v.number(),
      rows: v.number(),
      bytes: v.number(),
      sha256: v.string(),
      capturedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOwnJob(ctx, args.jobId);
    const chunks = await ctx.db
      .query("exportChunks")
      .withIndex("by_jobId_and_sequence", (q) =>
        q.eq("jobId", args.jobId).gt("sequence", args.after),
      )
      .take(50);
    return chunks.map(({ sequence, rows, bytes, sha256, capturedAt }) => ({
      sequence,
      rows,
      bytes,
      sha256,
      capturedAt,
    }));
  },
});
