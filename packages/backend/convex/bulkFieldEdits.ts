import { getAuthUserId } from "@convex-dev/auth/server";
import { type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  type MutationCtx,
  type QueryCtx,
  query,
} from "./_generated/server";
import { runCheckpointPage } from "./utils/boundedJobs";
import {
  BULK_EDIT_ERROR_CODES,
  bulkEditError,
  bulkEditErrorFromError,
} from "./utils/bulkFieldEditErrors";
import {
  applyBulkEdit,
  BULK_EDIT_MAX_SELECTION,
  BULK_EDIT_STALE_AFTER_MS,
  type BulkEdit,
  bulkEditValidator,
  overwritesValue,
  validateBulkEdit,
} from "./utils/bulkFieldEdits";
import { catalogFiltersValidator } from "./utils/catalogFilterValidators";
import { listCatalogPage } from "./utils/catalogListing";
import { syncCollectionOptionUsages } from "./utils/collectionOptionUsages";
import { internalMutation, mutation } from "./utils/mutationBuilders";
import { requirePermission } from "./utils/permissions";

/** Objects written per page; each write also updates its search document and audit entry. */
const PAGE_SIZE = 25;
/** Rows a preview reads for a filtered scope before it reports a lower bound. */
const PREVIEW_ROWS = 1000;

const EDIT_PERMISSION = "collections.update";

const scopeValidator = v.union(
  v.object({
    kind: v.literal("selection"),
    collectionIds: v.array(v.id("collections")),
  }),
  v.object({ kind: v.literal("filters"), filters: catalogFiltersValidator }),
);

const statusValidator = v.union(
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("cancelled"),
);

const editViewValidator = v.object({
  _id: v.id("bulkFieldEdits"),
  status: statusValidator,
  edit: bulkEditValidator,
  scope: v.union(
    v.object({ kind: v.literal("selection"), count: v.number() }),
    v.object({ kind: v.literal("filters") }),
  ),
  checked: v.number(),
  changed: v.number(),
  skipped: v.number(),
  failure: v.optional(v.string()),
  startedAt: v.number(),
  updatedAt: v.number(),
  finishedAt: v.optional(v.number()),
});

function editView(job: Doc<"bulkFieldEdits">) {
  return {
    _id: job._id,
    status: job.status,
    edit: job.edit as BulkEdit,
    scope:
      job.scope.kind === "selection"
        ? { kind: "selection" as const, count: job.scope.collectionIds.length }
        : { kind: "filters" as const },
    checked: job.checked,
    changed: job.changed,
    skipped: job.skipped,
    failure: job.failure,
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
    finishedAt: job.finishedAt,
  };
}

async function requireEditor(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  await requirePermission(ctx, organizationId, EDIT_PERMISSION);
  return userId;
}

/** The Objects a selection names, refusing one outside the Organization. */
async function loadSelection(
  ctx: Pick<QueryCtx, "db">,
  organizationId: Id<"organizations">,
  collectionIds: Id<"collections">[],
) {
  const unique = [...new Set(collectionIds)];
  if (unique.length === 0)
    throw bulkEditError("SELECTION_EMPTY", "Select at least one Object");
  if (unique.length > BULK_EDIT_MAX_SELECTION)
    throw bulkEditError(
      "SELECTION_TOO_LARGE",
      `A selection holds at most ${BULK_EDIT_MAX_SELECTION} Objects; filter the catalog instead`,
    );
  const rows = await Promise.all(unique.map((id) => ctx.db.get(id)));
  const own = rows.filter(
    (row): row is Doc<"collections"> =>
      row !== null && row.organizationId === organizationId,
  );
  if (own.length !== unique.length)
    throw bulkEditError(
      "SELECTION_OUTSIDE_ORGANIZATION",
      "A selected Object is missing or belongs to another Organization",
    );
  return own;
}

/**
 * What the edit would do: how many Objects match, how many change and how
 * many already hold a value the edit writes over. A filtered scope is
 * previewed over its newest catalog page; `capped` says more rows follow, so
 * the counts are a lower bound and the edit may change more.
 * An edit `start` would refuse comes back as its code rather than thrown,
 * so the dialog explains it in place.
 */
