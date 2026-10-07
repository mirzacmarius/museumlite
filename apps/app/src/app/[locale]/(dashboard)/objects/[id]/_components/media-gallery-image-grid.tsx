"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { ImageLightbox } from "@v1/ui/image-lightbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@v1/ui/tooltip";
import { cn } from "@v1/ui/utils";
import {
  Edit,
  GripVertical,
  Image as ImageIcon,
  Maximize2,
  Star,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { MediaEditorDialog } from "@/components/media-editor-dialog";
import { PermissionGate } from "@/components/permission-gate";
import { useI18n, useScopedI18n } from "@/locales/client";
import { MediaEditDialog } from "./media-edit-dialog";
import { MediaGalleryFileTypeBadge } from "./media-gallery-file-type-badge";
import { getMediaDisplayKind } from "./media-gallery-utils";
import type { useMediaGallery } from "./use-media-gallery";

interface MediaGalleryImageGridProps {
  gallery: ReturnType<typeof useMediaGallery>;
  editable: boolean;
  onOpenLightbox?: (index: number) => void;
}

export function MediaGalleryImageGrid({
  gallery,
  editable,
  onOpenLightbox,
}: MediaGalleryImageGridProps) {
  const {
    images,
    lightboxImages,
    isLightboxOpen,
    lightboxIndex,
    closeLightbox,
    editingImageId,
    setEditingImageId,
    draggedId,
    dragOverId,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = gallery;

  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editable) return;

    const grid = gridRef.current;
    if (!grid) return;

    const onDragOver = (event: DragEvent) => {
      event.preventDefault();
      const target = (event.target as HTMLElement).closest("[data-media-id]");
      const mediaId = target?.getAttribute("data-media-id");
      if (mediaId) {
        handleDragOver(
          event as unknown as React.DragEvent,
          mediaId as Id<"mediaFiles">,
        );
      }
    };

    const onDragLeave = (event: DragEvent) => {
      const related = event.relatedTarget as Node | null;
      if (related && grid.contains(related)) return;
      handleDragLeave();
    };

    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      const target = (event.target as HTMLElement).closest("[data-media-id]");
      const mediaId = target?.getAttribute("data-media-id");
      if (mediaId) {
        handleDrop(
          event as unknown as React.DragEvent,
          mediaId as Id<"mediaFiles">,
        );
      }
    };

    grid.addEventListener("dragover", onDragOver);
    grid.addEventListener("dragleave", onDragLeave);
    grid.addEventListener("drop", onDrop);

    return () => {
      grid.removeEventListener("dragover", onDragOver);
      grid.removeEventListener("dragleave", onDragLeave);
      grid.removeEventListener("drop", onDrop);
    };
  }, [editable, handleDragOver, handleDragLeave, handleDrop]);

  if (images.length === 0) {
    return null;
  }

  return (
    <>
      <div ref={gridRef} className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {images.map((file) => {
          const mediaId = file._id as Id<"mediaFiles">;
          const lightboxIdx = lightboxImages.findIndex(
            (img) => img.id === file._id,
          );
          return (
            <MediaGalleryImageCard
              key={file._id}
              file={file}
              gallery={gallery}
              editable={editable}
              lightboxIdx={lightboxIdx}
              isDragging={draggedId === mediaId}
              isDragOver={dragOverId === mediaId}
            />
          );
        })}
      </div>

      {!onOpenLightbox && (
        <ImageLightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          isOpen={isLightboxOpen}
          onClose={closeLightbox}
        />
      )}

      {editable && (
        <MediaEditorDialog
          mediaId={editingImageId}
          isOpen={!!editingImageId}
          onClose={() => setEditingImageId(null)}
        />
      )}
    </>
  );
}

type GalleryImageFile = ReturnType<typeof useMediaGallery>["images"][number];

