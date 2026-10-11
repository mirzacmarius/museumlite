import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";
import {
  appendIncidentEvent,
  auditIncident,
  incidentObjectRows,
} from "./incidents";
import { displayName } from "./utils/caseTaskRules";
import {
  type IncidentViewer,
  requireOpen,
  requireVisibleIncident,
  requireWorker,
} from "./utils/incidentAccess";
import {
  type IncidentEvidenceReference,
  incidentEvidenceReferenceValidator,
} from "./utils/incidentValidators";
import { coverageStateAsOf } from "./utils/insuranceCoverage";
import { mutation } from "./utils/mutationBuilders";
import { requireCapability } from "./utils/permissions";
import { workError } from "./utils/workErrors";

/**
 * Records cited as incident evidence (ADR 0014). Links are retained: a
 * mistaken one is retracted with a reason and stays on the incident.
 */

const MAX_EVIDENCE = 100;
const MAX_REASON_LENGTH = 2000;
const PER_OBJECT = 5;
const CLAIM_SCAN = 100;
const COVERAGES_PER_OBJECT = 20;

function clip(value: string) {
  return value.length > 160 ? `${value.slice(0, 157)}...` : value;
}

/** Whether the viewer may read insurance records (module, plan and role). */
async function readsInsurance(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
) {
  try {
    await requireCapability(ctx, organizationId, "insurance", "loans.read");
    return true;
  } catch {
    return false;
  }
}

interface EvidenceAccess {
  media: boolean;
  insurance: boolean;
}

async function evidenceAccess(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  viewer: IncidentViewer,
): Promise<EvidenceAccess> {
  return {
    media: viewer.permissions.has("media.read"),
    insurance: await readsInsurance(ctx, organizationId),
  };
}

function canSee(
  access: EvidenceAccess,
  kind: IncidentEvidenceReference["kind"],
) {
  if (kind === "media") return access.media;
  if (kind === "insuranceClaim") return access.insurance;
  return true;
}

interface ResolvedEvidence {
  label: string;
  objectId?: Id<"collections">;
  recordedAt?: number;
}

/**
 * Validates a cited record: same organization, readable by the caller and,
 * for object records, about an object the incident affects.
 */
async function resolveEvidence(
  ctx: QueryCtx,
  incident: Doc<"incidents">,
  affected: ReadonlySet<Id<"collections">>,
  access: EvidenceAccess,
  reference: IncidentEvidenceReference,
): Promise<ResolvedEvidence> {
  const notFound = () =>
    workError("EVIDENCE_NOT_FOUND", "Evidence record not found");
  const requireAffected = (collectionId: Id<"collections"> | undefined) => {
    if (!collectionId || !affected.has(collectionId))
      throw workError(
        "OBJECT_NOT_AFFECTED",
        "Evidence must concern an object the incident affects",
      );
    return collectionId;
  };
  const objectTitle = async (collectionId: Id<"collections">) =>
    (await ctx.db.get(collectionId))?.title ?? "";
  if (!canSee(access, reference.kind)) throw notFound();
  switch (reference.kind) {
    case "conditionAssessment": {
      const row = await ctx.db.get(reference.id);
      if (
        !row ||
        row.organizationId !== incident.organizationId ||
        row.status !== "accepted"
      )
        throw notFound();
      const objectId = requireAffected(row.collectionId);
      return {
        label: clip(
          `${await objectTitle(objectId)} - ${row.condition}: ${row.summary}`,
        ),
        objectId,
        recordedAt: row.assessedAt,
      };
    }
    case "media": {
      const row = await ctx.db.get(reference.id);
      if (!row || row.organizationId !== incident.organizationId)
        throw notFound();
      const objectId = requireAffected(row.collectionId);
      return {
        label: clip(`${await objectTitle(objectId)} - ${row.fileName}`),
        objectId,
        recordedAt: row.uploadedAt,
      };
    }
    case "insuranceClaim": {
      const row = await ctx.db.get(reference.id);
      if (!row || row.organizationId !== incident.organizationId)
        throw notFound();
      return {
        label: `${row.claimNumber} (${row.status})`,
        recordedAt: row.reportedDate,
      };
    }
  }
}

async function evidenceRows(ctx: QueryCtx, incidentId: Id<"incidents">) {
  return await ctx.db
    .query("incidentEvidence")
    .withIndex("by_incident", (q) => q.eq("incidentId", incidentId))
    .take(MAX_EVIDENCE);
}

