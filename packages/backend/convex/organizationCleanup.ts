import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import {
  internalQuery,
  type MutationCtx,
  type QueryCtx,
  query,
} from "./_generated/server";
import {
  isOrganizationEvidenceProtected,
  rejectPermanentEvidenceDeletion,
} from "./utils/evidenceRetention";
import { internalMutation, mutation } from "./utils/mutationBuilders";
import {
  createEmptyUsageCounter,
  getUsageCounter,
} from "./utils/organizationUsageCounters";
import { requirePermission } from "./utils/permissions";
import { datedEntries, metricTree } from "./utils/projectionStore";

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

type OrganizationFootprint = Infer<typeof organizationFootprintValidator>;
type PurgeOrganizationResult = Infer<typeof purgeOrganizationResultValidator>;

const organizationScopedTables = [
  "organizationDeletions",
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
  "coinsStampsDetails",
  "accessions",
  "deaccessions",
  "appraisals",
  "locations",
  "locationMoveRequests",
  "accounts",
  "accountCounters",
  "loanCounters",
  "loans",
  "loanAgreementTemplates",
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
  "importRowResults",
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
  "legacyCoverageReviews",
  "insuranceClaims",
  "claimCounters",
  "transitRecords",
  "transitCounters",
  "installationTasks",
  "installationTaskTemplates",
  "contacts",
  "accountRelationships",
  "partyLinks",
  "partyDuplicateReviews",
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
  "renditionStorageId",
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
  if (
    currentKey &&
    storageIdFieldNames.has(currentKey) &&
    typeof value === "string"
  ) {
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

  const roles = await Promise.all(
    memberships.map((membership) => ctx.db.get(membership.roleId)),
  );

  for (const [index, membership] of memberships.entries()) {
    const role = roles[index];
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
): Promise<OrganizationFootprint | null> {
  const organization = await ctx.db.get(organizationId);
  if (!organization) {
    return null;
  }

  const [usageCounter, notifications, workflowSlaConfigs, auditLog] =
    await Promise.all([
      getUsageCounter(ctx, organizationId),
      ctx.db
        .query("notifications")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId),
        )
        .collect(),
      collectOrganizationScopedDocs(ctx, "workflowSlaConfigs", organizationId),
      ctx.db
        .query("auditLog")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organizationId),
        )
        .collect(),
    ] as const);

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

interface DerivedDocuments {
  organizationProjectionStates: Array<Doc<"organizationProjectionStates">>;
  projectionFanOuts: Array<Doc<"projectionFanOuts">>;
  projectionGenerations: Array<Doc<"projectionGenerations">>;
  projectionContributions: Array<Doc<"projectionContributions">>;
  projectionTotals: Array<Doc<"projectionTotals">>;
  projectionDiscrepancies: Array<Doc<"projectionDiscrepancies">>;
  exportJobs: Array<Doc<"exportJobs">>;
  exportSelections: Array<Doc<"exportSelections">>;
  exportChunks: Array<Doc<"exportChunks">>;
  exportParts: Array<Doc<"exportParts">>;
  caseHistoryState: Array<Doc<"caseHistoryState">>;
  caseHistoryEntries: Array<Doc<"caseHistoryEntries">>;
  webhookEvents: Array<Doc<"webhookEvents">>;
  webhookDeliveries: Array<Doc<"webhookDeliveries">>;
  webhookDeliveryAttempts: Array<Doc<"webhookDeliveryAttempts">>;
}

