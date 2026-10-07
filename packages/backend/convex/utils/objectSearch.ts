import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { searchIdentifierPrefix } from "./identifiers";

type ObjectSearchField =
  | "title"
  | "alternativeTitle"
  | "creator"
  | "objectName";

export const OBJECT_SEARCH_INDEXES = [
  { field: "title", index: "search_index" },
  { field: "alternativeTitle", index: "search_alternativeTitle" },
  { field: "creator", index: "search_creator" },
  { field: "objectName", index: "search_objectName" },
] as const satisfies ReadonlyArray<{ field: ObjectSearchField; index: string }>;

/**
 * Object search with an explicit scope: identifier prefix matches first, then
 * indexed word matches on title, alternative title, creator and object name.
 * Deleted legacy records are excluded; archived and deaccessioned records stay
 * findable with their status.
 */
export async function searchObjects(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  searchQuery: string,
  limit: number,
) {
  const [identifierMatches, ...textMatches] = await Promise.all([
    searchIdentifierPrefix(ctx, organizationId, "catalog", searchQuery, limit),
    ...OBJECT_SEARCH_INDEXES.map(({ field, index }) =>
      ctx.db
        .query("collections")
        .withSearchIndex(index, (q) =>
          q.search(field, searchQuery).eq("organizationId", organizationId),
        )
        .take(limit),
    ),
  ]);
  const seen = new Set<Id<"collections">>();
  const rows: Doc<"collections">[] = [];
  for (const row of [...identifierMatches.rows, ...textMatches.flat()]) {
    if (row.status === "deleted" || seen.has(row._id)) continue;
    seen.add(row._id);
    rows.push(row);
  }
  return {
    rows: rows.slice(0, limit),
    identifierIndexIncomplete: identifierMatches.incomplete,
  };
}
