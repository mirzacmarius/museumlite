import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import {
  applyUsageCounterDelta,
  createEmptyUsageCounter,
  getStorageBytes,
} from "./utils/organizationUsageCounters";

// Tables to clear - hardcoded list (NOT using TableNames to avoid as any)
// These are verified to exist in schema.ts
const TABLES_TO_CLEAR = [
  "auditLog",
  "notifications",
  "loanReminders",
  "loanExtensionRequests",
  "conditionReports",
  "loanItems",
  "loanDocuments",
  "loans",
  "deaccessions",
  "accessions",
  "mediaFiles",
  "locationHistory",
  "locationMoveRequests",
  "collectionGroupItems",
  "fineArtDetails",
  "wineDetails",
  "vehicleDetails",
  "naturalHistoryDetails",
  "archiveDetails",
  "collections",
  "collectionGroups",
  "locations",
  "conditionOptions",
  "materialOptions",
  "typeOptions",
  "donors",
  "userOrganizations",
  "rolePermissions",
  "roles",
  "organizations",
  "conservationTreatments",
  "conservationAlerts",
  "conservationAlertRules",
  "assessmentSchedules",
  "environmentalReadings",
  "conservationAttachments",
  "exhibitions",
  "exhibitionObjects",
  "exhibitionDocuments",
  "installationTasks",
  "installationTaskTemplates",
  "transitRecords",
  "transitItems",
  "transitStatusUpdates",
  "transitCounters",
  "librarySettings",
  "membershipTypes",
  "libraryItems",
  "itemCopies",
  "circulations",
  "libraryHolds",
  "libraryRecalls",
  "libraryFines",
  "libraryPayments",
  "accounts",
  "accountCounters",
  "contacts",
  "accountSegments",
  "workflowTemplates",
  "workflowConfigs",
  "workflowSlaConfigs",
  "workflowHistory",
  "appraisals",
  "insurancePolicies",
  "insuranceCoverages",
  "insuranceClaims",
  "claimCounters",
  "savedViews",
  "userPreferences",
] as const;

export const clearTableBatch = internalMutation({
  args: {
    tableName: v.string(),
    batchSize: v.number(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    // biome-ignore lint/suspicious/noExplicitAny: required for dynamic table iteration
    const docs = await ctx.db.query(args.tableName as any).take(args.batchSize);
    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }
    return docs.length;
  },
});

export const clearStorageBatch = internalMutation({
  args: {
    batchSize: v.number(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const files = await ctx.db.system.query("_storage").take(args.batchSize);
    for (const file of files) {
      await ctx.storage.delete(file._id);
    }
    return files.length;
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

    await ctx.db.insert(
      "organizationUsageCounters",
      createEmptyUsageCounter(orgId),
    );

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
    currentLocationId: v.optional(v.id("locations")),
  },
  returns: v.id("collections"),
  handler: async (ctx, args) => {
    const collectionId = await ctx.db.insert("collections", {
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
      currentLocationId: args.currentLocationId,
      status: "active",
      isPubliclyVisible: true,
      catalogedBy: args.userId,
      catalogedAt: Date.now(),
    });

    await applyUsageCounterDelta(ctx, args.organizationId, {
      objectCount: 1,
    });

    return collectionId;
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
    const [mediaId, storageBytes] = await Promise.all([
      ctx.db.insert("mediaFiles", {
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
      }),
      getStorageBytes(ctx, args.storageId),
    ]);
    await applyUsageCounterDelta(ctx, args.organizationId, {
      mediaFileCount: 1,
      mediaTypeDeltas: [
        {
          type: "image",
          countDelta: 1,
          bytesDelta: storageBytes,
        },
      ],
      storageBytes,
    });

    return mediaId;
  },
});

/**
 * Create location with parent support
 */
export const createLocation = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    type: v.string(),
    parentLocationId: v.optional(v.id("locations")),
    sortOrder: v.number(),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.id("locations"),
  handler: async (ctx, args) => {
    // Check if location already exists (idempotent)
    const existing = await ctx.db
      .query("locations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("name"), args.name),
          q.eq(q.field("type"), args.type),
          args.parentLocationId
            ? q.eq(q.field("parentLocationId"), args.parentLocationId)
            : q.eq(q.field("parentLocationId"), undefined),
        ),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("locations", {
      organizationId: args.organizationId,
      name: args.name,
      locationCode: `LOC-${args.sortOrder + 1}`,
      locationCodeNormalized: `loc-${args.sortOrder + 1}`,
      type: args.type,
      parentLocationId: args.parentLocationId,
      sortOrder: args.sortOrder,
      address: args.address,
      notes: args.notes,
      isActive: true,
      status: "active",
    });
  },
});

/**
 * Create condition option
 */
export const createConditionOption = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    name: v.string(),
    description: v.string(),
  },
  returns: v.id("conditionOptions"),
  handler: async (ctx, args) => {
    // Check if already exists (idempotent)
    const existing = await ctx.db
      .query("conditionOptions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("conditionOptions", {
      organizationId: args.organizationId,
      name: args.name,
      description: args.description,
      createdBy: args.userId,
      createdAt: Date.now(),
      usageCount: 0,
    });
  },
});

/**
 * Create material option
 */
export const createMaterialOption = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    name: v.string(),
  },
  returns: v.id("materialOptions"),
  handler: async (ctx, args) => {
    // Check if already exists (idempotent)
    const existing = await ctx.db
      .query("materialOptions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("materialOptions", {
      organizationId: args.organizationId,
      name: args.name,
      createdBy: args.userId,
      createdAt: Date.now(),
      usageCount: 0,
    });
  },
});

/**
 * Create type option
 */
export const createTypeOption = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    name: v.string(),
  },
  returns: v.id("typeOptions"),
  handler: async (ctx, args) => {
    // Check if already exists (idempotent)
    const existing = await ctx.db
      .query("typeOptions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("typeOptions", {
      organizationId: args.organizationId,
      name: args.name,
      createdBy: args.userId,
      createdAt: Date.now(),
      usageCount: 0,
    });
  },
});

/**
 * Create donor record
 */
export const createDonor = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    name: v.string(),
    email: v.string(),
  },
  returns: v.id("donors"),
  handler: async (ctx, args) => {
    // Check if already exists (idempotent)
    const existing = await ctx.db
      .query("donors")
      .withIndex("by_organization_and_name", (q) =>
        q.eq("organizationId", args.organizationId).eq("name", args.name),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("donors", {
      organizationId: args.organizationId,
      name: args.name,
      email: args.email,
      createdBy: args.userId,
      createdAt: Date.now(),
      usageCount: 0,
    });
  },
});

/**
 * Create account (lender/borrower/patron)
 */
export const createAccount = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    accountNumber: v.string(),
    accountType: v.union(
      v.literal("lender"),
      v.literal("borrower"),
      v.literal("both"),
      v.literal("institution"),
      v.literal("patron"),
    ),
    // Business info (for institutions)
    businessName: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    // Personal info (for patrons)
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    // Library fields (for patrons)
    cardNumber: v.optional(v.string()),
    membershipType: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("expired"),
        v.literal("suspended"),
        v.literal("blocked"),
        v.literal("inactive"),
        v.literal("archived"),
      ),
    ),
    borrowingLimit: v.optional(v.number()),
    holdLimit: v.optional(v.number()),
    fineBalance: v.optional(v.number()),
    totalCheckouts: v.optional(v.number()),
  },
  returns: v.id("accounts"),
  handler: async (ctx, args) => {
    // Check if already exists by accountNumber (idempotent)
    const existing = await ctx.db
      .query("accounts")
      .withIndex("by_organization_and_accountNumber", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("accountNumber", args.accountNumber),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("accounts", {
      organizationId: args.organizationId,
      accountNumber: args.accountNumber,
      accountType: args.accountType,
      businessName: args.businessName,
      contactPerson: args.contactPerson,
      contactPhone: args.contactPhone,
      contactEmail: args.contactEmail,
      firstName: args.firstName,
      lastName: args.lastName,
      phone: args.phone,
      email: args.email,
      address: args.address,
      city: args.city,
      country: args.country,
      cardNumber: args.cardNumber,
      membershipType: args.membershipType,
      status: args.status,
      borrowingLimit: args.borrowingLimit,
      holdLimit: args.holdLimit,
      fineBalance: args.fineBalance,
      totalCheckouts: args.totalCheckouts,
      createdBy: args.userId,
      createdAt: Date.now(),
    });
  },
});

/**
 * Create contact for an account
 */
export const createContact = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    accountId: v.id("accounts"),
    firstName: v.string(),
    lastName: v.string(),
    title: v.optional(v.string()),
    role: v.union(
      v.literal("primary"),
      v.literal("billing"),
      v.literal("shipping"),
      v.literal("technical"),
    ),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    isPrimary: v.boolean(),
  },
  returns: v.id("contacts"),
  handler: async (ctx, args) => {
    // Check if already exists by email for this account (idempotent)
    if (args.email) {
      const existing = await ctx.db
        .query("contacts")
        .withIndex("by_organization_and_account", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("accountId", args.accountId),
        )
        .filter((q) => q.eq(q.field("email"), args.email))
        .first();

      if (existing) {
        return existing._id;
      }
    }

    return await ctx.db.insert("contacts", {
      organizationId: args.organizationId,
      accountId: args.accountId,
      firstName: args.firstName,
      lastName: args.lastName,
      title: args.title,
      role: args.role,
      email: args.email,
      phone: args.phone,
      isPrimary: args.isPrimary,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

/**
 * Create account segment
 */
export const createAccountSegment = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    filters: v.array(
      v.object({
        field: v.string(),
        operator: v.union(
          v.literal("eq"),
          v.literal("ne"),
          v.literal("in"),
          v.literal("contains"),
          v.literal("gt"),
          v.literal("lt"),
          v.literal("gte"),
          v.literal("lte"),
        ),
        value: v.union(
          v.string(),
          v.number(),
          v.boolean(),
          v.null(),
          v.array(v.string()),
          v.array(v.number()),
        ),
      }),
    ),
  },
  returns: v.id("accountSegments"),
  handler: async (ctx, args) => {
    // Check if already exists by name (idempotent)
    const existing = await ctx.db
      .query("accountSegments")
      .withIndex("by_organization_and_name", (q) =>
        q.eq("organizationId", args.organizationId).eq("name", args.name),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("accountSegments", {
      organizationId: args.organizationId,
      name: args.name,
      description: args.description,
      filters: args.filters,
      createdBy: args.userId,
      createdAt: Date.now(),
    });
  },
});

/**
 * Create collection group
 */
export const createCollectionGroup = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    valuation: v.optional(v.number()),
  },
  returns: v.id("collectionGroups"),
  handler: async (ctx, args) => {
    // Check if already exists by name (idempotent)
    const existing = await ctx.db
      .query("collectionGroups")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("collectionGroups", {
      organizationId: args.organizationId,
      name: args.name,
      description: args.description,
      valuation: args.valuation,
      itemsCount: 0,
      createdBy: args.userId,
      createdAt: Date.now(),
    });
  },
});

/**
 * Create collection group item (link collection to group)
 */
