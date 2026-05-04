"use client";

import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import {
  Box,
  Download,
  ExternalLink,
  FileText,
  Globe,
  Link as LinkIcon,
} from "lucide-react";
import type { CollectionData } from "./types";

interface DigitalAssetsTabProps {
  collection: CollectionData;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function getFileExtension(fileName: string): string {
  const ext = fileName.split(".").pop()?.toUpperCase();
  return ext || "FILE";
}

export function DigitalAssetsTab({ collection }: DigitalAssetsTabProps) {
  const t = useScopedI18n("objects.digitalAssetsTab");

  const media = useQuery(
    api.media.list,
    collection._id
      ? { collectionId: collection._id as Id<"collections"> }
      : "skip",
  );

  const documents =
    media?.filter((m) => {
      const mediaCategory = (m as { mediaCategory?: "image" | "document" })
        .mediaCategory;
      return mediaCategory === "document" || m.fileType === "document";
    }) ?? [];
  const hasLinks = collection.links && collection.links.length > 0;
  const hasDocuments = documents.length > 0;
  const hasContent = hasLinks || hasDocuments;

  return (
    <div className="space-y-6">
      <h3 className="flex items-center gap-2 text-xs font-medium text-foreground">
        <LinkIcon className="h-4 w-4 text-sky-500" />
        {t("title")}
      </h3>

      {!hasContent ? (
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">{t("noAssets")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {hasLinks && (
            <div className="h-full rounded-xl border border-border/60 bg-secondary/20 p-1">
              {collection.links?.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-secondary/50"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded border border-border/50 bg-secondary text-muted-foreground group-hover:text-foreground">
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
              ))}
            </div>
          )}

          {hasDocuments && (
            <div className="h-full rounded-xl border border-border/60 bg-secondary/20 p-1">
              {documents.map((doc) => (
                <a
                  key={doc._id}
                  href={doc.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-secondary/50"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded border border-border/50 bg-secondary text-muted-foreground group-hover:text-foreground">
                    {doc.fileName?.toLowerCase().endsWith(".glb") ||
                    doc.fileName?.toLowerCase().endsWith(".gltf") ? (
                      <Box className="h-4 w-4" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-muted-foreground group-hover:text-foreground">
                      {doc.fileName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {getFileExtension(doc.fileName)} •{" "}
                      {formatFileSize(doc.fileSize)}
                    </p>
                  </div>
                  <Download className="h-3 w-3 text-muted-foreground group-hover:text-muted-foreground" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
