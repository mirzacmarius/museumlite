"use client";

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
import { Edit, Trash2 } from "lucide-react";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { MediaEditDialog } from "./media-edit-dialog";
import type { useMediaGallery } from "./use-media-gallery";

interface MediaGalleryDocumentsProps {
  gallery: ReturnType<typeof useMediaGallery>;
  editable: boolean;
}

export function MediaGalleryDocuments({
  gallery,
  editable,
}: MediaGalleryDocumentsProps) {
  const tMedia = useScopedI18n("objects.form.media");
  const {
    common,
    documents,
    editingMedia,
    setEditingMedia,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    handleDelete,
    handleUpdateMedia,
  } = gallery;

  if (documents.length === 0) {
    return (
      <div className="flex h-20 flex-col items-center justify-center rounded-lg border border-dashed">
        <p className="text-xs text-muted-foreground">No documents uploaded</p>
      </div>
    );
  }

  return (
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
          <div className="ml-4 flex items-center gap-2">
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
                      title={common("delete")}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {tMedia("deleteDocument")}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {tMedia("deleteDocumentConfirm")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{common("cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(doc._id)}>
                        {common("delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </PermissionGate>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