export const createCollectionGroupItem = internalMutation({
  args: {
    collectionGroupId: v.id("collectionGroups"),
    collectionId: v.id("collections"),
    userId: v.id("users"),
  },
  returns: v.union(v.id("collectionGroupItems"), v.null()),
  handler: async (ctx, args) => {
    // Check if already exists (idempotent)
    const existing = await ctx.db
      .query("collectionGroupItems")
      .withIndex("by_collectionGroup_and_collection", (q) =>
        q
          .eq("collectionGroupId", args.collectionGroupId)
          .eq("collectionId", args.collectionId),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    const [itemId, group] = await Promise.all([
      ctx.db.insert("collectionGroupItems", {
        collectionGroupId: args.collectionGroupId,
        collectionId: args.collectionId,
        addedBy: args.userId,
        addedAt: Date.now(),
      }),
      ctx.db.get(args.collectionGroupId),
    ]);

    // Update items count on the group
    if (group) {
      await ctx.db.patch(args.collectionGroupId, {
        itemsCount: (group.itemsCount ?? 0) + 1,
      });
    }

    return itemId;
  },
});

/**
 * Create fine art details for a collection
 */
export const createFineArtDetails = internalMutation({
  args: {
    collectionId: v.id("collections"),
    organizationId: v.id("organizations"),
    appraisedValue: v.optional(v.number()),
    replacementValue: v.optional(v.number()),
    insurancePolicyNumber: v.optional(v.string()),
    insuranceCarrier: v.optional(v.string()),
    insuranceExpiresAt: v.optional(v.number()),
    reappraisalDate: v.optional(v.number()),
    lastAppraisalDate: v.optional(v.number()),
    appraiser: v.optional(v.string()),
    displayStatus: v.optional(
      v.union(
        v.literal("on_display"),
        v.literal("in_storage"),
        v.literal("loaned_out"),
        v.literal("in_transit"),
        v.literal("conservation"),
      ),
    ),
    provenanceChain: v.optional(
      v.array(
        v.object({
          eventType: v.union(
            v.literal("sale"),
            v.literal("auction"),
            v.literal("inheritance"),
            v.literal("gift"),
            v.literal("commission"),
            v.literal("acquisition"),
            v.literal("other"),
          ),
          owner: v.string(),
          startYear: v.optional(v.string()),
          endYear: v.optional(v.string()),
          location: v.optional(v.string()),
          salePrice: v.optional(v.number()),
          currency: v.optional(v.string()),
          auctionHouse: v.optional(v.string()),
          notes: v.optional(v.string()),
          verified: v.optional(v.boolean()),
        }),
      ),
    ),
  },
  returns: v.id("fineArtDetails"),
  handler: async (ctx, args) => {
    // Check if already exists (idempotent)
    const existing = await ctx.db
      .query("fineArtDetails")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("fineArtDetails", {
      collectionId: args.collectionId,
      organizationId: args.organizationId,
      appraisedValue: args.appraisedValue,
      replacementValue: args.replacementValue,
      insurancePolicyNumber: args.insurancePolicyNumber,
      insuranceCarrier: args.insuranceCarrier,
      insuranceExpiresAt: args.insuranceExpiresAt,
      reappraisalDate: args.reappraisalDate,
      lastAppraisalDate: args.lastAppraisalDate,
      appraiser: args.appraiser,
      displayStatus: args.displayStatus,
      provenanceChain: args.provenanceChain,
      createdAt: Date.now(),
    });
  },
});

/**
 * Create wine details for a collection
 */
export const createWineDetails = internalMutation({
  args: {
    collectionId: v.id("collections"),
    organizationId: v.id("organizations"),
    vintage: v.optional(v.number()),
    producer: v.optional(v.string()),
    region: v.optional(v.string()),
    appellation: v.optional(v.string()),
    varietal: v.optional(v.string()),
    bottleSize: v.optional(v.string()),
    quantity: v.optional(v.number()),
    purchasePrice: v.optional(v.number()),
    currentValue: v.optional(v.number()),
    binNumber: v.optional(v.string()),
    drinkingNotes: v.optional(v.string()),
  },
  returns: v.id("wineDetails"),
  handler: async (ctx, args) => {
    // Check if already exists (idempotent)
    const existing = await ctx.db
      .query("wineDetails")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("wineDetails", {
      collectionId: args.collectionId,
      organizationId: args.organizationId,
      vintage: args.vintage,
      producer: args.producer,
      region: args.region,
      appellation: args.appellation,
      varietal: args.varietal,
      bottleSize: args.bottleSize,
      quantity: args.quantity,
      purchasePrice: args.purchasePrice,
      currentValue: args.currentValue,
      binNumber: args.binNumber,
      drinkingNotes: args.drinkingNotes,
      createdAt: Date.now(),
    });
  },
});

/**
 * Create vehicle details for a collection
 */
export const createVehicleDetails = internalMutation({
  args: {
    collectionId: v.id("collections"),
    organizationId: v.id("organizations"),
    vin: v.optional(v.string()),
    make: v.optional(v.string()),
    model: v.optional(v.string()),
    year: v.optional(v.number()),
    bodyStyle: v.optional(v.string()),
    exteriorColor: v.optional(v.string()),
    interiorColor: v.optional(v.string()),
    odometer: v.optional(v.number()),
    odometerUnit: v.optional(v.union(v.literal("miles"), v.literal("km"))),
    insuranceValue: v.optional(v.number()),
  },
  returns: v.id("vehicleDetails"),
  handler: async (ctx, args) => {
    // Check if already exists (idempotent)
    const existing = await ctx.db
      .query("vehicleDetails")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("vehicleDetails", {
      collectionId: args.collectionId,
      organizationId: args.organizationId,
      vin: args.vin,
      make: args.make,
      model: args.model,
      year: args.year,
      bodyStyle: args.bodyStyle,
      exteriorColor: args.exteriorColor,
      interiorColor: args.interiorColor,
      odometer: args.odometer,
      odometerUnit: args.odometerUnit,
      insuranceValue: args.insuranceValue,
      createdAt: Date.now(),
    });
  },
});

/**
 * Create natural history details for a collection
 */
export const createNaturalHistoryDetails = internalMutation({
  args: {
    collectionId: v.id("collections"),
    organizationId: v.id("organizations"),
    kingdom: v.optional(v.string()),
    phylum: v.optional(v.string()),
    taxonomyClass: v.optional(v.string()),
    order: v.optional(v.string()),
    family: v.optional(v.string()),
    genus: v.optional(v.string()),
    species: v.optional(v.string()),
    commonName: v.optional(v.string()),
    scientificName: v.optional(v.string()),
    collectorName: v.optional(v.string()),
    locality: v.optional(v.string()),
    habitat: v.optional(v.string()),
    geologicalPeriod: v.optional(v.string()),
    preservationMethod: v.optional(
      v.union(
        v.literal("dry"),
        v.literal("wet"),
        v.literal("frozen"),
        v.literal("pinned"),
        v.literal("pressed"),
        v.literal("mounted"),
        v.literal("cast"),
        v.literal("fossil"),
        v.literal("other"),
      ),
    ),
  },
  returns: v.id("naturalHistoryDetails"),
  handler: async (ctx, args) => {
    // Check if already exists (idempotent)
    const existing = await ctx.db
      .query("naturalHistoryDetails")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("naturalHistoryDetails", {
      collectionId: args.collectionId,
      organizationId: args.organizationId,
      kingdom: args.kingdom,
      phylum: args.phylum,
      taxonomyClass: args.taxonomyClass,
      order: args.order,
      family: args.family,
      genus: args.genus,
      species: args.species,
      commonName: args.commonName,
      scientificName: args.scientificName,
      collectorName: args.collectorName,
      locality: args.locality,
      habitat: args.habitat,
      geologicalPeriod: args.geologicalPeriod,
      preservationMethod: args.preservationMethod,
      createdAt: Date.now(),
    });
  },
});

/**
 * Create archive details for a collection
 */
export const createArchiveDetails = internalMutation({
  args: {
    collectionId: v.id("collections"),
    organizationId: v.id("organizations"),
    documentType: v.optional(v.string()),
    retentionCategory: v.optional(v.string()),
    retentionYears: v.optional(v.number()),
    retentionStartDate: v.optional(v.number()),
    retentionExpiresAt: v.optional(v.number()),
    confidentialityLevel: v.optional(
      v.union(
        v.literal("public"),
        v.literal("internal"),
        v.literal("confidential"),
        v.literal("restricted"),
        v.literal("top_secret"),
      ),
    ),
    originatingDepartment: v.optional(v.string()),
    recordSeries: v.optional(v.string()),
    boxNumber: v.optional(v.string()),
    folderNumber: v.optional(v.string()),
    keywords: v.optional(v.array(v.string())),
  },
  returns: v.id("archiveDetails"),
  handler: async (ctx, args) => {
    // Check if already exists (idempotent)
    const existing = await ctx.db
      .query("archiveDetails")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("archiveDetails", {
      collectionId: args.collectionId,
      organizationId: args.organizationId,
      documentType: args.documentType,
      retentionCategory: args.retentionCategory,
      retentionYears: args.retentionYears,
      retentionStartDate: args.retentionStartDate,
      retentionExpiresAt: args.retentionExpiresAt,
      confidentialityLevel: args.confidentialityLevel,
      originatingDepartment: args.originatingDepartment,
      recordSeries: args.recordSeries,
      boxNumber: args.boxNumber,
      folderNumber: args.folderNumber,
      keywords: args.keywords,
      createdAt: Date.now(),
    });
  },
});

/**
 * Get role by name for an organization
 */
export const getRoleByName = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
  },
  returns: v.union(v.id("roles"), v.null()),
  handler: async (ctx, args) => {
    const role = await ctx.db
      .query("roles")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();
    return role?._id ?? null;
  },
});

/**
 * Get all collections for an organization
 */
export const getCollections = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("collections"),
      title: v.string(),
      accessionNumber: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const collections = await ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    return collections.map((c) => ({
      _id: c._id,
      title: c.title,
      accessionNumber: c.accessionNumber,
    }));
  },
});

export const getAccounts = internalQuery({
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
  },
  returns: v.array(
    v.object({
      _id: v.id("accounts"),
      accountNumber: v.string(),
      accountType: v.union(
        v.literal("lender"),
        v.literal("borrower"),
        v.literal("both"),
        v.literal("institution"),
        v.literal("patron"),
      ),
      businessName: v.optional(v.string()),
      contactPerson: v.optional(v.string()),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const withType = accounts.filter(
      (a): a is typeof a & { accountType: NonNullable<typeof a.accountType> } =>
        a.accountType !== undefined,
    );

    const filtered = args.accountType
      ? withType.filter((a) => a.accountType === args.accountType)
      : withType;

    return filtered.map((a) => ({
      _id: a._id,
      accountNumber: a.accountNumber,
      accountType: a.accountType,
      businessName: a.businessName,
      contactPerson: a.contactPerson,
      firstName: a.firstName,
      lastName: a.lastName,
    }));
  },
});

const workflowTypeValidator = v.union(
  v.literal("accession"),
  v.literal("deaccession"),
  v.literal("loan"),
  v.literal("acquisition"),
  v.literal("exhibition"),
  v.literal("conservation"),
);

const workflowTemplateStepValidator = v.object({
  stepNumber: v.number(),
  name: v.string(),
  roleName: v.string(),
  requiredDocuments: v.optional(v.array(v.string())),
  approvalMode: v.optional(
    v.union(v.literal("single"), v.literal("multi"), v.literal("unanimous")),
  ),
  requiredApprovals: v.optional(v.number()),
  allowedNextSteps: v.optional(v.array(v.number())),
  canSkip: v.optional(v.boolean()),
});

const workflowConfigStepValidator = v.object({
  stepNumber: v.number(),
  name: v.string(),
  roleId: v.id("roles"),
  requiredDocuments: v.optional(v.array(v.string())),
  approvalMode: v.optional(
    v.union(v.literal("single"), v.literal("multi"), v.literal("unanimous")),
  ),
  requiredApprovals: v.optional(v.number()),
  allowedNextSteps: v.optional(v.array(v.number())),
  canSkip: v.optional(v.boolean()),
});

const requiredDocumentValidator = v.object({
  documentType: v.string(),
  description: v.optional(v.string()),
  requiredAtStep: v.optional(v.number()),
});

export const createWorkflowTemplate = internalMutation({
  args: {
    name: v.string(),
    workflowType: workflowTypeValidator,
    isSystem: v.boolean(),
    steps: v.array(workflowTemplateStepValidator),
    requiredDocuments: v.optional(v.array(requiredDocumentValidator)),
    userId: v.optional(v.id("users")),
  },
  returns: v.id("workflowTemplates"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("workflowTemplates")
      .withIndex("by_workflowType", (q) =>
        q.eq("workflowType", args.workflowType),
      )
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("workflowTemplates", {
      name: args.name,
      workflowType: args.workflowType,
      isSystem: args.isSystem,
      steps: args.steps,
      requiredDocuments: args.requiredDocuments,
      createdAt: Date.now(),
      createdBy: args.userId,
    });
  },
});

export const createWorkflowConfig = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    workflowType: workflowTypeValidator,
    steps: v.array(workflowConfigStepValidator),
    canInitiateRoles: v.array(v.id("roles")),
    requiredDocuments: v.optional(v.array(requiredDocumentValidator)),
    requireSourceVerification: v.optional(v.boolean()),
    templateId: v.optional(v.id("workflowTemplates")),
  },
  returns: v.id("workflowConfigs"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("workflowConfigs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("workflowType"), args.workflowType))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("workflowConfigs", {
      organizationId: args.organizationId,
      workflowType: args.workflowType,
      steps: args.steps,
      canInitiateRoles: args.canInitiateRoles,
      requiredDocuments: args.requiredDocuments,
      requireSourceVerification: args.requireSourceVerification,
      templateId: args.templateId,
    });
  },
});

export const createWorkflowSlaConfig = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    workflowType: workflowTypeValidator,
    slaDays: v.number(),
    warningDays: v.optional(v.number()),
    escalateToRoleId: v.optional(v.id("roles")),
    isActive: v.optional(v.boolean()),
    userId: v.id("users"),
  },
  returns: v.id("workflowSlaConfigs"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("workflowSlaConfigs")
      .withIndex("by_organization_and_type", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("workflowType", args.workflowType),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("workflowSlaConfigs", {
      organizationId: args.organizationId,
      workflowType: args.workflowType,
      slaDays: args.slaDays,
      warningDays: args.warningDays,
      escalateToRoleId: args.escalateToRoleId,
      isActive: args.isActive,
      createdBy: args.userId,
      createdAt: Date.now(),
    });
  },
});

export const createLoan = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    loanNumber: v.string(),
    type: v.union(v.literal("incoming"), v.literal("outgoing")),
    accountId: v.optional(v.id("accounts")),
    lenderBorrowerName: v.string(),
    lenderBorrowerContact: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("dispatched"),
      v.literal("returned"),
      v.literal("cancelled"),
    ),
    terms: v.optional(v.string()),
    insuranceValue: v.optional(v.number()),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    workflowStep: v.optional(v.number()),
    assignedTo: v.optional(v.id("users")),
    useDetailedConditionReports: v.optional(v.boolean()),
  },
  returns: v.id("loans"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("loans")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("loanNumber"), args.loanNumber))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("loans", {
      organizationId: args.organizationId,
      loanNumber: args.loanNumber,
      type: args.type,
      accountId: args.accountId,
      lenderBorrowerName: args.lenderBorrowerName,
      lenderBorrowerContact: args.lenderBorrowerContact,
      startDate: args.startDate,
      endDate: args.endDate,
      status: args.status,
      terms: args.terms,
      insuranceValue: args.insuranceValue,
      approvedBy: args.approvedBy,
      approvedAt: args.approvedAt,
      notes: args.notes,
      workflowStep: args.workflowStep,
      assignedTo: args.assignedTo,
      useDetailedConditionReports: args.useDetailedConditionReports,
    });
  },
});

export const createLoanItem = internalMutation({
  args: {
    loanId: v.id("loans"),
    collectionId: v.id("collections"),
    conditionOut: v.optional(v.string()),
    conditionIn: v.optional(v.string()),
    notes: v.optional(v.string()),
    conditionReportId: v.optional(v.id("conditionReports")),
  },
  returns: v.id("loanItems"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("loanItems")
      .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
      .filter((q) => q.eq(q.field("collectionId"), args.collectionId))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("loanItems", {
      loanId: args.loanId,
      collectionId: args.collectionId,
      conditionOut: args.conditionOut,
      conditionIn: args.conditionIn,
      notes: args.notes,
      conditionReportId: args.conditionReportId,
    });
  },
});

