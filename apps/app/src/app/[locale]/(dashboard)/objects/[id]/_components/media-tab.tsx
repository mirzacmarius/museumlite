"use client";

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
    <div className="space-y-8">
      <MediaGallery
        collectionId={collectionId}
        collectionLinks={collection.links}
        onOpenLightbox={onOpenLightbox}
      />
      <DigitalAssetsTab collection={collection} linksOnly />
    </div>
  );
}