export const linkEvidence = mutation({
  args: {
    incidentId: v.id("incidents"),
    reference: incidentEvidenceReferenceValidator,
  },
  returns: v.id("incidentEvidence"),
  handler: async (ctx, args) => {
    const { incident, viewer } = await requireVisibleIncident(
      ctx,
      args.incidentId,
    );
    requireWorker(viewer);
    requireOpen(incident);
    const existing = await evidenceRows(ctx, incident._id);
    const duplicate = existing.find(
      (row) =>
        row.reference.kind === args.reference.kind &&
        row.reference.id === args.reference.id &&
        !row.retraction,
    );
    if (duplicate) return duplicate._id;
    if (existing.length >= MAX_EVIDENCE)
      throw workError("LIMIT_REACHED", "This incident has too much evidence");
    const affected = new Set(
      (await incidentObjectRows(ctx, incident._id)).map(
        (row) => row.collectionId,
      ),
    );
    const resolved = await resolveEvidence(
      ctx,
      incident,
      affected,
      await evidenceAccess(ctx, incident.organizationId, viewer),
      args.reference,
    );
    const evidenceId = await ctx.db.insert("incidentEvidence", {
      organizationId: incident.organizationId,
      incidentId: incident._id,
      reference: args.reference,
      ...resolved,
      linkedBy: viewer.userId,
      linkedAt: Date.now(),
    });
    await appendIncidentEvent(ctx, incident, viewer.userId, "evidence_linked", {
      objectId: resolved.objectId,
      value: args.reference.kind,
    });
    await auditIncident(
      ctx,
      incident,
      viewer.userId,
      "incident_evidence_linked",
      {
        evidenceKind: args.reference.kind,
      },
    );
    return evidenceId;
  },
});

export const retractEvidence = mutation({
  args: { evidenceId: v.id("incidentEvidence"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.evidenceId);
    if (!row) throw workError("EVIDENCE_NOT_FOUND", "Evidence not found");
    const { incident, viewer } = await requireVisibleIncident(
      ctx,
      row.incidentId,
    );
    requireWorker(viewer);
    requireOpen(incident);
    if (row.retraction) return null;
    const reason = args.reason.trim();
    if (!reason || reason.length > MAX_REASON_LENGTH)
      throw workError("INVALID_INPUT", "Give a reason for the retraction");
    await ctx.db.patch(row._id, {
      retraction: {
        reason,
        retractedBy: viewer.userId,
        retractedAt: Date.now(),
      },
    });
    await appendIncidentEvent(
      ctx,
      incident,
      viewer.userId,
      "evidence_retracted",
      { objectId: row.objectId, value: row.reference.kind, note: reason },
    );
    return null;
  },
});

/** Insurance coverage of the affected objects in force at discovery. */
async function coverageAtDiscovery(
  ctx: QueryCtx,
  incident: Doc<"incidents">,
  objects: Doc<"collections">[],
) {
  const rows: Array<{
    collectionId: Id<"collections">;
    objectTitle: string;
    policyNumber: string;
    carrier: string;
    coveredValue: number;
    currency?: string;
  }> = [];
  for (const object of objects) {
    const coverages = await ctx.db
      .query("insuranceCoverages")
      .withIndex("by_collection", (q) => q.eq("collectionId", object._id))
      .take(COVERAGES_PER_OBJECT);
    for (const coverage of coverages) {
      if (coverage.organizationId !== incident.organizationId) continue;
      const policy = await ctx.db.get(coverage.policyId);
      const owned =
        policy?.organizationId === incident.organizationId ? policy : null;
      if (
        !owned ||
        coverageStateAsOf(coverage, owned, incident.discoveredAt) !== "in_force"
      )
        continue;
      rows.push({
        collectionId: object._id,
        objectTitle: object.title,
        policyNumber: owned.policyNumber,
        carrier: owned.carrier,
        coveredValue: coverage.coveredValue,
        currency: coverage.currency ?? owned.currency,
      });
    }
  }
  return rows;
}

async function affectedObjects(ctx: QueryCtx, incident: Doc<"incidents">) {
  const rows = await incidentObjectRows(ctx, incident._id);
  const objects = await Promise.all(
    rows.map((row) => ctx.db.get(row.collectionId)),
  );
  return objects.flatMap((object) =>
    object && object.organizationId === incident.organizationId ? [object] : [],
  );
}

