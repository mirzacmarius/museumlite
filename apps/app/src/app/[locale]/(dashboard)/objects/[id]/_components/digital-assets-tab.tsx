"use client";

import { EmptyState } from "@v1/ui/empty-state";
import { ExternalLink, Globe, Link as LinkIcon } from "lucide-react";
import { useScopedI18n } from "@/locales/client";
import { DetailSection } from "./detail-section";
import {
  type CollectionLink,
  getExternalLinksExcludingSketchfab,
} from "./media-gallery-utils";
import type { CollectionData } from "./types";

interface DigitalAssetsTabProps {
  collection: CollectionData;
  /** When true, only show external links (Sketchfab and documents are in MediaGallery). */
  linksOnly?: boolean;
}

export function DigitalAssetsTab({
  collection,
  linksOnly = false,
}: DigitalAssetsTabProps) {
  const t = useScopedI18n("objects.digitalAssetsTab");

  const externalLinks: CollectionLink[] = linksOnly
    ? getExternalLinksExcludingSketchfab(collection.links)
    : (collection.links ?? []);

  if (externalLinks.length === 0) {
    if (linksOnly) {
      return null;
    }
    return (
      <DetailSection
        title={t("title")}
        icon={LinkIcon}
        bodyClassName="border-0 bg-transparent p-0 sm:p-0"
      >
        <EmptyState variant="card" size="sm" title={t("noAssets")} />
      </DetailSection>
    );
  }

  return (
    <DetailSection
      title={t("externalLinksTitle")}
      icon={LinkIcon}
      bodyClassName="p-1 sm:p-1"
    >
      {externalLinks.map((link) => (
        <a
          key={link.url}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-secondary/50"
        >
          <div className="flex size-8 items-center justify-center rounded border border-border/50 bg-secondary text-muted-foreground group-hover:text-foreground">
            <Globe className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground group-hover:text-foreground">
              {link.label || t("externalLink")}
            </p>
            <p className="truncate text-xs text-muted-foreground">{link.url}</p>
          </div>
          <ExternalLink className="size-3 text-muted-foreground group-hover:text-muted-foreground" />
        </a>
      ))}
    </DetailSection>
  );
}
