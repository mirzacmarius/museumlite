import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { classifyInventoryRecord } from "./collectionMetrics";
import { normalizeCurrency } from "./currency";
import { getExhibitionLifecycle } from "./exhibitionMetrics";
import { coverageTarget, needsTargetReview } from "./insuranceCoverage";
import {
  distinctScope,
  type ProjectionFact,
  type ProjectionGeneration,
  readTotals,
} from "./projectionStore";
import {
  appraisalExpiresAt,
  INSURANCE_APPRAISAL_MAX_AGE_MS,
} from "./valuation";

/** Active coverage value per currency: `insurance.coveredValue.<ISO code>`. */
export const COVERED_VALUE_METRIC_PREFIX = "insurance.coveredValue.";

type ParentPhase = {
  table: "loanItems" | "collectionGroupItems";
  parent: "loans" | "collectionGroups";
};

/**
 * Source phases in rebuild order. Association sources come before
 * collections, and collections before locations, because collection and
 * location vectors read association and occupancy totals.
 */
export const PROJECTION_PHASES = [
  "loans",
  "loanItems",
  "deaccessions",
  "collectionGroups",
  "collectionGroupItems",
  "mediaFiles",
  "mediaVersions",
  "insuranceCoverages",
  "accessions",
  "objectEntries",
  "collections",
  "locations",
  "exhibitions",
  "organizationMoveRequests",
  "auditLog",
  "fineArtDetails",
  "wineDetails",
  "vehicleDetails",
  "conservationTreatments",
  "assessmentSchedules",
  "insurancePolicies",
  "insuranceClaims",
  "appraisals",
  "userOrganizations",
  "exportJobs",
] as const;

export type ProjectionSource = (typeof PROJECTION_PHASES)[number];
export type ProjectionSourceDoc = Doc<ProjectionSource>;

export const CHILD_PHASES: Partial<Record<ProjectionSource, ParentPhase>> = {
  loanItems: { table: "loanItems", parent: "loans" },
  collectionGroupItems: {
    table: "collectionGroupItems",
    parent: "collectionGroups",
  },
};

export function phaseIndexOf(table: string) {
  return PROJECTION_PHASES.indexOf(table as ProjectionSource);
}

type ReadCtx = Pick<QueryCtx, "db">;

export const objectScope = (id: string) => `object:${id}`;
export const locationScope = (id: string) => `location:${id}`;
export const siteScope = (id: string) => `site:${id}`;
export const groupScope = (id: string) => `group:${id}`;

export async function sourceOrganization(
  ctx: ReadCtx,
  table: ProjectionSource,
  doc: ProjectionSourceDoc,
): Promise<Id<"organizations"> | null> {
  if (table === "loanItems") {
    const loan = await ctx.db.get((doc as Doc<"loanItems">).loanId);
    return loan?.organizationId ?? null;
  }
  if (table === "collectionGroupItems") {
    const group = await ctx.db.get(
      (doc as Doc<"collectionGroupItems">).collectionGroupId,
    );
    return group?.organizationId ?? null;
  }
  if (table === "organizationMoveRequests") {
    return (doc as Doc<"organizationMoveRequests">).sourceOrganizationId;
  }
  return (doc as { organizationId: Id<"organizations"> }).organizationId;
}

interface ObjectPlacement {
  object: Doc<"collections">;
  siteId?: Id<"sites">;
}

async function placeObject(
  ctx: ReadCtx,
  organizationId: Id<"organizations">,
  collectionId: Id<"collections"> | undefined,
): Promise<ObjectPlacement | null> {
  if (!collectionId) return null;
  const object = await ctx.db.get(collectionId);
  if (!object || object.organizationId !== organizationId) return null;
  if (!object.currentLocationId) return { object };
  const location = await ctx.db.get(object.currentLocationId);
  if (!location || location.organizationId !== organizationId) {
    return { object };
  }
  return { object, siteId: location.siteId };
}

function conditionBucket(condition: string | undefined) {
  const normalized = condition?.toLowerCase();
  if (normalized === "excellent" || normalized === "good") return "good";
  if (normalized === "fair") return "fair";
  if (normalized === "poor" || normalized === "critical") return "poor";
  return "unknown";
}

async function storageSize(ctx: ReadCtx, storageId: Id<"_storage">) {
  return (await ctx.db.system.get(storageId))?.size;
}

