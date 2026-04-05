import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  createEmptyUsageCounter,
  getUsageCounter,
} from "./utils/organizationUsageCounters";

const organizationTypeValidator = v.union(
  v.literal("museum"),
  v.literal("gallery"),
  v.literal("library"),
  v.literal("collector"),
);

const organizationFootprintValidator = v.object({
  organizationId: v.id("organizations"),
  name: v.string(),
  slug: v.string(),
  type: organizationTypeValidator,
  objectCount: v.number(),
  mediaFileCount: v.number(),
  mediaVersionCount: v.number(),
  storageBytes: v.number(),
  notificationCount: v.number(),
  workflowSlaConfigCount: v.number(),
  recentActivityAt: v.union(v.number(), v.null()),
  recentActivityCount: v.number(),
});

const tableCountValidator = v.object({
  table: v.string(),
  count: v.number(),
});

const purgeOrganizationResultValidator = v.object({
  organizationId: v.id("organizations"),
  organizationName: v.string(),
  dryRun: v.boolean(),
  tableCounts: v.array(tableCountValidator),
  totalDocuments: v.number(),
  storageFiles: v.number(),
  storageBytes: v.number(),
});

const organizationScopedTables = [
  "organizationUsageCounters",
  "userOrganizations",
  "roles",
  "organizationInvitations",
  "sites",
  "searchHistory",
  "collectionGroups",
  "collections",
  "accessionCounters",
  "deaccessionCounters",
  "accessionTemplates",
  "conditionOptions",
  "materialOptions",
  "typeOptions",
  "donors",
  "mediaFiles",
  "mediaVersions",
  "mediaEditHistory",
  "mediaDownloads",
  "fineArtDetails",
  "wineDetails",
  "vehicleDetails",
  "naturalHistoryDetails",
  "archiveDetails",
  "accessions",
  "deaccessions",
  "appraisals",
  "locations",
  "locationMoveRequests",
  "accounts",
  "accountCounters",
  "loanCounters",
  "loans",
  "loanExtensionRequests",
  "loanReminders",
  "conditionDisputes",
  "conservationTreatments",
  "assessmentSchedules",
  "environmentalReadings",
  "conservationAttachments",
  "conservationAlertRules",
  "conservationAlerts",
  "exhibitions",
  "exhibitionObjects",
  "auditLog",
  "notifications",
  "notificationPreferences",
  "workflowConfigs",
  "workflowHistory",
  "workflowStepApprovals",
  "workflowSlaConfigs",
  "webhooks",
  "apiKeys",
  "importJobs",
  "importValidationReports",
  "importFieldMappings",
  "exportUsage",
  "libraryItems",
  "membershipTypes",
  "circulations",
  "libraryHolds",
  "libraryRecalls",
  "libraryFines",
  "libraryPayments",
  "libraryAcquisitionRequests",
  "libraryVendors",
  "serialSubscriptions",
  "serialIssues",
  "librarySettings",
  "insurancePolicies",
  "insuranceCoverages",
  "insuranceClaims",
  "claimCounters",
  "transitRecords",
  "transitCounters",
  "installationTasks",
  "installationTaskTemplates",
  "integrationSubscriptions",
  "contacts",
  "accountRelationships",
  "accountDocuments",
  "accountSegments",
  "scheduledReports",
  "reportRuns",
  "batchJobs",
  "savedViews",
  "objectComments",
] as const;

type OrganizationScopedTableName = (typeof organizationScopedTables)[number];

const storageIdFieldNames = new Set([
  "storageId",
  "thumbnailStorageId",
  "logoId",
  "imageId",
  "proceedsReceiptDocument",
]);

const storageIdArrayFieldNames = new Set([
  "documents",
  "documentIds",
  "regulatoryApprovalDocuments",
  "photos",
  "photoIds",
  "attachmentIds",
  "conditionBeforePhotos",
  "conditionAfterPhotos",
  "investigationPhotos",
  "disputeDocumentIds",
]);

type AdminContext = QueryCtx | MutationCtx;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueStorageIds(ids: Iterable<Id<"_storage">>) {
  return Array.from(new Set(ids)) as Array<Id<"_storage">>;
}