export const createConditionReport = internalMutation({
  args: {
    loanItemId: v.id("loanItems"),
    reportType: v.union(v.literal("out"), v.literal("in")),
    conditionDescription: v.string(),
    damages: v.optional(
      v.array(
        v.object({
          type: v.string(),
          location: v.string(),
          severity: v.string(),
          notes: v.optional(v.string()),
        }),
      ),
    ),
    photos: v.optional(v.array(v.id("_storage"))),
    assessedBy: v.id("users"),
    assessedAt: v.number(),
  },
  returns: v.id("conditionReports"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("conditionReports")
      .withIndex("by_loanItem", (q) => q.eq("loanItemId", args.loanItemId))
      .filter((q) => q.eq(q.field("reportType"), args.reportType))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("conditionReports", {
      loanItemId: args.loanItemId,
      reportType: args.reportType,
      conditionDescription: args.conditionDescription,
      damages: args.damages,
      photos: args.photos,
      assessedBy: args.assessedBy,
      assessedAt: args.assessedAt,
    });
  },
});

export const createLoanExtensionRequest = internalMutation({
  args: {
    loanId: v.id("loans"),
    organizationId: v.id("organizations"),
    requestedBy: v.id("users"),
    requestedAt: v.number(),
    originalEndDate: v.number(),
    newRequestedEndDate: v.number(),
    reason: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
  },
  returns: v.id("loanExtensionRequests"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("loanExtensionRequests")
      .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
      .filter((q) =>
        q.and(
          q.eq(q.field("newRequestedEndDate"), args.newRequestedEndDate),
          q.eq(q.field("status"), args.status),
        ),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("loanExtensionRequests", {
      loanId: args.loanId,
      organizationId: args.organizationId,
      requestedBy: args.requestedBy,
      requestedAt: args.requestedAt,
      originalEndDate: args.originalEndDate,
      newRequestedEndDate: args.newRequestedEndDate,
      reason: args.reason,
      status: args.status,
      approvedBy: args.approvedBy,
      approvedAt: args.approvedAt,
    });
  },
});

export const createLoanReminder = internalMutation({
  args: {
    loanId: v.id("loans"),
    organizationId: v.id("organizations"),
    reminderType: v.union(
      v.literal("due_soon_30"),
      v.literal("due_soon_14"),
      v.literal("due_soon_7"),
      v.literal("due_soon_1"),
      v.literal("overdue"),
    ),
    sentAt: v.number(),
    dueDate: v.number(),
  },
  returns: v.id("loanReminders"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("loanReminders")
      .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
      .filter((q) => q.eq(q.field("reminderType"), args.reminderType))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("loanReminders", {
      loanId: args.loanId,
      organizationId: args.organizationId,
      reminderType: args.reminderType,
      sentAt: args.sentAt,
      dueDate: args.dueDate,
    });
  },
});

/**
 * Create accession record
 */
export const createAccession = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    collectionId: v.optional(v.id("collections")),
    accessionNumber: v.string(),
    dateReceived: v.number(),
    source: v.string(),
    donorAccountId: v.optional(v.id("accounts")),
    method: v.union(
      v.literal("purchase"),
      v.literal("gift"),
      v.literal("loan"),
      v.literal("transfer"),
      v.literal("donation"),
      v.literal("other"),
      v.literal("bequest"),
    ),
    cost: v.optional(v.number()),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    notes: v.optional(v.string()),
    assignedTo: v.optional(v.id("users")),
    workflowStep: v.optional(v.number()),
    workflowHistory: v.optional(
      v.array(
        v.object({
          step: v.number(),
          approvedBy: v.id("users"),
          approvedAt: v.number(),
          comment: v.optional(v.string()),
        }),
      ),
    ),
  },
  returns: v.id("accessions"),
  handler: async (ctx, args) => {
    // Check if already exists by accessionNumber (idempotent)
    const existing = await ctx.db
      .query("accessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("accessionNumber"), args.accessionNumber))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("accessions", {
      organizationId: args.organizationId,
      collectionId: args.collectionId,
      accessionNumber: args.accessionNumber,
      dateReceived: args.dateReceived,
      source: args.source,
      donorAccountId: args.donorAccountId,
      method: args.method,
      cost: args.cost,
      approvedBy: args.approvedBy,
      approvedAt: args.approvedAt,
      status: args.status,
      notes: args.notes,
      assignedTo: args.assignedTo,
      workflowStep: args.workflowStep,
      workflowHistory: args.workflowHistory,
    });
  },
});

/**
 * Create deaccession record
 */
export const createDeaccession = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    collectionId: v.id("collections"),
    deaccessionNumber: v.string(),
    dateDeaccessioned: v.number(),
    reason: v.string(),
    method: v.union(
      v.literal("sale"),
      v.literal("donation"),
      v.literal("destruction"),
      v.literal("transfer"),
    ),
    disposition: v.optional(v.string()),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    notes: v.optional(v.string()),
    workflowStep: v.optional(v.number()),
    workflowHistory: v.optional(
      v.array(
        v.object({
          step: v.number(),
          approvedBy: v.id("users"),
          approvedAt: v.number(),
          comment: v.optional(v.string()),
        }),
      ),
    ),
    assignedTo: v.optional(v.id("users")),
    proceedsAmount: v.optional(v.number()),
    proceedsCurrency: v.optional(v.string()),
  },
  returns: v.id("deaccessions"),
  handler: async (ctx, args) => {
    // Check if already exists by deaccessionNumber (idempotent)
    const existing = await ctx.db
      .query("deaccessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("deaccessionNumber"), args.deaccessionNumber))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("deaccessions", {
      organizationId: args.organizationId,
      collectionId: args.collectionId,
      deaccessionNumber: args.deaccessionNumber,
      dateDeaccessioned: args.dateDeaccessioned,
      reason: args.reason,
      method: args.method,
      disposition: args.disposition,
      approvedBy: args.approvedBy,
      approvedAt: args.approvedAt,
      status: args.status,
      notes: args.notes,
      workflowStep: args.workflowStep,
      workflowHistory: args.workflowHistory,
      assignedTo: args.assignedTo,
      proceedsAmount: args.proceedsAmount,
      proceedsCurrency: args.proceedsCurrency,
    });
  },
});

/**
 * Create appraisal record
 */
export const createAppraisal = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    collectionId: v.id("collections"),
    appraisalDate: v.number(),
    appraiserName: v.string(),
    appraiserCompany: v.optional(v.string()),
    appraiserCredentials: v.optional(v.string()),
    appraisalType: v.union(
      v.literal("insurance"),
      v.literal("market"),
      v.literal("fair_market"),
      v.literal("replacement"),
      v.literal("liquidation"),
    ),
    value: v.number(),
    currency: v.string(),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
    validUntil: v.optional(v.number()),
    isCurrentAppraisal: v.optional(v.boolean()),
  },
  returns: v.id("appraisals"),
  handler: async (ctx, args) => {
    // Check if already exists by collection, date, and type (idempotent)
    const existing = await ctx.db
      .query("appraisals")
      .withIndex("by_collection_and_date", (q) =>
        q
          .eq("collectionId", args.collectionId)
          .eq("appraisalDate", args.appraisalDate),
      )
      .filter((q) => q.eq(q.field("appraisalType"), args.appraisalType))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("appraisals", {
      organizationId: args.organizationId,
      collectionId: args.collectionId,
      appraisalDate: args.appraisalDate,
      appraiserName: args.appraiserName,
      appraiserCompany: args.appraiserCompany,
      appraiserCredentials: args.appraiserCredentials,
      appraisalType: args.appraisalType,
      value: args.value,
      currency: args.currency,
      notes: args.notes,
      createdBy: args.createdBy,
      createdAt: Date.now(),
      validUntil: args.validUntil,
      isCurrentAppraisal: args.isCurrentAppraisal,
    });
  },
});

/**
 * Create insurance policy
 */
export const createInsurancePolicy = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    policyNumber: v.string(),
    carrier: v.string(),
    carrierContact: v.optional(v.string()),
    carrierPhone: v.optional(v.string()),
    carrierEmail: v.optional(v.string()),
    policyType: v.union(
      v.literal("blanket"),
      v.literal("scheduled"),
      v.literal("exhibition"),
      v.literal("transit"),
      v.literal("loan"),
    ),
    coverageAmount: v.number(),
    deductible: v.optional(v.number()),
    perItemLimit: v.optional(v.number()),
    premiumAmount: v.optional(v.number()),
    premiumFrequency: v.optional(
      v.union(
        v.literal("monthly"),
        v.literal("quarterly"),
        v.literal("semi_annual"),
        v.literal("annual"),
      ),
    ),
    effectiveDate: v.number(),
    expirationDate: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("pending"),
      v.literal("expired"),
      v.literal("cancelled"),
      v.literal("suspended"),
    ),
    territory: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
  },
  returns: v.id("insurancePolicies"),
  handler: async (ctx, args) => {
    // Check if already exists by policyNumber (idempotent)
    const existing = await ctx.db
      .query("insurancePolicies")
      .withIndex("by_organization_and_policyNumber", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("policyNumber", args.policyNumber),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("insurancePolicies", {
      organizationId: args.organizationId,
      policyNumber: args.policyNumber,
      carrier: args.carrier,
      carrierContact: args.carrierContact,
      carrierPhone: args.carrierPhone,
      carrierEmail: args.carrierEmail,
      policyType: args.policyType,
      coverageAmount: args.coverageAmount,
      deductible: args.deductible,
      perItemLimit: args.perItemLimit,
      premiumAmount: args.premiumAmount,
      premiumFrequency: args.premiumFrequency,
      effectiveDate: args.effectiveDate,
      expirationDate: args.expirationDate,
      status: args.status,
      territory: args.territory,
      notes: args.notes,
      createdBy: args.createdBy,
      createdAt: Date.now(),
    });
  },
});

/**
 * Create insurance coverage (links policy to objects/loans/exhibitions)
 */
export const createInsuranceCoverage = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    policyId: v.id("insurancePolicies"),
    collectionId: v.optional(v.id("collections")),
    exhibitionId: v.optional(v.id("exhibitions")),
    loanId: v.optional(v.id("loans")),
    coveredValue: v.number(),
    effectiveDate: v.optional(v.number()),
    expirationDate: v.optional(v.number()),
    status: v.union(
      v.literal("active"),
      v.literal("pending"),
      v.literal("expired"),
      v.literal("removed"),
    ),
    verified: v.optional(v.boolean()),
    appraisalId: v.optional(v.id("appraisals")),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
  },
  returns: v.id("insuranceCoverages"),
  handler: async (ctx, args) => {
    if (args.collectionId) {
      const existing = await ctx.db
        .query("insuranceCoverages")
        .withIndex("by_policy", (q) => q.eq("policyId", args.policyId))
        .filter((q) => q.eq(q.field("collectionId"), args.collectionId))
        .first();
      if (existing) {
        return existing._id;
      }
    } else if (args.exhibitionId) {
      const existing = await ctx.db
        .query("insuranceCoverages")
        .withIndex("by_policy", (q) => q.eq("policyId", args.policyId))
        .filter((q) => q.eq(q.field("exhibitionId"), args.exhibitionId))
        .first();
      if (existing) {
        return existing._id;
      }
    } else if (args.loanId) {
      const existing = await ctx.db
        .query("insuranceCoverages")
        .withIndex("by_policy", (q) => q.eq("policyId", args.policyId))
        .filter((q) => q.eq(q.field("loanId"), args.loanId))
        .first();
      if (existing) {
        return existing._id;
      }
    }

    return await ctx.db.insert("insuranceCoverages", {
      organizationId: args.organizationId,
      policyId: args.policyId,
      collectionId: args.collectionId,
      exhibitionId: args.exhibitionId,
      loanId: args.loanId,
      coveredValue: args.coveredValue,
      effectiveDate: args.effectiveDate,
      expirationDate: args.expirationDate,
      status: args.status,
      verified: args.verified,
      appraisalId: args.appraisalId,
      notes: args.notes,
      createdBy: args.createdBy,
      createdAt: Date.now(),
    });
  },
});

/**
 * Create insurance claim
 */
export const createInsuranceClaim = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    policyId: v.id("insurancePolicies"),
    claimNumber: v.string(),
    collectionIds: v.optional(v.array(v.id("collections"))),
    exhibitionId: v.optional(v.id("exhibitions")),
    loanId: v.optional(v.id("loans")),
    incidentDate: v.number(),
    incidentLocation: v.optional(v.string()),
    incidentType: v.union(
      v.literal("damage"),
      v.literal("theft"),
      v.literal("loss"),
      v.literal("fire"),
      v.literal("water"),
      v.literal("vandalism"),
      v.literal("natural_disaster"),
      v.literal("transit"),
      v.literal("other"),
    ),
    incidentDescription: v.string(),
    claimedAmount: v.number(),
    assessedAmount: v.optional(v.number()),
    settledAmount: v.optional(v.number()),
    deductibleApplied: v.optional(v.number()),
    status: v.union(
      v.literal("draft"),
      v.literal("submitted"),
      v.literal("under_review"),
      v.literal("approved"),
      v.literal("denied"),
      v.literal("settled"),
      v.literal("closed"),
      v.literal("appealed"),
    ),
    reportedDate: v.number(),
    submittedDate: v.optional(v.number()),
    decisionDate: v.optional(v.number()),
    settlementDate: v.optional(v.number()),
    adjusterName: v.optional(v.string()),
    adjusterPhone: v.optional(v.string()),
    adjusterEmail: v.optional(v.string()),
    denialReason: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
    createdBy: v.id("users"),
  },
  returns: v.id("insuranceClaims"),
  handler: async (ctx, args) => {
    // Check if already exists by claimNumber (idempotent)
    const existing = await ctx.db
      .query("insuranceClaims")
      .withIndex("by_organization_and_claimNumber", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("claimNumber", args.claimNumber),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("insuranceClaims", {
      organizationId: args.organizationId,
      policyId: args.policyId,
      claimNumber: args.claimNumber,
      collectionIds: args.collectionIds,
      exhibitionId: args.exhibitionId,
      loanId: args.loanId,
      incidentDate: args.incidentDate,
      incidentLocation: args.incidentLocation,
      incidentType: args.incidentType,
      incidentDescription: args.incidentDescription,
      claimedAmount: args.claimedAmount,
      assessedAmount: args.assessedAmount,
      settledAmount: args.settledAmount,
      deductibleApplied: args.deductibleApplied,
      status: args.status,
      reportedDate: args.reportedDate,
      submittedDate: args.submittedDate,
      decisionDate: args.decisionDate,
      settlementDate: args.settlementDate,
      adjusterName: args.adjusterName,
      adjusterPhone: args.adjusterPhone,
      adjusterEmail: args.adjusterEmail,
      denialReason: args.denialReason,
      internalNotes: args.internalNotes,
      createdBy: args.createdBy,
      createdAt: Date.now(),
    });
  },
});

