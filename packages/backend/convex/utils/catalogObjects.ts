import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
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

export async function getCollectionGroupMembershipIds(
  ctx: QueryCtx | MutationCtx,
  collection: Doc<"collections">,
) {
  const memberships = await ctx.db
    .query("collectionGroupItems")
    .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
    .collect();
  const valid = (
    await Promise.all(
      memberships.map(async (membership) => {
        const group = await ctx.db.get(membership.collectionGroupId);
        return group?.organizationId === collection.organizationId
          ? membership
          : null;
      }),
    )
  ).filter((membership) => membership !== null);
  const ids = [
    ...new Set(valid.map((membership) => membership.collectionGroupId)),
  ];
  const pointerGroup = collection.collectionGroupId
    ? await ctx.db.get(collection.collectionGroupId)
    : null;
  const primaryGroupId =
    pointerGroup?.organizationId === collection.organizationId
      ? pointerGroup._id
      : valid.find((membership) => membership.role === "primary")
          ?.collectionGroupId;
  const orderedIds = primaryGroupId
    ? [primaryGroupId, ...ids.filter((id) => id !== primaryGroupId)]
    : ids;
  return {
    primaryGroupId,
    groupIds: orderedIds,
    hasConflict:
      valid.filter((membership) => membership.role === "primary").length > 1 ||
      valid.some(
        (membership) =>
          membership.role === "primary" &&
          primaryGroupId !== membership.collectionGroupId,
      ),
  };
}

export async function syncCollectionGroupMemberships(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
  organizationId: Id<"organizations">,
  groupIds: Id<"collectionGroups">[],
  userId: Id<"users">,
  primaryGroupId?: Id<"collectionGroups">,
) {
  const uniqueGroupIds = [...new Set(groupIds)];
  if (primaryGroupId && !uniqueGroupIds.includes(primaryGroupId)) {
    uniqueGroupIds.unshift(primaryGroupId);
  }
  const existingMemberships = await ctx.db
    .query("collectionGroupItems")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  const nextGroupIds = new Set(uniqueGroupIds);
  const groups = await Promise.all(uniqueGroupIds.map((id) => ctx.db.get(id)));
  for (const group of groups) {
    if (!group) throw new Error("Collection group not found");
    if (group.organizationId !== organizationId) {
      throw new Error("Collection group belongs to a different organization");
    }
  }

  for (const groupId of uniqueGroupIds) {
    const existing = existingMemberships.filter(
      (membership) => membership.collectionGroupId === groupId,
    );
    const role = groupId === primaryGroupId ? "primary" : "secondary";
    if (existing.length === 0) {
      await ctx.db.insert("collectionGroupItems", {
        collectionGroupId: groupId,
        collectionId,
        role,
        addedAt: Date.now(),
        addedBy: userId,
      });
    } else {
      for (const membership of existing) {
        if (membership.role !== role)
          await ctx.db.patch(membership._id, { role });
      }
    }
  }
  for (const membership of existingMemberships) {
    if (!nextGroupIds.has(membership.collectionGroupId)) {
      await ctx.db.delete(membership._id);
    }
  }
  for (const group of groups) {
    if (!group) continue;
    const wasMember = existingMemberships.some(
      (membership) => membership.collectionGroupId === group._id,
    );
    if (!wasMember) {
      await ctx.db.patch(group._id, {
        itemsCount: (group.itemsCount ?? 0) + 1,
        lastModifiedAt: Date.now(),
        lastModifiedBy: userId,
      });
    }
  }
  for (const groupId of new Set(
    existingMemberships.map((membership) => membership.collectionGroupId),
  )) {
    if (nextGroupIds.has(groupId)) continue;
    const group = await ctx.db.get(groupId);
    if (group) {
      await ctx.db.patch(groupId, {
        itemsCount: Math.max(0, (group.itemsCount ?? 0) - 1),
        lastModifiedAt: Date.now(),
        lastModifiedBy: userId,
      });
    }
  }
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
    collectionGroupIds?: Id<"collectionGroups">[];
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
    args.collectionGroupIds ??
      (args.collectionGroupId ? [args.collectionGroupId] : []),
    userId,
    args.collectionGroupId,
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
