import type { SystemDataModel } from "convex/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

type StorageDoc = SystemDataModel["_storage"]["document"];

export async function getStorageUsageFromMedia(
  ctx: QueryCtx,
  mediaFiles: Array<Doc<"mediaFiles">>,
  mediaVersions: Array<Doc<"mediaVersions">>,
) {
  const storageIds = new Set<Id<"_storage">>();

  for (const media of mediaFiles) {
    storageIds.add(media.storageId);
    if (media.thumbnailStorageId) {
      storageIds.add(media.thumbnailStorageId);
    }
  }

  for (const version of mediaVersions) {
    storageIds.add(version.storageId);
  }

  const storageDocs: Array<StorageDoc | null> = await Promise.all(
    [...storageIds].map((id) => ctx.db.system.get(id)),
  );

  const totalSize = storageDocs.reduce(
    (sum, doc) => sum + (doc?.size ?? 0),
    0,
  );

  return {
    totalSize,
    storageFileCount: storageIds.size,
  };
}
