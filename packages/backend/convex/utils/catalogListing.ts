import type { PaginationOptions, PaginationResult } from "convex/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type {
  CatalogFilters,
  CatalogSort,
  ObjectSearchField,
} from "./catalogFilterValidators";
import { filterCollectionListPage } from "./collectionListHelpers";
import {
  normalizeIdentifier,
  searchCatalogIdentifierPrefixByStatus,
  searchIdentifierPrefix,
} from "./identifiers";
import { getPageInventoryEvidence } from "./indexedCounts";
import {
  foldFacetValue,
  isObjectSearchReady,
  matchedObjectSearchField,
  searchQueryTerms,
} from "./objectSearchDocuments";

export interface CatalogListingArgs extends CatalogFilters {
  organizationId: Id<"organizations">;
  /**
   * Newest first unless set; ignored while searching, which ranks by
   * relevance. Date made orders list undated Objects last both ways.
   */
  sort?: CatalogSort;
}

export type CatalogListingRow = Doc<"collections"> & {
  /** While searching, the field the row was found in. */
  matchedField?: ObjectSearchField;
};

/** Identifier prefix matches listed before the ranked results on the first page. */
const IDENTIFIER_MATCHES_FIRST = 20;
const MAX_ROWS_READ = 1000;
const MAX_BYTES_READ = 2_000_000;
/**
 * Search documents a date made page reads: each costs a read of its Object on
 * top of the per-row filter reads, and a function may make at most 4,096,
 * which convex-test does not enforce.
 */
const MAX_MADE_SORT_ROWS_READ = 500;

type Ctx = Pick<QueryCtx, "db">;

function boundedOptions(paginationOpts: PaginationOptions): PaginationOptions {
  return {
    ...paginationOpts,
    maximumRowsRead: Math.min(
      paginationOpts.maximumRowsRead ?? MAX_ROWS_READ,
      MAX_ROWS_READ,
    ),
    maximumBytesRead: Math.min(
      paginationOpts.maximumBytesRead ?? MAX_BYTES_READ,
      MAX_BYTES_READ,
    ),
  };
}

async function filterPage(
  ctx: Ctx,
  args: CatalogListingArgs,
  page: Doc<"collections">[],
) {
  return await filterCollectionListPage(ctx, page, {
    ...args,
    ...(args.inventoryMetricScope
      ? await getPageInventoryEvidence(ctx, args.organizationId, page)
      : {}),
  });
}

/**
 * One page of the catalog while searching: identifier prefix matches first on
 * the first page, then the search documents ranked by relevance, both passed
 * through the other filters. Later pages leave out the identifier matches
 * already listed, so no Object repeats. The search index ranks at most 1,024
 * documents per query, so a very broad search lists fewer Objects than bulk
 * edits and exports reach.
 */
async function searchCatalogPage(
  ctx: Ctx,
  args: CatalogListingArgs,
  search: string,
  paginationOpts: PaginationOptions,
): Promise<PaginationResult<CatalogListingRow>> {
  const identifier = args.status
    ? await searchCatalogIdentifierPrefixByStatus(
        ctx as QueryCtx,
        args.organizationId,
        args.status,
        search,
        IDENTIFIER_MATCHES_FIRST,
      )
    : await searchIdentifierPrefix(
        ctx as QueryCtx,
        args.organizationId,
        "catalog",
        search,
        IDENTIFIER_MATCHES_FIRST,
      );
  const identifierIds = new Set(identifier.rows.map((row) => row._id));
  const culture = foldFacetValue(args.culture);
  const period = foldFacetValue(args.period);
  const condition = foldFacetValue(args.condition);
  const result = await ctx.db
    .query("objectSearchDocuments")
    .withSearchIndex("search_text", (q) => {
      let filter = q
        .search("text", searchQueryTerms(search).join(" "))
        .eq("organizationId", args.organizationId);
      if (args.status) filter = filter.eq("status", args.status);
      if (args.hasImage !== undefined)
        filter = filter.eq("hasImage", args.hasImage);
      if (culture) filter = filter.eq("culture", culture);
      if (period) filter = filter.eq("period", period);
      if (condition) filter = filter.eq("condition", condition);
      return filter;
    })
    .paginate(paginationOpts);
  const loaded = await Promise.all(
    result.page.map((document) => ctx.db.get(document.collectionId)),
  );
  const ranked = loaded.filter(
    (row): row is Doc<"collections"> =>
      row !== null && !identifierIds.has(row._id),
  );
  const candidates =
    paginationOpts.cursor === null ? [...identifier.rows, ...ranked] : ranked;
  const filtered = await filterPage(
    ctx,
    { ...args, search: undefined },
    candidates,
  );
  return {
    ...result,
    page: filtered.map((row) => ({
      ...row,
      matchedField: identifierIds.has(row._id)
        ? "accessionNumber"
        : matchedObjectSearchField(row, search),
    })),
  };
}

/**
 * One page in date made order, from the search documents' sort keys: earliest
 * first by the first year an Object's date allows, latest first by the last,
 * undated Objects after the dated ones. The year range is not read from the
 * index, which would drop dates open on one side; it is filtered per page
 * like the other filters, so pages can come back short.
 */
