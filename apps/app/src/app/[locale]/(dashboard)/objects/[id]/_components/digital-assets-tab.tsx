"use client";

import { useScopedI18n } from "@/locales/client";
import { Box, ExternalLink, Globe, Link as LinkIcon } from "lucide-react";
import type { CollectionData } from "./types";

interface DigitalAssetsTabProps {
  collection: CollectionData;
}

export function DigitalAssetsTab({ collection }: DigitalAssetsTabProps) {
  const t = useScopedI18n("objects.digitalAssetsTab");
  return (
    <div className="space-y-6">
      <h3 className="flex items-center gap-2 text-xs font-medium text-foreground">
        <LinkIcon className="h-4 w-4 text-sky-500" />
        {t("title")}
      </h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {collection.links && collection.links.length > 0 ? (
          collection.links.map((link) => (
            <div
              key={link.url}
              className="h-full rounded-xl border border-border/60 bg-secondary/20 p-1"
            >
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-secondary/50"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded border border-border/50 bg-secondary text-muted-foreground group-hover:text-muted-foreground">
                  {link.url.includes("sketchfab") ? (
                    <Box className="h-4 w-4" />
                  ) : (
                    <Globe className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground group-hover:text-foreground">
                    {link.label || t("externalLink")}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {link.url}
                  </p>
                </div>
                <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-muted-foreground" />
              </a>
            </div>
          ))
        ) : (
          <div className="col-span-2 flex h-32 items-center justify-center rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">{t("noAssets")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
