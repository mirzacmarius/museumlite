import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalQuery,
  type MutationCtx,
  type QueryCtx,
  query,
} from "./_generated/server";
import { createDeaccessionRecord } from "./deaccessions";
import schema, { customFieldValue } from "./schema";
import { batchGetByIds, createLookupMap } from "./utils/batchLookup";
import { capabilityUnavailableFromError } from "./utils/capabilities";
import {
  catalogFilterFields,
  catalogSortValidator,
  objectSearchFieldValidator,
} from "./utils/catalogFilterValidators";
import { listCatalogPage } from "./utils/catalogListing";
import {
  buildConditionHistoryEntry,
  getCollectionGroupMembershipIds,
  syncCollectionGroupMemberships,
} from "./utils/catalogObjects";
import {
  getDisplayedMediaFiles,
  getDisplayedMediaThumbnailUrl,
  getLocationPathStrings,
  isImageMedia,
} from "./utils/collectionDisplayHelpers";
import {
  archiveCollectionHandler,
  restoreCollectionHandler,
} from "./utils/collectionDisposition";
import {
  getCollectionsWithOpenDeaccessions,
  toCollectionListPaginationResult,
} from "./utils/collectionListHelpers";
import { syncCollectionOptionUsages } from "./utils/collectionOptionUsages";
import {
  enforceObjectQuota,
  hasModuleEnabled,
  requireCollectionTypeModuleEnabled,
} from "./utils/featureGates";
import {
  ensureIdentifierAvailable,
  generateConfiguredIdentifier,
} from "./utils/identifiers";
import { collectionHasOccupyingLoan } from "./utils/loanOccupancy";
import {
  moveCollectionToLocation,
  requireUsableLocation,
} from "./utils/locationIntegrity";
import { collectionTypeValidator } from "./utils/moduleValidators";
import { DEFAULT_MOVEMENT_REASONS } from "./utils/movementReasons";
import { mutation } from "./utils/mutationBuilders";
import {
  completenessValidator,
  measuredPartValidator,
  measurementSetValidator,
} from "./utils/objectDescription";
import { searchObjects } from "./utils/objectSearch";
import {
  getObjectTypeDetails,
  objectTypeDetailsValidator,
} from "./utils/objectTypeDetails";
import { applyUsageCounterDelta } from "./utils/organizationUsageCounters";
import { requirePermission } from "./utils/permissions";
import { getPortalImage } from "./utils/publicMedia";
import { findPublicPortalOrganization } from "./utils/publicPortal";
import { canReadRecord } from "./utils/recordAccess";
import {
  assertCurrentEditVersion,
  enteredCompletenessNote,
  enteredMeasurementSets,
  enteredNumberOfObjects,
  enteredProductionDate,
  enteredRightsStatement,
  enteredSubjects,
  objectEditVersion,
  recordEditError,
  requireFieldValue,
} from "./utils/recordEdits";
import {
  rightsStatementInEffect,
  rightsStatementValidator,
} from "./utils/rightsStatements";
import { emitWebhookEvent } from "./utils/webhookEvents";
import { workflowApprovalErrorFromError } from "./utils/workflowApprovalErrors";

const PUBLIC_CATALOG_STATUSES = ["active", "loaned"] as const;

async function validateCollectionReferences(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  references: {
    parentObjectId?: Id<"collections">;
    currentLocationId?: Id<"locations">;
  },
) {
  if (references.parentObjectId) {
    const parent = await ctx.db.get(references.parentObjectId);
    if (!parent || parent.organizationId !== organizationId) {
      throw recordEditError(
        "RELATED_RECORD_UNAVAILABLE",
        "Parent object not found in this organization",
        { field: "parentObjectId" },
      );
    }
  }
  if (references.currentLocationId) {
    await requireUsableLocation(
      ctx,
      organizationId,
      references.currentLocationId,
    );
  }
}

function isPublicCatalogStatus(status: Doc<"collections">["status"]) {
  return status === "active" || status === "loaned";
}

// Object reads return the whole stored object, so the validator follows the
// schema: a field added to objects cannot make every object page fail.
const objectDetailCollectionValidator = v.object({
  ...schema.tables.collections.validator.fields,
  _id: v.id("collections"),
  _creationTime: v.number(),
  verifiedByName: v.optional(v.string()),
});

const objectDetailMediaValidator = v.object({
  _id: v.id("mediaFiles"),
  url: v.union(v.string(), v.null()),
  thumbnailUrl: v.union(v.string(), v.null()),
  fileName: v.string(),
  fileType: v.string(),
  caption: v.optional(v.string()),
  isPrimary: v.boolean(),
});

const objectDetailLocationPathItemValidator = v.object({
  _id: v.id("locations"),
  name: v.string(),
  locationCode: v.string(),
});

/**
 * Generate accession number based on organization format template
 */
async function generateAccessionNumber(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
) {
  return generateConfiguredIdentifier(ctx, organizationId, "catalog");
}

async function getObjectDetailHeroImage(
  ctx: QueryCtx,
  collectionId: Id<"collections">,
) {
  const mediaFiles = await ctx.db
    .query("mediaFiles")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();

  const imageMedia = mediaFiles.filter((media) => isImageMedia(media));
  const preferredMedia =
    imageMedia.find((media) => media.isPrimary) ?? imageMedia[0];

  if (!preferredMedia) {
    return null;
  }

  const shown = await getDisplayedMediaFiles(ctx, preferredMedia);
  const [url, thumbnailUrl] = await Promise.all([
    ctx.storage.getUrl(shown.storageId),
    shown.thumbnailStorageId
      ? ctx.storage.getUrl(shown.thumbnailStorageId)
      : Promise.resolve(null),
  ] as const);

  return {
    _id: preferredMedia._id,
    url,
    thumbnailUrl,
    fileName: preferredMedia.fileName,
    fileType: preferredMedia.fileType,
    caption: preferredMedia.caption,
    isPrimary: preferredMedia.isPrimary,
  };
}

async function getObjectDetailLocationPath(
  ctx: QueryCtx,
  locationId: Id<"locations">,
) {
  const path: Array<{
    _id: Id<"locations">;
    name: string;
    locationCode: string;
  }> = [];
  let currentId: Id<"locations"> | undefined = locationId;

  while (currentId) {
    const location: Doc<"locations"> | null = await ctx.db.get(currentId);
    if (!location) {
      break;
    }

    path.unshift({
      _id: location._id,
      name: location.name,
      locationCode:
        location.locationCode ??
        `LEGACY-${location._id.slice(-6).toUpperCase()}`,
    });
    currentId = location.parentLocationId;
  }

  return path;
}

async function _getLocationPathString(
  ctx: QueryCtx,
  locationId: Id<"locations">,
) {
  const pathSegments: string[] = [];
  let currentId: Id<"locations"> | undefined = locationId;

  while (currentId) {
    const location: Doc<"locations"> | null = await ctx.db.get(currentId);
    if (!location) {
      break;
    }

    pathSegments.unshift(location.name);
    currentId = location.parentLocationId;
  }

  return pathSegments.length > 0 ? pathSegments.join(" > ") : undefined;
}

function normalizeOptionalString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

async function getPublicCatalogCollections(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
) {
  const collectionsByStatus = await Promise.all(
    PUBLIC_CATALOG_STATUSES.map((status) =>
      ctx.db
        .query("collections")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", organizationId).eq("status", status),
        )
        .collect(),
    ),
  );

  return collectionsByStatus
    .flat()
    .filter((collection) => collection.isPubliclyVisible === true);
}

function isLibraryCatalogPubliclyVisible(organization: Doc<"organizations">) {
  return (
    organization.type === "library" ||
    organization.settings?.enabledModules?.includes("library") === true ||
    organization.settings?.enabledIntegrations?.includes("library") === true
  );
}

async function getPublicLibraryCatalogItems(
  ctx: QueryCtx,
  organization: Doc<"organizations">,
) {
  if (!isLibraryCatalogPubliclyVisible(organization)) {
    return [];
  }

  return await ctx.db
    .query("libraryItems")
    .withIndex("by_organization_and_status", (q) =>
      q.eq("organizationId", organization._id).eq("catalogStatus", "published"),
    )
    .collect();
}

export const listForApi = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      id: v.id("collections"),
      title: v.string(),
      status: v.string(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const maxItems = Math.min(args.limit ?? 50, 50);
    const collections = await ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .take(maxItems);

    return collections.map((collection) => ({
      id: collection._id,
      title: collection.title,
      status: collection.status,
      createdAt: collection.catalogedAt,
    }));
  },
});

