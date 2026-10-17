"use client";

import { EmptyState } from "@v1/ui/empty-state";
import { Image as ImageIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useScopedI18n } from "@/locales/client";
import { DetailSection } from "./detail-section";
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
  actions?: ReactNode;
}

export function MediaGallery({
  collectionId,
  collectionLinks,
  mediaType = "all",
  onOpenLightbox,
  editable = false,
  actions,
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
        <DetailSection
          title={t("visualMediaTitle")}
          icon={ImageIcon}
          actions={actions}
          bodyClassName="space-y-3 border-0 bg-transparent p-0 sm:p-0"
        >
          <MediaGalleryImageGrid
            gallery={gallery}
            editable={editable}
            onOpenLightbox={onOpenLightbox}
          />
          {showEmbeds && (
            <MediaGalleryEmbedsSection embeds={gallery.sketchfabEmbeds} />
          )}
          {!hasVisualMedia && (
            <EmptyState
              variant="card"
              size="sm"
              icon={ImageIcon}
              title={t("noMedia")}
            />
          )}
        </DetailSection>
      )}

      {showDocuments && (
        <DetailSection
          title={t("documentsTitle")}
          bodyClassName="border-0 bg-transparent p-0 sm:p-0"
        >
          <MediaGalleryDocuments gallery={gallery} editable={editable} />
        </DetailSection>
      )}
    </div>
  );
}
