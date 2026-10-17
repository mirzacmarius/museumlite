"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { EmptyState } from "@v1/ui/empty-state";
import { Edit, FileText } from "lucide-react";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { MediaEditDialog } from "./media-edit-dialog";
import { MediaGalleryFileTypeBadge } from "./media-gallery-file-type-badge";
import { MediaGalleryPdfPreview } from "./media-gallery-pdf-preview";
import { MediaGalleryPreviewFallback } from "./media-gallery-preview-fallback";
import {
  formatMediaFileSize,
  getFileExtensionLabel,
  getMediaDisplayKind,
  isPdfFile,
} from "./media-gallery-utils";
import type { useMediaGallery } from "./use-media-gallery";

interface MediaGalleryDocumentsProps {
  gallery: ReturnType<typeof useMediaGallery>;
  editable: boolean;
}

export function MediaGalleryDocuments({
  gallery,
  editable,
}: MediaGalleryDocumentsProps) {
  const _tMedia = useScopedI18n("objects.form.media");
  const t = useScopedI18n("objects.mediaGallery");
  const {
    common,
    documents,
    editingMedia,
    setEditingMedia,
    handleUpdateMedia,
  } = gallery;

  if (documents.length === 0) {
    return (
      <EmptyState
        variant="card"
        size="sm"
        icon={FileText}
        title={t("noDocuments")}
      />
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => {
        const displayKind = getMediaDisplayKind(doc);
        const isPdf = isPdfFile(doc);
        const fileTypeLabel =
          displayKind === "pdf"
            ? t("fileType.pdf")
            : displayKind === "model3d"
              ? t("fileType.model3d")
              : t("fileType.document");

        return (
          <div
            key={doc._id}
            className="space-y-3 rounded-lg border border-border/60 bg-card p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium text-sm">{doc.fileName}</p>
                  <MediaGalleryFileTypeBadge
                    kind={displayKind}
                    label={fileTypeLabel}
                  />
                </div>
                {doc.caption && (
                  <p className="truncate text-xs text-muted-foreground">
                    {doc.caption}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {getFileExtensionLabel(doc.fileName)} •{" "}
                  {formatMediaFileSize(doc.fileSize)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {editable && (
                  <PermissionGate permission="media.upload">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingMedia(doc._id)}
                      title={common("edit")}
                    >
                      <Edit className="size-4" />
                    </Button>
                    <MediaEditDialog
                      media={doc}
                      onUpdate={(updates) =>
                        handleUpdateMedia(doc._id as Id<"mediaFiles">, updates)
                      }
                      open={editingMedia === doc._id}
                      onOpenChange={(open) =>
                        setEditingMedia(open ? doc._id : null)
                      }
                    />
                  </PermissionGate>
                )}
              </div>
            </div>

            {isPdf && doc.url ? (
              <MediaGalleryPdfPreview
                url={doc.url}
                fileName={doc.fileName}
                previewFailedTitle={t("previewFailedTitle")}
                previewFailedDescription={t("previewFailedDescription")}
                openLabel={t("openExternal")}
                downloadLabel={t("download")}
              />
            ) : doc.url ? (
              displayKind === "unsupported" || displayKind === "model3d" ? (
                <MediaGalleryPreviewFallback
                  title={t("unsupportedPreviewTitle")}
                  description={t("unsupportedPreviewDescription")}
                  openLabel={t("openExternal")}
                  downloadLabel={t("download")}
                  href={doc.url}
                  variant="inline"
                />
              ) : (
                <MediaGalleryPreviewFallback
                  title={t("documentOpenTitle")}
                  description={t("documentOpenDescription")}
                  openLabel={t("openExternal")}
                  downloadLabel={t("download")}
                  href={doc.url}
                  variant="inline"
                />
              )
            ) : (
              <MediaGalleryPreviewFallback
                title={t("missingFileTitle")}
                description={t("missingFileDescription")}
                openLabel={t("openExternal")}
                downloadLabel={t("download")}
                href={null}
                variant="inline"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
