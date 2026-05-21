"use client";

import { MediaGalleryDocuments } from "./media-gallery-documents";
import { MediaGalleryImageGrid } from "./media-gallery-image-grid";
import { useMediaGallery } from "./use-media-gallery";

interface MediaGalleryProps {
  collectionId: string;
  mediaType?: "images" | "documents";
  onOpenLightbox?: (index: number) => void;
  editable?: boolean;
}

export function MediaGallery({
  collectionId,
  mediaType = "images",
  onOpenLightbox,
  editable = false,
}: MediaGalleryProps) {
  const gallery = useMediaGallery({ collectionId, onOpenLightbox });
  const showImages = mediaType === "images";
  const showDocuments = mediaType === "documents";

  if (gallery.isMediaLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Loading media…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {gallery.error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {gallery.error}
        </div>
      )}

      {showImages && (
        <div className="space-y-3">
          <MediaGalleryImageGrid
            gallery={gallery}
            editable={editable}
            onOpenLightbox={onOpenLightbox}
          />
        </div>
      )}

      {showDocuments && (
        <div className="space-y-3">
          <MediaGalleryDocuments gallery={gallery} editable={editable} />
        </div>
      )}
    </div>
  );
}
