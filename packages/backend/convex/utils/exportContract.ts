import { v } from "convex/values";

export const objectExportFilters = v.object({
  search: v.optional(v.string()),
  inventoryMetricScope: v.optional(
    v.union(
      v.literal("owned"),
      v.literal("incoming"),
      v.literal("unclassified"),
    ),
  ),
  status: v.optional(
    v.union(
      v.literal("active"),
      v.literal("loaned"),
      v.literal("archived"),
      v.literal("deaccessioned"),
      v.literal("deleted"),
    ),
  ),
  objectType: v.optional(v.string()),
  displayStatus: v.optional(v.string()),
  culture: v.optional(v.string()),
  period: v.optional(v.string()),
  materials: v.optional(v.string()),
  catalogedFrom: v.optional(v.number()),
  catalogedTo: v.optional(v.number()),
  includeDeaccessioned: v.optional(v.boolean()),
  locationIds: v.optional(v.array(v.id("locations"))),
  collectionGroupId: v.optional(v.id("collectionGroups")),
});
export const auditExportFilters = v.object({
  userId: v.optional(v.id("users")),
  entityType: v.optional(v.string()),
  entityId: v.optional(v.string()),
  action: v.optional(v.string()),
  fromDate: v.optional(v.number()),
  toDate: v.optional(v.number()),
  objectId: v.optional(v.id("collections")),
  caseId: v.optional(v.string()),
});
export const registerProfile = v.union(
  v.literal("accession"),
  v.literal("disposal"),
  v.literal("custody"),
  v.literal("condition"),
);
export const registerCriteria = v.object({
  fromDate: v.optional(v.number()),
  toDate: v.optional(v.number()),
  status: v.optional(
    v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
  ),
  asOf: v.optional(v.number()),
  objectId: v.optional(v.id("collections")),
});
export const exportSource = v.union(
  v.object({
    kind: v.literal("objects"),
    mode: v.union(v.literal("filtered"), v.literal("selected")),
    filters: objectExportFilters,
  }),
  v.object({ kind: v.literal("audit"), filters: auditExportFilters }),
  v.object({
    kind: v.literal("register"),
    profile: registerProfile,
    criteria: registerCriteria,
  }),
);
export const exportStatus = v.union(
  v.literal("selecting"),
  v.literal("queued"),
  v.literal("running"),
  v.literal("finalizing"),
  v.literal("completed"),
  v.literal("cancelled"),
  v.literal("failed"),
  v.literal("expired"),
);
export const exportFormat = v.union(v.literal("csv"), v.literal("jsonl"));
export const MAX_EXPORT_BYTES = 16 * 1024 * 1024;
export const MAX_CHUNK_BYTES = 512 * 1024;
export const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