export const getEvidence = query({
  args: { incidentId: v.id("incidents") },
  returns: v.object({
    evidence: v.array(
      v.object({
        _id: v.id("incidentEvidence"),
        kind: v.union(
          v.literal("conditionAssessment"),
          v.literal("media"),
          v.literal("insuranceClaim"),
        ),
        recordId: v.string(),
        /** False when the viewer may not read this kind of record. */
        visible: v.boolean(),
        label: v.optional(v.string()),
        objectId: v.optional(v.id("collections")),
        recordedAt: v.optional(v.number()),
        linkedByName: v.optional(v.string()),
        linkedAt: v.number(),
        retraction: v.optional(
          v.object({
            reason: v.string(),
            retractedByName: v.optional(v.string()),
            retractedAt: v.number(),
          }),
        ),
      }),
    ),
    /** Null when the viewer may not read insurance records. */
    coverage: v.union(
      v.null(),
      v.array(
        v.object({
          collectionId: v.id("collections"),
          objectTitle: v.string(),
          policyNumber: v.string(),
          carrier: v.string(),
          coveredValue: v.number(),
          currency: v.optional(v.string()),
        }),
      ),
    ),
  }),
  handler: async (ctx, args) => {
    const { incident, viewer } = await requireVisibleIncident(
      ctx,
      args.incidentId,
    );
    const access = await evidenceAccess(ctx, incident.organizationId, viewer);
    const rows = await evidenceRows(ctx, incident._id);
    const nameOf = async (userId: Id<"users">) =>
      displayName(await ctx.db.get(userId));
    return {
      evidence: await Promise.all(
        rows.map(async (row) => {
          const visible = canSee(access, row.reference.kind);
          return {
            _id: row._id,
            kind: row.reference.kind,
            recordId: row.reference.id,
            visible,
            label: visible ? row.label : undefined,
            objectId: visible ? row.objectId : undefined,
            recordedAt: row.recordedAt,
            linkedByName: await nameOf(row.linkedBy),
            linkedAt: row.linkedAt,
            retraction: row.retraction && {
              reason: row.retraction.reason,
              retractedByName: await nameOf(row.retraction.retractedBy),
              retractedAt: row.retraction.retractedAt,
            },
          };
        }),
      ),
      coverage: access.insurance
        ? await coverageAtDiscovery(
            ctx,
            incident,
            await affectedObjects(ctx, incident),
          )
        : null,
    };
  },
});

/**
 * Records staff may cite: accepted assessments and files of the affected
 * objects, and claims that name them, limited to what the viewer can read.
 */
export const listEvidenceCandidates = query({
  args: { incidentId: v.id("incidents") },
  returns: v.array(
    v.object({
      reference: incidentEvidenceReferenceValidator,
      label: v.string(),
      objectId: v.optional(v.id("collections")),
      recordedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const { incident, viewer } = await requireVisibleIncident(
      ctx,
      args.incidentId,
    );
    const access = await evidenceAccess(ctx, incident.organizationId, viewer);
    const objects = await affectedObjects(ctx, incident);
    const affected = new Set(objects.map((object) => object._id));
    const candidates: Array<{
      reference: IncidentEvidenceReference;
      label: string;
      objectId?: Id<"collections">;
      recordedAt?: number;
    }> = [];
    for (const object of objects) {
      const assessments = await ctx.db
        .query("conditionAssessments")
        .withIndex("by_collection_and_status_and_acceptedAt", (q) =>
          q.eq("collectionId", object._id).eq("status", "accepted"),
        )
        .order("desc")
        .take(PER_OBJECT);
      for (const row of assessments)
        if (row.organizationId === incident.organizationId)
          candidates.push({
            reference: { kind: "conditionAssessment", id: row._id },
            label: clip(`${object.title} - ${row.condition}: ${row.summary}`),
            objectId: object._id,
            recordedAt: row.assessedAt,
          });
      if (!access.media) continue;
      const media = await ctx.db
        .query("mediaFiles")
        .withIndex("by_collection", (q) => q.eq("collectionId", object._id))
        .order("desc")
        .take(PER_OBJECT);
      for (const row of media)
        if (row.organizationId === incident.organizationId)
          candidates.push({
            reference: { kind: "media", id: row._id },
            label: clip(`${object.title} - ${row.fileName}`),
            objectId: object._id,
            recordedAt: row.uploadedAt,
          });
    }
    if (access.insurance) {
      const claims = await ctx.db
        .query("insuranceClaims")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", incident.organizationId),
        )
        .order("desc")
        .take(CLAIM_SCAN);
      for (const row of claims)
        if (row.collectionIds?.some((id) => affected.has(id)))
          candidates.push({
            reference: { kind: "insuranceClaim", id: row._id },
            label: `${row.claimNumber} (${row.status})`,
            recordedAt: row.reportedDate,
          });
    }
    return candidates;
  },
});
