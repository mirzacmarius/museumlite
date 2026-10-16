import { defineListState } from "@/lib/list-state";

/** Rows each board column loads at a time. */
export const CONDITION_ASSESSMENT_COLUMN_PAGE_SIZE = 25;
/** Accepted assessments read as a log and load a shorter page. */
export const CONDITION_ASSESSMENT_LOG_PAGE_SIZE = 10;

/**
 * The condition assessment board URL: search and status filter. Columns load
 * more rows independently, so depth is not part of the shared link.
 */
export const CONDITION_ASSESSMENT_STATUS_FILTERS = [
  "all",
  "pending",
  "accepted",
  "rejected",
] as const;

export type ConditionAssessmentStatusFilter =
  (typeof CONDITION_ASSESSMENT_STATUS_FILTERS)[number];

export const conditionAssessmentListState = defineListState({
  filters: { status: CONDITION_ASSESSMENT_STATUS_FILTERS },
  sorts: ["newest"],
  pageSize: CONDITION_ASSESSMENT_COLUMN_PAGE_SIZE,
  maxDepth: CONDITION_ASSESSMENT_COLUMN_PAGE_SIZE,
});

export type ConditionAssessmentColumn =
  | "draft"
  | "submitted"
  | "accepted"
  | "rejected";

/** The columns a status filter shows, in board order. */
export function columnsForFilter(
  filter: ConditionAssessmentStatusFilter,
): ConditionAssessmentColumn[] {
  switch (filter) {
    case "all":
      return ["draft", "submitted", "accepted"];
    case "pending":
      return ["submitted"];
    case "accepted":
      return ["accepted"];
    case "rejected":
      return ["rejected"];
  }
}
