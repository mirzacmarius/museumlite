import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Type-safe validators for flexible data structures

/**
 * Custom field value - union of allowed types for user-defined fields
 * Supports strings, numbers, booleans, dates (as numbers), and arrays of strings
 */
export const customFieldValue = v.union(
  v.string(),
  v.number(),
  v.boolean(),
  v.null(),
  v.array(v.string()),
);

/**
 * Audit log changes - flexible type for tracking various change formats
 * Supports: { reason }, { field, oldValue, newValue }, { previousStatus }, complex nested objects, etc.
 * Using v.any() because audit logs can contain diverse data structures
 */
export const auditLogChanges = v.any();

/**
 * Filter condition for dynamic queries (account segments, saved searches)
 */
export const filterCondition = v.object({
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
});

/**
 * Metadata record - generic key-value store for external integrations
 */
export const metadataRecord = v.record(
  v.string(),
  v.union(v.string(), v.number(), v.boolean(), v.null()),
);

/**
 * Provenance chain entry - tracks ownership history for fine art
 */
export const provenanceChainEntry = v.object({
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
  documentIds: v.optional(v.array(v.id("_storage"))),
  notes: v.optional(v.string()),
  verified: v.optional(v.boolean()),
});

/**
 * Shipping log entry - tracks transportation history
 */
export const shippingLogEntry = v.object({
  fromLocation: v.string(),
  toLocation: v.string(),
  carrier: v.optional(v.string()),
  trackingNumber: v.optional(v.string()),
  departedAt: v.optional(v.number()),
  arrivedAt: v.optional(v.number()),
  conditionBefore: v.optional(v.string()),
  conditionAfter: v.optional(v.string()),
  notes: v.optional(v.string()),
});