/**
 * Get all loans for an organization
 */
export const getLoans = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("loans"),
      loanNumber: v.string(),
      type: v.union(v.literal("incoming"), v.literal("outgoing")),
      status: v.union(
        v.literal("pending"),
        v.literal("active"),
        v.literal("dispatched"),
        v.literal("returned"),
        v.literal("cancelled"),
      ),
      insuranceValue: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    return loans.map((l) => ({
      _id: l._id,
      loanNumber: l.loanNumber,
      type: l.type,
      status: l.status,
      insuranceValue: l.insuranceValue,
    }));
  },
});

/**
 * Get all exhibitions for an organization
 */
export const getExhibitions = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("exhibitions"),
      title: v.string(),
      status: v.optional(
        v.union(
          v.literal("proposed"),
          v.literal("approved"),
          v.literal("installing"),
          v.literal("active"),
          v.literal("deinstalling"),
          v.literal("closed"),
          v.literal("rejected"),
        ),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const exhibitions = await ctx.db
      .query("exhibitions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    return exhibitions.map((e) => ({
      _id: e._id,
      title: e.title,
      status: e.status,
    }));
  },
});

/**
 * Create exhibition
 */
export const createExhibition = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    collectionId: v.id("collections"),
    title: v.string(),
    location: v.optional(v.string()),
    locationId: v.optional(v.id("locations")),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    isCurrent: v.boolean(),
    isLoan: v.optional(v.boolean()),
    loanVenue: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("proposed"),
        v.literal("approved"),
        v.literal("installing"),
        v.literal("active"),
        v.literal("deinstalling"),
        v.literal("closed"),
        v.literal("rejected"),
      ),
    ),
    workflowStep: v.optional(v.number()),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    createdBy: v.optional(v.id("users")),
  },
  returns: v.id("exhibitions"),
  handler: async (ctx, args) => {
    // Check if already exists by title and collection (idempotent)
    const existing = await ctx.db
      .query("exhibitions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("title"), args.title),
          q.eq(q.field("collectionId"), args.collectionId),
        ),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("exhibitions", {
      organizationId: args.organizationId,
      collectionId: args.collectionId,
      title: args.title,
      location: args.location,
      locationId: args.locationId,
      startDate: args.startDate,
      endDate: args.endDate,
      isCurrent: args.isCurrent,
      isLoan: args.isLoan,
      loanVenue: args.loanVenue,
      notes: args.notes,
      status: args.status,
      workflowStep: args.workflowStep,
      approvedBy: args.approvedBy,
      approvedAt: args.approvedAt,
      createdBy: args.createdBy,
    });
  },
});

/**
 * Create exhibition object
 */
export const createExhibitionObject = internalMutation({
  args: {
    exhibitionId: v.id("exhibitions"),
    organizationId: v.id("organizations"),
    collectionId: v.id("collections"),
    originalLocationId: v.optional(v.id("locations")),
    exhibitionLocationId: v.optional(v.id("locations")),
    installedAt: v.optional(v.number()),
    installedBy: v.optional(v.id("users")),
    installationNotes: v.optional(v.string()),
    conditionAtInstallation: v.optional(v.string()),
    deinstalledAt: v.optional(v.number()),
    deinstalledBy: v.optional(v.id("users")),
    conditionAtDeinstallation: v.optional(v.string()),
    returnedToOriginalLocation: v.optional(v.boolean()),
    returnedAt: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("installed"),
      v.literal("deinstalled"),
      v.literal("returned"),
    ),
  },
  returns: v.id("exhibitionObjects"),
  handler: async (ctx, args) => {
    // Check if already exists (idempotent)
    const existing = await ctx.db
      .query("exhibitionObjects")
      .withIndex("by_exhibition", (q) =>
        q.eq("exhibitionId", args.exhibitionId),
      )
      .filter((q) => q.eq(q.field("collectionId"), args.collectionId))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("exhibitionObjects", {
      exhibitionId: args.exhibitionId,
      organizationId: args.organizationId,
      collectionId: args.collectionId,
      originalLocationId: args.originalLocationId,
      exhibitionLocationId: args.exhibitionLocationId,
      installedAt: args.installedAt,
      installedBy: args.installedBy,
      installationNotes: args.installationNotes,
      conditionAtInstallation: args.conditionAtInstallation,
      deinstalledAt: args.deinstalledAt,
      deinstalledBy: args.deinstalledBy,
      conditionAtDeinstallation: args.conditionAtDeinstallation,
      returnedToOriginalLocation: args.returnedToOriginalLocation,
      returnedAt: args.returnedAt,
      status: args.status,
    });
  },
});

/**
 * Create installation task
 */
export const createInstallationTask = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    exhibitionId: v.id("exhibitions"),
    title: v.string(),
    description: v.optional(v.string()),
    taskType: v.union(
      v.literal("lighting"),
      v.literal("signage"),
      v.literal("mounts"),
      v.literal("conservation"),
      v.literal("labeling"),
      v.literal("security"),
      v.literal("av"),
      v.literal("other"),
    ),
    status: v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("blocked"),
    ),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent"),
    ),
    assigneeId: v.optional(v.id("users")),
    assigneeName: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    completedBy: v.optional(v.id("users")),
    estimatedHours: v.optional(v.number()),
    actualHours: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
  },
  returns: v.id("installationTasks"),
  handler: async (ctx, args) => {
    // Check if already exists by exhibition and title (idempotent)
    const existing = await ctx.db
      .query("installationTasks")
      .withIndex("by_exhibition", (q) =>
        q.eq("exhibitionId", args.exhibitionId),
      )
      .filter((q) => q.eq(q.field("title"), args.title))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("installationTasks", {
      organizationId: args.organizationId,
      exhibitionId: args.exhibitionId,
      title: args.title,
      description: args.description,
      taskType: args.taskType,
      status: args.status,
      priority: args.priority,
      assigneeId: args.assigneeId,
      assigneeName: args.assigneeName,
      dueDate: args.dueDate,
      completedAt: args.completedAt,
      completedBy: args.completedBy,
      estimatedHours: args.estimatedHours,
      actualHours: args.actualHours,
      notes: args.notes,
      createdBy: args.createdBy,
      createdAt: Date.now(),
    });
  },
});

/**
 * Get locations for an organization
 */
export const getLocations = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("locations"),
      name: v.string(),
      type: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const locations = await ctx.db
      .query("locations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    return locations.map((l) => ({
      _id: l._id,
      name: l.name,
      type: l.type,
    }));
  },
});

export const createConservationTreatment = internalMutation({
  args: {
    collectionId: v.id("collections"),
    organizationId: v.id("organizations"),
    treatmentType: v.union(
      v.literal("routine"),
      v.literal("stabilization"),
      v.literal("restoration"),
      v.literal("cleaning"),
      v.literal("repair"),
      v.literal("assessment"),
      v.literal("other"),
    ),
    title: v.string(),
    description: v.string(),
    performedBy: v.id("users"),
    performedByName: v.optional(v.string()),
    performedAt: v.number(),
    notes: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("proposed"),
        v.literal("approved"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("rejected"),
      ),
    ),
    workflowStep: v.optional(v.number()),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    createdBy: v.optional(v.id("users")),
    laborHours: v.optional(v.number()),
    laborRate: v.optional(v.number()),
    laborCost: v.optional(v.number()),
    materialsCost: v.optional(v.number()),
    totalCost: v.optional(v.number()),
    currency: v.optional(v.string()),
  },
  returns: v.id("conservationTreatments"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("conservationTreatments")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("title"), args.title),
          q.eq(q.field("performedAt"), args.performedAt),
        ),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("conservationTreatments", {
      collectionId: args.collectionId,
      organizationId: args.organizationId,
      treatmentType: args.treatmentType,
      title: args.title,
      description: args.description,
      performedBy: args.performedBy,
      performedByName: args.performedByName,
      performedAt: args.performedAt,
      notes: args.notes,
      status: args.status,
      workflowStep: args.workflowStep,
      approvedBy: args.approvedBy,
      approvedAt: args.approvedAt,
      createdBy: args.createdBy,
      laborHours: args.laborHours,
      laborRate: args.laborRate,
      laborCost: args.laborCost,
      materialsCost: args.materialsCost,
      totalCost: args.totalCost,
      currency: args.currency,
    });
  },
});

export const createConservationAlert = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    collectionId: v.optional(v.id("collections")),
    treatmentId: v.optional(v.id("conservationTreatments")),
    alertType: v.union(
      v.literal("condition_degraded"),
      v.literal("treatment_overdue"),
      v.literal("assessment_due"),
      v.literal("urgent_treatment"),
      v.literal("environmental_alert"),
      v.literal("manual"),
    ),
    title: v.string(),
    description: v.string(),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("critical"),
    ),
    status: v.union(
      v.literal("active"),
      v.literal("acknowledged"),
      v.literal("resolved"),
      v.literal("dismissed"),
    ),
    acknowledgedBy: v.optional(v.id("users")),
    acknowledgedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.id("users")),
    resolvedAt: v.optional(v.number()),
    resolutionNotes: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
  },
  returns: v.id("conservationAlerts"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("conservationAlerts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("title"), args.title),
          q.eq(q.field("collectionId"), args.collectionId),
        ),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("conservationAlerts", {
      organizationId: args.organizationId,
      collectionId: args.collectionId,
      treatmentId: args.treatmentId,
      alertType: args.alertType,
      title: args.title,
      description: args.description,
      priority: args.priority,
      status: args.status,
      acknowledgedBy: args.acknowledgedBy,
      acknowledgedAt: args.acknowledgedAt,
      resolvedBy: args.resolvedBy,
      resolvedAt: args.resolvedAt,
      resolutionNotes: args.resolutionNotes,
      createdBy: args.createdBy,
      createdAt: Date.now(),
    });
  },
});

export const createAssessmentSchedule = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    collectionId: v.optional(v.id("collections")),
    name: v.string(),
    description: v.optional(v.string()),
    intervalDays: v.number(),
    assessmentType: v.union(
      v.literal("full"),
      v.literal("spot_check"),
      v.literal("environmental"),
      v.literal("condition"),
    ),
    nextDueDate: v.optional(v.number()),
    lastCompletedDate: v.optional(v.number()),
    lastCompletedBy: v.optional(v.id("users")),
    isActive: v.boolean(),
    assignedTo: v.optional(v.id("users")),
    reminderDaysBefore: v.optional(v.number()),
    createdBy: v.id("users"),
  },
  returns: v.id("assessmentSchedules"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("assessmentSchedules")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("assessmentSchedules", {
      organizationId: args.organizationId,
      collectionId: args.collectionId,
      name: args.name,
      description: args.description,
      intervalDays: args.intervalDays,
      assessmentType: args.assessmentType,
      nextDueDate: args.nextDueDate,
      lastCompletedDate: args.lastCompletedDate,
      lastCompletedBy: args.lastCompletedBy,
      isActive: args.isActive,
      assignedTo: args.assignedTo,
      reminderDaysBefore: args.reminderDaysBefore,
      createdBy: args.createdBy,
      createdAt: Date.now(),
    });
  },
});

export const createEnvironmentalReading = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    locationId: v.id("locations"),
    temperature: v.optional(v.number()),
    humidity: v.optional(v.number()),
    lightLevel: v.optional(v.number()),
    uvLevel: v.optional(v.number()),
    recordedAt: v.number(),
    recordedBy: v.optional(v.id("users")),
    source: v.union(
      v.literal("manual"),
      v.literal("sensor"),
      v.literal("imported"),
    ),
    sensorId: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.id("environmentalReadings"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("environmentalReadings")
      .withIndex("by_location_and_time", (q) =>
        q.eq("locationId", args.locationId).eq("recordedAt", args.recordedAt),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("environmentalReadings", {
      organizationId: args.organizationId,
      locationId: args.locationId,
      temperature: args.temperature,
      humidity: args.humidity,
      lightLevel: args.lightLevel,
      uvLevel: args.uvLevel,
      recordedAt: args.recordedAt,
      recordedBy: args.recordedBy,
      source: args.source,
      sensorId: args.sensorId,
      notes: args.notes,
    });
  },
});