/**
 * Create new collection object
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    collectionGroupId: v.optional(v.id("collectionGroups")),
    collectionGroupIds: v.optional(v.array(v.id("collectionGroups"))),
    accessionNumber: v.optional(v.string()),
    title: v.string(),
    alternativeTitle: v.optional(v.string()),
    creator: v.optional(v.string()),
    objectType: v.optional(v.string()),
    objectName: v.optional(v.string()),
    /** A whole number from 1; refused otherwise. */
    numberOfObjects: v.optional(v.number()),
    culture: v.optional(v.string()),
    period: v.optional(v.string()),
    dateCreated: v.optional(v.string()),
    /** EDTF; stored canonical, refused when it is not EDTF. */
    dateCreatedEdtf: v.optional(v.string()),
    materials: v.optional(v.string()),
    technique: v.optional(v.string()),
    dimensions: v.optional(v.string()),
    dimensionDiameter: v.optional(v.string()),
    dimensionHeight: v.optional(v.number()),
    dimensionWidth: v.optional(v.number()),
    dimensionDepth: v.optional(v.number()),
    dimensionWeight: v.optional(v.number()),
    dimensionUnit: v.optional(v.string()),
    weightUnit: v.optional(v.string()),
    dimensionMeasuredPart: v.optional(measuredPartValidator),
    measurementSets: v.optional(v.array(measurementSetValidator)),
    description: v.optional(v.string()),
    condition: v.optional(v.string()),
    completeness: v.optional(completenessValidator),
    completenessNote: v.optional(v.string()),
    inscriptions: v.optional(v.string()),
    inscriptionMarks: v.optional(
      v.array(
        v.object({
          label: v.string(),
          description: v.string(),
        }),
      ),
    ),
    tags: v.optional(v.array(v.string())),
    /** Trimmed, repeats dropped; refused when too long or too many. */
    subjects: v.optional(v.array(v.string())),
    provenance: v.optional(v.string()),
    exhibitionHistory: v.optional(v.string()),
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
    donated_by: v.optional(v.array(v.string())),
    donated_date: v.optional(v.string()),
    donation_info: v.optional(v.string()),
    creditLine: v.optional(v.string()),
    /** Absent: the Organization's default applies when read. */
    rightsStatement: v.optional(rightsStatementValidator),
    previous_owners: v.optional(v.array(v.string())),
    links: v.optional(
      v.array(
        v.object({
          url: v.string(),
          label: v.optional(v.string()),
        }),
      ),
    ),
    parentObjectId: v.optional(v.id("collections")),
    currentLocationId: v.optional(v.id("locations")),
    alternateAccessionNumbers: v.optional(v.array(v.string())),
    acquisitionMethod: v.optional(v.string()),
    legalRestrictions: v.optional(v.boolean()),
    isPubliclyVisible: v.optional(v.boolean()),
    isHighResDownloadable: v.optional(v.boolean()),
    isSearchable: v.optional(v.boolean()),
    isValuationVisible: v.optional(v.boolean()),
    publicSlug: v.optional(v.string()),
    displayStatus: v.optional(v.string()),
    collectionType: v.optional(collectionTypeValidator),
  },
  returns: v.id("collections"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    await Promise.all([
      requirePermission(ctx, args.organizationId, "collections.create"),
      requireCollectionTypeModuleEnabled(
        ctx,
        args.organizationId,
        args.collectionType,
      ),
      enforceObjectQuota(ctx, args.organizationId),
    ] as const);
    await validateCollectionReferences(ctx, args.organizationId, args);
    const dateCreatedEdtf = enteredProductionDate(args.dateCreatedEdtf);
    const described = {
      numberOfObjects: enteredNumberOfObjects(args.numberOfObjects),
      subjects: enteredSubjects(args.subjects),
      completenessNote: enteredCompletenessNote(args.completenessNote),
      measurementSets: enteredMeasurementSets(args.measurementSets),
      rightsStatement: enteredRightsStatement(args.rightsStatement),
    };
    if (args.collectionGroupId) {
      const group = await ctx.db.get(args.collectionGroupId);
      if (!group || group.organizationId !== args.organizationId)
        throw new Error("Collection group not found in this organization");
    }

    // Generate or validate accession number
    let accessionNumber: string;
    if (args.accessionNumber) {
      accessionNumber = args.accessionNumber;
    } else {
      accessionNumber = await generateAccessionNumber(ctx, args.organizationId);
    }

    const normalizedIdentifier = await ensureIdentifierAvailable(
      ctx,
      args.organizationId,
      "catalog",
      accessionNumber,
    );

    const normalizedCondition = normalizeOptionalString(args.condition);
    const conditionHistory = normalizedCondition
      ? [
          await buildConditionHistoryEntry(
            ctx,
            userId,
            normalizedCondition,
            undefined,
          ),
        ]
      : undefined;

    const primaryGroupId =
      args.collectionGroupId ?? args.collectionGroupIds?.[0];

    // Create collection object
    const collectionId = await ctx.db.insert("collections", {
      organizationId: args.organizationId,
      collectionGroupId: primaryGroupId,
      accessionNumber,
      normalizedIdentifier,
      title: args.title,
      alternativeTitle: args.alternativeTitle,
      creator: args.creator,
      objectType: args.objectType,
      objectName: args.objectName,
      numberOfObjects: described.numberOfObjects,
      culture: args.culture,
      period: args.period,
      dateCreated: args.dateCreated,
      dateCreatedEdtf,
      materials: args.materials,
      technique: args.technique,
      dimensions: args.dimensions,
      dimensionDiameter: args.dimensionDiameter,
      dimensionHeight: args.dimensionHeight,
      dimensionWidth: args.dimensionWidth,
      dimensionDepth: args.dimensionDepth,
      dimensionWeight: args.dimensionWeight,
      dimensionUnit: args.dimensionUnit,
      weightUnit: args.weightUnit,
      dimensionMeasuredPart: args.dimensionMeasuredPart,
      measurementSets: described.measurementSets,
      description: args.description,
      condition: normalizedCondition,
      conditionHistory,
      completeness: args.completeness,
      completenessNote: described.completenessNote,
      inscriptions: args.inscriptions,
      inscriptionMarks: args.inscriptionMarks,
      tags: args.tags,
      subjects: described.subjects,
      provenance: args.provenance,
      exhibitionHistory: args.exhibitionHistory,
      ownershipHistory: args.ownershipHistory,
      donated_by: args.donated_by,
      donated_date: args.donated_date,
      donation_info: args.donation_info,
      creditLine: args.creditLine,
      rightsStatement: described.rightsStatement,
      previous_owners: args.previous_owners,
      links: args.links,
      parentObjectId: args.parentObjectId,
      currentLocationId: args.currentLocationId,
      alternateAccessionNumbers: args.alternateAccessionNumbers,
      acquisitionMethod: args.acquisitionMethod,
      legalRestrictions: args.legalRestrictions,
      isPubliclyVisible: args.isPubliclyVisible,
      isHighResDownloadable: args.isHighResDownloadable,
      isSearchable: args.isSearchable,
      isValuationVisible: args.isValuationVisible,
      publicSlug: args.publicSlug,
      displayStatus: args.displayStatus,
      collectionType: args.collectionType,
      status: "active",
      catalogedBy: userId,
      catalogedAt: Date.now(),
    });

    await Promise.all([
      syncCollectionOptionUsages(ctx, collectionId),
      applyUsageCounterDelta(ctx, args.organizationId, {
        objectCount: 1,
      }),
      syncCollectionGroupMemberships(
        ctx,
        collectionId,
        args.organizationId,
        args.collectionGroupIds ??
          (args.collectionGroupId ? [args.collectionGroupId] : []),
        userId,
        primaryGroupId,
      ),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: args.organizationId,
        userId,
        action: "created_collection",
        entityType: "collection",
        entityId: collectionId,
        changes: {
          accessionNumber,
          title: args.title,
          collectionType: args.collectionType,
        },
      }),
    ] as const);

    await emitWebhookEvent(ctx, args.organizationId, "collection.created", {
      collectionId,
      title: args.title,
    });

    return collectionId;
  },
});

export const resolveId = query({
  args: {
    id: v.string(),
  },
  returns: v.union(
    v.object({
      type: v.literal("collection"),
      id: v.id("collections"),
    }),
    v.object({
      type: v.literal("collectionGroup"),
      id: v.id("collectionGroups"),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const collectionId = ctx.db.normalizeId("collections", args.id);
    const collection = collectionId ? await ctx.db.get(collectionId) : null;
    if (collection) {
      try {
        await requirePermission(
          ctx,
          collection.organizationId,
          "collections.read",
        );
        return { type: "collection" as const, id: collection._id };
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.startsWith("Permission denied")
        ) {
          return null;
        }
        throw error;
      }
    }

    const groupId = ctx.db.normalizeId("collectionGroups", args.id);
    const group = groupId ? await ctx.db.get(groupId) : null;
    if (group) {
      try {
        await requirePermission(ctx, group.organizationId, "collections.read");
        return { type: "collectionGroup" as const, id: group._id };
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.startsWith("Permission denied")
        ) {
          return null;
        }
        throw error;
      }
    }

    return null;
  },
});

export const get = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.union(objectDetailCollectionValidator, v.null()),
  handler: async (ctx, args) => {
    const [userId, collection] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.collectionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!collection) return null;

    await requirePermission(ctx, collection.organizationId, "collections.read");

    let verifiedByName: string | undefined;
    if (collection.verifiedBy) {
      const verifier = await ctx.db.get(collection.verifiedBy);
      verifiedByName = verifier?.name ?? verifier?.email ?? undefined;
    }

    return {
      ...collection,
      verifiedByName,
    };
  },
});

