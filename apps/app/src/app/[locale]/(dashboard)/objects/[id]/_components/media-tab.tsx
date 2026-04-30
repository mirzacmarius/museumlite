"use client";

import { Image as ImageIcon } from "lucide-react";
import { MediaGallery } from "./media-gallery";

interface MediaTabProps {
  collectionId: string;
  onOpenLightbox?: (index: number) => void;
}

export function MediaTab({ collectionId, onOpenLightbox }: MediaTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-medium text-foreground">
          <ImageIcon className="h-4 w-4 text-accent" />
          Media Gallery
        </h3>
      </div>
      <MediaGallery
        collectionId={collectionId}
        mediaType="images"
        onOpenLightbox={onOpenLightbox}
      />
    </div>
  );
}
