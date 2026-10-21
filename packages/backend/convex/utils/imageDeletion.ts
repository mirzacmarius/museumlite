import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { imageDeletionError } from "./imageDeletionErrors";
import { applyUsageCounterDelta } from "./organizationUsageCounters";
import {
  getCurrentUserOrganization,
  hasPermission,
  resolveCaseApproval,
} from "./permissions";
import { canBePrimaryImage, makeOnlyPrimaryImage } from "./primaryMedia";
import { provenanceArrivingFrom } from "./provenance";
import { isCollectionManagerRoleName } from "./systemRoles";
import { workflowApprovalError } from "./workflowApprovalErrors";
import { getWorkflowConfig } from "./workflowConfigs";
import { resolveWorkflowStepState } from "./workflowSteps";

type ReadCtx = QueryCtx | MutationCtx;

// An object has a handful of images; this only bounds legacy outliers.
const REMAINING_IMAGE_READ_LIMIT = 100;

/** Pending deletion requests one page or count reads at most. */
export const PENDING_IMAGE_DELETION_LIMIT = 100;

/**
 * Staff may delete an object's images. Documents filed with the object stay
 * permanent evidence (ADR 0002, ADR 0018).
 */
export function isDeletableObjectImage(media: Doc<"mediaFiles">) {
  return canBePrimaryImage(media);
}

/**
 * Image deletion follows the accessions approval workflow: the role of its
 * first step (the Collection Manager by default) and Administrators decide
 * deletion requests. The other accession reviewer roles act on accessions at
 * every step, not on images. Without a configured first step, Administrators
 * and Collection Managers decide.
 */
export async function resolveImageDeletionApproval(
  ctx: ReadCtx,
  organizationId: Id<"organizations">,
) {
  const config = await getWorkflowConfig(ctx, organizationId, "accession");
  if (
    resolveWorkflowStepState(config?.steps, undefined).firstStep !== undefined
  ) {
    return await resolveCaseApproval(
      ctx,
      organizationId,
      "accession",
      undefined,
      { stepRoleOnly: true },
    );
  }
  const [membership, isAdministrator] = await Promise.all([
    getCurrentUserOrganization(ctx, organizationId),
    hasPermission(ctx, organizationId, "organization.manage_settings"),
  ]);
  const role = membership ? await ctx.db.get(membership.roleId) : null;
  if (
    isAdministrator ||
    (role?.isSystemRole === true && isCollectionManagerRoleName(role.name))
  ) {
    return { allowed: true as const };
  }
  return {
    allowed: false as const,
    refusal: workflowApprovalError(
      "APPROVAL_NOT_PERMITTED",
      "Only an administrator or a collection manager can decide image deletions",
    ),
  };
}

/**
 * The image's pending request in its organization. A request left in an
 * organization the object was transferred out of no longer applies.
 */
export async function findPendingDeletionRequest(
  ctx: ReadCtx,
  media: Pick<Doc<"mediaFiles">, "_id" | "organizationId">,
) {
  for await (const request of ctx.db
    .query("mediaDeletionRequests")
    .withIndex("by_media_and_status", (q) =>
      q.eq("mediaId", media._id).eq("status", "pending"),
    )) {
    if (request.organizationId === media.organizationId) return request;
  }
  return null;
}

