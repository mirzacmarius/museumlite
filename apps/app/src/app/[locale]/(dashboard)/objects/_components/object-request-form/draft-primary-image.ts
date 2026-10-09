import type { DraftMediaItem } from "../collection-form-shared/types";

/**
 * The draft's primary image, resolved the way the server stores it: the image
 * the user chose, else the saved draft's primary image, else the first image.
 */
export function resolveDraftPrimaryImageId({
  choice,
  savedMedia,
  newImageIds,
}: {
  choice: string | null;
  savedMedia: DraftMediaItem[];
  newImageIds: string[];
}) {
  const savedImages = savedMedia.filter(
    (item) => item.mediaCategory === "image",
  );
  const imageIds: string[] = [
    ...savedImages.map((item) => item.storageId),
    ...newImageIds,
  ];
  if (choice !== null && imageIds.includes(choice)) return choice;
  return (
    savedImages.find((item) => item.isPrimary)?.storageId ?? imageIds[0] ?? null
  );
}
