import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";

// Tables to clear - hardcoded list (NOT using TableNames to avoid as any)
// These are verified to exist in schema.ts
const TABLES_TO_CLEAR = [
  "auditLog",
  "notifications",
  "conditionReports",
  "loanItems",
  "loanDocuments",
  "loans",
  "deaccessions",
  "accessions",
  "mediaFiles",
  "locationHistory",
  "collectionGroupItems",
  "collections",
  "collectionGroups",
  "locations",
  "userOrganizations",
  "rolePermissions",
  "roles",
  "organizations",
  "conservationTreatments",
  "exhibitions",
] as const;

/**
 * Clear all application data (preserves users and auth tables)
 */
export const clearAllData = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Clear application tables (NOT users, NOT auth tables)
    for (const tableName of TABLES_TO_CLEAR) {
      try {
        // biome-ignore lint/suspicious/noExplicitAny: required for dynamic table iteration (matches seedFresh.ts pattern)
        const docs = await ctx.db.query(tableName as any).collect();
        for (const doc of docs) {
          await ctx.db.delete(doc._id);
        }
        console.log(`Cleared ${docs.length} records from ${tableName}`);
      } catch (error) {
        console.log(`Skipping ${tableName}: ${error}`);
      }
    }
    // Clear storage
    const storageFiles = await ctx.db.system.query("_storage").collect();
    for (const file of storageFiles) {
      await ctx.storage.delete(file._id);
    }
    console.log(`Cleared ${storageFiles.length} storage files`);
    return null;
  },
});

/**
 * Find user by email
 */
export const findUserByEmail = internalQuery({
  args: {
    email: v.string(),
  },
  returns: v.union(v.id("users"), v.null()),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();
    return user?._id ?? null;
  },
});

/**
 * Create organization
 */
export const createOrganization = internalMutation({
  args: {
    name: v.string(),
    slug: v.string(),
    type: v.union(
      v.literal("museum"),
      v.literal("gallery"),
      v.literal("library"),
      v.literal("collector"),
    ),
    subscriptionTier: v.union(
      v.literal("free"),
      v.literal("pro"),
      v.literal("enterprise"),
    ),
  },
  returns: v.id("organizations"),
  handler: async (ctx, args) => {
    const orgId = await ctx.db.insert("organizations", {
      name: args.name,
      slug: args.slug,
      type: args.type,
      subscriptionTier: args.subscriptionTier,
      settings: {
        autoGenerateAccessionNumbers: true,
        accessionNumberFormat: `${args.slug.toUpperCase().substring(0, 3)}-YYYY-###`,
      },
    });

    // Create default roles using the existing helper
    await ctx.runMutation(internal.organizations.createDefaultRoles, {
      organizationId: orgId,
    });

    return orgId;
  },
});

/**
 * Assign user to organization
 */
export const assignUserToOrg = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Check if already assigned
    const existing = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user_and_organization", (q) =>
        q.eq("userId", args.userId).eq("organizationId", args.organizationId),
      )
      .first();

    if (existing) {
      return null;
    }

    // Find admin role
    const role = await ctx.db
      .query("roles")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("name"), "admin"))
      .first();

    if (!role) {
      throw new Error("Admin role not found");
    }

    await ctx.db.insert("userOrganizations", {
      userId: args.userId,
      organizationId: args.organizationId,
      roleId: role._id,
      joinedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Create collection object
 */
export const createCollection = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    accessionNumber: v.string(),
    title: v.string(),
    creator: v.optional(v.string()),
    objectType: v.optional(v.string()),
    objectName: v.optional(v.string()),
    culture: v.optional(v.string()),
    period: v.optional(v.string()),
    dateCreated: v.optional(v.string()),
    materials: v.optional(v.string()),
    technique: v.optional(v.string()),
    dimensions: v.optional(v.string()),
    dimensionHeight: v.optional(v.number()),
    dimensionWidth: v.optional(v.number()),
    dimensionDepth: v.optional(v.number()),
    dimensionWeight: v.optional(v.number()),
    dimensionUnit: v.optional(v.string()),
    description: v.optional(v.string()),
    condition: v.optional(v.string()),
    provenance: v.optional(v.string()),
    inscriptions: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    creditLine: v.optional(v.string()),
  },
  returns: v.id("collections"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("collections", {
      organizationId: args.organizationId,
      accessionNumber: args.accessionNumber,
      title: args.title,
      creator: args.creator,
      objectType: args.objectType,
      objectName: args.objectName,
      culture: args.culture,
      period: args.period,
      dateCreated: args.dateCreated,
      materials: args.materials,
      technique: args.technique,
      dimensions: args.dimensions,
      dimensionHeight: args.dimensionHeight,
      dimensionWidth: args.dimensionWidth,
      dimensionDepth: args.dimensionDepth,
      dimensionWeight: args.dimensionWeight,
      dimensionUnit: args.dimensionUnit,
      description: args.description,
      condition: args.condition,
      provenance: args.provenance,
      inscriptions: args.inscriptions,
      tags: args.tags,
      creditLine: args.creditLine,
      status: "active",
      isPubliclyVisible: true,
      catalogedBy: args.userId,
      catalogedAt: Date.now(),
    });
  },
});

/**
 * Create media file record
 */
export const createMediaFile = internalMutation({
  args: {
    collectionId: v.id("collections"),
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    photographer: v.optional(v.string()),
  },
  returns: v.id("mediaFiles"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("mediaFiles", {
      collectionId: args.collectionId,
      organizationId: args.organizationId,
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: "image",
      fileSize: args.fileSize,
      mimeType: "image/jpeg",
      mediaCategory: "image",
      isPrimary: true,
      photographer: args.photographer,
      copyright: args.photographer
        ? `Photo by ${args.photographer}`
        : "Public Domain",
      uploadedBy: args.userId,
      uploadedAt: Date.now(),
      uploadStatus: "completed",
    });
  },
});
