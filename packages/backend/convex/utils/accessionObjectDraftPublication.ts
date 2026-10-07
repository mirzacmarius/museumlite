import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { buildConditionHistoryEntry } from "./catalogObjects";
import { syncCollectionOptionUsages } from "./collectionOptionUsages";
import { ensureIdentifierAvailable } from "./identifiers";
import { validateObjectReferences } from "./locationIntegrity";
import { insertCompletedMediaAsset } from "./mediaAssets";
import {
  applyUsageCounterDelta,
  ensureUsageCounter,
} from "./organizationUsageCounters";
import { transferStorageOwnership } from "./uploadOwnership";

function serializeStringList(values?: string[]) {
  return values && values.length > 0 ? JSON.stringify(values) : undefined;
}

export async function publishAccessionObjectDraft(
  ctx: MutationCtx,
  {
    accession,
    catalogedAt,
    catalogedBy,
    displayStatus,
    status,
  }: {
    accession: Doc<"accessions">;
    catalogedBy: Id<"users">;
    catalogedAt: number;
    status: "active" | "deaccessioned";
    displayStatus?: string;
  },
) {
  const catalogIdentifier =
    accession.catalogIdentifier ?? accession.accessionNumber;
  const normalizedIdentifier = await ensureIdentifierAvailable(
    ctx,
    accession.organizationId,
    "catalog",
    catalogIdentifier,
  );
  const draftObjectData = accession.draftObjectData;
  if (draftObjectData)
    await validateObjectReferences(
      ctx,
      accession.organizationId,
      draftObjectData,
    );
  const collectionGroupIds =
    draftObjectData?.collectionGroupIds ??
    (draftObjectData?.collectionGroupId
      ? [draftObjectData.collectionGroupId]
      : []);
  const uniqueCollectionGroupIds = [...new Set(collectionGroupIds)];
  const condition = draftObjectData?.condition?.trim() || undefined;
  const conditionHistory = condition
    ? [await buildConditionHistoryEntry(ctx, catalogedBy, condition, undefined)]
    : undefined;
  const [, collectionId, collectionGroups] = await Promise.all([
    ensureUsageCounter(ctx, accession.organizationId),
    ctx.db.insert("collections", {
      organizationId: accession.organizationId,
      accessionNumber: catalogIdentifier,
      normalizedIdentifier,
      collectionGroupId: collectionGroupIds[0],
      title:
        draftObjectData?.title?.trim() ||
        `Accession ${accession.accessionNumber}`,
      alternativeTitle: draftObjectData?.alternativeTitle,
      creator: draftObjectData?.creator,
      objectType: serializeStringList(draftObjectData?.objectType),
      objectName: draftObjectData?.objectName,
      culture: draftObjectData?.culture,
      period: draftObjectData?.period,
      dateCreated: draftObjectData?.dateCreated,
      materials: serializeStringList(draftObjectData?.materials),
      technique: draftObjectData?.technique,
      dimensions: draftObjectData?.dimensions,
      dimensionHeight: draftObjectData?.dimensionHeight,
      dimensionWidth: draftObjectData?.dimensionWidth,
      dimensionDepth: draftObjectData?.dimensionDepth,
      dimensionUnit: draftObjectData?.dimensionUnit,
      dimensionDiameter: draftObjectData?.dimensionDiameter,
      dimensionWeight: draftObjectData?.dimensionWeight,
      weightUnit: draftObjectData?.weightUnit,
      description: draftObjectData?.description,
      condition,
      conditionHistory,
      inscriptions: draftObjectData?.inscriptions,
      inscriptionMarks: draftObjectData?.inscriptionMarks,
      tags: draftObjectData?.tags,
      creditLine: draftObjectData?.creditLine,
      legalRestrictions: draftObjectData?.legalRestrictions,
      provenance: draftObjectData?.provenance,
      exhibitionHistory: draftObjectData?.exhibitionHistory,
      ownershipHistory: draftObjectData?.ownershipHistory,
      donated_by: draftObjectData?.donated_by,
      donated_date: draftObjectData?.donated_date,
      donation_info: draftObjectData?.donation_info,
      acquisitionMethod: draftObjectData?.acquisitionMethod,
      previous_owners: draftObjectData?.previous_owners,
      links: draftObjectData?.links,
      parentObjectId: draftObjectData?.parentObjectId,
      currentLocationId: draftObjectData?.currentLocationId,
      alternateAccessionNumbers: draftObjectData?.alternateAccessionNumbers,
      displayStatus: displayStatus ?? draftObjectData?.displayStatus,
      isPubliclyVisible: draftObjectData?.isPubliclyVisible,
      isHighResDownloadable: draftObjectData?.isHighResDownloadable,
      isSearchable: draftObjectData?.isSearchable,
      isValuationVisible: draftObjectData?.isValuationVisible,
      publicSlug: draftObjectData?.publicSlug,
      collectionType: draftObjectData?.collectionType,
      status,
      catalogedBy,
      catalogedAt,
      lastModifiedBy: catalogedBy,
      lastModifiedAt: catalogedAt,
    }),
    Promise.all(
      uniqueCollectionGroupIds.map((collectionGroupId) =>
        ctx.db.get(collectionGroupId),
      ),
    ),
  ] as const);

  await syncCollectionOptionUsages(ctx, collectionId);

  await Promise.all([
    ...uniqueCollectionGroupIds.flatMap((collectionGroupId, index) => {
      const group = collectionGroups[index];
      if (!group || group.organizationId !== accession.organizationId) {
        return [];
      }

      return [
        ctx.db.insert("collectionGroupItems", {
          collectionGroupId,
          collectionId,
          addedAt: catalogedAt,
          addedBy: catalogedBy,
        }),
        ctx.db.patch(collectionGroupId, {
          itemsCount: (group.itemsCount || 0) + 1,
          lastModifiedAt: catalogedAt,
          lastModifiedBy: catalogedBy,
        }),
      ];
    }),
    ...(accession.draftMedia ?? []).map(async (draftMediaItem) => {
      const { mediaId } = await insertCompletedMediaAsset(ctx, {
        collectionId,
        organizationId: accession.organizationId,
        storageId: draftMediaItem.storageId,
        fileName: draftMediaItem.fileName,
        fileSize: draftMediaItem.fileSize,
        mimeType: draftMediaItem.mimeType,
        mediaCategory: draftMediaItem.mediaCategory,
        isPrimary: draftMediaItem.isPrimary,
        uploadedBy: catalogedBy,
        uploadedAt: catalogedAt,
      });
      const ownership = await transferStorageOwnership(ctx, {
        storageId: draftMediaItem.storageId,
        organizationId: accession.organizationId,
        fromOwnerType: "accessionDraft",
        fromOwnerId: accession._id,
        ownerType: "media",
        ownerId: mediaId,
      });
      await ctx.db.patch(mediaId, ownership);
    }),
  ]);

  await applyUsageCounterDelta(ctx, accession.organizationId, {
    objectCount: 1,
  });

  return collectionId;
}