function collectStorageIdsFromValue(
  value: unknown,
  storageIds: Set<Id<"_storage">>,
  currentKey?: string,
) {
  if (currentKey && storageIdFieldNames.has(currentKey) && typeof value === "string") {
    storageIds.add(value as Id<"_storage">);
    return;
  }

  if (
    currentKey &&
    storageIdArrayFieldNames.has(currentKey) &&
    Array.isArray(value)
  ) {
    for (const entry of value) {
      if (typeof entry === "string") {
        storageIds.add(entry as Id<"_storage">);
      } else {
        collectStorageIdsFromValue(entry, storageIds);
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectStorageIdsFromValue(entry, storageIds);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    collectStorageIdsFromValue(nestedValue, storageIds, key);
  }
}

function collectStorageIdsFromDocs(
  docs: ReadonlyArray<Record<string, unknown>>,
): Array<Id<"_storage">> {
  const storageIds = new Set<Id<"_storage">>();
  for (const doc of docs) {
    collectStorageIdsFromValue(doc, storageIds);
  }
  return uniqueStorageIds(storageIds);
}

async function getAdminOrganizationIdsForCurrentUser(ctx: AdminContext) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError("Not authenticated");
  }

  const memberships = await ctx.db
    .query("userOrganizations")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  const adminOrganizationIds: Array<Id<"organizations">> = [];

  for (const membership of memberships) {
    const role = await ctx.db.get(membership.roleId);
    if (role?.name.toLowerCase() === "admin") {
      adminOrganizationIds.push(membership.organizationId);
    }
  }

  return uniqueIds(adminOrganizationIds);
}

function uniqueIds<TableName extends TableNames>(ids: Array<Id<TableName>>) {
  return Array.from(new Set(ids)) as Array<Id<TableName>>;
}

async function resolveRequestedOrganizationIds(
  ctx: AdminContext,
  requestedOrganizationIds?: Array<Id<"organizations">>,
) {
  const adminOrganizationIds = await getAdminOrganizationIdsForCurrentUser(ctx);

  if (!requestedOrganizationIds || requestedOrganizationIds.length === 0) {
    return adminOrganizationIds;
  }

  const adminOrganizationIdSet = new Set(adminOrganizationIds);
  for (const organizationId of requestedOrganizationIds) {
    if (!adminOrganizationIdSet.has(organizationId)) {
      throw new ConvexError("Admin access is required for every organization");
    }
  }

  return uniqueIds(requestedOrganizationIds);
}

async function collectOrganizationScopedDocs<
  TableName extends OrganizationScopedTableName,
>(
  ctx: QueryCtx | MutationCtx,
  tableName: TableName,
  organizationId: Id<"organizations">,
) {
  const docs = await ctx.db.query(tableName).collect();
  return docs.filter((doc) => doc.organizationId === organizationId);
}

async function buildOrganizationFootprint(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
) {
  const organization = await ctx.db.get(organizationId);
  if (!organization) {
    return null;
  }

  const [usageCounter, notifications, workflowSlaConfigs, auditLog] =
    await Promise.all([
      getUsageCounter(ctx, organizationId),
      ctx.db
        .query("notifications")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect(),
      collectOrganizationScopedDocs(ctx, "workflowSlaConfigs", organizationId),
      ctx.db
        .query("auditLog")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect(),
    ]);

  const counter = usageCounter ?? createEmptyUsageCounter(organizationId);
  const recentActivityCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentActivity = auditLog.filter(
    (entry) => entry.timestamp >= recentActivityCutoff,
  );
  const recentActivityAt =
    auditLog.length > 0
      ? auditLog.reduce(
          (latestTimestamp, entry) =>
            Math.max(latestTimestamp, entry.timestamp),
          0,
        )
      : null;

  return {
    organizationId,
    name: organization.name,
    slug: organization.slug,
    type: organization.type,
    objectCount: counter.objectCount,
    mediaFileCount: counter.mediaFileCount,
    mediaVersionCount: counter.mediaVersionCount,
    storageBytes: counter.storageBytes,
    notificationCount: notifications.length,
    workflowSlaConfigCount: workflowSlaConfigs.filter(
      (config) => config.isActive !== false,
    ).length,
    recentActivityAt,
    recentActivityCount: recentActivity.length,
  };
}