export const preview = query({
  args: {
    organizationId: v.id("organizations"),
    scope: scopeValidator,
    edit: bulkEditValidator,
  },
  returns: v.union(
    v.object({
      kind: v.literal("preview"),
      matching: v.number(),
      changing: v.number(),
      overwriting: v.number(),
      capped: v.boolean(),
    }),
    v.object({
      kind: v.literal("refused"),
      code: v.union(...BULK_EDIT_ERROR_CODES.map((code) => v.literal(code))),
    }),
  ),
  handler: async (ctx, args) => {
    await requireEditor(ctx, args.organizationId);
    try {
      return { kind: "preview" as const, ...(await previewEdit(ctx, args)) };
    } catch (error) {
      const refusal = bulkEditErrorFromError(error);
      if (refusal) return { kind: "refused" as const, code: refusal.code };
      throw error;
    }
  },
});

async function previewEdit(
  ctx: QueryCtx,
  args: {
    organizationId: Id<"organizations">;
    scope: Infer<typeof scopeValidator>;
    edit: BulkEdit;
  },
) {
  validateBulkEdit(args.edit);
  let rows: Doc<"collections">[];
  let capped = false;
  if (args.scope.kind === "selection") {
    rows = await loadSelection(
      ctx,
      args.organizationId,
      args.scope.collectionIds,
    );
  } else {
    // One page only: Convex allows a single built-in .paginate() per query
    // or mutation, which convex-test does not enforce.
    const page = await listCatalogPage(
      ctx,
      { ...args.scope.filters, organizationId: args.organizationId },
      { numItems: PREVIEW_ROWS, cursor: null },
      { stableOrder: true },
    );
    rows = page.page;
    capped = !page.isDone;
  }
  let changing = 0;
  let overwriting = 0;
  for (const row of rows) {
    const outcome = applyBulkEdit(row, args.edit);
    if (outcome.changed) changing += 1;
    if (overwritesValue(outcome)) overwriting += 1;
  }
  return { matching: rows.length, changing, overwriting, capped };
}

async function scheduleEditPage(
  ctx: MutationCtx,
  jobId: Id<"bulkFieldEdits">,
  expectedCheckpoint: number,
) {
  await ctx.scheduler.runAfter(0, internal.bulkFieldEdits.advance, {
    jobId,
    expectedCheckpoint,
  });
}

/**
 * Starts an edit over a selection or over every Object matching the catalog
 * filters. Pages run in the background; one edit runs at a time per Organization.
 */
export const start = mutation({
  args: {
    organizationId: v.id("organizations"),
    scope: scopeValidator,
    edit: bulkEditValidator,
  },
  returns: v.id("bulkFieldEdits"),
  handler: async (ctx, args) => {
    const userId = await requireEditor(ctx, args.organizationId);
    validateBulkEdit(args.edit);
    if (args.scope.kind === "selection") {
      await loadSelection(ctx, args.organizationId, args.scope.collectionIds);
    }
    const running = await ctx.db
      .query("bulkFieldEdits")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "running"),
      )
      .first();
    if (running)
      throw bulkEditError(
        "EDIT_RUNNING",
        "A bulk edit is already running; wait for it or cancel it",
      );
    const now = Date.now();
    const jobId = await ctx.db.insert("bulkFieldEdits", {
      organizationId: args.organizationId,
      requestedBy: userId,
      status: "running",
      scope:
        args.scope.kind === "selection"
          ? {
              kind: "selection",
              collectionIds: [...new Set(args.scope.collectionIds)],
            }
          : args.scope,
      edit: args.edit,
      cursor: null,
      position: 0,
      checkpoint: 0,
      attempts: 1,
      checked: 0,
      changed: 0,
      skipped: 0,
      startedAt: now,
      updatedAt: now,
    });
    await scheduleEditPage(ctx, jobId, 0);
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "bulk_field_edit_started",
      entityType: "bulkFieldEdit",
      entityId: jobId,
      changes: {
        field: args.edit.field,
        operation: args.edit.operation,
        scope: args.scope.kind,
        ...(args.scope.kind === "selection"
          ? { count: args.scope.collectionIds.length }
          : {}),
      },
    });
    return jobId;
  },
});

