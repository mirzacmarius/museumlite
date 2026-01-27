import type { Doc, Id, TableNames } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/**
 * Batch fetches documents by IDs from a specific table
 *
 * This utility helps avoid N+1 query patterns by fetching all documents
 * in a single batch operation instead of individual db.get() calls.
 *
 * @example
 * // Before (N+1 pattern):
 * const results = await Promise.all(
 *   items.map(async (item) => {
 *     const collection = await ctx.db.get(item.collectionId);
 *     return { ...item, collection };
 *   })
 * );
 *
 * // After (batched):
 * const collectionIds = items.map(item => item.collectionId).filter(Boolean);
 * const collections = await batchGetByIds(ctx, collectionIds, "collections");
 * const collectionMap = createLookupMap(collections);
 * const results = items.map(item => ({
 *   ...item,
 *   collection: item.collectionId ? collectionMap.get(item.collectionId) : undefined
 * }));
 *
 * @param ctx - Query context
 * @param ids - Array of document IDs to fetch
 * @param table - Table name to fetch from
 * @returns Array of documents (null for IDs not found)
 */
export async function batchGetByIds<TableName extends TableNames>(
  ctx: QueryCtx,
  ids: Array<Id<TableName>>,
  table: TableName,
): Promise<Array<Doc<TableName> | null>> {
  // Remove duplicates by converting to Set and back
  const uniqueIds = Array.from(new Set(ids));

  // Fetch all documents in parallel
  const documents = await Promise.all(
    uniqueIds.map((id) => ctx.db.get(id)),
  );

  return documents;
}

/**
 * Creates a Map for O(1) lookups from an array of documents
 *
 * This is typically used after batchGetByIds to enable efficient lookups
 * when mapping over data that needs to reference the fetched documents.
 *
 * @example
 * const collectionIds = accessions.map(a => a.collectionId).filter(Boolean);
 * const collections = await batchGetByIds(ctx, collectionIds, "collections");
 * const collectionMap = createLookupMap(collections);
 *
 * // Now O(1) lookup instead of O(n) array.find()
 * const collection = collectionMap.get(accession.collectionId);
 *
 * @param documents - Array of documents (may contain null values)
 * @returns Map from document ID to document
 */
export function createLookupMap<TableName extends TableNames>(
  documents: Array<Doc<TableName> | null>,
): Map<Id<TableName>, Doc<TableName>> {
  const map = new Map<Id<TableName>, Doc<TableName>>();

  for (const doc of documents) {
    if (doc !== null) {
      map.set(doc._id, doc);
    }
  }

  return map;
}

/**
 * Convenience function that combines batchGetByIds and createLookupMap
 *
 * Use this when you need to fetch documents and immediately create a lookup map.
 *
 * @example
 * const collectionIds = accessions.map(a => a.collectionId).filter(Boolean);
 * const collectionMap = await batchLookup(ctx, collectionIds, "collections");
 * const collection = collectionMap.get(accession.collectionId);
 *
 * @param ctx - Query context
 * @param ids - Array of document IDs to fetch
 * @param table - Table name to fetch from
 * @returns Map from document ID to document
 */
export async function batchLookup<TableName extends TableNames>(
  ctx: QueryCtx,
  ids: Array<Id<TableName>>,
  table: TableName,
): Promise<Map<Id<TableName>, Doc<TableName>>> {
  const documents = await batchGetByIds(ctx, ids, table);
  return createLookupMap(documents);
}