/** Whether another record cites the image, so deleting it would erase evidence. */
async function isCitedAsEvidence(ctx: ReadCtx, media: Doc<"mediaFiles">) {
  const [incident, task, reproduction] = await Promise.all([
    ctx.db
      .query("incidentEvidence")
      .withIndex("by_reference_id", (q) => q.eq("reference.id", media._id))
      .first(),
    ctx.db
      .query("caseTaskEvidence")
      .withIndex("by_reference_id", (q) => q.eq("reference.id", media._id))
      .first(),
    ctx.db
      .query("reproductionRequests")
      .withIndex("by_mediaId", (q) => q.eq("mediaId", media._id))
      .first(),
  ]);
  if (incident || task || reproduction) return true;

  for await (const assessment of ctx.db
    .query("conditionAssessments")
    .withIndex("by_collection", (q) =>
      q.eq("collectionId", media.collectionId),
    )) {
    if (assessment.photos.some((photo) => photo.mediaId === media._id)) {
      return true;
    }
  }
  // Evidence still on its way from a transfer cites the image as well.
  const arrivingFrom = await provenanceArrivingFrom(ctx, {
    _id: media.collectionId,
    organizationId: media.organizationId,
  });
  for (const organizationId of arrivingFrom
    ? [media.organizationId, arrivingFrom]
    : [media.organizationId]) {
    for await (const evidence of ctx.db
      .query("provenanceEvidence")
      .withIndex("by_organization_and_objectId", (q) =>
        q
          .eq("organizationId", organizationId)
          .eq("objectId", media.collectionId),
      )) {
      if (evidence.kind === "media" && evidence.mediaId === media._id) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Refuses deletion of anything but an object's image, of an image that
 * already waits for approval, and of an image cited as evidence.
 */
export async function assertImageCanBeDeleted(
  ctx: ReadCtx,
  media: Doc<"mediaFiles">,
  { allowPendingRequest = false }: { allowPendingRequest?: boolean } = {},
) {
  if (!isDeletableObjectImage(media)) {
    throw imageDeletionError("NOT_AN_IMAGE", "Only images can be deleted");
  }
  if (!allowPendingRequest && (await findPendingDeletionRequest(ctx, media))) {
    throw imageDeletionError(
      "DELETION_ALREADY_PENDING",
      "This image already waits for deletion approval",
    );
  }
  if (await isCitedAsEvidence(ctx, media)) {
    throw imageDeletionError(
      "IMAGE_CITED_AS_EVIDENCE",
      "This image is cited as evidence and cannot be deleted",
    );
  }
}

/** Deletes a blob the image owns, with its ownership row; returns its size. */
async function deleteOwnedBlob(
  ctx: MutationCtx,
  media: Doc<"mediaFiles">,
  storageId: Id<"_storage">,
  ownerIds: ReadonlySet<string>,
) {
  const [blob, ownership] = await Promise.all([
    ctx.db.system.get(storageId),
    ctx.db
      .query("storageOwnership")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .unique(),
  ]);
  if (
    ownership &&
    ((ownership.organizationId !== undefined &&
      ownership.organizationId !== media.organizationId) ||
      ownership.ownerId === undefined ||
      !ownerIds.has(ownership.ownerId))
  ) {
    return 0;
  }
  if (ownership) await ctx.db.delete(ownership._id);
  if (!blob) return 0;
  await ctx.storage.delete(storageId);
  return blob.size;
}

/** Makes the object's next image its primary image after the primary is deleted. */
async function promoteNextPrimaryImage(
  ctx: MutationCtx,
  collectionId: Id<"collections">,
) {
  const images = await ctx.db
    .query("mediaFiles")
    .withIndex("by_collection_and_fileType", (q) =>
      q.eq("collectionId", collectionId).eq("fileType", "image"),
    )
    .take(REMAINING_IMAGE_READ_LIMIT);
  // The index returns oldest first, so equal display orders keep the oldest.
  let next: Doc<"mediaFiles"> | undefined;
  for (const image of images) {
    if (
      canBePrimaryImage(image) &&
      (next === undefined ||
        (image.displayOrder ?? Number.MAX_SAFE_INTEGER) <
          (next.displayOrder ?? Number.MAX_SAFE_INTEGER))
    ) {
      next = image;
    }
  }
  if (next) await makeOnlyPrimaryImage(ctx, next);
}

/**
 * Deletes an object's image for good: its original, thumbnail, edited
 * versions and public renditions, and their records. The portal stops showing
 * it at once, and another image becomes primary when it was the primary one.
 */
export async function destroyObjectImage(
  ctx: MutationCtx,
  media: Doc<"mediaFiles">,
) {
  const [versions, editHistory, accessions] = await Promise.all([
    ctx.db
      .query("mediaVersions")
      .withIndex("by_original_media", (q) => q.eq("originalMediaId", media._id))
      .collect(),
    ctx.db
      .query("mediaEditHistory")
      .withIndex("by_media", (q) => q.eq("mediaId", media._id))
      .collect(),
    ctx.db
      .query("accessions")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", media.collectionId),
      )
      .collect(),
  ]);

  const ownerIds = new Set<string>([
    media._id,
    ...versions.map((version) => version._id),
  ]);
  const originalBytes = await deleteOwnedBlob(
    ctx,
    media,
    media.storageId,
    ownerIds,
  );
  const derivedStorageIds = new Set<Id<"_storage">>();
  if (media.thumbnailStorageId) derivedStorageIds.add(media.thumbnailStorageId);
  if (media.publicRendition?.status === "ready") {
    derivedStorageIds.add(media.publicRendition.renditionStorageId);
  }
  if (media.publicApproval?.renditionStorageId) {
    derivedStorageIds.add(media.publicApproval.renditionStorageId);
  }
  for (const version of versions) derivedStorageIds.add(version.storageId);
  derivedStorageIds.delete(media.storageId);
  let derivedBytes = 0;
  for (const storageId of derivedStorageIds) {
    derivedBytes += await deleteOwnedBlob(ctx, media, storageId, ownerIds);
  }

  // A published intake keeps its draft list; drop the file it no longer has.
  for (const accession of accessions) {
    if (
      accession.organizationId === media.organizationId &&
      accession.draftMedia?.some((item) => item.storageId === media.storageId)
    ) {
      await ctx.db.patch(accession._id, {
        draftMedia: accession.draftMedia.filter(
          (item) => item.storageId !== media.storageId,
        ),
      });
    }
  }

  await Promise.all([
    ...versions.map((version) => ctx.db.delete(version._id)),
    ...editHistory.map((entry) => ctx.db.delete(entry._id)),
  ]);
  await ctx.db.delete(media._id);
  await applyUsageCounterDelta(ctx, media.organizationId, {
    mediaFileCount: -1,
    mediaVersionCount: -versions.length,
    mediaTypeDeltas: [
      { type: media.fileType, countDelta: -1, bytesDelta: -originalBytes },
    ],
    storageBytes: -(originalBytes + derivedBytes),
  });
  if (media.isPrimary) {
    await promoteNextPrimaryImage(ctx, media.collectionId);
  }
}
