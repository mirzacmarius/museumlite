import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
  }).index("by_organization", ["organizationId"]),

  // Granular permission definitions
  permissions: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    category: v.union(
      v.literal("collections"),
      v.literal("loans"),
      v.literal("locations"),
      v.literal("media"),
      v.literal("users"),
      v.literal("organization"),
    ),
  }).index("by_category", ["category"]),

  // Many-to-many roles-permissions
  rolePermissions: defineTable({
    roleId: v.id("roles"),
    permissionId: v.id("permissions"),
  })
    .index("by_role", ["roleId"])
    .index("by_permission", ["permissionId"]),

  // Main cataloging table
  collections: defineTable({
    organizationId: v.id("organizations"),
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
    objectType: v.optional(v.string()),
    objectName: v.optional(v.string()),
    culture: v.optional(v.string()),
    period: v.optional(v.string()),
    dateCreated: v.optional(v.string()),
    materials: v.optional(v.string()),
    dimensions: v.optional(v.string()),
    description: v.optional(v.string()),
    condition: v.optional(v.string()),
    provenance: v.optional(v.string()),
    exhibitionHistory: v.optional(v.string()),
    currentLocationId: v.optional(v.id("locations")),
    status: v.union(
      v.literal("active"),
      v.literal("loaned"),
      v.literal("deaccessioned"),
    ),
    catalogedBy: v.id("users"),
    catalogedAt: v.number(),
    lastModifiedBy: v.optional(v.id("users")),
    lastModifiedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_accessionNumber", ["accessionNumber"])
    .index("by_organization_and_accessionNumber", [
      "organizationId",
      "accessionNumber",
    ])
    .index("by_currentLocation", ["currentLocationId"])
    .index("by_status", ["status"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .searchIndex("search_index", {
      searchField: "title",
      filterFields: ["organizationId", "status"],
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
    isPrimary: v.boolean(),
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
  })
    .index("by_collection", ["collectionId"])
    .index("by_organization", ["organizationId"])
    .index("by_uploadStatus", ["uploadStatus"]),

  // Accession workflow records
  accessions: defineTable({
    organizationId: v.id("organizations"),
    collectionId: v.optional(v.id("collections")),
    accessionNumber: v.string(),
    dateReceived: v.number(),
    source: v.string(),
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
  })
    .index("by_organization", ["organizationId"])
    .index("by_collection", ["collectionId"])
    .index("by_status", ["status"])
    .index("by_organization_and_status", ["organizationId", "status"]),

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
  })
    .index("by_organization", ["organizationId"])
    .index("by_collection", ["collectionId"])
    .index("by_status", ["status"])
    .index("by_organization_and_status", ["organizationId", "status"]),

  // Hierarchical location structure
  locations: defineTable({
    organizationId: v.id("organizations"),
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
    customFields: v.optional(v.record(v.string(), v.any())),
  })
    .index("by_organization", ["organizationId"])
    .index("by_parentLocation", ["parentLocationId"])
    .index("by_organization_and_type", ["organizationId", "type"]),

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
    .index("by_movedAt", ["movedAt"]),

  // Loan records
  loans: defineTable({
    organizationId: v.id("organizations"),
    loanNumber: v.string(),
    type: v.union(v.literal("incoming"), v.literal("outgoing")),
    lenderBorrowerName: v.string(),
    lenderBorrowerContact: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("returned"),
      v.literal("cancelled"),
    ),
    terms: v.optional(v.string()),
    insuranceValue: v.optional(v.number()),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    workflowConfig: v.optional(
      v.object({
        steps: v.array(
          v.object({
            stepNumber: v.number(),
            roleId: v.id("roles"),
            name: v.string(),
          }),
        ),
        canInitiateRoles: v.array(v.id("roles")),
      }),
    ),
    useDetailedConditionReports: v.optional(v.boolean()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_status", ["status"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_type", ["type"])
    .index("by_organization_and_type", ["organizationId", "type"]),

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

  // Activity tracking
  auditLog: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    changes: v.optional(v.any()),
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
    .index("by_user_and_read", ["userId", "read"]),

  // Organization workflow configurations
  workflowConfigs: defineTable({
    organizationId: v.id("organizations"),
    workflowType: v.union(v.literal("accession"), v.literal("deaccession")),
    steps: v.array(
      v.object({
        stepNumber: v.number(),
        roleId: v.id("roles"),
        name: v.string(),
      }),
    ),
    canInitiateRoles: v.array(v.id("roles")),
  })
    .index("by_organization", ["organizationId"])
    .index("by_workflowType", ["workflowType"]),

  // Webhook endpoints for external integrations
  webhooks: defineTable({
    organizationId: v.id("organizations"),
    url: v.string(),
    secret: v.string(),
    events: v.array(v.string()),
    isActive: v.boolean(),
    lastTriggeredAt: v.optional(v.number()),
  }).index("by_organization", ["organizationId"]),

  // API keys for external integrations
  apiKeys: defineTable({
    organizationId: v.id("organizations"),
    keyHash: v.string(),
    name: v.string(),
    permissions: v.array(v.string()),
    expiresAt: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
    createdBy: v.id("users"),
  }).index("by_organization", ["organizationId"]),

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
});