export const createTransitRecord = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    transitNumber: v.string(),
    collectionIds: v.optional(v.array(v.id("collections"))),
    loanId: v.optional(v.id("loans")),
    exhibitionId: v.optional(v.id("exhibitions")),
    transitType: v.union(
      v.literal("outgoing"),
      v.literal("incoming"),
      v.literal("internal"),
      v.literal("return"),
    ),
    originName: v.string(),
    originAddress: v.optional(v.string()),
    originLocationId: v.optional(v.id("locations")),
    originContact: v.optional(v.string()),
    destinationName: v.string(),
    destinationAddress: v.optional(v.string()),
    destinationLocationId: v.optional(v.id("locations")),
    destinationContact: v.optional(v.string()),
    carrier: v.string(),
    carrierContact: v.optional(v.string()),
    carrierType: v.optional(
      v.union(
        v.literal("art_handler"),
        v.literal("courier"),
        v.literal("freight"),
        v.literal("postal"),
        v.literal("internal"),
        v.literal("other"),
      ),
    ),
    trackingNumber: v.optional(v.string()),
    scheduledPickupDate: v.optional(v.number()),
    actualPickupDate: v.optional(v.number()),
    estimatedDeliveryDate: v.optional(v.number()),
    actualDeliveryDate: v.optional(v.number()),
    status: v.union(
      v.literal("draft"),
      v.literal("scheduled"),
      v.literal("in_transit"),
      v.literal("out_for_delivery"),
      v.literal("delivered"),
      v.literal("delayed"),
      v.literal("held"),
      v.literal("returned"),
      v.literal("cancelled"),
    ),
    packageCount: v.optional(v.number()),
    totalWeight: v.optional(v.number()),
    weightUnit: v.optional(v.union(v.literal("kg"), v.literal("lb"))),
    specialHandling: v.optional(v.array(v.string())),
    insuranceValue: v.optional(v.number()),
    shippingCost: v.optional(v.number()),
    currency: v.optional(v.string()),
    conditionAtPickup: v.optional(v.string()),
    conditionAtDelivery: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
  },
  returns: v.id("transitRecords"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("transitRecords")
      .withIndex("by_organization_and_transitNumber", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("transitNumber", args.transitNumber),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("transitRecords", {
      organizationId: args.organizationId,
      transitNumber: args.transitNumber,
      collectionIds: args.collectionIds,
      loanId: args.loanId,
      exhibitionId: args.exhibitionId,
      transitType: args.transitType,
      originName: args.originName,
      originAddress: args.originAddress,
      originLocationId: args.originLocationId,
      originContact: args.originContact,
      destinationName: args.destinationName,
      destinationAddress: args.destinationAddress,
      destinationLocationId: args.destinationLocationId,
      destinationContact: args.destinationContact,
      carrier: args.carrier,
      carrierContact: args.carrierContact,
      carrierType: args.carrierType,
      trackingNumber: args.trackingNumber,
      scheduledPickupDate: args.scheduledPickupDate,
      actualPickupDate: args.actualPickupDate,
      estimatedDeliveryDate: args.estimatedDeliveryDate,
      actualDeliveryDate: args.actualDeliveryDate,
      status: args.status,
      packageCount: args.packageCount,
      totalWeight: args.totalWeight,
      weightUnit: args.weightUnit,
      specialHandling: args.specialHandling,
      insuranceValue: args.insuranceValue,
      shippingCost: args.shippingCost,
      currency: args.currency,
      conditionAtPickup: args.conditionAtPickup,
      conditionAtDelivery: args.conditionAtDelivery,
      notes: args.notes,
      createdBy: args.createdBy,
      createdAt: Date.now(),
    });
  },
});

export const createTransitItem = internalMutation({
  args: {
    transitRecordId: v.id("transitRecords"),
    collectionId: v.id("collections"),
    conditionAtPickup: v.optional(v.string()),
    conditionAtDelivery: v.optional(v.string()),
    packingNotes: v.optional(v.string()),
    specialHandling: v.optional(v.array(v.string())),
    status: v.union(
      v.literal("pending"),
      v.literal("in_transit"),
      v.literal("delivered"),
      v.literal("damaged"),
      v.literal("missing"),
    ),
    notes: v.optional(v.string()),
  },
  returns: v.id("transitItems"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("transitItems")
      .withIndex("by_transitRecord", (q) =>
        q.eq("transitRecordId", args.transitRecordId),
      )
      .filter((q) => q.eq(q.field("collectionId"), args.collectionId))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("transitItems", {
      transitRecordId: args.transitRecordId,
      collectionId: args.collectionId,
      conditionAtPickup: args.conditionAtPickup,
      conditionAtDelivery: args.conditionAtDelivery,
      packingNotes: args.packingNotes,
      specialHandling: args.specialHandling,
      status: args.status,
      notes: args.notes,
      createdAt: Date.now(),
    });
  },
});

export const createTransitStatusUpdate = internalMutation({
  args: {
    transitRecordId: v.id("transitRecords"),
    status: v.union(
      v.literal("draft"),
      v.literal("scheduled"),
      v.literal("in_transit"),
      v.literal("out_for_delivery"),
      v.literal("delivered"),
      v.literal("delayed"),
      v.literal("held"),
      v.literal("returned"),
      v.literal("cancelled"),
    ),
    location: v.optional(v.string()),
    description: v.string(),
    temperature: v.optional(v.number()),
    humidity: v.optional(v.number()),
    reportedBy: v.optional(v.id("users")),
    reportedByName: v.optional(v.string()),
    reportedAt: v.number(),
    notes: v.optional(v.string()),
  },
  returns: v.id("transitStatusUpdates"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("transitStatusUpdates")
      .withIndex("by_transitRecord", (q) =>
        q.eq("transitRecordId", args.transitRecordId),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), args.status),
          q.eq(q.field("reportedAt"), args.reportedAt),
        ),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("transitStatusUpdates", {
      transitRecordId: args.transitRecordId,
      status: args.status,
      location: args.location,
      description: args.description,
      temperature: args.temperature,
      humidity: args.humidity,
      reportedBy: args.reportedBy,
      reportedByName: args.reportedByName,
      reportedAt: args.reportedAt,
      notes: args.notes,
    });
  },
});

export const createLibrarySettings = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    defaultLoanPeriodDays: v.number(),
    defaultRenewalLimit: v.number(),
    renewalPeriodDays: v.number(),
    maxRenewalsAllowed: v.number(),
    finePerDayDefault: v.number(),
    gracePeriodDays: v.number(),
    holdExpirationDays: v.number(),
    maxHoldsPerPatron: v.number(),
    autoGenerateCardNumbers: v.boolean(),
    classificationSystem: v.union(
      v.literal("dewey"),
      v.literal("lc"),
      v.literal("custom"),
    ),
  },
  returns: v.id("librarySettings"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("librarySettings")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("librarySettings", {
      organizationId: args.organizationId,
      defaultLoanPeriodDays: args.defaultLoanPeriodDays,
      defaultRenewalLimit: args.defaultRenewalLimit,
      renewalPeriodDays: args.renewalPeriodDays,
      maxRenewalsAllowed: args.maxRenewalsAllowed,
      finePerDayDefault: args.finePerDayDefault,
      gracePeriodDays: args.gracePeriodDays,
      holdExpirationDays: args.holdExpirationDays,
      maxHoldsPerPatron: args.maxHoldsPerPatron,
      autoGenerateCardNumbers: args.autoGenerateCardNumbers,
      classificationSystem: args.classificationSystem,
      createdAt: Date.now(),
    });
  },
});

export const createMembershipType = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    borrowingLimit: v.number(),
    holdLimit: v.number(),
    loanPeriodDays: v.number(),
    renewalLimit: v.number(),
    finePerDay: v.number(),
    gracePeriodDays: v.number(),
    fee: v.optional(v.number()),
    isDefault: v.boolean(),
  },
  returns: v.id("membershipTypes"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("membershipTypes")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("membershipTypes", {
      organizationId: args.organizationId,
      name: args.name,
      description: args.description,
      borrowingLimit: args.borrowingLimit,
      holdLimit: args.holdLimit,
      loanPeriodDays: args.loanPeriodDays,
      renewalLimit: args.renewalLimit,
      finePerDay: args.finePerDay,
      gracePeriodDays: args.gracePeriodDays,
      fee: args.fee,
      isDefault: args.isDefault,
      createdAt: Date.now(),
    });
  },
});

export const createLibraryItem = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    itemType: v.union(
      v.literal("book"),
      v.literal("ebook"),
      v.literal("audiobook"),
      v.literal("periodical"),
      v.literal("dvd"),
      v.literal("cd"),
      v.literal("other"),
    ),
    isbn: v.optional(v.string()),
    barcode: v.optional(v.string()),
    callNumber: v.optional(v.string()),
    title: v.string(),
    authors: v.array(v.string()),
    publisher: v.optional(v.string()),
    publicationYear: v.optional(v.number()),
    language: v.string(),
    pages: v.optional(v.number()),
    categories: v.optional(v.array(v.string())),
    subjects: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
    totalCopies: v.number(),
    availableCopies: v.number(),
    catalogStatus: v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("archived"),
    ),
    isCirculating: v.boolean(),
    loanPeriodDays: v.optional(v.number()),
    maxRenewals: v.optional(v.number()),
    createdBy: v.id("users"),
  },
  returns: v.id("libraryItems"),
  handler: async (ctx, args) => {
    if (args.isbn) {
      const existing = await ctx.db
        .query("libraryItems")
        .withIndex("by_isbn", (q) => q.eq("isbn", args.isbn))
        .first();
      if (existing) {
        return existing._id;
      }
    }

    return await ctx.db.insert("libraryItems", {
      organizationId: args.organizationId,
      itemType: args.itemType,
      isbn: args.isbn,
      barcode: args.barcode,
      callNumber: args.callNumber,
      title: args.title,
      authors: args.authors,
      publisher: args.publisher,
      publicationYear: args.publicationYear,
      language: args.language,
      pages: args.pages,
      categories: args.categories,
      subjects: args.subjects,
      description: args.description,
      totalCopies: args.totalCopies,
      availableCopies: args.availableCopies,
      catalogStatus: args.catalogStatus,
      isCirculating: args.isCirculating,
      loanPeriodDays: args.loanPeriodDays,
      maxRenewals: args.maxRenewals,
      createdBy: args.createdBy,
      createdAt: Date.now(),
    });
  },
});

export const createItemCopy = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    itemId: v.id("libraryItems"),
    copyNumber: v.number(),
    barcode: v.string(),
    locationId: v.optional(v.id("locations")),
    shelfLocation: v.optional(v.string()),
    status: v.union(
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
    ),
    condition: v.union(
      v.literal("new"),
      v.literal("excellent"),
      v.literal("good"),
      v.literal("fair"),
      v.literal("poor"),
    ),
    acquisitionDate: v.optional(v.number()),
    acquisitionPrice: v.optional(v.number()),
    replacementCost: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.id("itemCopies"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("itemCopies")
      .withIndex("by_organization_and_barcode", (q) =>
        q.eq("organizationId", args.organizationId).eq("barcode", args.barcode),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("itemCopies", {
      organizationId: args.organizationId,
      itemId: args.itemId,
      copyNumber: args.copyNumber,
      barcode: args.barcode,
      locationId: args.locationId,
      shelfLocation: args.shelfLocation,
      status: args.status,
      condition: args.condition,
      acquisitionDate: args.acquisitionDate,
      acquisitionPrice: args.acquisitionPrice,
      replacementCost: args.replacementCost,
      notes: args.notes,
      createdAt: Date.now(),
    });
  },
});

export const createCirculation = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    accountId: v.id("accounts"),
    copyId: v.id("itemCopies"),
    itemId: v.id("libraryItems"),
    checkoutDate: v.number(),
    dueDate: v.number(),
    returnDate: v.optional(v.number()),
    renewalCount: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("returned"),
      v.literal("overdue"),
      v.literal("lost"),
      v.literal("claimed_returned"),
    ),
    fineAmount: v.optional(v.number()),
    fineStatus: v.optional(
      v.union(
        v.literal("none"),
        v.literal("accruing"),
        v.literal("billed"),
        v.literal("paid"),
        v.literal("waived"),
      ),
    ),
    checkedOutBy: v.id("users"),
    checkedInBy: v.optional(v.id("users")),
    notes: v.optional(v.string()),
  },
  returns: v.id("circulations"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("circulations")
      .withIndex("by_copy", (q) => q.eq("copyId", args.copyId))
      .filter((q) =>
        q.and(
          q.eq(q.field("checkoutDate"), args.checkoutDate),
          q.eq(q.field("accountId"), args.accountId),
        ),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("circulations", {
      organizationId: args.organizationId,
      accountId: args.accountId,
      copyId: args.copyId,
      itemId: args.itemId,
      checkoutDate: args.checkoutDate,
      dueDate: args.dueDate,
      returnDate: args.returnDate,
      renewalCount: args.renewalCount,
      status: args.status,
      fineAmount: args.fineAmount,
      fineStatus: args.fineStatus,
      checkedOutBy: args.checkedOutBy,
      checkedInBy: args.checkedInBy,
      notes: args.notes,
    });
  },
});

export const createLibraryHold = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    accountId: v.id("accounts"),
    itemId: v.id("libraryItems"),
    copyId: v.optional(v.id("itemCopies")),
    holdDate: v.number(),
    queuePosition: v.number(),
    pickupLocationId: v.optional(v.id("locations")),
    availableDate: v.optional(v.number()),
    expirationDate: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("available"),
      v.literal("fulfilled"),
      v.literal("cancelled"),
      v.literal("expired"),
    ),
    notificationSent: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  returns: v.id("libraryHolds"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("libraryHolds")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .filter((q) =>
        q.and(
          q.eq(q.field("itemId"), args.itemId),
          q.eq(q.field("holdDate"), args.holdDate),
        ),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("libraryHolds", {
      organizationId: args.organizationId,
      accountId: args.accountId,
      itemId: args.itemId,
      copyId: args.copyId,
      holdDate: args.holdDate,
      queuePosition: args.queuePosition,
      pickupLocationId: args.pickupLocationId,
      availableDate: args.availableDate,
      expirationDate: args.expirationDate,
      status: args.status,
      notificationSent: args.notificationSent,
      notes: args.notes,
      createdAt: Date.now(),
    });
  },
});

export const createLibraryFine = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    accountId: v.id("accounts"),
    circulationId: v.optional(v.id("circulations")),
    copyId: v.optional(v.id("itemCopies")),
    fineType: v.union(
      v.literal("overdue"),
      v.literal("lost_item"),
      v.literal("damaged_item"),
      v.literal("processing_fee"),
      v.literal("replacement_cost"),
      v.literal("membership_fee"),
      v.literal("other"),
    ),
    description: v.string(),
    amount: v.number(),
    amountPaid: v.number(),
    balance: v.number(),
    status: v.union(
      v.literal("outstanding"),
      v.literal("paid"),
      v.literal("waived"),
      v.literal("forgiven"),
      v.literal("refunded"),
    ),
    dueDate: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    waivedBy: v.optional(v.id("users")),
    waivedReason: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.id("libraryFines"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("libraryFines")
      .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
      .filter((q) =>
        q.and(
          q.eq(q.field("circulationId"), args.circulationId),
          q.eq(q.field("fineType"), args.fineType),
        ),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("libraryFines", {
      organizationId: args.organizationId,
      accountId: args.accountId,
      circulationId: args.circulationId,
      copyId: args.copyId,
      fineType: args.fineType,
      description: args.description,
      amount: args.amount,
      amountPaid: args.amountPaid,
      balance: args.balance,
      status: args.status,
      dueDate: args.dueDate,
      paidAt: args.paidAt,
      waivedBy: args.waivedBy,
      waivedReason: args.waivedReason,
      notes: args.notes,
      createdAt: Date.now(),
    });
  },
});

