"use client";

import { formatDistanceLocale } from "@/lib/format-date";
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
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { ScrollArea } from "@v1/ui/scroll-area";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import {
  Clock,
  Download,
  Edit,
  File,
  Loader2,
  RotateCcw,
  Star,
} from "lucide-react";
import Link from "next/link";
import NextImage from "next/image";
import { useEffect, useState } from "react";
import { MediaEditorDialog } from "@/components/media-editor-dialog";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
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
  const locale = useCurrentLocale();
  const [isEditing, setIsEditing] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [photographer, setPhotographer] = useState("");
  const [copyright, setCopyright] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [revertVersionId, setRevertVersionId] =
    useState<Id<"mediaVersions"> | null>(null);

  const item = useQuery(api.media.getWithMetadata, { mediaId });
  const versions = useQuery(api.mediaVersions.listVersions, { mediaId });

  const updateMedia = useMutation(api.media.update);
  const setPrimary = useMutation(api.media.setPrimary);
  const deleteMedia = useMutation(api.media.deleteMedia);
  const revertToVersion = useMutation(api.mediaVersions.revertToVersion);

  useEffect(() => {
    if (item) {
      setCaption(item.caption || "");
      setPhotographer(item.photographer || "");
      setCopyright(item.copyright || "");
    }
  }, [item]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateMedia({
        mediaId,
        caption: caption || undefined,
        photographer: photographer || undefined,
        copyright: copyright || undefined,
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetPrimary = async () => {
    await setPrimary({ mediaId });
  };

  const handleDelete = async () => {
    if (confirm(t("mediaPage.deleteConfirm"))) {
      await deleteMedia({ mediaId });
      onClose();
    }
  };

  const handleRevert = async (versionId: Id<"mediaVersions">) => {
    await revertToVersion({ versionId });
    setRevertVersionId(null);
  };

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
            <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
          </div>
        )}

        {item && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="aspect-square overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
              {item.fileType === "image" && item.url ? (
                <div className="relative h-full w-full">
                  <NextImage
                    src={item.url}
                    alt={item.fileName}
                    fill
                    sizes="(min-width: 768px) 40vw, 100vw"
                    className="object-contain"
                  />
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <File className="h-16 w-16 text-zinc-700" />
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
                  {formatDistanceLocale(new Date(item.uploadedAt), locale, {
                    addSuffix: true,
                  })}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-zinc-500">
                  {t("mediaPage.details.object")}
                </p>
                <Link
                  href={`/objects/${item.collectionId}`}
                  className="text-sm text-indigo-400 hover:underline"
                >
                  {item.collectionTitle}
                </Link>
                {item.accessionNumber && (
                  <p className="text-xs text-zinc-500">
                    {item.accessionNumber}
                  </p>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="caption" className="text-xs text-zinc-400">
                      {t("mediaPage.details.caption")}
                    </Label>
                    <Textarea
                      id="caption"
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      rows={2}
                      className="border-zinc-800 bg-zinc-950 text-sm text-zinc-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="photographer"
                      className="text-xs text-zinc-400"
                    >
                      {t("mediaPage.details.photographer")}
                    </Label>
                    <Input
                      id="photographer"
                      value={photographer}
                      onChange={(e) => setPhotographer(e.target.value)}
                      className="border-zinc-800 bg-zinc-950 text-sm text-zinc-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="copyright"
                      className="text-xs text-zinc-400"
                    >
                      {t("mediaPage.details.copyright")}
                    </Label>
                    <Input
                      id="copyright"
                      value={copyright}
                      onChange={(e) => setCopyright(e.target.value)}
                      className="border-zinc-800 bg-zinc-950 text-sm text-zinc-200"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={isSaving}
                      className="bg-indigo-600 hover:bg-indigo-500"
                    >
                      {isSaving
                        ? t("mediaPage.details.saving")
                        : t("mediaPage.details.save")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                      className="border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    >
                      {t("mediaPage.details.cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
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
                      <p className="text-sm text-zinc-300">
                        {item.photographer}
                      </p>
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
              )}

              <div className="flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
                {!isEditing && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                    className="border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  >
                    <Edit className="mr-1 h-3 w-3" />
                    {t("mediaPage.details.editMetadata")}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSetPrimary}
                  className="border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                >
                  <Star className="mr-1 h-3 w-3" />
                  {t("mediaPage.details.setPrimary")}
                </Button>
                {item.fileType === "image" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditorOpen(true)}
                    className="border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  >
                    <Clock className="mr-1 h-3 w-3" />
                    Edit Image
                  </Button>
                )}
                {item.url && (
                  <Button
                    size="sm"
                    variant="outline"
                    asChild
                    className="border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  >
                    <a href={item.url} download>
                      <Download className="mr-1 h-3 w-3" />
                      Download
                    </a>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDelete}
                  className="border-red-900/50 text-red-400 hover:bg-red-950/30 hover:text-red-300"
                >
                  {t("mediaPage.details.delete")}
                </Button>
              </div>

              <div className="space-y-2 border-t border-zinc-800 pt-4">
                <p className="text-sm font-medium text-zinc-200">Versions</p>
                <ScrollArea className="h-48 rounded-lg border border-zinc-800 bg-zinc-950">
                  <div className="space-y-2 p-3">
                    {versions === undefined && (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
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
                              {formatDistanceLocale(
                                new Date(version.createdAt),
                                locale,
                                { addSuffix: true },
                              )}
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
                          <div className="flex items-center">
                            {!isCurrentVersion && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setRevertVersionId(version._id)
                                }
                                className="border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                              >
                                <RotateCcw className="mr-1 h-3 w-3" />
                                Revert
                              </Button>
                            )}
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

      <MediaEditorDialog
        mediaId={mediaId}
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSaved={() => setIsEditorOpen(false)}
      />

      {revertVersionId && (
        <Dialog open onOpenChange={() => setRevertVersionId(null)}>
          <DialogContent className="max-w-md border-zinc-800 bg-zinc-900">
            <DialogHeader>
              <DialogTitle className="text-zinc-200">
                Revert to Version?
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">
                Are you sure you want to revert to this version? This will make
                the selected version the current version of this media file.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRevertVersionId(null)}
                  className="border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleRevert(revertVersionId)}
                  className="bg-indigo-600 hover:bg-indigo-500"
                >
                  Revert
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
