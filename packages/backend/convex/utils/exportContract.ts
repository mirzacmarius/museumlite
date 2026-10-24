import { v } from "convex/values";
import { catalogFiltersValidator } from "./catalogFilterValidators";
import { appraisalPurposeValidator } from "./valuation";

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
export const exportColumnType = v.union(
  v.literal("text"),
  v.literal("number"),
  v.literal("utcEpochMs"),
  v.literal("json"),
  v.literal("boolean"),
  v.literal("id"),
);
export const registerProfile = v.union(
  v.literal("accession"),
  v.literal("disposal"),
  v.literal("custody"),
  v.literal("condition"),
  v.literal("valuation"),
  v.literal("insurance"),
  v.literal("provenance"),
);
/** Each profile accepts only some of these (see `REGISTER_CRITERIA_FIELDS`). */
export const registerCriteria = v.object({
  fromDate: v.optional(v.number()),
  toDate: v.optional(v.number()),
  status: v.optional(
    v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
  ),
  asOf: v.optional(v.number()),
  objectId: v.optional(v.id("collections")),
  /** Appraisal purpose. */
  purpose: v.optional(appraisalPurposeValidator),
  /** ISO 4217 code, upper case. */
  currency: v.optional(v.string()),
  /** Operational inventory classification (`operational_inventory_v1`). */
  inventoryScope: v.optional(
    v.union(
      v.literal("owned"),
      v.literal("incoming"),
      v.literal("unclassified"),
    ),
  ),
  policyId: v.optional(v.id("insurancePolicies")),
});
export const exportSource = v.union(
  v.object({
    kind: v.literal("objects"),
    mode: v.union(v.literal("filtered"), v.literal("selected")),
    // The catalog's own filters, so a filtered export takes what the list takes.
    filters: catalogFiltersValidator,
  }),
  v.object({ kind: v.literal("audit"), filters: auditExportFilters }),
  v.object({
    kind: v.literal("register"),
    profile: registerProfile,
    criteria: registerCriteria,
  }),
);
/**
 * Exact monetary totals of a report's rows, per group and currency. A null
 * currency counts rows whose currency is missing or not recognised; their
 * amounts are not summed, so its total is null.
 */
export const registerTotalsValidator = v.array(
  v.object({
    group: v.array(v.union(v.string(), v.null())),
    currency: v.union(v.string(), v.null()),
    total: v.union(v.string(), v.null()),
    count: v.number(),
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
