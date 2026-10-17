"use client";

import { Box } from "lucide-react";
import { useScopedI18n } from "@/locales/client";
import { MediaGalleryFileTypeBadge } from "./media-gallery-file-type-badge";
import { MediaGallerySketchfabEmbed } from "./media-gallery-sketchfab-embed";
import type { SketchfabEmbedItem } from "./media-gallery-utils";

interface MediaGalleryEmbedsSectionProps {
  embeds: SketchfabEmbedItem[];
}

export function MediaGalleryEmbedsSection({
  embeds,
}: MediaGalleryEmbedsSectionProps) {
  const t = useScopedI18n("objects.mediaGallery");

  if (embeds.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h4 className="flex items-center gap-2 text-xs font-medium text-foreground">
        <Box className="size-4 text-muted-foreground" />
        {t("embedsTitle")}
      </h4>
      <div className="space-y-4">
        {embeds.map((embed) => (
          <div
            key={embed.id}
            className="space-y-2 rounded-xl border border-border/60 bg-card p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {embed.label || t("sketchfabDefaultLabel")}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {embed.url}
                </p>
              </div>
              <MediaGalleryFileTypeBadge
                kind="embed3d"
                label={t("fileType.embed3d")}
              />
            </div>
            <MediaGallerySketchfabEmbed
              title={embed.label || t("sketchfabDefaultLabel")}
              embedUrl={embed.embedUrl}
              pageUrl={embed.url}
              missingEmbedTitle={t("missingEmbedUrlTitle")}
              missingEmbedDescription={t("missingEmbedUrlDescription")}
              previewFailedTitle={t("previewFailedTitle")}
              previewFailedDescription={t("previewFailedDescription")}
              openLabel={t("openExternal")}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