export const getPatronAccounts = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("accounts"),
      accountNumber: v.string(),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      cardNumber: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("accountType"), "patron"))
      .collect();

    return accounts.map((a) => ({
      _id: a._id,
      accountNumber: a.accountNumber,
      firstName: a.firstName,
      lastName: a.lastName,
      cardNumber: a.cardNumber,
    }));
  },
});

// ========================================
// PHASE 12: AUDIT & MISC
// ========================================

export const createAuditLog = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    changes: v.optional(v.any()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    timestamp: v.number(),
  },
  returns: v.id("auditLog"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("auditLog", {
      organizationId: args.organizationId,
      userId: args.userId,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      changes: args.changes,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      timestamp: args.timestamp,
    });
  },
});

export const createNotification = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    read: v.boolean(),
    relatedEntityType: v.optional(v.string()),
    relatedEntityId: v.optional(v.string()),
    createdAt: v.number(),
  },
  returns: v.id("notifications"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("notifications", {
      organizationId: args.organizationId,
      userId: args.userId,
      type: args.type,
      title: args.title,
      message: args.message,
      read: args.read,
      relatedEntityType: args.relatedEntityType,
      relatedEntityId: args.relatedEntityId,
      createdAt: args.createdAt,
    });
  },
});

export const createLocationHistory = internalMutation({
  args: {
    collectionId: v.id("collections"),
    fromLocationId: v.optional(v.id("locations")),
    toLocationId: v.id("locations"),
    movedBy: v.id("users"),
    movedAt: v.number(),
    reason: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.id("locationHistory"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("locationHistory", {
      collectionId: args.collectionId,
      fromLocationId: args.fromLocationId,
      toLocationId: args.toLocationId,
      movedBy: args.movedBy,
      movedAt: args.movedAt,
      reason: args.reason,
      notes: args.notes,
    });
  },
});

export const createSavedView = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    name: v.string(),
    module: v.union(
      v.literal("objects"),
      v.literal("loans"),
      v.literal("accounts"),
      v.literal("locations"),
      v.literal("accessions"),
    ),
    filters: v.string(),
    isDefault: v.optional(v.boolean()),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  },
  returns: v.id("savedViews"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("savedViews")
      .withIndex("by_organization_and_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("name"), args.name),
          q.eq(q.field("module"), args.module),
        ),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("savedViews", {
      organizationId: args.organizationId,
      userId: args.userId,
      name: args.name,
      module: args.module,
      filters: args.filters,
      isDefault: args.isDefault,
      createdAt: args.createdAt,
      lastUsedAt: args.lastUsedAt,
    });
  },
});

export const createUserPreferences = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
    key: v.string(),
    value: v.string(),
    updatedAt: v.number(),
  },
  returns: v.id("userPreferences"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user_organization_key", (q) =>
        q
          .eq("userId", args.userId)
          .eq("organizationId", args.organizationId)
          .eq("key", args.key),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        updatedAt: args.updatedAt,
      });
      return existing._id;
    }

    return await ctx.db.insert("userPreferences", {
      userId: args.userId,
      organizationId: args.organizationId,
      key: args.key,
      value: args.value,
      updatedAt: args.updatedAt,
    });
  },
});

// ========================================
// PHASE 13: ADDITIONAL SEED MUTATIONS
// ========================================

/**
 * Create account relationship (links accounts to loans/exhibitions/acquisitions/items)
 */
export const createAccountRelationship = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    accountId: v.id("accounts"),
    relatedEntityType: v.union(
      v.literal("loan"),
      v.literal("exhibition"),
      v.literal("acquisition"),
      v.literal("item"),
    ),
    relatedEntityId: v.string(),
    relationshipType: v.union(
      v.literal("lender"),
      v.literal("borrower"),
      v.literal("donor"),
      v.literal("vendor"),
      v.literal("buyer"),
    ),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  },
  returns: v.id("accountRelationships"),
  handler: async (ctx, args) => {
    // Check for existing relationship (idempotent)
    const existing = await ctx.db
      .query("accountRelationships")
      .withIndex("by_organization_and_account", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("accountId", args.accountId),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("relatedEntityType"), args.relatedEntityType),
          q.eq(q.field("relatedEntityId"), args.relatedEntityId),
          q.eq(q.field("relationshipType"), args.relationshipType),
        ),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("accountRelationships", {
      organizationId: args.organizationId,
      accountId: args.accountId,
      relatedEntityType: args.relatedEntityType,
      relatedEntityId: args.relatedEntityId,
      relationshipType: args.relationshipType,
      startDate: args.startDate,
      endDate: args.endDate,
      notes: args.notes,
      createdAt: args.createdAt,
    });
  },
});

/**
 * Create account document
 * NOTE: storageId is required by schema - this mutation requires actual file upload
 */
export const createAccountDocument = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    accountId: v.id("accounts"),
    storageId: v.id("_storage"),
    filename: v.string(),
    mimeType: v.string(),
    size: v.number(),
    documentType: v.union(
      v.literal("contract"),
      v.literal("agreement"),
      v.literal("invoice"),
      v.literal("correspondence"),
      v.literal("other"),
    ),
    description: v.optional(v.string()),
    uploadedBy: v.id("users"),
    uploadedAt: v.number(),
  },
  returns: v.id("accountDocuments"),
  handler: async (ctx, args) => {
    // Check for existing document by storageId (idempotent)
    const existing = await ctx.db
      .query("accountDocuments")
      .withIndex("by_storage", (q) => q.eq("storageId", args.storageId))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("accountDocuments", {
      organizationId: args.organizationId,
      accountId: args.accountId,
      storageId: args.storageId,
      filename: args.filename,
      mimeType: args.mimeType,
      size: args.size,
      documentType: args.documentType,
      description: args.description,
      uploadedBy: args.uploadedBy,
      uploadedAt: args.uploadedAt,
    });
  },
});

/**
 * Create exhibition document
 * NOTE: storageId is required by schema - this mutation requires actual file upload
 */
export const createExhibitionDocument = internalMutation({
  args: {
    exhibitionId: v.id("exhibitions"),
    storageId: v.id("_storage"),
    documentType: v.union(
      v.literal("floor_plan"),
      v.literal("label"),
      v.literal("press_release"),
      v.literal("checklist"),
      v.literal("other"),
    ),
    fileName: v.string(),
    uploadedBy: v.id("users"),
    uploadedAt: v.number(),
  },
  returns: v.id("exhibitionDocuments"),
  handler: async (ctx, args) => {
    // Check for existing document by exhibition and storageId (idempotent)
    const existing = await ctx.db
      .query("exhibitionDocuments")
      .withIndex("by_exhibition", (q) =>
        q.eq("exhibitionId", args.exhibitionId),
      )
      .filter((q) => q.eq(q.field("storageId"), args.storageId))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("exhibitionDocuments", {
      exhibitionId: args.exhibitionId,
      storageId: args.storageId,
      documentType: args.documentType,
      fileName: args.fileName,
      uploadedBy: args.uploadedBy,
      uploadedAt: args.uploadedAt,
    });
  },
});

/**
 * Create conservation attachment
 * NOTE: storageId is required by schema - this mutation requires actual file upload
 */
export const createConservationAttachment = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    treatmentId: v.id("conservationTreatments"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    attachmentType: v.union(
      v.literal("before_photo"),
      v.literal("after_photo"),
      v.literal("during_photo"),
      v.literal("report"),
      v.literal("lab_notes"),
      v.literal("x_ray"),
      v.literal("uv_photo"),
      v.literal("microscopy"),
      v.literal("other"),
    ),
    caption: v.optional(v.string()),
    notes: v.optional(v.string()),
    takenAt: v.optional(v.number()),
    uploadedBy: v.id("users"),
    uploadedAt: v.number(),
  },
  returns: v.id("conservationAttachments"),
  handler: async (ctx, args) => {
    // Check for existing attachment by treatment and storageId (idempotent)
    const existing = await ctx.db
      .query("conservationAttachments")
      .withIndex("by_treatment", (q) => q.eq("treatmentId", args.treatmentId))
      .filter((q) => q.eq(q.field("storageId"), args.storageId))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("conservationAttachments", {
      organizationId: args.organizationId,
      treatmentId: args.treatmentId,
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: args.fileType,
      fileSize: args.fileSize,
      attachmentType: args.attachmentType,
      caption: args.caption,
      notes: args.notes,
      takenAt: args.takenAt,
      uploadedBy: args.uploadedBy,
      uploadedAt: args.uploadedAt,
    });
  },
});

/**
 * Create conservation alert rule
 */
export const createConservationAlertRule = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    triggerType: v.union(
      v.literal("condition_threshold"),
      v.literal("treatment_overdue"),
      v.literal("assessment_due"),
      v.literal("urgent_treatment"),
      v.literal("environmental"),
    ),
    conditionThreshold: v.optional(v.string()),
    daysOverdue: v.optional(v.number()),
    assessmentIntervalDays: v.optional(v.number()),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("critical"),
    ),
    notifyRoles: v.optional(v.array(v.id("roles"))),
    notifyUsers: v.optional(v.array(v.id("users"))),
    emailNotification: v.boolean(),
    inAppNotification: v.boolean(),
    isActive: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
  },
  returns: v.id("conservationAlertRules"),
  handler: async (ctx, args) => {
    // Check for existing rule by name (idempotent)
    const existing = await ctx.db
      .query("conservationAlertRules")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("conservationAlertRules", {
      organizationId: args.organizationId,
      name: args.name,
      description: args.description,
      triggerType: args.triggerType,
      conditionThreshold: args.conditionThreshold,
      daysOverdue: args.daysOverdue,
      assessmentIntervalDays: args.assessmentIntervalDays,
      priority: args.priority,
      notifyRoles: args.notifyRoles,
      notifyUsers: args.notifyUsers,
      emailNotification: args.emailNotification,
      inAppNotification: args.inAppNotification,
      isActive: args.isActive,
      createdBy: args.createdBy,
      createdAt: args.createdAt,
    });
  },
});

/**
 * Create object comment
 */
export const createObjectComment = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    objectId: v.id("collections"),
    userId: v.id("users"),
    content: v.string(),
    mentionedUserIds: v.optional(v.array(v.id("users"))),
    createdAt: v.number(),
  },
  returns: v.id("objectComments"),
  handler: async (ctx, args) => {
    // No idempotency check - comments can be duplicated
    return await ctx.db.insert("objectComments", {
      organizationId: args.organizationId,
      objectId: args.objectId,
      userId: args.userId,
      content: args.content,
      mentionedUserIds: args.mentionedUserIds,
      createdAt: args.createdAt,
    });
  },
});

/**
 * Create condition dispute
 */
export const createConditionDispute = internalMutation({
  args: {
    loanId: v.id("loans"),
    organizationId: v.id("organizations"),
    collectionId: v.id("collections"),
    conditionBefore: v.string(),
    conditionBeforeNotes: v.optional(v.string()),
    conditionAfter: v.string(),
    conditionAfterNotes: v.optional(v.string()),
    disputeDescription: v.string(),
    reportedBy: v.id("users"),
    reportedAt: v.number(),
    status: v.optional(
      v.union(
        v.literal("reported"),
        v.literal("investigating"),
        v.literal("resolved_in_favor_lender"),
        v.literal("resolved_in_favor_borrower"),
        v.literal("resolved_compromise"),
        v.literal("withdrawn"),
      ),
    ),
  },
  returns: v.id("conditionDisputes"),
  handler: async (ctx, args) => {
    // Check for existing dispute by loan and collection (idempotent)
    const existing = await ctx.db
      .query("conditionDisputes")
      .withIndex("by_loan", (q) => q.eq("loanId", args.loanId))
      .filter((q) => q.eq(q.field("collectionId"), args.collectionId))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("conditionDisputes", {
      loanId: args.loanId,
      organizationId: args.organizationId,
      collectionId: args.collectionId,
      conditionBefore: args.conditionBefore,
      conditionBeforeNotes: args.conditionBeforeNotes,
      conditionAfter: args.conditionAfter,
      conditionAfterNotes: args.conditionAfterNotes,
      disputeDescription: args.disputeDescription,
      reportedBy: args.reportedBy,
      reportedAt: args.reportedAt,
      status: args.status ?? "reported",
    });
  },
});

/**
 * Create API key
 */
export const createApiKey = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    prefix: v.string(),
    keyHash: v.string(),
    permissions: v.array(v.string()),
    expiresAt: v.optional(v.number()),
    isRevoked: v.optional(v.boolean()),
    createdBy: v.id("users"),
    createdAt: v.number(),
  },
  returns: v.id("apiKeys"),
  handler: async (ctx, args) => {
    // Check for existing key by prefix (idempotent)
    const existing = await ctx.db
      .query("apiKeys")
      .withIndex("by_prefix", (q) => q.eq("prefix", args.prefix))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("apiKeys", {
      organizationId: args.organizationId,
      name: args.name,
      prefix: args.prefix,
      keyHash: args.keyHash,
      permissions: args.permissions,
      expiresAt: args.expiresAt,
      isRevoked: args.isRevoked ?? false,
      createdBy: args.createdBy,
      createdAt: args.createdAt,
    });
  },
});

/**
 * Create webhook
 */