export const getObjectDetail = query({
  args: {
    // A string, so malformed links and other tables' IDs read as missing.
    collectionId: v.string(),
  },
  returns: v.union(
    v.object({
      collection: objectDetailCollectionValidator,
      collectionGroup: v.union(
        v.object({
          _id: v.id("collectionGroups"),
          name: v.string(),
        }),
        v.null(),
      ),
      locationPath: v.array(objectDetailLocationPathItemValidator),
      heroImage: v.union(objectDetailMediaValidator, v.null()),
      typeDetails: v.union(objectTypeDetailsValidator, v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const collectionId = ctx.db.normalizeId("collections", args.collectionId);
    const [userId, collection] = await Promise.all([
      getAuthUserId(ctx),
      collectionId ? ctx.db.get(collectionId) : null,
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (
      !collection ||
      !(await canReadRecord(ctx, collection.organizationId, "collections.read"))
    ) {
      return null;
    }

    const [collectionGroup, locationPath, heroImage, verifier, typeDetails] =
      await Promise.all([
        collection.collectionGroupId
          ? ctx.db.get(collection.collectionGroupId)
          : Promise.resolve(null),
        collection.currentLocationId
          ? getObjectDetailLocationPath(ctx, collection.currentLocationId)
          : Promise.resolve([]),
        getObjectDetailHeroImage(ctx, collection._id),
        collection.verifiedBy
          ? ctx.db.get(collection.verifiedBy)
          : Promise.resolve(null),
        getObjectTypeDetails(ctx, collection),
      ] as const);

    return {
      collection: {
        ...collection,
        verifiedByName: verifier?.name ?? verifier?.email ?? undefined,
      },
      collectionGroup: collectionGroup
        ? {
            _id: collectionGroup._id,
            name: collectionGroup.name,
          }
        : null,
      locationPath,
      heroImage,
      typeDetails,
    };
  },
});

export const getWithModuleDetails = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.union(
    v.object({
      collection: v.object({
        _id: v.id("collections"),
        organizationId: v.id("organizations"),
        accessionNumber: v.string(),
        title: v.string(),
        collectionType: v.optional(collectionTypeValidator),
        customFields: v.optional(v.record(v.string(), customFieldValue)),
        status: v.union(
          v.literal("active"),
          v.literal("loaned"),
          v.literal("deaccessioned"),
          v.literal("archived"),
          v.literal("deleted"),
        ),
        _creationTime: v.number(),
      }),
      moduleDetails: v.union(
        v.object({
          type: v.literal("fine_art"),
          data: v.object({
            _id: v.id("fineArtDetails"),
            appraisedValue: v.optional(v.number()),
            replacementValue: v.optional(v.number()),
            insurancePolicyNumber: v.optional(v.string()),
            reappraisalDate: v.optional(v.number()),
            displayStatus: v.optional(v.string()),
            provenanceChain: v.optional(v.any()),
            shippingLogs: v.optional(v.any()),
          }),
        }),
        v.object({
          type: v.literal("wine"),
          data: v.object({
            _id: v.id("wineDetails"),
            vintage: v.optional(v.number()),
            peakWindowStart: v.optional(v.number()),
            peakWindowEnd: v.optional(v.number()),
            binNumber: v.optional(v.string()),
            producer: v.optional(v.string()),
            fillLevel: v.optional(v.string()),
          }),
        }),
        v.object({
          type: v.literal("automotive"),
          data: v.object({
            _id: v.id("vehicleDetails"),
            vin: v.optional(v.string()),
            make: v.optional(v.string()),
            model: v.optional(v.string()),
            year: v.optional(v.number()),
            odometer: v.optional(v.number()),
          }),
        }),
        v.object({
          type: v.literal("natural_history"),
          data: v.object({
            _id: v.id("naturalHistoryDetails"),
            scientificName: v.optional(v.string()),
            commonName: v.optional(v.string()),
            kingdom: v.optional(v.string()),
            genus: v.optional(v.string()),
            species: v.optional(v.string()),
            latitude: v.optional(v.number()),
            longitude: v.optional(v.number()),
          }),
        }),
        v.object({
          type: v.literal("archive"),
          data: v.object({
            _id: v.id("archiveDetails"),
            documentType: v.optional(v.string()),
            retentionExpiresAt: v.optional(v.number()),
            flaggedForDestruction: v.optional(v.boolean()),
            legalHold: v.optional(v.boolean()),
            confidentialityLevel: v.optional(v.string()),
          }),
        }),
        v.object({
          type: v.literal("coins_stamps"),
          data: v.object({
            _id: v.id("coinsStampsDetails"),
            itemCategory: v.optional(v.string()),
            issuingAuthority: v.optional(v.string()),
            countryOrRegion: v.optional(v.string()),
            denomination: v.optional(v.string()),
            issueYear: v.optional(v.number()),
            catalogNumber: v.optional(v.string()),
            grade: v.optional(v.string()),
            estimatedValue: v.optional(v.number()),
          }),
        }),
        v.null(),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const [userId, collection] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.collectionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!collection) {
      return null;
    }

    await requirePermission(ctx, collection.organizationId, "collections.read");

    const collectionType = collection.collectionType;
    type ModuleDetails =
      | {
          type: "fine_art";
          data: {
            _id: Id<"fineArtDetails">;
            displayStatus?: string;
            appraisedValue?: number;
            replacementValue?: number;
            insurancePolicyNumber?: string;
            reappraisalDate?: number;
            provenanceChain?: unknown;
            shippingLogs?: unknown;
          };
        }
      | {
          type: "wine";
          data: {
            _id: Id<"wineDetails">;
            vintage?: number;
            peakWindowStart?: number;
            peakWindowEnd?: number;
            binNumber?: string;
            producer?: string;
            fillLevel?: string;
          };
        }
      | {
          type: "automotive";
          data: {
            _id: Id<"vehicleDetails">;
            vin?: string;
            make?: string;
            model?: string;
            year?: number;
            odometer?: number;
          };
        }
      | {
          type: "natural_history";
          data: {
            _id: Id<"naturalHistoryDetails">;
            scientificName?: string;
            commonName?: string;
            kingdom?: string;
            genus?: string;
            species?: string;
            latitude?: number;
            longitude?: number;
          };
        }
      | {
          type: "archive";
          data: {
            _id: Id<"archiveDetails">;
            documentType?: string;
            retentionExpiresAt?: number;
            flaggedForDestruction?: boolean;
            legalHold?: boolean;
            confidentialityLevel?: string;
          };
        }
      | {
          type: "coins_stamps";
          data: {
            _id: Id<"coinsStampsDetails">;
            itemCategory?: string;
            issuingAuthority?: string;
            countryOrRegion?: string;
            denomination?: string;
            issueYear?: number;
            catalogNumber?: string;
            grade?: string;
            estimatedValue?: number;
          };
        }
      | null;
    let moduleDetails: ModuleDetails = null;

    if (
      collectionType === "fine_art" &&
      (await hasModuleEnabled(ctx, collection.organizationId, "fine_art"))
    ) {
      const details = await ctx.db
        .query("fineArtDetails")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", args.collectionId),
        )
        .unique();
      if (details) {
        moduleDetails = {
          type: "fine_art",
          data: {
            _id: details._id,
            appraisedValue: details.appraisedValue,
            replacementValue: details.replacementValue,
            insurancePolicyNumber: details.insurancePolicyNumber,
            reappraisalDate: details.reappraisalDate,
            displayStatus: details.displayStatus,
            provenanceChain: details.provenanceChain,
            shippingLogs: details.shippingLogs,
          },
        };
      }
    } else if (
      collectionType === "wine" &&
      (await hasModuleEnabled(ctx, collection.organizationId, "wine"))
    ) {
      const details = await ctx.db
        .query("wineDetails")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", args.collectionId),
        )
        .unique();
      if (details) {
        moduleDetails = {
          type: "wine",
          data: {
            _id: details._id,
            vintage: details.vintage,
            peakWindowStart: details.peakWindowStart,
            peakWindowEnd: details.peakWindowEnd,
            binNumber: details.binNumber,
            producer: details.producer,
            fillLevel: details.fillLevel,
          },
        };
      }
    } else if (
      collectionType === "automotive" &&
      (await hasModuleEnabled(ctx, collection.organizationId, "automotive"))
    ) {
      const details = await ctx.db
        .query("vehicleDetails")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", args.collectionId),
        )
        .unique();
      if (details) {
        moduleDetails = {
          type: "automotive",
          data: {
            _id: details._id,
            vin: details.vin,
            make: details.make,
            model: details.model,
            year: details.year,
            odometer: details.odometer,
          },
        };
      }
    } else if (
      collectionType === "natural_history" &&
      (await hasModuleEnabled(
        ctx,
        collection.organizationId,
        "natural_history",
      ))
    ) {
      const details = await ctx.db
        .query("naturalHistoryDetails")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", args.collectionId),
        )
        .unique();
      if (details) {
        moduleDetails = {
          type: "natural_history",
          data: {
            _id: details._id,
            scientificName: details.scientificName,
            commonName: details.commonName,
            kingdom: details.kingdom,
            genus: details.genus,
            species: details.species,
            latitude: details.latitude,
            longitude: details.longitude,
          },
        };
      }
    } else if (
      collectionType === "archive" &&
      (await hasModuleEnabled(ctx, collection.organizationId, "archive"))
    ) {
      const details = await ctx.db
        .query("archiveDetails")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", args.collectionId),
        )
        .unique();
      if (details) {
        moduleDetails = {
          type: "archive",
          data: {
            _id: details._id,
            documentType: details.documentType,
            retentionExpiresAt: details.retentionExpiresAt,
            flaggedForDestruction: details.flaggedForDestruction,
            legalHold: details.legalHold,
            confidentialityLevel: details.confidentialityLevel,
          },
        };
      }
    } else if (
      collectionType === "coins_stamps" &&
      (await hasModuleEnabled(ctx, collection.organizationId, "coins_stamps"))
    ) {
      const details = await ctx.db
        .query("coinsStampsDetails")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", args.collectionId),
        )
        .unique();
      if (details) {
        moduleDetails = {
          type: "coins_stamps",
          data: {
            _id: details._id,
            itemCategory: details.itemCategory,
            issuingAuthority: details.issuingAuthority,
            countryOrRegion: details.countryOrRegion,
            denomination: details.denomination,
            issueYear: details.issueYear,
            catalogNumber: details.catalogNumber,
            grade: details.grade,
            estimatedValue: details.estimatedValue,
          },
        };
      }
    }

    return {
      collection: {
        _id: collection._id,
        organizationId: collection.organizationId,
        accessionNumber: collection.accessionNumber,
        title: collection.title,
        collectionType: collection.collectionType,
        customFields: collection.customFields,
        status: collection.status,
        _creationTime: collection._creationTime,
      },
      moduleDetails,
    };
  },
});

/**
 * List collections with pagination and filters
 */
const SELECTION_SEARCH_LIMIT = 50;

/**
 * Search-on-demand for object pickers: indexed identifier and word matches,
 * capped per request. `hasMore` tells the picker to ask for a narrower query
 * instead of loading the organization.
 */
export const searchForSelection = query({
  args: {
    organizationId: v.id("organizations"),
    query: v.string(),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("loaned"),
        v.literal("deaccessioned"),
      ),
    ),
  },
  returns: v.object({
    items: v.array(
      v.object({
        _id: v.id("collections"),
        title: v.string(),
        accessionNumber: v.string(),
        status: v.string(),
      }),
    ),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");
    const query = args.query.trim();
    if (!query) return { items: [], hasMore: false };
    const statuses = args.status
      ? [args.status]
      : (["active", "loaned", "deaccessioned"] as const);
    const searches = await Promise.all(
      statuses.map((status) =>
        searchObjects(
          ctx,
          args.organizationId,
          query,
          SELECTION_SEARCH_LIMIT + 1,
          status,
        ),
      ),
    );
    const matching = searches.flatMap(({ rows }) => rows);
    return {
      items: matching.slice(0, SELECTION_SEARCH_LIMIT).map((row) => ({
        _id: row._id,
        title: row.title,
        accessionNumber: row.accessionNumber,
        status: row.status,
      })),
      hasMore: matching.length > SELECTION_SEARCH_LIMIT,
    };
  },
});

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
    ...catalogFilterFields,
    /** Older links name one location; `locationIds` replaces it. */
    locationId: v.optional(v.id("locations")),
    // Newest first unless set; identifier order is the normalized identifier,
    // A to Z; date made orders list undated Objects last. A search ranks by
    // relevance instead.
    sort: v.optional(catalogSortValidator),
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("collections"),
        accessionNumber: v.string(),
        title: v.string(),
        collectionGroupId: v.optional(v.id("collectionGroups")),
        objectType: v.optional(v.string()),
        currentLocationId: v.optional(v.id("locations")),
        locationPath: v.optional(v.string()),
        primaryImageUrl: v.optional(v.string()),
        status: v.union(
          v.literal("active"),
          v.literal("loaned"),
          v.literal("deaccessioned"),
          v.literal("archived"),
          v.literal("deleted"),
        ),
        dateCreated: v.optional(v.string()),
        dateCreatedEdtf: v.optional(v.string()),
        _creationTime: v.number(),
        /** While searching, the field the Object was found in. */
        matchedField: v.optional(objectSearchFieldValidator),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(
      v.union(
        v.literal("SplitRecommended"),
        v.literal("SplitRequired"),
        v.null(),
      ),
    ),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    const { paginationOpts, locationId, ...filters } = args;
    const locationIds =
      filters.locationIds && filters.locationIds.length > 0
        ? filters.locationIds
        : locationId
          ? [locationId]
          : undefined;
    const result = await listCatalogPage(
      ctx,
      { ...filters, locationIds },
      paginationOpts,
    );
    return await toCollectionListPaginationResult(ctx, result);
  },
});