export default defineSchema({
  ...authTables,
  users: defineTable({
    // Convex Auth fields
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),

    // custom fields
    username: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
  }).index("email", ["email"]),

  // Multi-tenant organizations
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    logoId: v.optional(v.id("_storage")),
    type: v.union(
      v.literal("museum"),
      v.literal("gallery"),
      v.literal("library"),
      v.literal("collector"),
    ),
    settings: v.optional(
      v.object({
        accessionNumberFormat: v.optional(v.string()),
        accessionCounterScope: v.optional(
          v.union(
            v.literal("global"),
            v.literal("year"),
            v.literal("month"),
            v.literal("day"),
          ),
        ),
        autoGenerateAccessionNumbers: v.optional(v.boolean()),
        locationTypes: v.optional(v.array(v.string())),
        enableDetailedConditionReports: v.optional(v.boolean()),
        enabledIntegrations: v.optional(v.array(v.string())),
        enabledModules: v.optional(
          v.array(
            v.union(
              v.literal("fine_art"),
              v.literal("wine"),
              v.literal("automotive"),
              v.literal("natural_history"),
              v.literal("archive"),
              v.literal("library"),
              v.literal("accounts"),
            ),
          ),
        ),
        defaultCollectionType: v.optional(
          v.union(
            v.literal("fine_art"),
            v.literal("wine"),
            v.literal("automotive"),
            v.literal("natural_history"),
            v.literal("archive"),
            v.literal("general"),
          ),
        ),
        portalSettings: v.optional(
          v.object({
            isEnabled: v.optional(v.boolean()),
            isSearchEnabled: v.optional(v.boolean()),
            isHighResEnabled: v.optional(v.boolean()),
            isValuationVisible: v.optional(v.boolean()),
            portalSlug: v.optional(v.string()),
          }),
        ),
        watermarkSettings: v.optional(
          v.object({
            isEnabled: v.optional(v.boolean()),
            text: v.optional(v.string()),
            opacity: v.optional(v.number()),
            position: v.optional(
              v.union(
                v.literal("center"),
                v.literal("top-left"),
                v.literal("top-right"),
                v.literal("bottom-left"),
                v.literal("bottom-right"),
              ),
            ),
          }),
        ),
      }),
    ),
    subscriptionTier: v.optional(
      v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
    ),
  }).index("by_slug", ["slug"]),

  // User-organization relationships with roles
  userOrganizations: defineTable({
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    roleId: v.id("roles"),
    invitedBy: v.optional(v.id("users")),
    joinedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_organization", ["organizationId"])
    .index("by_user_and_organization", ["userId", "organizationId"]),

  // Role definitions per organization
  roles: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    isSystemRole: v.boolean(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_name", ["organizationId", "name"]),

  // Granular permission definitions
  permissions: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    category: v.union(
      v.literal("collections"),
      v.literal("loans"),
      v.literal("locations"),
      v.literal("sites"),
      v.literal("media"),
      v.literal("users"),
      v.literal("organization"),
      v.literal("accounts"),
    ),
  }).index("by_category", ["category"]),

  // Many-to-many roles-permissions
  rolePermissions: defineTable({
    roleId: v.id("roles"),
    permissionId: v.id("permissions"),
  })
    .index("by_role", ["roleId"])
    .index("by_permission", ["permissionId"]),

  // Organization invitations for pending user invites
  organizationInvitations: defineTable({
    organizationId: v.id("organizations"),
    email: v.string(),
    roleId: v.id("roles"),
    token: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("expired"),
    ),
    invitedBy: v.id("users"),
    expiresAt: v.number(),
    createdAt: v.number(),
    acceptedAt: v.optional(v.number()),
    acceptedBy: v.optional(v.id("users")),
  })
    .index("by_organization", ["organizationId"])
    .index("by_token", ["token"])
    .index("by_email", ["email"]),

  // Sites for multi-location organizations
  sites: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    address: v.optional(v.string()),
    isActive: v.boolean(),
    isPrimary: v.boolean(),
  }).index("by_organization", ["organizationId"]),

  // User-site access assignments
  userSites: defineTable({
    userId: v.id("users"),
    siteId: v.id("sites"),
    canAccess: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_site", ["siteId"])
    .index("by_user_and_site", ["userId", "siteId"]),

  // User search history for autocomplete
  searchHistory: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    module: v.union(
      v.literal("objects"),
      v.literal("loans"),
      v.literal("accounts"),
      v.literal("locations"),
      v.literal("accessions"),
    ),
    query: v.string(),
    filters: v.optional(v.string()),
    resultCount: v.optional(v.number()),
    searchedAt: v.number(),
  })
    .index("by_user_and_searched_at", ["userId", "searchedAt"])
    .index("by_user_and_module", ["userId", "module"])
    .index("by_organization_and_user", ["organizationId", "userId"]),

  // Collection Groups (Virtual collections of objects)
  collectionGroups: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    curatorId: v.optional(v.id("users")),
    imageId: v.optional(v.id("_storage")),
    managedByRoleId: v.optional(v.id("roles")),
    itemsCount: v.optional(v.number()),
    storageLocation: v.optional(v.string()),
    valuation: v.optional(v.number()),
    createdAt: v.number(),
    createdBy: v.id("users"),
    lastModifiedAt: v.optional(v.number()),
    lastModifiedBy: v.optional(v.id("users")),
  })
    .index("by_organization", ["organizationId"])
    .index("by_curator", ["curatorId"])
    .index("by_managedByRole", ["managedByRoleId"])
    .searchIndex("search_index", {
      searchField: "name",
      filterFields: ["organizationId"],
    }),

  // Many-to-many relationship between collections and collection groups
  // An object can be part of multiple collection groups
  collectionGroupItems: defineTable({
    collectionGroupId: v.id("collectionGroups"),
    collectionId: v.id("collections"),
    addedAt: v.number(),
    addedBy: v.id("users"),
  })
    .index("by_collectionGroup", ["collectionGroupId"])
    .index("by_collection", ["collectionId"])
    .index("by_collectionGroup_and_collection", [
      "collectionGroupId",
      "collectionId",
    ]),

  // Main cataloging table
  collections: defineTable({
    organizationId: v.id("organizations"),
    collectionGroupId: v.optional(v.id("collectionGroups")),
    accessionNumber: v.string(), // Primary accession number
    alternateAccessionNumbers: v.optional(v.array(v.string())),
    accessionNumberHistory: v.optional(
      v.array(
        v.object({
          number: v.string(),
          validFrom: v.number(),
          validTo: v.optional(v.number()),
        }),
      ),
    ),
    title: v.string(),
    alternativeTitle: v.optional(v.string()), // Alternative/subtitle
    creator: v.optional(v.string()), // Artist/maker name
    objectType: v.optional(v.string()),
    objectName: v.optional(v.string()),
    culture: v.optional(v.string()),
    period: v.optional(v.string()),
    dateCreated: v.optional(v.string()),
    materials: v.optional(v.string()),
    technique: v.optional(v.string()), // e.g., "Carved, Drill-work, Polished"
    dimensions: v.optional(v.string()),
    // Detailed dimensions
    dimensionHeight: v.optional(v.number()), // in cm
    dimensionWidth: v.optional(v.number()), // in cm
    dimensionDepth: v.optional(v.number()), // in cm
    dimensionWeight: v.optional(v.number()), // in kg
    dimensionUnit: v.optional(v.string()), // "cm", "in", etc.
    weightUnit: v.optional(v.string()), // "kg", "lb", etc.
    description: v.optional(v.string()),
    condition: v.optional(v.string()),
    inscriptions: v.optional(v.string()), // Free-text description of inscriptions/marks
    inscriptionMarks: v.optional(
      v.array(
        v.object({
          label: v.string(), // e.g., "Mark A", "Mark B"
          description: v.string(), // e.g., "Red painted accession number..."
        }),
      ),
    ),
    tags: v.optional(v.array(v.string())), // e.g., ["Imperial Portraiture", "Bearded", "Antonine"]
    provenance: v.optional(v.string()),
    exhibitionHistory: v.optional(v.string()),
    // Structured provenance/ownership history
    ownershipHistory: v.optional(
      v.array(
        v.object({
          owner: v.string(),
          startYear: v.optional(v.string()),
          endYear: v.optional(v.string()),
          description: v.optional(v.string()),
          verified: v.optional(v.boolean()),
          verificationSource: v.optional(v.string()),
        }),
      ),
    ),
    donated_by: v.optional(v.array(v.string())), // List of donors (persons/organizations)
    donated_date: v.optional(v.string()), // Date of donation (ISO format or partial)
    donation_info: v.optional(v.string()), // Free-text info about the donation
    creditLine: v.optional(v.string()), // e.g., "Gift of the Estate of Lord Carnarvon, 1924"
    previous_owners: v.optional(v.array(v.string())), // List of previous owners
    links: v.optional(
      v.array(
        v.object({
          url: v.string(),
          label: v.optional(v.string()),
        }),
      ),
    ), // List of external links
    parentObjectId: v.optional(v.id("collections")), // Parent object (e.g., treasure chest containing this object)
    currentLocationId: v.optional(v.id("locations")),
    acquisitionMethod: v.optional(v.string()),
    legalRestrictions: v.optional(v.boolean()),
    isPubliclyVisible: v.optional(v.boolean()), // For "Public View: Active" status
    isHighResDownloadable: v.optional(v.boolean()), // For high-res download permission
    isSearchable: v.optional(v.boolean()), // Whether object appears in public search results
    isValuationVisible: v.optional(v.boolean()), // Whether valuation info is shown publicly
    publicSlug: v.optional(v.string()), // Custom URL slug for public access
    status: v.union(
      v.literal("active"),
      v.literal("loaned"),
      v.literal("deaccessioned"),
      v.literal("archived"),
      v.literal("deleted"),
    ),
    archivedAt: v.optional(v.number()),
    archivedBy: v.optional(v.id("users")),
    archivedReason: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.id("users")),
    deletedReason: v.optional(v.string()),
    displayStatus: v.optional(v.string()),
    collectionType: v.optional(
      v.union(
        v.literal("fine_art"),
        v.literal("wine"),
        v.literal("automotive"),
        v.literal("natural_history"),
        v.literal("archive"),
        v.literal("general"),
      ),
    ),
    customFields: v.optional(v.record(v.string(), customFieldValue)),
    catalogedBy: v.id("users"),
    catalogedAt: v.number(),
    lastModifiedBy: v.optional(v.id("users")),
    lastModifiedAt: v.optional(v.number()),
    // Record verification
    verified: v.optional(v.boolean()),
    verifiedBy: v.optional(v.id("users")),
    verifiedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_accessionNumber", ["accessionNumber"])
    .index("by_organization_and_accessionNumber", [
      "organizationId",
      "accessionNumber",
    ])
    .index("by_collectionGroup", ["collectionGroupId"])
    .index("by_parentObject", ["parentObjectId"])
    .index("by_currentLocation", ["currentLocationId"])
    .index("by_status", ["status"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_organization_status_public", [
      "organizationId",
      "status",
      "isPubliclyVisible",
    ])
    .index("by_organization_and_type", ["organizationId", "collectionType"])
    .index("by_organization_and_publicSlug", ["organizationId", "publicSlug"])
    .searchIndex("search_index", {
      searchField: "title",
      filterFields: ["organizationId", "status", "collectionType"],
    }),

  // Accession number counter tracking
  accessionCounters: defineTable({
    organizationId: v.id("organizations"),
    scope: v.union(
      v.literal("global"),
      v.literal("year"),
      v.literal("month"),
      v.literal("day"),
    ),
    scopeKey: v.string(), // e.g., "2025", "2025-10", "2025-10-02", "global"
    currentValue: v.number(),
    lastGeneratedAt: v.number(),
  }).index("by_organization_and_scope", [
    "organizationId",
    "scope",
    "scopeKey",
  ]),

  // Deaccession number counter tracking
  deaccessionCounters: defineTable({
    organizationId: v.id("organizations"),
    year: v.number(),
    currentValue: v.number(),
    lastGeneratedAt: v.number(),
  }).index("by_organization_and_year", ["organizationId", "year"]),

  // Custom accession number templates
  accessionTemplates: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    template: v.string(),
    description: v.optional(v.string()),
    isDefault: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    usageCount: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_default", ["organizationId", "isDefault"]),

  // Custom condition options per organization
  conditionOptions: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.string(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    usageCount: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
  }).index("by_organization", ["organizationId"]),

  // Custom material options per organization
  materialOptions: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    usageCount: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
  }).index("by_organization", ["organizationId"]),

  // Custom type options per organization
  typeOptions: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    usageCount: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
  }).index("by_organization", ["organizationId"]),

  // Donors per organization
  donors: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    email: v.string(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    usageCount: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_name", ["organizationId", "name"]),

  // Media attachments for objects
  mediaFiles: defineTable({
    collectionId: v.id("collections"),
    organizationId: v.id("organizations"),
    storageId: v.id("_storage"),
    thumbnailStorageId: v.optional(v.id("_storage")),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    mediaCategory: v.optional(
      v.union(
        v.literal("image"), // Photos of the object
        v.literal("document"), // Related documents (PDFs, scans, etc.)
      ),
    ), // Defaults to "image" for backwards compatibility
    isPrimary: v.boolean(),
    displayOrder: v.optional(v.number()),
    caption: v.optional(v.string()),
    photographer: v.optional(v.string()),
    copyright: v.optional(v.string()),
    uploadedBy: v.id("users"),
    uploadedAt: v.number(),
    uploadStatus: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    chunkedUploadId: v.optional(v.string()),

    // Duplicate detection (2.9.2)
    contentHash: v.optional(v.string()), // SHA-256 hash of file content
    isDuplicate: v.optional(v.boolean()),
    duplicateOfMediaId: v.optional(v.id("mediaFiles")),

    // EXIF/IPTC Metadata (2.9.1)
    metadata: v.optional(
      v.object({
        // EXIF camera data
        camera: v.optional(v.string()),
        lens: v.optional(v.string()),
        exposureTime: v.optional(v.string()),
        aperture: v.optional(v.string()),
        iso: v.optional(v.number()),
        focalLength: v.optional(v.string()),
        dateTimeOriginal: v.optional(v.number()),
        // GPS data
        gpsLatitude: v.optional(v.number()),
        gpsLongitude: v.optional(v.number()),
        // IPTC data
        headline: v.optional(v.string()),
        description: v.optional(v.string()),
        creator: v.optional(v.string()),
        city: v.optional(v.string()),
        country: v.optional(v.string()),
        keywords: v.optional(v.array(v.string())),
        // Image dimensions
        width: v.optional(v.number()),
        height: v.optional(v.number()),
        colorSpace: v.optional(v.string()),
        orientation: v.optional(v.number()),
      }),
    ),
    metadataExtracted: v.optional(v.boolean()),

    // Rights Management (2.9.3)
    rightsStatus: v.optional(
      v.union(
        v.literal("owned"), // Organization owns full rights
        v.literal("licensed"), // Licensed for specific use
        v.literal("public_domain"), // No copyright restrictions
        v.literal("orphan_work"), // Rights holder unknown
        v.literal("restricted"), // Special restrictions apply
        v.literal("unknown"), // Rights not yet determined
      ),
    ),
    licenseType: v.optional(
      v.union(
        v.literal("creative_commons_by"),
        v.literal("creative_commons_by_sa"),
        v.literal("creative_commons_by_nc"),
        v.literal("creative_commons_by_nd"),
        v.literal("creative_commons_zero"),
        v.literal("editorial_only"),
        v.literal("commercial"),
        v.literal("internal_only"),
        v.literal("custom"),
      ),
    ),
    licenseExpiry: v.optional(v.number()),
    rightsHolder: v.optional(v.string()),
    usageRestrictions: v.optional(v.string()),
    requiresAcknowledgment: v.optional(v.boolean()),
    acknowledgmentText: v.optional(v.string()),

    // Version Tracking
    currentVersionId: v.optional(v.id("mediaVersions")),
    versionCount: v.optional(v.number()),
  })
    .index("by_collection", ["collectionId"])
    .index("by_organization", ["organizationId"])
    .index("by_uploadStatus", ["uploadStatus"])
    .index("by_collection_and_category", ["collectionId", "mediaCategory"])
    .index("by_content_hash", ["organizationId", "contentHash"])
    .index("by_rights_status", ["organizationId", "rightsStatus"]),

  // Media versions - tracks edited versions of media files
  mediaVersions: defineTable({
    originalMediaId: v.id("mediaFiles"),
    organizationId: v.id("organizations"),
    storageId: v.id("_storage"),
    versionNumber: v.number(),
    editType: v.union(
      v.literal("crop"),
      v.literal("rotate"),
      v.literal("adjust"),
      v.literal("watermark"),
    ),
    editMetadata: v.optional(v.any()), // Stores crop coords, rotation angle, brightness/contrast values, watermark text
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_original_media", ["originalMediaId"])
    .index("by_organization", ["organizationId"])
    .index("by_original_media_and_version", [
      "originalMediaId",
      "versionNumber",
    ]),

  // Media edit history - chronological log of all edit operations
  mediaEditHistory: defineTable({
    mediaId: v.id("mediaFiles"),
    versionId: v.optional(v.id("mediaVersions")),
    organizationId: v.id("organizations"),
    operation: v.union(
      v.literal("crop"),
      v.literal("rotate"),
      v.literal("adjust"),
      v.literal("watermark"),
    ),
    parameters: v.optional(v.any()), // Stores operation-specific parameters
    appliedBy: v.id("users"),
    appliedAt: v.number(),
  })
    .index("by_media", ["mediaId"])
    .index("by_version", ["versionId"])
    .index("by_organization", ["organizationId"])
    .index("by_media_and_appliedAt", ["mediaId", "appliedAt"]),

  // Media download tracking for rights management (2.9.3)
  mediaDownloads: defineTable({
    mediaId: v.id("mediaFiles"),
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    downloadedAt: v.number(),
    purpose: v.optional(
      v.union(
        v.literal("internal_use"),
        v.literal("publication"),
        v.literal("exhibition"),
        v.literal("loan"),
        v.literal("research"),
        v.literal("marketing"),
        v.literal("other"),
      ),
    ),
    purposeDetails: v.optional(v.string()),
    acknowledgedRights: v.boolean(),
    ipAddress: v.optional(v.string()),
  })
    .index("by_media", ["mediaId"])
    .index("by_user", ["userId"])
    .index("by_organization", ["organizationId"]),

  // Fine Art module details (provenance, insurance, valuation)
  fineArtDetails: defineTable({
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
          documentIds: v.optional(v.array(v.id("_storage"))),
          notes: v.optional(v.string()),
          verified: v.optional(v.boolean()),
        }),
      ),
    ),
    shippingLogs: v.optional(
      v.array(
        v.object({
          fromLocation: v.string(),
          toLocation: v.string(),
          carrier: v.optional(v.string()),
          trackingNumber: v.optional(v.string()),
          departedAt: v.optional(v.number()),
          arrivedAt: v.optional(v.number()),
          conditionBefore: v.optional(v.string()),
          conditionAfter: v.optional(v.string()),
          notes: v.optional(v.string()),
        }),
      ),
    ),
    createdAt: v.number(),
    lastModifiedAt: v.optional(v.number()),
  })
    .index("by_collection", ["collectionId"])
    .index("by_organization", ["organizationId"])
    .index("by_reappraisal_date", ["reappraisalDate"]),

  // Wine & Spirits module details
  wineDetails: defineTable({
    collectionId: v.id("collections"),
    organizationId: v.id("organizations"),
    vintage: v.optional(v.number()),
    peakWindowStart: v.optional(v.number()),
    peakWindowEnd: v.optional(v.number()),
    binNumber: v.optional(v.string()),
    rackNumber: v.optional(v.string()),
    rowNumber: v.optional(v.string()),
    bottleSize: v.optional(v.string()),
    quantity: v.optional(v.number()),
    fillLevel: v.optional(
      v.union(
        v.literal("into_neck"),
        v.literal("top_shoulder"),
        v.literal("high_shoulder"),
        v.literal("mid_shoulder"),
        v.literal("low_shoulder"),
        v.literal("below_shoulder"),
      ),
    ),
    closureType: v.optional(
      v.union(
        v.literal("cork"),
        v.literal("screwcap"),
        v.literal("synthetic"),
        v.literal("glass"),
        v.literal("crown"),
      ),
    ),
    labelCondition: v.optional(v.string()),
    capsuleCondition: v.optional(v.string()),
    producer: v.optional(v.string()),
    region: v.optional(v.string()),
    appellation: v.optional(v.string()),
    varietal: v.optional(v.string()),
    alcoholContent: v.optional(v.number()),
    purchasePrice: v.optional(v.number()),
    currentValue: v.optional(v.number()),
    drinkingNotes: v.optional(v.string()),
    createdAt: v.number(),
    lastModifiedAt: v.optional(v.number()),
  })
    .index("by_collection", ["collectionId"])
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_bin", ["organizationId", "binNumber"])
    .index("by_organization_and_vintage", ["organizationId", "vintage"]),

  // Automotive & Machinery module details
  vehicleDetails: defineTable({
    collectionId: v.id("collections"),
    organizationId: v.id("organizations"),
    vin: v.optional(v.string()),
    make: v.optional(v.string()),
    model: v.optional(v.string()),
    year: v.optional(v.number()),
    bodyStyle: v.optional(v.string()),
    engineNumber: v.optional(v.string()),
    transmissionType: v.optional(v.string()),
    exteriorColor: v.optional(v.string()),
    interiorColor: v.optional(v.string()),
    odometer: v.optional(v.number()),
    odometerUnit: v.optional(v.union(v.literal("miles"), v.literal("km"))),
    fuelType: v.optional(v.string()),
    registrationNumber: v.optional(v.string()),
    registrationState: v.optional(v.string()),
    titleNumber: v.optional(v.string()),
    insuranceValue: v.optional(v.number()),
    serviceLog: v.optional(
      v.array(
        v.object({
          serviceDate: v.number(),
          serviceType: v.string(),
          description: v.string(),
          mileage: v.optional(v.number()),
          provider: v.optional(v.string()),
          cost: v.optional(v.number()),
          documentIds: v.optional(v.array(v.id("_storage"))),
        }),
      ),
    ),
    partsLifing: v.optional(
      v.array(
        v.object({
          partName: v.string(),
          installDate: v.optional(v.number()),
          installMileage: v.optional(v.number()),
          expectedLifeMiles: v.optional(v.number()),
          notes: v.optional(v.string()),
        }),
      ),
    ),
    eventHistory: v.optional(
      v.array(
        v.object({
          eventDate: v.number(),
          eventType: v.union(
            v.literal("concours"),
            v.literal("show"),
            v.literal("race"),
            v.literal("rally"),
            v.literal("auction"),
            v.literal("other"),
          ),
          eventName: v.string(),
          location: v.optional(v.string()),
          result: v.optional(v.string()),
          awards: v.optional(v.array(v.string())),
          notes: v.optional(v.string()),
        }),
      ),
    ),
    createdAt: v.number(),
    lastModifiedAt: v.optional(v.number()),
  })
    .index("by_collection", ["collectionId"])
    .index("by_organization", ["organizationId"])
    .index("by_vin", ["vin"])
    .index("by_organization_and_make", ["organizationId", "make"]),

  // Natural History & Science module details
  naturalHistoryDetails: defineTable({
    collectionId: v.id("collections"),
    organizationId: v.id("organizations"),
    kingdom: v.optional(v.string()),
    phylum: v.optional(v.string()),
    taxonomyClass: v.optional(v.string()),
    order: v.optional(v.string()),
    family: v.optional(v.string()),
    genus: v.optional(v.string()),
    species: v.optional(v.string()),
    subspecies: v.optional(v.string()),
    commonName: v.optional(v.string()),
    scientificName: v.optional(v.string()),
    collectionDate: v.optional(v.number()),
    collectorName: v.optional(v.string()),
    collectionMethod: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    altitude: v.optional(v.number()),
    locality: v.optional(v.string()),
    habitat: v.optional(v.string()),
    geologicalPeriod: v.optional(v.string()),
    formation: v.optional(v.string()),
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
    storageMedium: v.optional(v.string()),
    containerType: v.optional(v.string()),
    sex: v.optional(
      v.union(v.literal("male"), v.literal("female"), v.literal("unknown")),
    ),
    lifeStage: v.optional(v.string()),
    specimenType: v.optional(v.string()),
    dnaAvailable: v.optional(v.boolean()),
    tissueAvailable: v.optional(v.boolean()),
    createdAt: v.number(),
    lastModifiedAt: v.optional(v.number()),
  })
    .index("by_collection", ["collectionId"])
    .index("by_organization", ["organizationId"])
    .index("by_taxonomy", ["kingdom", "phylum", "genus", "species"])
    .index("by_organization_and_species", ["organizationId", "species"]),

  // Corporate Archive module details
  archiveDetails: defineTable({
    collectionId: v.id("collections"),
    organizationId: v.id("organizations"),
    documentType: v.optional(v.string()),
    retentionCategory: v.optional(v.string()),
    retentionYears: v.optional(v.number()),
    retentionStartDate: v.optional(v.number()),
    retentionExpiresAt: v.optional(v.number()),
    flaggedForDestruction: v.optional(v.boolean()),
    destructionDate: v.optional(v.number()),
    destructionMethod: v.optional(v.string()),
    destructionWitnessedBy: v.optional(v.string()),
    legalHold: v.optional(v.boolean()),
    legalHoldReason: v.optional(v.string()),
    confidentialityLevel: v.optional(
      v.union(
        v.literal("public"),
        v.literal("internal"),
        v.literal("confidential"),
        v.literal("restricted"),
        v.literal("top_secret"),
      ),
    ),
    accessRestrictions: v.optional(v.array(v.string())),
    originatingDepartment: v.optional(v.string()),
    recordSeries: v.optional(v.string()),
    boxNumber: v.optional(v.string()),
    folderNumber: v.optional(v.string()),
    digitalAssetUrl: v.optional(v.string()),
    digitalAssetStorageId: v.optional(v.id("_storage")),
    fileFormat: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    pageCount: v.optional(v.number()),
    ocrProcessed: v.optional(v.boolean()),
    keywords: v.optional(v.array(v.string())),
    createdAt: v.number(),
    lastModifiedAt: v.optional(v.number()),
  })
    .index("by_collection", ["collectionId"])
    .index("by_organization", ["organizationId"])
    .index("by_retention_expiry", ["retentionExpiresAt"])
    .index("by_organization_and_destruction_flag", [
      "organizationId",
      "flaggedForDestruction",
    ]),

  // Accession workflow records
  accessions: defineTable({
    organizationId: v.id("organizations"),
    collectionId: v.optional(v.id("collections")),
    accessionNumber: v.string(),
    dateReceived: v.number(),
    source: v.string(),
    donorAccountId: v.optional(v.id("accounts")),
    documents: v.optional(v.array(v.id("_storage"))),
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
    // Source verification fields
    sourceVerified: v.optional(v.boolean()),
    sourceVerifiedBy: v.optional(v.id("users")),
    sourceVerifiedAt: v.optional(v.number()),
    sourceVerificationNotes: v.optional(v.string()),
    // Document checklist - tracks which required documents have been uploaded
    documentChecklist: v.optional(
      v.array(
        v.object({
          documentType: v.string(),
          required: v.boolean(),
          uploaded: v.boolean(),
          storageId: v.optional(v.id("_storage")),
          uploadedAt: v.optional(v.number()),
          uploadedBy: v.optional(v.id("users")),
        }),
      ),
    ),
  })
    .index("by_organization", ["organizationId"])
    .index("by_collection", ["collectionId"])
    .index("by_status", ["status"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_donor_account", ["donorAccountId"])
    .index("by_assigned_to", ["assignedTo"])
    .searchIndex("search_accessions", {
      searchField: "accessionNumber",
      filterFields: ["organizationId", "status"],
    }),

  // Deaccession workflow records
  deaccessions: defineTable({
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
    proceedsRecipient: v.optional(v.string()),
    proceedsDate: v.optional(v.number()),
    proceedsNotes: v.optional(v.string()),
    proceedsReceiptDocument: v.optional(v.id("_storage")), // Receipt for sale proceeds
    proceedsVerified: v.optional(v.boolean()),
    proceedsVerifiedBy: v.optional(v.id("users")),
    proceedsVerifiedAt: v.optional(v.number()),
    // Regulatory approval fields
    regulatoryApprovalRequired: v.optional(v.boolean()),
    regulatoryApprovalStatus: v.optional(
      v.union(
        v.literal("not_required"),
        v.literal("pending"),
        v.literal("requested"),
        v.literal("approved"),
        v.literal("rejected"),
      ),
    ),
    regulatoryApproverEmail: v.optional(v.string()),
    regulatoryApproverName: v.optional(v.string()),
    regulatoryApprovalRequestedAt: v.optional(v.number()),
    regulatoryApprovalReceivedAt: v.optional(v.number()),
    regulatoryApprovalToken: v.optional(v.string()), // Unique token for external approval link
    regulatoryApprovalDocuments: v.optional(v.array(v.id("_storage"))),
    regulatoryApprovalNotes: v.optional(v.string()),
    // Valuation/Appraisal verification
    appraisalId: v.optional(v.id("appraisals")), // Link to appraisal record
    appraisalVerified: v.optional(v.boolean()),
    appraisalVerifiedBy: v.optional(v.id("users")),
    appraisalVerifiedAt: v.optional(v.number()),
    appraisalValue: v.optional(v.number()),
    appraisalDate: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_collection", ["collectionId"])
    .index("by_status", ["status"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_regulatory_token", ["regulatoryApprovalToken"])
    .index("by_assigned_to", ["assignedTo"]),

  // Appraisals for collection items
  appraisals: defineTable({
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
    documents: v.optional(v.array(v.id("_storage"))),
    createdBy: v.id("users"),
    createdAt: v.number(),
    // Validity tracking
    validUntil: v.optional(v.number()), // Typically 2-3 years from appraisal date
    isCurrentAppraisal: v.optional(v.boolean()), // Mark as the current/active appraisal
  })
    .index("by_organization", ["organizationId"])
    .index("by_collection", ["collectionId"])
    .index("by_collection_and_date", ["collectionId", "appraisalDate"]),

  // Hierarchical location structure
  locations: defineTable({
    organizationId: v.id("organizations"),
    siteId: v.optional(v.id("sites")),
    name: v.string(),
    type: v.string(), // Flexible per org (building/floor/room/cabinet/shelf/box)
    parentLocationId: v.optional(v.id("locations")),
    sortOrder: v.number(), // Order within parent (for drag-and-drop reordering)
    address: v.optional(v.string()),
    coordinates: v.optional(
      v.object({
        latitude: v.number(),
        longitude: v.number(),
      }),
    ),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
    // Capacity tracking for storage locations
    capacity: v.optional(v.number()), // Max number of objects this location can hold
    customFields: v.optional(v.record(v.string(), customFieldValue)),
    // Environmental thresholds for conservation monitoring
    environmentalThresholds: v.optional(
      v.object({
        temperatureMin: v.optional(v.number()), // Celsius
        temperatureMax: v.optional(v.number()),
        humidityMin: v.optional(v.number()), // Percentage
        humidityMax: v.optional(v.number()),
        lightLevelMax: v.optional(v.number()), // Lux
        uvLevelMax: v.optional(v.number()), // UV index
      }),
    ),
    // Location status for workflow control
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("closed"),
        v.literal("renovation"),
        v.literal("restricted"),
      ),
    ),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_site", ["organizationId", "siteId"])
    .index("by_parentLocation", ["parentLocationId"])
    .index("by_organization_and_type", ["organizationId", "type"])
    .searchIndex("search_locations", {
      searchField: "name",
      filterFields: ["organizationId", "type"],
    }),

  // Movement tracking
  locationHistory: defineTable({
    collectionId: v.id("collections"),
    fromLocationId: v.optional(v.id("locations")),
    toLocationId: v.id("locations"),
    movedBy: v.id("users"),
    movedAt: v.number(),
    reason: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_collection", ["collectionId"])
    .index("by_toLocation", ["toLocationId"])
    .index("by_fromLocation", ["fromLocationId"])
    .index("by_movedAt", ["movedAt"])
    .index("by_toLocation_and_movedAt", ["toLocationId", "movedAt"])
    .index("by_fromLocation_and_movedAt", ["fromLocationId", "movedAt"]),

  // Move Requests - Approval workflow for sensitive object moves
  locationMoveRequests: defineTable({
    organizationId: v.id("organizations"),
    collectionId: v.id("collections"),
    fromLocationId: v.optional(v.id("locations")),
    toLocationId: v.id("locations"),

    // Request details
    reason: v.string(),
    scheduledDate: v.optional(v.number()), // When the move should happen
    priority: v.optional(
      v.union(v.literal("low"), v.literal("normal"), v.literal("high")),
    ),

    // Status
    status: v.union(
      v.literal("pending"), // Awaiting approval
      v.literal("approved"), // Approved, ready to execute
      v.literal("rejected"), // Rejected
      v.literal("executed"), // Move completed
      v.literal("cancelled"), // Request cancelled
    ),

    // Approval tracking
    requestedBy: v.id("users"),
    requestedAt: v.number(),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    reviewNotes: v.optional(v.string()),

    // Execution tracking
    executedBy: v.optional(v.id("users")),
    executedAt: v.optional(v.number()),
    executionNotes: v.optional(v.string()),

    // Override tracking (if capacity/status was overridden)
    capacityOverride: v.optional(v.boolean()),
    statusOverride: v.optional(v.boolean()),

    notes: v.optional(v.string()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_collection", ["collectionId"])
    .index("by_status", ["status"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_toLocation", ["toLocationId"]),

  // Unified accounts (museum lenders/borrowers + library patrons)
  accounts: defineTable({
    organizationId: v.id("organizations"),
    accountNumber: v.string(), // ACC-XXXXX format

    // Account type - distinguishes museum vs library accounts
    // Optional to support existing accounts before migration
    accountType: v.optional(
      v.union(
        v.literal("lender"), // Museum: lends objects TO museum
        v.literal("borrower"), // Museum: borrows objects FROM museum
        v.literal("both"), // Museum: both lender and borrower
        v.literal("institution"), // Museum: institutional partner
        v.literal("patron"), // Library: individual library member
      ),
    ),

    // Business/Organization info (for institutions - lender/borrower/institution)
    businessName: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    contactEmail: v.optional(v.string()),

    // Personal info (for individuals - patron type)
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    dateOfBirth: v.optional(v.number()),

    // Contact info (shared)
    phone: v.optional(v.string()),
    email: v.optional(v.string()),

    // Address (flat format for backward compatibility)
    address: v.optional(v.string()),
    address2: v.optional(v.string()),
    zipCode: v.optional(v.string()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),

    // Structured address (for library patrons)
    structuredAddress: v.optional(
      v.object({
        street: v.string(),
        city: v.string(),
        state: v.optional(v.string()),
        postalCode: v.string(),
        country: v.optional(v.string()),
      }),
    ),

    // CRM fields (MUS-362)
    legalName: v.optional(v.string()),
    taxId: v.optional(v.string()),
    website: v.optional(v.string()),
    billingAddress: v.optional(
      v.object({
        street1: v.string(),
        street2: v.optional(v.string()),
        city: v.string(),
        state: v.string(),
        postalCode: v.string(),
        country: v.string(),
      }),
    ),
    shippingAddress: v.optional(
      v.object({
        street1: v.string(),
        street2: v.optional(v.string()),
        city: v.string(),
        state: v.string(),
        postalCode: v.string(),
        country: v.string(),
      }),
    ),
    tags: v.optional(v.array(v.string())),

    // Library-specific fields (for patron accounts)
    cardNumber: v.optional(v.string()), // Library card number
    pin: v.optional(v.string()),
    membershipTypeId: v.optional(v.id("membershipTypes")),
    membershipType: v.optional(v.string()),
    registrationDate: v.optional(v.number()),
    expirationDate: v.optional(v.number()),
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
    blockReason: v.optional(v.string()),
    borrowingLimit: v.optional(v.number()),
    holdLimit: v.optional(v.number()),
    fineBalance: v.optional(v.number()),
    preferredBranch: v.optional(v.id("locations")),
    notificationPreferences: v.optional(
      v.object({
        email: v.boolean(),
        sms: v.boolean(),
        dueDateReminder: v.boolean(),
        holdReady: v.boolean(),
      }),
    ),
    totalCheckouts: v.optional(v.number()),

    // Auto-renewal preference (for library patrons)
    autoRenewalEnabled: v.optional(v.boolean()),

    // Link to user account (for self-service portal)
    userId: v.optional(v.id("users")),

    // Audit fields
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    lastModifiedBy: v.optional(v.id("users")),
    lastModifiedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_accountNumber", [
      "organizationId",
      "accountNumber",
    ])
    .index("by_organization_and_accountType", ["organizationId", "accountType"])
    .index("by_organization_and_cardNumber", ["organizationId", "cardNumber"])
    .index("by_cardNumber", ["cardNumber"])
    .index("by_email", ["email"])
    .index("by_status", ["status"])
    .index("by_user", ["userId"])
    .searchIndex("search_accounts", {
      searchField: "businessName",
      filterFields: ["organizationId", "accountType"],
    })
    .searchIndex("search_accounts_by_name", {
      searchField: "lastName",
      filterFields: ["organizationId", "accountType", "status"],
    }),

  // Many-to-many relationship between accounts and roles
  // Defines which roles have access to manage specific accounts
  accountRoles: defineTable({
    accountId: v.id("accounts"),
    roleId: v.id("roles"),
    addedAt: v.number(),
    addedBy: v.id("users"),
  })
    .index("by_account", ["accountId"])
    .index("by_role", ["roleId"])
    .index("by_account_and_role", ["accountId", "roleId"]),

  // Account number counter tracking
  accountCounters: defineTable({
    organizationId: v.id("organizations"),
    currentValue: v.number(),
    lastGeneratedAt: v.number(),
  }).index("by_organization", ["organizationId"]),

  // Loan number counter tracking (per year)
  loanCounters: defineTable({
    organizationId: v.id("organizations"),
    year: v.number(),
    currentValue: v.number(),
    lastGeneratedAt: v.number(),
  }).index("by_organization_and_year", ["organizationId", "year"]),

  // Loan records
  loans: defineTable({
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
    useDetailedConditionReports: v.optional(v.boolean()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_status", ["status"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_type", ["type"])
    .index("by_organization_and_type", ["organizationId", "type"])
    .index("by_account", ["accountId"])
    .index("by_organization_and_endDate", ["organizationId", "endDate"])
    .index("by_assigned_to", ["assignedTo"])
    .searchIndex("search_loans", {
      searchField: "lenderBorrowerName",
      filterFields: ["organizationId", "status", "type"],
    }),

  // Items included in loans
  loanItems: defineTable({
    loanId: v.id("loans"),
    collectionId: v.id("collections"),
    conditionOut: v.optional(v.string()),
    conditionIn: v.optional(v.string()),
    notes: v.optional(v.string()),
    conditionReportId: v.optional(v.id("conditionReports")),
  })
    .index("by_loan", ["loanId"])
    .index("by_collection", ["collectionId"]),

  // Detailed condition reports (when enabled)
  conditionReports: defineTable({
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
  }).index("by_loanItem", ["loanItemId"]),

  // Documents attached to loans
  loanDocuments: defineTable({
    loanId: v.id("loans"),
    storageId: v.id("_storage"),
    documentType: v.union(
      v.literal("agreement"),
      v.literal("insurance"),
      v.literal("other"),
    ),
    fileName: v.string(),
    uploadedBy: v.id("users"),
    uploadedAt: v.number(),
  }).index("by_loan", ["loanId"]),

  // Loan extension requests
  loanExtensionRequests: defineTable({
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
    approvalComment: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
  })
    .index("by_loan", ["loanId"])
    .index("by_organization", ["organizationId"])
    .index("by_status", ["status"])
    .index("by_organization_and_status", ["organizationId", "status"]),

  // Loan return reminders (tracks sent reminders to avoid duplicates)
  loanReminders: defineTable({
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
  })
    .index("by_loan", ["loanId"])
    .index("by_loan_and_type", ["loanId", "reminderType"]),

  // Condition disputes for loan returns
  conditionDisputes: defineTable({
    loanId: v.id("loans"),
    organizationId: v.id("organizations"),
    collectionId: v.id("collections"), // The item in dispute
    // Condition as recorded before loan
    conditionBefore: v.string(),
    conditionBeforeNotes: v.optional(v.string()),
    conditionBeforePhotos: v.optional(v.array(v.id("_storage"))),
    // Condition as observed on return
    conditionAfter: v.string(),
    conditionAfterNotes: v.optional(v.string()),
    conditionAfterPhotos: v.optional(v.array(v.id("_storage"))),
    // Dispute details
    disputeDescription: v.string(),
    reportedBy: v.id("users"),
    reportedAt: v.number(),
    status: v.union(
      v.literal("reported"),
      v.literal("investigating"),
      v.literal("resolved_in_favor_lender"), // Damage was pre-existing
      v.literal("resolved_in_favor_borrower"), // Damage occurred during loan
      v.literal("resolved_compromise"), // Both parties agree to split responsibility
      v.literal("withdrawn"), // Dispute was withdrawn
    ),
    // Investigation
    investigatorId: v.optional(v.id("users")),
    investigationStartedAt: v.optional(v.number()),
    investigationNotes: v.optional(v.string()),
    investigationPhotos: v.optional(v.array(v.id("_storage"))),
    // Resolution
    resolvedBy: v.optional(v.id("users")),
    resolvedAt: v.optional(v.number()),
    resolutionNotes: v.optional(v.string()),
    // Financial impact (if any)
    claimAmount: v.optional(v.number()),
    settlementAmount: v.optional(v.number()),
    insuranceClaimId: v.optional(v.id("insuranceClaims")),
  })
    .index("by_loan", ["loanId"])
    .index("by_organization", ["organizationId"])
    .index("by_collection", ["collectionId"])
    .index("by_status", ["status"])
    .index("by_organization_and_status", ["organizationId", "status"]),

  // Conservation treatments for objects
  conservationTreatments: defineTable({
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
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    createdBy: v.optional(v.id("users")),
    // Cost tracking fields
    laborHours: v.optional(v.number()),
    laborRate: v.optional(v.number()), // Per hour rate
    laborCost: v.optional(v.number()), // Total labor cost (can be calculated or set)
    materialsCost: v.optional(v.number()),
    materials: v.optional(
      v.array(
        v.object({
          name: v.string(),
          quantity: v.optional(v.number()),
          unitCost: v.optional(v.number()),
          totalCost: v.number(),
          notes: v.optional(v.string()),
        }),
      ),
    ),
    externalServicesCost: v.optional(v.number()),
    totalCost: v.optional(v.number()),
    currency: v.optional(v.string()),
    estimatedCost: v.optional(v.number()), // Initial estimate for budgeting
    costNotes: v.optional(v.string()),
  })
    .index("by_collection", ["collectionId"])
    .index("by_organization", ["organizationId"])
    .index("by_performedAt", ["performedAt"])
    .index("by_organization_and_status", ["organizationId", "status"]),

  // Assessment schedules for periodic condition checks
  assessmentSchedules: defineTable({
    organizationId: v.id("organizations"),
    collectionId: v.optional(v.id("collections")), // Can be per-item or organization-wide
    name: v.string(),
    description: v.optional(v.string()),
    // Schedule configuration
    intervalDays: v.number(), // How often to assess (e.g., 365 for annual)
    assessmentType: v.union(
      v.literal("full"),
      v.literal("spot_check"),
      v.literal("environmental"),
      v.literal("condition"),
    ),
    // Next scheduled date
    nextDueDate: v.optional(v.number()),
    lastCompletedDate: v.optional(v.number()),
    lastCompletedBy: v.optional(v.id("users")),
    lastTreatmentId: v.optional(v.id("conservationTreatments")),
    // Status
    isActive: v.boolean(),
    // Assignment
    assignedTo: v.optional(v.id("users")),
    assignedRoleId: v.optional(v.id("roles")),
    // Notifications
    reminderDaysBefore: v.optional(v.number()), // Send reminder N days before due
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_collection", ["collectionId"])
    .index("by_next_due", ["nextDueDate"])
    .index("by_organization_and_active", ["organizationId", "isActive"]),

  // Environmental readings for locations
  environmentalReadings: defineTable({
    organizationId: v.id("organizations"),
    locationId: v.id("locations"),
    // Reading data
    temperature: v.optional(v.number()), // Celsius
    humidity: v.optional(v.number()), // Percentage
    lightLevel: v.optional(v.number()), // Lux
    uvLevel: v.optional(v.number()), // UV index or µW/lumen
    // Metadata
    recordedAt: v.number(),
    recordedBy: v.optional(v.id("users")), // If manual entry
    source: v.union(
      v.literal("manual"),
      v.literal("sensor"),
      v.literal("imported"),
    ),
    sensorId: v.optional(v.string()), // External sensor identifier
    notes: v.optional(v.string()),
    // Alert tracking
    alertTriggered: v.optional(v.boolean()),
    alertId: v.optional(v.id("conservationAlerts")),
  })
    .index("by_organization", ["organizationId"])
    .index("by_location", ["locationId"])
    .index("by_location_and_time", ["locationId", "recordedAt"]),

  // Conservation treatment attachments (before/after photos, reports)
  conservationAttachments: defineTable({
    organizationId: v.id("organizations"),
    treatmentId: v.id("conservationTreatments"),
    storageId: v.id("_storage"),

    fileName: v.string(),
    fileType: v.string(), // mime type
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
    takenAt: v.optional(v.number()), // when photo was taken

    uploadedBy: v.id("users"),
    uploadedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_treatment", ["treatmentId"])
    .index("by_type", ["attachmentType"])
    .index("by_treatment_and_type", ["treatmentId", "attachmentType"]),

  // Conservation alert rules (critical attention alerts)
  conservationAlertRules: defineTable({
    organizationId: v.id("organizations"),

    name: v.string(),
    description: v.optional(v.string()),

    // Trigger conditions
    triggerType: v.union(
      v.literal("condition_threshold"), // Object condition drops below threshold
      v.literal("treatment_overdue"), // Scheduled treatment is overdue
      v.literal("assessment_due"), // Periodic assessment due
      v.literal("urgent_treatment"), // Treatment marked as urgent
      v.literal("environmental"), // Environmental condition alert
    ),

    // Condition-specific settings
    conditionThreshold: v.optional(v.string()), // e.g., "poor", "critical"
    daysOverdue: v.optional(v.number()), // Days before treatment considered overdue
    assessmentIntervalDays: v.optional(v.number()), // Days between required assessments

    // Alert settings
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("critical"),
    ),

    // Notification settings
    notifyRoles: v.optional(v.array(v.id("roles"))), // Roles to notify
    notifyUsers: v.optional(v.array(v.id("users"))), // Specific users to notify
    emailNotification: v.boolean(),
    inAppNotification: v.boolean(),

    isActive: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    lastModifiedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_active", ["organizationId", "isActive"])
    .index("by_triggerType", ["triggerType"]),

  // Conservation alerts (triggered alerts)
  conservationAlerts: defineTable({
    organizationId: v.id("organizations"),
    ruleId: v.optional(v.id("conservationAlertRules")), // Rule that triggered (if any)

    // What triggered the alert
    collectionId: v.optional(v.id("collections")), // Related object
    treatmentId: v.optional(v.id("conservationTreatments")), // Related treatment

    // Alert details
    alertType: v.union(
      v.literal("condition_degraded"),
      v.literal("treatment_overdue"),
      v.literal("assessment_due"),
      v.literal("urgent_treatment"),
      v.literal("environmental_alert"),
      v.literal("manual"), // Manually created alert
    ),

    title: v.string(),
    description: v.string(),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("critical"),
    ),

    // Status
    status: v.union(
      v.literal("active"),
      v.literal("acknowledged"),
      v.literal("resolved"),
      v.literal("dismissed"),
    ),

    // Resolution
    acknowledgedBy: v.optional(v.id("users")),
    acknowledgedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.id("users")),
    resolvedAt: v.optional(v.number()),
    resolutionNotes: v.optional(v.string()),

    // Metadata
    createdBy: v.optional(v.id("users")), // null if system-generated
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_status", ["status"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_collection", ["collectionId"])
    .index("by_treatment", ["treatmentId"])
    .index("by_priority", ["priority"])
    .index("by_organization_and_priority", ["organizationId", "priority"]),

  // Exhibition records for objects
  exhibitions: defineTable({
    collectionId: v.id("collections"),
    organizationId: v.id("organizations"),
    title: v.string(),
    location: v.optional(v.string()),
    locationId: v.optional(v.id("locations")), // Link to actual location for object tracking
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
        v.literal("installing"), // Phase between approved and active
        v.literal("active"),
        v.literal("deinstalling"), // Phase between active and closed
        v.literal("closed"),
        v.literal("rejected"),
      ),
    ),
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
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    createdBy: v.optional(v.id("users")),
    // Installation checklist
    installationChecklist: v.optional(
      v.array(
        v.object({
          taskId: v.string(),
          task: v.string(),
          required: v.boolean(),
          completed: v.boolean(),
          completedBy: v.optional(v.id("users")),
          completedAt: v.optional(v.number()),
          notes: v.optional(v.string()),
        }),
      ),
    ),
    installationStartedAt: v.optional(v.number()),
    installationCompletedAt: v.optional(v.number()),
    activatedAt: v.optional(v.number()),
    activatedBy: v.optional(v.id("users")),
    // Deinstallation tracking
    deinstallationStartedAt: v.optional(v.number()),
    deinstallationCompletedAt: v.optional(v.number()),
    deinstallationNotes: v.optional(v.string()),
    deinstallationChecklist: v.optional(
      v.array(
        v.object({
          taskId: v.string(),
          task: v.string(),
          required: v.boolean(),
          completed: v.boolean(),
          completedBy: v.optional(v.id("users")),
          completedAt: v.optional(v.number()),
          notes: v.optional(v.string()),
        }),
      ),
    ),
    closedAt: v.optional(v.number()),
    closedBy: v.optional(v.id("users")),
  })
    .index("by_collection", ["collectionId"])
    .index("by_organization", ["organizationId"])
    .index("by_startDate", ["startDate"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_organization_and_startDate", ["organizationId", "startDate"])
    .index("by_location", ["locationId"]),

  // Track objects in exhibitions and their original locations
  exhibitionObjects: defineTable({
    exhibitionId: v.id("exhibitions"),
    organizationId: v.id("organizations"),
    collectionId: v.id("collections"), // The object being exhibited
    originalLocationId: v.optional(v.id("locations")), // Where the object was before
    exhibitionLocationId: v.optional(v.id("locations")), // Where it is in the exhibition
    // Installation tracking
    installedAt: v.optional(v.number()),
    installedBy: v.optional(v.id("users")),
    installationNotes: v.optional(v.string()),
    conditionAtInstallation: v.optional(v.string()),
    // Deinstallation tracking
    deinstalledAt: v.optional(v.number()),
    deinstalledBy: v.optional(v.id("users")),
    deinstallationNotes: v.optional(v.string()),
    conditionAtDeinstallation: v.optional(v.string()),
    returnedToOriginalLocation: v.optional(v.boolean()),
    returnedAt: v.optional(v.number()),
    // Status
    status: v.union(
      v.literal("pending"),
      v.literal("installed"),
      v.literal("deinstalled"),
      v.literal("returned"),
    ),
  })
    .index("by_exhibition", ["exhibitionId"])
    .index("by_collection", ["collectionId"])
    .index("by_organization", ["organizationId"]),

  exhibitionDocuments: defineTable({
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
  }).index("by_exhibition", ["exhibitionId"]),

  // Activity tracking
  auditLog: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    changes: v.optional(auditLogChanges),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_user", ["userId"])
    .index("by_entity", ["entityType", "entityId"])
    .index("by_timestamp", ["timestamp"]),

  // User notifications
  notifications: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    read: v.boolean(),
    relatedEntityType: v.optional(v.string()),
    relatedEntityId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_organization", ["organizationId"])
    .index("by_user_and_read", ["userId", "read"])
    .index("by_user_and_organization", ["userId", "organizationId"]),

  // User notification preferences
  notificationPreferences: defineTable({
    userId: v.id("users"),
    organizationId: v.id("organizations"),

    // Category preferences (enable/disable entire categories)
    enableApprovals: v.optional(v.boolean()), // Default true
    enableReminders: v.optional(v.boolean()), // Default true
    enableAlerts: v.optional(v.boolean()), // Default true
    enableAssignments: v.optional(v.boolean()), // Default true
    enableSystem: v.optional(v.boolean()), // Default true

    // Specific type overrides (takes precedence over category)
    disabledTypes: v.optional(v.array(v.string())),

    // Delivery preferences
    emailEnabled: v.optional(v.boolean()), // Default false
    emailDigestFrequency: v.optional(
      v.union(
        v.literal("instant"),
        v.literal("daily"),
        v.literal("weekly"),
        v.literal("never"),
      ),
    ),

    // Quiet hours (no notifications during these times)
    quietHoursEnabled: v.optional(v.boolean()),
    quietHoursStart: v.optional(v.string()), // "22:00"
    quietHoursEnd: v.optional(v.string()), // "08:00"
    timezone: v.optional(v.string()), // "America/New_York"

    updatedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_organization", ["userId", "organizationId"]),

  // Organization workflow configurations
  workflowConfigs: defineTable({
    organizationId: v.id("organizations"),
    workflowType: v.union(
      v.literal("accession"),
      v.literal("deaccession"),
      v.literal("loan"),
      v.literal("acquisition"),
      v.literal("exhibition"),
      v.literal("conservation"),
    ),
    steps: v.array(
      v.object({
        stepNumber: v.number(),
        roleId: v.id("roles"),
        name: v.string(),
        // Documents required to complete this step
        requiredDocuments: v.optional(v.array(v.string())),
        // Epic 24: Approval mode for this step
        approvalMode: v.optional(
          v.union(
            v.literal("single"), // Default: one approver needed
            v.literal("multi"), // Multiple approvers, threshold-based
            v.literal("unanimous"), // All approvers with role must approve
          ),
        ),
        // Number of approvals required (for multi mode)
        requiredApprovals: v.optional(v.number()),
        // Allowed transitions from this step (empty = next step only)
        allowedNextSteps: v.optional(v.array(v.number())),
        // Can this step be skipped? (e.g., for expedited workflows)
        canSkip: v.optional(v.boolean()),
      }),
    ),
    canInitiateRoles: v.array(v.id("roles")),
    // Global required documents for this workflow type
    requiredDocuments: v.optional(
      v.array(
        v.object({
          documentType: v.string(),
          description: v.optional(v.string()),
          requiredAtStep: v.optional(v.number()), // If specified, required before this step can be approved
        }),
      ),
    ),
    // Whether source verification is required before approval
    requireSourceVerification: v.optional(v.boolean()),
    // Epic 24: Template this config was instantiated from
    templateId: v.optional(v.id("workflowTemplates")),
  })
    .index("by_organization", ["organizationId"])
    .index("by_workflowType", ["workflowType"])
    .index("by_organization_and_workflowType", [
      "organizationId",
      "workflowType",
    ]),

  // Epic 24: Unified workflow history table (queryable across all workflow types)
  workflowHistory: defineTable({
    organizationId: v.id("organizations"),
    workflowType: v.union(
      v.literal("accession"),
      v.literal("deaccession"),
      v.literal("loan"),
      v.literal("acquisition"),
      v.literal("exhibition"),
      v.literal("conservation"),
    ),
    entityId: v.string(),
    fromStep: v.number(),
    toStep: v.number(),
    action: v.union(
      v.literal("created"),
      v.literal("submitted"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("reassigned"),
      v.literal("returned"),
      v.literal("completed"),
      v.literal("cancelled"),
    ),
    performedBy: v.id("users"),
    performedAt: v.number(),
    comment: v.optional(v.string()),
    assignedTo: v.optional(v.id("users")),
    previousAssignee: v.optional(v.id("users")),
    metadata: v.optional(v.record(v.string(), v.string())),
  })
    .index("by_organization", ["organizationId"])
    .index("by_entity", ["workflowType", "entityId"])
    .index("by_user", ["performedBy"])
    .index("by_organization_and_type", ["organizationId", "workflowType"])
    .index("by_timestamp", ["performedAt"]),

  // Epic 24: Predefined workflow templates
  workflowTemplates: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    workflowType: v.union(
      v.literal("accession"),
      v.literal("deaccession"),
      v.literal("loan"),
      v.literal("acquisition"),
      v.literal("exhibition"),
      v.literal("conservation"),
    ),
    isSystem: v.boolean(),
    steps: v.array(
      v.object({
        stepNumber: v.number(),
        name: v.string(),
        roleName: v.string(),
        approvalMode: v.optional(
          v.union(
            v.literal("single"),
            v.literal("multi"),
            v.literal("unanimous"),
          ),
        ),
        requiredApprovals: v.optional(v.number()),
        allowedNextSteps: v.optional(v.array(v.number())),
        canSkip: v.optional(v.boolean()),
        requiredDocuments: v.optional(v.array(v.string())),
      }),
    ),
    requiredDocuments: v.optional(
      v.array(
        v.object({
          documentType: v.string(),
          description: v.optional(v.string()),
          requiredAtStep: v.optional(v.number()),
        }),
      ),
    ),
    requireSourceVerification: v.optional(v.boolean()),
    createdAt: v.number(),
    createdBy: v.optional(v.id("users")),
  })
    .index("by_workflowType", ["workflowType"])
    .index("by_isSystem", ["isSystem"]),

  // Epic 24: Step approvals tracking (for multi-approver workflows)
  workflowStepApprovals: defineTable({
    organizationId: v.id("organizations"),
    workflowType: v.union(
      v.literal("accession"),
      v.literal("deaccession"),
      v.literal("loan"),
      v.literal("acquisition"),
      v.literal("exhibition"),
      v.literal("conservation"),
    ),
    entityId: v.string(),
    stepNumber: v.number(),
    approvedBy: v.id("users"),
    approvedAt: v.number(),
    comment: v.optional(v.string()),
  })
    .index("by_entity_and_step", ["workflowType", "entityId", "stepNumber"])
    .index("by_user", ["approvedBy"]),

  // SLA configurations for workflow types (Task 5)
  workflowSlaConfigs: defineTable({
    organizationId: v.id("organizations"),
    workflowType: v.union(
      v.literal("accession"),
      v.literal("deaccession"),
      v.literal("loan"),
      v.literal("acquisition"),
      v.literal("exhibition"),
      v.literal("conservation"),
    ),
    slaDays: v.number(),
    warningDays: v.optional(v.number()),
    escalateToRoleId: v.optional(v.id("roles")),
    isActive: v.optional(v.boolean()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_type", ["organizationId", "workflowType"]),

  // Webhook endpoints for external integrations
  webhooks: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    url: v.string(),
    secret: v.string(),
    events: v.array(v.string()),
    isActive: v.boolean(),
    lastTriggeredAt: v.optional(v.number()),
    createdBy: v.id("users"),
    createdAt: v.number(),
  }).index("by_organization", ["organizationId"]),

  // API keys for external integrations
  apiKeys: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    prefix: v.string(),
    keyHash: v.string(),
    permissions: v.array(v.string()),
    expiresAt: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
    isRevoked: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_prefix", ["prefix"]),

  // Background import jobs
  importJobs: defineTable({
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
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_status", ["status"]),

  // Import validation reports
  importValidationReports: defineTable({
    organizationId: v.id("organizations"),
    entityType: v.string(),
    totalRows: v.number(),
    validRows: v.number(),
    errorCount: v.number(),
    warningCount: v.number(),
    createdBy: v.id("users"),
    createdAt: v.number(),
  }).index("by_organization", ["organizationId"]),

  // Import field mapping configurations
  importFieldMappings: defineTable({
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
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_type", ["organizationId", "entityType"]),

  exportUsage: defineTable({
    organizationId: v.id("organizations"),
    periodStart: v.number(),
    count: v.number(),
  }).index("by_organization_and_period", ["organizationId", "periodStart"]),

  mediaImportJobData: defineTable({
    jobId: v.id("importJobs"),
    mappingType: v.union(v.literal("csv"), v.literal("filename")),
    mappingData: v.array(
      v.object({
        filename: v.string(),
        accessionNumber: v.string(),
      }),
    ),
    uploadedFiles: v.array(
      v.object({
        fileName: v.string(),
        storageId: v.id("_storage"),
        fileSize: v.number(),
        mimeType: v.string(),
        mapped: v.boolean(),
        collectionId: v.optional(v.id("collections")),
        mediaFileId: v.optional(v.id("mediaFiles")),
        error: v.optional(v.string()),
      }),
    ),
  }).index("by_job", ["jobId"]),

  // ============================================
  // LIBRARY INTEGRATION TABLES
  // ============================================

  // Library Items - Universal catalog (books, periodicals, media)
  libraryItems: defineTable({
    organizationId: v.id("organizations"),
    collectionId: v.optional(v.id("collections")), // Link to rare/archival items

    // Item type
    itemType: v.union(
      v.literal("book"),
      v.literal("ebook"),
      v.literal("audiobook"),
      v.literal("periodical"),
      v.literal("newspaper"),
      v.literal("dvd"),
      v.literal("cd"),
      v.literal("map"),
      v.literal("manuscript"),
      v.literal("thesis"),
      v.literal("other"),
    ),

    // Identifiers
    isbn: v.optional(v.string()),
    isbn13: v.optional(v.string()),
    issn: v.optional(v.string()),
    barcode: v.optional(v.string()),
    callNumber: v.optional(v.string()),
    accessionNumber: v.optional(v.string()),

    // Bibliographic data
    title: v.string(),
    subtitle: v.optional(v.string()),
    authors: v.array(v.string()),
    contributors: v.optional(
      v.array(
        v.object({
          name: v.string(),
          role: v.string(),
        }),
      ),
    ),

    // Publication
    publisher: v.optional(v.string()),
    publicationYear: v.optional(v.number()),
    publicationPlace: v.optional(v.string()),
    edition: v.optional(v.string()),
    volume: v.optional(v.string()),
    issue: v.optional(v.string()),

    // Language
    language: v.string(),
    originalLanguage: v.optional(v.string()),
    originalTitle: v.optional(v.string()),

    // Physical description
    pages: v.optional(v.number()),
    duration: v.optional(v.number()),
    format: v.optional(v.string()),
    dimensions: v.optional(v.string()),

    // Classification & subjects
    deweyDecimal: v.optional(v.string()),
    lcClassification: v.optional(v.string()),
    categories: v.optional(v.array(v.string())),
    genres: v.optional(v.array(v.string())),
    subjects: v.optional(v.array(v.string())),
    keywords: v.optional(v.array(v.string())),
    targetAudience: v.optional(
      v.union(
        v.literal("children"),
        v.literal("young_adult"),
        v.literal("adult"),
        v.literal("all_ages"),
      ),
    ),

    // Series
    series: v.optional(v.string()),
    seriesNumber: v.optional(v.number()),

    // Content
    description: v.optional(v.string()),
    tableOfContents: v.optional(v.string()),
    summary: v.optional(v.string()),

    // Media
    coverImageId: v.optional(v.id("_storage")),
    coverImageUrl: v.optional(v.string()),

    // Inventory summary
    totalCopies: v.number(),
    availableCopies: v.number(),

    // Status
    catalogStatus: v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("archived"),
    ),

    // Circulation rules
    isCirculating: v.boolean(),
    loanPeriodDays: v.optional(v.number()),
    maxRenewals: v.optional(v.number()),

    // Metadata
    notes: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    lastModifiedBy: v.optional(v.id("users")),
    lastModifiedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_type", ["organizationId", "itemType"])
    .index("by_organization_and_status", ["organizationId", "catalogStatus"])
    .index("by_isbn", ["isbn"])
    .index("by_isbn13", ["isbn13"])
    .index("by_barcode", ["barcode"])
    .index("by_callNumber", ["callNumber"])
    .index("by_collection", ["collectionId"])
    .searchIndex("search_library_items", {
      searchField: "title",
      filterFields: ["organizationId", "itemType", "catalogStatus"],
    }),

  // Item Copies - Individual physical copies
  itemCopies: defineTable({
    organizationId: v.id("organizations"),
    itemId: v.id("libraryItems"),

    copyNumber: v.number(),
    barcode: v.string(),

    // Location
    locationId: v.optional(v.id("locations")),
    shelfLocation: v.optional(v.string()),

    // Status
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

    // Condition
    condition: v.union(
      v.literal("new"),
      v.literal("excellent"),
      v.literal("good"),
      v.literal("fair"),
      v.literal("poor"),
    ),
    conditionNotes: v.optional(v.string()),

    // Acquisition
    acquisitionDate: v.optional(v.number()),
    acquisitionMethod: v.optional(v.string()),
    acquisitionPrice: v.optional(v.number()),
    vendor: v.optional(v.string()),

    // Value
    replacementCost: v.optional(v.number()),

    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_item", ["itemId"])
    .index("by_barcode", ["barcode"])
    .index("by_organization_and_barcode", ["organizationId", "barcode"])
    .index("by_status", ["status"])
    .index("by_location", ["locationId"]),

  // Membership Types - Configurable membership tiers for library patrons
  membershipTypes: defineTable({
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
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_default", ["organizationId", "isDefault"]),

  // Circulations - Checkout/checkin transactions
  circulations: defineTable({
    organizationId: v.id("organizations"),
    accountId: v.id("accounts"),
    copyId: v.id("itemCopies"),
    itemId: v.id("libraryItems"),

    checkoutDate: v.number(),
    dueDate: v.number(),
    returnDate: v.optional(v.number()),

    renewalCount: v.number(),
    lastRenewalDate: v.optional(v.number()),

    status: v.union(
      v.literal("active"),
      v.literal("returned"),
      v.literal("overdue"),
      v.literal("lost"),
      v.literal("claimed_returned"),
    ),

    // Fines
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

    // Staff
    checkedOutBy: v.id("users"),
    checkedInBy: v.optional(v.id("users")),

    // Recall tracking
    isRecalled: v.optional(v.boolean()),
    recalledAt: v.optional(v.number()),
    recalledBy: v.optional(v.id("users")),
    recallReason: v.optional(v.string()),
    originalDueDate: v.optional(v.number()), // Stored when due date is shortened

    // Auto-renewal tracking
    autoRenewed: v.optional(v.boolean()),
    lastAutoRenewalAttempt: v.optional(v.number()),
    autoRenewalFailureReason: v.optional(v.string()),

    notes: v.optional(v.string()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_account", ["accountId"])
    .index("by_copy", ["copyId"])
    .index("by_item", ["itemId"])
    .index("by_status", ["status"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_dueDate", ["dueDate"])
    .index("by_account_and_status", ["accountId", "status"])
    .index("by_organization_and_dueDate", ["organizationId", "dueDate"]),

  // Holds - Reservations queue
  libraryHolds: defineTable({
    organizationId: v.id("organizations"),
    accountId: v.id("accounts"),
    itemId: v.id("libraryItems"),
    copyId: v.optional(v.id("itemCopies")),

    // Queue
    holdDate: v.number(),
    queuePosition: v.number(),

    // Pickup
    pickupLocationId: v.optional(v.id("locations")),
    availableDate: v.optional(v.number()),
    expirationDate: v.optional(v.number()),

    // Status
    status: v.union(
      v.literal("pending"),
      v.literal("available"),
      v.literal("fulfilled"),
      v.literal("cancelled"),
      v.literal("expired"),
    ),

    // Notifications
    notificationSent: v.optional(v.boolean()),
    notificationDate: v.optional(v.number()),

    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_account", ["accountId"])
    .index("by_item", ["itemId"])
    .index("by_status", ["status"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_item_and_status", ["itemId", "status"]),

  // Recalls - Request early return of checked-out items
  libraryRecalls: defineTable({
    organizationId: v.id("organizations"),
    circulationId: v.id("circulations"),
    itemId: v.id("libraryItems"),
    copyId: v.id("itemCopies"),
    accountId: v.id("accounts"), // Current borrower

    // Recall details
    reason: v.string(),
    recalledByAccountId: v.optional(v.id("accounts")), // Patron who needs the item
    recalledByHoldId: v.optional(v.id("libraryHolds")), // Hold that triggered recall

    // Status
    status: v.union(
      v.literal("pending"), // Recall requested
      v.literal("notified"), // Borrower notified
      v.literal("returned"), // Item returned
      v.literal("expired"), // Not returned in time
      v.literal("cancelled"), // Recall cancelled
    ),

    // Dates
    recallDate: v.number(),
    originalDueDate: v.number(),
    newDueDate: v.number(),
    notifiedAt: v.optional(v.number()),
    returnedAt: v.optional(v.number()),

    // Staff
    createdBy: v.id("users"),
    processedBy: v.optional(v.id("users")),

    notes: v.optional(v.string()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_circulation", ["circulationId"])
    .index("by_account", ["accountId"])
    .index("by_item", ["itemId"])
    .index("by_status", ["status"])
    .index("by_organization_and_status", ["organizationId", "status"]),

  // Fines - Fee tracking
  libraryFines: defineTable({
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

    createdAt: v.number(),
    dueDate: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    waivedBy: v.optional(v.id("users")),
    waivedReason: v.optional(v.string()),

    notes: v.optional(v.string()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_account", ["accountId"])
    .index("by_circulation", ["circulationId"])
    .index("by_status", ["status"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_account_and_status", ["accountId", "status"]),

  // Payments - Payment transactions
  libraryPayments: defineTable({
    organizationId: v.id("organizations"),
    accountId: v.id("accounts"),

    amount: v.number(),
    paymentMethod: v.union(
      v.literal("cash"),
      v.literal("card"),
      v.literal("check"),
      v.literal("online"),
      v.literal("other"),
    ),

    fineIds: v.array(v.id("libraryFines")),

    receiptNumber: v.optional(v.string()),
    receivedBy: v.id("users"),
    receivedAt: v.number(),

    notes: v.optional(v.string()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_account", ["accountId"])
    .index("by_receivedAt", ["receivedAt"]),

  // Acquisition Requests - Purchase requests
  libraryAcquisitionRequests: defineTable({
    organizationId: v.id("organizations"),

    // Item info
    title: v.string(),
    authors: v.optional(v.array(v.string())),
    isbn: v.optional(v.string()),
    publisher: v.optional(v.string()),
    itemType: v.optional(v.string()),

    // Request
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

    // Pricing
    estimatedPrice: v.optional(v.number()),
    vendorId: v.optional(v.id("libraryVendors")),
    fundSource: v.optional(v.string()),

    // Workflow
    status: v.union(
      v.literal("submitted"),
      v.literal("under_review"),
      v.literal("approved"),
      v.literal("ordered"),
      v.literal("received"),
      v.literal("cataloged"),
      v.literal("rejected"),
      v.literal("cancelled"),
    ),

    // Approval
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    reviewNotes: v.optional(v.string()),

    // Multi-step workflow
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

    // Order tracking
    orderNumber: v.optional(v.string()),
    orderDate: v.optional(v.number()),
    expectedDelivery: v.optional(v.number()),
    receivedDate: v.optional(v.number()),
    actualPrice: v.optional(v.number()),

    // Link to created item
    libraryItemId: v.optional(v.id("libraryItems")),

    notes: v.optional(v.string()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_status", ["status"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_requestedBy", ["requestedBy"]),

  // Vendors - Supplier management
  libraryVendors: defineTable({
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
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_active", ["organizationId", "isActive"]),

  // Serial Subscriptions - Magazine/journal subscriptions
  serialSubscriptions: defineTable({
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

    status: v.union(
      v.literal("active"),
      v.literal("cancelled"),
      v.literal("expired"),
      v.literal("pending_renewal"),
    ),

    autoRenew: v.boolean(),
    renewalReminderDays: v.optional(v.number()),

    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_item", ["itemId"])
    .index("by_status", ["status"])
    .index("by_organization_and_status", ["organizationId", "status"]),

  // Serial Issues - Individual issues received
  serialIssues: defineTable({
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

    copyId: v.optional(v.id("itemCopies")),

    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_subscription", ["subscriptionId"])
    .index("by_item", ["itemId"])
    .index("by_status", ["status"]),

  // Library Settings - Organization-level configuration
  librarySettings: defineTable({
    organizationId: v.id("organizations"),

    // Circulation policies
    defaultLoanPeriodDays: v.number(),
    defaultRenewalLimit: v.number(),
    renewalPeriodDays: v.number(),
    maxRenewalsAllowed: v.number(),

    // Fines
    finePerDayDefault: v.number(),
    maxFinePerItem: v.optional(v.number()),
    gracePeriodDays: v.number(),
    fineThresholdForBlock: v.optional(v.number()),

    // Patron blocks
    overdueItemsThresholdForBlock: v.optional(v.number()), // Block when overdue items exceed this count

    // Auto-renewal settings
    autoRenewalEnabled: v.optional(v.boolean()), // Organization-wide default
    autoRenewalDaysBeforeDue: v.optional(v.number()), // Days before due date to auto-renew

    // Recall settings
    recallShortenedDueDays: v.optional(v.number()), // Days to shorten due date on recall

    // Holds
    holdExpirationDays: v.number(),
    maxHoldsPerPatron: v.number(),

    // Card numbers
    cardNumberPrefix: v.optional(v.string()),
    cardNumberLength: v.optional(v.number()),
    autoGenerateCardNumbers: v.boolean(),

    // Classification
    classificationSystem: v.union(
      v.literal("dewey"),
      v.literal("lc"),
      v.literal("custom"),
    ),

    // Notifications
    dueDateReminderDays: v.optional(v.number()),
    overdueNoticeDays: v.optional(v.array(v.number())),

    // Receipts
    receiptHeader: v.optional(v.string()),
    receiptFooter: v.optional(v.string()),

    createdAt: v.number(),
    lastModifiedAt: v.optional(v.number()),
  }).index("by_organization", ["organizationId"]),

  // User Preferences - Per-user settings and view preferences
  userPreferences: defineTable({
    userId: v.id("users"),
    organizationId: v.optional(v.id("organizations")), // Optional for org-specific prefs
    key: v.string(), // Preference key (e.g., "objects.viewMode", "objects.columns")
    value: v.string(), // JSON-encoded value
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_key", ["userId", "key"])
    .index("by_user_and_organization", ["userId", "organizationId"])
    .index("by_user_organization_key", ["userId", "organizationId", "key"]),

  // ============================================
  // INSURANCE & CLAIMS MODULE
  // ============================================

  // Insurance Policies - Organization-level insurance policies
  insurancePolicies: defineTable({
    organizationId: v.id("organizations"),
    policyNumber: v.string(),

    // Carrier info
    carrier: v.string(),
    carrierContact: v.optional(v.string()),
    carrierPhone: v.optional(v.string()),
    carrierEmail: v.optional(v.string()),

    // Policy details
    policyType: v.union(
      v.literal("blanket"), // Covers all objects
      v.literal("scheduled"), // Covers specific scheduled items
      v.literal("exhibition"), // Exhibition-specific coverage
      v.literal("transit"), // Transit/shipping coverage
      v.literal("loan"), // Loan-specific coverage
    ),

    // Coverage amounts
    coverageAmount: v.number(), // Total coverage limit
    deductible: v.optional(v.number()),
    perItemLimit: v.optional(v.number()), // Max coverage per item

    // Premium info
    premiumAmount: v.optional(v.number()),
    premiumFrequency: v.optional(
      v.union(
        v.literal("monthly"),
        v.literal("quarterly"),
        v.literal("semi_annual"),
        v.literal("annual"),
      ),
    ),
    nextPremiumDue: v.optional(v.number()),

    // Policy dates
    effectiveDate: v.number(),
    expirationDate: v.number(),
    renewalDate: v.optional(v.number()),
    autoRenew: v.optional(v.boolean()),

    // Status
    status: v.union(
      v.literal("active"),
      v.literal("pending"),
      v.literal("expired"),
      v.literal("cancelled"),
      v.literal("suspended"),
    ),

    // Coverage territory
    territory: v.optional(v.string()), // e.g., "Worldwide", "North America"
    exclusions: v.optional(v.array(v.string())), // Coverage exclusions

    // Documents
    documentIds: v.optional(v.array(v.id("_storage"))),

    // Notes and metadata
    notes: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    lastModifiedBy: v.optional(v.id("users")),
    lastModifiedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_policyNumber", ["policyNumber"])
    .index("by_organization_and_policyNumber", [
      "organizationId",
      "policyNumber",
    ])
    .index("by_expirationDate", ["expirationDate"])
    .index("by_organization_and_expirationDate", [
      "organizationId",
      "expirationDate",
    ]),

  // Insurance Policy Coverages - Links policies to objects/exhibitions/loans
  insuranceCoverages: defineTable({
    organizationId: v.id("organizations"),
    policyId: v.id("insurancePolicies"),

    // What is covered (one of these)
    collectionId: v.optional(v.id("collections")), // Individual object
    exhibitionId: v.optional(v.id("exhibitions")), // Exhibition
    loanId: v.optional(v.id("loans")), // Loan

    // Coverage details
    coveredValue: v.number(), // Insured value for this item
    effectiveDate: v.optional(v.number()), // Override policy dates if needed
    expirationDate: v.optional(v.number()),

    // Status
    status: v.union(
      v.literal("active"),
      v.literal("pending"),
      v.literal("expired"),
      v.literal("removed"),
    ),

    // Verification
    verified: v.optional(v.boolean()),
    verifiedBy: v.optional(v.id("users")),
    verifiedAt: v.optional(v.number()),

    // Appraisal linkage for value verification
    appraisalId: v.optional(v.id("appraisals")), // Link to current appraisal
    appraisalDate: v.optional(v.number()), // Date of linked appraisal
    appraisalRequired: v.optional(v.boolean()), // Whether appraisal is required before coverage
    appraisalWarning: v.optional(v.string()), // Warning about stale/missing appraisal

    notes: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_policy", ["policyId"])
    .index("by_collection", ["collectionId"])
    .index("by_exhibition", ["exhibitionId"])
    .index("by_loan", ["loanId"])
    .index("by_policy_and_status", ["policyId", "status"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_appraisal", ["appraisalId"]),

  // Insurance Claims - Track incidents and claims
  insuranceClaims: defineTable({
    organizationId: v.id("organizations"),
    policyId: v.id("insurancePolicies"),
    claimNumber: v.string(),

    // Related entities (can be one or more)
    collectionIds: v.optional(v.array(v.id("collections"))),
    exhibitionId: v.optional(v.id("exhibitions")),
    loanId: v.optional(v.id("loans")),

    // Incident details
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

    // Claim amounts
    claimedAmount: v.number(),
    assessedAmount: v.optional(v.number()),
    settledAmount: v.optional(v.number()),
    deductibleApplied: v.optional(v.number()),

    // Status tracking
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

    // Dates
    reportedDate: v.number(),
    submittedDate: v.optional(v.number()),
    reviewStartDate: v.optional(v.number()),
    decisionDate: v.optional(v.number()),
    settlementDate: v.optional(v.number()),

    // Adjuster info
    adjusterName: v.optional(v.string()),
    adjusterPhone: v.optional(v.string()),
    adjusterEmail: v.optional(v.string()),
    adjusterNotes: v.optional(v.string()),

    // Documents and evidence
    documentIds: v.optional(v.array(v.id("_storage"))),
    photoIds: v.optional(v.array(v.id("_storage"))),

    // Resolution
    denialReason: v.optional(v.string()),
    payoutMethod: v.optional(
      v.union(
        v.literal("check"),
        v.literal("wire"),
        v.literal("repair_reimbursement"),
        v.literal("replacement"),
      ),
    ),
    payoutDate: v.optional(v.number()),
    payoutReference: v.optional(v.string()),

    // Auto-claim tracking
    isAutoClaim: v.optional(v.boolean()), // True if auto-generated from loan return damage
    autoClaimSource: v.optional(v.string()), // "loan_return_damage", etc.
    conditionDisputeId: v.optional(v.id("conditionDisputes")), // Link to condition dispute if applicable

    // Dispute tracking
    isDisputed: v.optional(v.boolean()),
    disputeReason: v.optional(v.string()),
    disputeDate: v.optional(v.number()),
    disputeStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("in_review"),
        v.literal("resolved"),
        v.literal("escalated"),
      ),
    ),
    disputeResolution: v.optional(v.string()),
    disputeResolvedDate: v.optional(v.number()),
    disputeDocumentIds: v.optional(v.array(v.id("_storage"))),

    // Notes and audit
    internalNotes: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    lastModifiedBy: v.optional(v.id("users")),
    lastModifiedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_policy", ["policyId"])
    .index("by_claimNumber", ["claimNumber"])
    .index("by_organization_and_claimNumber", ["organizationId", "claimNumber"])
    .index("by_status", ["status"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_incidentDate", ["incidentDate"]),

  // Claim number counter tracking
  claimCounters: defineTable({
    organizationId: v.id("organizations"),
    year: v.number(),
    currentValue: v.number(),
    lastGeneratedAt: v.number(),
  }).index("by_organization_and_year", ["organizationId", "year"]),

  // ============================================
  // TRANSIT LOG MODULE
  // ============================================

  // Transit Records - Shipment tracking for objects, loans, exhibitions
  transitRecords: defineTable({
    organizationId: v.id("organizations"),
    transitNumber: v.string(), // TRN-YYYY-XXXX format

    // What is being shipped (one or more of these)
    collectionIds: v.optional(v.array(v.id("collections"))), // Individual objects
    loanId: v.optional(v.id("loans")), // Associated loan
    exhibitionId: v.optional(v.id("exhibitions")), // Associated exhibition

    // Transit type
    transitType: v.union(
      v.literal("outgoing"), // Shipping out from organization
      v.literal("incoming"), // Receiving shipment
      v.literal("internal"), // Internal transfer between locations
      v.literal("return"), // Return shipment
    ),

    // Route information
    originName: v.string(),
    originAddress: v.optional(v.string()),
    originLocationId: v.optional(v.id("locations")), // If internal location
    originContact: v.optional(v.string()),
    originPhone: v.optional(v.string()),

    destinationName: v.string(),
    destinationAddress: v.optional(v.string()),
    destinationLocationId: v.optional(v.id("locations")), // If internal location
    destinationContact: v.optional(v.string()),
    destinationPhone: v.optional(v.string()),

    // Carrier information
    carrier: v.string(),
    carrierContact: v.optional(v.string()),
    carrierPhone: v.optional(v.string()),
    carrierEmail: v.optional(v.string()),
    carrierType: v.optional(
      v.union(
        v.literal("art_handler"), // Specialized art transport
        v.literal("courier"), // Hand-carried
        v.literal("freight"), // Commercial freight
        v.literal("postal"), // Standard postal service
        v.literal("internal"), // Own transport
        v.literal("other"),
      ),
    ),

    // Tracking
    trackingNumber: v.optional(v.string()),
    trackingUrl: v.optional(v.string()),
    waybillNumber: v.optional(v.string()),

    // Dates and times
    scheduledPickupDate: v.optional(v.number()),
    actualPickupDate: v.optional(v.number()),
    estimatedDeliveryDate: v.optional(v.number()),
    actualDeliveryDate: v.optional(v.number()),

    // Status
    status: v.union(
      v.literal("draft"), // Not yet scheduled
      v.literal("scheduled"), // Pickup scheduled
      v.literal("in_transit"), // Currently being transported
      v.literal("out_for_delivery"), // Final delivery stage
      v.literal("delivered"), // Successfully delivered
      v.literal("delayed"), // Encountered delay
      v.literal("held"), // Held at customs/checkpoint
      v.literal("returned"), // Returned to sender
      v.literal("cancelled"), // Shipment cancelled
    ),

    // Shipping details
    packageCount: v.optional(v.number()),
    totalWeight: v.optional(v.number()),
    weightUnit: v.optional(v.union(v.literal("kg"), v.literal("lb"))),
    dimensions: v.optional(v.string()), // Free-text for multiple packages
    packingMethod: v.optional(v.string()), // e.g., "Museum crate", "Soft pack"
    specialHandling: v.optional(v.array(v.string())), // e.g., ["Climate controlled", "Fragile", "This side up"]

    // Insurance for transit
    insurancePolicyId: v.optional(v.id("insurancePolicies")),
    insuranceValue: v.optional(v.number()),
    insuranceReference: v.optional(v.string()),

    // Cost
    shippingCost: v.optional(v.number()),
    currency: v.optional(v.string()), // Default USD

    // Condition reports
    conditionAtPickup: v.optional(v.string()),
    conditionAtDelivery: v.optional(v.string()),
    conditionReportIds: v.optional(v.array(v.id("conditionReports"))),

    // Documents
    documentIds: v.optional(v.array(v.id("_storage"))), // Bills of lading, customs docs, etc.

    // Notes
    notes: v.optional(v.string()),
    internalNotes: v.optional(v.string()),

    // Audit
    createdBy: v.id("users"),
    createdAt: v.number(),
    lastModifiedBy: v.optional(v.id("users")),
    lastModifiedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_transitNumber", ["transitNumber"])
    .index("by_organization_and_transitNumber", [
      "organizationId",
      "transitNumber",
    ])
    .index("by_status", ["status"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_loan", ["loanId"])
    .index("by_exhibition", ["exhibitionId"])
    .index("by_carrier", ["carrier"])
    .index("by_organization_and_carrier", ["organizationId", "carrier"])
    .index("by_scheduledPickupDate", ["scheduledPickupDate"])
    .index("by_estimatedDeliveryDate", ["estimatedDeliveryDate"]),

  // Transit Items - Individual objects in a transit record
  transitItems: defineTable({
    transitRecordId: v.id("transitRecords"),
    collectionId: v.id("collections"),

    // Item-specific details
    conditionAtPickup: v.optional(v.string()),
    conditionAtDelivery: v.optional(v.string()),
    packingNotes: v.optional(v.string()),
    specialHandling: v.optional(v.array(v.string())),

    // Status for partial deliveries
    status: v.union(
      v.literal("pending"), // Not yet picked up
      v.literal("in_transit"), // Being transported
      v.literal("delivered"), // Successfully delivered
      v.literal("damaged"), // Damaged during transit
      v.literal("missing"), // Missing/lost
    ),

    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_transitRecord", ["transitRecordId"])
    .index("by_collection", ["collectionId"])
    .index("by_status", ["status"]),

  // Transit Status Updates - Tracking history/checkpoints
  transitStatusUpdates: defineTable({
    transitRecordId: v.id("transitRecords"),

    // Update details
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
    location: v.optional(v.string()), // Current location during transit
    description: v.string(), // What happened

    // Environmental conditions (for sensitive items)
    temperature: v.optional(v.number()),
    humidity: v.optional(v.number()),

    // Who reported
    reportedBy: v.optional(v.id("users")), // Internal user
    reportedByName: v.optional(v.string()), // External reporter (carrier)
    reportedAt: v.number(),

    // Evidence
    photoIds: v.optional(v.array(v.id("_storage"))),
    documentIds: v.optional(v.array(v.id("_storage"))),

    notes: v.optional(v.string()),
  })
    .index("by_transitRecord", ["transitRecordId"])
    .index("by_status", ["status"])
    .index("by_reportedAt", ["reportedAt"]),

  // Transit number counter tracking
  transitCounters: defineTable({
    organizationId: v.id("organizations"),
    year: v.number(),
    currentValue: v.number(),
    lastGeneratedAt: v.number(),
  }).index("by_organization_and_year", ["organizationId", "year"]),

  // ============================================
  // INSTALLATION PLANNING MODULE
  // ============================================

  // Installation Tasks - Tasks for exhibition setup
  installationTasks: defineTable({
    organizationId: v.id("organizations"),
    exhibitionId: v.id("exhibitions"),

    // Task details
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

    // Assignment
    assigneeId: v.optional(v.id("users")), // Internal user
    assigneeName: v.optional(v.string()), // External contractor name

    // Timeline
    dueDate: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    completedBy: v.optional(v.id("users")),

    // Time tracking
    estimatedHours: v.optional(v.number()),
    actualHours: v.optional(v.number()),

    // Dependencies
    dependsOnTaskIds: v.optional(v.array(v.id("installationTasks"))),
    blockedReason: v.optional(v.string()), // Reason when status is blocked

    // Notes
    notes: v.optional(v.string()),

    // Audit
    createdBy: v.id("users"),
    createdAt: v.number(),
    lastModifiedBy: v.optional(v.id("users")),
    lastModifiedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_exhibition", ["exhibitionId"])
    .index("by_assignee", ["assigneeId"])
    .index("by_status", ["status"])
    .index("by_organization_and_exhibition", ["organizationId", "exhibitionId"])
    .index("by_exhibition_and_status", ["exhibitionId", "status"])
    .index("by_dueDate", ["dueDate"]),

  // Installation Task Templates - Reusable task templates
  installationTaskTemplates: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
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
    defaultPriority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent"),
    ),
    defaultEstimatedHours: v.optional(v.number()),
    checklist: v.optional(
      v.array(
        v.object({
          item: v.string(),
          required: v.boolean(),
        }),
      ),
    ),
    isActive: v.boolean(),

    // Audit
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_active", ["organizationId", "isActive"])
    .index("by_taskType", ["taskType"]),

  // Installation Task Comments - Comments on tasks
  installationTaskComments: defineTable({
    taskId: v.id("installationTasks"),
    authorId: v.id("users"),
    content: v.string(),
    attachmentIds: v.optional(v.array(v.id("_storage"))),
    createdAt: v.number(),
  })
    .index("by_task", ["taskId"])
    .index("by_createdAt", ["createdAt"]),

  // Installation Task Checklists - Checklist items for a task
  installationTaskChecklists: defineTable({
    taskId: v.id("installationTasks"),
    item: v.string(),
    completed: v.boolean(),
    completedBy: v.optional(v.id("users")),
    completedAt: v.optional(v.number()),
    sortOrder: v.number(),
  }).index("by_task", ["taskId"]),

  // ============================================
  // INTEGRATION SUBSCRIPTIONS
  // ============================================

  // Integration Subscriptions - Tracks paid integration subscriptions per organization
  integrationSubscriptions: defineTable({
    organizationId: v.id("organizations"),
    integrationId: v.string(), // e.g., "library"

    // Polar subscription details
    productId: v.string(), // Polar product ID
    subscriptionId: v.string(), // Polar subscription ID
    customerId: v.string(), // Polar customer ID

    // Subscription status
    status: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("unpaid"),
      v.literal("incomplete"),
    ),
    cancelAtPeriodEnd: v.boolean(),
    currentPeriodEnd: v.number(), // Unix timestamp

    // Metadata from checkout
    metadata: v.optional(metadataRecord),

    // Audit
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_integration", [
      "organizationId",
      "integrationId",
    ])
    .index("by_subscription", ["subscriptionId"])
    .index("by_status", ["status"]),

  contacts: defineTable({
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
    mobile: v.optional(v.string()),
    preferredContact: v.optional(
      v.union(v.literal("email"), v.literal("phone"), v.literal("mobile")),
    ),
    isPrimary: v.boolean(),
    isActive: v.boolean(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_account", ["accountId"])
    .index("by_organization_and_account", ["organizationId", "accountId"])
    .index("by_email", ["email"]),

  accountRelationships: defineTable({
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
    metadata: v.optional(metadataRecord),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_account", ["accountId"])
    .index("by_organization_and_account", ["organizationId", "accountId"])
    .index("by_related_entity", ["relatedEntityType", "relatedEntityId"])
    .index("by_organization_account_and_type", [
      "organizationId",
      "accountId",
      "relationshipType",
    ]),

  accountDocuments: defineTable({
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
  })
    .index("by_organization", ["organizationId"])
    .index("by_account", ["accountId"])
    .index("by_organization_and_account", ["organizationId", "accountId"])
    .index("by_storage", ["storageId"]),

  accountSegments: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    filters: v.array(filterCondition),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_name", ["organizationId", "name"]),

  // ============================================
  // SCHEDULED REPORTS (2.10.1)
  // ============================================

  scheduledReports: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),

    // Report type and configuration
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
    reportConfig: v.optional(
      v.object({
        dateRange: v.optional(
          v.union(
            v.literal("last_7_days"),
            v.literal("last_30_days"),
            v.literal("last_90_days"),
            v.literal("last_year"),
            v.literal("year_to_date"),
            v.literal("custom"),
          ),
        ),
        customStartDate: v.optional(v.number()),
        customEndDate: v.optional(v.number()),
        includeComparison: v.optional(v.boolean()),
        comparisonPeriod: v.optional(
          v.union(
            v.literal("previous_period"),
            v.literal("same_period_last_year"),
          ),
        ),
        filters: v.optional(
          v.object({
            locationIds: v.optional(v.array(v.id("locations"))),
            collectionGroupIds: v.optional(v.array(v.id("collectionGroups"))),
            objectTypes: v.optional(v.array(v.string())),
          }),
        ),
      }),
    ),

    // Schedule configuration
    schedule: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("quarterly"),
      v.literal("on_demand"),
    ),
    scheduledDay: v.optional(v.number()), // Day of week (0-6) or day of month (1-31)
    scheduledTime: v.optional(v.string()), // HH:MM in 24hr format
    timezone: v.optional(v.string()),

    // Email delivery
    emailRecipients: v.optional(v.array(v.string())),
    emailSubject: v.optional(v.string()),
    includeAttachment: v.optional(v.boolean()),
    attachmentFormat: v.optional(
      v.union(v.literal("pdf"), v.literal("csv"), v.literal("excel")),
    ),

    // Status
    isActive: v.boolean(),
    lastRunAt: v.optional(v.number()),
    nextRunAt: v.optional(v.number()),
    lastRunStatus: v.optional(
      v.union(v.literal("success"), v.literal("failed"), v.literal("partial")),
    ),
    lastRunError: v.optional(v.string()),

    // Metadata
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_next_run", ["isActive", "nextRunAt"])
    .index("by_report_type", ["organizationId", "reportType"]),

  // Report run history
  reportRuns: defineTable({
    organizationId: v.id("organizations"),
    scheduledReportId: v.optional(v.id("scheduledReports")),
    reportType: v.string(),
    reportName: v.string(),

    // Run details
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    status: v.union(
      v.literal("running"),
      v.literal("success"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    errorMessage: v.optional(v.string()),

    // Report data
    reportData: v.optional(v.any()), // JSON blob of report results
    storageId: v.optional(v.id("_storage")), // For PDF/Excel exports

    // Delivery
    emailsSent: v.optional(v.array(v.string())),
    emailSentAt: v.optional(v.number()),

    // Metadata
    triggeredBy: v.union(v.literal("schedule"), v.literal("manual")),
    triggeredByUserId: v.optional(v.id("users")),
  })
    .index("by_organization", ["organizationId"])
    .index("by_scheduled_report", ["scheduledReportId"])
    .index("by_status", ["organizationId", "status"]),

  // ============================================
  // Batch Operations
  // ============================================

  // Batch job tracking for bulk operations
  batchJobs: defineTable({
    organizationId: v.id("organizations"),

    // Job type
    jobType: v.union(
      v.literal("bulk_edit"),
      v.literal("bulk_move"),
      v.literal("bulk_status_change"),
      v.literal("bulk_delete"),
      v.literal("bulk_export"),
    ),

    // Job configuration
    targetIds: v.array(v.id("collections")), // IDs being processed
    totalItems: v.number(),

    // For bulk_edit: fields to update
    editPayload: v.optional(
      v.object({
        collectionGroupId: v.optional(v.id("collectionGroups")),
        currentLocationId: v.optional(v.id("locations")),
        condition: v.optional(v.string()),
        displayStatus: v.optional(v.string()),
        isPubliclyVisible: v.optional(v.boolean()),
        isSearchable: v.optional(v.boolean()),
        tags: v.optional(v.array(v.string())),
        customFields: v.optional(v.record(v.string(), customFieldValue)),
      }),
    ),

    // For bulk_move: target location
    movePayload: v.optional(
      v.object({
        toLocationId: v.id("locations"),
        reason: v.optional(v.string()),
        overrideCapacity: v.optional(v.boolean()),
        overrideStatus: v.optional(v.boolean()),
      }),
    ),

    // For bulk_status_change
    statusPayload: v.optional(
      v.object({
        newStatus: v.union(
          v.literal("active"),
          v.literal("archived"),
          v.literal("deleted"),
        ),
        reason: v.optional(v.string()),
      }),
    ),

    // Progress tracking
    processedItems: v.number(),
    successCount: v.number(),
    failureCount: v.number(),
    errors: v.optional(
      v.array(
        v.object({
          itemId: v.id("collections"),
          error: v.string(),
        }),
      ),
    ),

    // Status
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),

    // Timestamps
    createdBy: v.id("users"),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_created_at", ["organizationId", "createdAt"]),

  // Saved search/filter views per user
  savedViews: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    name: v.string(),
    // Module this view applies to
    module: v.union(
      v.literal("objects"),
      v.literal("loans"),
      v.literal("accounts"),
      v.literal("locations"),
      v.literal("accessions"),
    ),
    // Serialized filter state (JSON string of filter key-value pairs)
    filters: v.string(),
    // Whether this is the user's default view for this module
    isDefault: v.optional(v.boolean()),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_module", ["userId", "module"])
    .index("by_organization_and_user", ["organizationId", "userId"])
    .index("by_organization_and_module", ["organizationId", "module"]),

  // ============================================
  // OBJECT COMMENTS
  // ============================================

  // Comments on collection objects
  objectComments: defineTable({
    organizationId: v.id("organizations"),
    objectId: v.id("collections"),
    userId: v.id("users"),
    content: v.string(),
    mentionedUserIds: v.optional(v.array(v.id("users"))),
    createdAt: v.number(),
  })
    .index("by_object", ["objectId"])
    .index("by_organization", ["organizationId"]),
});
