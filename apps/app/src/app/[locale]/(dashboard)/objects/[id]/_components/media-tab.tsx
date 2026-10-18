"use client";

import { DigitalAssetsTab } from "./digital-assets-tab";
import { MediaGallery } from "./media-gallery";
import type { CollectionData } from "./types";

interface MediaTabProps {
  collectionId: string;
  collection: CollectionData;
  onOpenLightbox?: (index: number) => void;
}

/**
 * The object page's Media tab. Media is uploaded from Edit Object:
 * images in the edit form's image panel, documents in its Media tab.
 */
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
