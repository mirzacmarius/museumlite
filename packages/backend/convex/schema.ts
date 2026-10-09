import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  accessionReviewDecisionValidator,
  accessionStatusValidator,
} from "./utils/accessionReview";
import {
  caseTaskCaseTypeValidator,
  caseTaskEvidenceReferenceValidator,
  caseTaskStatusValidator,
} from "./utils/caseTaskValidators";
import {
  archiveDetailFields,
  coinsStampsDetailFields,
  fineArtDetailFields,
  naturalHistoryDetailFields,
  typeDetailRecordFields,
  vehicleDetailFields,
  wineDetailFields,
} from "./utils/collectionTypeDetailFields";
import {
  exportFormat,
  exportSource,
  exportStatus,
} from "./utils/exportContract";
import { loanAgreementTemplateFields } from "./utils/loanAgreementValidators";
import {
  collectionTypeValidator,
  enabledModuleValidator,
} from "./utils/moduleValidators";
import {
  movementKindValidator,
  moveRequestConflictValidator,
} from "./utils/movementValidators";
import {
  accessionDraftMediaValidator,
  objectDraftDataValidator,
} from "./utils/objectDraftData";
import { objectEntryFields } from "./utils/objectEntryValidators";
import {
  partyDuplicateReviewDocumentValidator,
  partyLinkDocumentValidator,
} from "./utils/partyValidators";
import {
  projectionAvailability,
  projectionDiscrepancyFields,
  projectionFact,
  projectionFanOutKind,
  projectionGenerationFields,
  projectionUnavailableReason,
} from "./utils/projectionValidators";
import {
  provenanceClaimDocumentValidator,
  provenanceEvidenceDocumentValidator,
  provenanceReviewDocumentValidator,
} from "./utils/provenanceValidators";
import {
  webhookDeliveryAttemptFields,
  webhookDeliveryFields,
  webhookEventFields,
} from "./utils/webhookValidators";

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

