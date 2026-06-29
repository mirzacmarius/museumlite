import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireLibraryPermission } from "./utils/permissions";

// Copy status validator
const _copyStatusValidator = v.union(
  v.literal("available"),
  v.literal("checked_out"),
  v.literal("on_hold"),
  v.literal("in_transit"),
  v.literal("processing"),
  v.literal("repair"),
  v.literal("lost"),
  v.literal("missing"),
  v.literal("damaged"),
  v.literal("withdrawn"),
);

// Condition validator
const conditionValidator = v.union(
  v.literal("new"),
  v.literal("excellent"),
  v.literal("good"),
  v.literal("fair"),
  v.literal("poor"),
);

/**
 * Create a new copy of a library item
 */
export const create = mutation({
  args: {
    itemId: v.id("libraryItems"),
    barcode: v.string(),
    locationId: v.optional(v.id("locations")),
    shelfLocation: v.optional(v.string()),
    condition: conditionValidator,
    conditionNotes: v.optional(v.string()),
    acquisitionDate: v.optional(v.number()),
    acquisitionMethod: v.optional(v.string()),
    acquisitionPrice: v.optional(v.number()),
    vendor: v.optional(v.string()),
    replacementCost: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.id("itemCopies"),
  handler: async (ctx, args) => {
    const [userId, item] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.itemId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!item) {
      throw new Error("Library item not found");
    }

    await requireLibraryPermission(ctx, item.organizationId, "collections.create");

    // Check if barcode is unique within organization
    const existingCopy = await ctx.db
      .query("itemCopies")
      .withIndex("by_organization_and_barcode", (q) =>
        q.eq("organizationId", item.organizationId).eq("barcode", args.barcode),
      )
      .first();

    if (existingCopy) {
      throw new Error("A copy with this barcode already exists");
    }

    // Get next copy number
    const existingCopies = await ctx.db
      .query("itemCopies")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .collect();

    const maxCopyNumber = existingCopies.reduce(
      (max, c) => Math.max(max, c.copyNumber),
      0,
    );

    const copyId = await ctx.db.insert("itemCopies", {
      organizationId: item.organizationId,
      itemId: args.itemId,
      copyNumber: maxCopyNumber + 1,
      barcode: args.barcode,
      locationId: args.locationId,
      shelfLocation: args.shelfLocation,
      status: "available",
      condition: args.condition,
      conditionNotes: args.conditionNotes,
      acquisitionDate: args.acquisitionDate,
      acquisitionMethod: args.acquisitionMethod,
      acquisitionPrice: args.acquisitionPrice,
      vendor: args.vendor,
      replacementCost: args.replacementCost,
      notes: args.notes,
      createdAt: Date.now(),
    });

    // Update item copy counts
    await ctx.db.patch(args.itemId, {
      totalCopies: item.totalCopies + 1,
      availableCopies: item.availableCopies + 1,
      lastModifiedBy: userId,
      lastModifiedAt: Date.now(),
    });

    return copyId;
  },
});

/**
 * Get a copy by ID
 */
export const get = query({
  args: {
    copyId: v.id("itemCopies"),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const copy = await ctx.db.get(args.copyId);
    if (!copy) {
      return null;
    }

    await requireLibraryPermission(ctx, copy.organizationId, "collections.read");

    // Get the parent item
    const item = await ctx.db.get(copy.itemId);

    // Get location if set
    const location = copy.locationId ? await ctx.db.get(copy.locationId) : null;

    return {
      ...copy,
      item,
      location,
    };
  },
});

/**
 * List copies for a library item
 */
export const listByItem = query({
  args: {
    itemId: v.id("libraryItems"),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new Error("Library item not found");
    }

    await requireLibraryPermission(ctx, item.organizationId, "collections.read");

    const copies = await ctx.db
      .query("itemCopies")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .collect();

    // Get locations for all copies
    const copiesWithLocations = await Promise.all(
      copies.map(async (copy) => {
        const location = copy.locationId
          ? await ctx.db.get(copy.locationId)
          : null;
        return {
          ...copy,
          location,
        };
      }),
    );

    // Sort by copy number
    copiesWithLocations.sort((a, b) => a.copyNumber - b.copyNumber);

    return copiesWithLocations;
  },
});

/**
 * Get a copy by barcode
 */
export const getByBarcode = query({
  args: {
    organizationId: v.id("organizations"),
    barcode: v.string(),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    await requireLibraryPermission(ctx, args.organizationId, "collections.read");
    const copy = await ctx.db
      .query("itemCopies")
      .withIndex("by_organization_and_barcode", (q) =>
        q.eq("organizationId", args.organizationId).eq("barcode", args.barcode),
      )
      .first();

    if (!copy) {
      return null;
    }

    // Get the parent item
    const item = await ctx.db.get(copy.itemId);

    // Get location if set
    const location = copy.locationId ? await ctx.db.get(copy.locationId) : null;

    return {
      ...copy,
      item,
      location,
    };
  },
});

/**
 * Update a copy
 */
