import type { Infer } from "convex/values";
import { v } from "convex/values";

/**
 * Case kinds a task can be linked to; each has a staff case detail page. A
 * documentation quality finding and an inventory exception are the cases their
 * repair work hangs on.
 */
export const caseTaskCaseTypeValidator = v.union(
  v.literal("loan"),
  v.literal("accession"),
  v.literal("deaccession"),
  v.literal("exhibition"),
  v.literal("conservation"),
  v.literal("documentationFinding"),
  v.literal("inventoryException"),
);
export type CaseTaskCaseType = Infer<typeof caseTaskCaseTypeValidator>;

export const caseTaskStatusValidator = v.union(
  v.literal("todo"),
  v.literal("in_progress"),
  v.literal("blocked"),
  v.literal("in_review"),
  v.literal("done"),
  v.literal("cancelled"),
);
export type CaseTaskStatus = Infer<typeof caseTaskStatusValidator>;

export const caseTaskEvidenceKindValidator = v.union(
  v.literal("conditionAssessment"),
  v.literal("movement"),
  v.literal("media"),
  v.literal("auditEntry"),
);
export type CaseTaskEvidenceKind = Infer<typeof caseTaskEvidenceKindValidator>;

/**
 * A typed pointer to an existing record that supports a task. Links cite
 * evidence; they never create or change it.
 */
export const caseTaskEvidenceReferenceValidator = v.union(
  v.object({
    kind: v.literal("conditionAssessment"),
    id: v.id("conditionAssessments"),
  }),
  v.object({ kind: v.literal("movement"), id: v.id("locationHistory") }),
  v.object({ kind: v.literal("media"), id: v.id("mediaFiles") }),
  v.object({ kind: v.literal("auditEntry"), id: v.id("auditLog") }),
);
export type CaseTaskEvidenceReference = Infer<
  typeof caseTaskEvidenceReferenceValidator
>;
