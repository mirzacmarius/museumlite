"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useUploadFiles } from "@xixixao/uploadstuff/react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useActionErrorMessage } from "@/hooks/use-action-error-message";
import { getMediaSignature } from "../collection-form-shared/utils";

type CollectionMediaItem = FunctionReturnType<typeof api.media.list>[number];

interface CollectionRecord {
  organizationId: Id<"organizations">;
}

interface UseCollectionEditFormMediaOptions {
  collection: CollectionRecord | null | undefined;
  typedCollectionId: Id<"collections">;
  media: CollectionMediaItem[] | undefined;
  setError: (error: string | null) => void;
  t: (key: string) => string;
}

export function useCollectionEditFormMedia({
  collection,
  typedCollectionId,
  media,
  setError,
  t,
}: UseCollectionEditFormMediaOptions) {
  const actionErrorMessage = useActionErrorMessage();
  const generateUploadUrl = useMutation(api.media.generateUploadUrl);
  const createMedia = useMutation(api.media.create);
  const setPrimary = useMutation(api.media.setPrimary);

  const [isMediaBaselineReady, setIsMediaBaselineReady] = useState(false);
  const initialMediaSignatureRef = useRef("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<File[]>([]);

  useEffect(() => {
    if (media !== undefined && !isMediaBaselineReady) {
      initialMediaSignatureRef.current = getMediaSignature(media);
      setIsMediaBaselineReady(true);
    }
  }, [isMediaBaselineReady, media]);

  const images = useMemo(() => {
    return (
      media?.filter((item) => {
        const category = item.mediaCategory;
        return (category === "image" || !category) && item.fileType === "image";
      }) || []
    );
  }, [media]);

  const documents = useMemo(() => {
    return media?.filter((item) => item.mediaCategory === "document") || [];
  }, [media]);

  const heroImage = useMemo(() => {
    return images.find((item) => item.isPrimary) ?? images[0] ?? null;
  }, [images]);

  const currentMediaSignature = useMemo(
    () => getMediaSignature(media ?? []),
    [media],
  );
  const hasMediaChanges =
    isMediaBaselineReady &&
    currentMediaSignature !== initialMediaSignatureRef.current;

  const { startUpload } = useUploadFiles(
    async () => {
      if (!collection) {
        throw new Error("Collection not loaded");
      }

      const file = filesRef.current.shift();
      if (!file) {
        throw new Error("No file available for upload");
      }

      const result = await generateUploadUrl({
        organizationId: collection.organizationId,
        collectionId: typedCollectionId,
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
          if (!uploaded || !Array.isArray(uploaded) || uploaded.length === 0) {
            setError("Upload completed but no files were returned");
            return;
          }

          if (!collection) {
            setError("Collection not loaded");
            return;
          }

          await Promise.all(
            uploaded.map(async (file) => {
              if (!file) {
                throw new Error("Upload completed but file data is missing");
              }

              const storageId = (file.response as { storageId: Id<"_storage"> })
                ?.storageId;

              if (!storageId) {
                throw new Error(
                  `Upload completed but no storage ID returned for ${file.name}`,
                );
              }

              await createMedia({
                organizationId: collection.organizationId,
                collectionId: typedCollectionId,
                storageId,
                fileName: file.name || "unknown",
                fileSize: file.size || 0,
                mimeType: file.type || "application/octet-stream",
                mediaCategory: "image",
              });
            }),
          );
        } catch (err) {
          setError(
            actionErrorMessage(err, t("form.errors.failedToCreateMedia")),
          );
        }
      },
      onUploadError: () => {
        setError(t("form.errors.uploadFailed"));
      },
    },
  );

  const handleDocumentUpload = useCallback(
    async (files: File[]) => {
      if (!collection) {
        setError("Missing collection data");
        return;
      }

      setError(null);

      try {
        await Promise.all(
          files.map(async (file) => {
            const uploadUrlResult = await generateUploadUrl({
              organizationId: collection.organizationId,
              collectionId: typedCollectionId,
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type,
            });

            if (!uploadUrlResult.uploadUrl) {
              throw new Error(`Failed to generate upload URL for ${file.name}`);
            }

            const uploadResponse = await fetch(uploadUrlResult.uploadUrl, {
              method: "POST",
              body: file,
            });

            if (!uploadResponse.ok) {
              throw new Error(`Failed to upload ${file.name}`);
            }

            const uploadResult = await uploadResponse.json();
            const storageId = uploadResult.storageId as
              | Id<"_storage">
              | undefined;

            if (!storageId) {
              throw new Error(`No storage ID returned for ${file.name}`);
            }

            await createMedia({
              organizationId: collection.organizationId,
              collectionId: typedCollectionId,
              storageId,
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type,
              mediaCategory: "document",
              isPrimary: false,
            });
          }),
        );
      } catch (err) {
        console.error("Error uploading documents:", err);
        setError(
          actionErrorMessage(err, t("form.errors.failedToUploadDocuments")),
        );
      }
    },
    [
      actionErrorMessage,
      collection,
      createMedia,
      generateUploadUrl,
      setError,
      t,
      typedCollectionId,
    ],
  );

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      try {
        const filesList = event.target.files;
        if (!filesList || filesList.length === 0) {
          return;
        }

        const files = Array.from(filesList);
        filesRef.current = [...files];
        startUpload(files);

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        if (cameraInputRef.current) {
          cameraInputRef.current.value = "";
        }
      } catch (err) {
        setError(actionErrorMessage(err, t("form.errors.failedToProcessFile")));
      }
    },
    [actionErrorMessage, setError, startUpload, t],
  );

  const handleDocumentSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      try {
        const filesList = event.target.files;
        if (!filesList || filesList.length === 0) {
          return;
        }

        const files = Array.from(filesList);
        await handleDocumentUpload(files);

        if (documentInputRef.current) {
          documentInputRef.current.value = "";
        }
      } catch (err) {
        setError(
          actionErrorMessage(err, t("form.errors.failedToProcessDocument")),
        );
      }
    },
    [actionErrorMessage, handleDocumentUpload, setError, t],
  );

  const handleSetPrimary = useCallback(
    async (mediaId: string) => {
      setError(null);
      try {
        await setPrimary({ mediaId: mediaId as Id<"mediaFiles"> });
      } catch (err) {
        setError(actionErrorMessage(err, t("form.errors.failedToSetPrimary")));
      }
    },
    [actionErrorMessage, setError, setPrimary, t],
  );

  return {
    media,
    images,
    documents,
    heroImage,
    hasMediaChanges,
    fileInputRef,
    cameraInputRef,
    documentInputRef,
    handleFileSelect,
    handleDocumentSelect,
    handleSetPrimary,
  };
}
