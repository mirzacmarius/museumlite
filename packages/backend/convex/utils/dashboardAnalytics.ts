import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  countAccessionsByStatus,
  countCatalogObjects,
  countCollectionsByStatus,
  countDeaccessionsByStatus,
  countIndexedQuery,
  countLoansByStatus,
  countLoansByType,
  countOpenDeaccessionCollectionIds,
} from "./indexedCounts";

type AnalyticsCtx = Pick<QueryCtx, "db" | "storage">;

function isValidConvexId(id: string): boolean {
  return id.length >= 20 && /^[a-zA-Z0-9_-]+$/.test(id);
}

async function countTransfersByStatus(
  ctx: AnalyticsCtx,
  organizationId: Id<"organizations">,
  status: Doc<"organizationMoveRequests">["status"],
) {
  return countIndexedQuery(
    ctx.db
      .query("organizationMoveRequests")
      .withIndex("by_source_organization_and_status", (q) =>
        q.eq("sourceOrganizationId", organizationId).eq("status", status),
      ),
  );
}

async function countCollectionGroups(
  ctx: AnalyticsCtx,
  organizationId: Id<"organizations">,
) {
  return countIndexedQuery(
    ctx.db
      .query("collectionGroups")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      ),
  );
}

async function countLocations(
  ctx: AnalyticsCtx,
  organizationId: Id<"organizations">,
  siteId?: Id<"sites">,
) {
  if (siteId === undefined) {
    return countIndexedQuery(
      ctx.db
        .query("locations")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId),
        ),
    );
  }

  return countIndexedQuery(
    ctx.db
      .query("locations")
      .withIndex("by_organization_and_site", (q) =>
        q.eq("organizationId", organizationId).eq("siteId", siteId),
      ),
  );
}

async function loadSiteCollections(
  ctx: AnalyticsCtx,
  organizationId: Id<"organizations">,
  siteId: Id<"sites">,
) {
  const locations = await ctx.db
    .query("locations")
    .withIndex("by_organization_and_site", (q) =>
      q.eq("organizationId", organizationId).eq("siteId", siteId),
    )
    .collect();

  const locationIds = locations.map((loc) => loc._id);
  const collections: Array<Doc<"collections">> = [];

  for (const locationId of locationIds) {
    const atLocation = await ctx.db
      .query("collections")
      .withIndex("by_organization_and_location", (q) =>
        q
          .eq("organizationId", organizationId)
          .eq("currentLocationId", locationId),
      )
      .collect();
    collections.push(...atLocation);
  }

  const uniqueById = new Map(collections.map((c) => [c._id, c]));
  return [...uniqueById.values()];
}

