"use client";

import {
  DropzoneUploader,
  type UploadFile,
} from "@/components/dropzone-uploader";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@v1/ui/alert-dialog";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@v1/ui/dialog";
import {
  ImageLightbox,
  type LightboxImage,
  useLightbox,
} from "@v1/ui/image-lightbox";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { cn } from "@v1/ui/utils";
import { useUploadFiles } from "@xixixao/uploadstuff/react";
import { useMutation, useQuery } from "convex/react";
import {
  Edit,
  GripVertical,
  Image as ImageIcon,
  Maximize2,
  Star,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

interface MediaGalleryProps {
  collectionId: string;
  mediaType?: "images" | "documents";
  onOpenLightbox?: (index: number) => void;
}

export function MediaGallery({
  collectionId,
  mediaType = "images",
  onOpenLightbox,
}: MediaGalleryProps) {
  const { currentOrganizationId } = useOrganization();
  const t = useScopedI18n("common.toast");
  const media = useQuery(
    api.media.list,
    collectionId ? { collectionId: collectionId as Id<"collections"> } : "skip",
  );
  const generateUploadUrl = useMutation(api.media.generateUploadUrl);
  const createMedia = useMutation(api.media.create);
  const updateMedia = useMutation(api.media.update);
  const deleteMedia = useMutation(api.media.deleteMedia);
  const setPrimary = useMutation(api.media.setPrimary);
  const updateOrder = useMutation(api.media.updateOrder);

  const [editingMedia, setEditingMedia] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<UploadFile[]>([]);
  const filesRef = useRef<File[]>([]);
  const uploadIdMapRef = useRef<Map<string, string>>(new Map());
  const [draggedId, setDraggedId] = useState<Id<"mediaFiles"> | null>(null);
  const [dragOverId, setDragOverId] = useState<Id<"mediaFiles"> | null>(null);

  const updateUploadStatus = useCallback(
    (fileName: string, updates: Partial<Omit<UploadFile, "id" | "file">>) => {
      const uploadId = uploadIdMapRef.current.get(fileName);
      if (!uploadId) return;

      setUploadingFiles((prev) =>
        prev.map((f) => (f.id === uploadId ? { ...f, ...updates } : f)),
      );
    },
    [],
  );

  const { startUpload } = useUploadFiles(
    async () => {
      if (!currentOrganizationId) {
        throw new Error("Organization missing");
      }

      const file = filesRef.current.shift();

      if (!file) {
        throw new Error("No file available for upload");
      }

      updateUploadStatus(file.name, { status: "uploading", progress: 10 });

      const result = await generateUploadUrl({
        organizationId: currentOrganizationId as Id<"organizations">,
        collectionId: collectionId as Id<"collections">,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });

      if (!result.uploadUrl) {
        updateUploadStatus(file.name, {
          status: "error",
          error: "Failed to generate upload URL",
        });
        throw new Error(`Failed to generate upload URL for ${file.name}`);
      }

      updateUploadStatus(file.name, { progress: 30 });

      return result.uploadUrl;
    },
    {
      onUploadComplete: async (uploaded) => {
        try {
          if (!uploaded || !Array.isArray(uploaded) || uploaded.length === 0) {
            setError("Upload completed but no files were returned");
            return;
          }

          if (!currentOrganizationId) {
            setError("Organization not found");
            return;
          }

          const isFirstMedia =
            !media || (Array.isArray(media) && media.length === 0);

          await Promise.all(
            uploaded.map(async (file, index) => {
              if (!file) {
                throw new Error("Upload completed but file data is missing");
              }

              updateUploadStatus(file.name, { progress: 95 });

              const storageId = (file.response as { storageId: Id<"_storage"> })
                ?.storageId;

              if (!storageId) {
                updateUploadStatus(file.name, {
                  status: "error",
                  error: "No storage ID returned",
                });
                throw new Error(
                  `Upload completed but no storage ID returned for ${file.name}`,
                );
              }

              await createMedia({
                organizationId: currentOrganizationId as Id<"organizations">,
                collectionId: collectionId as Id<"collections">,
                storageId: storageId,
                fileName: file.name || "unknown",
                fileSize: file.size || 0,
                mimeType: file.type || "application/octet-stream",
                isPrimary:
                  isFirstMedia && index === 0 && mediaType === "images",
                mediaCategory: mediaType === "documents" ? "document" : "image",
              });

              updateUploadStatus(file.name, {
                status: "complete",
                progress: 100,
              });
            }),
          );

          setTimeout(() => {
            setUploadingFiles((prev) =>
              prev.filter((f) => f.status !== "complete"),
            );
          }, 2000);
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to create media records",
          );
        }
      },
      onUploadError: (uploadError) => {
        setError(
          uploadError &&
            typeof uploadError === "object" &&
            "message" in uploadError
            ? String(uploadError.message)
            : "Upload failed",
        );
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.status === "uploading"
              ? { ...f, status: "error", error: "Upload failed" }
              : f,
          ),
        );
      },
    },
  );

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      setError(null);

      const newUploads: UploadFile[] = files.map((file) => {
        const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        uploadIdMapRef.current.set(file.name, id);
        return {
          id,
          file,
          progress: 0,
          status: "pending" as const,
        };
      });

      setUploadingFiles((prev) => [...prev, ...newUploads]);
      filesRef.current = [...files];
      startUpload(files);
    },
    [startUpload],
  );

  const handleSetPrimary = async (mediaId: string) => {
    setError(null);
    try {
      await setPrimary({ mediaId: mediaId as Id<"mediaFiles"> });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to set primary image",
      );
    }
  };

  const handleDelete = async (mediaId: string) => {
    setError(null);
    try {
      await deleteMedia({ mediaId: mediaId as Id<"mediaFiles"> });
      setDeleteConfirmOpen(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete media");
    }
  };

  const handleDragStart = (e: React.DragEvent, mediaId: Id<"mediaFiles">) => {
    setDraggedId(mediaId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, mediaId: Id<"mediaFiles">) => {
    e.preventDefault();
    if (draggedId && draggedId !== mediaId) {
      setDragOverId(mediaId);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetId: Id<"mediaFiles">) => {
    e.preventDefault();
    setDragOverId(null);

    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    const currentOrder = images.map((img) => img._id);
    const draggedIndex = currentOrder.findIndex((id) => id === draggedId);
    const targetIndex = currentOrder.findIndex((id) => id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedId(null);
      return;
    }

    const newOrder = [...currentOrder];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedId);

    try {
      await updateOrder({
        mediaIds: newOrder,
      });
      toast.success(t("imageOrderUpdated"));
    } catch (err) {
      toast.error(t("imageOrderUpdateFailed"));
    }

    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  if (media === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Loading media...</p>
      </div>
    );
  }

  const mediaArray = Array.isArray(media) ? media : [];

  const images = mediaArray.filter((m) => {
    const category = (m as { mediaCategory?: "image" | "document" })
      .mediaCategory;
    return (
      category === "image" ||
      (!category && (m.fileType === "image" || m.fileType === "video"))
    );
  });
  const documents = mediaArray.filter((m) => {
    const category = (m as { mediaCategory?: "image" | "document" })
      .mediaCategory;
    return category === "document" || (!category && m.fileType === "document");
  });

  const showImages = mediaType === "images";
  const showDocuments = mediaType === "documents";

  const lightboxImages: LightboxImage[] = useMemo(
    () =>
      images
        .filter((img) => img.url && img.fileType === "image")
        .map((img) => ({
          id: img._id,
          url: img.url as string,
          thumbnailUrl: img.thumbnailUrl || undefined,
          title: img.fileName,
          caption: img.caption || undefined,
        })),
    [images],
  );

  const {
    isOpen: isLightboxOpen,
    initialIndex: lightboxIndex,
    openLightbox,
    closeLightbox,
  } = useLightbox(lightboxImages);

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <PermissionGate permission="media.upload">
        <div className="space-y-4">
          <h3 className="text-lg font-medium">
            {showImages ? "Images & Videos" : "Documents"}
          </h3>
          <DropzoneUploader
            accept={
              showImages
                ? "image/*,video/*"
                : ".pdf,image/jpeg,image/jpg,image/png,image/tiff"
            }
            onFilesSelected={handleFilesSelected}
            uploadingFiles={uploadingFiles}
            label={
              showImages ? "Drop images or videos here" : "Drop documents here"
            }
            sublabel="or click to browse"
          />
        </div>
      </PermissionGate>

      {showImages && (
        <div className="space-y-3">
          {images.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed">
              <ImageIcon className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                No images or videos uploaded
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {images.map((file) => {
                  const mediaId = file._id as Id<"mediaFiles">;
                  const lightboxIdx = lightboxImages.findIndex(
                    (img) => img.id === file._id,
                  );
                  const isDragging = draggedId === mediaId;
                  const isDragOver = dragOverId === mediaId;
                  return (
                    <div
                      key={file._id}
                      draggable={!file.isPrimary}
                      onDragStart={(e) => handleDragStart(e, mediaId)}
                      onDragOver={(e) => handleDragOver(e, mediaId)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, mediaId)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "group relative aspect-square cursor-pointer overflow-hidden rounded-lg border bg-secondary transition-all",
                        isDragging && "opacity-50 scale-95",
                        isDragOver &&
                          "border-primary border-2 ring-2 ring-primary/20",
                        !isDragging && !isDragOver && "border-border",
                      )}
                    >
                      {file.url && (
                        <>
                          {file.fileType === "image" ? (
                            <button
                              type="button"
                              className="h-full w-full cursor-pointer"
                              onClick={() => {
                                if (lightboxIdx >= 0) {
                                  if (onOpenLightbox) {
                                    onOpenLightbox(lightboxIdx);
                                  } else {
                                    openLightbox(lightboxIdx);
                                  }
                                }
                              }}
                              aria-label={`View ${file.caption || file.fileName}`}
                            >
                              <img
                                src={file.thumbnailUrl || file.url}
                                alt={file.caption || file.fileName}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                              />
                            </button>
                          ) : file.fileType === "video" ? (
                            <video
                              src={file.url}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                              controls={false}
                              aria-label={file.caption || file.fileName}
                            >
                              <track kind="captions" />
                            </video>
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-muted">
                              <ImageIcon className="h-12 w-12 text-muted-foreground" />
                            </div>
                          )}

                          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-6 text-xs text-white transition-opacity group-hover:opacity-0">
                            <p className="truncate font-medium">
                              {file.fileName}
                            </p>
                            {file.caption && (
                              <p className="truncate text-[10px] text-white/70">
                                {file.caption}
                              </p>
                            )}
                          </div>

                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                            <Maximize2 className="h-6 w-6 text-white" />
                          </div>

                          {!file.isPrimary && (
                            <div className="absolute left-2 top-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                              <div className="flex h-7 w-7 items-center justify-center rounded bg-black/50 cursor-grab active:cursor-grabbing">
                                <GripVertical className="h-3.5 w-3.5 text-white" />
                              </div>
                            </div>
                          )}

                          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                            <PermissionGate permission="media.upload">
                              {!file.isPrimary && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSetPrimary(file._id);
                                  }}
                                  title="Set as primary"
                                  className="h-7 w-7 p-0"
                                >
                                  <Star className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <MediaEditDialog
                                media={file}
                                onUpdate={async (updates) => {
                                  setError(null);
                                  try {
                                    await updateMedia({
                                      mediaId: file._id as Id<"mediaFiles">,
                                      ...updates,
                                    });
                                    setEditingMedia(null);
                                  } catch (err) {
                                    setError(
                                      err instanceof Error
                                        ? err.message
                                        : "Failed to update media",
                                    );
                                  }
                                }}
                                open={editingMedia === file._id}
                                onOpenChange={(open) =>
                                  setEditingMedia(open ? file._id : null)
                                }
                              />
                              <AlertDialog
                                open={deleteConfirmOpen === file._id}
                                onOpenChange={(open) =>
                                  setDeleteConfirmOpen(open ? file._id : null)
                                }
                              >
                                <AlertDialogTrigger asChild>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    onClick={(e) => e.stopPropagation()}
                                    title="Delete"
                                    className="h-7 w-7 p-0"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Delete Media
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this media
                                      file? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(file._id)}
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </PermissionGate>
                          </div>

                          {file.isPrimary && (
                            <div className="absolute left-2 top-2 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
                              Primary
                            </div>
                          )}
                        </>
                      )}
                    </div>
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
            </>
          )}
        </div>
      )}

      {showDocuments && (
        <div className="space-y-3">
          {documents.length === 0 ? (
            <div className="flex h-20 flex-col items-center justify-center rounded-lg border border-dashed">
              <p className="text-xs text-muted-foreground">
                No documents uploaded
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc._id}
                  className="group flex items-center justify-between rounded-md border bg-card p-3 transition-colors hover:bg-muted"
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-sm">
                      {doc.fileName}
                    </p>
                    {doc.caption && (
                      <p className="truncate text-xs text-muted-foreground">
                        {doc.caption}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {doc.url && (
                      <Button type="button" size="sm" variant="ghost" asChild>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs"
                        >
                          View
                        </a>
                      </Button>
                    )}
                    <PermissionGate permission="media.upload">
                      <MediaEditDialog
                        media={doc}
                        onUpdate={async (updates) => {
                          setError(null);
                          try {
                            await updateMedia({
                              mediaId: doc._id as Id<"mediaFiles">,
                              ...updates,
                            });
                            setEditingMedia(null);
                          } catch (err) {
                            setError(
                              err instanceof Error
                                ? err.message
                                : "Failed to update media",
                            );
                          }
                        }}
                        open={editingMedia === doc._id}
                        onOpenChange={(open) =>
                          setEditingMedia(open ? doc._id : null)
                        }
                      />
                      <AlertDialog
                        open={deleteConfirmOpen === doc._id}
                        onOpenChange={(open) =>
                          setDeleteConfirmOpen(open ? doc._id : null)
                        }
                      >
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Document</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this document?
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(doc._id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </PermissionGate>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface MediaEditDialogProps {
  media: {
    _id: string;
    caption?: string | null;
    photographer?: string | null;
    copyright?: string | null;
  };
  onUpdate: (updates: {
    caption?: string;
    photographer?: string;
    copyright?: string;
  }) => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function MediaEditDialog({
  media,
  onUpdate,
  open,
  onOpenChange,
}: MediaEditDialogProps) {
  const [formData, setFormData] = useState({
    caption: media.caption || "",
    photographer: media.photographer || "",
    copyright: media.copyright || "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setFormData({
      caption: media.caption || "",
      photographer: media.photographer || "",
      copyright: media.copyright || "",
    });
  }, [media._id, media.caption, media.photographer, media.copyright]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onUpdate({
        caption: formData.caption || undefined,
        photographer: formData.photographer || undefined,
        copyright: formData.copyright || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="secondary" title="Edit">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Media Metadata</DialogTitle>
            <DialogDescription>
              Update the metadata for this media file.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="caption">Caption</Label>
              <Textarea
                id="caption"
                value={formData.caption}
                onChange={(e) =>
                  setFormData({ ...formData, caption: e.target.value })
                }
                placeholder="Enter a caption for this media..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="photographer">Photographer</Label>
              <Input
                id="photographer"
                value={formData.photographer}
                onChange={(e) =>
                  setFormData({ ...formData, photographer: e.target.value })
                }
                placeholder="Photographer name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="copyright">Copyright</Label>
              <Input
                id="copyright"
                value={formData.copyright}
                onChange={(e) =>
                  setFormData({ ...formData, copyright: e.target.value })
                }
                placeholder="Copyright information"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
