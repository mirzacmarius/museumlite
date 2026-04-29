import { v } from "convex/values";

export const objectDraftLinkValidator = v.object({
  url: v.string(),
  label: v.optional(v.string()),
});

export const objectDraftOwnershipEntryValidator = v.object({
  owner: v.string(),
  startYear: v.optional(v.string()),
  endYear: v.optional(v.string()),
  description: v.optional(v.string()),
  verified: v.optional(v.boolean()),
  verificationSource: v.optional(v.string()),
});

export const objectDraftDataValidator = v.object({
  accessionNumber: v.optional(v.string()),
  title: v.string(),
  creator: v.optional(v.string()),
  objectType: v.optional(v.array(v.string())),
  objectName: v.optional(v.string()),
  culture: v.optional(v.string()),
  period: v.optional(v.string()),
  dateCreated: v.optional(v.string()),
  materials: v.optional(v.array(v.string())),
  dimensions: v.optional(v.string()),
  dimensionDiameter: v.optional(v.string()),
  dimensionWeight: v.optional(v.number()),
  weightUnit: v.optional(v.string()),
  description: v.optional(v.string()),
  condition: v.optional(v.string()),
  inscriptions: v.optional(v.string()),
  provenance: v.optional(v.string()),
  exhibitionHistory: v.optional(v.string()),
  donated_by: v.optional(v.array(v.string())),
  donated_date: v.optional(v.string()),
  donation_info: v.optional(v.string()),
  previous_owners: v.optional(v.array(v.string())),
  links: v.optional(v.array(objectDraftLinkValidator)),
  parentObjectId: v.optional(v.id("collections")),
  currentLocationId: v.optional(v.id("locations")),
  collectionGroupId: v.optional(v.id("collectionGroups")),
  alternateAccessionNumbers: v.optional(v.array(v.string())),
  ownershipHistory: v.optional(v.array(objectDraftOwnershipEntryValidator)),
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
  displayStatus: v.optional(v.string()),
  isPubliclyVisible: v.optional(v.boolean()),
  isHighResDownloadable: v.optional(v.boolean()),
  isSearchable: v.optional(v.boolean()),
  isValuationVisible: v.optional(v.boolean()),
  publicSlug: v.optional(v.string()),
});

export const accessionDraftMediaValidator = v.object({
  storageId: v.id("_storage"),
  fileName: v.string(),
  fileSize: v.number(),
  mimeType: v.string(),
  mediaCategory: v.union(v.literal("image"), v.literal("document")),
  isPrimary: v.boolean(),
});
