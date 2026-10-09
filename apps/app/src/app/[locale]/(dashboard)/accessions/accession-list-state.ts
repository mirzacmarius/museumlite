import { defineListState } from "@/lib/list-state";

/**
 * The accession board URL: the search. The board's `status` view is read by
 * the board itself, and columns load more rows independently.
 */
export const accessionListState = defineListState({
  filters: {},
  sorts: ["newest"],
  pageSize: 25,
  maxDepth: 25,
});

/** URL keys that shape the board, including the board's own `status` view. */
export const ACCESSION_LIST_KEYS = [...accessionListState.keys, "status"];
