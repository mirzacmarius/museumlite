"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useOrganization } from "@/components/organization-provider";
import { useBeforeUnload } from "@/hooks/use-before-unload";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useI18n, useScopedI18n } from "@/locales/client";
import type {
  CollectionFormData,
  DraftMediaItem,
} from "../collection-form-shared/types";
import { useFormNavigationGuard } from "../collection-form-shared/use-form-navigation-guard";
import { useFormTabState } from "../collection-form-shared/use-form-tab-state";
import {
  createEmptyFormData,
  createFormDataFromDraftObject,
  getFormSignature,
} from "../collection-form-shared/utils";
import {
  draftPrimaryStorageId,
  objectRequestDraftReducer,
} from "./object-request-form-draft-reducer";
import { useObjectRequestFormDraft } from "./use-object-request-form-draft";
import { useObjectRequestFormLocalMedia } from "./use-object-request-form-local-media";
import { useObjectRequestFormSubmit } from "./use-object-request-form-submit";

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
  const tRoot = useI18n();
  const t = useScopedI18n("objects");
  const common = useScopedI18n("common");
  const placeholders = useScopedI18n("objects.form.placeholders");
  const collectionGroupId = prefilledCollectionGroupId;
  const { currentOrganization, currentOrganizationId } = useOrganization();
  const { enabledModules } = useFeatureAccess();
  const isLocationTrackingEnabled =
    currentOrganization?.settings?.locationTrackingEnabled ?? true;

  const initialForm = useMemo(
    () => createEmptyFormData(collectionGroupId || undefined),
    [collectionGroupId],
  );

  const initialFormSignatureRef = useRef(getFormSignature(initialForm));
  const [error, setError] = useState<string | null>(null);

  const [
    {
      formData,
      draftAccessionId: currentDraftAccessionId,
      persistedDraftMedia,
      savedPrimaryStorageId,
      draftSavedAt,
      initialized: hasDraftInitialized,
    },
    dispatchDraft,
  ] = useReducer(objectRequestDraftReducer, {
    formData: initialForm,
    draftAccessionId: accessionId ?? null,
    persistedDraftMedia: initialDraftMedia ?? [],
    savedPrimaryStorageId: draftPrimaryStorageId(initialDraftMedia ?? []),
    draftSavedAt: initialDraftSavedAt,
    initialized: false,
  });

  const currentLocationPath = useQuery(
    api.locations.getLocationPath,
    mode === "draft-edit" &&
      isLocationTrackingEnabled &&
      formData.currentLocationId
      ? { locationId: formData.currentLocationId as Id<"locations"> }
      : "skip",
  );
  const collectionGroups = useQuery(
    api.collectionGroups.list,
    mode === "draft-edit" && currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const { tabs, activeTab, setActiveTab } = useFormTabState(
    isLocationTrackingEnabled,
  );

  const persistedPrimaryStorageId = draftPrimaryStorageId(persistedDraftMedia);
  const localMedia = useObjectRequestFormLocalMedia({
    currentOrganizationId,
    hasSavedPrimaryImage: persistedPrimaryStorageId !== null,
    setError,
    t,
  });
  const { setPrimaryFile } = localMedia;

  const handleSetPrimary = useCallback(
    (imageId: string) => {
      const savedImage = persistedDraftMedia.find(
        (item) => item.mediaCategory === "image" && item.storageId === imageId,
      );
      dispatchDraft({
        type: "set_persisted_primary",
        storageId: savedImage?.storageId ?? null,
      });
      setPrimaryFile(savedImage ? null : imageId);
    },
    [persistedDraftMedia, setPrimaryFile],
  );

  const isFormDirty =
    getFormSignature(formData) !== initialFormSignatureRef.current ||
    persistedPrimaryStorageId !== savedPrimaryStorageId;
  const hasUnsavedChanges = isFormDirty || localMedia.hasLocalMediaSelections;
  const hasSavedFieldDraft = draftSavedAt !== null;
  const isDraftCurrent = hasSavedFieldDraft && !isFormDirty;
  const activeDraftAccessionId = currentDraftAccessionId;
  const isDraftEditMode = mode === "draft-edit";
  const resolvedBackHref =
    backHref ||
    (isDraftEditMode && accessionId
      ? `/accessions/${accessionId}`
      : "/objects");
  const pageTitle = isDraftEditMode
    ? tRoot("untranslatedRecords.objects.request.editTitle")
    : tRoot("untranslatedRecords.objects.request.newTitle");
  const pageBadge = isDraftEditMode
    ? tRoot("untranslatedRecords.objects.request.draftBadge")
    : tRoot("untranslatedRecords.objects.request.newBadge");
  const organizationPrompt = isDraftEditMode
    ? tRoot("untranslatedRecords.objects.request.selectOrgEdit")
    : tRoot("untranslatedRecords.objects.request.selectOrgCreate");
  const locationSummary =
    currentLocationPath?.map((location) => location.name).join(" / ") ||
    tRoot("untranslatedRecords.objects.location.noneAssigned");
  const collectionSummary =
    collectionGroups
      ?.flatMap((group) =>
        formData.collectionGroupIds?.includes(group._id) ? [group.name] : [],
      )
      .join(", ") ||
    tRoot("untranslatedRecords.objects.collection.noneAssigned");

  useBeforeUnload(hasUnsavedChanges);

  useEffect(() => {
    if (hasDraftInitialized) {
      return;
    }

    const nextFormData = initialDraftObjectData
      ? createFormDataFromDraftObject(
          initialDraftObjectData,
          collectionGroupId || undefined,
        )
      : initialForm;

    initialFormSignatureRef.current = getFormSignature(nextFormData);
    dispatchDraft({
      type: "INIT_FROM_PROPS",
      formData: nextFormData,
      draftAccessionId: accessionId ?? null,
      persistedDraftMedia: initialDraftMedia ?? [],
      draftSavedAt: initialDraftSavedAt,
    });
  }, [
    accessionId,
    collectionGroupId,
    hasDraftInitialized,
    initialForm,
    initialDraftMedia,
    initialDraftObjectData,
    initialDraftSavedAt,
  ]);

  const draftState = useObjectRequestFormDraft({
    currentOrganizationId,
    activeDraftAccessionId,
    formData,
    persistedDraftMedia,
    initialFormSignatureRef,
    dispatchDraft,
    selectedFilesCount: localMedia.selectedFiles.length,
    selectedDocumentsCount: localMedia.selectedDocuments.length,
    uploadDraftMedia: localMedia.uploadDraftMedia,
    clearLocalMediaSelections: localMedia.clearLocalMediaSelections,
    setError,
  });

  const submitState = useObjectRequestFormSubmit({
    currentOrganizationId,
    activeDraftAccessionId,
    formData,
    persistedDraftMedia,
    selectedFilesCount: localMedia.selectedFiles.length,
    selectedDocumentsCount: localMedia.selectedDocuments.length,
    uploadDraftMedia: localMedia.uploadDraftMedia,
    setError,
    t,
    push: draftState.push,
  });

  const navigation = useFormNavigationGuard({
    hasUnsavedChanges,
    onNavigate: draftState.push,
    onSaveBeforeNavigate: draftState.handleSaveDraft,
  });

  const updateField = useCallback(
    <K extends keyof CollectionFormData>(
      field: K,
      value: CollectionFormData[K],
    ) => {
      dispatchDraft({ type: "update_field", field, value });
    },
    [],
  );

  return {
    t,
    common,
    placeholders,
    currentOrganizationId,
    activeDraftAccessionId,
    organizationPrompt,
    formData,
    activeTab,
    setActiveTab,
    tabs,
    error,
    isSubmitting: submitState.isSubmitting,
    isSavingDraft: draftState.isSavingDraft,
    heroImage: localMedia.heroImage,
    pageTitle,
    pageBadge,
    mode,
    resolvedBackHref,
    handleNavigate: navigation.handleNavigate,
    handleSubmit: submitState.handleSubmit,
    handleSaveDraft: draftState.handleSaveDraft,
    selectedFiles: localMedia.selectedFiles,
    selectedDocuments: localMedia.selectedDocuments,
    persistedDraftMedia,
    fileInputRef: localMedia.fileInputRef,
    cameraInputRef: localMedia.cameraInputRef,
    documentInputRef: localMedia.documentInputRef,
    handleFileSelect: localMedia.handleFileSelect,
    handleDocumentSelect: localMedia.handleDocumentSelect,
    handleSetPrimary,
    handleDeleteImage: localMedia.handleDeleteImage,
    handleDeleteDocument: localMedia.handleDeleteDocument,
    isLocationTrackingEnabled,
    enabledModules,
    locationSummary,
    collectionSummary,
    updateField,
    isDraftCurrent,
    hasSavedFieldDraft,
    hasLocalMediaSelections: localMedia.hasLocalMediaSelections,
    isFormDirty,
    showUnsavedDialog: navigation.showUnsavedDialog,
    setShowUnsavedDialog: navigation.setShowUnsavedDialog,
    handleDiscardAndNavigate: navigation.handleDiscardAndNavigate,
    handleSaveAndNavigate: navigation.handleSaveAndNavigate,
  };
}