async function loadJob(ctx: MutationCtx, jobId: Id<"bulkFieldEdits">) {
  const job = await ctx.db.get(jobId);
  if (!job) throw bulkEditError("EDIT_NOT_FOUND", "Bulk edit not found");
  const userId = await requireEditor(ctx, job.organizationId);
  return { job, userId };
}

/** Stops an edit after its current page; Objects already changed stay changed. */
export const cancel = mutation({
  args: { jobId: v.id("bulkFieldEdits") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { job, userId } = await loadJob(ctx, args.jobId);
    if (job.status !== "running" && job.status !== "failed") return null;
    const now = Date.now();
    await ctx.db.patch(job._id, {
      status: "cancelled",
      cancelledBy: userId,
      finishedAt: now,
      updatedAt: now,
    });
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: job.organizationId,
      userId,
      action: "bulk_field_edit_cancelled",
      entityType: "bulkFieldEdit",
      entityId: job._id,
      changes: { checked: job.checked, changed: job.changed },
    });
    return null;
  },
});

/** Continues a failed edit, or a running one that stopped reporting, from its last page. */
export const resume = mutation({
  args: { jobId: v.id("bulkFieldEdits") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { job, userId } = await loadJob(ctx, args.jobId);
    const now = Date.now();
    const stalled =
      job.status === "running" &&
      job.updatedAt < now - BULK_EDIT_STALE_AFTER_MS;
    if (job.status !== "failed" && !stalled)
      throw bulkEditError(
        "EDIT_NOT_RESUMABLE",
        "Only a failed or stalled bulk edit can be resumed",
      );
    // A failed edit waits while another one runs: one at a time per Organization.
    if (job.status === "failed") {
      const running = await ctx.db
        .query("bulkFieldEdits")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", job.organizationId).eq("status", "running"),
        )
        .first();
      if (running)
        throw bulkEditError(
          "EDIT_RUNNING",
          "A bulk edit is already running; wait for it or cancel it",
        );
    }
    await ctx.db.patch(job._id, {
      status: "running",
      attempts: job.attempts + 1,
      failure: undefined,
      finishedAt: undefined,
      updatedAt: now,
    });
    await scheduleEditPage(ctx, job._id, job.checkpoint);
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: job.organizationId,
      userId,
      action: "bulk_field_edit_resumed",
      entityType: "bulkFieldEdit",
      entityId: job._id,
      changes: { checkpoint: job.checkpoint },
    });
    return null;
  },
});

/** Fields of `collections` whose values the option lists count. */
const OPTION_USAGE_FIELDS: ReadonlyArray<BulkEdit["field"]> = [
  "objectType",
  "materials",
];

