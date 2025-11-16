"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
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
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useUploadFiles } from "@xixixao/uploadstuff/react";
import { useMutation, useQuery } from "convex/react";
import {
  Edit,
  Image as ImageIcon,
  Star,
  StarOff,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface MediaGalleryProps {
  collectionId: string;
  mediaType?: "images" | "documents";
}

export function MediaGallery({ collectionId, mediaType = "images" }: MediaGalleryProps) {
  const { currentOrganizationId } = useOrganization();
  const media = useQuery(
    api.media.list,
    collectionId ? { collectionId: collectionId as Id<"collections"> } : "skip",
  );
  const generateUploadUrl = useMutation(api.media.generateUploadUrl);
  const createMedia = useMutation(api.media.create);
  const updateMedia = useMutation(api.media.update);
  const deleteMedia = useMutation(api.media.deleteMedia);
  const setPrimary = useMutation(api.media.setPrimary);

  const [editingMedia, setEditingMedia] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Store files in a ref so they're accessible in the generateUploadUrl callback
  const filesRef = useRef<File[]>([]);

  const { startUpload } = useUploadFiles(
    async () => {
      if (!currentOrganizationId) {
        throw new Error("Organization missing");
      }

      // Get the current file from the ref
      // useUploadFiles calls this function once per file, so we process files sequentially
      const file = filesRef.current.shift();

      if (!file) {
        throw new Error("No file available for upload");
      }

      const result = await generateUploadUrl({
        organizationId: currentOrganizationId as Id<"organizations">,
        collectionId: collectionId as Id<"collections">,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });

      if (!result.uploadUrl) {
        throw new Error(`Failed to generate upload URL for ${file.name}`);
      }

      return result.uploadUrl;
    },
    {
      onUploadComplete: async (uploaded) => {
        try {
          // Check if uploaded is valid array
          if (!uploaded || !Array.isArray(uploaded) || uploaded.length === 0) {
            setError("Upload completed but no files were returned");
            return;
          }

          if (!currentOrganizationId) {
            setError("Organization not found");
            return;
          }

          // Determine if this is the first media (for setting primary)
          const isFirstMedia =
            !media || (Array.isArray(media) && media.length === 0);

          // Process all uploaded files
          await Promise.all(
            uploaded.map(async (file, index) => {
              if (!file) {
                throw new Error("Upload completed but file data is missing");
              }

              // Extract storageId from uploadstuff response
              // According to Convex docs and uploadstuff, the response is wrapped in file.response
              // Convex returns { storageId: Id<"_storage"> } in the JSON response
              const storageId = (file.response as { storageId: Id<"_storage"> })
                ?.storageId;

              if (!storageId) {
                throw new Error(
                  `Upload completed but no storage ID returned for ${file.name}`,
                );
              }

              // Set the first uploaded file as primary if this is the first media
              // For documents tab, set mediaCategory to "document"
              await createMedia({
                organizationId: currentOrganizationId as Id<"organizations">,
                collectionId: collectionId as Id<"collections">,
                storageId: storageId,
                fileName: file.name || "unknown",
                fileSize: file.size || 0,
                mimeType: file.type || "application/octet-stream",
                isPrimary: isFirstMedia && index === 0 && mediaType === "images", // Only set primary for images
                mediaCategory: mediaType === "documents" ? "document" : "image",
              });
            }),
          );
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to create media records",
          );
        }
      },
      onUploadError: (error) => {
        setError(
          error && typeof error === "object" && "message" in error
            ? String(error.message)
            : "Upload failed",
        );
      },
    },
  );

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    try {
      const filesList = event.target?.files;
      if (!filesList || filesList.length === 0) {
        return;
      }
      const files = Array.from(filesList);
      if (!files || files.length === 0) {
        return;
      }

      // Store files in ref for use by generateUploadUrl callback
      // Make a copy so we don't modify the original array
      filesRef.current = [...files];

      // Upload all selected files
      startUpload(files);

      // Reset the input so the same files can be selected again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to process file selection",
      );
    }
  };

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

  if (media === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Loading media...</p>
      </div>
    );
  }

  // Ensure media is an array
  const mediaArray = Array.isArray(media) ? media : [];

  // Separate images/videos from documents
  const images = mediaArray.filter((m) => {
    const category = (m as any).mediaCategory;
    return (category === "image" || !category) && (m.fileType === "image" || m.fileType === "video");
  });
  const documents = mediaArray.filter((m) => (m as any).mediaCategory === "document");

  // Determine what to show based on mediaType prop
  const showImages = mediaType === "images";
  const showDocuments = mediaType === "documents";

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <PermissionGate permission="media.upload">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">
            {showImages ? "Images & Videos" : "Documents"}
          </h3>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept={showImages ? "image/*,video/*" : ".pdf,image/jpeg,image/jpg,image/png,image/tiff"}
              onChange={handleFileSelect}
              className="hidden"
              multiple
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              {showImages ? "Upload Images" : "Upload Documents"}
            </Button>
          </div>
        </div>
      </PermissionGate>

      {/* Images & Videos Section */}
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {images.map((file) => (
            <div
              key={file._id}
              className="group relative aspect-square overflow-hidden rounded-lg border"
            >
              {file.url && (
                <>
                  {file.fileType === "image" ? (
                    <img
                      src={file.thumbnailUrl || file.url}
                      alt={file.caption || file.fileName}
                      className="h-full w-full object-cover transition-opacity group-hover:opacity-90"
                    />
                  ) : file.fileType === "video" ? (
                    <video
                      src={file.url}
                      className="h-full w-full object-cover"
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

                  {/* Overlay with actions */}
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                    <PermissionGate permission="media.upload">
                      {!file.isPrimary && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => handleSetPrimary(file._id)}
                          title="Set as primary"
                        >
                          <Star className="h-4 w-4" />
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
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Media</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this media file?
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
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

                  {/* Primary badge */}
                  {file.isPrimary && (
                    <div className="absolute top-2 right-2 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
                      Primary
                    </div>
                  )}

                  {/* File name overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 text-xs text-white">
                    <p className="truncate">{file.fileName}</p>
                    {file.caption && (
                      <p className="truncate text-muted-foreground">
                        {file.caption}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
          </div>
        )}
      </div>
      )}

      {/* Documents Section */}
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
                  <p className="truncate font-medium text-sm">{doc.fileName}</p>
                  {doc.caption && (
                    <p className="truncate text-xs text-muted-foreground">
                      {doc.caption}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {doc.url && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      asChild
                    >
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

  // Sync formData when media prop changes (e.g., when editing different items)
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