/**
 * Computes the finite contribution vector of one source row from its current
 * authoritative graph. The vector is bounded by the table's case below.
 */
export async function computeSourceFacts(
  ctx: ReadCtx,
  generation: ProjectionGeneration,
  table: ProjectionSource,
  doc: ProjectionSourceDoc,
): Promise<ProjectionFact[]> {
  const organizationId = generation.organizationId;
  const facts: ProjectionFact[] = [];
  const add = (metric: string, value = 1, scope = "all") => {
    facts.push({ metric, scope, value });
  };
  const dated = (
    metric: string,
    at: number | undefined,
    value = 1,
    scope = "all",
    order = 0,
  ) => {
    if (at === undefined || !Number.isFinite(at)) return;
    facts.push({ metric, scope, value, at, order });
  };

  switch (table) {
    case "loans": {
      const loan = doc as Doc<"loans">;
      add("loans.total");
      add(`loans.${loan.status}`);
      add(`loans.${loan.type}`);
      dated("loans.startDate", loan.startDate);
      if (loan.status === "active")
        dated("loans.active.created", loan._creationTime);
      if (loan.status === "returned") {
        dated("loans.returned.startDate", loan.startDate);
        if (loan.endDate) {
          add("loans.returned.withEnd");
          add("loans.returned.durationSum", loan.endDate - loan.startDate);
        }
      }
      if (loan.status === "active" || loan.status === "dispatched") {
        add("loans.open");
        dated("loans.open.startDate", loan.startDate);
        if (loan.endDate !== undefined) {
          dated("loans.open.endDate", loan.endDate);
          const endsAfterStart = loan.endDate >= loan.startDate;
          dated(
            "loans.open.overdueKey",
            endsAfterStart ? loan.endDate : loan.startDate,
            1,
            "all",
            endsAfterStart ? 1 : 0,
          );
        }
      }
      break;
    }
    case "loanItems": {
      const item = doc as Doc<"loanItems">;
      const loan = await ctx.db.get(item.loanId);
      const placement = await placeObject(
        ctx,
        organizationId,
        item.collectionId,
      );
      if (!loan || loan.organizationId !== organizationId || !placement) {
        add("quality.missing_reference");
        break;
      }
      add(loan.type, 1, objectScope(item.collectionId));
      if (placement.siteId) {
        add(
          "refs",
          1,
          distinctScope(
            siteScope(placement.siteId),
            {
              "loans.total": 1,
              [`loans.${loan.status}`]: 1,
              [`loans.${loan.type}`]: 1,
            },
            loan._id,
          ),
        );
      }
      break;
    }
    case "deaccessions": {
      const deaccession = doc as Doc<"deaccessions">;
      add("deaccessions.total");
      add(`deaccessions.${deaccession.status}`);
      if (deaccession.status === "approved") {
        dated("deaccessions.approvedAt", deaccession.approvedAt);
      }
      const placement = await placeObject(
        ctx,
        organizationId,
        deaccession.collectionId,
      );
      if (!placement) {
        add("quality.missing_reference");
        break;
      }
      if (
        deaccession.status === "pending" ||
        deaccession.status === "approved"
      ) {
        add("openDeaccession", 1, objectScope(deaccession.collectionId));
      }
      if (placement.siteId) {
        add(
          `deaccessions.${deaccession.status}`,
          1,
          siteScope(placement.siteId),
        );
      }
      break;
    }
    case "collectionGroups":
      add("collections.total");
      break;
    case "collectionGroupItems": {
      const item = doc as Doc<"collectionGroupItems">;
      const group = await ctx.db.get(item.collectionGroupId);
      const placement = await placeObject(
        ctx,
        organizationId,
        item.collectionId,
      );
      if (!group || group.organizationId !== organizationId || !placement) {
        add("quality.missing_reference");
        break;
      }
      add(
        "refs",
        1,
        distinctScope(groupScope(group._id), { items: 1 }, item.collectionId),
      );
      if (placement.siteId) {
        add(
          "refs",
          1,
          distinctScope(
            siteScope(placement.siteId),
            { "collections.total": 1 },
            group._id,
          ),
        );
      }
      break;
    }
    case "mediaFiles": {
      const media = doc as Doc<"mediaFiles">;
      add("usage.mediaFileCount");
      add("usage.mediaFileSize", media.fileSize);
      add("count", 1, `mediaType:${media.fileType}`);
      dated("media.uploaded", media.uploadedAt);
      dated("media.licenseExpiry", media.licenseExpiry);
      if (!media.rightsStatus || media.rightsStatus === "unknown") {
        add("media.unknownRights");
      }
      if (await placeObject(ctx, organizationId, media.collectionId)) {
        add("media", 1, objectScope(media.collectionId));
      } else {
        add("quality.missing_reference");
      }
      let typeBytes = 0;
      for (const storageId of [media.storageId, media.thumbnailStorageId]) {
        if (!storageId) continue;
        typeBytes += (await storageSize(ctx, storageId)) ?? 0;
      }
      add("bytes", typeBytes, `mediaType:${media.fileType}`);
      const storageIds = new Set(
        [
          media.storageId,
          media.thumbnailStorageId,
          media.publicApproval?.renditionStorageId,
        ].filter((id): id is Id<"_storage"> => id !== undefined),
      );
      for (const storageId of storageIds) {
        const size = await storageSize(ctx, storageId);
        if (size === undefined) add("quality.missing_storage");
        else
          add(
            "refs",
            1,
            distinctScope("all", { "usage.storageBytes": size }, storageId),
          );
      }
      break;
    }
    case "mediaVersions": {
      const version = doc as Doc<"mediaVersions">;
      add("usage.mediaVersionCount");
      const size = await storageSize(ctx, version.storageId);
      if (size === undefined) add("quality.missing_storage");
      else
        add(
          "refs",
          1,
          distinctScope(
            "all",
            { "usage.storageBytes": size },
            version.storageId,
          ),
        );
      break;
    }
    case "insuranceCoverages": {
      const coverage = doc as Doc<"insuranceCoverages">;
      if (coverage.status !== "active") break;
      if (needsTargetReview(coverage)) {
        add("insurance.coverages.needsReview");
        break;
      }
      const target = coverageTarget(coverage);
      if (!target) break;
      const currency = normalizeCurrency(coverage.currency);
      if (currency) {
        add(`${COVERED_VALUE_METRIC_PREFIX}${currency}`, coverage.coveredValue);
      } else {
        add("insurance.coverages.currencyNotRecorded");
      }
      if (
        target.kind === "object" &&
        (await placeObject(ctx, organizationId, target.collectionId))
      ) {
        add("coverage", 1, objectScope(target.collectionId));
      }
      break;
    }
    case "accessions": {
      const accession = doc as Doc<"accessions">;
      add("accessions.total");
      add(`accessions.${accession.status}`);
      if (accession.status === "approved") {
        dated("accessions.approvedAt", accession.approvedAt);
      }
      if (accession.status === "pending") {
        dated("accessions.pending.created", accession._creationTime);
      }
      const placement = await placeObject(
        ctx,
        organizationId,
        accession.collectionId,
      );
      if (placement?.siteId) {
        add(`accessions.${accession.status}`, 1, siteScope(placement.siteId));
      }
      break;
    }
    case "objectEntries": {
      const entry = doc as Doc<"objectEntries">;
      if (!(await placeObject(ctx, organizationId, entry.collectionId))) {
        add("quality.missing_reference");
        break;
      }
      // Held without title until accessioned, like property on loan in.
      if (entry.status !== "accessioned")
        add("incoming", 1, objectScope(entry.collectionId));
      break;
    }
    case "collections": {
      const object = doc as Doc<"collections">;
      const associations = await readTotals(
        ctx,
        generation._id,
        objectScope(object._id),
      );
      const location = object.currentLocationId
        ? await ctx.db.get(object.currentLocationId)
        : null;
      const locationInOrg =
        location !== null && location.organizationId === organizationId;
      const siteId = locationInOrg ? location.siteId : undefined;
      const inventory = classifyInventoryRecord({
        status: object.status,
        hasOpenDeaccession: (associations.openDeaccession ?? 0) > 0,
        linkedToIncomingLoan: (associations.incoming ?? 0) > 0,
        linkedToOutgoingLoan: (associations.outgoing ?? 0) > 0,
      });
      add("usage.objectCount");
      dated("objects.created", object._creationTime);
      if (object.status === "loaned") {
        dated("objects.loaned.created", object._creationTime);
      }
      for (const scope of siteId ? ["all", siteScope(siteId)] : ["all"]) {
        add(`objects.${object.status}`, 1, scope);
        add(`inventory.${inventory}`, 1, scope);
        if (inventory === "owned") {
          add(`inventory.status.${object.status}`, 1, scope);
          if (
            object.status === "active" &&
            object.displayStatus === "on_display"
          ) {
            add("inventory.onDisplay", 1, scope);
          }
        }
      }
      if (object.status !== "deaccessioned") {
        add("health.objects");
        add(`health.condition.${conditionBucket(object.condition)}`);
        if (object.currentLocationId) add("health.withLocation");
        if ((associations.media ?? 0) > 0) add("health.withMedia");
        if ((associations.coverage ?? 0) > 0) add("health.withCoverage");
        if (locationInOrg) add("occupied", 1, locationScope(location._id));
      }
      if (object.currentLocationId && !locationInOrg) {
        add("quality.missing_reference");
      }
      if (object.collectionGroupId) {
        const group = await ctx.db.get(object.collectionGroupId);
        if (group?.organizationId === organizationId) {
          add(
            "refs",
            1,
            distinctScope(groupScope(group._id), { items: 1 }, object._id),
          );
        }
      }
      if (inventory === "unclassified") add("quality.inventory_unclassified");
      break;
    }
    case "locations": {
      const location = doc as Doc<"locations">;
      add("locations.total");
      if (location.siteId)
        add("locations.total", 1, siteScope(location.siteId));
      if (!location.isActive) break;
      const typeScope = `locationType:${location.type}`;
      add("locations.active");
      add("total", 1, typeScope);
      if (location.capacity === undefined || location.capacity <= 0) break;
      const occupied =
        (await readTotals(ctx, generation._id, locationScope(location._id)))
          .occupied ?? 0;
      add("capacity", location.capacity, locationScope(location._id));
      add("locations.withCapacity");
      add("locations.capacity", location.capacity);
      add("locations.occupied", occupied);
      add("withCapacity", 1, typeScope);
      add("capacity", location.capacity, typeScope);
      add("occupied", occupied, typeScope);
      if (occupied >= location.capacity) add("locations.atCapacity");
      if (occupied > location.capacity) add("locations.overCapacity");
      break;
    }
    case "exhibitions": {
      const exhibition = doc as Doc<"exhibitions">;
      if (exhibition.isLoan === true) {
        add("exhibitions.excludedLoans");
        break;
      }
      const lifecycle = getExhibitionLifecycle(exhibition.status);
      add("exhibitions.total");
      add(`exhibitions.${lifecycle}`);
      if (lifecycle === "unclassified") add("quality.exhibition_unclassified");
      if (exhibition.isCurrent) add("exhibitions.flagTrue");
      const start = exhibition.startDate;
      const end = exhibition.endDate;
      const endKey =
        end === undefined
          ? undefined
          : end >= start
            ? { at: end, order: 1 }
            : { at: start, order: 0 };
      dated("exhibitions.started", start);
      const series = exhibition.isCurrent
        ? ["exhibitions.current", "exhibitions.currentFlagTrue"]
        : ["exhibitions.current"];
      for (const metric of series) {
        dated(metric, start, 1);
        if (endKey) dated(metric, endKey.at, -1, "all", endKey.order);
      }
      break;
    }
    case "organizationMoveRequests": {
      const request = doc as Doc<"organizationMoveRequests">;
      add(`transfers.${request.status}`);
      break;
    }
    case "auditLog": {
      const entry = doc as Doc<"auditLog">;
      const typeScope = `auditType:${entry.entityType}`;
      const userScope = `auditUser:${entry.userId}`;
      add("audit.total");
      dated("audit.timestamp", entry.timestamp);
      add("total", 1, typeScope);
      dated("audit.timestamp", entry.timestamp, 1, typeScope);
      add("total", 1, userScope);
      dated("audit.timestamp", entry.timestamp, 1, userScope);
      break;
    }
    case "fineArtDetails": {
      const detail = doc as Doc<"fineArtDetails">;
      add("valuation.fineArt.count");
      if (detail.appraisedValue != null) add("valuation.fineArt.valued");
      break;
    }
    case "wineDetails": {
      const detail = doc as Doc<"wineDetails">;
      add("valuation.wine.count");
      if (detail.currentValue != null) add("valuation.wine.valued");
      break;
    }
    case "vehicleDetails": {
      const detail = doc as Doc<"vehicleDetails">;
      add("valuation.vehicles.count");
      if (detail.insuranceValue != null) add("valuation.vehicles.valued");
      break;
    }
    case "conservationTreatments": {
      const treatment = doc as Doc<"conservationTreatments">;
      add(`treatments.${treatment.status ?? "unclassified"}`);
      dated("treatments.performed", treatment.performedAt);
      if (treatment.status === "completed") {
        dated("treatments.completed", treatment.performedAt);
        const cost =
          (treatment.materialsCost ?? 0) +
          (treatment.laborHours ?? 0) * (treatment.laborRate ?? 0);
        dated("treatments.completedCost", treatment.performedAt, cost);
      }
      break;
    }
    case "assessmentSchedules": {
      const schedule = doc as Doc<"assessmentSchedules">;
      if (schedule.isActive) dated("assessments.due", schedule.nextDueDate);
      break;
    }
    case "insurancePolicies": {
      const policy = doc as Doc<"insurancePolicies">;
      if (policy.status === "active") {
        dated("insurance.expiration", policy.expirationDate);
      }
      break;
    }
    case "insuranceClaims": {
      const claim = doc as Doc<"insuranceClaims">;
      if (claim.status === "submitted" || claim.status === "under_review") {
        add("insurance.claims.pending");
      }
      break;
    }
    case "appraisals": {
      const appraisal = doc as Doc<"appraisals">;
      if (
        appraisal.appraisalType === "insurance" &&
        appraisal.isCurrentValuation === true &&
        appraisal.supersededBy === undefined
      ) {
        dated(
          "appraisals.currentInsurance.staleAt",
          appraisalExpiresAt(appraisal, INSURANCE_APPRAISAL_MAX_AGE_MS),
        );
      }
      break;
    }
    case "userOrganizations":
      add("usage.users");
      break;
    case "exportJobs": {
      const job = doc as Doc<"exportJobs">;
      add(`exports.${job.status}`);
      if (job.status === "completed") {
        dated("exports.completedAt", job.completedAt);
        add("exports.artifactBytes", job.bytes);
      }
      break;
    }
  }
  return facts;
}

