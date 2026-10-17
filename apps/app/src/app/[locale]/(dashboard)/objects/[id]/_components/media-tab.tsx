"use client";

import { Button } from "@v1/ui/button";
import { Upload } from "lucide-react";
import Link from "next/link";
import { PermissionGate } from "@/components/permission-gate";
import { useI18n } from "@/locales/client";
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
  const tRoot = useI18n();
  return (
    <div className="space-y-8">
      <MediaGallery
        collectionId={collectionId}
        collectionLinks={collection.links}
        onOpenLightbox={onOpenLightbox}
        actions={
          <PermissionGate permission="collections.update">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/objects/${collectionId}/edit?tab=media`}>
                <Upload className="mr-2 size-3.5" />
                {tRoot(
                  "untranslatedRecords.collections.media.uploadMediaFiles",
                )}
              </Link>
            </Button>
          </PermissionGate>
        }
      />
      <DigitalAssetsTab collection={collection} linksOnly />
    </div>
  );
}
