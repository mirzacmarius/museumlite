import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  metric,
  openProjection,
  type ProjectionReader,
} from "./projectionReads";
import { groupScope, siteScope } from "./projectionSources";
import { distinctScope, readTotals } from "./projectionStore";

type AnalyticsCtx = Pick<QueryCtx, "db" | "storage" | "runQuery">;

function isValidConvexId(id: string): boolean {
  return id.length >= 20 && /^[a-zA-Z0-9_-]+$/.test(id);
}

export async function buildRecentCollectionGroups(
  ctx: AnalyticsCtx,
  reader: ProjectionReader,
  collectionGroups: Array<Doc<"collectionGroups">>,
) {
  return Promise.all(
    collectionGroups
      .toSorted((a, b) => b._creationTime - a._creationTime)
      .slice(0, 4)
      .map(async (group) => {
        let imageUrl: string | undefined;

        if (group.imageId) {
          imageUrl = (await ctx.storage.getUrl(group.imageId)) ?? undefined;
        }

        if (!imageUrl) {
          const groupItems = await ctx.db
            .query("collectionGroupItems")
            .withIndex("by_collectionGroup", (q) =>
              q.eq("collectionGroupId", group._id),
            )
            .take(20);

          const primaryMediaResults = await Promise.all(
            groupItems.map((groupItem) =>
              ctx.db
                .query("mediaFiles")
                .withIndex("by_collection", (q) =>
                  q.eq("collectionId", groupItem.collectionId),
                )
                .filter((q) =>
                  q.and(
                    q.eq(q.field("isPrimary"), true),
                    q.eq(q.field("fileType"), "image"),
                  ),
                )
                .first(),
            ),
          );

          const primaryMedia = primaryMediaResults.find(
            (media): media is NonNullable<typeof media> => media !== null,
          );
          if (primaryMedia) {
            imageUrl =
              (await ctx.storage.getUrl(
                primaryMedia.thumbnailStorageId ?? primaryMedia.storageId,
              )) ?? undefined;
          }

          if (!imageUrl) {
            const anyMediaResults = await Promise.all(
              groupItems.map((groupItem) =>
                ctx.db
                  .query("mediaFiles")
                  .withIndex("by_collection", (q) =>
                    q.eq("collectionId", groupItem.collectionId),
                  )
                  .filter((q) => q.eq(q.field("fileType"), "image"))
                  .first(),
              ),
            );

            const anyMedia = anyMediaResults.find(
              (media): media is NonNullable<typeof media> => media !== null,
            );
            if (anyMedia) {
              imageUrl =
                (await ctx.storage.getUrl(
                  anyMedia.thumbnailStorageId ?? anyMedia.storageId,
                )) ?? undefined;
            }
          }
        }

        return {
          id: group._id,
          name: group.name,
          description: group.description,
          itemsCount: metric(
            await reader.totals(groupScope(group._id)),
            "items",
          ),
          imageUrl,
          storageLocation: group.storageLocation,
          valuation: group.valuation,
        };
      }),
  );
}

export async function buildRecentObjects(
  ctx: AnalyticsCtx,
  collections: Array<Doc<"collections">>,
) {
  return Promise.all(
    collections
      .toSorted((a, b) => b._creationTime - a._creationTime)
      .slice(0, 6)
      .map(async (collection) => {
        const primaryMedia = await ctx.db
          .query("mediaFiles")
          .withIndex("by_collection", (q) =>
            q.eq("collectionId", collection._id),
          )
          .filter((q) => q.eq(q.field("isPrimary"), true))
          .first();

        const imageUrl = primaryMedia?.storageId
          ? ((await ctx.storage.getUrl(primaryMedia.storageId)) ?? undefined)
          : undefined;

        return {
          id: collection._id,
          title: collection.title,
          accessionNumber: collection.accessionNumber,
          objectType: collection.objectType,
          status: collection.status,
          imageUrl,
        };
      }),
  );
}

