"use client";

import { useClientRelativeTime } from "@/hooks/use-client-date-format";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { ScrollArea } from "@v1/ui/scroll-area";
import { useQuery } from "convex/react";
import { Download, File, Loader2, Star } from "lucide-react";
import NextImage from "next/image";
import Link from "next/link";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function RelativeTimestamp({ timestamp }: { timestamp: number }) {
  const locale = useCurrentLocale();
  return useClientRelativeTime(timestamp, locale, { addSuffix: true });
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isCropMetadata = (
  value: unknown,
): value is { crop: { width: number; height: number } } => {
  if (!isRecord(value)) return false;
  const crop = value.crop;
  if (!isRecord(crop)) return false;
  return typeof crop.width === "number" && typeof crop.height === "number";
};

const isRotateMetadata = (value: unknown): value is { rotation: number } => {
  if (!isRecord(value)) return false;
  return typeof value.rotation === "number";
};

const isAdjustMetadata = (
  value: unknown,
): value is { brightness?: number; contrast?: number } => {
  if (!isRecord(value)) return false;
  const brightnessOk =
    value.brightness === undefined || typeof value.brightness === "number";
  const contrastOk =
    value.contrast === undefined || typeof value.contrast === "number";
  return brightnessOk && contrastOk;
};

const isWatermarkMetadata = (
  value: unknown,
): value is { watermarkText: string } => {
  if (!isRecord(value)) return false;
  return typeof value.watermarkText === "string";
};

export function MediaDetailModal({
  mediaId,
  onClose,
}: {
  mediaId: Id<"mediaFiles">;
  onClose: () => void;
}) {
  const t = useI18n();
  const item = useQuery(api.media.getWithMetadata, { mediaId });
  const versions = useQuery(api.mediaVersions.listVersions, { mediaId });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl border-zinc-800 bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="text-zinc-200">
            {t("mediaPage.details.title")}
          </DialogTitle>
        </DialogHeader>

        {item === undefined && (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-zinc-500" />
          </div>
        )}

        {item && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="aspect-square overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
              {item.fileType === "image" && item.url ? (
                <div className="relative size-full">
                  <NextImage
                    src={item.url}
                    alt={item.fileName}
                    fill
                    sizes="(min-width: 768px) 40vw, 100vw"
                    className="object-contain"
                  />
                </div>
              ) : (
                <div className="flex size-full items-center justify-center">
                  <File className="size-16 text-zinc-700" />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-zinc-200">
                  {item.fileName}
                </p>
                <p className="text-xs text-zinc-500">
                  {formatFileSize(item.fileSize)} &bull;{" "}
                  <RelativeTimestamp timestamp={item.uploadedAt} />
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-zinc-500">
                  {t("mediaPage.details.object")}
                </p>
                <Link
                  href={`/objects/${item.collectionId}`}
                  className="text-sm text-primary hover:underline"
                >
                  {item.collectionTitle}
                </Link>
                {item.accessionNumber && (
                  <p className="text-xs text-zinc-500">
                    {item.accessionNumber}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                {item.caption && (
                  <div>
                    <p className="text-xs text-zinc-500">
                      {t("mediaPage.details.caption")}
                    </p>
                    <p className="text-sm text-zinc-300">{item.caption}</p>
                  </div>
                )}
                {item.photographer && (
                  <div>
                    <p className="text-xs text-zinc-500">
                      {t("mediaPage.details.photographer")}
                    </p>
                    <p className="text-sm text-zinc-300">{item.photographer}</p>
                  </div>
                )}
                {item.copyright && (
                  <div>
                    <p className="text-xs text-zinc-500">
                      {t("mediaPage.details.copyright")}
                    </p>
                    <p className="text-sm text-zinc-300">{item.copyright}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
                {item.url && (
                  <Button
                    size="sm"
                    variant="outline"
                    asChild
                    className="border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  >
                    <a href={item.url} download>
                      <Download className="mr-1 size-3" />
                      Download
                    </a>
                  </Button>
                )}
              </div>

              <div className="space-y-2 border-t border-zinc-800 pt-4">
                <p className="text-sm font-medium text-zinc-200">Versions</p>
                <ScrollArea className="h-48 rounded-lg border border-zinc-800 bg-zinc-950">
                  <div className="space-y-2 p-3">
                    {versions === undefined && (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="size-4 animate-spin text-zinc-500" />
                      </div>
                    )}
                    {versions?.map((version) => {
                      const isCurrentVersion =
                        item.currentVersionId === version._id;
                      return (
                        <div
                          key={version._id}
                          className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/40 p-2"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-zinc-200">
                                v{version.versionNumber}
                              </span>
                              {isCurrentVersion && (
                                <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
                                  Current
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500">
                              <RelativeTimestamp
                                timestamp={version.createdAt}
                              />
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex rounded bg-zinc-800 px-2 py-0.5 text-xs capitalize text-zinc-300">
                                {version.editType}
                              </span>
                              {version.editMetadata && (
                                <span className="text-xs text-zinc-500">
                                  {version.editType === "crop" &&
                                    isCropMetadata(version.editMetadata) &&
                                    `Cropped to ${Math.round(version.editMetadata.crop.width)}×${Math.round(version.editMetadata.crop.height)}`}
                                  {version.editType === "rotate" &&
                                    isRotateMetadata(version.editMetadata) &&
                                    `Rotated ${version.editMetadata.rotation}°`}
                                  {version.editType === "adjust" &&
                                    isAdjustMetadata(version.editMetadata) &&
                                    (version.editMetadata.brightness !==
                                      undefined ||
                                      version.editMetadata.contrast !==
                                        undefined) &&
                                    `B: ${version.editMetadata.brightness ?? 100}%, C: ${version.editMetadata.contrast ?? 100}%`}
                                  {version.editType === "watermark" &&
                                    isWatermarkMetadata(version.editMetadata) &&
                                    `"${version.editMetadata.watermarkText}"`}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