export const createWebhook = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    url: v.string(),
    secret: v.string(),
    events: v.array(v.string()),
    isActive: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
  },
  returns: v.id("webhooks"),
  handler: async (ctx, args) => {
    // Check for existing webhook by name (idempotent)
    const existing = await ctx.db
      .query("webhooks")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("webhooks", {
      organizationId: args.organizationId,
      name: args.name,
      url: args.url,
      secret: args.secret,
      events: args.events,
      isActive: args.isActive,
      createdBy: args.createdBy,
      createdAt: args.createdAt,
    });
  },
});

/**
 * Create scheduled report
 */
export const createScheduledReport = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    reportType: v.union(
      v.literal("collection_health"),
      v.literal("conservation_status"),
      v.literal("insurance_coverage"),
      v.literal("location_utilization"),
      v.literal("loan_performance"),
      v.literal("accession_activity"),
      v.literal("deaccession_activity"),
      v.literal("media_rights"),
      v.literal("compliance_audit"),
      v.literal("operational_kpis"),
      v.literal("custom"),
    ),
    schedule: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("quarterly"),
      v.literal("on_demand"),
    ),
    emailRecipients: v.optional(v.array(v.string())),
    isActive: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
  },
  returns: v.id("scheduledReports"),
  handler: async (ctx, args) => {
    // Check for existing report by name (idempotent)
    const existing = await ctx.db
      .query("scheduledReports")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("scheduledReports", {
      organizationId: args.organizationId,
      name: args.name,
      description: args.description,
      reportType: args.reportType,
      schedule: args.schedule,
      emailRecipients: args.emailRecipients,
      isActive: args.isActive,
      createdBy: args.createdBy,
      createdAt: args.createdAt,
    });
  },
});

/**
 * Create notification preference
 */
export const createNotificationPreference = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    enableApprovals: v.optional(v.boolean()),
    enableReminders: v.optional(v.boolean()),
    enableAlerts: v.optional(v.boolean()),
    enableAssignments: v.optional(v.boolean()),
    enableSystem: v.optional(v.boolean()),
    emailEnabled: v.optional(v.boolean()),
    updatedAt: v.optional(v.number()),
  },
  returns: v.id("notificationPreferences"),
  handler: async (ctx, args) => {
    // Check for existing preference (idempotent)
    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user_and_organization", (q) =>
        q.eq("userId", args.userId).eq("organizationId", args.organizationId),
      )
      .first();

    if (existing) {
      // Update existing preference
      await ctx.db.patch(existing._id, {
        enableApprovals: args.enableApprovals,
        enableReminders: args.enableReminders,
        enableAlerts: args.enableAlerts,
        enableAssignments: args.enableAssignments,
        enableSystem: args.enableSystem,
        emailEnabled: args.emailEnabled,
        updatedAt: args.updatedAt,
      });
      return existing._id;
    }

    return await ctx.db.insert("notificationPreferences", {
      userId: args.userId,
      organizationId: args.organizationId,
      enableApprovals: args.enableApprovals,
      enableReminders: args.enableReminders,
      enableAlerts: args.enableAlerts,
      enableAssignments: args.enableAssignments,
      enableSystem: args.enableSystem,
      emailEnabled: args.emailEnabled,
      updatedAt: args.updatedAt,
    });
  },
});

/**
 * Create library vendor
 */
export const createLibraryVendor = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    contactName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    website: v.optional(v.string()),
    address: v.optional(v.string()),
    accountNumber: v.optional(v.string()),
    paymentTerms: v.optional(v.string()),
    discountPercent: v.optional(v.number()),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
  },
  returns: v.id("libraryVendors"),
  handler: async (ctx, args) => {
    // Check for existing vendor by name (idempotent)
    const existing = await ctx.db
      .query("libraryVendors")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("libraryVendors", {
      organizationId: args.organizationId,
      name: args.name,
      contactName: args.contactName,
      email: args.email,
      phone: args.phone,
      website: args.website,
      address: args.address,
      accountNumber: args.accountNumber,
      paymentTerms: args.paymentTerms,
      discountPercent: args.discountPercent,
      notes: args.notes,
      isActive: args.isActive,
      createdAt: args.createdAt,
    });
  },
});

/**
 * Create library acquisition request
 */
export const createLibraryAcquisitionRequest = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    title: v.string(),
    authors: v.optional(v.array(v.string())),
    isbn: v.optional(v.string()),
    publisher: v.optional(v.string()),
    itemType: v.optional(v.string()),
    requestedBy: v.id("users"),
    requestedAt: v.number(),
    reason: v.optional(v.string()),
    priority: v.union(
      v.literal("low"),
      v.literal("normal"),
      v.literal("high"),
      v.literal("urgent"),
    ),
    quantity: v.number(),
    status: v.optional(
      v.union(
        v.literal("submitted"),
        v.literal("under_review"),
        v.literal("approved"),
        v.literal("ordered"),
        v.literal("received"),
        v.literal("cataloged"),
        v.literal("rejected"),
        v.literal("cancelled"),
      ),
    ),
    notes: v.optional(v.string()),
  },
  returns: v.id("libraryAcquisitionRequests"),
  handler: async (ctx, args) => {
    // Check for existing request by title and requestedBy (idempotent)
    const existing = await ctx.db
      .query("libraryAcquisitionRequests")
      .withIndex("by_requestedBy", (q) => q.eq("requestedBy", args.requestedBy))
      .filter((q) =>
        q.and(
          q.eq(q.field("title"), args.title),
          q.eq(q.field("organizationId"), args.organizationId),
        ),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("libraryAcquisitionRequests", {
      organizationId: args.organizationId,
      title: args.title,
      authors: args.authors,
      isbn: args.isbn,
      publisher: args.publisher,
      itemType: args.itemType,
      requestedBy: args.requestedBy,
      requestedAt: args.requestedAt,
      reason: args.reason,
      priority: args.priority,
      quantity: args.quantity,
      status: args.status ?? "submitted",
      notes: args.notes,
    });
  },
});

/**
 * Create serial subscription
 */
export const createSerialSubscription = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    itemId: v.id("libraryItems"),
    vendorId: v.optional(v.id("libraryVendors")),
    subscriptionNumber: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    frequency: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("biweekly"),
      v.literal("monthly"),
      v.literal("bimonthly"),
      v.literal("quarterly"),
      v.literal("annually"),
      v.literal("irregular"),
    ),
    expectedIssues: v.optional(v.number()),
    cost: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("cancelled"),
        v.literal("expired"),
        v.literal("pending_renewal"),
      ),
    ),
    autoRenew: v.boolean(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  },
  returns: v.id("serialSubscriptions"),
  handler: async (ctx, args) => {
    // Check for existing subscription by item (idempotent)
    const existing = await ctx.db
      .query("serialSubscriptions")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("serialSubscriptions", {
      organizationId: args.organizationId,
      itemId: args.itemId,
      vendorId: args.vendorId,
      subscriptionNumber: args.subscriptionNumber,
      startDate: args.startDate,
      endDate: args.endDate,
      frequency: args.frequency,
      expectedIssues: args.expectedIssues,
      cost: args.cost,
      status: args.status ?? "active",
      autoRenew: args.autoRenew,
      notes: args.notes,
      createdAt: args.createdAt,
    });
  },
});

/**
 * Create serial issue
 */
export const createSerialIssue = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    subscriptionId: v.id("serialSubscriptions"),
    itemId: v.id("libraryItems"),
    issueNumber: v.optional(v.string()),
    volume: v.optional(v.string()),
    issueDate: v.optional(v.number()),
    receivedDate: v.optional(v.number()),
    status: v.union(
      v.literal("expected"),
      v.literal("received"),
      v.literal("claimed"),
      v.literal("missing"),
    ),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  },
  returns: v.id("serialIssues"),
  handler: async (ctx, args) => {
    // Check for existing issue by subscription and issue number (idempotent)
    const existing = await ctx.db
      .query("serialIssues")
      .withIndex("by_subscription", (q) =>
        q.eq("subscriptionId", args.subscriptionId),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("issueNumber"), args.issueNumber),
          q.eq(q.field("volume"), args.volume),
        ),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("serialIssues", {
      organizationId: args.organizationId,
      subscriptionId: args.subscriptionId,
      itemId: args.itemId,
      issueNumber: args.issueNumber,
      volume: args.volume,
      issueDate: args.issueDate,
      receivedDate: args.receivedDate,
      status: args.status,
      notes: args.notes,
      createdAt: args.createdAt,
    });
  },
});

// ========================================
// PHASE 14: LOCATION ASSIGNMENT HELPERS
// ========================================

