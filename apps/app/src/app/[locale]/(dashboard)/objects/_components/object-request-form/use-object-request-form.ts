"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { useBeforeUnload } from "@/hooks/use-before-unload";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useScopedI18n } from "@/locales/client";
import { getObjectEditTabs } from "../../[id]/_components/object-tab-config";
import type {
  CollectionEditTabId,
  CollectionFormData,
  DraftMediaItem,
} from "../collection-form-shared/types";
import {
  buildDraftMediaPayload,
  buildObjectDraftPayload,
  createEmptyFormData,
  createFormDataFromDraftObject,
  getFormSignature,
} from "../collection-form-shared/utils";

export interface UseObjectRequestFormOptions {
  mode?: "create" | "draft-edit";
  accessionId?: Id<"accessions">;
  initialDraftObjectData?: Partial<CollectionFormData>;
  initialDraftMedia?: DraftMediaItem[];
  initialDraftSavedAt?: number | null;
  prefilledCollectionGroupId?: string;
  backHref?: string;
}

export function useObjectRequestForm({
  mode = "create",
  accessionId,
  initialDraftObjectData,
  initialDraftMedia,
  initialDraftSavedAt = null,
  prefilledCollectionGroupId,
  backHref,
}: UseObjectRequestFormOptions) {
  const t = useScopedI18n("objects");
  const common = useScopedI18n("common");
  const placeholders = useScopedI18n("objects.form.placeholders");
  const { push } = useRouter();
  const searchParams = useSearchParams();
  const getSearchParam = searchParams.get.bind(searchParams);
  const collectionGroupId =
    prefilledCollectionGroupId || getSearchParam("collectionGroupId");
  const { currentOrganization, currentOrganizationId } = useOrganization();
  const { enabledModules } = useFeatureAccess();
  const isLocationTrackingEnabled =
    currentOrganization?.settings?.locationTrackingEnabled ?? true;
  const upsertObjectDraft = useMutation(api.accessions.upsertObjectDraft);
  const generateDraftUploadUrl = useMutation(
    api.accessions.generateDraftUploadUrl,
  );

  const initialForm = useMemo(
    () => createEmptyFormData(collectionGroupId || undefined),
    [collectionGroupId],
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const initialFormSignatureRef = useRef(getFormSignature(initialForm));
  const hasInitializedRef = useRef(false);

  const [formData, setFormData] = useState<CollectionFormData>(initialForm);
  const [activeTab, setActiveTab] = useState<CollectionEditTabId>("general");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<
    Array<{
      id: string;
      file: File;
      previewUrl: string;
      isPrimary: boolean;
    }>
  >([]);
  const [selectedDocuments, setSelectedDocuments] = useState<
    Array<{
      id: string;
      file: File;
      fileName: string;
    }>
  >([]);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [currentDraftAccessionId, setCurrentDraftAccessionId] =
    useState<Id<"accessions"> | null>(accessionId ?? null);
  const [persistedDraftMedia, setPersistedDraftMedia] = useState<
    DraftMediaItem[]
  >(initialDraftMedia ?? []);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null,
  );

  const tabs = useMemo(
    () =>
      getObjectEditTabs({
        locationTrackingEnabled: isLocationTrackingEnabled,
      }).map((tab) => ({ ...tab, id: tab.id as CollectionEditTabId })),
    [isLocationTrackingEnabled],
  );

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0]?.id ?? "general");
    }
  }, [activeTab, tabs]);

  useEffect(() => {
    if (hasInitializedRef.current) {
      return;
    }

    hasInitializedRef.current = true;

    const nextFormData = initialDraftObjectData
      ? createFormDataFromDraftObject(
          initialDraftObjectData,
          collectionGroupId || undefined,
        )
      : initialForm;

    const draftAccessionId = accessionId ?? null;
    const draftMedia = initialDraftMedia ?? [];

    setFormData(nextFormData);
    setCurrentDraftAccessionId(draftAccessionId);
    setPersistedDraftMedia(draftMedia);
    setDraftSavedAt(initialDraftSavedAt);
    initialFormSignatureRef.current = getFormSignature(nextFormData);
  }, [
    accessionId,
    collectionGroupId,
    initialForm,
    initialDraftMedia,
    initialDraftObjectData,
    initialDraftSavedAt,
  ]);

  useEffect(() => {
    return () => {
      for (const item of selectedFiles) {
        URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, [selectedFiles]);

  const heroImage =
    selectedFiles.find((file) => file.isPrimary) ?? selectedFiles[0];
  const isFormDirty =
    getFormSignature(formData) !== initialFormSignatureRef.current;
  const hasLocalMediaSelections =
    selectedFiles.length > 0 || selectedDocuments.length > 0;
  const hasUnsavedChanges = isFormDirty || hasLocalMediaSelections;
  const hasSavedFieldDraft = draftSavedAt !== null;
  const isDraftCurrent = hasSavedFieldDraft && !isFormDirty;
  const activeDraftAccessionId = currentDraftAccessionId;
  const isDraftEditMode = mode === "draft-edit";
  const resolvedBackHref =
    backHref ||
    (isDraftEditMode && accessionId
      ? `/accessions/${accessionId}`
      : "/objects");
  const pageTitle = isDraftEditMode ? "Edit Object" : "New Object";
  const pageBadge = isDraftEditMode ? "Draft object" : "New object";
  const organizationPrompt = isDraftEditMode
    ? "Please select an organization to edit drafts."
    : "Please select an organization to create objects.";

  useBeforeUnload(hasUnsavedChanges);

  const updateField = useCallback(
    <K extends keyof CollectionFormData>(
      field: K,
      value: CollectionFormData[K],
    ) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    [],
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
        const isFirstBatch = selectedFiles.length === 0;

        const newFiles = files.map((file, index) => ({
          id: `${Date.now()}-${index}`,
          file,
          previewUrl: URL.createObjectURL(file),
          isPrimary: isFirstBatch && index === 0,
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
    [selectedFiles.length, t],
  );

  const handleSetPrimary = useCallback((fileId: string) => {
    setSelectedFiles((prev) =>
      prev.map((item) => ({
        ...item,
        isPrimary: item.id === fileId,
      })),
    );
  }, []);

  const handleDeleteImage = useCallback((fileId: string) => {
    setSelectedFiles((prev) => {
      const fileToDelete = prev.find((item) => item.id === fileId);
      if (fileToDelete) {
        URL.revokeObjectURL(fileToDelete.previewUrl);
      }

      const remaining = prev.filter((item) => item.id !== fileId);
      if (remaining.length > 0 && !remaining.some((item) => item.isPrimary)) {
        const first = remaining[0];
        if (first) {
          return [{ ...first, isPrimary: true }, ...remaining.slice(1)];
        }
      }

      return remaining;
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
    [t],
  );

  const handleDeleteDocument = useCallback((docId: string) => {
    setSelectedDocuments((prev) => prev.filter((item) => item.id !== docId));
  }, []);

  const uploadDraftMedia = useCallback(async (): Promise<DraftMediaItem[]> => {
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
            throw new Error(`No storage ID returned for ${fileData.file.name}`);
          }

          return {
            storageId,
            fileName: fileData.file.name,
            fileSize: fileData.file.size,
            mimeType: fileData.file.type,
            mediaCategory: "image",
            isPrimary: fileData.isPrimary,
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
  }, [
    currentOrganizationId,
    generateDraftUploadUrl,
    selectedDocuments,
    selectedFiles,
  ]);

  const handleSaveDraft = useCallback(
    async ({
      redirectToDetail = false,
    }: {
      redirectToDetail?: boolean;
    } = {}) => {
      if (!currentOrganizationId) {
        return false;
      }

      setIsSavingDraft(true);
      setError(null);

      try {
        const newDraftMedia =
          selectedFiles.length > 0 || selectedDocuments.length > 0
            ? await uploadDraftMedia()
            : [];
        const draftMedia =
          persistedDraftMedia.length > 0 || newDraftMedia.length > 0
            ? [...persistedDraftMedia, ...newDraftMedia]
            : undefined;

        const savedAccessionId = await upsertObjectDraft({
          organizationId: currentOrganizationId,
          accessionId: activeDraftAccessionId || undefined,
          saveMode: "draft",
          objectData: buildObjectDraftPayload(formData),
          draftMedia: draftMedia
            ? buildDraftMediaPayload(draftMedia)
            : undefined,
        });

        setCurrentDraftAccessionId(savedAccessionId);
        setPersistedDraftMedia(draftMedia ?? []);
        setSelectedFiles([]);
        setSelectedDocuments([]);
        initialFormSignatureRef.current = getFormSignature(formData);
        setDraftSavedAt(Date.now());

        if (redirectToDetail) {
          push(`/accessions/${savedAccessionId}`);
        }

        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save draft.");
        return false;
      } finally {
        setIsSavingDraft(false);
      }
    },
    [
      activeDraftAccessionId,
      currentOrganizationId,
      formData,
      persistedDraftMedia,
      push,
      selectedDocuments,
      selectedFiles,
      upsertObjectDraft,
      uploadDraftMedia,
    ],
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setError(null);

      if (!formData.title?.trim()) {
        setError(t("form.errors.titleRequired"));
        return;
      }

      if (!currentOrganizationId) {
        return;
      }

      setIsSubmitting(true);

      try {
        const newDraftMedia =
          selectedFiles.length > 0 || selectedDocuments.length > 0
            ? await uploadDraftMedia()
            : [];
        const draftMedia =
          persistedDraftMedia.length > 0 || newDraftMedia.length > 0
            ? [...persistedDraftMedia, ...newDraftMedia]
            : undefined;

        const accessionId = await upsertObjectDraft({
          organizationId: currentOrganizationId,
          accessionId: activeDraftAccessionId || undefined,
          saveMode: "submit",
          objectData: buildObjectDraftPayload(formData),
          draftMedia: draftMedia
            ? buildDraftMediaPayload(draftMedia)
            : undefined,
        });
        push(`/accessions/${accessionId}`);
      } catch (err) {
        console.error("Error submitting object request:", err);
        setError(
          err instanceof Error ? err.message : t("form.errors.saveFailed"),
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      currentOrganizationId,
      activeDraftAccessionId,
      formData,
      persistedDraftMedia,
      push,
      t,
      upsertObjectDraft,
      uploadDraftMedia,
    ],
  );

  const handleNavigate = useCallback(
    (href: string) => {
      if (hasUnsavedChanges) {
        setPendingNavigation(href);
        setShowUnsavedDialog(true);
      } else {
        push(href);
      }
    },
    [hasUnsavedChanges, push],
  );

  const handleDiscardAndNavigate = useCallback(() => {
    if (pendingNavigation) {
      push(pendingNavigation);
    }
    setShowUnsavedDialog(false);
    setPendingNavigation(null);
  }, [pendingNavigation, push]);

  const handleSaveAndNavigate = useCallback(async () => {
    const didSave = await handleSaveDraft();
    if (!didSave) {
      return false;
    }

    if (pendingNavigation) {
      push(pendingNavigation);
    }
    setPendingNavigation(null);
    return true;
  }, [handleSaveDraft, pendingNavigation, push]);

  return {
    t,
    common,
    placeholders,
    currentOrganizationId,
    organizationPrompt,
    formData,
    activeTab,
    setActiveTab,
    tabs,
    error,
    isSubmitting,
    isSavingDraft,
    heroImage,
    pageTitle,
    pageBadge,
    resolvedBackHref,
    handleNavigate,
    handleSubmit,
    handleSaveDraft,
    selectedFiles,
    selectedDocuments,
    persistedDraftMedia,
    fileInputRef,
    cameraInputRef,
    documentInputRef,
    handleFileSelect,
    handleDocumentSelect,
    handleSetPrimary,
    handleDeleteImage,
    handleDeleteDocument,
    isLocationTrackingEnabled,
    enabledModules,
    updateField,
    isDraftCurrent,
    hasSavedFieldDraft,
    hasLocalMediaSelections,
    isFormDirty,
    showUnsavedDialog,
    setShowUnsavedDialog,
    handleDiscardAndNavigate,
    handleSaveAndNavigate,
  };
}
