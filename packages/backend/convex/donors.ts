import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import {
  assertOptionUsageIndexReady,
  loadOptionUsage,
  optionUsageResultValidator,
  unusedOptionUsage,
} from "./utils/collectionOptionUsages";
import { assertMuseumEvidenceDeletionAllowed } from "./utils/evidenceRetention";
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
      notes: v.optional(v.string()),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
      address: v.optional(v.string()),
      createdBy: v.id("users"),
      createdAt: v.number(),
      usageCount: v.optional(v.number()),
      lastUsedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

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
    notes: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
  },
  returns: v.id("donors"),
  handler: async (ctx, args) => {
    const [userId] = await Promise.all([
      getAuthUserId(ctx),
      requirePermission(ctx, args.organizationId, "collections.create"),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const trimmedName = args.name.trim();
    if (!trimmedName) {
      throw new Error("Donor name is required");
    }

    const trimmedNotes = args.notes?.trim() || undefined;
    const trimmedPhone = args.phone?.trim() || undefined;
    const trimmedEmail = args.email?.trim() || undefined;
    const trimmedAddress = args.address?.trim() || undefined;

    // Check if donor already exists (case-insensitive name or same email)
    const allDonors = await ctx.db
      .query("donors")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const existingByName = allDonors.find(
      (d) => d.name.toLowerCase() === trimmedName.toLowerCase(),
    );

    if (existingByName) {
      throw new Error("A donor with this name already exists");
    }

    if (trimmedEmail) {
      // Validate email format when provided
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        throw new Error("Invalid email address format");
      }

      // Check for duplicate email
      const existingByEmail = allDonors.find(
        (d) => d.email && d.email.toLowerCase() === trimmedEmail.toLowerCase(),
      );

      if (existingByEmail) {
        throw new Error(
          `A donor with this email already exists: ${existingByEmail.name}`,
        );
      }
    }

    const donorId = await ctx.db.insert("donors", {
      organizationId: args.organizationId,
      name: trimmedName,
      notes: trimmedNotes,
      phone: trimmedPhone,
      email: trimmedEmail,
      address: trimmedAddress,
      createdBy: userId,
      createdAt: Date.now(),
      usageCount: 0,
    });

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: args.organizationId,
      userId,
      action: "created_donor",
      entityType: "donor",
      entityId: donorId,
      changes: {
        name: trimmedName,
        notes: trimmedNotes,
        phone: trimmedPhone,
        email: trimmedEmail,
        address: trimmedAddress,
      },
    });

    return donorId;
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
  returns: optionUsageResultValidator,
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx))) {
      throw new Error("Not authenticated");
    }

    const donor = await ctx.db.get(args.donorId);
    if (!donor) {
      return unusedOptionUsage();
    }

    try {
      await requirePermission(ctx, donor.organizationId, "collections.read");
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Permission denied")
      ) {
        return unusedOptionUsage();
      }
      throw error;
    }

    await assertOptionUsageIndexReady(ctx, donor.organizationId);

    return await loadOptionUsage(ctx, {
      organizationId: donor.organizationId,
      kind: "donor",
      value: donor.name,
      excludeCollectionId: args.excludeCollectionId,
    });
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
    const [userId, donor] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.donorId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!donor) {
      throw new Error("Donor not found");
    }
    await Promise.all([
      requirePermission(
        ctx,
        donor.organizationId,
        "organization.manage_settings",
      ),
    ]);
    await assertMuseumEvidenceDeletionAllowed(ctx, donor.organizationId);
    await Promise.all([
      ctx.db.delete(args.donorId),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: donor.organizationId,
        userId,
        action: "deleted_donor",
        entityType: "donor",
        entityId: args.donorId,
        changes: { name: donor.name },
      }),
    ] as const);

    return null;
  },
});