type ChildDocumentGroups = {
  accountRoles: Array<Doc<"accountRoles">>;
  collectionGroupItems: Array<Doc<"collectionGroupItems">>;
  conditionReports: Array<Doc<"conditionReports">>;
  exhibitionDocuments: Array<Doc<"exhibitionDocuments">>;
  installationTaskChecklists: Array<Doc<"installationTaskChecklists">>;
  installationTaskComments: Array<Doc<"installationTaskComments">>;
  loanDocuments: Array<Doc<"loanDocuments">>;
  loanItems: Array<Doc<"loanItems">>;
  locationHistory: Array<Doc<"locationHistory">>;
  organizationMoveRequests: Array<Doc<"organizationMoveRequests">>;
  rolePermissions: Array<Doc<"rolePermissions">>;
  transitItems: Array<Doc<"transitItems">>;
  transitStatusUpdates: Array<Doc<"transitStatusUpdates">>;
  userPreferences: Array<Doc<"userPreferences">>;
  userSites: Array<Doc<"userSites">>;
};

type OrganizationPurgeSnapshot = {
  childDocuments: ChildDocumentGroups;
  organization: Doc<"organizations">;
  organizationDocuments: Array<{
    docs: Array<Record<string, unknown> & { _id: Id<TableNames> }>;
    table: OrganizationScopedTableName;
  }>;
  storageIds: Array<Id<"_storage">>;
  tableCounts: Array<{ count: number; table: string }>;
};

function getOrganizationDocsForTable<TableName extends OrganizationScopedTableName>(
  organizationDocuments: OrganizationPurgeSnapshot["organizationDocuments"],
  tableName: TableName,
) {
  return (organizationDocuments.find((entry) => entry.table === tableName)?.docs ??
    []) as Array<Doc<TableName>>;
}

