"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { useBeforeUnload } from "@/hooks/use-before-unload";
import { useI18n, useScopedI18n } from "@/locales/client";
import type {
  CollectionFormData,
  OwnershipEntry,
} from "../collection-form-shared/types";
import { useFormNavigationGuard } from "../collection-form-shared/use-form-navigation-guard";
import { useFormTabState } from "../collection-form-shared/use-form-tab-state";
import {
  createInitialFormData,
  createOwnershipEntryLocalId,
  getFormSignature,
  getStatusBadgeClass,
  normalizeOptionalString,
  withLinkEntryLocalIds,
  withOwnershipEntryLocalIds,
} from "../collection-form-shared/utils";
import {
  collectionEditFormSyncReducer,
  initialCollectionEditFormSyncState,
} from "./collection-edit-form-sync";
import { useCollectionEditFormMedia } from "./use-collection-edit-form-media";
import { useCollectionEditFormSubmit } from "./use-collection-edit-form-submit";

export function useCollectionEditForm() {
  const tRoot = useI18n();
  const t = useScopedI18n("objects");
  const common = useScopedI18n("common");
  const placeholders = useScopedI18n("objects.form.placeholders");
  const params = useParams();
  const collectionId = params.id as string;
  const typedCollectionId = collectionId as Id<"collections">;
  const { currentOrganization, currentOrganizationId } = useOrganization();
  const isLocationTrackingEnabled =
    currentOrganization?.settings?.locationTrackingEnabled ?? true;

  const collection = useQuery(
    api.collections.get,
    collectionId ? { collectionId: typedCollectionId } : "skip",
  );
  const collectionGroupsForCollection = useQuery(
    api.collectionGroups.getGroupsForCollection,
    collectionId ? { collectionId: typedCollectionId } : "skip",
  );
  const pendingMoveRequest = useQuery(
    api.objectMoves.getPendingForCollection,
    collectionId ? { collectionId: typedCollectionId } : "skip",
  );

  const [{ formData, isInitialized }, dispatchFormSync] = useReducer(
    collectionEditFormSyncReducer,
    initialCollectionEditFormSyncState,
  );
  const { tabs, activeTab, setActiveTab } = useFormTabState(
    isLocationTrackingEnabled,
  );
  const initialFormSignatureRef = useRef("");
  const [error, setError] = useState<string | null>(null);
  const [alternateAccessionDraft, setAlternateAccessionDraft] = useState("");
  const [conditionChangeNote, setConditionChangeNote] = useState("");
  const [deaccessionDialogOpen, setDeaccessionDialogOpen] = useState(false);
  const [editingOwnershipEntryId, setEditingOwnershipEntryId] = useState<
    string | null
  >(null);
  const [editingImageId, setEditingImageId] = useState<Id<"mediaFiles"> | null>(
    null,
  );

  const media = useQuery(
    api.media.list,
    collectionId ? { collectionId: typedCollectionId } : "skip",
  );

  const mediaState = useCollectionEditFormMedia({
    collection: collection ?? null,
    typedCollectionId,
    media,
    setError,
    t,
  });

  const resolvedCurrentLocationId =
    formData.currentLocationId ||
    (collection?.currentLocationId as string) ||
    "";

  const currentLocationPath = useQuery(
    api.locations.getLocationPath,
    isLocationTrackingEnabled &&
      resolvedCurrentLocationId &&
      resolvedCurrentLocationId !== "__none__"
      ? { locationId: resolvedCurrentLocationId as Id<"locations"> }
      : "skip",
  );

  const collectionGroups = useQuery(
    api.collectionGroups.list,
    collection ? { organizationId: collection.organizationId } : "skip",
  );

  const loans = useQuery(
    api.loans.getLoansForCollection,
    collection ? { collectionId: collection._id } : "skip",
  );
  const hasActiveLoan =
    loans?.some((loan) => loan.status === "active") ?? false;

  const initialConditionValue = normalizeOptionalString(collection?.condition);
  const currentConditionValue = normalizeOptionalString(formData.condition);
  const hasConditionChanged =
    isInitialized && currentConditionValue !== initialConditionValue;
  const requiresConditionChangeNote =
    hasConditionChanged && initialConditionValue.length > 0;
  const isFormDirty =
    isInitialized &&
    getFormSignature(formData) !== initialFormSignatureRef.current;

  useEffect(() => {
    if (!collection || collectionGroupsForCollection === undefined) {
      return;
    }

    const nextFormData = createInitialFormData(
      collection,
      collectionGroupsForCollection,
    );
    const nextSignature = getFormSignature(nextFormData);

    if (!isInitialized) {
      initialFormSignatureRef.current = nextSignature;
      dispatchFormSync({ type: "sync_from_server", formData: nextFormData });
      return;
    }

    if (!isFormDirty && nextSignature !== initialFormSignatureRef.current) {
      initialFormSignatureRef.current = nextSignature;
      dispatchFormSync({ type: "sync_from_server", formData: nextFormData });
    }
  }, [collection, collectionGroupsForCollection, isFormDirty, isInitialized]);

  useBeforeUnload(isFormDirty);

  useEffect(() => {
    if (!hasConditionChanged && conditionChangeNote) {
      setConditionChangeNote("");
    }
  }, [conditionChangeNote, hasConditionChanged]);

  const submitState = useCollectionEditFormSubmit({
    collectionId,
    typedCollectionId,
    formData,
    initialFormSignatureRef,
    isFormDirty,
    hasMediaChanges: mediaState.hasMediaChanges,
    hasConditionChanged,
    requiresConditionChangeNote,
    conditionChangeNote,
    setError,
    t,
  });

  const navigation = useFormNavigationGuard({
    hasUnsavedChanges: isFormDirty,
    onNavigate: submitState.push,
    onSaveBeforeNavigate: submitState.saveRecord,
  });

  const updateField = useCallback(
    <K extends keyof CollectionFormData>(
      field: K,
      value: CollectionFormData[K],
    ) => {
      dispatchFormSync({ type: "update_field", field, value });
    },
    [],
  );

  const createOwnershipEntry = useCallback(
    (entry: Omit<OwnershipEntry, "localId">): OwnershipEntry => ({
      ...entry,
      localId: createOwnershipEntryLocalId(),
    }),
    [],
  );

  useEffect(() => {
    const ownershipHistory = formData.ownershipHistory;
    if (!ownershipHistory?.some((entry) => !entry.localId)) {
      return;
    }

    updateField(
      "ownershipHistory",
      withOwnershipEntryLocalIds(ownershipHistory),
    );
  }, [formData.ownershipHistory, updateField]);

  useEffect(() => {
    const links = formData.links;
    if (!links?.some((entry) => !entry.localId)) {
      return;
    }

    updateField("links", withLinkEntryLocalIds(links));
  }, [formData.links, updateField]);

  const handleAddAlternateAccessionNumber = useCallback(() => {
    const nextValue = alternateAccessionDraft.trim();
    if (!nextValue) {
      return;
    }

    const existingValues = formData.alternateAccessionNumbers || [];
    if (existingValues.includes(nextValue)) {
      setError("Alternate accession number already exists.");
      return;
    }

    updateField("alternateAccessionNumbers", [...existingValues, nextValue]);
    setAlternateAccessionDraft("");
    setError(null);
  }, [
    alternateAccessionDraft,
    formData.alternateAccessionNumbers,
    updateField,
  ]);

  const handleRemoveAlternateAccessionNumber = useCallback(
    (indexToRemove: number) => {
      updateField(
        "alternateAccessionNumbers",
        (formData.alternateAccessionNumbers || []).filter(
          (_, index) => index !== indexToRemove,
        ),
      );
      setError(null);
    },
    [formData.alternateAccessionNumbers, updateField],
  );

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
    params,
    collectionId,
    typedCollectionId,
    currentOrganizationId,
    isLocationTrackingEnabled,
    collection,
    collectionGroupsForCollection,
    pendingMoveRequest,
    formData,
    activeTab,
    setActiveTab,
    tabs,
    isSubmitting: submitState.isSubmitting,
    error,
    alternateAccessionDraft,
    setAlternateAccessionDraft,
    conditionChangeNote,
    setConditionChangeNote,
    deaccessionDialogOpen,
    setDeaccessionDialogOpen,
    editingOwnershipEntryId,
    setEditingOwnershipEntryId,
    editingImageId,
    setEditingImageId,
    showUnsavedDialog: navigation.showUnsavedDialog,
    setShowUnsavedDialog: navigation.setShowUnsavedDialog,
    media: mediaState.media,
    images: mediaState.images,
    documents: mediaState.documents,
    heroImage: mediaState.heroImage,
    currentLocationPath,
    collectionGroups,
    hasActiveLoan,
    hasConditionChanged,
    requiresConditionChangeNote,
    isFormDirty,
    hasMediaChanges: mediaState.hasMediaChanges,
    canUpdateObject: submitState.canUpdateObject,
    updateField,
    createOwnershipEntry,
    handleAddAlternateAccessionNumber,
    handleRemoveAlternateAccessionNumber,
    fileInputRef: mediaState.fileInputRef,
    cameraInputRef: mediaState.cameraInputRef,
    documentInputRef: mediaState.documentInputRef,
    handleFileSelect: mediaState.handleFileSelect,
    handleDocumentSelect: mediaState.handleDocumentSelect,
    handleSetPrimary: mediaState.handleSetPrimary,
    handleDeleteMedia: mediaState.handleDeleteMedia,
    handleSubmit: submitState.handleSubmit,
    handleNavigate: navigation.handleNavigate,
    handleDiscardAndNavigate: navigation.handleDiscardAndNavigate,
    handleSaveAndNavigate: navigation.handleSaveAndNavigate,
    saveRecord: submitState.saveRecord,
    locationSummary,
    collectionSummary,
    getStatusBadgeClass,
    resolvedCurrentLocationId,
  };
}
