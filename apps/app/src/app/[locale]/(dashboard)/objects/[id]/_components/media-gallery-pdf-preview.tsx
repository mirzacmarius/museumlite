"use client";

import { useState } from "react";
import { MediaGalleryPreviewFallback } from "./media-gallery-preview-fallback";

interface MediaGalleryPdfPreviewProps {
  url: string;
  fileName: string;
  previewFailedTitle: string;
  previewFailedDescription: string;
  openLabel: string;
  downloadLabel: string;
}

export function MediaGalleryPdfPreview({
  url,
  fileName,
  previewFailedTitle,
  previewFailedDescription,
  openLabel,
  downloadLabel,
}: MediaGalleryPdfPreviewProps) {
  const [hasPreviewFailed, setHasPreviewFailed] = useState(false);

  if (hasPreviewFailed) {
    return (
      <MediaGalleryPreviewFallback
        title={previewFailedTitle}
        description={previewFailedDescription}
        openLabel={openLabel}
        downloadLabel={downloadLabel}
        href={url}
        variant="inline"
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-border/60 bg-muted/20">
      <iframe
        src={`${url}#toolbar=1&navpanes=0`}
        title={fileName}
        className="h-64 w-full bg-white"
        onError={() => setHasPreviewFailed(true)}
      />
    </div>
  );
}