async function collectPurgeSnapshot(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
): Promise<OrganizationPurgeSnapshot | null> {
  const organization = await ctx.db.get(organizationId);
  if (!organization) {
    return null;
  }

  const organizationDocuments = await Promise.all(
    organizationScopedTables.map(async (table) => ({
      table,
      docs: (await collectOrganizationScopedDocs(
        ctx,
        table,
        organizationId,
      )) as Array<Record<string, unknown> & { _id: Id<TableNames> }>,
    })),
  );

  const roles = getOrganizationDocsForTable(organizationDocuments, "roles");
  const sites = getOrganizationDocsForTable(organizationDocuments, "sites");
  const collectionGroups = getOrganizationDocsForTable(
    organizationDocuments,
    "collectionGroups",
  );
  const collections = getOrganizationDocsForTable(
    organizationDocuments,
    "collections",
  );
  const accounts = getOrganizationDocsForTable(organizationDocuments, "accounts");
  const loans = getOrganizationDocsForTable(organizationDocuments, "loans");
  const exhibitions = getOrganizationDocsForTable(
    organizationDocuments,
    "exhibitions",
  );
  const transitRecords = getOrganizationDocsForTable(
    organizationDocuments,
    "transitRecords",
  );
  const installationTasks = getOrganizationDocsForTable(
    organizationDocuments,
    "installationTasks",
  );

  const roleIds = roles.map((role) => role._id);
  const siteIds = sites.map((site) => site._id);
  const collectionGroupIds = collectionGroups.map((group) => group._id);
  const collectionIds = collections.map((collection) => collection._id);
  const accountIds = accounts.map((account) => account._id);
  const loanIds = loans.map((loan) => loan._id);
  const exhibitionIds = exhibitions.map((exhibition) => exhibition._id);
  const transitRecordIds = transitRecords.map((record) => record._id);
  const installationTaskIds = installationTasks.map((task) => task._id);
  const locationIds = getOrganizationDocsForTable(
    organizationDocuments,
    "locations",
  ).map((location) => location._id);

  const [
    rolePermissions,
    userSites,
    collectionGroupItems,
    locationHistory,
    organizationMoveRequests,
    accountRoles,
    loanItems,
    loanDocuments,
    exhibitionDocuments,
    transitItems,
    transitStatusUpdates,
    installationTaskComments,
    installationTaskChecklists,
    userPreferences,
  ] = await Promise.all([
    ctx.db
      .query("rolePermissions")
      .collect()
      .then((docs) => docs.filter((doc) => roleIds.includes(doc.roleId))),
    ctx.db
      .query("userSites")
      .collect()
      .then((docs) => docs.filter((doc) => siteIds.includes(doc.siteId))),
    ctx.db
      .query("collectionGroupItems")
      .collect()
      .then((docs) =>
        docs.filter(
          (doc) =>
            collectionGroupIds.includes(doc.groupId) ||
            collectionIds.includes(doc.collectionId),
        ),
      ),
    ctx.db
      .query("locationHistory")
      .collect()
      .then((docs) =>
        docs.filter(
          (doc) =>
            collectionIds.includes(doc.collectionId) ||
            (doc.fromLocationId !== undefined &&
              locationIds.includes(doc.fromLocationId)) ||
            locationIds.includes(doc.toLocationId),
        ),
      ),
    ctx.db
      .query("organizationMoveRequests")
      .collect()
      .then((docs) =>
        docs.filter(
          (doc) =>
            doc.sourceOrganizationId === organizationId ||
            doc.targetOrganizationId === organizationId ||
            collectionIds.includes(doc.collectionId),
        ),
      ),
    ctx.db
      .query("accountRoles")
      .collect()
      .then((docs) => docs.filter((doc) => accountIds.includes(doc.accountId))),
    ctx.db
      .query("loanItems")
      .collect()
      .then((docs) =>
        docs.filter(
          (doc) =>
            loanIds.includes(doc.loanId) ||
            collectionIds.includes(doc.collectionId),
        ),
      ),
    ctx.db
      .query("loanDocuments")
      .collect()
      .then((docs) => docs.filter((doc) => loanIds.includes(doc.loanId))),
    ctx.db
      .query("exhibitionDocuments")
      .collect()
      .then((docs) => docs.filter((doc) => exhibitionIds.includes(doc.exhibitionId))),
    ctx.db
      .query("transitItems")
      .collect()
      .then((docs) =>
        docs.filter((doc) => transitRecordIds.includes(doc.transitRecordId)),
      ),
    ctx.db
      .query("transitStatusUpdates")
      .collect()
      .then((docs) =>
        docs.filter((doc) => transitRecordIds.includes(doc.transitRecordId)),
      ),
    ctx.db
      .query("installationTaskComments")
      .collect()
      .then((docs) => docs.filter((doc) => installationTaskIds.includes(doc.taskId))),
    ctx.db
      .query("installationTaskChecklists")
      .collect()
      .then((docs) => docs.filter((doc) => installationTaskIds.includes(doc.taskId))),
    ctx.db
      .query("userPreferences")
      .collect()
      .then((docs) => docs.filter((doc) => doc.organizationId === organizationId)),
  ]);

  const conditionReports = await ctx.db
    .query("conditionReports")
    .collect()
    .then((docs) =>
      docs.filter((doc) =>
        loanItems.some((loanItem) => loanItem._id === doc.loanItemId),
      ),
    );

  const childDocuments: ChildDocumentGroups = {
    accountRoles,
    collectionGroupItems,
    conditionReports,
    exhibitionDocuments,
    installationTaskChecklists,
    installationTaskComments,
    loanDocuments,
    loanItems,
    locationHistory,
    organizationMoveRequests,
    rolePermissions,
    transitItems,
    transitStatusUpdates,
    userPreferences,
    userSites,
  };

  const childDocumentEntries = Object.entries(childDocuments).map(([table, docs]) => ({
    table,
    docs,
  }));

  const storageIds = uniqueStorageIds([
    ...collectStorageIdsFromDocs([
      organization as unknown as Record<string, unknown>,
    ]),
    ...collectStorageIdsFromDocs(
      organizationDocuments.flatMap((entry) => entry.docs),
    ),
    ...collectStorageIdsFromDocs(
      childDocumentEntries.flatMap((entry) => entry.docs as Array<Record<string, unknown>>),
    ),
  ]);

  const tableCounts = [
    {
      table: "organizations",
      count: 1,
    },
    ...childDocumentEntries.map((entry) => ({
      table: entry.table,
      count: entry.docs.length,
    })),
    ...organizationDocuments.map((entry) => ({
      table: entry.table,
      count: entry.docs.length,
    })),
  ]
    .filter((entry) => entry.count > 0)
    .sort((left, right) => right.count - left.count);

  return {
    childDocuments,
    organization,
    organizationDocuments,
    storageIds,
    tableCounts,
  };
}

async function deleteDocuments<TableName extends TableNames>(
  ctx: MutationCtx,
  docs: Array<Doc<TableName>>,
) {
  for (const doc of docs) {
    await ctx.db.delete(doc._id);
  }
}