export default defineSchema({
  organizationProjectionStates: defineTable({
    organizationId: v.id("organizations"),
    definitionVersion: v.number(),
    revision: v.number(),
    availability: projectionAvailability,
    reason: v.optional(projectionUnavailableReason),
    activeGenerationId: v.optional(v.id("projectionGenerations")),
    buildingGenerationId: v.optional(v.id("projectionGenerations")),
    reconcilingGenerationId: v.optional(v.id("projectionGenerations")),
    lastReconciliationId: v.optional(v.id("projectionGenerations")),
    lastBuiltAt: v.optional(v.number()),
    lastVerifiedAt: v.optional(v.number()),
    invalidatedAt: v.optional(v.number()),
    metricSlotsInUse: v.optional(v.array(v.number())),
  }).index("by_organizationId", ["organizationId"]),
  // Wide relation refreshes deferred from a source write, processed in bounded pages.
  projectionFanOuts: defineTable({
    organizationId: v.id("organizations"),
    generationId: v.id("projectionGenerations"),
    kind: projectionFanOutKind,
    sourceTable: v.optional(v.string()),
    targetId: v.string(),
    step: v.number(),
    cursor: v.union(v.string(), v.null()),
    enqueuedAt: v.number(),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_generationId_and_kind_and_targetId", [
      "generationId",
      "kind",
      "targetId",
    ]),
  projectionGenerations: defineTable(projectionGenerationFields).index(
    "by_organizationId_and_startedAt",
    ["organizationId", "startedAt"],
  ),
  projectionContributions: defineTable({
    organizationId: v.id("organizations"),
    generationId: v.id("projectionGenerations"),
    sourceTable: v.string(),
    sourceId: v.string(),
    facts: v.array(projectionFact),
  })
    .index("by_generationId_and_sourceTable_and_sourceId", [
      "generationId",
      "sourceTable",
      "sourceId",
    ])
    .index("by_sourceTable_and_sourceId", ["sourceTable", "sourceId"])
    .index("by_generationId", ["generationId"]),
  projectionTotals: defineTable({
    organizationId: v.id("organizations"),
    generationId: v.id("projectionGenerations"),
    scope: v.string(),
    partition: v.string(),
    category: v.string(),
    rank: v.number(),
    counts: v.record(v.string(), v.number()),
  })
    .index("by_generationId_and_scope_and_partition", [
      "generationId",
      "scope",
      "partition",
    ])
    .index("by_generationId_and_category_and_rank", [
      "generationId",
      "category",
      "rank",
    ])
    .index("by_generationId", ["generationId"]),
  projectionDiscrepancies: defineTable(projectionDiscrepancyFields).index(
    "by_generationId",
    ["generationId"],
  ),
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

    // Account access is revoked while institutional actor identity is retained.
    deactivatedAt: v.optional(v.number()),
    // custom fields
    username: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
    accountEmailOverride: v.optional(v.string()),
    accountNameOverride: v.optional(v.string()),
  }).index("email", ["email"]),

  accountEmailChanges: defineTable({
    userId: v.id("users"),
    email: v.string(),
    codeHash: v.string(),
    expiresAt: v.number(),
    attemptsLeft: v.number(),
    lastSentAt: v.number(),
    cancelled: v.optional(v.boolean()),
  }).index("by_userId", ["userId"]),

  // Multi-tenant organizations
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    accountNumber: v.optional(v.string()),
    customerNumber: v.optional(v.string()),
    allowsIncomingTransferRequests: v.optional(v.boolean()),
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
        accessionWorkflowEnabled: v.optional(v.boolean()),
        deaccessionWorkflowEnabled: v.optional(v.boolean()),
        allowIncomingTransferRequests: v.optional(v.boolean()),
        locationTrackingEnabled: v.optional(v.boolean()),
        locationTypes: v.optional(v.array(v.string())),
        enableDetailedConditionReports: v.optional(v.boolean()),
        enabledIntegrations: v.optional(v.array(v.string())),
        enabledModules: v.optional(v.array(enabledModuleValidator)),
        defaultCollectionType: v.optional(collectionTypeValidator),
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
    ownerUserId: v.optional(v.id("users")),
    isActive: v.optional(v.boolean()),
    requiresPlanSelection: v.optional(v.boolean()),
    preservedSubscriptionTier: v.optional(
      v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
    ),
    parentOrganizationId: v.optional(v.id("organizations")),
    rootOrganizationId: v.optional(v.id("organizations")),
  })
    .index("by_slug", ["slug"])
    .index("by_accountNumber", ["accountNumber"])
    .index("by_customerNumber", ["customerNumber"])
    .index("by_allowsIncomingTransferRequests", [
      "allowsIncomingTransferRequests",
    ])
    .index("by_parent_organization", ["parentOrganizationId"])
    .index("by_root_organization", ["rootOrganizationId"])
    .searchIndex("search_transfer_destinations", {
      searchField: "name",
      filterFields: ["allowsIncomingTransferRequests"],
    }),

  organizationDeletions: defineTable({
    organizationId: v.id("organizations"),
    status: v.union(
      v.literal("pending_super_admin_approval"),
      v.literal("grace_period"),
      v.literal("awaiting_final_notice"),
      v.literal("pending_purge"),
      v.literal("cancelled"),
      v.literal("completed"),
    ),
    requestedAt: v.number(),
    requestedByUserId: v.id("users"),
    superAdminApprovedByUserIds: v.optional(v.array(v.id("users"))),
    cancelToken: v.string(),
    graceEndsAt: v.number(),
    finalNoticeAt: v.number(),
    scheduledDeletionDate: v.optional(v.number()),
    scheduledPurgeAt: v.optional(v.number()),
    initialEmailSentAt: v.optional(v.number()),
    finalNoticeEmailSentAt: v.optional(v.number()),
    preservedSubscriptionTier: v.union(
      v.literal("free"),
      v.literal("pro"),
      v.literal("enterprise"),
    ),
    cancelledAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_cancel_token", ["cancelToken"])
    .index("by_status_and_graceEndsAt", ["status", "graceEndsAt"])
    .index("by_status_and_finalNoticeAt", ["status", "finalNoticeAt"])
    .index("by_status_and_scheduledPurgeAt", ["status", "scheduledPurgeAt"]),

  organizationOwnershipTransferRequests: defineTable({
    organizationId: v.id("organizations"),
    targetOrganizationId: v.id("organizations"),
    status: v.union(
      v.literal("pending_super_admin_approval"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("cancelled"),
      v.literal("completed"),
    ),
    requestedByUserId: v.id("users"),
    requestedAt: v.number(),
    newOwnerUserId: v.id("users"),
    superAdminApprovedByUserIds: v.optional(v.array(v.id("users"))),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_status", ["organizationId", "status"]),

  organizationUsageCounters: defineTable({
    organizationId: v.id("organizations"),
    objectCount: v.number(),
    mediaFileCount: v.number(),
    mediaVersionCount: v.number(),
    storageBytes: v.number(),
    mediaByType: v.record(
      v.string(),
      v.object({
        count: v.number(),
        bytes: v.number(),
      }),
    ),
    lastUpdatedAt: v.number(),
  }).index("by_organization", ["organizationId"]),

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
    role: v.optional(v.union(v.literal("primary"), v.literal("secondary"))),
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
    normalizedIdentifier: v.optional(v.string()),
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
    dimensionDiameter: v.optional(v.string()),
    dimensionHeight: v.optional(v.number()), // in cm
    dimensionWidth: v.optional(v.number()), // in cm
    dimensionDepth: v.optional(v.number()), // in cm
    dimensionWeight: v.optional(v.number()), // in kg
    dimensionUnit: v.optional(v.string()), // "cm", "in", etc.
    weightUnit: v.optional(v.string()), // "kg", "lb", etc.
    description: v.optional(v.string()),
    condition: v.optional(v.string()),
    currentConditionAssessmentId: v.optional(v.id("conditionAssessments")),
    legacyConditionSnapshot: v.optional(v.string()),
    conditionHistory: v.optional(
      v.array(
        v.object({
          condition: v.string(),
          note: v.optional(v.string()),
          changedAt: v.number(),
          changedBy: v.id("users"),
          changedByName: v.optional(v.string()),
        }),
      ),
    ),
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
    collectionType: v.optional(collectionTypeValidator),
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
    .index("by_organization_and_normalizedIdentifier", [
      "organizationId",
      "normalizedIdentifier",
    ])
    .index("by_organization_and_status_and_normalizedIdentifier", [
      "organizationId",
      "status",
      "normalizedIdentifier",
    ])
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
    .index("by_organization_and_location", [
      "organizationId",
      "currentLocationId",
    ])
    .index("by_organization_and_objectType", ["organizationId", "objectType"])
    .index("by_organization_status_public", [
      "organizationId",
      "status",
      "isPubliclyVisible",
    ])
    .index("by_organization_and_type", ["organizationId", "collectionType"])
    .index("by_organization_and_publicSlug", ["organizationId", "publicSlug"])
    .searchIndex("search_index", {
      searchField: "title",
      filterFields: ["organizationId", "status", "collectionType", "title"],
    })
    .searchIndex("search_alternativeTitle", {
      searchField: "alternativeTitle",
      filterFields: ["organizationId", "status"],
    })
    .searchIndex("search_creator", {
      searchField: "creator",
      filterFields: ["organizationId", "status"],
    })
    .searchIndex("search_objectName", {
      searchField: "objectName",
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

  // Temporary entry number counter tracking (MUS-644)
  objectEntryCounters: defineTable({
    organizationId: v.id("organizations"),
    year: v.number(),
    currentValue: v.number(),
    lastGeneratedAt: v.number(),
  }).index("by_organization_and_year", ["organizationId", "year"]),

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
    notes: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    address: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    usageCount: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_name", ["organizationId", "name"]),

  collectionOptionUsages: defineTable({
    organizationId: v.id("organizations"),
    collectionId: v.id("collections"),
    kind: v.union(
      v.literal("condition"),
      v.literal("material"),
      v.literal("type"),
      v.literal("donor"),
    ),
    value: v.string(),
  })
    .index("by_organization_kind_and_value", [
      "organizationId",
      "kind",
      "value",
    ])
    .index("by_collection", ["collectionId"]),

  collectionOptionUsageBackfills: defineTable({
    organizationId: v.id("organizations"),
    completedAt: v.number(),
  }).index("by_organization", ["organizationId"]),

  uploadIntents: defineTable({
    token: v.string(),
    uploadedBy: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
    createdAt: v.number(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  }).index("by_token", ["token"]),

  storageOwnership: defineTable({
    storageId: v.id("_storage"),
    uploadedBy: v.id("users"),
    organizationId: v.optional(v.id("organizations")),
    uploadedAt: v.number(),
    ownerType: v.optional(v.string()),
    ownerId: v.optional(v.string()),
  }).index("by_storageId", ["storageId"]),

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
    publicApproval: v.optional(
      v.object({
        status: v.union(
          v.literal("processing"),
          v.literal("approved"),
          v.literal("failed"),
        ),
        requestId: v.string(),
        sourceStorageId: v.id("_storage"),
        versionId: v.optional(v.id("mediaVersions")),
        renditionStorageId: v.optional(v.id("_storage")),
        approvedBy: v.id("users"),
        approvedAt: v.number(),
        allowOriginalDownload: v.boolean(),
      }),
    ),
  })
    .index("by_collection", ["collectionId"])
    .index("by_collection_and_fileType", ["collectionId", "fileType"])
    .index("by_collection_and_isPrimary_and_fileType", [
      "collectionId",
      "isPrimary",
      "fileType",
    ])
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_uploadedAt", ["organizationId", "uploadedAt"])
    .index("by_organization_and_fileType_and_uploadedAt", [
      "organizationId",
      "fileType",
      "uploadedAt",
    ])
    .index("by_uploadStatus", ["uploadStatus"])
    .index("by_collection_and_category", ["collectionId", "mediaCategory"])
    .index("by_content_hash", ["organizationId", "contentHash"])
    .index("by_rights_status", ["organizationId", "rightsStatus"])
    .index("by_chunkedUploadId", ["chunkedUploadId"])
    .searchIndex("search_media_files", {
      searchField: "fileName",
      filterFields: ["organizationId", "fileType"],
    }),

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
    ...typeDetailRecordFields,
    ...fineArtDetailFields,
  })
    .index("by_collection", ["collectionId"])
    .index("by_organization", ["organizationId"])
    .index("by_reappraisal_date", ["reappraisalDate"]),

  // Wine & Spirits module details
  wineDetails: defineTable({
    ...typeDetailRecordFields,
    ...wineDetailFields,
  })
    .index("by_collection", ["collectionId"])
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_bin", ["organizationId", "binNumber"])
    .index("by_organization_and_vintage", ["organizationId", "vintage"]),

  // Automotive & Machinery module details
  vehicleDetails: defineTable({
    ...typeDetailRecordFields,
    ...vehicleDetailFields,
  })
    .index("by_collection", ["collectionId"])
    .index("by_organization", ["organizationId"])
    .index("by_vin", ["vin"])
    .index("by_organization_and_make", ["organizationId", "make"]),

  // Natural History & Science module details
  naturalHistoryDetails: defineTable({
    ...typeDetailRecordFields,
    ...naturalHistoryDetailFields,
  })
    .index("by_collection", ["collectionId"])
    .index("by_organization", ["organizationId"])
    .index("by_taxonomy", ["kingdom", "phylum", "genus", "species"])
    .index("by_organization_and_species", ["organizationId", "species"]),

  // Corporate Archive module details
  archiveDetails: defineTable({
    ...typeDetailRecordFields,
    ...archiveDetailFields,
  })
    .index("by_collection", ["collectionId"])
    .index("by_organization", ["organizationId"])
    .index("by_retention_expiry", ["retentionExpiresAt"])
    .index("by_organization_and_destruction_flag", [
      "organizationId",
      "flaggedForDestruction",
    ]),

  // Coins and stamps module details
  coinsStampsDetails: defineTable({
    ...typeDetailRecordFields,
    ...coinsStampsDetailFields,
  })
    .index("by_collection", ["collectionId"])
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_category", ["organizationId", "itemCategory"])
    .index("by_organization_and_catalog_number", [
      "organizationId",
      "catalogNumber",
    ]),

  // Accession workflow records
  accessions: defineTable({
    organizationId: v.id("organizations"),
    collectionId: v.optional(v.id("collections")),
    accessionNumber: v.string(),
    catalogIdentifier: v.optional(v.string()),
    normalizedIdentifier: v.optional(v.string()),
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
    status: accessionStatusValidator,
    notes: v.optional(v.string()),
    draftObjectData: v.optional(objectDraftDataValidator),
    draftMedia: v.optional(v.array(accessionDraftMediaValidator)),
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
    // Temporary entry the accessioned object was received under (MUS-644).
    entryId: v.optional(v.id("objectEntries")),
    // Latest reviewer decision on an intake (MUS-673): returned to draft,
    // withdrawn, or restored from withdrawal. Full trail is in case history.
    reviewDecision: v.optional(accessionReviewDecisionValidator),
    // Source verification fields
    sourceVerified: v.optional(v.boolean()),
    sourceVerifiedBy: v.optional(v.id("users")),
    sourceVerifiedAt: v.optional(v.number()),
    sourceVerificationNotes: v.optional(v.string()),
    // Approval despite missing required source verification.
    sourceVerificationException: v.optional(
      v.object({
        reason: v.string(),
        authorizedBy: v.id("users"),
        authorizedAt: v.number(),
        stepNumber: v.number(),
      }),
    ),
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
    .index("by_organization_and_normalizedIdentifier", [
      "organizationId",
      "normalizedIdentifier",
    ])
    .index("by_collection", ["collectionId"])
    .index("by_status", ["status"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_organization_and_dateReceived", [
      "organizationId",
      "dateReceived",
    ])
    .index("by_organization_and_status_and_workflowStep_and_dateReceived", [
      "organizationId",
      "status",
      "workflowStep",
      "dateReceived",
    ])
    .index("by_organization_and_status_and_dateReceived", [
      "organizationId",
      "status",
      "dateReceived",
    ])
    .index("by_organization_and_approvedAt", ["organizationId", "approvedAt"])
    .index("by_donor_account", ["donorAccountId"])
    .index("by_assigned_to", ["assignedTo"])
    .index("by_entry", ["entryId"])
    .searchIndex("search_accessions", {
      searchField: "accessionNumber",
      filterFields: ["organizationId", "status"],
    }),

  // Receipt of property into custody without asserting title (MUS-644). The
  // object exists from entry; the entry closes by accession or recorded exit.
  // Never deleted (ADR 0002).
  objectEntries: defineTable(objectEntryFields)
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_receivedAt", ["organizationId", "receivedAt"])
    .index("by_organization_and_status_and_receivedAt", [
      "organizationId",
      "status",
      "receivedAt",
    ])
    .index("by_organization_and_normalizedEntryNumber", [
      "organizationId",
      "normalizedEntryNumber",
    ])
    .index("by_collection", ["collectionId"])
    .index("by_accession", ["accessionId"]),

  identifierConflictReviews: defineTable({
    organizationId: v.id("organizations"),
    register: v.union(v.literal("catalog"), v.literal("accession")),
    recordId: v.union(v.id("collections"), v.id("accessions")),
    identifier: v.string(),
    normalizedIdentifier: v.string(),
    note: v.string(),
    reviewedBy: v.id("users"),
    reviewedAt: v.number(),
  }).index("by_organization_and_register_and_record", [
    "organizationId",
    "register",
    "recordId",
  ]),

  accessionSearchDocuments: defineTable({
    organizationId: v.id("organizations"),
    accessionId: v.id("accessions"),
    status: accessionStatusValidator,
    searchText: v.string(),
    dateReceived: v.number(),
  })
    .index("by_accession", ["accessionId"])
    .index("by_organization", ["organizationId"])
    .searchIndex("search_text", {
      searchField: "searchText",
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
    targetCollectionStatus: v.optional(
      v.union(
        v.literal("deaccessioned"),
        v.literal("archived"),
        v.literal("deleted"),
      ),
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
    appraisalCurrency: v.optional(v.string()),
    appraisalDate: v.optional(v.number()),
    // Stage-specific disposal evidence. Approved records without a
    // decisionReview predate stage checks and are reported as legacy.
    decisionReview: v.optional(
      v.object({
        policyVersion: v.number(),
        checkedAt: v.number(),
        checks: v.array(
          v.object({
            key: v.string(),
            required: v.boolean(),
            passed: v.boolean(),
          }),
        ),
        exception: v.optional(
          v.object({
            reason: v.string(),
            waivedCheckKeys: v.array(v.string()),
            authorizedBy: v.id("users"),
            authorizedAt: v.number(),
          }),
        ),
      }),
    ),
    exitRecord: v.optional(
      v.object({
        exitDate: v.number(),
        recipient: v.string(),
        reference: v.optional(v.string()),
        notes: v.optional(v.string()),
        recordedBy: v.id("users"),
        recordedAt: v.number(),
      }),
    ),
    exitCorrectionCount: v.optional(v.number()),
    proceedsRecordedBy: v.optional(v.id("users")),
    proceedsRecordedAt: v.optional(v.number()),
    proceedsVerificationException: v.optional(
      v.object({
        reason: v.string(),
        authorizedBy: v.id("users"),
        authorizedAt: v.number(),
      }),
    ),
  })
    .index("by_organization", ["organizationId"])
    .index("by_collection", ["collectionId"])
    .index("by_organization_and_collection_and_status", [
      "organizationId",
      "collectionId",
      "status",
    ])
    .index("by_status", ["status"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_organization_and_dateDeaccessioned", [
      "organizationId",
      "dateDeaccessioned",
    ])
    .index("by_organization_and_status_and_dateDeaccessioned", [
      "organizationId",
      "status",
      "dateDeaccessioned",
    ])
    .index("by_organization_and_approvedAt", ["organizationId", "approvedAt"])
    .index("by_regulatory_token", ["regulatoryApprovalToken"])
    .index("by_assigned_to", ["assignedTo"]),

  deaccessionSearchDocuments: defineTable({
    organizationId: v.id("organizations"),
    deaccessionId: v.id("deaccessions"),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    searchText: v.string(),
    dateDeaccessioned: v.number(),
  })
    .index("by_deaccession", ["deaccessionId"])
    .index("by_organization", ["organizationId"])
    .searchIndex("search_text", {
      searchField: "searchText",
      filterFields: ["organizationId", "status"],
    }),

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
    isCurrentAppraisal: v.optional(v.boolean()), // Legacy manual marker; current valuation is derived (utils/valuation.ts)
    // Supersession: recorded values are immutable, corrections supersede.
    supersedes: v.optional(v.id("appraisals")),
    supersessionReason: v.optional(v.string()),
    supersededBy: v.optional(v.id("appraisals")),
    supersededAt: v.optional(v.number()),
    supersededByUserId: v.optional(v.id("users")),
    // Materialized "latest non-superseded for its purpose and currency".
    isCurrentValuation: v.optional(v.boolean()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_appraisalDate", [
      "organizationId",
      "appraisalDate",
    ])
    .index("by_collection", ["collectionId"])
    .index("by_collection_and_date", ["collectionId", "appraisalDate"]),

  // Hierarchical location structure
  locations: defineTable({
    organizationId: v.id("organizations"),
    siteId: v.optional(v.id("sites")),
    name: v.string(),
    locationCode: v.optional(v.string()),
    locationCodeNormalized: v.optional(v.string()),
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
    .index("by_organization_and_parent_and_locationCodeNormalized", [
      "organizationId",
      "parentLocationId",
      "locationCodeNormalized",
    ])
    .index("by_organization_and_type", ["organizationId", "type"])
    .searchIndex("search_locations", {
      searchField: "name",
      filterFields: ["organizationId", "type"],
    }),

  // Movement tracking
  locationHistory: defineTable({
    collectionId: v.id("collections"),
    fromLocationId: v.optional(v.id("locations")),
    toLocationId: v.optional(v.id("locations")),
    movedBy: v.id("users"),
    movedAt: v.number(),
    reason: v.optional(v.string()),
    notes: v.optional(v.string()),
    // Guarded movement evidence (MUS-628). Legacy rows omit these fields.
    movementKind: v.optional(movementKindValidator),
    authorizedBy: v.optional(v.id("users")),
    moveRequestId: v.optional(v.id("locationMoveRequests")),
    batchJobId: v.optional(v.id("batchJobs")),
    exhibitionObjectId: v.optional(v.id("exhibitionObjects")),
    transitItemId: v.optional(v.id("transitItems")),
  })
    .index("by_collection", ["collectionId"])
    .index("by_exhibition_object", ["exhibitionObjectId"])
    .index("by_transit_item", ["transitItemId"])
    .index("by_moveRequest", ["moveRequestId"])
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
      v.literal("conflict"), // Execution refused; awaiting re-review
    ),

    // Approval tracking
    requestedBy: v.id("users"),
    requestedAt: v.number(),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    reviewNotes: v.optional(v.string()),
    // Source observed when the request was (re-)approved; null means the
    // object had no recorded location. Execution refuses a different source.
    approvedFromLocationId: v.optional(v.union(v.id("locations"), v.null())),

    // Execution tracking
    executedBy: v.optional(v.id("users")),
    executedAt: v.optional(v.number()),
    executionNotes: v.optional(v.string()),
    movementId: v.optional(v.id("locationHistory")),
    // Append-only record of refused execution attempts
    conflicts: v.optional(v.array(moveRequestConflictValidator)),

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

  // Cross-organization move requests for objects
  organizationMoveRequests: defineTable({
    collectionId: v.id("collections"),
    sourceOrganizationId: v.id("organizations"),
    targetOrganizationId: v.id("organizations"),
    sourceAccessionNumber: v.string(),
    accessionMode: v.union(
      v.literal("keep"),
      v.literal("auto"),
      v.literal("manual"),
    ),
    requestedAccessionNumber: v.optional(v.string()),
    finalAccessionNumber: v.optional(v.string()),
    reason: v.string(),
    notes: v.optional(v.string()),
    status: v.union(
      v.literal("pending_source_approval"),
      v.literal("approved_for_transfer"),
      v.literal("awaiting_acceptance"),
      v.literal("pending"),
      v.literal("executed"),
      v.literal("rejected"),
      v.literal("cancelled"),
    ),
    requestedBy: v.id("users"),
    requestedAt: v.number(),
    sourceReviewedBy: v.optional(v.id("users")),
    sourceReviewedAt: v.optional(v.number()),
    sourceReviewNotes: v.optional(v.string()),
    targetReviewedBy: v.optional(v.id("users")),
    targetReviewedAt: v.optional(v.number()),
    targetReviewNotes: v.optional(v.string()),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    reviewNotes: v.optional(v.string()),
    executedBy: v.optional(v.id("users")),
    executedAt: v.optional(v.number()),
    deaccessionId: v.optional(v.id("deaccessions")),
    approvedSourceLocationId: v.optional(v.union(v.id("locations"), v.null())),
    acceptedTargetLocationId: v.optional(v.id("locations")),
    targetArrivalMovementId: v.optional(v.id("locationHistory")),
    transferScopeSnapshot: v.optional(
      v.object({
        sourceOrganizationId: v.id("organizations"),
        observedSourceLocationId: v.union(v.id("locations"), v.null()),
        legacyCollectionGroupId: v.optional(v.id("collectionGroups")),
        collectionGroupIds: v.array(v.id("collectionGroups")),
        accessionNumberAtTransfer: v.string(),
      }),
    ),
  })
    .index("by_source_organization", ["sourceOrganizationId"])
    .index("by_target_organization", ["targetOrganizationId"])
    .index("by_collection", ["collectionId"])
    .index("by_source_organization_and_status", [
      "sourceOrganizationId",
      "status",
    ])
    .index("by_target_organization_and_status", [
      "targetOrganizationId",
      "status",
    ]),

  organizationTransferCustodyEvents: defineTable({
    moveRequestId: v.id("organizationMoveRequests"),
    collectionId: v.id("collections"),
    organizationId: v.id("organizations"),
    phase: v.union(v.literal("source_departure"), v.literal("target_arrival")),
    observedLocationId: v.optional(v.id("locations")),
    actorId: v.id("users"),
    recordedAt: v.number(),
    notes: v.optional(v.string()),
  })
    .index("by_moveRequest", ["moveRequestId"])
    .index("by_collection", ["collectionId"]),

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

    // Account holder classification - distinguishes organizations from people
    holderType: v.optional(
      v.union(v.literal("organization"), v.literal("privatePerson")),
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

  // Platform-wide organization account number counter (ORG-XXXXX)
  organizationRegistryCounter: defineTable({
    scopeKey: v.literal("global"),
    currentValue: v.number(),
    lastGeneratedAt: v.number(),
  }).index("by_scopeKey", ["scopeKey"]),

  customerNumberCounter: defineTable({
    scopeKey: v.literal("global"),
    currentValue: v.number(),
  }).index("by_scopeKey", ["scopeKey"]),

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
    // ISO 4217 code of insuranceValue (MUS-674); absent on older loans.
    currency: v.optional(v.string()),
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
    .index("by_organization_and_loanNumber", ["organizationId", "loanNumber"])
    .index("by_status", ["status"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_organization_and_startDate", ["organizationId", "startDate"])
    .index("by_type", ["type"])
    .index("by_organization_and_type", ["organizationId", "type"])
    .index("by_account", ["accountId"])
    .index("by_organization_and_endDate", ["organizationId", "endDate"])
    .index("by_organization_and_status_and_endDate", [
      "organizationId",
      "status",
      "endDate",
    ])
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
    custodyStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("dispatched"),
        v.literal("returned"),
      ),
    ),
    dispatchOriginLocationId: v.optional(v.id("locations")),
    dispatchOriginUnknown: v.optional(v.boolean()),
    dispatchedAt: v.optional(v.number()),
    dispatchedBy: v.optional(v.id("users")),
    returnDestinationLocationId: v.optional(v.id("locations")),
    returnedAt: v.optional(v.number()),
    returnedBy: v.optional(v.id("users")),
    outgoingConditionAssessmentId: v.optional(v.id("conditionAssessments")),
    incomingConditionAssessmentId: v.optional(v.id("conditionAssessments")),
    lenderExitId: v.optional(v.id("loanCustodyExits")),
  })
    .index("by_loan", ["loanId"])
    .index("by_collection", ["collectionId"]),

  // Incoming loan return-to-lender exits (not deaccessions)
  loanCustodyExits: defineTable({
    organizationId: v.id("organizations"),
    loanId: v.id("loans"),
    loanItemId: v.id("loanItems"),
    collectionId: v.id("collections"),
    exitType: v.literal("return_to_lender"),
    recipientName: v.string(),
    accountId: v.optional(v.id("accounts")),
    recordedBy: v.id("users"),
    recordedAt: v.number(),
    fromLocationId: v.optional(v.id("locations")),
    notes: v.optional(v.string()),
    legacySyntheticDeaccessionId: v.optional(v.id("deaccessions")),
  })
    .index("by_loan", ["loanId"])
    .index("by_collection", ["collectionId"])
    .index("by_loanItem", ["loanItemId"]),

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

  conditionAssessments: defineTable({
    organizationId: v.id("organizations"),
    collectionId: v.id("collections"),
    assessedBy: v.id("users"),
    assessedAt: v.number(),
    recordedAt: v.number(),
    condition: v.string(),
    summary: v.string(),
    observations: v.array(
      v.object({
        area: v.string(),
        description: v.string(),
        severity: v.union(
          v.literal("minor"),
          v.literal("moderate"),
          v.literal("severe"),
        ),
      }),
    ),
    photos: v.array(
      v.object({
        mediaId: v.id("mediaFiles"),
        storageId: v.id("_storage"),
        fileName: v.string(),
      }),
    ),
    status: v.union(v.literal("draft"), v.literal("accepted")),
    acceptedBy: v.optional(v.id("users")),
    acceptedAt: v.optional(v.number()),
  })
    .index("by_collection", ["collectionId"])
    .index("by_organization", ["organizationId"])
    .index("by_collection_and_status_and_acceptedAt", [
      "collectionId",
      "status",
      "acceptedAt",
    ]),

  // Administrator-managed loan agreement templates (MUS-674). Archived, never deleted.
  loanAgreementTemplates: defineTable(loanAgreementTemplateFields)
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_organization_and_loanType_and_isDefault", [
      "organizationId",
      "loanType",
      "isDefault",
    ]),

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
    baselineAssessmentId: v.optional(v.id("conditionAssessments")),
    outcomeAssessmentId: v.optional(v.id("conditionAssessments")),
    followUpStatus: v.optional(
      v.union(v.literal("none"), v.literal("pending"), v.literal("completed")),
    ),
    followUpNotes: v.optional(v.string()),
    followUpDueAt: v.optional(v.number()),
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
    observedAt: v.optional(v.number()),
    receivedAt: v.optional(v.number()),
    sensorDeviceId: v.optional(v.id("environmentalDevices")),
    sensorProbeId: v.optional(v.string()),
    externalReadingId: v.optional(v.string()),
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
    .index("by_location_and_time", ["locationId", "recordedAt"])
    .index("by_sensor_device_and_probe_and_external_reading", [
      "sensorDeviceId",
      "sensorProbeId",
      "externalReadingId",
    ]),

  environmentalDevices: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    credentialPrefix: v.string(),
    credentialHash: v.string(),
    status: v.union(v.literal("active"), v.literal("revoked")),
    createdBy: v.id("users"),
    createdAt: v.number(),
    lastSeenAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    lastErrorAt: v.optional(v.number()),
    rotatedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_credential_prefix", ["credentialPrefix"]),

  environmentalProbes: defineTable({
    organizationId: v.id("organizations"),
    deviceId: v.id("environmentalDevices"),
    probeId: v.string(),
    locationId: v.id("locations"),
    isActive: v.boolean(),
    boundBy: v.id("users"),
    boundAt: v.number(),
  })
    .index("by_device_and_probe", ["deviceId", "probeId"])
    .index("by_organization_and_device", ["organizationId", "deviceId"])
    .index("by_location", ["locationId"]),

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
    collectionId: v.optional(v.id("collections")), // Historical anchor; new writes use exhibitionObjects
    participationVersion: v.optional(v.literal("members")),
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
    role: v.optional(v.union(v.literal("featured"), v.literal("participant"))),
    order: v.optional(v.number()),
    originalLocationId: v.optional(v.id("locations")), // Where the object was before
    exhibitionLocationId: v.optional(v.id("locations")), // Where it is in the exhibition
    // Installation tracking
    installedAt: v.optional(v.number()),
    installedBy: v.optional(v.id("users")),
    installationNotes: v.optional(v.string()),
    conditionAtInstallation: v.optional(v.string()),
    installationMovementId: v.optional(v.id("locationHistory")),
    installationConditionAssessmentId: v.optional(v.id("conditionAssessments")),
    // Deinstallation tracking
    deinstalledAt: v.optional(v.number()),
    deinstalledBy: v.optional(v.id("users")),
    deinstallationNotes: v.optional(v.string()),
    conditionAtDeinstallation: v.optional(v.string()),
    deinstallationConditionAssessmentId: v.optional(
      v.id("conditionAssessments"),
    ),
    returnedToOriginalLocation: v.optional(v.boolean()),
    returnedAt: v.optional(v.number()),
    returnMovementId: v.optional(v.id("locationHistory")),
    returnConditionAssessmentId: v.optional(v.id("conditionAssessments")),
    returnException: v.optional(
      v.object({
        reason: v.string(),
        authorizedBy: v.id("users"),
        authorizedAt: v.number(),
      }),
    ),
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

  caseHistoryState: defineTable({
    organizationId: v.id("organizations"),
    caseType: v.string(),
    entityId: v.string(),
    sourceLength: v.number(),
    // Retired legacy-copy progress; kept optional so existing rows validate.
    migratedThrough: v.optional(v.number()),
    nextOrdinal: v.number(),
    cutoverAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_caseType_and_entityId", [
      "organizationId",
      "caseType",
      "entityId",
    ]),
  caseHistoryEntries: defineTable({
    organizationId: v.id("organizations"),
    caseType: v.string(),
    entityId: v.string(),
    ordinal: v.number(),
    entry: v.object({
      step: v.number(),
      approvedBy: v.id("users"),
      approvedAt: v.number(),
      comment: v.optional(v.string()),
      approverName: v.optional(v.string()),
    }),
    evidenceStatus: v.union(v.literal("recorded"), v.literal("legacy")),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_caseType_and_entityId_and_ordinal", [
      "organizationId",
      "caseType",
      "entityId",
      "ordinal",
    ]),

  // Activity tracking
  auditLog: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    actorSnapshot: v.optional(
      v.object({ name: v.optional(v.string()), email: v.optional(v.string()) }),
    ),
    subjectSnapshot: v.optional(
      v.object({
        label: v.optional(v.string()),
        identifier: v.optional(v.string()),
      }),
    ),
    objectId: v.optional(v.id("collections")),
    caseId: v.optional(v.string()),
    correctionOf: v.optional(v.id("auditLog")),
    correctionReason: v.optional(v.string()),
    requestId: v.optional(v.string()),
    changes: v.optional(auditLogChanges),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_timestamp", ["organizationId", "timestamp"])
    .index("by_organization_and_requestId", ["organizationId", "requestId"])
    .index("by_organization_and_userId_and_timestamp", [
      "organizationId",
      "userId",
      "timestamp",
    ])
    .index("by_organization_and_entityType_and_timestamp", [
      "organizationId",
      "entityType",
      "timestamp",
    ])
    .index("by_organization_and_entityType_and_entityId_and_timestamp", [
      "organizationId",
      "entityType",
      "entityId",
      "timestamp",
    ])
    .index("by_organization_and_action_and_timestamp", [
      "organizationId",
      "action",
      "timestamp",
    ])
    .index("by_organization_and_objectId_and_timestamp", [
      "organizationId",
      "objectId",
      "timestamp",
    ])
    .index("by_organization_and_caseId_and_timestamp", [
      "organizationId",
      "caseId",
      "timestamp",
    ])
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
    .index("by_user_and_organization", ["userId", "organizationId"])
    .index("by_user_and_organization_and_createdAt", [
      "userId",
      "organizationId",
      "createdAt",
    ])
    .index("by_user_and_organization_and_read", [
      "userId",
      "organizationId",
      "read",
    ]),

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
    clearedAt: v.optional(v.number()),
  })
    .index("by_entity_and_step", ["workflowType", "entityId", "stepNumber"])
    .index("by_user", ["approvedBy"])
    .index("by_organization", ["organizationId"])
    .index("by_entity_and_step_and_clearedAt_and_approvedBy", [
      "workflowType",
      "entityId",
      "stepNumber",
      "clearedAt",
      "approvedBy",
    ]),

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

  // Outgoing webhook events captured at emit time, one delivery per endpoint
  webhookEvents: defineTable(webhookEventFields).index("by_organizationId", [
    "organizationId",
  ]),
  webhookDeliveries: defineTable(webhookDeliveryFields)
    .index("by_organizationId", ["organizationId"])
    .index("by_organizationId_and_status", ["organizationId", "status"])
    .index("by_organizationId_and_webhookId", ["organizationId", "webhookId"])
    .index("by_organizationId_and_webhookId_and_status", [
      "organizationId",
      "webhookId",
      "status",
    ])
    .index("by_eventId", ["eventId"])
    .index("by_status_and_nextAttemptAt", ["status", "nextAttemptAt"]),
  webhookDeliveryAttempts: defineTable(webhookDeliveryAttemptFields)
    .index("by_organizationId", ["organizationId"])
    .index("by_deliveryId_and_attemptNumber", ["deliveryId", "attemptNumber"]),

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
      v.literal("completed_with_errors"),
      v.literal("cancelled"),
      v.literal("failed"),
    ),
    progress: v.number(),
    totalItems: v.number(),
    // Accepted rows. Kept for clients that predate attempted/failed counts.
    processedItems: v.number(),
    errors: v.optional(v.array(v.string())),
    createdBy: v.id("users"),
    createdAt: v.number(),
    // Row-tracked imports (absent on legacy jobs)
    entityType: v.optional(
      v.union(
        v.literal("objects"),
        v.literal("accessions"),
        v.literal("locations"),
        v.literal("accounts"),
        v.literal("loans"),
      ),
    ),
    attemptedItems: v.optional(v.number()),
    acceptedItems: v.optional(v.number()),
    failedItems: v.optional(v.number()),
    sourceName: v.optional(v.string()),
    sourceFingerprint: v.optional(v.string()),
    updatedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_status", ["status"])
    .index("by_organization_and_sourceFingerprint", [
      "organizationId",
      "sourceFingerprint",
    ]),

  // One durable outcome per import job and source row; replays return it.
  importRowResults: defineTable({
    organizationId: v.id("organizations"),
    jobId: v.id("importJobs"),
    rowNumber: v.number(),
    status: v.union(v.literal("accepted"), v.literal("failed")),
    recordId: v.optional(v.string()),
    identifier: v.optional(v.string()),
    errors: v.array(v.string()),
    attempts: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_job_and_rowNumber", ["jobId", "rowNumber"])
    .index("by_job_and_status_and_rowNumber", ["jobId", "status", "rowNumber"]),

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
    // Manual jobs created before MUS-622 have no row here.
    mappingType: v.union(
      v.literal("csv"),
      v.literal("filename"),
      v.literal("manual"),
    ),
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
        // Source position on the job; matches importRowResults.rowNumber.
        itemNumber: v.optional(v.number()),
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
    currency: v.optional(v.string()), // ISO 4217; required for new policies
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
    ])
    .index("by_status_and_expirationDate", ["status", "expirationDate"])
    .index("by_status_and_effectiveDate", ["status", "effectiveDate"]),

  // Insurance Policy Coverages - Links policies to objects/exhibitions/loans
  insuranceCoverages: defineTable({
    organizationId: v.id("organizations"),
    policyId: v.id("insurancePolicies"),

    // What is covered: exactly one target, named by targetType. Legacy rows
    // without targetType and with several targets await reviewed resolution.
    targetType: v.optional(
      v.union(v.literal("object"), v.literal("loan"), v.literal("exhibition")),
    ),
    collectionId: v.optional(v.id("collections")), // Individual object
    exhibitionId: v.optional(v.id("exhibitions")), // Exhibition
    loanId: v.optional(v.id("loans")), // Loan
    splitFromCoverageId: v.optional(v.id("insuranceCoverages")),

    // Coverage details
    coveredValue: v.number(), // Insured value for this item
    currency: v.optional(v.string()), // ISO 4217; required for new coverages
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
    .index("by_appraisal", ["appraisalId"])
    .index("by_status_and_expirationDate", ["status", "expirationDate"]),

  // Legacy coverages naming several targets, held for a reviewed resolution.
  legacyCoverageReviews: defineTable({
    organizationId: v.id("organizations"),
    coverageId: v.id("insuranceCoverages"),
    policyId: v.id("insurancePolicies"),
    status: v.union(v.literal("open"), v.literal("resolved")),
    // Targets and value as recorded when the review was opened.
    collectionId: v.optional(v.id("collections")),
    loanId: v.optional(v.id("loans")),
    exhibitionId: v.optional(v.id("exhibitions")),
    coveredValue: v.number(),
    detectedAt: v.number(),
    resolution: v.optional(
      v.object({
        keptTarget: v.union(
          v.literal("object"),
          v.literal("loan"),
          v.literal("exhibition"),
        ),
        createdCoverageIds: v.array(v.id("insuranceCoverages")),
        note: v.optional(v.string()),
        resolvedBy: v.id("users"),
        resolvedAt: v.number(),
      }),
    ),
  })
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_coverage", ["coverageId"]),

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
    currency: v.optional(v.string()), // ISO 4217; required for new claims
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
      v.literal("delivered"), // Legacy carrier flag; prefer arrived
      v.literal("arrived"), // Carrier delivery recorded, not yet accepted
      v.literal("received"), // Accountable receipt recorded
      v.literal("damaged"), // Damaged during transit
      v.literal("missing"), // Missing/lost
    ),

    carrierArrivedAt: v.optional(v.number()),
    carrierArrivedBy: v.optional(v.id("users")),
    receiptMovementId: v.optional(v.id("locationHistory")),
    receiptDestinationLocationId: v.optional(v.id("locations")),
    receiptConditionAssessmentId: v.optional(v.id("conditionAssessments")),
    receivedAt: v.optional(v.number()),
    receivedBy: v.optional(v.id("users")),
    installationMovementId: v.optional(v.id("locationHistory")),
    installedAt: v.optional(v.number()),
    installedBy: v.optional(v.id("users")),
    installationTaskId: v.optional(v.id("installationTasks")),
    linkedExhibitionObjectId: v.optional(v.id("exhibitionObjects")),

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

  // Case tasks - accountable work linked to one case (MUS-656). Completing a
  // task never records custody, approval or condition on the case.
  caseTasks: defineTable({
    organizationId: v.id("organizations"),
    caseType: caseTaskCaseTypeValidator,
    caseId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    ownerId: v.id("users"),
    reviewerId: v.optional(v.id("users")),
    dueDate: v.optional(v.number()),
    /** Due date, or MAX_SAFE_INTEGER when undated, so queues sort by due. */
    queueDueAt: v.number(),
    status: caseTaskStatusValidator,
    open: v.boolean(),
    dependsOnTaskIds: v.array(v.id("caseTasks")),
    blockedReason: v.optional(v.string()),
    reviewNote: v.optional(v.string()),
    completionNote: v.optional(v.string()),
    cancelReason: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    submittedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    completedBy: v.optional(v.id("users")),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_caseType_and_caseId", [
      "organizationId",
      "caseType",
      "caseId",
    ])
    .index("by_organization_and_ownerId_and_open_and_queueDueAt", [
      "organizationId",
      "ownerId",
      "open",
      "queueDueAt",
    ])
    .index("by_organization_and_reviewerId_and_status_and_queueDueAt", [
      "organizationId",
      "reviewerId",
      "status",
      "queueDueAt",
    ]),

  // Evidence links cite existing records for a case task; append-only.
  caseTaskEvidence: defineTable({
    organizationId: v.id("organizations"),
    taskId: v.id("caseTasks"),
    reference: caseTaskEvidenceReferenceValidator,
    /** Label captured when linked, so the citation survives later edits. */
    label: v.string(),
    objectId: v.optional(v.id("collections")),
    /** When the cited record was made (assessment, move, upload, event). */
    recordedAt: v.optional(v.number()),
    /** Case of a cited audit entry, for opening its case history. */
    auditCaseId: v.optional(v.string()),
    linkedBy: v.id("users"),
    linkedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_taskId", ["taskId"]),

  organizationSubscriptions: defineTable({
    organizationId: v.id("organizations"),
    tier: v.union(v.literal("pro"), v.literal("enterprise")),
    productId: v.string(),
    productName: v.optional(v.string()),
    productDescription: v.optional(v.union(v.string(), v.null())),
    subscriptionId: v.string(),
    customerId: v.string(),
    recurringInterval: v.optional(
      v.union(v.literal("month"), v.literal("year")),
    ),
    status: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("past_due"),
      v.literal("unpaid"),
      v.literal("incomplete"),
    ),
    cancelAtPeriodEnd: v.boolean(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.optional(v.number()),
    isEntitled: v.optional(v.boolean()),
    metadata: v.optional(metadataRecord),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_subscription", ["subscriptionId"])
    .index("by_status", ["status"]),

  polarWebhookEvents: defineTable({
    webhookId: v.string(),
    eventType: v.string(),
    processedAt: v.number(),
  }).index("by_webhook_id", ["webhookId"]),

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

  // Typed Party roles in procedures (MUS-642). The account is the Party;
  // links are superseded, never deleted (ADR 0002).
  partyLinks: defineTable(partyLinkDocumentValidator)
    .index("by_organization_and_target_and_role_and_supersededAt", [
      "organizationId",
      "targetType",
      "targetId",
      "role",
      "supersededAt",
    ])
    .index("by_account", ["accountId"]),

  // Suggested duplicate Parties awaiting staff review. Never merged.
  partyDuplicateReviews: defineTable(partyDuplicateReviewDocumentValidator)
    .index("by_organization_and_pairKey", ["organizationId", "pairKey"])
    .index("by_organization_and_status", ["organizationId", "status"]),

  // Provenance claims (MUS-643): immutable assertions about an Object's
  // holders. Corrections supersede; contradictory claims stay for review
  // (ADR 0006).
  provenanceClaims: defineTable(provenanceClaimDocumentValidator)
    .index("by_organization_and_objectId_and_supersededAt", [
      "organizationId",
      "objectId",
      "supersededAt",
    ])
    .index("by_organization_and_reviewStatus_and_supersededAt", [
      "organizationId",
      "reviewStatus",
      "supersededAt",
    ]),

  // Sources cited for provenance claims; retracted, never deleted.
  provenanceEvidence: defineTable(provenanceEvidenceDocumentValidator)
    .index("by_organization_and_objectId", ["organizationId", "objectId"])
    .index("by_organization_and_claimId", ["organizationId", "claimId"]),

  // Every review decision on a provenance claim, appended in order.
  provenanceReviews: defineTable(provenanceReviewDocumentValidator)
    .index("by_organization_and_objectId", ["organizationId", "objectId"])
    .index("by_organization_and_claimId", ["organizationId", "claimId"]),

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
            siteIds: v.optional(v.array(v.id("sites"))),
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
    scheduleRevision: v.optional(v.number()),

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
    scheduledFor: v.optional(v.number()),
    scheduleRevision: v.optional(v.number()),
    attemptCount: v.optional(v.number()),
    lastAttemptAt: v.optional(v.number()),
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
    artifact: v.optional(
      v.object({
        schemaVersion: v.literal(1),
        format: v.literal("json"),
        content: v.string(),
        generatedAt: v.number(),
        storedAt: v.number(),
      }),
    ),
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
    .index("by_scheduledReportId_and_scheduleRevision_and_scheduledFor", [
      "scheduledReportId",
      "scheduleRevision",
      "scheduledFor",
    ])
    .index("by_status", ["organizationId", "status"]),

  // ============================================
  // Batch Operations
  // ============================================

  exportJobs: defineTable({
    organizationId: v.id("organizations"),
    creatorId: v.id("users"),
    requestKey: v.string(),
    source: exportSource,
    format: exportFormat,
    schemaVersion: v.literal(1),
    asOf: v.number(),
    captureStartedAt: v.number(),
    captureCompletedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    status: exportStatus,
    cursor: v.union(v.string(), v.null()),
    checkpoint: v.number(),
    chunksCommitted: v.number(),
    finalizeLevel: v.number(),
    finalizeAfter: v.number(),
    finalizeInputCount: v.number(),
    finalizeProduced: v.number(),
    cleanupPartsCursor: v.optional(v.string()),
    cleanupSequence: v.optional(v.number()),
    rows: v.number(),
    scanned: v.number(),
    selected: v.number(),
    selectedCount: v.optional(v.number()),
    bytes: v.number(),
    attempts: v.number(),
    failedAttempts: v.number(),
    generation: v.number(),
    leaseUntil: v.optional(v.number()),
    sourceDone: v.boolean(),
    error: v.optional(v.string()),
    expiresAt: v.number(),
    storageId: v.optional(v.id("_storage")),
    sha256: v.optional(v.string()),
  })
    .index("by_creatorId_and_requestKey", ["creatorId", "requestKey"])
    .index("by_organizationId_and_creatorId", ["organizationId", "creatorId"])
    .index("by_organizationId", ["organizationId"]),
  exportSelections: defineTable({
    jobId: v.id("exportJobs"),
    objectId: v.id("collections"),
  })
    .index("by_jobId", ["jobId"])
    .index("by_jobId_and_objectId", ["jobId", "objectId"]),
  exportChunks: defineTable({
    jobId: v.id("exportJobs"),
    sequence: v.number(),
    storageId: v.optional(v.id("_storage")),
    rows: v.number(),
    bytes: v.number(),
    sha256: v.string(),
    capturedAt: v.number(),
  }).index("by_jobId_and_sequence", ["jobId", "sequence"]),

  exportParts: defineTable({
    jobId: v.id("exportJobs"),
    level: v.number(),
    sequence: v.number(),
    storageId: v.optional(v.id("_storage")),
    rows: v.number(),
    bytes: v.number(),
    sha256: v.string(),
    leafChunks: v.number(),
  }).index("by_jobId_and_level_and_sequence", ["jobId", "level", "sequence"]),

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

  marketingInquiries: defineTable({
    name: v.string(),
    institution: v.string(),
    email: v.string(),
    collectionSize: v.optional(v.string()),
    message: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_email", ["email"]),
});