/** Writes one page: the next Objects of the scope, each changed one audited. */
async function applyEditPage(
  ctx: MutationCtx,
  jobId: Id<"bulkFieldEdits">,
  expectedCheckpoint: number,
  pageSize: number,
): Promise<"noop" | "continue" | "done"> {
  const job = await ctx.db.get(jobId);
  if (!job || job.status !== "running" || job.checkpoint !== expectedCheckpoint)
    return "noop";

  let rows: Doc<"collections">[];
  let isDone: boolean;
  let next: { cursor: string | null; position: number };
  if (job.scope.kind === "selection") {
    const ids = job.scope.collectionIds.slice(
      job.position,
      job.position + pageSize,
    );
    const loaded = await Promise.all(ids.map((id) => ctx.db.get(id)));
    rows = loaded.filter(
      (row): row is Doc<"collections"> =>
        row !== null && row.organizationId === job.organizationId,
    );
    const position = job.position + ids.length;
    isDone = position >= job.scope.collectionIds.length;
    next = { cursor: null, position };
  } else {
    const page = await listCatalogPage(
      ctx,
      { ...job.scope.filters, organizationId: job.organizationId },
      { numItems: pageSize, cursor: job.cursor },
      { stableOrder: true },
    );
    rows = page.page;
    isDone = page.isDone;
    next = { cursor: page.continueCursor, position: job.position };
  }

  const edit = job.edit as BulkEdit;
  let changed = 0;
  let skipped = 0;
  const now = Date.now();
  for (const row of rows) {
    const outcome = applyBulkEdit(row, edit);
    if (outcome.skipped) {
      skipped += 1;
      continue;
    }
    if (!outcome.changed) continue;
    await ctx.db.patch(row._id, {
      [edit.field]: outcome.after,
      lastModifiedBy: job.requestedBy,
      lastModifiedAt: now,
    });
    if (OPTION_USAGE_FIELDS.includes(edit.field)) {
      await syncCollectionOptionUsages(ctx, row._id);
    }
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: job.organizationId,
      userId: job.requestedBy,
      action: "updated_collection",
      entityType: "collection",
      entityId: row._id,
      // The field, previous and new shape the Object's history shows.
      changes: {
        field: edit.field,
        ...(outcome.before !== undefined ? { previous: outcome.before } : {}),
        ...(outcome.after !== undefined ? { new: outcome.after } : {}),
        bulkFieldEditId: job._id,
      },
    });
    changed += 1;
  }

  await ctx.db.patch(job._id, {
    ...next,
    checkpoint: job.checkpoint + 1,
    checked: job.checked + rows.length,
    changed: job.changed + changed,
    skipped: job.skipped + skipped,
    updatedAt: now,
    ...(isDone ? { status: "completed" as const, finishedAt: now } : {}),
  });
  if (!isDone) await scheduleEditPage(ctx, job._id, job.checkpoint + 1);
  return isDone ? "done" : "continue";
}

export const applyPage = internalMutation({
  args: {
    jobId: v.id("bulkFieldEdits"),
    expectedCheckpoint: v.number(),
    pageSize: v.number(),
  },
  returns: v.union(v.literal("noop"), v.literal("continue"), v.literal("done")),
  handler: async (ctx, args) =>
    await applyEditPage(
      ctx,
      args.jobId,
      args.expectedCheckpoint,
      args.pageSize,
    ),
});

export const markPageFailed = internalMutation({
  args: {
    jobId: v.id("bulkFieldEdits"),
    expectedCheckpoint: v.number(),
    failure: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (
      !job ||
      job.status !== "running" ||
      job.checkpoint !== args.expectedCheckpoint
    )
      return null;
    const now = Date.now();
    await ctx.db.patch(job._id, {
      status: "failed",
      failure: args.failure,
      finishedAt: now,
      updatedAt: now,
    });
    return null;
  },
});

/** Runs one checkpoint page (see `runCheckpointPage`). */
export const advance = internalAction({
  args: {
    jobId: v.id("bulkFieldEdits"),
    expectedCheckpoint: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runCheckpointPage({
      pageSize: PAGE_SIZE,
      apply: (pageSize) =>
        ctx.runMutation(internal.bulkFieldEdits.applyPage, {
          ...args,
          pageSize,
        }),
      fail: (failure) =>
        ctx.runMutation(internal.bulkFieldEdits.markPageFailed, {
          ...args,
          failure,
        }),
    });
    return null;
  },
});

export const get = query({
  args: { jobId: v.id("bulkFieldEdits") },
  returns: v.union(editViewValidator, v.null()),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;
    await requirePermission(ctx, job.organizationId, "collections.read");
    return editView(job);
  },
});

/** The Organization's most recent edit, for the catalog's progress notice. */
export const latest = query({
  args: { organizationId: v.id("organizations") },
  returns: v.union(editViewValidator, v.null()),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");
    const job = await ctx.db
      .query("bulkFieldEdits")
      .withIndex("by_organization_and_startedAt", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .first();
    return job ? editView(job) : null;
  },
});
