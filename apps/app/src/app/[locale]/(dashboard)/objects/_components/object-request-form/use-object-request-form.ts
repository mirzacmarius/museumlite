"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  type CollectionType,
  isCollectionModuleId,
  isCollectionTypeEnabled,
} from "@v1/backend/convex/utils/moduleCatalog";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { useBeforeUnload } from "@/hooks/use-before-unload";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useFormNavigationGuard } from "@/hooks/use-form-navigation-guard";
import { useRecordFormSession } from "@/hooks/use-record-form-session";
import { useRecordSaveFailure } from "@/hooks/use-record-save-failure";
import { useI18n, useScopedI18n } from "@/locales/client";
import type {
  CollectionEditTabId,
  CollectionFormData,
  DraftMediaItem,
  ObjectDraftData,
} from "../collection-form-shared/types";
import { useCollectionFieldLabel } from "../collection-form-shared/use-collection-field-label";
import { useFormTabState } from "../collection-form-shared/use-form-tab-state";
import {
  buildDraftMediaPayload,
  buildObjectDraftPayload,
  collectionFieldLocation,
  validateCollectionFormData,
} from "../collection-form-shared/utils";
import { useObjectDraftErrorMessage } from "../object-type-details/use-object-draft-error-message";
import { resolveDraftPrimaryImageId } from "./draft-primary-image";
import {
  collectionTypeChange,
  comparableObjectRequest,
  emptyObjectRequestValues,
  type ObjectRequestValues,
  objectRequestValuesFromDraft,
  parseObjectRequestValues,
  withCollectionType,
} from "./object-request-values";
import { useObjectRequestFormLocalMedia } from "./use-object-request-form-local-media";

/** The pending accession whose object draft the form edits. */
export interface ObjectRequestDraftSource {
  _id: Id<"accessions">;
  draftObjectData?: ObjectDraftData;
  draftMedia?: DraftMediaItem[];
}

export interface UseObjectRequestFormOptions {
  mode?: "create" | "draft-edit";
  /** Live draft for `draft-edit`; the form follows colleagues' saves. */
  accession?: ObjectRequestDraftSource;
  prefilledCollectionGroupId?: string;
  backHref?: string;
}