export const getOrganizationFootprints = query({
  args: {
    organizationIds: v.optional(v.array(v.id("organizations"))),
  },
  returns: v.array(organizationFootprintValidator),
  handler: async (ctx, args) => {
    const organizationIds = await resolveRequestedOrganizationIds(
      ctx,
      args.organizationIds,
    );

    if (organizationIds.length === 0) {
      return [];
    }

    return await ctx.runQuery(
      internal.organizationCleanup.getOrganizationFootprintsInternal,
      { organizationIds },
    );
  },
});

export const getOrganizationFootprintsInternal = internalQuery({
  args: {
    organizationIds: v.array(v.id("organizations")),
  },
  returns: v.array(organizationFootprintValidator),
  handler: async (ctx, args) => {
    const footprints = await Promise.all(
      args.organizationIds.map((organizationId) =>
        buildOrganizationFootprint(ctx, organizationId),
      ),
    );

    return footprints.filter(
      (footprint): footprint is NonNullable<typeof footprint> => footprint !== null,
    );
  },
});

export const purgeOrganizations = mutation({
  args: {
    organizationIds: v.array(v.id("organizations")),
    dryRun: v.boolean(),
  },
  returns: v.array(purgeOrganizationResultValidator),
  handler: async (ctx, args) => {
    const organizationIds = await resolveRequestedOrganizationIds(
      ctx,
      args.organizationIds,
    );

    return await ctx.runMutation(
      internal.organizationCleanup.purgeOrganizationsInternal,
      {
        organizationIds,
        dryRun: args.dryRun,
      },
    );
  },
});

export const purgeOrganizationsInternal = internalMutation({
  args: {
    organizationIds: v.array(v.id("organizations")),
    dryRun: v.boolean(),
  },
  returns: v.array(purgeOrganizationResultValidator),
  handler: async (ctx, args) => {
    const results: Array<{
      organizationId: Id<"organizations">;
      organizationName: string;
      dryRun: boolean;
      tableCounts: Array<{ count: number; table: string }>;
      totalDocuments: number;
      storageFiles: number;
      storageBytes: number;
    }> = [];

    for (const organizationId of args.organizationIds) {
      const snapshot = await collectPurgeSnapshot(ctx, organizationId);
      if (!snapshot) {
        continue;
      }

      let storageBytes = 0;
      for (const storageId of snapshot.storageIds) {
        const storageDoc = await ctx.db.system.get(storageId);
        storageBytes += storageDoc?.size ?? 0;
      }

      if (!args.dryRun) {
        for (const storageId of snapshot.storageIds) {
          await ctx.storage.delete(storageId);
        }

        await deleteDocuments(ctx, snapshot.childDocuments.rolePermissions);
        await deleteDocuments(ctx, snapshot.childDocuments.userSites);
        await deleteDocuments(ctx, snapshot.childDocuments.collectionGroupItems);
        await deleteDocuments(ctx, snapshot.childDocuments.locationHistory);
        await deleteDocuments(ctx, snapshot.childDocuments.organizationMoveRequests);
        await deleteDocuments(ctx, snapshot.childDocuments.accountRoles);
        await deleteDocuments(ctx, snapshot.childDocuments.loanDocuments);
        await deleteDocuments(ctx, snapshot.childDocuments.conditionReports);
        await deleteDocuments(ctx, snapshot.childDocuments.loanItems);
        await deleteDocuments(ctx, snapshot.childDocuments.exhibitionDocuments);
        await deleteDocuments(ctx, snapshot.childDocuments.transitItems);
        await deleteDocuments(ctx, snapshot.childDocuments.transitStatusUpdates);
        await deleteDocuments(ctx, snapshot.childDocuments.installationTaskComments);
        await deleteDocuments(
          ctx,
          snapshot.childDocuments.installationTaskChecklists,
        );
        await deleteDocuments(ctx, snapshot.childDocuments.userPreferences);

        for (const entry of snapshot.organizationDocuments) {
          for (const doc of entry.docs) {
            await ctx.db.delete(doc._id);
          }
        }

        await ctx.db.delete(snapshot.organization._id);
      }

      results.push({
        organizationId,
        organizationName: snapshot.organization.name,
        dryRun: args.dryRun,
        tableCounts: snapshot.tableCounts,
        totalDocuments: snapshot.tableCounts.reduce(
          (total, entry) => total + entry.count,
          0,
        ),
        storageFiles: snapshot.storageIds.length,
        storageBytes,
      });
    }

    return results;
  },
});