/** Export, projection, case-history and webhook delivery rows, read through organization or parent indexes. */
async function collectDerivedDocuments(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
): Promise<DerivedDocuments> {
  const [
    organizationProjectionStates,
    projectionFanOuts,
    projectionGenerations,
    exportJobs,
    caseHistoryState,
    caseHistoryEntries,
    webhookEvents,
    webhookDeliveries,
    webhookDeliveryAttempts,
  ] = await Promise.all([
    ctx.db
      .query("organizationProjectionStates")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect(),
    ctx.db
      .query("projectionFanOuts")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect(),
    ctx.db
      .query("projectionGenerations")
      .withIndex("by_organizationId_and_startedAt", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect(),
    ctx.db
      .query("exportJobs")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect(),
    ctx.db
      .query("caseHistoryState")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect(),
    ctx.db
      .query("caseHistoryEntries")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect(),
    ctx.db
      .query("webhookEvents")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect(),
    ctx.db
      .query("webhookDeliveries")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect(),
    ctx.db
      .query("webhookDeliveryAttempts")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", organizationId),
      )
      .collect(),
  ]);
  const perGeneration = await Promise.all(
    projectionGenerations.map(async (generation) => {
      const [contributions, totals, discrepancies] = await Promise.all([
        ctx.db
          .query("projectionContributions")
          .withIndex("by_generationId", (q) =>
            q.eq("generationId", generation._id),
          )
          .collect(),
        ctx.db
          .query("projectionTotals")
          .withIndex("by_generationId", (q) =>
            q.eq("generationId", generation._id),
          )
          .collect(),
        ctx.db
          .query("projectionDiscrepancies")
          .withIndex("by_generationId", (q) =>
            q.eq("generationId", generation._id),
          )
          .collect(),
      ]);
      return { contributions, totals, discrepancies };
    }),
  );
  const perJob = await Promise.all(
    exportJobs.map(async (job) => {
      const [selections, chunks, parts] = await Promise.all([
        ctx.db
          .query("exportSelections")
          .withIndex("by_jobId", (q) => q.eq("jobId", job._id))
          .collect(),
        ctx.db
          .query("exportChunks")
          .withIndex("by_jobId_and_sequence", (q) => q.eq("jobId", job._id))
          .collect(),
        ctx.db
          .query("exportParts")
          .withIndex("by_jobId_and_level_and_sequence", (q) =>
            q.eq("jobId", job._id),
          )
          .collect(),
      ]);
      return { selections, chunks, parts };
    }),
  );
  return {
    organizationProjectionStates,
    projectionFanOuts,
    projectionGenerations,
    projectionContributions: perGeneration.flatMap(
      (entry) => entry.contributions,
    ),
    projectionTotals: perGeneration.flatMap((entry) => entry.totals),
    projectionDiscrepancies: perGeneration.flatMap(
      (entry) => entry.discrepancies,
    ),
    exportJobs,
    exportSelections: perJob.flatMap((entry) => entry.selections),
    exportChunks: perJob.flatMap((entry) => entry.chunks),
    exportParts: perJob.flatMap((entry) => entry.parts),
    caseHistoryState,
    caseHistoryEntries,
    webhookEvents,
    webhookDeliveries,
    webhookDeliveryAttempts,
  };
}

/**
 * Projection state goes first so source deletions in the same purge no longer
 * maintain a generation; contribution removal also removes its metric entries.
 */
async function deleteDerivedDocuments(
  ctx: MutationCtx,
  derived: DerivedDocuments,
) {
  await deleteDocuments(ctx, derived.organizationProjectionStates);
  const generations = new Map(
    derived.projectionGenerations.map((generation) => [
      generation._id,
      generation,
    ]),
  );
  for (const contribution of derived.projectionContributions) {
    const generation = generations.get(contribution.generationId);
    if (!generation) continue;
    for (const entry of datedEntries(
      generation,
      contribution.sourceTable,
      contribution.sourceId,
      contribution.facts,
    ).values()) {
      await metricTree.deleteIfExists(ctx, {
        namespace: entry.namespace,
        key: entry.key,
        id: entry.id,
      });
    }
  }
  const { organizationProjectionStates: _states, ...rest } = derived;
  for (const docs of Object.values(rest)) await deleteDocuments(ctx, docs);
}

type OrganizationPurgeSnapshot = {
  childDocuments: ChildDocumentGroups;
  derivedDocuments: DerivedDocuments;
  organization: Doc<"organizations">;
  organizationDocuments: Array<{
    docs: Array<Record<string, unknown> & { _id: Id<TableNames> }>;
    table: OrganizationScopedTableName;
  }>;
  storageIds: Array<Id<"_storage">>;
  tableCounts: Array<{ count: number; table: string }>;
};

