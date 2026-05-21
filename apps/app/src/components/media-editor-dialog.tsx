"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useOrganization } from "@/components/organization-provider";
import {
  type EditMetadata,
  MediaEditor,
  type MediaEditorImage,
  type WatermarkSettings,
} from "./media-editor";

interface MediaEditorDialogProps {
  mediaId: Id<"mediaFiles"> | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function MediaEditorDialog({
  mediaId,
  isOpen,
  onClose,
  onSaved,
}: MediaEditorDialogProps) {
  const { currentOrganizationId } = useOrganization();
  const isSavingRef = useRef(false);

  // Load media file data
  const mediaFile = useQuery(
    api.media.getWithMetadata,
    mediaId ? { mediaId } : "skip",
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

  const handleSave = useCallback(
    async (editedBlob: Blob, editMetadata: EditMetadata) => {
      if (!mediaId || !currentOrganizationId || !mediaFile) {
        toast.error("Missing required data to save");
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
          throw new Error("Failed to upload edited image");
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

        // Create new version
        const versionId = await createVersion({
          mediaId: mediaId,
          storageId: storageId as Id<"_storage">,
          editType,
          editMetadata,
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

        toast.success("Media edited successfully");
        onSaved?.();
        onClose();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to save edited media",
        );
      } finally {
        isSavingRef.current = false;
      }
    },
    [
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
  if (!isOpen || !mediaId) {
    return null;
  }

  // Show loading state while fetching media data
  if (!mediaFile || !currentOrganizationId) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span>Loading media…</span>
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

  // Prepare watermark settings
  const watermarkSettings: WatermarkSettings | undefined = organizationSettings
    ?.settings?.watermarkSettings
    ? {
        isEnabled:
          organizationSettings.settings.watermarkSettings.isEnabled ?? false,
        text: organizationSettings.settings.watermarkSettings.text ?? "",
        opacity: organizationSettings.settings.watermarkSettings.opacity ?? 0.5,
        position:
          organizationSettings.settings.watermarkSettings.position ??
          "bottom-right",
      }
    : undefined;

  return (
    <MediaEditor
      image={editorImage}
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      watermarkSettings={watermarkSettings}
    />
  );
}
