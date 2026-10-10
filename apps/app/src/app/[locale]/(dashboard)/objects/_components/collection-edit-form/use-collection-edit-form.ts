"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { custodyConflictFromError } from "@v1/backend/convex/utils/custodyErrors";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { useBeforeUnload } from "@/hooks/use-before-unload";
import { useCustodyConflictMessage } from "@/hooks/use-custody-conflict-message";
import { useFormNavigationGuard } from "@/hooks/use-form-navigation-guard";
import { useRecordFormSession } from "@/hooks/use-record-form-session";
import { useRecordSaveFailure } from "@/hooks/use-record-save-failure";
import { useI18n, useScopedI18n } from "@/locales/client";
import type {
  CollectionEditTabId,
  CollectionFormData,
  OwnershipEntry,
} from "../collection-form-shared/types";
import { useCollectionFieldLabel } from "../collection-form-shared/use-collection-field-label";
import { useFormTabState } from "../collection-form-shared/use-form-tab-state";
import {
  collectionFieldLocation,
  createOwnershipEntryLocalId,
  EMPTY_EDIT_FORM,
  getStatusBadgeClass,
  normalizeOptionalString,
  validateCollectionFormData,
  withLinkEntryLocalIds,
  withOwnershipEntryLocalIds,
} from "../collection-form-shared/utils";
import {
  type CollectionEditValues,
  collectionEditValues,
  comparableCollectionEdit,
  parseCollectionEditValues,
} from "./collection-edit-values";
import { useCollectionEditFormMedia } from "./use-collection-edit-form-media";
import { useCollectionEditFormSubmit } from "./use-collection-edit-form-submit";

const EMPTY_EDIT_VALUES: CollectionEditValues = {
  ...EMPTY_EDIT_FORM,
  conditionChangeNote: "",
};

export function useCollectionEditForm() {
  const tRoot = useI18n();
  const t = useScopedI18n("objects");
  const common = useScopedI18n("common");
  const placeholders = useScopedI18n("objects.form.placeholders");
  const tErrors = useScopedI18n("recordForm.errors");
  const tFields = useScopedI18n("recordForm.objectFields");
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
  const editState = useQuery(
    api.recordEdits.getEditState,
    collectionId
      ? { target: { type: "object", id: typedCollectionId } }
      : "skip",
  );
  const pendingMoveRequest = useQuery(
    api.objectMoves.getPendingForCollection,
    collectionId ? { collectionId: typedCollectionId } : "skip",
  );

  const { tabs, activeTab, setActiveTab } = useFormTabState(
    isLocationTrackingEnabled,
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [alternateAccessionDraft, setAlternateAccessionDraft] = useState("");
  const [deaccessionDialogOpen, setDeaccessionDialogOpen] = useState(false);
  const [editingOwnershipEntryId, setEditingOwnershipEntryId] = useState<
    string | null
  >(null);
  const [editingImageId, setEditingImageId] = useState<Id<"mediaFiles"> | null>(
    null,
  );

  const fieldLabel = useCollectionFieldLabel();
  const custodyMessage = useCustodyConflictMessage();
  const describeFailure = useRecordSaveFailure({
    fieldLabel,
    describe: useCallback(
      (error: unknown) =>
        // The only custody rules a catalog save meets are about its location.
        custodyConflictFromError(error)
          ? { message: custodyMessage(error), field: "currentLocationId" }
          : null,
      [custodyMessage],
    ),
  });

  const latest = useMemo(
    () =>
      collection && collectionGroupsForCollection !== undefined && editState
        ? {
            values: collectionEditValues(
              collection,
              collectionGroupsForCollection,
            ),
            editVersion: editState.editVersion,
          }
        : undefined,
    [collection, collectionGroupsForCollection, editState],
  );
  const validate = useCallback(
    (values: CollectionEditValues) => {
      const errors = validateCollectionFormData(values, {
        titleRequired: t("form.errors.titleRequired"),
        weightInvalid: tErrors("weightInvalid"),
        measurementInvalid: tErrors("measurementInvalid"),
      });
      const recordedCondition = normalizeOptionalString(
        latest?.values.condition,
      );
      if (
        recordedCondition &&
        normalizeOptionalString(values.condition) !== recordedCondition &&
        !values.conditionChangeNote.trim()
      )
        errors.conditionChangeNote = tErrors("conditionNoteRequired");
      return errors;
    },
    [latest, t, tErrors],
  );
  const session = useRecordFormSession({
    latest,
    initialValues: EMPTY_EDIT_VALUES,
    comparable: comparableCollectionEdit,
    recovery: collectionId
      ? {
          kind: "object",
          recordId: collectionId,
          parse: parseCollectionEditValues,
        }
      : null,
    validate,
    describeFailure,
    invalidMessage: tErrors("invalid"),
  });
  const formData = session.values;
  const { update } = session;

  const media = useQuery(
    api.media.list,
    collectionId ? { collectionId: typedCollectionId } : "skip",
  );

  const mediaState = useCollectionEditFormMedia({
    collection: collection ?? null,
    typedCollectionId,
    media,
    setError: setLocalError,
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

  const baseCondition = normalizeOptionalString(session.baseValues?.condition);
  const hasConditionChanged =
    session.ready &&
    normalizeOptionalString(formData.condition) !== baseCondition;
  const requiresConditionChangeNote =
    hasConditionChanged && baseCondition.length > 0;
  const isFormDirty = session.isDirty;

  useBeforeUnload(isFormDirty);

  const conditionChangeNote = formData.conditionChangeNote;
  useEffect(() => {
    if (!hasConditionChanged && conditionChangeNote) {
      update((values) => ({ ...values, conditionChangeNote: "" }));
    }
  }, [conditionChangeNote, hasConditionChanged, update]);

  const submitState = useCollectionEditFormSubmit({
    collectionId,
    typedCollectionId,
    session,
    hasMediaChanges: mediaState.hasMediaChanges,
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
      update((values) => ({ ...values, [field]: value }));
    },
    [update],
  );
  const setConditionChangeNote = useCallback(
    (value: string) =>
      update((values) => ({ ...values, conditionChangeNote: value })),
    [update],
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
      setLocalError(tFields("alternateNumberExists"));
      return;
    }

    updateField("alternateAccessionNumbers", [...existingValues, nextValue]);
    setAlternateAccessionDraft("");
    setLocalError(null);
  }, [
    alternateAccessionDraft,
    formData.alternateAccessionNumbers,
    tFields,
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
      setLocalError(null);
    },
    [formData.alternateAccessionNumbers, updateField],
  );

  const goToField = useCallback(
    (field: string) => {
      const { tab, elementId } = collectionFieldLocation(field);
      const tabId = tabs.find((candidate) => candidate.id === tab)?.id;
      if (tabId) setActiveTab(tabId as CollectionEditTabId);
      requestAnimationFrame(() => document.getElementById(elementId)?.focus());
    },
    [setActiveTab, tabs],
  );

  const locationSummary =
    currentLocationPath?.map((location) => location.name).join(" / ") ||
    tRoot("untranslatedRecords.objects.location.noneAssigned");
  const collectionSummary =
    collectionGroupsForCollection?.map((group) => group.name).join(", ") ||
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
    session,
    fieldLabel,
    goToField,
    formData,
    activeTab,
    setActiveTab,
    tabs,
    isSubmitting: session.saving,
    error: localError,
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
