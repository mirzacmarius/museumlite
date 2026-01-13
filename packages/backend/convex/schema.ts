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

  // Collection Groups (Virtual collections of objects)
  collectionGroups: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    curatorId: v.optional(v.id("users")),
    imageId: v.optional(v.id("_storage")),
    managedByRoleId: v.optional(v.id("roles")),
    itemsCount: v.optional(v.number()),
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
    customFields: v.optional(v.record(v.string(), v.any())),
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
    .index("by_collectionGroup", ["collectionGroupId"])
    .index("by_parentObject", ["parentObjectId"])
    .index("by_currentLocation", ["currentLocationId"])
    .index("by_status", ["status"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_organization_and_type", ["organizationId", "collectionType"])
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
  })
    .index("by_collection", ["collectionId"])
    .index("by_organization", ["organizationId"])
    .index("by_uploadStatus", ["uploadStatus"])
    .index("by_collection_and_category", ["collectionId", "mediaCategory"]),

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
  })
    .index("by_organization", ["organizationId"])
    .index("by_collection", ["collectionId"])
    .index("by_status", ["status"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_donor_account", ["donorAccountId"])
    .index("by_assigned_to", ["assignedTo"]),

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
    proceedsAmount: v.optional(v.number()),
    proceedsCurrency: v.optional(v.string()),
    proceedsRecipient: v.optional(v.string()),
    proceedsDate: v.optional(v.number()),
    proceedsNotes: v.optional(v.string()),
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
    // Capacity tracking for storage locations
    capacity: v.optional(v.number()), // Max number of objects this location can hold
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
    useDetailedConditionReports: v.optional(v.boolean()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_status", ["status"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_type", ["type"])
    .index("by_organization_and_type", ["organizationId", "type"])
    .index("by_account", ["accountId"])
    .index("by_organization_and_endDate", ["organizationId", "endDate"]),

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
  })
    .index("by_collection", ["collectionId"])
    .index("by_organization", ["organizationId"])
    .index("by_performedAt", ["performedAt"])
    .index("by_organization_and_status", ["organizationId", "status"]),

  // Exhibition records for objects
  exhibitions: defineTable({
    collectionId: v.id("collections"),
    organizationId: v.id("organizations"),
    title: v.string(),
    location: v.optional(v.string()),
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
        v.literal("active"),
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
  })
    .index("by_collection", ["collectionId"])
    .index("by_organization", ["organizationId"])
    .index("by_startDate", ["startDate"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_organization_and_startDate", ["organizationId", "startDate"]),

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
      }),
    ),
    canInitiateRoles: v.array(v.id("roles")),
  })
    .index("by_organization", ["organizationId"])
    .index("by_workflowType", ["workflowType"]),

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

    notes: v.optional(v.string()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_account", ["accountId"])
    .index("by_copy", ["copyId"])
    .index("by_item", ["itemId"])
    .index("by_status", ["status"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_dueDate", ["dueDate"])
    .index("by_account_and_status", ["accountId", "status"]),

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
});
