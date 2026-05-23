"use client";

import { useState } from "react";
import { MediaGalleryPreviewFallback } from "./media-gallery-preview-fallback";

interface MediaGallerySketchfabEmbedProps {
  title: string;
  embedUrl: string | null;
  pageUrl: string;
  missingEmbedTitle: string;
  missingEmbedDescription: string;
  previewFailedTitle: string;
  previewFailedDescription: string;
  openLabel: string;
}

export function MediaGallerySketchfabEmbed({
  title,
  embedUrl,
  pageUrl,
  missingEmbedTitle,
  missingEmbedDescription,
  previewFailedTitle,
  previewFailedDescription,
  openLabel,
}: MediaGallerySketchfabEmbedProps) {
  const [hasPreviewFailed, setHasPreviewFailed] = useState(false);

  if (!embedUrl) {
    return (
      <MediaGalleryPreviewFallback
        title={missingEmbedTitle}
        description={missingEmbedDescription}
        openLabel={openLabel}
        downloadLabel={openLabel}
        href={pageUrl}
      />
    );
  }

  if (hasPreviewFailed) {
    return (
      <MediaGalleryPreviewFallback
        title={previewFailedTitle}
        description={previewFailedDescription}
        openLabel={openLabel}
        downloadLabel={openLabel}
        href={pageUrl}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-black">
      <iframe
        src={embedUrl}
        title={title}
        className="aspect-video w-full"
        allow="autoplay; fullscreen; xr-spatial-tracking"
        allowFullScreen
        onError={() => setHasPreviewFailed(true)}
      />
    </div>
  );
}