export async function buildRecentActivity(
  ctx: AnalyticsCtx,
  organizationId: Id<"organizations">,
  inScope?: (entityType: string, entityId: string) => Promise<boolean>,
) {
  const auditLogEntries = await ctx.db
    .query("auditLog")
    .withIndex("by_organization_and_timestamp", (q) =>
      q.eq("organizationId", organizationId),
    )
    .order("desc")
    .take(inScope ? 100 : 12);

  const filteredEntries: Array<Doc<"auditLog">> = [];
  for (const event of auditLogEntries) {
    if (!inScope || (await inScope(event.entityType, event.entityId))) {
      filteredEntries.push(event);
      if (filteredEntries.length === 12) break;
    }
  }

  return Promise.all(
    filteredEntries.slice(0, 12).map(async (event) => {
      let type: "collection" | "loan" | "accession" | "deaccession" =
        "collection";

      if (event.entityType.includes("loan")) {
        type = "loan";
      } else if (event.entityType.includes("accession")) {
        type = "accession";
      } else if (event.entityType.includes("deaccession")) {
        type = "deaccession";
      } else if (event.entityType.includes("collection")) {
        type = "collection";
      }

      let title = event.entityType;
      let subtitle: string | undefined = event.action;
      let status: string | undefined;

      if (type === "collection" && isValidConvexId(event.entityId)) {
        try {
          const collection = await ctx.db.get(
            event.entityId as unknown as Id<"collections">,
          );
          title = collection?.title ?? event.entityType;
          subtitle = collection?.accessionNumber ?? event.action;
          status = collection?.status;
        } catch {
          // use defaults
        }
      } else if (type === "loan" && isValidConvexId(event.entityId)) {
        try {
          const loan = await ctx.db.get(
            event.entityId as unknown as Id<"loans">,
          );
          title = loan?.loanNumber ?? event.entityType;
          subtitle = loan?.lenderBorrowerName ?? event.action;
          status = loan?.status;
        } catch {
          // use defaults
        }
      } else if (type === "accession" && isValidConvexId(event.entityId)) {
        try {
          const accession = await ctx.db.get(
            event.entityId as unknown as Id<"accessions">,
          );
          title = accession?.accessionNumber ?? event.entityType;
          subtitle = accession?.source ?? event.action;
          status = accession?.status;
        } catch {
          // use defaults
        }
      } else if (type === "deaccession" && isValidConvexId(event.entityId)) {
        try {
          const deaccession = await ctx.db.get(
            event.entityId as unknown as Id<"deaccessions">,
          );
          title = deaccession?.deaccessionNumber ?? event.entityType;
          subtitle = deaccession?.reason ?? event.action;
          status = deaccession?.status;
        } catch {
          // use defaults
        }
      }

      return {
        type,
        id: event._id,
        entityId: event.entityId,
        title,
        subtitle,
        timestamp: event.timestamp,
        status,
      };
    }),
  );
}

/** Rows inspected when building a site-scoped preview list. */
const SITE_PREVIEW_SCAN_LIMIT = 200;

function analyticsFromTotals(
  totals: Record<string, number>,
  organizationTotals: Record<string, number>,
) {
  return {
    collections: { total: metric(totals, "collections.total") },
    objects: {
      total: metric(totals, "inventory.owned"),
      active: metric(totals, "inventory.status.active"),
      loaned: metric(totals, "inventory.status.loaned"),
      incomingLoanExcluded: metric(totals, "inventory.incoming"),
      ownershipUnclassified: metric(totals, "inventory.unclassified"),
      deaccessioned: metric(totals, "objects.deaccessioned"),
      onDisplay: metric(totals, "inventory.onDisplay"),
    },
    loans: {
      total:
        metric(totals, "loans.pending") +
        metric(totals, "loans.active") +
        metric(totals, "loans.dispatched") +
        metric(totals, "loans.returned") +
        metric(totals, "loans.cancelled"),
      pending: metric(totals, "loans.pending"),
      active: metric(totals, "loans.active"),
      returned: metric(totals, "loans.returned"),
      incoming: metric(totals, "loans.incoming"),
      outgoing: metric(totals, "loans.outgoing"),
    },
    accessions: {
      pending: metric(totals, "accessions.pending"),
      approved: metric(totals, "accessions.approved"),
      rejected: metric(totals, "accessions.rejected"),
    },
    deaccessions: {
      pending: metric(totals, "deaccessions.pending"),
      approved: metric(totals, "deaccessions.approved"),
      rejected: metric(totals, "deaccessions.rejected"),
    },
    transfers: {
      pending:
        metric(organizationTotals, "transfers.pending") +
        metric(organizationTotals, "transfers.pending_source_approval"),
      executed: metric(organizationTotals, "transfers.executed"),
      rejected: metric(organizationTotals, "transfers.rejected"),
      cancelled: metric(organizationTotals, "transfers.cancelled"),
    },
    locations: { total: metric(totals, "locations.total") },
  };
}

async function objectSite(
  ctx: AnalyticsCtx,
  organizationId: Id<"organizations">,
  collection: Doc<"collections"> | null,
) {
  if (!collection?.currentLocationId) return undefined;
  if (collection.organizationId !== organizationId) return undefined;
  const location = await ctx.db.get(collection.currentLocationId);
  return location?.organizationId === organizationId
    ? location.siteId
    : undefined;
}

