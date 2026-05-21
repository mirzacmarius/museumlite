"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { type LightboxImage, useLightbox } from "@v1/ui/image-lightbox";
import { useMutation, useQuery } from "convex/react";
import { type DragEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { useScopedI18n } from "@/locales/client";

interface UseMediaGalleryOptions {
  collectionId: string;
  onOpenLightbox?: (index: number) => void;
}

export function useMediaGallery({
  collectionId,
  onOpenLightbox,
}: UseMediaGalleryOptions) {
  const t = useScopedI18n("common.toast");
  const common = useScopedI18n("common");
  const formErrors = useScopedI18n("objects.form.errors");

  const media = useQuery(
    api.media.list,
    collectionId ? { collectionId: collectionId as Id<"collections"> } : "skip",
  );
  const updateMedia = useMutation(api.media.update);
  const deleteMedia = useMutation(api.media.deleteMedia);
  const setPrimary = useMutation(api.media.setPrimary);
  const updateOrder = useMutation(api.media.updateOrder);

  const [editingMedia, setEditingMedia] = useState<string | null>(null);
  const [editingImageId, setEditingImageId] = useState<Id<"mediaFiles"> | null>(
    null,
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<Id<"mediaFiles"> | null>(null);
  const [dragOverId, setDragOverId] = useState<Id<"mediaFiles"> | null>(null);

  const mediaArray = Array.isArray(media) ? media : [];

  const images = mediaArray.filter((item) => {
    const category = (item as { mediaCategory?: "image" | "document" })
      .mediaCategory;
    return (
      category === "image" ||
      (!category && (item.fileType === "image" || item.fileType === "video"))
    );
  });

  const documents = mediaArray.filter((item) => {
    const category = (item as { mediaCategory?: "image" | "document" })
      .mediaCategory;
    return (
      category === "document" || (!category && item.fileType === "document")
    );
  });

  const lightboxImages: LightboxImage[] = useMemo(
    () =>
      images.flatMap((image) =>
        image.url && image.fileType === "image"
          ? [
              {
                id: image._id,
                url: image.url,
                thumbnailUrl: image.thumbnailUrl || undefined,
                title: image.fileName,
                caption: image.caption || undefined,
              },
            ]
          : [],
      ),
    [images],
  );

  const {
    isOpen: isLightboxOpen,
    initialIndex: lightboxIndex,
    openLightbox,
    closeLightbox,
  } = useLightbox(lightboxImages);

  const handleSetPrimary = async (mediaId: string) => {
    setError(null);
    try {
      await setPrimary({ mediaId: mediaId as Id<"mediaFiles"> });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : formErrors("failedToSetPrimary"),
      );
    }
  };

  const handleDelete = async (mediaId: string) => {
    setError(null);
    try {
      await deleteMedia({ mediaId: mediaId as Id<"mediaFiles"> });
      setDeleteConfirmOpen(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : formErrors("failedToDeleteMedia"),
      );
    }
  };

  const handleUpdateMedia = async (
    mediaId: Id<"mediaFiles">,
    updates: {
      caption?: string;
      photographer?: string;
      copyright?: string;
    },
  ) => {
    setError(null);
    try {
      await updateMedia({ mediaId, ...updates });
      setEditingMedia(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : formErrors("failedToUpdateMedia"),
      );
    }
  };

  const handleDragStart = (event: DragEvent, mediaId: Id<"mediaFiles">) => {
    setDraggedId(mediaId);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (event: DragEvent, mediaId: Id<"mediaFiles">) => {
    event.preventDefault();
    if (draggedId && draggedId !== mediaId) {
      setDragOverId(mediaId);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = async (event: DragEvent, targetId: Id<"mediaFiles">) => {
    event.preventDefault();
    setDragOverId(null);

    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    const currentOrder = images.map((img) => img._id);
    const draggedIndex = currentOrder.indexOf(draggedId);
    const targetIndex = currentOrder.indexOf(targetId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedId(null);
      return;
    }

    const newOrder = [...currentOrder];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedId);

    try {
      await updateOrder({ mediaIds: newOrder });
      toast.success(t("imageOrderUpdated"));
    } catch {
      toast.error(t("imageOrderUpdateFailed"));
    }

    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const openImageLightbox = (lightboxIdx: number) => {
    if (lightboxIdx < 0) {
      return;
    }
    if (onOpenLightbox) {
      onOpenLightbox(lightboxIdx);
      return;
    }
    openLightbox(lightboxIdx);
  };

  return {
    common,
    isMediaLoading: media === undefined,
    error,
    images,
    documents,
    lightboxImages,
    isLightboxOpen,
    lightboxIndex,
    closeLightbox,
    editingMedia,
    setEditingMedia,
    editingImageId,
    setEditingImageId,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    draggedId,
    dragOverId,
    handleSetPrimary,
    handleDelete,
    handleUpdateMedia,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    openImageLightbox,
  };
}

export type MediaGalleryFile = ReturnType<
  typeof useMediaGallery
>["images"][number];