/**
 * Search collections using searchIndex for better performance
 * This is optimized for full-text search on the title field
 */
export const search = query({
  args: {
    organizationId: v.id("organizations"),
    searchQuery: v.string(),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("loaned"),
        v.literal("deaccessioned"),
        v.literal("archived"),
        v.literal("deleted"),
      ),
    ),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    results: v.array(
      v.object({
        _id: v.id("collections"),
        accessionNumber: v.string(),
        title: v.string(),
        objectType: v.optional(v.string()),
        currentLocationId: v.optional(v.id("locations")),
        status: v.union(
          v.literal("active"),
          v.literal("loaned"),
          v.literal("deaccessioned"),
          v.literal("archived"),
          v.literal("deleted"),
        ),
        _creationTime: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    // Check permission
    await requirePermission(ctx, args.organizationId, "collections.read");

    const limit = args.limit ?? 50;
    const shouldHideObjectsWithDeaccessionRecords =
      args.status !== "deaccessioned" && args.status !== "deleted";
    const collectionIdsWithOpenDeaccessions =
      shouldHideObjectsWithDeaccessionRecords
        ? await getCollectionsWithOpenDeaccessions(ctx, args.organizationId)
        : null;

    // Use searchIndex for efficient full-text search on title
    const searchQuery = ctx.db
      .query("collections")
      .withSearchIndex("search_index", (q) => {
        let filter = q
          .search("title", args.searchQuery)
          .eq("organizationId", args.organizationId);

        if (args.status) {
          filter = filter.eq("status", args.status);
        }

        return filter;
      });

    const results = await searchQuery.take(limit);

    // Also search other fields that aren't in the searchIndex
    // This extends the search to accession numbers and other fields
    const additionalResults: typeof results = [];

    if (args.searchQuery.length > 0) {
      const allCollections = await ctx.db
        .query("collections")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", args.organizationId),
        )
        .filter((q) => {
          let condition = q.eq(q.field("organizationId"), args.organizationId);
          if (args.status) {
            condition = q.and(condition, q.eq(q.field("status"), args.status));
          }
          return condition;
        })
        .collect();

      const searchLower = args.searchQuery.toLowerCase();
      const resultIds = new Set(results.map((r) => r._id));

      const additional = allCollections
        .filter((c) => {
          // Skip if already in results
          if (resultIds.has(c._id)) return false;

          // Search in accession number and other fields
          return (
            c.accessionNumber?.toLowerCase().includes(searchLower) ||
            c.description?.toLowerCase().includes(searchLower) ||
            c.objectName?.toLowerCase().includes(searchLower) ||
            c.objectType?.toLowerCase().includes(searchLower) ||
            false
          );
        })
        .slice(0, Math.max(0, limit - results.length));

      additionalResults.push(...additional);
    }

    // Combine and deduplicate results
    const combined = [...results, ...additionalResults];
    const uniqueResults = Array.from(
      new Map(combined.map((item) => [item._id, item])).values(),
    );

    const visibleResults = uniqueResults.filter((collection) => {
      if (collection.status === "deleted" && args.status !== "deleted") {
        return false;
      }

      if (collection.status === "archived" && args.status !== "archived") {
        return false;
      }

      if (
        collection.status === "deaccessioned" &&
        args.status !== "deaccessioned"
      ) {
        return false;
      }

      if (
        collectionIdsWithOpenDeaccessions?.has(collection._id) &&
        collection.status !== "deaccessioned"
      ) {
        return false;
      }

      return true;
    });

    // Sort by creation time (newest first)
    visibleResults.sort((a, b) => b._creationTime - a._creationTime);

    return {
      results: visibleResults.slice(0, limit).map((item) => ({
        _id: item._id,
        accessionNumber: item.accessionNumber,
        title: item.title,
        objectType: item.objectType,
        currentLocationId: item.currentLocationId,
        status: item.status,
        _creationTime: item._creationTime,
      })),
    };
  },
});

/**
 * Update collection object
 */
