import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requirePermission } from "./utils/permissions";

/**
 * List all donors for an organization
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("donors"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      name: v.string(),
      email: v.string(),
      createdBy: v.id("users"),
      createdAt: v.number(),
      usageCount: v.optional(v.number()),
      lastUsedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("donors")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .collect();
  },
});

/**
 * Create a new donor
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    email: v.string(),
  },
  returns: v.id("donors"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await requirePermission(
      ctx,
      args.organizationId,
      "collections.create",
    );

    // Check if donor already exists (case-insensitive name or same email)
    const allDonors = await ctx.db
      .query("donors")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const existingByName = allDonors.find(
      (d) => d.name.toLowerCase() === args.name.toLowerCase(),
    );

    if (existingByName) {
      throw new Error("A donor with this name already exists");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.email)) {
      throw new Error("Invalid email address format");
    }

    // Check for duplicate email
    const existingByEmail = allDonors.find(
      (d) => d.email && d.email.toLowerCase() === args.email.toLowerCase(),
    );

    if (existingByEmail) {
      throw new Error(
        `A donor with this email already exists: ${existingByEmail.name}`,
      );
    }

    return await ctx.db.insert("donors", {
      organizationId: args.organizationId,
      name: args.name,
      email: args.email,
      createdBy: userId,
      createdAt: Date.now(),
      usageCount: 0,
    });
  },
});

/**
 * Check if a donor is being used in any collections
 * Optionally exclude a specific collection (e.g., when editing that collection)
 */
export const checkUsage = query({
  args: {
    donorId: v.id("donors"),
    excludeCollectionId: v.optional(v.id("collections")),
  },
  returns: v.object({
    isUsed: v.boolean(),
    usageCount: v.number(),
    collectionNames: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const donor = await ctx.db.get(args.donorId);
    if (!donor) {
      return { isUsed: false, usageCount: 0, collectionNames: [] };
    }

    // Check all collections in the organization for this donor
    const collections = await ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", donor.organizationId),
      )
      .collect();

    // Filter collections that use this donor (excluding the specified collection if provided)
    const collectionsUsingDonor = collections.filter((collection) => {
      // Exclude the current collection being edited
      if (
        args.excludeCollectionId &&
        collection._id === args.excludeCollectionId
      ) {
        return false;
      }

      if (!collection.donated_by) return false;

      return collection.donated_by.includes(donor.name);
    });

    return {
      isUsed: collectionsUsingDonor.length > 0,
      usageCount: collectionsUsingDonor.length,
      collectionNames: collectionsUsingDonor.map((c) => c.accessionNumber),
    };
  },
});

/**
 * Delete a donor
 */
export const remove = mutation({
  args: {
    donorId: v.id("donors"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const donor = await ctx.db.get(args.donorId);
    if (!donor) {
      throw new Error("Donor not found");
    }

    await requirePermission(
      ctx,
      donor.organizationId,
      "organization.manage_settings",
    );

    await ctx.db.delete(args.donorId);
    return null;
  },
});

/**
 * Increment usage counter for a donor
 */
export const incrementUsage = mutation({
  args: {
    donorId: v.id("donors"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const donor = await ctx.db.get(args.donorId);
    if (!donor) {
      return null;
    }

    await ctx.db.patch(args.donorId, {
      usageCount: (donor.usageCount ?? 0) + 1,
      lastUsedAt: Date.now(),
    });

    return null;
  },
});
