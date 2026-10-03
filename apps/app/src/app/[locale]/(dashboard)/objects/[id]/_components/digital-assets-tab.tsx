"use client";

import { ExternalLink, Globe, Link as LinkIcon } from "lucide-react";
import { useScopedI18n } from "@/locales/client";
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
      <div className="space-y-6">
        <h3 className="flex items-center gap-2 text-xs font-medium text-foreground">
          <LinkIcon className="size-4 text-sky-500" />
          {t("title")}
        </h3>
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">{t("noAssets")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-xs font-medium text-foreground">
        <LinkIcon className="size-4 text-sky-500" />
        {t("externalLinksTitle")}
      </h3>
      <div className="rounded-xl border border-border/60 bg-secondary/20 p-1">
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
              <p className="truncate text-[10px] text-muted-foreground">
                {link.url}
              </p>
            </div>
            <ExternalLink className="size-3 text-muted-foreground group-hover:text-muted-foreground" />
          </a>
        ))}
      </div>
    </div>
  );
}
