import { type Infer, v } from "convex/values";

/**
 * Lifecycle of a condition assessment: a draft is work in progress that only
 * staff who record assessments see as editable; a submitted assessment waits
 * for a reviewer, who accepts it (it becomes the object's current condition)
 * or rejects it. An object has at most one draft or submitted assessment.
 */
export const conditionAssessmentStatusValidator = v.union(
  v.literal("draft"),
  v.literal("submitted"),
  v.literal("accepted"),
  v.literal("rejected"),
);

export type ConditionAssessmentStatus = Infer<
  typeof conditionAssessmentStatusValidator
>;

export const MAX_REJECTION_REASON_LENGTH = 2000;

/** Statuses that block starting another assessment of the same object. */
export const OPEN_CONDITION_ASSESSMENT_STATUSES = [
  "draft",
  "submitted",
] as const satisfies readonly ConditionAssessmentStatus[];