export const update = mutation({
  args: {
    collectionId: v.id("collections"),
    collectionGroupId: v.optional(v.id("collectionGroups")),
    collectionGroupIds: v.optional(v.array(v.id("collectionGroups"))),
    title: v.optional(v.string()),
    alternativeTitle: v.optional(v.string()),
    creator: v.optional(v.string()),
    objectType: v.optional(v.string()),
    objectName: v.optional(v.string()),
    /** Null clears it. */
    numberOfObjects: v.optional(v.union(v.number(), v.null())),
    culture: v.optional(v.string()),
    period: v.optional(v.string()),
    dateCreated: v.optional(v.string()),
    /** EDTF, stored canonical; "" or null clears it. */
    dateCreatedEdtf: v.optional(v.union(v.string(), v.null())),
    materials: v.optional(v.string()),
    technique: v.optional(v.string()),
    dimensions: v.optional(v.string()),
    dimensionDiameter: v.optional(v.string()),
    /** Null clears a measured dimension. */
    dimensionHeight: v.optional(v.union(v.number(), v.null())),
    dimensionWidth: v.optional(v.union(v.number(), v.null())),
    dimensionDepth: v.optional(v.union(v.number(), v.null())),
    dimensionWeight: v.optional(v.union(v.number(), v.null())),
    dimensionUnit: v.optional(v.string()),
    weightUnit: v.optional(v.string()),
    /** Null clears the main set's part; null or [] clears further sets. */
    dimensionMeasuredPart: v.optional(v.union(measuredPartValidator, v.null())),
    measurementSets: v.optional(
      v.union(v.array(measurementSetValidator), v.null()),
    ),
    description: v.optional(v.string()),
    condition: v.optional(v.string()),
    conditionChangeNote: v.optional(v.string()),
    /** Null clears it; "" or null clears the note. */
    completeness: v.optional(v.union(completenessValidator, v.null())),
    completenessNote: v.optional(v.union(v.string(), v.null())),
    inscriptions: v.optional(v.string()),
    inscriptionMarks: v.optional(
      v.array(
        v.object({
          label: v.string(),
          description: v.string(),
        }),
      ),
    ),
    tags: v.optional(v.array(v.string())),
    /** Null or [] clears them. */
    subjects: v.optional(v.union(v.array(v.string()), v.null())),
    provenance: v.optional(v.string()),
    exhibitionHistory: v.optional(v.string()),
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
    donated_by: v.optional(v.array(v.string())),
    donated_date: v.optional(v.string()),
    donation_info: v.optional(v.string()),
    creditLine: v.optional(v.string()),
    /** Null clears it, so the Organization's default applies. */
    rightsStatement: v.optional(v.union(rightsStatementValidator, v.null())),
    previous_owners: v.optional(v.array(v.string())),
    links: v.optional(
      v.array(
        v.object({
          url: v.string(),
          label: v.optional(v.string()),
        }),
      ),
    ),
    /** Null removes the parent object. */
    parentObjectId: v.optional(v.union(v.id("collections"), v.null())),
    currentLocationId: v.optional(v.id("locations")),
    alternateAccessionNumbers: v.optional(v.array(v.string())),
    acquisitionMethod: v.optional(v.string()),
    legalRestrictions: v.optional(v.boolean()),
    isPubliclyVisible: v.optional(v.boolean()),
    isHighResDownloadable: v.optional(v.boolean()),
    isSearchable: v.optional(v.boolean()),
    isValuationVisible: v.optional(v.boolean()),
    publicSlug: v.optional(v.string()),
    displayStatus: v.optional(v.string()),
    /** From `recordEdits.getEditState`; a stale version is refused. */
    expectedEditVersion: v.optional(v.string()),
  },
  returns: v.object({ editVersion: v.string() }),
  handler: async (ctx, args) => {
    const [userId, collection] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.collectionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!collection) {
      throw new Error("Collection not found");
    }

    // Check permission
    await requirePermission(
      ctx,
      collection.organizationId,
      "collections.update",
    );
    assertCurrentEditVersion(
      await objectEditVersion(ctx, collection),
      args.expectedEditVersion,
    );
    requireFieldValue("title", args.title);
    if (args.parentObjectId === args.collectionId)
      throw recordEditError(
        "PARENT_IS_SELF",
        "Object cannot be its own parent",
        { field: "parentObjectId" },
      );
    await validateCollectionReferences(ctx, collection.organizationId, {
      parentObjectId: args.parentObjectId ?? undefined,
      currentLocationId: args.currentLocationId,
    });
    for (const [field, groupIds] of [
      [
        "collectionGroupId",
        args.collectionGroupId ? [args.collectionGroupId] : [],
      ],
      ["collectionGroupIds", args.collectionGroupIds ?? []],
    ] as const) {
      for (const groupId of groupIds) {
        const group = await ctx.db.get(groupId);
        if (!group || group.organizationId !== collection.organizationId)
          throw recordEditError(
            "RELATED_RECORD_UNAVAILABLE",
            "Collection group not found in this organization",
            { field },
          );
      }
    }

    // Build update object - using any to avoid verbose type definition
    const updates: Record<string, unknown> = {};

    if (args.title !== undefined) updates.title = args.title;
    if (args.alternativeTitle !== undefined)
      updates.alternativeTitle = args.alternativeTitle;
    const primaryGroupId =
      args.collectionGroupId ??
      (args.collectionGroupIds !== undefined
        ? args.collectionGroupIds.includes(collection.collectionGroupId!)
          ? collection.collectionGroupId
          : args.collectionGroupIds[0]
        : collection.collectionGroupId);
    if (
      args.collectionGroupId !== undefined ||
      args.collectionGroupIds !== undefined
    ) {
      updates.collectionGroupId = primaryGroupId;
    }
    if (args.creator !== undefined) updates.creator = args.creator;
    if (args.objectType !== undefined) updates.objectType = args.objectType;
    if (args.objectName !== undefined) updates.objectName = args.objectName;
    if (args.numberOfObjects !== undefined)
      updates.numberOfObjects = enteredNumberOfObjects(args.numberOfObjects);
    if (args.culture !== undefined) updates.culture = args.culture;
    if (args.period !== undefined) updates.period = args.period;
    if (args.dateCreated !== undefined) updates.dateCreated = args.dateCreated;
    if (args.dateCreatedEdtf !== undefined)
      updates.dateCreatedEdtf = enteredProductionDate(args.dateCreatedEdtf);
    if (args.materials !== undefined) updates.materials = args.materials;
    if (args.technique !== undefined) updates.technique = args.technique;
    if (args.dimensions !== undefined) updates.dimensions = args.dimensions;
    if (args.dimensionDiameter !== undefined)
      updates.dimensionDiameter = args.dimensionDiameter;
    if (args.dimensionHeight !== undefined)
      updates.dimensionHeight = args.dimensionHeight ?? undefined;
    if (args.dimensionWidth !== undefined)
      updates.dimensionWidth = args.dimensionWidth ?? undefined;
    if (args.dimensionDepth !== undefined)
      updates.dimensionDepth = args.dimensionDepth ?? undefined;
    if (args.dimensionWeight !== undefined)
      updates.dimensionWeight = args.dimensionWeight ?? undefined;
    if (args.dimensionUnit !== undefined)
      updates.dimensionUnit = args.dimensionUnit;
    if (args.weightUnit !== undefined) updates.weightUnit = args.weightUnit;
    if (args.dimensionMeasuredPart !== undefined)
      updates.dimensionMeasuredPart = args.dimensionMeasuredPart ?? undefined;
    if (args.measurementSets !== undefined)
      updates.measurementSets = enteredMeasurementSets(args.measurementSets);
    if (args.completeness !== undefined)
      updates.completeness = args.completeness ?? undefined;
    if (args.completenessNote !== undefined)
      updates.completenessNote = enteredCompletenessNote(args.completenessNote);
    if (args.description !== undefined) updates.description = args.description;
    if (args.condition !== undefined) {
      const previousCondition = normalizeOptionalString(collection.condition);
      const nextCondition = normalizeOptionalString(args.condition);
      const conditionChanged = previousCondition !== nextCondition;

      if (collection.currentConditionAssessmentId && conditionChanged) {
        throw recordEditError(
          "CONDITION_SET_BY_ASSESSMENT",
          "Current condition is based on an accepted assessment. Record another assessment to change it.",
          { field: "condition" },
        );
      }

      updates.condition = nextCondition;

      if (conditionChanged) {
        const note = normalizeOptionalString(args.conditionChangeNote);

        if (previousCondition && !note) {
          throw recordEditError(
            "CONDITION_NOTE_REQUIRED",
            "Condition change note is required when updating the condition.",
            { field: "conditionChangeNote" },
          );
        }

        if (nextCondition) {
          updates.conditionHistory = [
            ...(collection.conditionHistory ?? []),
            await buildConditionHistoryEntry(ctx, userId, nextCondition, note),
          ];
        }
      }
    }
    if (args.inscriptions !== undefined)
      updates.inscriptions = args.inscriptions;
    if (args.inscriptionMarks !== undefined)
      updates.inscriptionMarks = args.inscriptionMarks;
    if (args.tags !== undefined) updates.tags = args.tags;
    if (args.subjects !== undefined)
      updates.subjects = enteredSubjects(args.subjects);
    if (args.provenance !== undefined) updates.provenance = args.provenance;
    if (args.exhibitionHistory !== undefined)
      updates.exhibitionHistory = args.exhibitionHistory;
    if (args.ownershipHistory !== undefined)
      updates.ownershipHistory = args.ownershipHistory;
    if (args.donated_by !== undefined) updates.donated_by = args.donated_by;
    if (args.donated_date !== undefined)
      updates.donated_date = args.donated_date;
    if (args.donation_info !== undefined)
      updates.donation_info = args.donation_info;
    if (args.creditLine !== undefined) updates.creditLine = args.creditLine;
    if (args.rightsStatement !== undefined)
      updates.rightsStatement = enteredRightsStatement(args.rightsStatement);
    if (args.previous_owners !== undefined)
      updates.previous_owners = args.previous_owners;
    if (args.links !== undefined) updates.links = args.links;
    if (args.parentObjectId !== undefined)
      updates.parentObjectId = args.parentObjectId ?? undefined;
    if (
      args.currentLocationId !== undefined &&
      args.currentLocationId === collection.currentLocationId
    )
      updates.currentLocationId = args.currentLocationId;
    if (args.alternateAccessionNumbers !== undefined)
      updates.alternateAccessionNumbers = args.alternateAccessionNumbers;
    if (args.acquisitionMethod !== undefined)
      updates.acquisitionMethod = args.acquisitionMethod;
    if (args.legalRestrictions !== undefined)
      updates.legalRestrictions = args.legalRestrictions;
    if (args.isPubliclyVisible !== undefined)
      updates.isPubliclyVisible = args.isPubliclyVisible;
    if (args.isHighResDownloadable !== undefined)
      updates.isHighResDownloadable = args.isHighResDownloadable;
    if (args.isSearchable !== undefined)
      updates.isSearchable = args.isSearchable;
    if (args.isValuationVisible !== undefined)
      updates.isValuationVisible = args.isValuationVisible;
    if (args.publicSlug !== undefined) updates.publicSlug = args.publicSlug;
    if (args.displayStatus !== undefined) {
      updates.displayStatus =
        normalizeOptionalString(args.displayStatus) || undefined;
    }

    updates.lastModifiedBy = userId;
    updates.lastModifiedAt = Date.now();

    await ctx.db.patch(args.collectionId, updates);
    if (args.currentLocationId !== undefined) {
      await moveCollectionToLocation(
        ctx,
        collection,
        args.currentLocationId,
        userId,
        DEFAULT_MOVEMENT_REASONS.catalogEdit,
        { kind: "catalog_edit" },
      );
    }
    await syncCollectionOptionUsages(ctx, args.collectionId);

    if (args.collectionGroupIds !== undefined) {
      await syncCollectionGroupMemberships(
        ctx,
        args.collectionId,
        collection.organizationId,
        args.collectionGroupIds,
        userId,
        primaryGroupId,
      );
    } else if (
      args.collectionGroupId !== undefined &&
      args.collectionGroupId !== collection.collectionGroupId
    ) {
      const existingGroups = await ctx.db
        .query("collectionGroupItems")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", args.collectionId),
        )
        .collect();
      await syncCollectionGroupMemberships(
        ctx,
        args.collectionId,
        collection.organizationId,
        existingGroups.map((membership) => membership.collectionGroupId),
        userId,
        primaryGroupId,
      );
    }

    await ctx.runMutation(internal.audit.logAction, {
      organizationId: collection.organizationId,
      userId,
      action: "updated_collection",
      entityType: "collection",
      entityId: args.collectionId,
      changes: updates,
    });

    const updated = await ctx.db.get(args.collectionId);
    if (!updated) throw new Error("Collection disappeared during update");
    return { editVersion: await objectEditVersion(ctx, updated) };
  },
});

/**
 * Archive collection - hides from normal views but preserves all data
 */
export const archiveCollection = mutation({
  args: {
    collectionId: v.id("collections"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => archiveCollectionHandler(ctx, args),
});

/**
 * Restore collection from archived or legacy deleted status.
 */
export const restoreCollection = mutation({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.null(),
  handler: async (ctx, args) => restoreCollectionHandler(ctx, args),
});

/**
 * Get multiple collections by IDs in a single batch query
 */
export const getBatch = query({
  args: {
    organizationId: v.id("organizations"),
    collectionIds: v.array(v.id("collections")),
  },
  returns: v.array(
    v.object({
      _id: v.id("collections"),
      _creationTime: v.number(),
      accessionNumber: v.string(),
      title: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check permission
    await requirePermission(ctx, args.organizationId, "collections.read");

    // Fetch all collections
    const collections = await Promise.all(
      args.collectionIds.map((id) => ctx.db.get(id)),
    );

    // Filter out nulls and verify organization ownership
    return collections.flatMap((collection) =>
      collection !== null && collection.organizationId === args.organizationId
        ? [
            {
              _id: collection._id,
              _creationTime: collection._creationTime,
              accessionNumber: collection.accessionNumber,
              title: collection.title,
            },
          ]
        : [],
    );
  },
});

/**
 * Find collection by accession number
 */
export const getByAccessionNumber = query({
  args: {
    organizationId: v.id("organizations"),
    accessionNumber: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("collections"),
      accessionNumber: v.string(),
      title: v.string(),
      status: v.union(
        v.literal("active"),
        v.literal("loaned"),
        v.literal("deaccessioned"),
        v.literal("archived"),
        v.literal("deleted"),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");

    // Check primary accession number
    let collection = await ctx.db
      .query("collections")
      .withIndex("by_organization_and_accessionNumber", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("accessionNumber", args.accessionNumber),
      )
      .first();

    if (collection) {
      return {
        _id: collection._id,
        accessionNumber: collection.accessionNumber,
        title: collection.title,
        status: collection.status,
      };
    }

    // Check alternate accession numbers
    const allCollections = await ctx.db
      .query("collections")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    collection =
      allCollections.find((c) =>
        c.alternateAccessionNumbers?.includes(args.accessionNumber),
      ) ?? null;

    if (collection) {
      return {
        _id: collection._id,
        accessionNumber: collection.accessionNumber,
        title: collection.title,
        status: collection.status,
      };
    }

    return null;
  },
});

/**
 * Add alternate accession number
 */
export const addAlternateAccessionNumber = mutation({
  args: {
    collectionId: v.id("collections"),
    accessionNumber: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, collection] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.collectionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!collection) {
      throw new Error("Collection not found");
    }

    // Check permission
    await requirePermission(
      ctx,
      collection.organizationId,
      "collections.update",
    );

    const alternateNumbers = collection.alternateAccessionNumbers ?? [];
    if (alternateNumbers.includes(args.accessionNumber)) {
      throw new Error("Alternate accession number already exists");
    }

    await Promise.all([
      ctx.db.patch(args.collectionId, {
        alternateAccessionNumbers: [...alternateNumbers, args.accessionNumber],
        lastModifiedBy: userId,
        lastModifiedAt: Date.now(),
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: collection.organizationId,
        userId,
        action: "added_alternate_accession_number",
        entityType: "collection",
        entityId: args.collectionId,
        changes: {
          addedNumber: args.accessionNumber,
          primaryAccessionNumber: collection.accessionNumber,
        },
      }),
    ]);

    return null;
  },
});

/**
 * Remove alternate accession number
 */
export const removeAlternateAccessionNumber = mutation({
  args: {
    collectionId: v.id("collections"),
    accessionNumber: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [userId, collection] = await Promise.all([
      getAuthUserId(ctx),
      ctx.db.get(args.collectionId),
    ] as const);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    if (!collection) {
      throw new Error("Collection not found");
    }

    // Check permission
    await requirePermission(
      ctx,
      collection.organizationId,
      "collections.update",
    );

    const alternateNumbers = collection.alternateAccessionNumbers ?? [];
    const updated = alternateNumbers.filter(
      (num) => num !== args.accessionNumber,
    );

    await Promise.all([
      ctx.db.patch(args.collectionId, {
        alternateAccessionNumbers: updated,
        lastModifiedBy: userId,
        lastModifiedAt: Date.now(),
      }),
      ctx.runMutation(internal.audit.logAction, {
        organizationId: collection.organizationId,
        userId,
        action: "removed_alternate_accession_number",
        entityType: "collection",
        entityId: args.collectionId,
        changes: {
          removedNumber: args.accessionNumber,
          primaryAccessionNumber: collection.accessionNumber,
        },
      }),
    ]);

    return null;
  },
});

/**
 * Get accession number history
 */
export const getAccessionHistory = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.array(
    v.object({
      number: v.string(),
      validFrom: v.number(),
      validTo: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      throw new Error("Collection not found");
    }

    const { requirePermission } = await import("./utils/permissions");
    await requirePermission(ctx, collection.organizationId, "collections.read");

    return collection.accessionNumberHistory ?? [];
  },
});

/**
 * Get parent object for a collection
 */
export const getParentObject = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.union(
    v.object({
      _id: v.id("collections"),
      title: v.string(),
      accessionNumber: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx))) {
      throw new Error("Not authenticated");
    }

    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      return null;
    }

    try {
      await requirePermission(
        ctx,
        collection.organizationId,
        "collections.read",
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Permission denied")
      ) {
        return null;
      }
      throw error;
    }

    if (!collection.parentObjectId) {
      return null;
    }

    const parent = await ctx.db.get(collection.parentObjectId);
    if (!parent || parent.organizationId !== collection.organizationId) {
      return null;
    }

    return {
      _id: parent._id,
      title: parent.title,
      accessionNumber: parent.accessionNumber,
    };
  },
});