function getOrganizationDocsForTable<
  TableName extends OrganizationScopedTableName,
>(
  organizationDocuments: OrganizationPurgeSnapshot["organizationDocuments"],
  tableName: TableName,
) {
  return (organizationDocuments.find((entry) => entry.table === tableName)
    ?.docs ?? []) as Array<Doc<TableName>>;
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
  const accounts = getOrganizationDocsForTable(
    organizationDocuments,
    "accounts",
  );
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
            collectionGroupIds.includes(doc.collectionGroupId) ||
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
            (doc.toLocationId !== undefined &&
              locationIds.includes(doc.toLocationId)),
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
      .then((docs) =>
        docs.filter((doc) => exhibitionIds.includes(doc.exhibitionId)),
      ),
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
      .then((docs) =>
        docs.filter((doc) => installationTaskIds.includes(doc.taskId)),
      ),
    ctx.db
      .query("installationTaskChecklists")
      .collect()
      .then((docs) =>
        docs.filter((doc) => installationTaskIds.includes(doc.taskId)),
      ),
    ctx.db
      .query("userPreferences")
      .collect()
      .then((docs) =>
        docs.filter((doc) => doc.organizationId === organizationId),
      ),
  ] as const);

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

  const derivedDocuments = await collectDerivedDocuments(ctx, organizationId);
  const childDocumentEntries = Object.entries({
    ...childDocuments,
    ...derivedDocuments,
  }).map(([table, docs]) => ({
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
      childDocumentEntries.flatMap(
        (entry) => entry.docs as Array<Record<string, unknown>>,
      ),
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
    derivedDocuments,
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
  await Promise.all(
    Array.from(docs).map(async (doc) => {
      await ctx.db.delete(doc._id);
    }),
  );
}

export const getOrganizationFootprints = query({
  args: {
    organizationIds: v.optional(v.array(v.id("organizations"))),
  },
  returns: v.array(organizationFootprintValidator),
  handler: async (ctx, args): Promise<Array<OrganizationFootprint>> => {
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
  handler: async (ctx, args): Promise<Array<OrganizationFootprint>> => {
    const footprints = await Promise.all(
      args.organizationIds.map((organizationId) =>
        buildOrganizationFootprint(ctx, organizationId),
      ),
    );

    return footprints.filter(
      (footprint): footprint is NonNullable<typeof footprint> =>
        footprint !== null,
    );
  },
});

export const purgeOrganizations = mutation({
  args: {
    organizationIds: v.array(v.id("organizations")),
    dryRun: v.boolean(),
  },
  returns: v.array(purgeOrganizationResultValidator),
  handler: async (ctx, args): Promise<Array<PurgeOrganizationResult>> => {
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
  handler: async (ctx, args): Promise<Array<PurgeOrganizationResult>> => {
    const results = (
      await Promise.all(
        Array.from(args.organizationIds).map(async (organizationId) => {
          const snapshot = await collectPurgeSnapshot(ctx, organizationId);
          if (!snapshot) {
            return null;
          }

          const storageByteSizes = await Promise.all(
            Array.from(snapshot.storageIds).map(async (storageId) => {
              const storageDoc = await ctx.db.system.get(storageId);
              return storageDoc?.size ?? 0;
            }),
          );
          const storageBytes = storageByteSizes.reduce<number>(
            (total, size) => total + size,
            0,
          );

          if (
            !args.dryRun &&
            ((await isOrganizationEvidenceProtected(ctx, organizationId)) ||
              snapshot.tableCounts.some(
                (entry) =>
                  entry.count > 0 &&
                  [
                    "collections",
                    "accessions",
                    "deaccessions",
                    "mediaFiles",
                    "mediaVersions",
                    "locationHistory",
                    "appraisals",
                    "conservationTreatments",
                    "conservationAttachments",
                    "loans",
                    "loanItems",
                    "loanDocuments",
                    "conditionReports",
                    "exhibitions",
                    "exhibitionObjects",
                    "exhibitionDocuments",
                    "transitRecords",
                    "transitItems",
                    "transitStatusUpdates",
                    "installationTasks",
                    "installationTaskComments",
                    "installationTaskChecklists",
                    "fineArtDetails",
                    "vehicleDetails",
                    "wineDetails",
                    "naturalHistoryDetails",
                    "archiveDetails",
                    "coinsStampsDetails",
                    "insurancePolicies",
                    "insuranceCoverages",
                    "insuranceClaims",
                    "accountDocuments",
                    "accountRelationships",
                    "partyLinks",
                    "objectComments",
                    "workflowHistory",
                    "workflowStepApprovals",
                    "organizationMoveRequests",
                  ].includes(entry.table),
              ))
          ) {
            rejectPermanentEvidenceDeletion();
          }

          if (!args.dryRun) {
            await deleteDerivedDocuments(ctx, snapshot.derivedDocuments);
            await Promise.all([
              Promise.all(
                Array.from(snapshot.storageIds).map(async (storageId) => {
                  await ctx.storage.delete(storageId);
                }),
              ),
              deleteDocuments(ctx, snapshot.childDocuments.rolePermissions),
              deleteDocuments(ctx, snapshot.childDocuments.userSites),
              deleteDocuments(
                ctx,
                snapshot.childDocuments.collectionGroupItems,
              ),
              deleteDocuments(ctx, snapshot.childDocuments.locationHistory),
              deleteDocuments(
                ctx,
                snapshot.childDocuments.organizationMoveRequests,
              ),
              deleteDocuments(ctx, snapshot.childDocuments.accountRoles),
              deleteDocuments(ctx, snapshot.childDocuments.loanDocuments),
              deleteDocuments(ctx, snapshot.childDocuments.conditionReports),
              deleteDocuments(ctx, snapshot.childDocuments.loanItems),
              deleteDocuments(ctx, snapshot.childDocuments.exhibitionDocuments),
              deleteDocuments(ctx, snapshot.childDocuments.transitItems),
              deleteDocuments(
                ctx,
                snapshot.childDocuments.transitStatusUpdates,
              ),
              deleteDocuments(
                ctx,
                snapshot.childDocuments.installationTaskComments,
              ),
              deleteDocuments(
                ctx,
                snapshot.childDocuments.installationTaskChecklists,
              ),
              deleteDocuments(ctx, snapshot.childDocuments.userPreferences),
              Promise.all(
                Array.from(snapshot.organizationDocuments).flatMap((entry) =>
                  entry.docs.map((doc) => ctx.db.delete(doc._id)),
                ),
              ),
              ctx.db.delete(snapshot.organization._id),
            ] as const);
          }

          return {
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
          };
        }),
      )
    ).filter((result): result is NonNullable<typeof result> => result !== null);

    return results;
  },
});

export const getRetentionPolicy = query({
  args: { organizationId: v.id("organizations") },
  returns: v.object({ canDeleteOrganization: v.boolean() }),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      "organization.manage_settings",
    );
    return {
      canDeleteOrganization: !(await isOrganizationEvidenceProtected(
        ctx,
        args.organizationId,
      )),
    };
  },
});

export const reviewRetainedCollections = query({
  args: {
    organizationId: v.id("organizations"),
    status: v.union(v.literal("deleted"), v.literal("archived")),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        collectionId: v.id("collections"),
        title: v.string(),
        accessionNumber: v.string(),
        withdrawalReason: v.union(v.string(), v.null()),
        requiresReview: v.boolean(),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "collections.read");
    const result = await ctx.db
      .query("collections")
      .withIndex("by_organization_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", args.status),
      )
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(args.paginationOpts.numItems, 100),
      });
    return {
      isDone: result.isDone,
      continueCursor: result.continueCursor,
      page: result.page.map((collection) => {
        const reason =
          collection.archivedReason ?? collection.deletedReason ?? null;
        return {
          collectionId: collection._id,
          title: collection.title,
          accessionNumber: collection.accessionNumber,
          withdrawalReason: reason,
          requiresReview:
            !reason?.trim() ||
            !(collection.archivedAt ?? collection.deletedAt) ||
            !(collection.archivedBy ?? collection.deletedBy),
        };
      }),
    };
  },
});
