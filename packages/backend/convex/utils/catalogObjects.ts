import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { syncCollectionOptionUsages } from "./collectionOptionUsages";
import { enforceObjectQuota } from "./featureGates";
import {
  ensureIdentifierAvailable,
  generateConfiguredIdentifier,
} from "./identifiers";
import {
  moveCollectionToLocation,
  requireUsableLocation,
} from "./locationIntegrity";
import { applyUsageCounterDelta } from "./organizationUsageCounters";
import { emitWebhookEvent } from "./webhookEvents";

export async function buildConditionHistoryEntry(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  condition: string,
  note?: string,
) {
  const user = await ctx.db.get(userId);

  return {
    condition,
    note,
    changedAt: Date.now(),
    changedBy: userId,
    changedByName: user?.name ?? user?.username ?? user?.email ?? undefined,
  };
}

export async function syncCollectionGroupMemberships(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
  organizationId: Id<"organizations">,
  groupIds: Id<"collectionGroups">[],
  userId: Id<"users">,
) {
  const uniqueGroupIds = [...new Set(groupIds)];
  const existingMemberships = await ctx.db
    .query("collectionGroupItems")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  const existingGroupIds = new Set(
    existingMemberships.map((membership) => membership.collectionGroupId),
  );
  const nextGroupIds = new Set(uniqueGroupIds);
  await Promise.all([
    Promise.all(
      Array.from(uniqueGroupIds).map(async (groupId) => {
        const group = await ctx.db.get(groupId);
        if (!group) {
          throw new Error("Collection group not found");
        }
        if (group.organizationId !== organizationId) {
          throw new Error(
            "Collection group belongs to a different organization",
          );
        }
      }),
    ),
    Promise.all(
      Array.from(uniqueGroupIds).map(async (groupId) => {
        if (existingGroupIds.has(groupId)) {
          return;
        }
        const group = await ctx.db.get(groupId);
        await ctx.db.insert("collectionGroupItems", {
          collectionGroupId: groupId,
          collectionId,
          addedAt: Date.now(),
          addedBy: userId,
        });
        if (group) {
          await ctx.db.patch(groupId, {
            itemsCount: (group.itemsCount || 0) + 1,
            lastModifiedAt: Date.now(),
            lastModifiedBy: userId,
          });
        }
      }),
    ),
    Promise.all(
      Array.from(existingMemberships).map(async (membership) => {
        if (nextGroupIds.has(membership.collectionGroupId)) {
          return;
        }
        const group = await ctx.db.get(membership.collectionGroupId);
        await ctx.db.delete(membership._id);
        if (group) {
          await ctx.db.patch(membership.collectionGroupId, {
            itemsCount: Math.max(0, (group.itemsCount || 0) - 1),
            lastModifiedAt: Date.now(),
            lastModifiedBy: userId,
          });
        }
      }),
    ),
  ] as const);
}

export interface ImportedObjectFields {
  title: string;
  alternativeTitle?: string;
  creator?: string;
  objectType?: string;
  objectName?: string;
  culture?: string;
  period?: string;
  dateCreated?: string;
  materials?: string;
  technique?: string;
  dimensions?: string;
  description?: string;
  condition?: string;
  provenance?: string;
}

function trimmed(value: string | undefined) {
  const text = value?.trim();
  return text ? text : undefined;
}

/**
 * Catalogs one imported object with the same side effects as manual creation:
 * quota, register numbering, usage counters, group membership, audit, webhook,
 * and an accountable placement entry when a location is given.
 */
export async function createImportedCatalogObject(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    userId: Id<"users">;
    accessionNumber?: string;
    fields: ImportedObjectFields;
    locationId?: Id<"locations">;
    collectionGroupId?: Id<"collectionGroups">;
    sourceLabel: string;
  },
) {
  const { organizationId, userId } = args;
  await enforceObjectQuota(ctx, organizationId);
  if (args.locationId) {
    await requireUsableLocation(ctx, organizationId, args.locationId);
  }

  const accessionNumber = args.accessionNumber?.trim()
    ? args.accessionNumber
    : await generateConfiguredIdentifier(ctx, organizationId, "catalog");
  const normalizedIdentifier = await ensureIdentifierAvailable(
    ctx,
    organizationId,
    "catalog",
    accessionNumber,
  );
  const condition = trimmed(args.fields.condition);
  const title = args.fields.title.trim();

  const collectionId = await ctx.db.insert("collections", {
    organizationId,
    accessionNumber,
    normalizedIdentifier,
    title,
    alternativeTitle: trimmed(args.fields.alternativeTitle),
    creator: trimmed(args.fields.creator),
    objectType: trimmed(args.fields.objectType),
    objectName: trimmed(args.fields.objectName),
    culture: trimmed(args.fields.culture),
    period: trimmed(args.fields.period),
    dateCreated: trimmed(args.fields.dateCreated),
    materials: trimmed(args.fields.materials),
    technique: trimmed(args.fields.technique),
    dimensions: trimmed(args.fields.dimensions),
    description: trimmed(args.fields.description),
    condition,
    conditionHistory: condition
      ? [
          await buildConditionHistoryEntry(
            ctx,
            userId,
            condition,
            args.sourceLabel,
          ),
        ]
      : undefined,
    provenance: trimmed(args.fields.provenance),
    collectionGroupId: args.collectionGroupId,
    status: "active",
    catalogedBy: userId,
    catalogedAt: Date.now(),
  });

  await syncCollectionOptionUsages(ctx, collectionId);
  await applyUsageCounterDelta(ctx, organizationId, { objectCount: 1 });
  await syncCollectionGroupMemberships(
    ctx,
    collectionId,
    organizationId,
    args.collectionGroupId ? [args.collectionGroupId] : [],
    userId,
  );
  if (args.locationId) {
    const created = await ctx.db.get(collectionId);
    if (created) {
      await moveCollectionToLocation(
        ctx,
        created,
        args.locationId,
        userId,
        `Initial placement from ${args.sourceLabel}`,
      );
    }
  }
  await ctx.runMutation(internal.audit.logAction, {
    organizationId,
    userId,
    action: "created_collection",
    entityType: "collection",
    entityId: collectionId,
    changes: { accessionNumber, title, source: args.sourceLabel },
  });
  await emitWebhookEvent(ctx, organizationId, "collection.created", {
    collectionId,
    title,
  });
  return { collectionId, accessionNumber };
}