const CHILD_OBJECT_CAP = 100;
const emptyChildObjects = { children: [], truncated: false };

/**
 * Get child objects (objects that have this collection as parent)
 */
export const getChildObjects = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.object({
    children: v.array(
      v.object({
        _id: v.id("collections"),
        title: v.string(),
        accessionNumber: v.string(),
        status: v.union(
          v.literal("active"),
          v.literal("loaned"),
          v.literal("deaccessioned"),
          v.literal("archived"),
          v.literal("deleted"),
        ),
        thumbnailUrl: v.union(v.string(), v.null()),
      }),
    ),
    truncated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx))) {
      throw new Error("Not authenticated");
    }

    const collection = await ctx.db.get(args.collectionId);
    if (!collection) return emptyChildObjects;

    try {
      await requirePermission(
        ctx,
        collection.organizationId,
        "collections.read",
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Permission denied")
      ) {
        return emptyChildObjects;
      }
      throw error;
    }

    const page = await ctx.db
      .query("collections")
      .withIndex("by_parentObject", (q) =>
        q.eq("parentObjectId", args.collectionId),
      )
      .take(CHILD_OBJECT_CAP + 1);
    const truncated = page.length > CHILD_OBJECT_CAP;

    const tasks: Array<
      Promise<{
        _id: Id<"collections">;
        title: string;
        accessionNumber: string;
        status: Doc<"collections">["status"];
        thumbnailUrl: string | null;
      }>
    > = [];
    for (const child of page.slice(0, CHILD_OBJECT_CAP)) {
      if (child.organizationId !== collection.organizationId) continue;
      tasks.push(
        (async () => {
          const primaryMedia = await ctx.db
            .query("mediaFiles")
            .withIndex("by_collection_and_isPrimary_and_fileType", (q) =>
              q
                .eq("collectionId", child._id)
                .eq("isPrimary", true)
                .eq("fileType", "image"),
            )
            .first();

          let thumbnailUrl: string | null = null;
          if (
            primaryMedia?.storageId &&
            primaryMedia.organizationId === collection.organizationId
          ) {
            thumbnailUrl = await getDisplayedMediaThumbnailUrl(
              ctx,
              primaryMedia,
            );
          }

          return {
            _id: child._id,
            title: child.title,
            accessionNumber: child.accessionNumber,
            status: child.status,
            thumbnailUrl,
          };
        })(),
      );
    }
    const results = await Promise.all(tasks);

    return { children: results, truncated };
  },
});

/**
 * Get sibling objects (objects that share the same parent)
 */
export const getSiblingObjects = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.array(
    v.object({
      _id: v.id("collections"),
      title: v.string(),
      accessionNumber: v.string(),
      thumbnailUrl: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx))) {
      throw new Error("Not authenticated");
    }

    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      return [];
    }

    try {
      await requirePermission(
        ctx,
        collection.organizationId,
        "collections.read",
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Permission denied")
      ) {
        return [];
      }
      throw error;
    }

    if (!collection.parentObjectId) {
      return [];
    }

    const parent = await ctx.db.get(collection.parentObjectId);
    if (!parent || parent.organizationId !== collection.organizationId)
      return [];

    const siblings = await ctx.db
      .query("collections")
      .withIndex("by_parentObject", (q) =>
        q.eq("parentObjectId", collection.parentObjectId),
      )
      .take(5);

    const tasks: Array<
      Promise<{
        _id: Id<"collections">;
        title: string;
        accessionNumber: string;
        thumbnailUrl: string | null;
      }>
    > = [];
    for (const sibling of siblings) {
      if (
        sibling._id === args.collectionId ||
        sibling.organizationId !== collection.organizationId
      )
        continue;
      tasks.push(
        (async () => {
          const primaryMedia = await ctx.db
            .query("mediaFiles")
            .withIndex("by_collection_and_isPrimary_and_fileType", (q) =>
              q
                .eq("collectionId", sibling._id)
                .eq("isPrimary", true)
                .eq("fileType", "image"),
            )
            .first();

          let thumbnailUrl: string | null = null;
          if (
            primaryMedia?.storageId &&
            primaryMedia.organizationId === collection.organizationId
          ) {
            thumbnailUrl = await getDisplayedMediaThumbnailUrl(
              ctx,
              primaryMedia,
            );
          }

          return {
            _id: sibling._id,
            title: sibling.title,
            accessionNumber: sibling.accessionNumber,
            thumbnailUrl,
          };
        })(),
      );
    }
    const results = await Promise.all(tasks);

    return results;
  },
});

/**
 * Get parent object with thumbnail
 */
export const getParentObjectWithThumbnail = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.union(
    v.object({
      _id: v.id("collections"),
      title: v.string(),
      accessionNumber: v.string(),
      thumbnailUrl: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    if (!(await getAuthUserId(ctx))) {
      throw new Error("Not authenticated");
    }

    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      return null;
    }

    try {
      await requirePermission(
        ctx,
        collection.organizationId,
        "collections.read",
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Permission denied")
      ) {
        return null;
      }
      throw error;
    }

    if (!collection.parentObjectId) {
      return null;
    }

    const parent = await ctx.db.get(collection.parentObjectId);
    if (!parent || parent.organizationId !== collection.organizationId) {
      return null;
    }

    // Get primary image for thumbnail
    const primaryMedia = await ctx.db
      .query("mediaFiles")
      .withIndex("by_collection", (q) => q.eq("collectionId", parent._id))
      .filter((q) => q.eq(q.field("isPrimary"), true))
      .first();

    let thumbnailUrl: string | null = null;
    if (
      primaryMedia?.storageId &&
      primaryMedia.organizationId === collection.organizationId
    ) {
      thumbnailUrl = await getDisplayedMediaThumbnailUrl(ctx, primaryMedia);
    }

    return {
      _id: parent._id,
      title: parent.title,
      accessionNumber: parent.accessionNumber,
      thumbnailUrl,
    };
  },
});

