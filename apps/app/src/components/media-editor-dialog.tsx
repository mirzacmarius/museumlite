"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ImageDeletionDialogs } from "@/components/image-deletion-dialogs";
import { useOrganization } from "@/components/organization-provider";
import { useActionErrorMessage } from "@/hooks/use-action-error-message";
import { useI18n } from "@/locales/client";
import {
  type EditMetadata,
  MediaEditor,
  type MediaEditorImage,
  type WatermarkSettings,
} from "./media-editor";

/** How the object's edit form collects image deletions until it is updated. */
export interface MediaEditorDialogDeletion {
  marked: boolean;
  onMark: (requiresApproval: boolean) => void;
  onKeep: () => void;
}

interface MediaEditorDialogProps {
  mediaId: Id<"mediaFiles"> | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  /** Offers deleting the image, as the object's edit form does. */
  deletion?: MediaEditorDialogDeletion;
}

export function MediaEditorDialog({
  mediaId,
  isOpen,
  onClose,
  onSaved,
  deletion,
}: MediaEditorDialogProps) {
  const translate = useI18n();
  const actionErrorMessage = useActionErrorMessage();
  const { currentOrganizationId } = useOrganization();
  const isSavingRef = useRef(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Load media file data
  const mediaFile = useQuery(
    api.media.getWithMetadata,
    mediaId ? { mediaId } : "skip",
  );
  const deletionState = useQuery(
    api.mediaDeletions.getDeletionState,
    deletion && isOpen && mediaId ? { mediaId } : "skip",
  );

  // Load organization for watermark settings
  const organizationSettings = useQuery(
    api.organizations.get,
    currentOrganizationId ? { organizationId: currentOrganizationId } : "skip",
  );

  // Mutations
  const createVersion = useMutation(api.mediaVersions.createVersion);
  const trackEdit = useMutation(api.mediaEdits.trackEdit);
  const generateUploadUrl = useMutation(api.media.generateUploadUrl);

  // An image that already carries the watermark starts without another one.
  const savedWatermark = organizationSettings?.settings?.watermarkSettings;
  const alreadyWatermarked = mediaFile?.watermarked === true;
  const watermarkSettings = useMemo<WatermarkSettings | undefined>(
    () =>
      savedWatermark
        ? {
            isEnabled:
              (savedWatermark.isEnabled ?? false) && !alreadyWatermarked,
            text: savedWatermark.text ?? "",
            opacity: savedWatermark.opacity ?? 0.5,
            position: savedWatermark.position ?? "bottom-right",
          }
        : undefined,
    [savedWatermark, alreadyWatermarked],
  );

  const handleSave = useCallback(
    async (editedBlob: Blob, editMetadata: EditMetadata) => {
      if (!mediaId || !currentOrganizationId || !mediaFile) {
        toast.error(
          translate("untranslatedComponents.mediaEditor.missingSaveData"),
        );
        return;
      }

      isSavingRef.current = true;

      try {
        // Generate upload URL
        const uploadResponse = await generateUploadUrl({
          organizationId: currentOrganizationId,
          collectionId: mediaFile.collectionId,
          fileName: `edited_${mediaFile.fileName}`,
          fileSize: editedBlob.size,
          mimeType: editedBlob.type,
        });

        // Upload the edited image
        const response = await fetch(uploadResponse.uploadUrl, {
          method: "POST",
          headers: { "Content-Type": editedBlob.type },
          body: editedBlob,
        });

        if (!response.ok) {
          throw new Error(
            translate("untranslatedComponents.mediaEditor.uploadFailed"),
          );
        }

        const { storageId } = await response.json();

        // Determine edit type based on what was changed
        let editType: "crop" | "rotate" | "adjust" | "watermark" = "adjust";
        if (editMetadata.crop) {
          editType = "crop";
        } else if (editMetadata.rotation) {
          editType = "rotate";
        } else if (editMetadata.watermark?.enabled) {
          editType = "watermark";
        }

        // Create new version. Its image keeps a watermark burned in before.
        const watermarked =
          editMetadata.watermark?.enabled === true || mediaFile.watermarked;
        const versionId = await createVersion({
          mediaId: mediaId,
          storageId: storageId as Id<"_storage">,
          editType,
          editMetadata: watermarked
            ? { ...editMetadata, watermarked }
            : editMetadata,
        });

        // Track all individual edits
        if (editMetadata.crop) {
          await trackEdit({
            mediaId,
            versionId,
            operation: "crop",
            parameters: editMetadata.crop,
          });
        }

        if (editMetadata.rotation) {
          await trackEdit({
            mediaId,
            versionId,
            operation: "rotate",
            parameters: { degrees: editMetadata.rotation },
          });
        }

        if (
          editMetadata.brightness !== undefined ||
          editMetadata.contrast !== undefined
        ) {
          await trackEdit({
            mediaId,
            versionId,
            operation: "adjust",
            parameters: {
              brightness: editMetadata.brightness,
              contrast: editMetadata.contrast,
            },
          });
        }

        if (editMetadata.watermark?.enabled) {
          await trackEdit({
            mediaId,
            versionId,
            operation: "watermark",
            parameters: editMetadata.watermark,
          });
        }

        toast.success(
          translate("untranslatedComponents.mediaEditor.mediaEdited"),
        );
        onSaved?.();
        onClose();
      } catch (error) {
        toast.error(
          actionErrorMessage(
            error,
            translate(
              "untranslatedComponents.mediaEditor.failedToSaveEditedMedia",
            ),
          ),
        );
      } finally {
        isSavingRef.current = false;
      }
    },
    [
      actionErrorMessage,
      mediaId,
      currentOrganizationId,
      mediaFile,
      generateUploadUrl,
      createVersion,
      trackEdit,
      onSaved,
      onClose,
    ],
  );

  // Don't render if not open or no media
  // A deleted image (null) has nothing to edit; never cover the page for it.
  if (!isOpen || !mediaId || mediaFile === null) {
    return null;
  }

  // Show loading state while fetching media data
  if (!mediaFile || !currentOrganizationId) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span>{translate("untranslatedComponents.labels.loadingMedia")}</span>
        </div>
      </div>
    );
  }

  // Prepare image data for MediaEditor
  const editorImage: MediaEditorImage = {
    id: mediaFile._id,
    url: mediaFile.url || "",
    title: mediaFile.fileName,
  };

  const canDelete = deletionState?.canDelete === true;
  const deletionPending =
    deletionState !== undefined &&
    deletionState !== null &&
    deletionState.pendingRequestedAt !== null;

  return (
    <>
      <MediaEditor
        image={editorImage}
        isOpen={isOpen}
        // Escape answers the open confirmation, not the editor behind it.
        onClose={isConfirmingDelete ? () => {} : onClose}
        onSave={handleSave}
        watermarkSettings={watermarkSettings}
        deletion={
          deletion && (canDelete || deletionPending)
            ? {
                pending: deletionPending,
                marked: deletion.marked,
                onDelete: () => setIsConfirmingDelete(true),
                onKeep: deletion.onKeep,
              }
            : undefined
        }
      />
      {deletion && canDelete && deletionState ? (
        <ImageDeletionDialogs
          fileName={mediaFile.fileName}
          requiresApproval={deletionState.requiresApproval}
          open={isConfirmingDelete}
          onOpenChange={setIsConfirmingDelete}
          onConfirm={() => {
            deletion.onMark(deletionState.requiresApproval);
            onClose();
          }}
        />
      ) : null}
    </>
  );
}
