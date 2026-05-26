"use client";

import { Image as ImageIcon } from "lucide-react";
import { useScopedI18n } from "@/locales/client";
import { MediaGalleryDocuments } from "./media-gallery-documents";
import { MediaGalleryEmbedsSection } from "./media-gallery-embeds-section";
import { MediaGalleryImageGrid } from "./media-gallery-image-grid";
import type { CollectionLink } from "./media-gallery-utils";
import { useMediaGallery } from "./use-media-gallery";

interface MediaGalleryProps {
  collectionId: string;
  collectionLinks?: CollectionLink[];
  mediaType?: "images" | "documents" | "all";
  onOpenLightbox?: (index: number) => void;
  editable?: boolean;
}

export function MediaGallery({
  collectionId,
  collectionLinks,
  mediaType = "all",
  onOpenLightbox,
  editable = false,
}: MediaGalleryProps) {
  const t = useScopedI18n("objects.mediaGallery");
  const gallery = useMediaGallery({
    collectionId,
    collectionLinks,
    onOpenLightbox,
  });
  const showImages = mediaType === "images" || mediaType === "all";
  const showDocuments = mediaType === "documents" || mediaType === "all";
  const showEmbeds = mediaType === "images" || mediaType === "all";

  if (gallery.isMediaLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  const hasVisualMedia =
    gallery.images.length > 0 ||
    (showEmbeds && gallery.sketchfabEmbeds.length > 0);
  return (
    <div className="space-y-8">
      {gallery.error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {gallery.error}
        </div>
      )}

      {showImages && (
        <div className="space-y-3">
          <h4 className="flex items-center gap-2 text-xs font-medium text-foreground">
            <ImageIcon className="size-4 text-accent" />
            {t("visualMediaTitle")}
          </h4>
          <MediaGalleryImageGrid
            gallery={gallery}
            editable={editable}
            onOpenLightbox={onOpenLightbox}
          />
          {showEmbeds && (
            <MediaGalleryEmbedsSection embeds={gallery.sketchfabEmbeds} />
          )}
          {!hasVisualMedia && (
            <div className="flex h-24 flex-col items-center justify-center rounded-lg border border-dashed">
              <ImageIcon className="mb-2 size-6 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{t("noMedia")}</p>
            </div>
          )}
        </div>
      )}

      {showDocuments && (
        <div className="space-y-3">
          <h4 className="flex items-center gap-2 text-xs font-medium text-foreground">
            {t("documentsTitle")}
          </h4>
          <MediaGalleryDocuments gallery={gallery} editable={editable} />
        </div>
      )}
    </div>
  );
}