export const getThumbnail = query({
  args: {
    collectionId: v.id("collections"),
  },
  returns: v.union(
    v.object({
      thumbnailUrl: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) {
      return null;
    }

    const [, primaryMedia] = await Promise.all([
      requirePermission(ctx, collection.organizationId, "collections.read"),
      ctx.db
        .query("mediaFiles")
        .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
        .filter((q) => q.eq(q.field("isPrimary"), true))
        .first(),
    ] as const);

    let thumbnailUrl: string | null = null;
    if (primaryMedia?.storageId) {
      thumbnailUrl = await getDisplayedMediaThumbnailUrl(ctx, primaryMedia);
    }

    return { thumbnailUrl };
  },
});

export const bulkUpdateLocation = mutation({
  args: {
    collectionIds: v.array(v.id("collections")),
    locationId: v.id("locations"),
  },
  returns: v.object({
    updated: v.number(),
    failed: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const uniqueIds = [...new Set(args.collectionIds)];
    const collections = await Promise.all(
      uniqueIds.map((id) => ctx.db.get(id)),
    );
    if (collections.some((collection) => !collection))
      throw new Error("Collection not found");
    const organizationId = collections[0]?.organizationId;
    if (!organizationId) return { updated: 0, failed: 0 };
    if (
      collections.some(
        (collection) => collection?.organizationId !== organizationId,
      )
    )
      throw new Error("Collections must belong to one organization");
    // Moving objects needs the same permission one at a time or in bulk.
    await requirePermission(ctx, organizationId, "locations.update");
    await requireUsableLocation(ctx, organizationId, args.locationId);
    for (const collection of collections) {
      if (collection)
        await moveCollectionToLocation(
          ctx,
          collection,
          args.locationId,
          userId,
          DEFAULT_MOVEMENT_REASONS.bulkCatalogEdit,
          { kind: "bulk_edit" },
        );
    }
    return { updated: uniqueIds.length, failed: 0 };
  },
});

export const bulkDeaccession = mutation({
  args: {
    collectionIds: v.array(v.id("collections")),
    reason: v.string(),
  },
  returns: v.object({
    deaccessioned: v.number(),
    awaitingDecision: v.number(),
    failed: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    let deaccessioned = 0;
    let awaitingDecision = 0;
    let failed = 0;
    let skipped = 0;

    for (const collectionId of args.collectionIds) {
      const collection = await ctx.db.get(collectionId);
      if (!collection) {
        failed++;
        continue;
      }

      if (collection.status === "deaccessioned") {
        skipped++;
        continue;
      }

      if (
        collection.status === "loaned" ||
        (await collectionHasOccupyingLoan(ctx, collectionId))
      ) {
        failed++;
        continue;
      }

      try {
        // Bulk UI has no method picker yet; default to destruction.
        const deaccessionId = await createDeaccessionRecord(
          ctx,
          {
            organizationId: collection.organizationId,
            collectionId,
            reason: args.reason,
            method: "destruction",
            dateDeaccessioned: Date.now(),
          },
          userId,
        );
        // Bulk removal records no intended disposition, so the decision waits
        // for an approver instead of being finalized without evidence.
        const created = await ctx.db.get(deaccessionId);
        if (created?.status === "approved") {
          deaccessioned++;
        } else {
          awaitingDecision++;
        }
      } catch (error) {
        // A member who may not start a deaccession is refused outright, with
        // the coded reason, instead of failing object by object.
        if (capabilityUnavailableFromError(error)) throw error;
        // One already waiting for approval, or held by a transfer to another
        // organization, is left as it is.
        const refusal = workflowApprovalErrorFromError(error)?.code;
        if (refusal === "ALREADY_PENDING" || refusal === "OBJECT_IN_TRANSFER") {
          skipped++;
          continue;
        }
        failed++;
      }
    }

    return { deaccessioned, awaitingDecision, failed, skipped };
  },
});

export const bulkExport = query({
  args: {
    collectionIds: v.array(v.id("collections")),
  },
  returns: v.array(
    v.object({
      _id: v.id("collections"),
      accessionNumber: v.string(),
      title: v.string(),
      alternativeTitle: v.optional(v.string()),
      creator: v.optional(v.string()),
      objectType: v.optional(v.string()),
      objectName: v.optional(v.string()),
      culture: v.optional(v.string()),
      period: v.optional(v.string()),
      dateCreated: v.optional(v.string()),
      materials: v.optional(v.string()),
      technique: v.optional(v.string()),
      dimensions: v.optional(v.string()),
      description: v.optional(v.string()),
      condition: v.optional(v.string()),
      provenance: v.optional(v.string()),
      numberOfObjects: v.optional(v.number()),
      subjects: v.optional(v.array(v.string())),
      completeness: v.optional(completenessValidator),
      completenessNote: v.optional(v.string()),
      dimensionMeasuredPart: v.optional(measuredPartValidator),
      measurementSets: v.optional(v.array(measurementSetValidator)),
      rightsStatement: v.optional(rightsStatementValidator),
      /** The Object's own statement, otherwise its Organization's default. */
      rightsStatementInEffect: v.optional(rightsStatementValidator),
      status: v.string(),
      locationPath: v.optional(v.string()),
      collectionGroup: v.optional(v.string()),
      collectionGroups: v.array(v.string()),
      catalogedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const collections = (
      await batchGetByIds(ctx, args.collectionIds, "collections")
    ).filter(
      (collection): collection is Doc<"collections"> => collection !== null,
    );
    const organizationIdSet = new Set<Id<"organizations">>();
    for (const collection of collections) {
      organizationIdSet.add(collection.organizationId);
    }
    const organizationIds = Array.from(organizationIdSet);
    await Promise.all(
      organizationIds.map((organizationId) =>
        requirePermission(ctx, organizationId, "collections.read"),
      ),
    );
    const organizationMap = createLookupMap<"organizations">(
      await batchGetByIds(ctx, organizationIds, "organizations"),
    );

    const memberships = await Promise.all(
      collections.map((collection) =>
        getCollectionGroupMembershipIds(ctx, collection),
      ),
    );
    const locationIds: Id<"locations">[] = [];
    const groupIds: Id<"collectionGroups">[] = [];
    for (const collection of collections) {
      if (collection.currentLocationId) {
        locationIds.push(collection.currentLocationId);
      }
    }
    for (const membership of memberships) groupIds.push(...membership.groupIds);
    const locationPathMap = await getLocationPathStrings(ctx, locationIds);
    const groupMap = createLookupMap<"collectionGroups">(
      await batchGetByIds(ctx, groupIds, "collectionGroups"),
    );

    return collections.map((collection, index) => ({
      _id: collection._id,
      accessionNumber: collection.accessionNumber,
      title: collection.title,
      alternativeTitle: collection.alternativeTitle,
      creator: collection.creator,
      objectType: collection.objectType,
      objectName: collection.objectName,
      culture: collection.culture,
      period: collection.period,
      dateCreated: collection.dateCreated,
      materials: collection.materials,
      technique: collection.technique,
      dimensions: collection.dimensions,
      description: collection.description,
      condition: collection.condition,
      provenance: collection.provenance,
      numberOfObjects: collection.numberOfObjects,
      subjects: collection.subjects,
      completeness: collection.completeness,
      completenessNote: collection.completenessNote,
      dimensionMeasuredPart: collection.dimensionMeasuredPart,
      measurementSets: collection.measurementSets,
      rightsStatement: collection.rightsStatement,
      rightsStatementInEffect: rightsStatementInEffect(
        collection.rightsStatement,
        organizationMap.get(collection.organizationId)?.settings?.rightsDefaults
          ?.objectRightsStatement,
      ),
      status: collection.status,
      locationPath: collection.currentLocationId
        ? locationPathMap.get(collection.currentLocationId)
        : undefined,
      collectionGroup: memberships[index]?.primaryGroupId
        ? groupMap.get(memberships[index].primaryGroupId)?.name
        : undefined,
      collectionGroups:
        memberships[index]?.groupIds.flatMap((id) => {
          const name = groupMap.get(id)?.name;
          return name ? [name] : [];
        }) ?? [],
      catalogedAt: collection.catalogedAt,
    }));
  },
});

export const listPublic = query({
  args: {
    organizationSlug: v.string(),
    portalSlug: v.optional(v.string()),
    search: v.optional(v.string()),
    objectType: v.optional(v.string()),
    culture: v.optional(v.string()),
    period: v.optional(v.string()),
    paginationOpts: v.optional(paginationOptsValidator),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    items: v.array(
      v.object({
        _id: v.string(),
        urlSlug: v.string(),
        accessionNumber: v.string(),
        title: v.string(),
        creator: v.optional(v.string()),
        objectType: v.optional(v.string()),
        culture: v.optional(v.string()),
        period: v.optional(v.string()),
        dateCreated: v.optional(v.string()),
        materials: v.optional(v.string()),
        dimensions: v.optional(v.string()),
        description: v.optional(v.string()),
        creditLine: v.optional(v.string()),
        /** The Object's statement in effect: its own or the default. */
        rightsStatement: v.optional(rightsStatementValidator),
        primaryImageUrl: v.optional(v.string()),
        /** The statement in effect for the image shown. */
        primaryImageRightsStatement: v.optional(rightsStatementValidator),
      }),
    ),
    nextCursor: v.optional(v.string()),
    hasMore: v.boolean(),
    portalStatus: v.union(
      v.literal("ok"),
      v.literal("org_not_found"),
      v.literal("portal_disabled"),
      v.literal("portal_slug_mismatch"),
    ),
  }),
  handler: async (ctx, args) => {
    const { organization, hasOrganization, hasEnabledPortal } =
      await findPublicPortalOrganization(
        ctx,
        args.organizationSlug,
        args.portalSlug,
      );

    if (!organization) {
      return {
        items: [],
        nextCursor: undefined,
        hasMore: false,
        portalStatus: !hasOrganization
          ? ("org_not_found" as const)
          : hasEnabledPortal
            ? ("portal_slug_mismatch" as const)
            : ("portal_disabled" as const),
      };
    }

    if (!organization.settings?.portalSettings?.isEnabled) {
      return {
        items: [],
        nextCursor: undefined,
        hasMore: false,
        portalStatus: "portal_disabled" as const,
      };
    }

    const pageSize = args.paginationOpts?.numItems ?? args.limit ?? 24;
    const rightsDefaults = organization.settings?.rightsDefaults;
    const [allCollections, allLibraryItems] = await Promise.all([
      getPublicCatalogCollections(ctx, organization._id),
      getPublicLibraryCatalogItems(ctx, organization),
    ] as const);

    const collectionEntries = allCollections.map((collection) => ({
      source: "collection" as const,
      item: collection,
      searchableText: [
        collection.title,
        collection.creator,
        collection.accessionNumber,
      ],
      objectType: collection.objectType,
      culture: collection.culture,
      period: collection.period,
      isSearchable: collection.isSearchable,
    }));

    const libraryEntries = allLibraryItems.map((item) => ({
      source: "library" as const,
      item,
      searchableText: [
        item.title,
        item.subtitle,
        item.accessionNumber,
        item.callNumber,
        item.isbn,
        item.isbn13,
        ...item.authors,
      ],
      objectType: item.itemType,
      culture: item.language,
      period: item.publicationYear?.toString(),
      isSearchable: true,
    }));

    let filtered = [...collectionEntries, ...libraryEntries];

    if (args.search) {
      const searchLower = args.search.toLowerCase();
      filtered = filtered.filter(
        (entry) =>
          entry.isSearchable !== false &&
          entry.searchableText.some((value) =>
            value?.toLowerCase().includes(searchLower),
          ),
      );
    }

    if (args.objectType) {
      filtered = filtered.filter(
        (entry) => entry.objectType === args.objectType,
      );
    }
    if (args.culture) {
      filtered = filtered.filter((entry) => entry.culture === args.culture);
    }
    if (args.period) {
      filtered = filtered.filter((entry) => entry.period === args.period);
    }

    const cursor =
      args.paginationOpts?.cursor ?? (args.cursor ? args.cursor : null);
    const startIndex = cursor ? Number.parseInt(cursor, 10) : 0;
    const paged = filtered.slice(startIndex, startIndex + pageSize);
    const hasMore = startIndex + pageSize < filtered.length;

    const items = await Promise.all(
      paged.map(async (entry) => {
        if (entry.source === "library") {
          const item = entry.item;
          const primaryImageUrl = undefined;
          const accessionNumber =
            item.accessionNumber ?? item.callNumber ?? item.isbn13 ?? item.isbn;

          return {
            _id: item._id,
            urlSlug: `library-${item._id}`,
            accessionNumber: accessionNumber ?? item._id,
            title: item.subtitle
              ? `${item.title}: ${item.subtitle}`
              : item.title,
            creator:
              item.authors.length > 0 ? item.authors.join(", ") : undefined,
            objectType: item.itemType,
            culture: item.language,
            period: item.publicationYear?.toString(),
            dateCreated: item.publicationYear?.toString(),
            materials: item.format,
            dimensions: item.dimensions,
            description: item.summary ?? item.description,
            creditLine: item.publisher,
            primaryImageUrl,
          };
        }

        const c = entry.item;
        const mediaFiles = await ctx.db
          .query("mediaFiles")
          .withIndex("by_collection", (q) => q.eq("collectionId", c._id))
          .collect();
        const approved = await Promise.all(
          mediaFiles.map((media) =>
            getPortalImage(ctx, media, organization._id, c._id),
          ),
        );
        const primaryImage =
          approved.find((image) => image?.isPrimary) ?? approved.find(Boolean);
        const primaryImageMedia = mediaFiles.find(
          (media) => media._id === primaryImage?._id,
        );

        return {
          _id: c._id,
          urlSlug: c.publicSlug || c.accessionNumber,
          accessionNumber: c.accessionNumber,
          title: c.title,
          creator: c.creator,
          objectType: c.objectType,
          culture: c.culture,
          period: c.period,
          dateCreated: c.dateCreated,
          materials: c.materials,
          dimensions: c.dimensions,
          description: c.description,
          creditLine: c.creditLine,
          rightsStatement: rightsStatementInEffect(
            c.rightsStatement,
            rightsDefaults?.objectRightsStatement,
          ),
          primaryImageUrl: primaryImage?.url,
          primaryImageRightsStatement: primaryImageMedia
            ? rightsStatementInEffect(
                primaryImageMedia.rightsStatement,
                rightsDefaults?.mediaRightsStatement,
              )
            : undefined,
        };
      }),
    );

    return {
      items,
      nextCursor: hasMore ? String(startIndex + pageSize) : undefined,
      hasMore,
      portalStatus: "ok" as const,
    };
  },
});

export const getPublic = query({
  args: {
    organizationSlug: v.string(),
    portalSlug: v.optional(v.string()),
    accessionNumber: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.string(),
      accessionNumber: v.string(),
      title: v.string(),
      alternativeTitle: v.optional(v.string()),
      creator: v.optional(v.string()),
      objectType: v.optional(v.string()),
      objectName: v.optional(v.string()),
      culture: v.optional(v.string()),
      period: v.optional(v.string()),
      dateCreated: v.optional(v.string()),
      materials: v.optional(v.string()),
      technique: v.optional(v.string()),
      dimensions: v.optional(v.string()),
      description: v.optional(v.string()),
      inscriptions: v.optional(v.string()),
      provenance: v.optional(v.string()),
      exhibitionHistory: v.optional(v.string()),
      creditLine: v.optional(v.string()),
      /** The Object's statement in effect: its own or the default. */
      rightsStatement: v.optional(rightsStatementValidator),
      tags: v.optional(v.array(v.string())),
      isHighResDownloadable: v.optional(v.boolean()),
      valuation: v.optional(
        v.object({
          appraisedValue: v.optional(v.number()),
          replacementValue: v.optional(v.number()),
          lastAppraisalDate: v.optional(v.number()),
          appraiser: v.optional(v.string()),
        }),
      ),
      images: v.array(
        v.object({
          _id: v.string(),
          url: v.string(),
          isPrimary: v.boolean(),
          caption: v.optional(v.string()),
          originalDownloadUrl: v.optional(v.string()),
          /** The image's statement in effect: its own or the default. */
          rightsStatement: v.optional(rightsStatementValidator),
        }),
      ),
      organizationName: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const { organization } = await findPublicPortalOrganization(
      ctx,
      args.organizationSlug,
      args.portalSlug,
    );

    if (!organization) {
      return null;
    }

    if (!organization.settings?.portalSettings?.isEnabled) {
      return null;
    }

    let collection = await ctx.db
      .query("collections")
      .withIndex("by_organization_and_accessionNumber", (q) =>
        q
          .eq("organizationId", organization._id)
          .eq("accessionNumber", args.accessionNumber),
      )
      .unique();

    if (!collection) {
      collection = await ctx.db
        .query("collections")
        .withIndex("by_organization_and_publicSlug", (q) =>
          q
            .eq("organizationId", organization._id)
            .eq("publicSlug", args.accessionNumber),
        )
        .unique();
    }

    if (!collection) {
      const publicLibraryItems = await getPublicLibraryCatalogItems(
        ctx,
        organization,
      );
      const libraryItem = publicLibraryItems.find(
        (item) =>
          `library-${item._id}` === args.accessionNumber ||
          item.accessionNumber === args.accessionNumber ||
          item.callNumber === args.accessionNumber ||
          item.isbn13 === args.accessionNumber ||
          item.isbn === args.accessionNumber,
      );

      if (!libraryItem) {
        return null;
      }

      const accessionNumber =
        libraryItem.accessionNumber ??
        libraryItem.callNumber ??
        libraryItem.isbn13 ??
        libraryItem.isbn;

      return {
        _id: libraryItem._id,
        accessionNumber: accessionNumber ?? libraryItem._id,
        title: libraryItem.title,
        alternativeTitle: libraryItem.subtitle,
        creator:
          libraryItem.authors.length > 0
            ? libraryItem.authors.join(", ")
            : undefined,
        objectType: libraryItem.itemType,
        objectName: libraryItem.format,
        culture: libraryItem.language,
        period: libraryItem.publicationYear?.toString(),
        dateCreated: libraryItem.publicationYear?.toString(),
        materials: libraryItem.publisher,
        dimensions: libraryItem.dimensions,
        description: libraryItem.summary ?? libraryItem.description,
        creditLine: libraryItem.publisher,
        tags: [
          ...(libraryItem.categories ?? []),
          ...(libraryItem.genres ?? []),
          ...(libraryItem.subjects ?? []),
        ],
        images: [],
        organizationName: organization.name,
      };
    }

    if (
      !collection.isPubliclyVisible ||
      !isPublicCatalogStatus(collection.status)
    ) {
      return null;
    }

    const mediaFiles = await ctx.db
      .query("mediaFiles")
      .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
      .collect();

    const rightsDefaults = organization.settings?.rightsDefaults;
    const images = await Promise.all(
      mediaFiles.map(async (media) => {
        const image = await getPortalImage(
          ctx,
          media,
          organization._id,
          collection._id,
        );
        return (
          image && {
            ...image,
            rightsStatement: rightsStatementInEffect(
              media.rightsStatement,
              rightsDefaults?.mediaRightsStatement,
            ),
          }
        );
      }),
    );

    let valuation:
      | {
          appraisedValue?: number;
          replacementValue?: number;
          lastAppraisalDate?: number;
          appraiser?: string;
        }
      | undefined;

    if (collection.isValuationVisible) {
      const fineArtDetails = await ctx.db
        .query("fineArtDetails")
        .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
        .unique();

      if (fineArtDetails) {
        valuation = {
          appraisedValue: fineArtDetails.appraisedValue,
          replacementValue: fineArtDetails.replacementValue,
          lastAppraisalDate: fineArtDetails.lastAppraisalDate,
          appraiser: fineArtDetails.appraiser,
        };
      }
    }

    return {
      _id: collection._id,
      accessionNumber: collection.accessionNumber,
      title: collection.title,
      alternativeTitle: collection.alternativeTitle,
      creator: collection.creator,
      objectType: collection.objectType,
      objectName: collection.objectName,
      culture: collection.culture,
      period: collection.period,
      dateCreated: collection.dateCreated,
      materials: collection.materials,
      technique: collection.technique,
      dimensions: collection.dimensions,
      description: collection.description,
      inscriptions: collection.inscriptions,
      provenance: collection.provenance,
      exhibitionHistory: collection.exhibitionHistory,
      creditLine: collection.creditLine,
      rightsStatement: rightsStatementInEffect(
        collection.rightsStatement,
        rightsDefaults?.objectRightsStatement,
      ),
      tags: collection.tags,
      isHighResDownloadable: images.some((image) => image?.originalDownloadUrl),
      valuation,
      images: images.filter((i): i is NonNullable<typeof i> => i !== null),
      organizationName: organization.name,
    };
  },
});

export const getPublicFilters = query({
  args: {
    organizationSlug: v.string(),
    portalSlug: v.optional(v.string()),
  },
  returns: v.object({
    objectTypes: v.array(v.string()),
    cultures: v.array(v.string()),
    periods: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const { organization } = await findPublicPortalOrganization(
      ctx,
      args.organizationSlug,
      args.portalSlug,
    );

    if (!organization) {
      return { objectTypes: [], cultures: [], periods: [] };
    }

    if (!organization.settings?.portalSettings?.isEnabled) {
      return { objectTypes: [], cultures: [], periods: [] };
    }

    const [collections, libraryItems] = await Promise.all([
      getPublicCatalogCollections(ctx, organization._id),
      getPublicLibraryCatalogItems(ctx, organization),
    ] as const);

    const objectTypes = [
      ...new Set([
        ...collections.flatMap((collection) =>
          collection.objectType ? [collection.objectType] : [],
        ),
        ...libraryItems.flatMap((item) =>
          item.itemType ? [item.itemType] : [],
        ),
      ]),
    ] as string[];
    const cultures = [
      ...new Set([
        ...collections.flatMap((collection) =>
          collection.culture ? [collection.culture] : [],
        ),
        ...libraryItems.flatMap((item) =>
          item.language ? [item.language] : [],
        ),
      ]),
    ] as string[];
    const periods = [
      ...new Set([
        ...collections.flatMap((collection) =>
          collection.period ? [collection.period] : [],
        ),
        ...libraryItems.flatMap((item) => {
          const publicationYear = item.publicationYear?.toString();
          return publicationYear ? [publicationYear] : [];
        }),
      ]),
    ] as string[];

    return {
      objectTypes: objectTypes.sort(),
      cultures: cultures.sort(),
      periods: periods.sort(),
    };
  },
});

export const listPublicForSitemap = query({
  args: {},
  returns: v.array(
    v.object({
      organizationSlug: v.string(),
      urlSlug: v.string(),
      title: v.string(),
      lastModifiedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    const organizations = await ctx.db.query("organizations").collect();

    const results: {
      organizationSlug: string;
      urlSlug: string;
      title: string;
      lastModifiedAt?: number;
    }[] = [];

    await Promise.all(
      Array.from(organizations).map(async (org) => {
        if (!org.settings?.portalSettings?.isEnabled) {
          return;
        }

        const publicCollections = await getPublicCatalogCollections(
          ctx,
          org._id,
        );

        for (const c of publicCollections) {
          results.push({
            organizationSlug: org.slug,
            urlSlug: c.publicSlug || c.accessionNumber,
            title: c.title,
            lastModifiedAt: c.lastModifiedAt,
          });
        }
      }),
    );

    return results;
  },
});
