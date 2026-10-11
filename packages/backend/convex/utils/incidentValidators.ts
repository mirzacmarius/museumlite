import { type Infer, v } from "convex/values";

/** What happened, as staff first describe it at intake. */
export const incidentKindValidator = v.union(
  v.literal("damage"),
  v.literal("loss"),
  v.literal("theft"),
  v.literal("fire"),
  v.literal("water"),
  v.literal("pest"),
  v.literal("environmental"),
  v.literal("security"),
  v.literal("other"),
);
export type IncidentKind = Infer<typeof incidentKindValidator>;

/**
 * Reported until a coordinator triages it, responding while the response
 * runs, closed once its after-action record is written (ADR 0015).
 */
export const incidentStatusValidator = v.union(
  v.literal("reported"),
  v.literal("responding"),
  v.literal("closed"),
);
export type IncidentStatus = Infer<typeof incidentStatusValidator>;

export const incidentSeverityValidator = v.union(
  v.literal("minor"),
  v.literal("moderate"),
  v.literal("major"),
  v.literal("critical"),
);
export type IncidentSeverity = Infer<typeof incidentSeverityValidator>;

/** How an affected object was found; unaffected keeps the link as evidence. */
export const incidentImpactValidator = v.union(
  v.literal("at_risk"),
  v.literal("damaged"),
  v.literal("missing"),
  v.literal("unaffected"),
);
export type IncidentImpact = Infer<typeof incidentImpactValidator>;

/** The record that raised the incident, when it was not reported by hand. */
export const incidentSourceValidator = v.object({
  kind: v.literal("alertEpisode"),
  episodeId: v.id("alertEpisodes"),
});

export const incidentHandoffDirectionValidator = v.union(
  v.literal("evacuation"),
  v.literal("recovery"),
);
export type IncidentHandoffDirection = Infer<
  typeof incidentHandoffDirectionValidator
>;

export const incidentEvidenceReferenceValidator = v.union(
  v.object({
    kind: v.literal("conditionAssessment"),
    id: v.id("conditionAssessments"),
  }),
  v.object({ kind: v.literal("media"), id: v.id("mediaFiles") }),
  v.object({ kind: v.literal("insuranceClaim"), id: v.id("insuranceClaims") }),
);
export type IncidentEvidenceReference = Infer<
  typeof incidentEvidenceReferenceValidator
>;

export const incidentAfterActionValidator = v.object({
  summary: v.string(),
  whatWorked: v.optional(v.string()),
  improvements: v.optional(v.string()),
  followUp: v.optional(v.string()),
  recordedBy: v.id("users"),
  recordedAt: v.number(),
});

/** Plans a coordinator chose at triage, with their names at that time. */
export const incidentPlanValidator = v.object({
  recipeId: v.id("preparationRecipes"),
  name: v.string(),
});

export const incidentEventActionValidator = v.union(
  v.literal("reported"),
  v.literal("report_repeated"),
  v.literal("triaged"),
  v.literal("response_updated"),
  v.literal("plans_applied"),
  v.literal("objects_added"),
  v.literal("impact_changed"),
  v.literal("evacuated"),
  v.literal("recovered"),
  v.literal("evidence_linked"),
  v.literal("evidence_retracted"),
  v.literal("closed"),
  v.literal("reopened"),
);
export type IncidentEventAction = Infer<typeof incidentEventActionValidator>;