async function loadSitePreviewObjects(
  ctx: AnalyticsCtx,
  organizationId: Id<"organizations">,
  siteId: Id<"sites">,
) {
  const recent = await ctx.db
    .query("collections")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .order("desc")
    .take(SITE_PREVIEW_SCAN_LIMIT);
  const atSite: Array<Doc<"collections">> = [];
  for (const collection of recent) {
    if ((await objectSite(ctx, organizationId, collection)) === siteId) {
      atSite.push(collection);
      if (atSite.length === 6) break;
    }
  }
  return atSite;
}

async function loadSitePreviewGroups(
  ctx: AnalyticsCtx,
  reader: ProjectionReader,
  organizationId: Id<"organizations">,
  siteId: Id<"sites">,
) {
  const recent = await ctx.db
    .query("collectionGroups")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .order("desc")
    .take(SITE_PREVIEW_SCAN_LIMIT);
  const atSite: Array<Doc<"collectionGroups">> = [];
  for (const group of recent) {
    const membership = await readTotals(
      ctx,
      reader.generationId,
      distinctScope(siteScope(siteId), { "collections.total": 1 }, group._id),
    );
    if (metric(membership, "refs") > 0) {
      atSite.push(group);
      if (atSite.length === 4) break;
    }
  }
  return atSite;
}

function siteActivityFilter(
  ctx: AnalyticsCtx,
  reader: ProjectionReader,
  organizationId: Id<"organizations">,
  siteId: Id<"sites">,
) {
  const objectAtSite = async (id: string) => {
    const collectionId = ctx.db.normalizeId("collections", id);
    if (!collectionId) return false;
    return (
      (await objectSite(
        ctx,
        organizationId,
        await ctx.db.get(collectionId),
      )) === siteId
    );
  };
  return async (entityType: string, entityId: string) => {
    if (entityType.includes("loan")) {
      const loanId = ctx.db.normalizeId("loans", entityId);
      if (!loanId) return false;
      const items = await ctx.db
        .query("loanItems")
        .withIndex("by_loan", (q) => q.eq("loanId", loanId))
        .take(20);
      for (const item of items) {
        if (await objectAtSite(item.collectionId)) return true;
      }
      return false;
    }
    if (entityType.includes("deaccession")) {
      const id = ctx.db.normalizeId("deaccessions", entityId);
      const deaccession = id ? await ctx.db.get(id) : null;
      return deaccession ? await objectAtSite(deaccession.collectionId) : false;
    }
    if (entityType.includes("accession")) {
      const id = ctx.db.normalizeId("accessions", entityId);
      const accession = id ? await ctx.db.get(id) : null;
      return accession?.collectionId
        ? await objectAtSite(accession.collectionId)
        : false;
    }
    if (entityType.includes("collection")) {
      if (await objectAtSite(entityId)) return true;
      const groupId = ctx.db.normalizeId("collectionGroups", entityId);
      if (!groupId) return false;
      const membership = await readTotals(
        ctx,
        reader.generationId,
        distinctScope(siteScope(siteId), { "collections.total": 1 }, groupId),
      );
      return metric(membership, "refs") > 0;
    }
    return false;
  };
}

export type OrganizationAnalytics = Awaited<
  ReturnType<typeof buildOrganizationAnalytics>
>;

/**
 * Dashboard counts come from the maintained projection. Preview lists are
 * bounded recent samples and never stand in for totals.
 */
export async function buildOrganizationAnalytics(
  ctx: AnalyticsCtx,
  organizationId: Id<"organizations">,
  siteId?: Id<"sites">,
) {
  const opened = await openProjection(ctx, organizationId);
  if (!opened.ok) return opened.unavailable;
  const { reader } = opened;
  const organizationTotals = await reader.totals();
  const totals =
    siteId === undefined
      ? organizationTotals
      : await reader.totals(siteScope(siteId));

  const [groupDocs, objectDocs] =
    siteId === undefined
      ? await Promise.all([
          ctx.db
            .query("collectionGroups")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", organizationId),
            )
            .order("desc")
            .take(4),
          ctx.db
            .query("collections")
            .withIndex("by_organization", (q) =>
              q.eq("organizationId", organizationId),
            )
            .order("desc")
            .take(6),
        ])
      : await Promise.all([
          loadSitePreviewGroups(ctx, reader, organizationId, siteId),
          loadSitePreviewObjects(ctx, organizationId, siteId),
        ]);

  const [recentCollectionGroups, recentObjects, recentActivity] =
    await Promise.all([
      buildRecentCollectionGroups(ctx, reader, groupDocs),
      buildRecentObjects(ctx, objectDocs),
      buildRecentActivity(
        ctx,
        organizationId,
        siteId === undefined
          ? undefined
          : siteActivityFilter(ctx, reader, organizationId, siteId),
      ),
    ]);

  return {
    availability: "ready" as const,
    ...analyticsFromTotals(totals, organizationTotals),
    recentCollectionGroups,
    recentObjects,
    recentActivity,
  };
}