async function madeSortedCatalogPage(
  ctx: Ctx,
  args: CatalogListingArgs,
  paginationOpts: PaginationOptions,
): Promise<PaginationResult<CatalogListingRow>> {
  const status = args.status;
  const documents =
    args.sort === "madeLatest"
      ? status
        ? ctx.db
            .query("objectSearchDocuments")
            .withIndex("by_organization_and_status_and_madeSortLatest", (q) =>
              q.eq("organizationId", args.organizationId).eq("status", status),
            )
        : ctx.db
            .query("objectSearchDocuments")
            .withIndex("by_organization_and_madeSortLatest", (q) =>
              q.eq("organizationId", args.organizationId),
            )
      : status
        ? ctx.db
            .query("objectSearchDocuments")
            .withIndex("by_organization_and_status_and_madeSortEarliest", (q) =>
              q.eq("organizationId", args.organizationId).eq("status", status),
            )
        : ctx.db
            .query("objectSearchDocuments")
            .withIndex("by_organization_and_madeSortEarliest", (q) =>
              q.eq("organizationId", args.organizationId),
            );
  const result = await documents
    .order(args.sort === "madeLatest" ? "desc" : "asc")
    .paginate({
      ...paginationOpts,
      maximumRowsRead: Math.min(
        paginationOpts.maximumRowsRead ?? MAX_MADE_SORT_ROWS_READ,
        MAX_MADE_SORT_ROWS_READ,
      ),
    });
  // The document says whether the Object has a photograph, so the page
  // filter need not read it again.
  const kept =
    args.hasImage === undefined
      ? result.page
      : result.page.filter((document) => document.hasImage === args.hasImage);
  const loaded = await Promise.all(
    kept.map((document) => ctx.db.get(document.collectionId)),
  );
  const rows = loaded.filter((row): row is Doc<"collections"> => row !== null);
  return {
    ...result,
    page: await filterPage(
      ctx,
      { ...args, search: undefined, hasImage: undefined },
      rows,
    ),
  };
}

function isMadeSort(sort: CatalogSort | undefined) {
  return sort === "madeEarliest" || sort === "madeLatest";
}

/**
 * The rows that pass the catalog filters and search. Once an Organization's
 * search documents are ready, a search keeps the rows its words match (see
 * `matchedObjectSearchField`) and says where; until then it is the old
 * substring scan, as the list's own fallback. The list, bulk field edits and
 * filtered exports all filter this way, so what staff see is what they act on.
 */
export async function filterCatalogRows(
  ctx: Ctx,
  args: CatalogListingArgs,
  rows: Doc<"collections">[],
  searchReady?: boolean,
): Promise<CatalogListingRow[]> {
  const search = args.search?.trim() || undefined;
  const ready =
    search !== undefined &&
    (searchReady ?? (await isObjectSearchReady(ctx, args.organizationId)));
  if (!search || !ready)
    return await filterPage(ctx, { ...args, search }, rows);
  const filtered = await filterPage(ctx, { ...args, search: undefined }, rows);
  // Identifier prefixes match as the list's first page lists them.
  const identifierKey = normalizeIdentifier(search);
  return filtered.flatMap((row) => {
    const matchedField = (
      row.normalizedIdentifier ?? normalizeIdentifier(row.accessionNumber)
    ).startsWith(identifierKey)
      ? "accessionNumber"
      : matchedObjectSearchField(row, search);
    return matchedField ? [{ ...row, matchedField }] : [];
  });
}

/**
 * One page of the Object Catalog under the given filters; the list and bulk
 * field edits read the same pages, so what staff see is what they act on.
 *
 * `stableOrder` pages by creation order even while searching or under a date
 * made order, keeping rows whose words a search term begins: a job that
 * changes the rows it pages through then never meets a row twice, as
 * relevance or date order could. A date made order also lists newest first
 * until the Organization's search documents are ready.
 */
export async function listCatalogPage(
  ctx: Ctx,
  args: CatalogListingArgs,
  paginationOpts: PaginationOptions,
  options: { stableOrder?: boolean } = {},
): Promise<PaginationResult<CatalogListingRow>> {
  const bounded = boundedOptions(paginationOpts);
  const search = args.search?.trim() || undefined;
  const searchReady =
    search !== undefined &&
    (await isObjectSearchReady(ctx, args.organizationId));
  if (search && searchReady && !options.stableOrder) {
    return await searchCatalogPage(ctx, args, search, bounded);
  }
  if (
    !search &&
    isMadeSort(args.sort) &&
    !options.stableOrder &&
    (await isObjectSearchReady(ctx, args.organizationId))
  ) {
    return await madeSortedCatalogPage(ctx, args, bounded);
  }

  const singleLocationId =
    args.locationIds?.length === 1 ? args.locationIds[0] : undefined;
  const status = args.status;
  // Equality indexes preserve creation-time order within the selected range.
  const source = status
    ? ctx.db
        .query("collections")
        .withIndex("by_organization_and_status", (q) =>
          q.eq("organizationId", args.organizationId).eq("status", status),
        )
    : singleLocationId
      ? ctx.db
          .query("collections")
          .withIndex("by_organization_and_location", (q) =>
            q
              .eq("organizationId", args.organizationId)
              .eq("currentLocationId", singleLocationId),
          )
      : ctx.db
          .query("collections")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId),
          );
  // Identifier order reads its own index; the page filter applies locations.
  const identifierSource = status
    ? ctx.db
        .query("collections")
        .withIndex("by_organization_and_status_and_normalizedIdentifier", (q) =>
          q.eq("organizationId", args.organizationId).eq("status", status),
        )
    : ctx.db
        .query("collections")
        .withIndex("by_organization_and_normalizedIdentifier", (q) =>
          q.eq("organizationId", args.organizationId),
        );

  // Filters may yield short or empty pages. The native cursor still advances,
  // and split metadata keeps reactive pages contiguous as records change.
  const ordered = (
    args.sort === "identifier" ? identifierSource : source
  ).order(
    args.sort === "oldest" || args.sort === "identifier" ? "asc" : "desc",
  );
  const result = await ordered.paginate(bounded);
  return {
    ...result,
    page: await filterCatalogRows(ctx, args, result.page, searchReady),
  };
}