export function useObjectRequestForm({
  mode = "create",
  accession,
  prefilledCollectionGroupId,
  backHref,
}: UseObjectRequestFormOptions) {
  const tRoot = useI18n();
  const t = useScopedI18n("objects");
  const common = useScopedI18n("common");
  const placeholders = useScopedI18n("objects.form.placeholders");
  const tErrors = useScopedI18n("recordForm.errors");
  const collectionGroupId = prefilledCollectionGroupId;
  const { currentOrganization, currentOrganizationId } = useOrganization();
  const { enabledModules } = useFeatureAccess();
  const { push } = useRouter();
  const saveObjectDraft = useMutation(api.accessions.saveObjectDraft);
  const isLocationTrackingEnabled =
    currentOrganization?.settings?.locationTrackingEnabled ?? true;
  const accessionId = accession?._id;
  const isDraftEditMode = mode === "draft-edit";

  const editState = useQuery(
    api.recordEdits.getEditState,
    accessionId ? { target: { type: "objectDraft", id: accessionId } } : "skip",
  );
  const emptyValues = useMemo(
    () => emptyObjectRequestValues(collectionGroupId),
    [collectionGroupId],
  );
  const latest = useMemo(() => {
    if (!isDraftEditMode) return { values: emptyValues, editVersion: null };
    if (!accession?.draftObjectData || !editState) return undefined;
    return {
      values: objectRequestValuesFromDraft(
        accession.draftObjectData,
        accession.draftMedia,
        collectionGroupId,
      ),
      editVersion: editState.editVersion,
    };
  }, [accession, collectionGroupId, editState, emptyValues, isDraftEditMode]);

  const [localError, setError] = useState<string | null>(null);
  const [savingAction, setSavingAction] = useState<"draft" | "submit" | null>(
    null,
  );
  const [pendingCollectionType, setPendingCollectionType] =
    useState<CollectionType | null>(null);

  const fieldLabel = useCollectionFieldLabel();
  const typeDetailsMessage = useObjectDraftErrorMessage();
  const describeFailure = useRecordSaveFailure({
    fieldLabel,
    describe: useCallback(
      (error: unknown) => {
        const message = typeDetailsMessage(error);
        return message ? { message, field: "typeDetails" } : null;
      },
      [typeDetailsMessage],
    ),
  });
  const validate = useCallback(
    (values: ObjectRequestValues) =>
      validateCollectionFormData(values, {
        titleRequired: t("form.errors.titleRequired"),
        weightInvalid: tErrors("weightInvalid"),
        measurementInvalid: tErrors("measurementInvalid"),
      }),
    [t, tErrors],
  );
  const session = useRecordFormSession({
    latest,
    initialValues: emptyValues,
    comparable: comparableObjectRequest,
    recovery: {
      kind: "objectDraft",
      recordId: accessionId ?? "new",
      parse: parseObjectRequestValues,
    },
    validate,
    describeFailure,
    invalidMessage: tErrors("invalid"),
  });
  const formData = session.values;
  const { update, save } = session;

  const currentLocationPath = useQuery(
    api.locations.getLocationPath,
    isDraftEditMode && isLocationTrackingEnabled && formData.currentLocationId
      ? { locationId: formData.currentLocationId as Id<"locations"> }
      : "skip",
  );
  const collectionGroups = useQuery(
    api.collectionGroups.list,
    isDraftEditMode && currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const typeDetailsTab =
    isCollectionModuleId(formData.collectionType) &&
    isCollectionTypeEnabled(formData.collectionType, enabledModules)
      ? formData.collectionType
      : undefined;
  const { tabs, activeTab, setActiveTab } = useFormTabState(
    isLocationTrackingEnabled,
    typeDetailsTab,
  );

  const localMedia = useObjectRequestFormLocalMedia({
    currentOrganizationId,
    setError,
    t,
  });
  const {
    selectedFiles: localFiles,
    selectedDocuments,
    uploadDraftMedia: uploadLocalMedia,
    clearLocalMediaSelections: clearLocalMedia,
  } = localMedia;

  const [primaryImageChoice, setPrimaryImageChoice] = useState<string | null>(
    null,
  );
  const persistedMedia = formData.draftMedia;
  const savedPrimaryImageId = resolveDraftPrimaryImageId({
    choice: null,
    savedMedia: persistedMedia,
    newImageIds: [],
  });
  const primaryImageId = resolveDraftPrimaryImageId({
    choice: primaryImageChoice,
    savedMedia: persistedMedia,
    newImageIds: localFiles.map((file) => file.id),
  });
  const persistedDraftMedia = useMemo(
    () =>
      persistedMedia.map((item) => ({
        ...item,
        isPrimary:
          item.mediaCategory === "image" && item.storageId === primaryImageId,
      })),
    [persistedMedia, primaryImageId],
  );
  const selectedFiles = localFiles.map((file) => ({
    ...file,
    isPrimary: file.id === primaryImageId,
  }));

  const primaryChanged =
    savedPrimaryImageId !== null && primaryImageId !== savedPrimaryImageId;
  const isFormDirty = session.isDirty || primaryChanged;
  const hasUnsavedChanges = isFormDirty || localMedia.hasLocalMediaSelections;
  const hasSavedFieldDraft = isDraftEditMode;
  const isDraftCurrent = hasSavedFieldDraft && !isFormDirty;

  useBeforeUnload(hasUnsavedChanges);

  const savedAccessionIdRef = useRef<Id<"accessions"> | null>(null);
  /**
   * Uploads new files and saves the draft, then opens the accession when
   * `openAfterSave`; a retry repeats both. True when saved.
   */
  const runSave = useCallback(
    async (saveMode: "draft" | "submit", openAfterSave: boolean) => {
      if (!currentOrganizationId) return false;
      setSavingAction(saveMode);
      setError(null);
      const saved = await save(
        async ({ values, expectedEditVersion }) => {
          const uploaded =
            localFiles.length > 0 || selectedDocuments.length > 0
              ? await uploadLocalMedia(primaryImageId)
              : [];
          const draftMedia = [...persistedDraftMedia, ...uploaded];
          const result = await saveObjectDraft({
            organizationId: currentOrganizationId,
            accessionId,
            saveMode,
            objectData: buildObjectDraftPayload(values),
            draftMedia:
              draftMedia.length > 0
                ? buildDraftMediaPayload(draftMedia)
                : undefined,
            expectedEditVersion,
          });
          savedAccessionIdRef.current = result.accessionId;
          clearLocalMedia();
          setPrimaryImageChoice(null);
          return {
            editVersion: result.editVersion,
            values: { ...values, draftMedia },
          };
        },
        openAfterSave
          ? () => push(`/accessions/${savedAccessionIdRef.current}`)
          : undefined,
      );
      setSavingAction(null);
      return saved;
    },
    [
      accessionId,
      clearLocalMedia,
      currentOrganizationId,
      localFiles.length,
      persistedDraftMedia,
      primaryImageId,
      push,
      save,
      saveObjectDraft,
      selectedDocuments.length,
      uploadLocalMedia,
    ],
  );

  const handleSaveDraft = useCallback(
    async ({ redirectToDetail = false }: { redirectToDetail?: boolean } = {}) =>
      runSave("draft", redirectToDetail),
    [runSave],
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      await runSave("submit", true);
    },
    [runSave],
  );

  const navigation = useFormNavigationGuard({
    hasUnsavedChanges,
    onNavigate: push,
    onSaveBeforeNavigate: handleSaveDraft,
    onDiscard: session.forgetInput,
  });

  const updateField = useCallback(
    <K extends keyof CollectionFormData>(
      field: K,
      value: CollectionFormData[K],
    ) => {
      if (field !== "collectionType") {
        update((values) => ({ ...values, [field]: value }));
        return;
      }
      const change = collectionTypeChange(formData, value);
      if (!change) return;
      if (change.losesDetails) {
        setPendingCollectionType(change.collectionType);
        return;
      }
      update((values) => withCollectionType(values, change.collectionType));
    },
    [formData, update],
  );
  const confirmCollectionTypeChange = useCallback(() => {
    if (pendingCollectionType)
      update((values) => withCollectionType(values, pendingCollectionType));
    setPendingCollectionType(null);
  }, [pendingCollectionType, update]);
  const cancelCollectionTypeChange = useCallback(
    () => setPendingCollectionType(null),
    [],
  );

  const goToField = useCallback(
    (field: string) => {
      const location =
        field === "typeDetails" || field === "collectionType"
          ? { tab: typeDetailsTab ?? "general", elementId: "collectionType" }
          : field === "currentLocationId"
            ? { tab: "general", elementId: "generalCurrentLocationId" }
            : field === "collectionGroupId" || field === "collectionGroupIds"
              ? { tab: "general", elementId: "generalCollectionGroupId" }
              : collectionFieldLocation(field);
      const tabId = tabs.find((candidate) => candidate.id === location.tab)?.id;
      if (tabId) setActiveTab(tabId as CollectionEditTabId);
      requestAnimationFrame(() =>
        document.getElementById(location.elementId)?.focus(),
      );
    },
    [setActiveTab, tabs, typeDetailsTab],
  );

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

  return {
    t,
    common,
    placeholders,
    currentOrganizationId,
    activeDraftAccessionId: accessionId ?? null,
    organizationPrompt,
    session,
    fieldLabel,
    goToField,
    formData,
    activeTab,
    setActiveTab,
    tabs,
    error: localError,
    isSubmitting: savingAction === "submit",
    isSavingDraft: savingAction === "draft",
    pageTitle,
    pageBadge,
    mode,
    resolvedBackHref,
    handleNavigate: navigation.handleNavigate,
    handleSubmit,
    handleSaveDraft,
    selectedFiles,
    selectedDocuments,
    persistedDraftMedia,
    fileInputRef: localMedia.fileInputRef,
    cameraInputRef: localMedia.cameraInputRef,
    documentInputRef: localMedia.documentInputRef,
    handleFileSelect: localMedia.handleFileSelect,
    handleDocumentSelect: localMedia.handleDocumentSelect,
    handleSetPrimary: setPrimaryImageChoice,
    handleDeleteImage: localMedia.handleDeleteImage,
    handleDeleteDocument: localMedia.handleDeleteDocument,
    isLocationTrackingEnabled,
    enabledModules,
    locationSummary,
    collectionSummary,
    updateField,
    pendingCollectionType,
    confirmCollectionTypeChange,
    cancelCollectionTypeChange,
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