export const update = mutation({
  args: {
    copyId: v.id("itemCopies"),
    barcode: v.optional(v.string()),
    locationId: v.optional(v.id("locations")),
    shelfLocation: v.optional(v.string()),
    condition: v.optional(conditionValidator),
    conditionNotes: v.optional(v.string()),
    acquisitionDate: v.optional(v.number()),
    acquisitionMethod: v.optional(v.string()),
    acquisitionPrice: v.optional(v.number()),
    vendor: v.optional(v.string()),
    replacementCost: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, copy] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.copyId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!copy) {
      throw new Error("Copy not found");
    }

    await requireLibraryPermission(ctx, copy.organizationId, "collections.update");

    // Check for active circulations

    const activeCirculation = await ctx.db
      .query("circulations")
      .withIndex("by_copy", (q) => q.eq("copyId", args.copyId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    if (activeCirculation) {
      throw new Error("Cannot delete copy that is currently checked out");
    }

    // Update item copy counts
    const item = await ctx.db.get(copy.itemId);
    if (item) {
      const updates: Record<string, number> = {
        totalCopies: Math.max(0, item.totalCopies - 1),
      };

      if (copy.status === "available") {
        updates.availableCopies = Math.max(0, item.availableCopies - 1);
      }

      await ctx.db.patch(copy.itemId, updates);
    }

    await ctx.db.delete(args.copyId);

    return null;
  },
});

/**
 * Mark copy as lost
 */
export const markLost = mutation({
  args: {
    copyId: v.id("itemCopies"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, copy] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.copyId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!copy) {
      throw new Error("Copy not found");
    }

    await requireLibraryPermission(ctx, copy.organizationId, "collections.update");

    const wasAvailable = copy.status === "available";

    await ctx.db.patch(args.copyId, { status: "lost" });

    // Update item available copies if needed
    if (wasAvailable) {
      const item = await ctx.db.get(copy.itemId);
      if (item) {
        await ctx.db.patch(copy.itemId, {
          availableCopies: Math.max(0, item.availableCopies - 1),
        });
      }
    }

    return null;
  },
});

/**
 * Mark copy as withdrawn
 */
export const withdraw = mutation({
  args: {
    copyId: v.id("itemCopies"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, copy] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.copyId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!copy) {
      throw new Error("Copy not found");
    }

    await requireLibraryPermission(ctx, copy.organizationId, "collections.update");

    // Check for active circulations
    const activeCirculation = await ctx.db
      .query("circulations")
      .withIndex("by_copy", (q) => q.eq("copyId", args.copyId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    if (activeCirculation) {
      throw new Error("Cannot withdraw copy that is currently checked out");
    }

    const wasAvailable = copy.status === "available";

    await ctx.db.patch(args.copyId, { status: "withdrawn" });

    // Update item counts
    const item = await ctx.db.get(copy.itemId);
    if (item) {
      const updates: Record<string, number> = {
        totalCopies: Math.max(0, item.totalCopies - 1),
      };
      if (wasAvailable) {
        updates.availableCopies = Math.max(0, item.availableCopies - 1);
      }
      await ctx.db.patch(copy.itemId, updates);
    }

    return null;
  },
});

/**
 * Remove (delete) a copy permanently
 */
export const remove = mutation({
  args: {
    copyId: v.id("itemCopies"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, copy] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.copyId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!copy) {
      throw new Error("Copy not found");
    }

    await requireLibraryPermission(ctx, copy.organizationId, "collections.delete");

    // Check for active circulations
    const activeCirculation = await ctx.db
      .query("circulations")
      .withIndex("by_copy", (q) => q.eq("copyId", args.copyId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    if (activeCirculation) {
      throw new Error("Cannot delete copy that is currently checked out");
    }

    const wasAvailable = copy.status === "available";

    // Update item counts before deletion
    const item = await ctx.db.get(copy.itemId);
    if (item) {
      const updates: Record<string, number> = {
        totalCopies: Math.max(0, item.totalCopies - 1),
      };
      if (wasAvailable) {
        updates.availableCopies = Math.max(0, item.availableCopies - 1);
      }
      await ctx.db.patch(copy.itemId, updates);
    }

    // Delete the copy
    await ctx.db.delete(args.copyId);

    return null;
  },
});

/**
 * Generate a unique barcode for a new copy
 */
export const generateBarcode = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    await requireLibraryPermission(ctx, args.organizationId, "collections.read");
    const settings = await ctx.db
      .query("librarySettings")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .first();

    const prefix = settings?.cardNumberPrefix || "LIB";

    const copies = await ctx.db
      .query("itemCopies")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    let maxNumber = 0;
    for (const copy of copies) {
      if (copy.barcode.startsWith(prefix)) {
        const numPart = copy.barcode.slice(prefix.length);
        const num = Number.parseInt(numPart, 10);
        if (!Number.isNaN(num) && num > maxNumber) {
          maxNumber = num;
        }
      }
    }

    const nextNumber = maxNumber + 1;
    const paddedNumber = nextNumber.toString().padStart(8, "0");

    return `${prefix}${paddedNumber}`;
  },
});
