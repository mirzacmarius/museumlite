"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DraftMediaItem } from "../collection-form-shared/types";

export function useObjectRequestFormLocalMedia({
  currentOrganizationId,
  setError,
  t,
}: {
  currentOrganizationId: Id<"organizations"> | null | undefined;
  setError: (error: string | null) => void;
  t: (key: string) => string;
}) {
  const generateDraftUploadUrl = useMutation(
    api.accessions.generateDraftUploadUrl,
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const [selectedFiles, setSelectedFiles] = useState<
    Array<{
      id: string;
      file: File;
      previewUrl: string;
    }>
  >([]);
  const [selectedDocuments, setSelectedDocuments] = useState<
    Array<{
      id: string;
      file: File;
      fileName: string;
    }>
  >([]);

  useEffect(() => {
    return () => {
      for (const item of selectedFiles) {
        URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, [selectedFiles]);

  const hasLocalMediaSelections =
    selectedFiles.length > 0 || selectedDocuments.length > 0;

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      try {
        const filesList = event.target.files;
        if (!filesList || filesList.length === 0) {
          return;
        }

        const files = Array.from(filesList);
        const newFiles = files.map((file, index) => ({
          id: `${Date.now()}-${index}`,
          file,
          previewUrl: URL.createObjectURL(file),
        }));

        setSelectedFiles((prev) => [...prev, ...newFiles]);

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        if (cameraInputRef.current) {
          cameraInputRef.current.value = "";
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t("form.errors.failedToProcessFile"),
        );
      }
    },
    [setError, t],
  );

  const handleDeleteImage = useCallback((fileId: string) => {
    setSelectedFiles((prev) => {
      const fileToDelete = prev.find((item) => item.id === fileId);
      if (fileToDelete) {
        URL.revokeObjectURL(fileToDelete.previewUrl);
      }

      return prev.filter((item) => item.id !== fileId);
    });
  }, []);

  const handleDocumentSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      try {
        const filesList = event.target.files;
        if (!filesList || filesList.length === 0) {
          return;
        }

        const files = Array.from(filesList);
        const newDocuments = files.map((file, index) => ({
          id: `doc-${Date.now()}-${index}`,
          file,
          fileName: file.name,
        }));

        setSelectedDocuments((prev) => [...prev, ...newDocuments]);

        if (documentInputRef.current) {
          documentInputRef.current.value = "";
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t("form.errors.failedToProcessDocument"),
        );
      }
    },
    [setError, t],
  );

  const handleDeleteDocument = useCallback((docId: string) => {
    setSelectedDocuments((prev) => prev.filter((item) => item.id !== docId));
  }, []);

  const uploadDraftMedia = useCallback(
    async (primaryFileId: string | null): Promise<DraftMediaItem[]> => {
      if (!currentOrganizationId) {
        return [];
      }

      const [uploadedFiles, uploadedDocuments] = await Promise.all([
        Promise.all(
          selectedFiles.map(async (fileData) => {
            const uploadUrlResult = await generateDraftUploadUrl({
              organizationId: currentOrganizationId,
              fileName: fileData.file.name,
              fileSize: fileData.file.size,
              mimeType: fileData.file.type,
            });

            const uploadResponse = await fetch(uploadUrlResult.uploadUrl, {
              method: "POST",
              body: fileData.file,
            });

            if (!uploadResponse.ok) {
              throw new Error(`Failed to upload ${fileData.file.name}`);
            }

            const uploadResult = await uploadResponse.json();
            const storageId = uploadResult.storageId as
              | Id<"_storage">
              | undefined;

            if (!storageId) {
              throw new Error(
                `No storage ID returned for ${fileData.file.name}`,
              );
            }

            return {
              storageId,
              fileName: fileData.file.name,
              fileSize: fileData.file.size,
              mimeType: fileData.file.type,
              mediaCategory: "image",
              isPrimary: fileData.id === primaryFileId,
            } as const;
          }),
        ),
        Promise.all(
          selectedDocuments.map(async (documentData) => {
            const uploadUrlResult = await generateDraftUploadUrl({
              organizationId: currentOrganizationId,
              fileName: documentData.file.name,
              fileSize: documentData.file.size,
              mimeType: documentData.file.type,
            });

            const uploadResponse = await fetch(uploadUrlResult.uploadUrl, {
              method: "POST",
              body: documentData.file,
            });

            if (!uploadResponse.ok) {
              throw new Error(`Failed to upload ${documentData.file.name}`);
            }

            const uploadResult = await uploadResponse.json();
            const storageId = uploadResult.storageId as
              | Id<"_storage">
              | undefined;

            if (!storageId) {
              throw new Error(
                `No storage ID returned for ${documentData.file.name}`,
              );
            }

            return {
              storageId,
              fileName: documentData.file.name,
              fileSize: documentData.file.size,
              mimeType: documentData.file.type,
              mediaCategory: "document",
              isPrimary: false,
            } as const;
          }),
        ),
      ]);

      return [...uploadedFiles, ...uploadedDocuments];
    },
    [
      currentOrganizationId,
      generateDraftUploadUrl,
      selectedDocuments,
      selectedFiles,
    ],
  );

  const clearLocalMediaSelections = useCallback(() => {
    setSelectedFiles([]);
    setSelectedDocuments([]);
  }, []);

  return {
    fileInputRef,
    cameraInputRef,
    documentInputRef,
    selectedFiles,
    selectedDocuments,
    hasLocalMediaSelections,
    handleFileSelect,
    handleDeleteImage,
    handleDocumentSelect,
    handleDeleteDocument,
    uploadDraftMedia,
    clearLocalMediaSelections,
  };
}
