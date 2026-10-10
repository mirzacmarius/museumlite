import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { identifierError } from "./utils/identifierErrors";
import {
  ensureIdentifierAvailable,
  findIdentifierMatches,
  normalizeIdentifier,
  recordIdentifierConflictReview,
} from "./utils/identifiers";
import { mutation } from "./utils/mutationBuilders";
import { requirePermission } from "./utils/permissions";

const registerValidator = v.union(v.literal("catalog"), v.literal("accession"));
const recordIdValidator = v.union(v.id("collections"), v.id("accessions"));
const matchValidator = v.object({
  _id: recordIdValidator,
  identifier: v.string(),
});
const reviewValidator = v.object({
  note: v.string(),
  reviewedAt: v.number(),
  reviewedBy: v.id("users"),
});

export const inspect = query({
  args: {
    organizationId: v.id("organizations"),
    register: registerValidator,
    identifier: v.string(),
  },
  returns: v.object({
    matches: v.array(matchValidator),
    needsBackfill: v.boolean(),
    truncated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");
    const result = await findIdentifierMatches(
      ctx,
      args.organizationId,
      args.register,
      args.identifier,
    );
    return {
      ...result,
      matches: result.matches.map((row) => ({
        _id: row._id,
        identifier: row.accessionNumber,
      })),
    };
  },
});

export const indexLegacyBatch = mutation({
  args: { organizationId: v.id("organizations"), register: registerValidator },
  returns: v.object({ processed: v.number(), hasMore: v.boolean() }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.update");
    const table = args.register === "catalog" ? "collections" : "accessions";
    const rows = await ctx.db
      .query(table)
      .withIndex("by_organization_and_normalizedIdentifier", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("normalizedIdentifier", undefined),
      )
      .take(11);
    for (const row of rows.slice(0, 10)) {
      await ctx.db.patch(row._id, {
        normalizedIdentifier: normalizeIdentifier(row.accessionNumber),
      });
    }
    return { processed: Math.min(rows.length, 10), hasMore: rows.length > 10 };
  },
});

export const listConflicts = query({
  args: {
    organizationId: v.id("organizations"),
    register: registerValidator,
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: recordIdValidator,
        identifier: v.string(),
        normalizedIdentifier: v.string(),
        matches: v.array(matchValidator),
        truncated: v.boolean(),
        review: v.union(reviewValidator, v.null()),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
    needsBackfill: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");
    const table = args.register === "catalog" ? "collections" : "accessions";
    const rows = await ctx.db
      .query(table)
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(10, Math.max(1, args.paginationOpts.numItems)),
      });
    const page: {
      _id: Id<"collections"> | Id<"accessions">;
      identifier: string;
      normalizedIdentifier: string;
      matches: {
        _id: Id<"collections"> | Id<"accessions">;
        identifier: string;
      }[];
      truncated: boolean;
      review: {
        note: string;
        reviewedAt: number;
        reviewedBy: Id<"users">;
      } | null;
    }[] = [];
    for (const row of rows.page) {
      if (row.normalizedIdentifier === undefined) continue;
      const matches = await ctx.db
        .query(table)
        .withIndex("by_organization_and_normalizedIdentifier", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("normalizedIdentifier", row.normalizedIdentifier),
        )
        .take(11);
      if (matches.length < 2) continue;
      const review = await ctx.db
        .query("identifierConflictReviews")
        .withIndex("by_organization_and_register_and_record", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("register", args.register)
            .eq("recordId", row._id),
        )
        .order("desc")
        .first();
      page.push({
        _id: row._id,
        identifier: row.accessionNumber,
        normalizedIdentifier: row.normalizedIdentifier,
        matches: matches.slice(0, 10).map((match) => ({
          _id: match._id,
          identifier: match.accessionNumber,
        })),
        truncated: matches.length > 10,
        review: review
          ? {
              note: review.note,
              reviewedAt: review.reviewedAt,
              reviewedBy: review.reviewedBy,
            }
          : null,
      });
    }
    const unindexed = await ctx.db
      .query(table)
      .withIndex("by_organization_and_normalizedIdentifier", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("normalizedIdentifier", undefined),
      )
      .first();
    return {
      page,
      isDone: rows.isDone,
      continueCursor: rows.continueCursor,
      needsBackfill: unindexed !== null,
    };
  },
});

export const reviewConflict = mutation({
  args: {
    organizationId: v.id("organizations"),
    register: registerValidator,
    recordId: recordIdValidator,
    note: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.update");
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");
    const table = args.register === "catalog" ? "collections" : "accessions";
    if (!ctx.db.normalizeId(table, args.recordId))
      throw new ConvexError("Record does not belong to this register");
    const row = await ctx.db.get(args.recordId);
    if (!row || row.organizationId !== args.organizationId)
      throw new ConvexError("Record not found");
    const note = args.note.trim();
    if (!note || note.length > 2000)
      throw new ConvexError(
        "Provide a review note of 1–2000 characters describing the historical evidence.",
      );
    const { matches, needsBackfill } = await findIdentifierMatches(
      ctx,
      args.organizationId,
      args.register,
      row.accessionNumber,
    );
    if (needsBackfill)
      throw new ConvexError(
        "Complete the identifier index before recording conflict review.",
      );
    if (matches.length < 2)
      throw new ConvexError("No identifier conflict exists for this record.");
    await recordIdentifierConflictReview(ctx, {
      organizationId: args.organizationId,
      register: args.register,
      record: row,
      note,
      userId,
    });
    return null;
  },
});

export const assignCatalogIdentifier = mutation({
  args: { accessionId: v.id("accessions"), identifier: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const accession = await ctx.db.get(args.accessionId);
    if (!accession) throw new ConvexError("Accession not found");
    await requirePermission(
      ctx,
      accession.organizationId,
      "collections.update",
    );
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");
    if (accession.status !== "pending" || accession.collectionId)
      throw identifierError(
        "CATALOG_NUMBER_LOCKED",
        "Only an unpublished pending accession can select a catalog identifier. Published register numbers are permanent.",
        { register: "catalog" },
      );
    await ensureIdentifierAvailable(
      ctx,
      accession.organizationId,
      "catalog",
      args.identifier,
    );
    await ctx.db.patch(accession._id, { catalogIdentifier: args.identifier });
    await ctx.runMutation(internal.audit.logAction, {
      organizationId: accession.organizationId,
      userId,
      action: "selected_catalog_identifier",
      entityType: "accession",
      entityId: accession._id,
      changes: {
        accessionNumber: accession.accessionNumber,
        previousCatalogIdentifier:
          accession.catalogIdentifier ?? accession.accessionNumber,
        catalogIdentifier: args.identifier,
      },
    });
    return null;
  },
});
