"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useUploadFiles } from "@xixixao/uploadstuff/react";
import { useMutation, useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { useBeforeUnload } from "@/hooks/use-before-unload";
import { serializeStringListField } from "@/lib/string-list-field";
import { useScopedI18n } from "@/locales/client";
import { getObjectEditTabs } from "../../[id]/_components/object-tab-config";
import {
  type CollectionEditTabId,
  type CollectionFormData,
  createInitialFormData,
  createOwnershipEntryLocalId,
  EMPTY_EDIT_FORM,
  getFormSignature,
  getMediaSignature,
  getStatusBadgeClass,
  normalizeOptionalString,
  type OwnershipEntry,
  parseOptionalWeight,
  withLinkEntryLocalIds,
  withOwnershipEntryLocalIds,
} from "../collection-form-shared";

export function useCollectionEditForm() {
  const t = useScopedI18n("objects");
  const common = useScopedI18n("common");
  const placeholders = useScopedI18n("objects.form.placeholders");
  const params = useParams();
  const { push } = useRouter();
  const collectionId = params.id as string;
  const typedCollectionId = collectionId as Id<"collections">;
  const { currentOrganization, currentOrganizationId } = useOrganization();
  const isLocationTrackingEnabled =
    currentOrganization?.settings?.locationTrackingEnabled ?? true;
  const updateCollection = useMutation(api.collections.update);
  const generateUploadUrl = useMutation(api.media.generateUploadUrl);
  const createMedia = useMutation(api.media.create);
  const setPrimary = useMutation(api.media.setPrimary);
  const deleteMedia = useMutation(api.media.deleteMedia);

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
  const media = useQuery(
    api.media.list,
    collectionId ? { collectionId: typedCollectionId } : "skip",
  );

  const [formData, setFormData] = useState<CollectionFormData>(EMPTY_EDIT_FORM);
  const [activeTab, setActiveTab] = useState<CollectionEditTabId>("general");
  const [isInitialized, setIsInitialized] = useState(false);
  const [isMediaBaselineReady, setIsMediaBaselineReady] = useState(false);
  const initialFormSignatureRef = useRef("");
  const initialMediaSignatureRef = useRef("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<File[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
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
    if (media !== undefined && !isMediaBaselineReady) {
      initialMediaSignatureRef.current = getMediaSignature(media);
      setIsMediaBaselineReady(true);
    }
  }, [isMediaBaselineReady, media]);

  const images = useMemo(() => {
    return (
      media?.filter((item) => {
        const category = (item as { mediaCategory?: "image" | "document" })
          .mediaCategory;
        return (category === "image" || !category) && item.fileType === "image";
      }) || []
    );
  }, [media]);

  const documents = useMemo(() => {
    return (
      media?.filter(
        (item) =>
          (item as { mediaCategory?: "image" | "document" }).mediaCategory ===
          "document",
      ) || []
    );
  }, [media]);

  const heroImage = useMemo(() => {
    return images.find((item) => item.isPrimary) ?? images[0] ?? null;
  }, [images]);

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

  const currentMediaSignature = useMemo(
    () => getMediaSignature(media ?? []),
    [media],
  );
  const initialConditionValue = normalizeOptionalString(collection?.condition);
  const currentConditionValue = normalizeOptionalString(formData.condition);
  const hasConditionChanged =
    isInitialized && currentConditionValue !== initialConditionValue;
  const requiresConditionChangeNote =
    hasConditionChanged && initialConditionValue.length > 0;
  const isFormDirty =
    isInitialized &&
    getFormSignature(formData) !== initialFormSignatureRef.current;
  const hasMediaChanges =
    isMediaBaselineReady &&
    currentMediaSignature !== initialMediaSignatureRef.current;
  const canUpdateObject = isFormDirty || hasMediaChanges;

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
      setFormData(nextFormData);
      initialFormSignatureRef.current = nextSignature;
      setIsInitialized(true);
      return;
    }

    if (!isFormDirty && nextSignature !== initialFormSignatureRef.current) {
      setFormData(nextFormData);
      initialFormSignatureRef.current = nextSignature;
    }
  }, [collection, collectionGroupsForCollection, isFormDirty, isInitialized]);

  useBeforeUnload(isFormDirty);

  useEffect(() => {
    if (!hasConditionChanged && conditionChangeNote) {
      setConditionChangeNote("");
    }
  }, [conditionChangeNote, hasConditionChanged]);

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

          const isFirstMedia =
            !media || (Array.isArray(media) && media.length === 0);

          await Promise.all(
            uploaded.map(async (file, index) => {
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
                isPrimary: isFirstMedia && index === 0,
                mediaCategory: "image",
              });
            }),
          );
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : t("form.errors.failedToCreateMedia"),
          );
        }
      },
      onUploadError: (uploadError) => {
        setError(
          uploadError &&
            typeof uploadError === "object" &&
            "message" in uploadError
            ? String(uploadError.message)
            : "Upload failed",
        );
      },
    },
  );

  const updateField = useCallback(
    <K extends keyof CollectionFormData>(
      field: K,
      value: CollectionFormData[K],
    ) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
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
          err instanceof Error
            ? `Failed to upload documents: ${err.message}`
            : "Failed to upload documents",
        );
      }
    },
    [collection, createMedia, generateUploadUrl, typedCollectionId],
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
        setError(
          err instanceof Error
            ? err.message
            : t("form.errors.failedToProcessFile"),
        );
      }
    },
    [startUpload, t],
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
          err instanceof Error
            ? err.message
            : t("form.errors.failedToProcessDocument"),
        );
      }
    },
    [handleDocumentUpload, t],
  );

  const handleSetPrimary = useCallback(
    async (mediaId: string) => {
      setError(null);
      try {
        await setPrimary({ mediaId: mediaId as Id<"mediaFiles"> });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t("form.errors.failedToSetPrimary"),
        );
      }
    },
    [setPrimary, t],
  );

  const handleDeleteMedia = useCallback(
    async (mediaId: string) => {
      setError(null);
      try {
        await deleteMedia({ mediaId: mediaId as Id<"mediaFiles"> });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t("form.errors.failedToDeleteMedia"),
        );
      }
    },
    [deleteMedia, t],
  );

  const saveRecord = useCallback(async () => {
    if (!formData.title.trim()) {
      setError(t("form.errors.titleRequired"));
      return false;
    }

    const parsedDimensionWeight = parseOptionalWeight(formData.dimensionWeight);
    if (!parsedDimensionWeight.isValid) {
      setError(
        "Weight must be a valid non-negative number with an optional unit.",
      );
      return false;
    }

    if (requiresConditionChangeNote && !conditionChangeNote.trim()) {
      setError(
        "Condition change note is required when updating the condition.",
      );
      return false;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const materialsString = serializeStringListField(formData.materials);
      const objectTypeString = Array.isArray(formData.objectType)
        ? JSON.stringify(formData.objectType)
        : formData.objectType;

      await updateCollection({
        collectionId: typedCollectionId,
        ...formData,
        materials: materialsString,
        objectType: objectTypeString,
        dimensions: formData.dimensions?.trim() || "",
        dimensionDiameter: formData.dimensionDiameter?.trim() || "",
        dimensionWeight: parsedDimensionWeight.value ?? null,
        weightUnit:
          parsedDimensionWeight.value === undefined
            ? ""
            : parsedDimensionWeight.unit || formData.weightUnit?.trim() || "",
        links: formData.links?.flatMap(({ localId: _localId, ...entry }) =>
          entry.url.trim() !== "" ? [entry] : [],
        ),
        parentObjectId: formData.parentObjectId
          ? (formData.parentObjectId as Id<"collections">)
          : undefined,
        currentLocationId:
          formData.currentLocationId &&
          formData.currentLocationId !== "__none__"
            ? (formData.currentLocationId as Id<"locations">)
            : undefined,
        collectionGroupId: formData.collectionGroupIds?.[0]
          ? (formData.collectionGroupIds[0] as Id<"collectionGroups">)
          : undefined,
        collectionGroupIds: formData.collectionGroupIds?.flatMap(
          (collectionGroupId) =>
            collectionGroupId
              ? [collectionGroupId as Id<"collectionGroups">]
              : [],
        ),
        conditionChangeNote: hasConditionChanged
          ? conditionChangeNote.trim() || undefined
          : undefined,
        alternateAccessionNumbers: formData.alternateAccessionNumbers,
        ownershipHistory: formData.ownershipHistory?.map(
          ({ localId: _localId, ...entry }) => entry,
        ),
      });

      initialFormSignatureRef.current = getFormSignature(formData);
      return true;
    } catch (err) {
      console.error("Error updating collection:", err);
      setError(
        err instanceof Error ? err.message : t("form.errors.updateFailed"),
      );
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    conditionChangeNote,
    formData,
    hasConditionChanged,
    requiresConditionChangeNote,
    t,
    typedCollectionId,
    updateCollection,
  ]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!isFormDirty && hasMediaChanges) {
        push(`/objects/${collectionId}`);
        return;
      }

      if (await saveRecord()) {
        push(`/objects/${collectionId}`);
      }
    },
    [collectionId, hasMediaChanges, isFormDirty, push, saveRecord],
  );

  const handleNavigate = useCallback(
    (href: string) => {
      if (isFormDirty) {
        setPendingNavigation(href);
        setShowUnsavedDialog(true);
        return;
      }
      push(href);
    },
    [isFormDirty, push],
  );

  const handleDiscardAndNavigate = useCallback(() => {
    if (pendingNavigation) {
      push(pendingNavigation);
    }
    setShowUnsavedDialog(false);
    setPendingNavigation(null);
  }, [pendingNavigation, push]);

  const handleSaveAndNavigate = useCallback(async () => {
    const didSave = await saveRecord();
    if (!didSave) {
      return false;
    }

    if (pendingNavigation) {
      push(pendingNavigation);
    }
    setPendingNavigation(null);
    return true;
  }, [pendingNavigation, push, saveRecord]);

  const locationSummary =
    currentLocationPath?.map((location) => location.name).join(" / ") ||
    "No location assigned";
  const collectionSummary =
    collectionGroups
      ?.flatMap((group) =>
        formData.collectionGroupIds?.includes(group._id) ? [group.name] : [],
      )
      .join(", ") || "Not assigned to a collection";

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
    isSubmitting,
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
    showUnsavedDialog,
    setShowUnsavedDialog,
    media,
    images,
    documents,
    heroImage,
    currentLocationPath,
    collectionGroups,
    hasActiveLoan,
    hasConditionChanged,
    requiresConditionChangeNote,
    isFormDirty,
    hasMediaChanges,
    canUpdateObject,
    updateField,
    createOwnershipEntry,
    handleAddAlternateAccessionNumber,
    handleRemoveAlternateAccessionNumber,
    fileInputRef,
    cameraInputRef,
    documentInputRef,
    handleFileSelect,
    handleDocumentSelect,
    handleSetPrimary,
    handleDeleteMedia,
    handleSubmit,
    handleNavigate,
    handleDiscardAndNavigate,
    handleSaveAndNavigate,
    saveRecord,
    locationSummary,
    collectionSummary,
    getStatusBadgeClass,
    resolvedCurrentLocationId,
  };
}
