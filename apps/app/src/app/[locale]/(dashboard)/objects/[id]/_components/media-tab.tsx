"use client";

import { Image as ImageIcon } from "lucide-react";
import { DigitalAssetsTab } from "./digital-assets-tab";
import { MediaGallery } from "./media-gallery";
import type { CollectionData } from "./types";

interface MediaTabProps {
  collectionId: string;
  collection: CollectionData;
  onOpenLightbox?: (index: number) => void;
}

export function MediaTab({
  collectionId,
  collection,
  onOpenLightbox,
}: MediaTabProps) {
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
      <DigitalAssetsTab collection={collection} />
    </div>
  );
}