export const getLocationsForOrg = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    types: v.optional(v.array(v.string())),
  },
  returns: v.array(
    v.object({
      _id: v.id("locations"),
      name: v.string(),
      type: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const locations = await ctx.db
      .query("locations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const filtered = args.types
      ? locations.filter((l) => args.types!.includes(l.type))
      : locations;

    return filtered.map((l) => ({ _id: l._id, name: l.name, type: l.type }));
  },
});

export const getCollectionsWithoutLocation = internalQuery({
  args: { organizationId: v.id("organizations") },
  returns: v.array(
    v.object({
      _id: v.id("collections"),
      status: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const collections = await ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    return collections.flatMap((collection) =>
      collection.currentLocationId === undefined &&
      collection.status !== "loaned" &&
      collection.status !== "deaccessioned"
        ? [{ _id: collection._id, status: collection.status }]
        : [],
    );
  },
});

export const updateCollectionLocation = internalMutation({
  args: {
    collectionId: v.id("collections"),
    locationId: v.id("locations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.collectionId, {
      currentLocationId: args.locationId,
    });
    return null;
  },
});

/**
 * Get library items for an organization (for seeding serial subscriptions)
 */
export const getLibraryItems = internalQuery({
  args: { organizationId: v.id("organizations") },
  returns: v.array(
    v.object({
      _id: v.id("libraryItems"),
      title: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("libraryItems")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();
    return items.map((i) => ({ _id: i._id, title: i.title }));
  },
});

/**
 * Verify entity counts for an organization after seeding
 * Returns counts of all seeded entity types for verification
 */
export const verifyEntityCounts = internalQuery({
  args: { organizationId: v.id("organizations") },
  returns: v.object({
    collections: v.number(),
    collectionGroups: v.number(),
    locations: v.number(),
    mediaFiles: v.number(),
    fineArtDetails: v.number(),
    wineDetails: v.number(),
    vehicleDetails: v.number(),
    naturalHistoryDetails: v.number(),
    archiveDetails: v.number(),
    loans: v.number(),
    conditionDisputes: v.number(),
    accounts: v.number(),
    accountRelationships: v.number(),
    accountDocuments: v.number(),
    contacts: v.number(),
    exhibitions: v.number(),
    exhibitionObjects: v.number(),
    conservationTreatments: v.number(),
    conservationAttachments: v.number(),
    conservationAlertRules: v.number(),
    conservationAlerts: v.number(),
    assessmentSchedules: v.number(),
    accessions: v.number(),
    deaccessions: v.number(),
    appraisals: v.number(),
    apiKeys: v.number(),
    webhooks: v.number(),
    scheduledReports: v.number(),
    notificationPreferences: v.number(),
    objectComments: v.number(),
    libraryItems: v.number(),
    itemCopies: v.number(),
    circulations: v.number(),
    libraryHolds: v.number(),
    libraryVendors: v.number(),
    libraryAcquisitionRequests: v.number(),
    serialSubscriptions: v.number(),
    serialIssues: v.number(),
    insurancePolicies: v.number(),
    insuranceCoverages: v.number(),
    insuranceClaims: v.number(),
    transitRecords: v.number(),
    workflowConfigs: v.number(),
  }),
  handler: async (ctx, args) => {
    const { organizationId } = args;

    const notificationPrefs = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user_and_organization")
      .collect();

    return {
      collections: (
        await ctx.db
          .query("collections")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      collectionGroups: (
        await ctx.db
          .query("collectionGroups")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      locations: (
        await ctx.db
          .query("locations")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      mediaFiles: (
        await ctx.db
          .query("mediaFiles")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      fineArtDetails: (
        await ctx.db
          .query("fineArtDetails")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      wineDetails: (
        await ctx.db
          .query("wineDetails")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      vehicleDetails: (
        await ctx.db
          .query("vehicleDetails")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      naturalHistoryDetails: (
        await ctx.db
          .query("naturalHistoryDetails")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      archiveDetails: (
        await ctx.db
          .query("archiveDetails")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      loans: (
        await ctx.db
          .query("loans")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      conditionDisputes: (
        await ctx.db
          .query("conditionDisputes")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      accounts: (
        await ctx.db
          .query("accounts")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      accountRelationships: (
        await ctx.db
          .query("accountRelationships")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      accountDocuments: (
        await ctx.db
          .query("accountDocuments")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      contacts: (
        await ctx.db
          .query("contacts")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      exhibitions: (
        await ctx.db
          .query("exhibitions")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      exhibitionObjects: (
        await ctx.db
          .query("exhibitionObjects")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      conservationTreatments: (
        await ctx.db
          .query("conservationTreatments")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      conservationAttachments: (
        await ctx.db
          .query("conservationAttachments")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      conservationAlertRules: (
        await ctx.db
          .query("conservationAlertRules")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      conservationAlerts: (
        await ctx.db
          .query("conservationAlerts")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      assessmentSchedules: (
        await ctx.db
          .query("assessmentSchedules")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      accessions: (
        await ctx.db
          .query("accessions")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      deaccessions: (
        await ctx.db
          .query("deaccessions")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      appraisals: (
        await ctx.db
          .query("appraisals")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      apiKeys: (
        await ctx.db
          .query("apiKeys")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      webhooks: (
        await ctx.db
          .query("webhooks")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      scheduledReports: (
        await ctx.db
          .query("scheduledReports")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      notificationPreferences: notificationPrefs.filter(
        (p) => p.organizationId === organizationId,
      ).length,
      objectComments: (
        await ctx.db
          .query("objectComments")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      libraryItems: (
        await ctx.db
          .query("libraryItems")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      itemCopies: (
        await ctx.db
          .query("itemCopies")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      circulations: (
        await ctx.db
          .query("circulations")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      libraryHolds: (
        await ctx.db
          .query("libraryHolds")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      libraryVendors: (
        await ctx.db
          .query("libraryVendors")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      libraryAcquisitionRequests: (
        await ctx.db
          .query("libraryAcquisitionRequests")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      serialSubscriptions: (
        await ctx.db
          .query("serialSubscriptions")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      serialIssues: (
        await ctx.db
          .query("serialIssues")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      insurancePolicies: (
        await ctx.db
          .query("insurancePolicies")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      insuranceCoverages: (
        await ctx.db
          .query("insuranceCoverages")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      insuranceClaims: (
        await ctx.db
          .query("insuranceClaims")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      transitRecords: (
        await ctx.db
          .query("transitRecords")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
      workflowConfigs: (
        await ctx.db
          .query("workflowConfigs")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organizationId),
          )
          .collect()
      ).length,
    };
  },
});

const deepLocationTargetValidator = v.object({
  _id: v.id("locations"),
  name: v.string(),
  type: v.string(),
  sortOrder: v.number(),
  capacity: v.optional(v.number()),
  path: v.array(v.string()),
});

const movableCollectionValidator = v.object({
  _id: v.id("collections"),
  accessionNumber: v.string(),
  title: v.string(),
  status: v.string(),
  currentLocationId: v.optional(v.id("locations")),
});

const deepLocationOrganizationSummaryValidator = v.object({
  organizationId: v.id("organizations"),
  organizationName: v.string(),
  targetLocationCount: v.number(),
  objectCount: v.number(),
  reassigned: v.number(),
  unchanged: v.number(),
  skippedNoCapacity: v.number(),
  skippedNoEligibleLocation: v.number(),
});

const deepLocationReassignmentSummaryValidator = v.object({
  userId: v.id("users"),
  organizationCount: v.number(),
  organizationsProcessed: v.number(),
  objectsConsidered: v.number(),
  objectsReassigned: v.number(),
  objectsUnchanged: v.number(),
  objectsSkippedNoEligibleLocation: v.number(),
  objectsSkippedNoCapacity: v.number(),
  organizationsSkippedNoLocations: v.number(),
  organizations: v.array(deepLocationOrganizationSummaryValidator),
});

const DEEP_LOCATION_REASSIGNMENT_REASON =
  "Deep location reassignment (maintenance)";
const DEEP_LOCATION_REASSIGNMENT_NOTES =
  "Assigned to deepest eligible leaf location for seeded maintenance user";
const PREFERRED_DEEP_LOCATION_TYPES = new Set(["shelf", "vitrine"]);
const EXCLUDED_COLLECTION_STATUSES = new Set(["loaned", "deaccessioned"]);

type LocationRecord = {
  _id: Id<"locations">;
  name: string;
  type: string;
  sortOrder: number;
  parentLocationId?: Id<"locations">;
  isActive: boolean;
  status?: "active" | "closed" | "renovation" | "restricted";
  capacity?: number;
};

type UserOrganizationContext = {
  userId: Id<"users">;
  organizationIds: Array<Id<"organizations">>;
};

type DeepLocationTarget = {
  _id: Id<"locations">;
  name: string;
  type: string;
  sortOrder: number;
  capacity?: number;
  path: string[];
};

type MovableCollection = {
  _id: Id<"collections">;
  accessionNumber: string;
  title: string;
  status: string;
  currentLocationId?: Id<"locations">;
};

type DeepLocationOrganizationSummary = {
  organizationId: Id<"organizations">;
  organizationName: string;
  targetLocationCount: number;
  objectCount: number;
  reassigned: number;
  unchanged: number;
  skippedNoCapacity: number;
  skippedNoEligibleLocation: number;
};

type DeepLocationReassignmentSummary = {
  userId: Id<"users">;
  organizationCount: number;
  organizationsProcessed: number;
  objectsConsidered: number;
  objectsReassigned: number;
  objectsUnchanged: number;
  objectsSkippedNoEligibleLocation: number;
  objectsSkippedNoCapacity: number;
  organizationsSkippedNoLocations: number;
  organizations: DeepLocationOrganizationSummary[];
};

function buildLocationPathParts(
  locationId: Id<"locations">,
  locationsById: ReadonlyMap<Id<"locations">, LocationRecord>,
) {
  const pathParts: Array<{
    _id: Id<"locations">;
    name: string;
    sortOrder: number;
  }> = [];
  const visited = new Set<Id<"locations">>();
  let currentLocationId: Id<"locations"> | undefined = locationId;

  while (currentLocationId && !visited.has(currentLocationId)) {
    visited.add(currentLocationId);
    const location = locationsById.get(currentLocationId);
    if (!location) {
      break;
    }
    pathParts.unshift({
      _id: location._id,
      name: location.name,
      sortOrder: location.sortOrder,
    });
    currentLocationId = location.parentLocationId;
  }

  return pathParts;
}

function compareLocationRecords(
  locationsById: ReadonlyMap<Id<"locations">, LocationRecord>,
  left: LocationRecord,
  right: LocationRecord,
) {
  const leftPath = buildLocationPathParts(left._id, locationsById)
    .map((part) => `${part.sortOrder}:${part.name}:${part._id}`)
    .join(" / ");
  const rightPath = buildLocationPathParts(right._id, locationsById)
    .map((part) => `${part.sortOrder}:${part.name}:${part._id}`)
    .join(" / ");

  return (
    leftPath.localeCompare(rightPath) ||
    left.sortOrder - right.sortOrder ||
    left.name.localeCompare(right.name) ||
    left._id.localeCompare(right._id)
  );
}

function isEligibleDeepTargetLocation(location: LocationRecord) {
  return (
    location.isActive &&
    location.status !== "closed" &&
    location.status !== "restricted" &&
    location.status !== "renovation"
  );
}

function compareMovableCollections(
  left: {
    _id: Id<"collections">;
    accessionNumber: string;
    title: string;
  },
  right: {
    _id: Id<"collections">;
    accessionNumber: string;
    title: string;
  },
) {
  return (
    left.accessionNumber.localeCompare(right.accessionNumber) ||
    left.title.localeCompare(right.title) ||
    left._id.localeCompare(right._id)
  );
}

export const getUserOrganizationsByEmail = internalQuery({
  args: {
    email: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      userId: v.id("users"),
      organizationIds: v.array(v.id("organizations")),
    }),
  ),
  handler: async (ctx, args): Promise<UserOrganizationContext | null> => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();
    const userId = user?._id;

    if (!userId) {
      return null;
    }

    const memberships = await ctx.db
      .query("userOrganizations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return {
      userId,
      organizationIds: memberships.map(
        (membership) => membership.organizationId,
      ),
    };
  },
});

export const getEligibleDeepLocations = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(deepLocationTargetValidator),
  handler: async (ctx, args): Promise<DeepLocationTarget[]> => {
    const locations = await ctx.db
      .query("locations")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    const activeLocations = locations.filter((location) => location.isActive);
    const activeChildParentIds = new Set<Id<"locations">>();
    for (const location of activeLocations) {
      if (location.parentLocationId) {
        activeChildParentIds.add(location.parentLocationId);
      }
    }

    const locationsById = new Map(
      locations.map((location) => [
        location._id,
        {
          _id: location._id,
          name: location.name,
          type: location.type,
          sortOrder: location.sortOrder,
          parentLocationId: location.parentLocationId,
          isActive: location.isActive,
          status: location.status,
          capacity: location.capacity,
        },
      ]),
    );

    const leafLocations = activeLocations.filter(
      (location) => !activeChildParentIds.has(location._id),
    );

    const eligibleLeafLocations = leafLocations
      .flatMap((location) => {
        if (!isEligibleDeepTargetLocation(location)) {
          return [];
        }

        const fullLocation = locationsById.get(location._id);
        return fullLocation === undefined ? [] : [fullLocation];
      })
      .sort((left, right) =>
        compareLocationRecords(locationsById, left, right),
      );

    const preferredLocations = eligibleLeafLocations.filter((location) =>
      PREFERRED_DEEP_LOCATION_TYPES.has(location.type),
    );
    const selectedLocations =
      preferredLocations.length > 0
        ? preferredLocations
        : eligibleLeafLocations.filter(
            (location) => !PREFERRED_DEEP_LOCATION_TYPES.has(location.type),
          );

    return selectedLocations.map((location) => ({
      _id: location._id,
      name: location.name,
      type: location.type,
      sortOrder: location.sortOrder,
      capacity: location.capacity,
      path: buildLocationPathParts(location._id, locationsById).map(
        (part) => part.name,
      ),
    }));
  },
});

export const getMovableCollectionsForOrganization = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(movableCollectionValidator),
  handler: async (ctx, args): Promise<MovableCollection[]> => {
    const collections = await ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    return collections
      .filter(
        (collection) => !EXCLUDED_COLLECTION_STATUSES.has(collection.status),
      )
      .sort(compareMovableCollections)
      .map((collection) => ({
        _id: collection._id,
        accessionNumber: collection.accessionNumber,
        title: collection.title,
        status: collection.status,
        currentLocationId: collection.currentLocationId,
      }));
  },
});

export const reassignObjectsToDeepLocationsForUser = internalMutation({
  args: {
    userId: v.id("users"),
    organizationIds: v.array(v.id("organizations")),
  },
  returns: deepLocationReassignmentSummaryValidator,
  handler: async (ctx, args): Promise<DeepLocationReassignmentSummary> => {
    const summary: DeepLocationReassignmentSummary = {
      userId: args.userId,
      organizationCount: args.organizationIds.length,
      organizationsProcessed: 0,
      objectsConsidered: 0,
      objectsReassigned: 0,
      objectsUnchanged: 0,
      objectsSkippedNoEligibleLocation: 0,
      objectsSkippedNoCapacity: 0,
      organizationsSkippedNoLocations: 0,
      organizations: [],
    };

    for (const organizationId of args.organizationIds) {
      const organization = await ctx.db.get(organizationId);
      if (!organization) {
        continue;
      }

      const movableCollections = await ctx.runQuery(
        internal.seedMet.getMovableCollectionsForOrganization,
        { organizationId },
      );

      if (movableCollections.length === 0) {
        continue;
      }

      summary.organizationsProcessed += 1;
      summary.objectsConsidered += movableCollections.length;

      const targetLocations = await ctx.runQuery(
        internal.seedMet.getEligibleDeepLocations,
        { organizationId },
      );

      const organizationSummary = {
        organizationId,
        organizationName: organization.name,
        targetLocationCount: targetLocations.length,
        objectCount: movableCollections.length,
        reassigned: 0,
        unchanged: 0,
        skippedNoCapacity: 0,
        skippedNoEligibleLocation: 0,
      };

      if (targetLocations.length === 0) {
        organizationSummary.skippedNoEligibleLocation =
          movableCollections.length;
        summary.objectsSkippedNoEligibleLocation += movableCollections.length;
        summary.organizationsSkippedNoLocations += 1;
        summary.organizations.push(organizationSummary);
        continue;
      }

      const allCollections = await ctx.db
        .query("collections")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId),
        )
        .collect();

      const targetLocationIds = new Set(
        targetLocations.map(
          (targetLocation: DeepLocationTarget) => targetLocation._id,
        ),
      );
      const occupancyByLocationId = new Map<Id<"locations">, number>();

      for (const collection of allCollections) {
        if (
          collection.currentLocationId &&
          targetLocationIds.has(collection.currentLocationId)
        ) {
          occupancyByLocationId.set(
            collection.currentLocationId,
            (occupancyByLocationId.get(collection.currentLocationId) ?? 0) + 1,
          );
        }
      }

      let roundRobinIndex = 0;

      for (const collection of movableCollections) {
        let selectedTarget = null as (typeof targetLocations)[number] | null;

        for (let offset = 0; offset < targetLocations.length; offset += 1) {
          const candidate =
            targetLocations[
              (roundRobinIndex + offset) % targetLocations.length
            ]!;
          const currentOccupancy =
            (occupancyByLocationId.get(candidate._id) ?? 0) -
            (collection.currentLocationId === candidate._id ? 1 : 0);

          if (
            candidate.capacity === undefined ||
            currentOccupancy < candidate.capacity
          ) {
            selectedTarget = candidate;
            roundRobinIndex =
              (roundRobinIndex + offset) % targetLocations.length;
            break;
          }
        }

        if (!selectedTarget) {
          organizationSummary.skippedNoCapacity += 1;
          summary.objectsSkippedNoCapacity += 1;
          continue;
        }

        if (collection.currentLocationId === selectedTarget._id) {
          organizationSummary.unchanged += 1;
          summary.objectsUnchanged += 1;
          roundRobinIndex = (roundRobinIndex + 1) % targetLocations.length;
          continue;
        }

        if (
          collection.currentLocationId &&
          targetLocationIds.has(collection.currentLocationId)
        ) {
          occupancyByLocationId.set(
            collection.currentLocationId,
            Math.max(
              0,
              (occupancyByLocationId.get(collection.currentLocationId) ?? 0) -
                1,
            ),
          );
        }

        occupancyByLocationId.set(
          selectedTarget._id,
          (occupancyByLocationId.get(selectedTarget._id) ?? 0) + 1,
        );

        const movedAt = Date.now();
        await ctx.db.patch(collection._id, {
          currentLocationId: selectedTarget._id,
          lastModifiedBy: args.userId,
          lastModifiedAt: movedAt,
        });

        await ctx.db.insert("locationHistory", {
          collectionId: collection._id,
          fromLocationId: collection.currentLocationId,
          toLocationId: selectedTarget._id,
          movedBy: args.userId,
          movedAt,
          reason: DEEP_LOCATION_REASSIGNMENT_REASON,
          notes: DEEP_LOCATION_REASSIGNMENT_NOTES,
        });

        organizationSummary.reassigned += 1;
        summary.objectsReassigned += 1;
        roundRobinIndex = (roundRobinIndex + 1) % targetLocations.length;
      }

      summary.organizations.push(organizationSummary);
    }

    return summary;
  },
});