/**
 * Source rows whose vectors read projection totals written by this change.
 */
export function dependentsFromFacts(facts: ProjectionFact[]) {
  const dependents: Array<{ table: ProjectionSource; id: string }> = [];
  for (const fact of facts) {
    if (fact.scope.startsWith("object:")) {
      dependents.push({ table: "collections", id: fact.scope.slice(7) });
    } else if (
      fact.scope.startsWith("location:") &&
      fact.metric === "occupied"
    ) {
      dependents.push({ table: "locations", id: fact.scope.slice(9) });
    }
  }
  return dependents;
}

/**
 * Fields that other source vectors read from this row. A change to one of
 * these fields requires refreshing the listed relations.
 */
export function relationFanOut(
  table: ProjectionSource,
  oldDoc: ProjectionSourceDoc | null,
  newDoc: ProjectionSourceDoc | null,
): Array<
  | { kind: "loanItemsByLoan"; id: Id<"loans"> }
  | { kind: "objectRelations"; id: Id<"collections"> }
  | {
      kind: "objectsByLocation";
      id: Id<"locations">;
      organizationId: Id<"organizations">;
    }
  | { kind: "groupItemsByGroup"; id: Id<"collectionGroups"> }
> {
  const before = oldDoc as Record<string, unknown> | null;
  const after = newDoc as Record<string, unknown> | null;
  const changed = (...fields: string[]) =>
    before === null ||
    after === null ||
    fields.some((field) => before[field] !== after[field]);
  const id = (newDoc ?? oldDoc)?._id;
  if (!id) return [];
  switch (table) {
    case "loans":
      return changed("type", "status", "organizationId")
        ? [{ kind: "loanItemsByLoan", id: id as Id<"loans"> }]
        : [];
    case "collections":
      return changed("currentLocationId", "organizationId", "status")
        ? [{ kind: "objectRelations", id: id as Id<"collections"> }]
        : [];
    case "locations": {
      if (!changed("siteId", "organizationId")) return [];
      const docs = [oldDoc, newDoc].filter(
        (doc): doc is Doc<"locations"> => doc !== null,
      );
      return docs.map((doc) => ({
        kind: "objectsByLocation" as const,
        id: doc._id,
        organizationId: doc.organizationId,
      }));
    }
    case "collectionGroups":
      return changed("organizationId")
        ? [{ kind: "groupItemsByGroup", id: id as Id<"collectionGroups"> }]
        : [];
    default:
      return [];
  }
}
