import { defineListState } from "@/lib/list-state";

/** Rows each board column loads at a time. */
export const DEACCESSION_COLUMN_PAGE_SIZE = 25;

/**
 * The deaccession board URL: search and decision filter. Columns load more
 * rows independently, so depth is not part of the shared link.
 */
export const DEACCESSION_STATUS_FILTERS = [
  "all",
  "pending",
  "approved",
  "rejected",
] as const;

export const deaccessionListState = defineListState({
  filters: { status: DEACCESSION_STATUS_FILTERS },
  sorts: ["newest"],
  pageSize: DEACCESSION_COLUMN_PAGE_SIZE,
  maxDepth: DEACCESSION_COLUMN_PAGE_SIZE,
});