function MediaGalleryImageCard({
  file,
  gallery,
  editable,
  lightboxIdx,
  isDragging,
  isDragOver,
}: {
  file: GalleryImageFile;
  gallery: ReturnType<typeof useMediaGallery>;
  editable: boolean;
  lightboxIdx: number;
  isDragging: boolean;
  isDragOver: boolean;
}) {
  const tRoot = useI18n();
  const tMedia = useScopedI18n("objects.form.media");
  const tGallery = useScopedI18n("objects.mediaGallery");
  const {
    common,
    handleSetPrimary,
    handleUpdateMedia,
    handleDragStart,
    handleDragEnd,
    openImageLightbox,
    editingMedia,
    setEditingMedia,
    setEditingImageId,
  } = gallery;
  const mediaId = file._id as Id<"mediaFiles">;
  const displayKind = getMediaDisplayKind(file);
  const fileTypeLabel =
    displayKind === "video"
      ? tGallery("fileType.video")
      : tGallery("fileType.image");

  return (
    <div
      data-media-id={mediaId}
      className={cn(
        "group relative aspect-square cursor-pointer overflow-hidden rounded-lg border bg-secondary transition-all",
        isDragging && "opacity-50 scale-95",
        isDragOver && "border-primary border-2 ring-2 ring-primary/20",
        !isDragging && !isDragOver && "border-border",
      )}
    >
      {file.url && (
        <>
          {file.fileType === "image" ? (
            <button
              type="button"
              className="size-full cursor-pointer"
              onClick={() => openImageLightbox(lightboxIdx)}
              aria-label={tRoot("untranslatedRecords.objects.media.viewImage", {
                label: file.caption || file.fileName,
              })}
            >
              <Image
                src={file.thumbnailUrl || file.url}
                alt={file.caption || file.fileName}
                fill
                sizes="(max-width: 768px) 100vw, 400px"
                className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
            </button>
          ) : file.fileType === "video" ? (
            <video
              src={file.url}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              controls={false}
              aria-label={file.caption || file.fileName}
            >
              <track kind="captions" />
            </video>
          ) : (
            <div className="flex size-full items-center justify-center bg-muted">
              <ImageIcon className="size-12 text-muted-foreground" />
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-6 text-xs text-white transition-opacity group-hover:opacity-0">
            <p className="truncate font-medium">{file.fileName}</p>
            {file.caption && (
              <p className="truncate text-[10px] text-white/70">
                {file.caption}
              </p>
            )}
          </div>

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-zinc-950/50 opacity-0 transition-opacity group-hover:opacity-100">
            <Maximize2 className="size-6 text-white" />
          </div>

          {editable && !file.isPrimary && (
            <div className="absolute left-2 top-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <button
                type="button"
                draggable
                onDragStart={(event) => handleDragStart(event, mediaId)}
                onDragEnd={handleDragEnd}
                className="flex size-7 items-center justify-center rounded bg-zinc-950/50 cursor-grab active:cursor-grabbing"
                aria-label={tRoot(
                  "untranslatedRecords.objects.media.reorderImage",
                  {
                    filename: file.fileName,
                  },
                )}
              >
                <GripVertical className="size-3.5 text-white" />
              </button>
            </div>
          )}

          {editable && (
            <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <PermissionGate permission="media.upload">
                {!file.isPrimary && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleSetPrimary(file._id);
                    }}
                    title={common("setAsPrimary")}
                    className="size-7 p-0"
                  >
                    <Star className="size-3.5" />
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={(event) => {
                    event.stopPropagation();
                    setEditingImageId(file._id as Id<"mediaFiles">);
                  }}
                  title={common("edit")}
                  className="size-7 p-0"
                >
                  <Edit className="size-3.5" />
                </Button>
                <MediaEditDialog
                  media={file}
                  onUpdate={(updates) =>
                    handleUpdateMedia(file._id as Id<"mediaFiles">, updates)
                  }
                  open={editingMedia === file._id}
                  onOpenChange={(open) =>
                    setEditingMedia(open ? file._id : null)
                  }
                />
              </PermissionGate>
            </div>
          )}

          <div className="absolute left-2 top-2 flex flex-col gap-1">
            {file.isPrimary && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={tMedia("primary")}
                    className="flex size-7 items-center justify-center rounded bg-primary text-primary-foreground"
                  >
                    <Star className="size-4 fill-current" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  {tMedia("primaryImageTooltip")}
                </TooltipContent>
              </Tooltip>
            )}
            <MediaGalleryFileTypeBadge
              kind={displayKind}
              label={fileTypeLabel}
            />
          </div>
        </>
      )}
    </div>
  );
}