export async function buildRecentCollectionGroups(
  ctx: AnalyticsCtx,
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

          for (const groupItem of groupItems) {
            const primaryMedia = await ctx.db
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
              .first();

            if (primaryMedia) {
              imageUrl =
                (await ctx.storage.getUrl(
                  primaryMedia.thumbnailStorageId ?? primaryMedia.storageId,
                )) ?? undefined;
              break;
            }
          }

          if (!imageUrl) {
            for (const groupItem of groupItems) {
              const anyMedia = await ctx.db
                .query("mediaFiles")
                .withIndex("by_collection", (q) =>
                  q.eq("collectionId", groupItem.collectionId),
                )
                .filter((q) => q.eq(q.field("fileType"), "image"))
                .first();

              if (anyMedia) {
                imageUrl =
                  (await ctx.storage.getUrl(
                    anyMedia.thumbnailStorageId ?? anyMedia.storageId,
                  )) ?? undefined;
                break;
              }
            }
          }
        }

        return {
          id: group._id,
          name: group.name,
          description: group.description,
          itemsCount: group.itemsCount ?? 0,
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
  scope?: {
    collectionIds: Set<Id<"collections">>;
    loanIds: Set<Id<"loans">>;
    accessionIds: Set<Id<"accessions">>;
    deaccessionIds: Set<Id<"deaccessions">>;
    collectionGroupIds: Set<Id<"collectionGroups">>;
  },
) {
  const auditLogEntries = await ctx.db
    .query("auditLog")
    .withIndex("by_organization_and_timestamp", (q) =>
      q.eq("organizationId", organizationId),
    )
    .order("desc")
    .take(scope ? 100 : 12);

  const filteredEntries = scope
    ? auditLogEntries.filter((event) => {
        if (event.entityType.includes("collection")) {
          return (
            scope.collectionIds.has(
              event.entityId as unknown as Id<"collections">,
            ) ||
            scope.collectionGroupIds.has(
              event.entityId as unknown as Id<"collectionGroups">,
            )
          );
        }
        if (event.entityType.includes("loan")) {
          return scope.loanIds.has(event.entityId as unknown as Id<"loans">);
        }
        if (event.entityType.includes("accession")) {
          return scope.accessionIds.has(
            event.entityId as unknown as Id<"accessions">,
          );
        }
        if (event.entityType.includes("deaccession")) {
          return scope.deaccessionIds.has(
            event.entityId as unknown as Id<"deaccessions">,
          );
        }
        return false;
      })
    : auditLogEntries;

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

export async function buildOrganizationAnalytics(
  ctx: AnalyticsCtx,
  organizationId: Id<"organizations">,
  siteId?: Id<"sites">,
) {
  if (siteId !== undefined) {
    return buildSiteScopedAnalytics(ctx, organizationId, siteId);
  }

  const [
    collectionGroupTotal,
    openDeaccessionCollectionIds,
    deaccessioned,
    loanPending,
    loanActive,
    loanDispatched,
    loanReturned,
    loanCancelled,
    loanIncoming,
    loanOutgoing,
    accessionPending,
    accessionApproved,
    accessionRejected,
    deaccessionPending,
    deaccessionApproved,
    deaccessionRejected,
    transferPending,
    transferExecuted,
    transferRejected,
    transferCancelled,
    locationTotal,
    recentCollectionGroupDocs,
    recentCollectionDocs,
  ] = await Promise.all([
    countCollectionGroups(ctx, organizationId),
    countOpenDeaccessionCollectionIds(ctx, organizationId),
    countCollectionsByStatus(ctx, organizationId, "deaccessioned"),
    countLoansByStatus(ctx, organizationId, "pending"),
    countLoansByStatus(ctx, organizationId, "active"),
    countLoansByStatus(ctx, organizationId, "dispatched"),
    countLoansByStatus(ctx, organizationId, "returned"),
    countLoansByStatus(ctx, organizationId, "cancelled"),
    countLoansByType(ctx, organizationId, "incoming"),
    countLoansByType(ctx, organizationId, "outgoing"),
    countAccessionsByStatus(ctx, organizationId, "pending"),
    countAccessionsByStatus(ctx, organizationId, "approved"),
    countAccessionsByStatus(ctx, organizationId, "rejected"),
    countDeaccessionsByStatus(ctx, organizationId, "pending"),
    countDeaccessionsByStatus(ctx, organizationId, "approved"),
    countDeaccessionsByStatus(ctx, organizationId, "rejected"),
    countTransfersByStatus(ctx, organizationId, "pending"),
    countTransfersByStatus(ctx, organizationId, "executed"),
    countTransfersByStatus(ctx, organizationId, "rejected"),
    countTransfersByStatus(ctx, organizationId, "cancelled"),
    countLocations(ctx, organizationId),
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
  ]);

  const catalogWithDeaccessionExclusion = await countCatalogObjects(
    ctx,
    organizationId,
    openDeaccessionCollectionIds,
  );

  const [recentCollectionGroups, recentObjects, recentActivity] =
    await Promise.all([
      buildRecentCollectionGroups(ctx, recentCollectionGroupDocs),
      buildRecentObjects(ctx, recentCollectionDocs),
      buildRecentActivity(ctx, organizationId),
    ]);

  const loanTotal =
    loanPending + loanActive + loanDispatched + loanReturned + loanCancelled;

  return {
    collections: {
      total: collectionGroupTotal,
    },
    objects: {
      total: catalogWithDeaccessionExclusion.total,
      active: catalogWithDeaccessionExclusion.active,
      loaned: catalogWithDeaccessionExclusion.loaned,
      deaccessioned,
      onDisplay: catalogWithDeaccessionExclusion.onDisplay,
    },
    loans: {
      total: loanTotal,
      pending: loanPending,
      active: loanActive,
      returned: loanReturned,
      incoming: loanIncoming,
      outgoing: loanOutgoing,
    },
    accessions: {
      pending: accessionPending,
      approved: accessionApproved,
      rejected: accessionRejected,
    },
    deaccessions: {
      pending: deaccessionPending,
      approved: deaccessionApproved,
      rejected: deaccessionRejected,
    },
    transfers: {
      pending: transferPending,
      executed: transferExecuted,
      rejected: transferRejected,
      cancelled: transferCancelled,
    },
    locations: {
      total: locationTotal,
    },
    recentCollectionGroups,
    recentObjects,
    recentActivity,
  };
}

async function buildSiteScopedAnalytics(
  ctx: AnalyticsCtx,
  organizationId: Id<"organizations">,
  siteId: Id<"sites">,
) {
  const locations = await ctx.db
    .query("locations")
    .withIndex("by_organization_and_site", (q) =>
      q.eq("organizationId", organizationId).eq("siteId", siteId),
    )
    .collect();

  const collections = await loadSiteCollections(ctx, organizationId, siteId);
  const collectionIds = new Set(collections.map((c) => c._id));

  const allCollectionGroups = await ctx.db
    .query("collectionGroups")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();

  const groupIdsForSite = new Set<Id<"collectionGroups">>();
  for (const collectionId of collectionIds) {
    const items = await ctx.db
      .query("collectionGroupItems")
      .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
      .collect();
    for (const item of items) {
      groupIdsForSite.add(item.collectionGroupId);
    }
  }

  const collectionGroups = allCollectionGroups.filter((g) =>
    groupIdsForSite.has(g._id),
  );

  const [allLoans, allAccessions, allDeaccessions] = await Promise.all([
    ctx.db
      .query("loans")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect(),
    ctx.db
      .query("accessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect(),
    ctx.db
      .query("deaccessions")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect(),
  ]);

  const accessions = allAccessions.filter(
    (a) => a.collectionId && collectionIds.has(a.collectionId),
  );
  const deaccessions = allDeaccessions.filter((d) =>
    collectionIds.has(d.collectionId),
  );

  const loanIdsForSite = new Set<Id<"loans">>();
  for (const collectionId of collectionIds) {
    const items = await ctx.db
      .query("loanItems")
      .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
      .collect();
    for (const item of items) {
      loanIdsForSite.add(item.loanId);
    }
  }
  const loans = allLoans.filter((l) => loanIdsForSite.has(l._id));

  const collectionIdsWithOpenDeaccessions = new Set(
    deaccessions.flatMap((deaccession) =>
      deaccession.status === "pending" || deaccession.status === "approved"
        ? [deaccession.collectionId]
        : [],
    ),
  );
  const catalogObjects = collections.filter(
    (collection) =>
      collection.status !== "deleted" &&
      collection.status !== "deaccessioned" &&
      !collectionIdsWithOpenDeaccessions.has(collection._id),
  );

  const [recentCollectionGroups, recentObjects, recentActivity] =
    await Promise.all([
      buildRecentCollectionGroups(ctx, collectionGroups),
      buildRecentObjects(ctx, collections),
      buildRecentActivity(ctx, organizationId, {
        collectionIds,
        loanIds: loanIdsForSite,
        accessionIds: new Set(accessions.map((a) => a._id)),
        deaccessionIds: new Set(deaccessions.map((d) => d._id)),
        collectionGroupIds: groupIdsForSite,
      }),
    ]);

  const transfers = await ctx.db
    .query("organizationMoveRequests")
    .withIndex("by_source_organization", (q) =>
      q.eq("sourceOrganizationId", organizationId),
    )
    .collect();

  return {
    collections: {
      total: collectionGroups.length,
    },
    objects: {
      total: catalogObjects.length,
      active: catalogObjects.filter((c) => c.status === "active").length,
      loaned: catalogObjects.filter((c) => c.status === "loaned").length,
      deaccessioned: collections.filter((c) => c.status === "deaccessioned")
        .length,
      onDisplay: catalogObjects.filter((c) => c.displayStatus === "on_display")
        .length,
    },
    loans: {
      total: loans.length,
      pending: loans.filter((l) => l.status === "pending").length,
      active: loans.filter((l) => l.status === "active").length,
      returned: loans.filter((l) => l.status === "returned").length,
      incoming: loans.filter((l) => l.type === "incoming").length,
      outgoing: loans.filter((l) => l.type === "outgoing").length,
    },
    accessions: {
      pending: accessions.filter((a) => a.status === "pending").length,
      approved: accessions.filter((a) => a.status === "approved").length,
      rejected: accessions.filter((a) => a.status === "rejected").length,
    },
    deaccessions: {
      pending: deaccessions.filter((d) => d.status === "pending").length,
      approved: deaccessions.filter((d) => d.status === "approved").length,
      rejected: deaccessions.filter((d) => d.status === "rejected").length,
    },
    transfers: {
      pending: transfers.filter((t) => t.status === "pending").length,
      executed: transfers.filter((t) => t.status === "executed").length,
      rejected: transfers.filter((t) => t.status === "rejected").length,
      cancelled: transfers.filter((t) => t.status === "cancelled").length,
    },
    locations: {
      total: locations.length,
    },
    recentCollectionGroups,
    recentObjects,
    recentActivity,
  };
}
