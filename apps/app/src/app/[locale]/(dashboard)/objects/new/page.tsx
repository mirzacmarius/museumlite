"use client";

import { CollectionGroupCombobox } from "@/components/collection-group-combobox";
import {
  type CollectionType,
  CollectionTypeSelector,
} from "@/components/collection-type-selector";
import { ConditionCombobox } from "@/components/condition-combobox";
import { DonationDetailsField } from "@/components/donation-details-field";
import { LocationSelector } from "@/components/location-selector";
import { MaterialsCombobox } from "@/components/materials-combobox";
import { ObjectCombobox } from "@/components/object-combobox";
import { useOrganization } from "@/components/organization-provider";
import { RepeatableTextField } from "@/components/repeatable-text-field";
import { TypeCombobox } from "@/components/type-combobox";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";
import { useBeforeUnload } from "@/hooks/use-before-unload";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Switch } from "@v1/ui/switch";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import {
  Archive,
  ArrowLeft,
  Calendar,
  Camera,
  CheckCircle,
  Image as ImageIcon,
  Info,
  MapPin,
  Plus,
  Save,
  Star,
  Upload,
  X,
} from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type ObjectTabId,
  getObjectEditTabs,
} from "../[id]/_components/object-tab-config";

interface OwnershipEntry {
  owner: string;
  startYear?: string;
  endYear?: string;
  description?: string;
  verified?: boolean;
  verificationSource?: string;
}

interface CollectionFormData {
  accessionNumber?: string;
  title: string;
  creator?: string;
  objectType?: string | string[];
  objectName?: string;
  culture?: string;
  period?: string;
  dateCreated?: string;
  materials?: string | string[];
  dimensions?: string;
  description?: string;
  condition?: string;
  provenance?: string;
  exhibitionHistory?: string;
  donated_by?: string[];
  donated_date?: string;
  donation_info?: string;
  previous_owners?: string[];
  links?: Array<{ url: string; label?: string }>;
  parentObjectId?: string;
  currentLocationId?: string;
  collectionGroupId?: string;
  alternateAccessionNumbers?: string[];
  ownershipHistory?: OwnershipEntry[];
  collectionType?: CollectionType;
  displayStatus?: string;
  isPubliclyVisible?: boolean;
  isHighResDownloadable?: boolean;
  isSearchable?: boolean;
  isValuationVisible?: boolean;
  publicSlug?: string;
}

type EditTabId = Extract<
  ObjectTabId,
  "general" | "provenance" | "physical" | "media" | "digital"
>;

type LegacyDraftPayload = {
  formData: CollectionFormData;
  savedAt: number;
};

const LEGACY_DRAFT_KEY = "objects.new.draft.v1";
const DRAFT_ACCESSION_KEY = "objects.new.accessionDraftId.v1";

function createEmptyFormData(
  prefilledCollectionGroupId?: string,
): CollectionFormData {
  return {
    accessionNumber: "",
    title: "",
    creator: "",
    objectType: [],
    objectName: "",
    culture: "",
    period: "",
    dateCreated: "",
    materials: [],
    dimensions: "",
    description: "",
    condition: "",
    provenance: "",
    exhibitionHistory: "",
    donated_by: [],
    donated_date: "",
    donation_info: "",
    previous_owners: [],
    links: [{ url: "", label: "" }],
    parentObjectId: "",
    currentLocationId: "",
    collectionGroupId: prefilledCollectionGroupId || "",
    alternateAccessionNumbers: [],
    ownershipHistory: [],
    collectionType: "general",
    displayStatus: undefined,
    isPubliclyVisible: false,
    isHighResDownloadable: false,
    isSearchable: true,
    isValuationVisible: false,
    publicSlug: "",
  };
}

function getFormSignature(formData: CollectionFormData) {
  return JSON.stringify({
    ...formData,
    objectType: Array.isArray(formData.objectType)
      ? formData.objectType
      : formData.objectType
        ? [formData.objectType]
        : [],
    materials: Array.isArray(formData.materials)
      ? formData.materials
      : formData.materials
        ? [formData.materials]
        : [],
    donated_by: formData.donated_by || [],
    previous_owners: formData.previous_owners || [],
    alternateAccessionNumbers: formData.alternateAccessionNumbers || [],
    ownershipHistory: formData.ownershipHistory || [],
    links: formData.links || [],
  });
}

function createFormDataFromDraftObject(
  draftObjectData: Partial<CollectionFormData> | undefined,
  prefilledCollectionGroupId?: string,
): CollectionFormData {
  return {
    ...createEmptyFormData(prefilledCollectionGroupId),
    ...draftObjectData,
    objectType: Array.isArray(draftObjectData?.objectType)
      ? draftObjectData.objectType
      : [],
    materials: Array.isArray(draftObjectData?.materials)
      ? draftObjectData.materials
      : [],
    donated_by: draftObjectData?.donated_by || [],
    previous_owners: draftObjectData?.previous_owners || [],
    alternateAccessionNumbers: draftObjectData?.alternateAccessionNumbers || [],
    ownershipHistory: draftObjectData?.ownershipHistory || [],
    links:
      draftObjectData?.links && draftObjectData.links.length > 0
        ? draftObjectData.links
        : [{ url: "", label: "" }],
  };
}

function buildObjectDraftPayload(formData: CollectionFormData) {
  return {
    accessionNumber: formData.accessionNumber?.trim() || undefined,
    title: formData.title.trim(),
    creator: formData.creator?.trim() || undefined,
    objectType: Array.isArray(formData.objectType)
      ? formData.objectType.filter(Boolean)
      : [],
    objectName: formData.objectName?.trim() || undefined,
    culture: formData.culture?.trim() || undefined,
    period: formData.period?.trim() || undefined,
    dateCreated: formData.dateCreated?.trim() || undefined,
    materials: Array.isArray(formData.materials)
      ? formData.materials.filter(Boolean)
      : [],
    dimensions: formData.dimensions?.trim() || undefined,
    description: formData.description?.trim() || undefined,
    condition: formData.condition?.trim() || undefined,
    provenance: formData.provenance?.trim() || undefined,
    exhibitionHistory: formData.exhibitionHistory?.trim() || undefined,
    donated_by: formData.donated_by?.filter(Boolean) || [],
    donated_date: formData.donated_date?.trim() || undefined,
    donation_info: formData.donation_info?.trim() || undefined,
    previous_owners: formData.previous_owners?.filter(Boolean) || [],
    links:
      formData.links?.filter((link) => link.url.trim().length > 0) || undefined,
    parentObjectId: formData.parentObjectId
      ? (formData.parentObjectId as Id<"collections">)
      : undefined,
    currentLocationId: formData.currentLocationId
      ? (formData.currentLocationId as Id<"locations">)
      : undefined,
    collectionGroupId: formData.collectionGroupId
      ? (formData.collectionGroupId as Id<"collectionGroups">)
      : undefined,
    alternateAccessionNumbers:
      formData.alternateAccessionNumbers?.filter(Boolean) || [],
    ownershipHistory:
      formData.ownershipHistory?.filter(
        (entry) => entry.owner.trim().length > 0,
      ) || [],
    collectionType: formData.collectionType,
    displayStatus: formData.displayStatus,
    isPubliclyVisible: formData.isPubliclyVisible ?? false,
    isHighResDownloadable: formData.isHighResDownloadable ?? false,
    isSearchable: formData.isSearchable ?? true,
    isValuationVisible: formData.isValuationVisible ?? false,
    publicSlug: formData.publicSlug?.trim() || undefined,
  };
}

function EditSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5 border-b border-border/60 pb-8 last:border-b-0 last:pb-0">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default function CollectionFormPage() {
  const t = useScopedI18n("objects");
  const common = useScopedI18n("common");
  const placeholders = useScopedI18n("objects.form.placeholders");
  const router = useRouter();
  const searchParams = useSearchParams();
  const collectionGroupId = searchParams.get("collectionGroupId");
  const { currentOrganizationId } = useOrganization();
  const upsertObjectDraft = useMutation(api.accessions.upsertObjectDraft);
  const generateDraftUploadUrl = useMutation(
    api.accessions.generateDraftUploadUrl,
  );
  const setPreference = useMutation(api.userPreferences.set);
  const removePreference = useMutation(api.userPreferences.remove);
  const savedDraftAccessionId = useQuery(
    api.userPreferences.get,
    currentOrganizationId
      ? { key: DRAFT_ACCESSION_KEY, organizationId: currentOrganizationId }
      : "skip",
  );
  const legacySavedDraft = useQuery(
    api.userPreferences.get,
    currentOrganizationId
      ? { key: LEGACY_DRAFT_KEY, organizationId: currentOrganizationId }
      : "skip",
  );
  const savedDraftAccession = useQuery(
    api.accessions.get,
    savedDraftAccessionId
      ? { accessionId: savedDraftAccessionId as Id<"accessions"> }
      : "skip",
  );

  const initialForm = useMemo(
    () => createEmptyFormData(collectionGroupId || undefined),
    [collectionGroupId],
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const initialFormSignatureRef = useRef(getFormSignature(initialForm));
  const hasHydratedDraftRef = useRef(false);

  const [formData, setFormData] = useState<CollectionFormData>(initialForm);
  const [activeTab, setActiveTab] = useState<EditTabId>("general");
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
    useState<Id<"accessions"> | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null,
  );

  const tabs = useMemo(
    () =>
      getObjectEditTabs().map((tab) => ({ ...tab, id: tab.id as EditTabId })),
    [],
  );

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0]?.id ?? "general");
    }
  }, [activeTab, tabs]);

  useEffect(() => {
    if (hasHydratedDraftRef.current) {
      return;
    }

    if (savedDraftAccessionId === undefined || legacySavedDraft === undefined) {
      return;
    }
    if (savedDraftAccessionId && savedDraftAccession === undefined) {
      return;
    }

    hasHydratedDraftRef.current = true;

    if (savedDraftAccession?.draftObjectData) {
      const nextFormData = createFormDataFromDraftObject(
        savedDraftAccession.draftObjectData,
        collectionGroupId || undefined,
      );
      setFormData(nextFormData);
      setCurrentDraftAccessionId(savedDraftAccession._id);
      initialFormSignatureRef.current = getFormSignature(nextFormData);
      setDraftSavedAt(savedDraftAccession._creationTime);
      return;
    }

    if (!legacySavedDraft) {
      setFormData(initialForm);
      initialFormSignatureRef.current = getFormSignature(initialForm);
      return;
    }

    try {
      const parsed = JSON.parse(legacySavedDraft) as LegacyDraftPayload;
      const nextFormData = createFormDataFromDraftObject(
        parsed.formData,
        collectionGroupId || undefined,
      );
      setFormData(nextFormData);
      initialFormSignatureRef.current = getFormSignature(nextFormData);
      setDraftSavedAt(parsed.savedAt ?? Date.now());
    } catch {
      setFormData(initialForm);
      initialFormSignatureRef.current = getFormSignature(initialForm);
    }
  }, [
    collectionGroupId,
    initialForm,
    legacySavedDraft,
    savedDraftAccession,
    savedDraftAccessionId,
  ]);

  useEffect(() => {
    return () => {
      selectedFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, [selectedFiles]);

  const currentLocationPath = useQuery(
    api.locations.getLocationPath,
    formData.currentLocationId
      ? { locationId: formData.currentLocationId as Id<"locations"> }
      : "skip",
  );

  const currentCollectionGroup = useQuery(
    api.collectionGroups.get,
    formData.collectionGroupId
      ? { groupId: formData.collectionGroupId as Id<"collectionGroups"> }
      : "skip",
  );

  const heroImage =
    selectedFiles.find((file) => file.isPrimary) ?? selectedFiles[0];
  const isFormDirty =
    getFormSignature(formData) !== initialFormSignatureRef.current;
  const hasLocalMediaSelections =
    selectedFiles.length > 0 || selectedDocuments.length > 0;
  const hasUnsavedChanges = isFormDirty || hasLocalMediaSelections;
  const hasSavedFieldDraft = draftSavedAt !== null;
  const isDraftCurrent = hasSavedFieldDraft && !isFormDirty;
  const persistedDraftAccessionId = savedDraftAccessionId
    ? (savedDraftAccessionId as Id<"accessions">)
    : null;
  const activeDraftAccessionId =
    currentDraftAccessionId || persistedDraftAccessionId;

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
        remaining[0] = { ...remaining[0], isPrimary: true };
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

  const uploadDraftMedia = useCallback(async () => {
    if (!currentOrganizationId) {
      return [];
    }

    const uploadedMedia: Array<{
      storageId: Id<"_storage">;
      fileName: string;
      fileSize: number;
      mimeType: string;
      mediaCategory: "image" | "document";
      isPrimary: boolean;
    }> = [];

    for (const fileData of selectedFiles) {
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
      const storageId = uploadResult.storageId as Id<"_storage"> | undefined;

      if (!storageId) {
        throw new Error(`No storage ID returned for ${fileData.file.name}`);
      }

      uploadedMedia.push({
        storageId,
        fileName: fileData.file.name,
        fileSize: fileData.file.size,
        mimeType: fileData.file.type,
        mediaCategory: "image",
        isPrimary: fileData.isPrimary,
      });
    }

    for (const documentData of selectedDocuments) {
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
      const storageId = uploadResult.storageId as Id<"_storage"> | undefined;

      if (!storageId) {
        throw new Error(`No storage ID returned for ${documentData.file.name}`);
      }

      uploadedMedia.push({
        storageId,
        fileName: documentData.file.name,
        fileSize: documentData.file.size,
        mimeType: documentData.file.type,
        mediaCategory: "document",
        isPrimary: false,
      });
    }

    return uploadedMedia;
  }, [
    currentOrganizationId,
    generateDraftUploadUrl,
    selectedDocuments,
    selectedFiles,
  ]);

  const handleSaveDraft = useCallback(async () => {
    if (!currentOrganizationId) {
      return false;
    }

    setIsSavingDraft(true);
    setError(null);

    try {
      const accessionId = await upsertObjectDraft({
        organizationId: currentOrganizationId,
        accessionId: activeDraftAccessionId || undefined,
        saveMode: "draft",
        objectData: buildObjectDraftPayload(formData),
      });

      await setPreference({
        key: DRAFT_ACCESSION_KEY,
        value: accessionId,
        organizationId: currentOrganizationId,
      });
      await removePreference({
        key: LEGACY_DRAFT_KEY,
        organizationId: currentOrganizationId,
      });

      setCurrentDraftAccessionId(accessionId);
      initialFormSignatureRef.current = getFormSignature(formData);
      setDraftSavedAt(Date.now());
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save draft.");
      return false;
    } finally {
      setIsSavingDraft(false);
    }
  }, [
    activeDraftAccessionId,
    currentOrganizationId,
    formData,
    removePreference,
    setPreference,
    upsertObjectDraft,
  ]);

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
        const draftMedia =
          selectedFiles.length > 0 || selectedDocuments.length > 0
            ? await uploadDraftMedia()
            : undefined;

        const accessionId = await upsertObjectDraft({
          organizationId: currentOrganizationId,
          accessionId: activeDraftAccessionId || undefined,
          saveMode: "submit",
          objectData: buildObjectDraftPayload(formData),
          draftMedia,
        });

        await removePreference({
          key: DRAFT_ACCESSION_KEY,
          organizationId: currentOrganizationId,
        });
        await removePreference({
          key: LEGACY_DRAFT_KEY,
          organizationId: currentOrganizationId,
        });

        setCurrentDraftAccessionId(null);
        router.push(`/accessions/${accessionId}`);
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
      removePreference,
      router,
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
        router.push(href);
      }
    },
    [hasUnsavedChanges, router],
  );

  const handleDiscardAndNavigate = useCallback(() => {
    if (pendingNavigation) {
      router.push(pendingNavigation);
    }
    setShowUnsavedDialog(false);
    setPendingNavigation(null);
  }, [pendingNavigation, router]);

  const handleSaveAndNavigate = useCallback(async () => {
    const didSave = await handleSaveDraft();
    if (!didSave) {
      return false;
    }

    if (pendingNavigation) {
      router.push(pendingNavigation);
    }
    setPendingNavigation(null);
    return true;
  }, [handleSaveDraft, pendingNavigation, router]);

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to create objects.
        </p>
      </div>
    );
  }

  const locationSummary =
    currentLocationPath?.map((location) => location.name).join(" / ") ||
    "No location assigned";
  const collectionSummary =
    currentCollectionGroup?.name || "Not assigned to a collection";

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-background/90 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-xs">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => handleNavigate("/objects")}
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Button>
          <span className="text-muted-foreground">
            {t("detail.collections")}
          </span>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium text-foreground">New object</span>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={isSavingDraft || isSubmitting}
          >
            <Archive className="mr-2 h-4 w-4" />
            {isSavingDraft ? "Saving draft..." : "Save Draft"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleNavigate("/objects")}
          >
            {common("cancel")}
          </Button>
          <Button
            type="submit"
            size="sm"
            form="object-create-form"
            disabled={isSubmitting}
          >
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting
              ? selectedFiles.length > 0 || selectedDocuments.length > 0
                ? "Submitting and uploading"
                : "Submitting"
              : "Submit for Approval"}
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <form id="object-create-form" onSubmit={handleSubmit}>
          <div className="border-b border-border/60 bg-secondary/10 px-6 py-8 sm:px-8">
            <div className="mx-auto flex max-w-5xl flex-col gap-8 lg:flex-row lg:items-start">
              <button
                type="button"
                className="group relative shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-secondary transition-colors hover:border-primary/40"
                onClick={() => setActiveTab("media")}
              >
                {heroImage ? (
                  <Image
                    src={heroImage.previewUrl}
                    alt={heroImage.file.name}
                    width={192}
                    height={192}
                    className="h-48 w-48 object-cover"
                  />
                ) : (
                  <div className="flex h-48 w-48 items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-black/55 px-3 py-2 text-left text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                  Open media tab
                </div>
              </button>

              <div className="flex-1 space-y-6">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500">
                    New object
                  </div>
                  <div className="rounded bg-background/80 px-2 py-1 text-[10px] font-mono text-muted-foreground">
                    {isDraftCurrent
                      ? "Draft saved"
                      : hasSavedFieldDraft
                        ? "Draft outdated"
                        : "Not created yet"}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label
                    htmlFor="hero-title"
                    className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground"
                  >
                    Object title
                  </Label>
                  <Input
                    id="hero-title"
                    value={formData.title}
                    onChange={(event) =>
                      updateField("title", event.target.value)
                    }
                    placeholder={placeholders("title")}
                    className="h-14 border-border/60 bg-background/90 text-xl font-semibold sm:text-2xl"
                    required
                  />
                </div>

                <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                  <button
                    type="button"
                    className="rounded-xl border border-border/50 bg-background/70 p-3 text-left transition-colors hover:border-primary/30 hover:text-foreground"
                    onClick={() => setActiveTab("general")}
                  >
                    <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      <Info className="h-3.5 w-3.5" />
                      Creator
                    </div>
                    <div className="truncate text-sm text-foreground">
                      {formData.creator || "Not set"}
                    </div>
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-border/50 bg-background/70 p-3 text-left transition-colors hover:border-primary/30 hover:text-foreground"
                    onClick={() => setActiveTab("general")}
                  >
                    <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      Date created
                    </div>
                    <div className="truncate text-sm text-foreground">
                      {formData.dateCreated || common("unknown")}
                    </div>
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-border/50 bg-background/70 p-3 text-left transition-colors hover:border-primary/30 hover:text-foreground"
                    onClick={() => setActiveTab("general")}
                  >
                    <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      Location
                    </div>
                    <div className="truncate text-sm text-foreground">
                      {locationSummary}
                    </div>
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-border/50 bg-background/70 p-3 text-left transition-colors hover:border-primary/30 hover:text-foreground"
                    onClick={() => setActiveTab("general")}
                  >
                    <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      <Info className="h-3.5 w-3.5" />
                      Collection
                    </div>
                    <div className="truncate text-sm text-foreground">
                      {collectionSummary}
                    </div>
                  </button>
                </div>

                <p className="text-sm text-muted-foreground">
                  Build the record using the same tab structure as object detail
                  and edit. Draft saves create an accession intake record.
                  Images and documents stay local until you submit the object
                  request for approval.
                </p>
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-6xl px-6 py-8">
            {error ? (
              <div className="mb-6 rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="mb-8 flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <Button
                  key={tab.id}
                  type="button"
                  variant={activeTab === tab.id ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/70 px-5 py-6 shadow-sm sm:px-8 sm:py-8">
              {activeTab === "general" ? (
                <div className="space-y-8">
                  <EditSection
                    title="Record identity"
                    description="Core catalog information that identifies and classifies this object."
                  >
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                      <div className="space-y-2">
                        <CollectionTypeSelector
                          value={formData.collectionType}
                          onValueChange={(value) =>
                            updateField("collectionType", value)
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="accessionNumber">
                          Accession Number
                        </Label>
                        <Input
                          id="accessionNumber"
                          value={formData.accessionNumber || ""}
                          onChange={(event) =>
                            updateField("accessionNumber", event.target.value)
                          }
                          placeholder={placeholders("accessionNumber")}
                        />
                      </div>

                      <div className="space-y-2 xl:col-span-1">
                        <RepeatableTextField
                          label="Alternate Accession Numbers"
                          value={formData.alternateAccessionNumbers || []}
                          onChange={(values) =>
                            updateField("alternateAccessionNumbers", values)
                          }
                          placeholder={placeholders("alternateId")}
                          id="alternateAccessionNumbers"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="objectName">Object Name</Label>
                        <Input
                          id="objectName"
                          value={formData.objectName || ""}
                          onChange={(event) =>
                            updateField("objectName", event.target.value)
                          }
                          placeholder={placeholders("objectName")}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="objectType">Object Type</Label>
                        <TypeCombobox
                          organizationId={currentOrganizationId}
                          value={
                            Array.isArray(formData.objectType)
                              ? formData.objectType
                              : []
                          }
                          onValueChange={(value) =>
                            updateField("objectType", value)
                          }
                          placeholder={placeholders("selectTypes")}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="creator">Creator</Label>
                        <Input
                          id="creator"
                          value={formData.creator || ""}
                          onChange={(event) =>
                            updateField("creator", event.target.value)
                          }
                          placeholder={placeholders("creator")}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="culture">Culture</Label>
                        <Input
                          id="culture"
                          value={formData.culture || ""}
                          onChange={(event) =>
                            updateField("culture", event.target.value)
                          }
                          placeholder={placeholders("culture")}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="period">Period</Label>
                        <Input
                          id="period"
                          value={formData.period || ""}
                          onChange={(event) =>
                            updateField("period", event.target.value)
                          }
                          placeholder={placeholders("period")}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="dateCreated">Date Created</Label>
                        <Input
                          id="dateCreated"
                          value={formData.dateCreated || ""}
                          onChange={(event) =>
                            updateField("dateCreated", event.target.value)
                          }
                          placeholder={placeholders("dateCreated")}
                        />
                      </div>
                    </div>
                  </EditSection>

                  <EditSection
                    title="Placement and relationships"
                    description="Where the object should live in the system and how it relates to other records."
                  >
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                      <div className="space-y-2 xl:col-span-2">
                        <Label htmlFor="currentLocationId">
                          Current Location
                        </Label>
                        <LocationSelector
                          organizationId={currentOrganizationId}
                          value={formData.currentLocationId}
                          onValueChange={(value) => {
                            updateField("currentLocationId", value);
                            if (!value) {
                              updateField("displayStatus", undefined);
                            }
                          }}
                          placeholder={placeholders("location")}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="collectionGroupId">Collection</Label>
                        <CollectionGroupCombobox
                          organizationId={currentOrganizationId}
                          value={formData.collectionGroupId}
                          onValueChange={(value) =>
                            updateField("collectionGroupId", value)
                          }
                          placeholder={placeholders("collection")}
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2 xl:col-span-3">
                        <Label htmlFor="parentObjectId">Parent Object</Label>
                        <p className="text-xs text-muted-foreground">
                          Link this object to a parent record when it belongs to
                          a larger set or container.
                        </p>
                        <ObjectCombobox
                          organizationId={currentOrganizationId}
                          value={formData.parentObjectId}
                          onValueChange={(value) =>
                            updateField("parentObjectId", value)
                          }
                          placeholder={placeholders("parentObject")}
                        />
                      </div>

                      <div className="md:col-span-2 xl:col-span-3">
                        <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 px-4 py-4">
                          <div className="space-y-0.5">
                            <Label htmlFor="displayStatus">On display</Label>
                            <p className="text-xs text-muted-foreground">
                              Mark this object as visible to visitors in its
                              current location.
                            </p>
                          </div>
                          <Switch
                            id="displayStatus"
                            checked={formData.displayStatus === "on_display"}
                            onCheckedChange={(checked) =>
                              updateField(
                                "displayStatus",
                                checked ? "on_display" : undefined,
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </EditSection>

                  <EditSection
                    title="Description"
                    description="The primary description shown across the object record."
                  >
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        autoResize
                        id="description"
                        value={formData.description || ""}
                        onChange={(event) =>
                          updateField("description", event.target.value)
                        }
                        rows={5}
                        placeholder={placeholders("description")}
                      />
                    </div>
                  </EditSection>
                </div>
              ) : null}

              {activeTab === "provenance" ? (
                <div className="space-y-8">
                  <EditSection
                    title="Provenance and history"
                    description="Historical context and movement details that give the object its narrative."
                  >
                    <div className="grid gap-5 lg:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="provenance">Provenance</Label>
                        <Textarea
                          autoResize
                          id="provenance"
                          value={formData.provenance || ""}
                          onChange={(event) =>
                            updateField("provenance", event.target.value)
                          }
                          rows={5}
                          placeholder={placeholders("provenance")}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="exhibitionHistory">
                          Exhibition History
                        </Label>
                        <Textarea
                          autoResize
                          id="exhibitionHistory"
                          value={formData.exhibitionHistory || ""}
                          onChange={(event) =>
                            updateField("exhibitionHistory", event.target.value)
                          }
                          rows={5}
                          placeholder={placeholders("exhibitionHistory")}
                        />
                      </div>
                    </div>
                  </EditSection>

                  <EditSection
                    title="Donation and previous ownership"
                    description="Record donor information and prior owners before the current institution."
                  >
                    <div className="space-y-6">
                      <DonationDetailsField
                        organizationId={currentOrganizationId}
                        donatedBy={formData.donated_by || []}
                        donatedDate={formData.donated_date}
                        donationInfo={formData.donation_info}
                        donorPlaceholder={placeholders("selectDonors")}
                        donationInfoPlaceholder={placeholders(
                          "donationContext",
                        )}
                        onDonatedByChange={(value) =>
                          updateField("donated_by", value)
                        }
                        onDonatedDateChange={(value) =>
                          updateField("donated_date", value)
                        }
                        onDonationInfoChange={(value) =>
                          updateField("donation_info", value)
                        }
                      />

                      <RepeatableTextField
                        label="Previous Owner(s)"
                        value={formData.previous_owners || []}
                        onChange={(values) =>
                          updateField("previous_owners", values)
                        }
                        placeholder={placeholders("previousOwner")}
                        id="previous_owners"
                      />
                    </div>
                  </EditSection>

                  <EditSection
                    title="Ownership history"
                    description="Document the chain of ownership entry by entry."
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-muted-foreground">
                          Add dated entries with notes and verification details.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newEntry: OwnershipEntry = {
                              owner: "",
                              startYear: "",
                              endYear: "",
                              description: "",
                              verified: false,
                              verificationSource: "",
                            };
                            updateField("ownershipHistory", [
                              ...(formData.ownershipHistory || []),
                              newEntry,
                            ]);
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Entry
                        </Button>
                      </div>

                      {(formData.ownershipHistory || []).length === 0 ? (
                        <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-border/60">
                          <p className="text-sm text-muted-foreground">
                            No ownership history recorded.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {(formData.ownershipHistory || []).map(
                            (entry, index) => (
                              <div
                                key={`ownership-${entry.owner || ""}-${entry.startYear || ""}-${index}`}
                                className="rounded-xl border border-border/60 bg-secondary/20 p-4"
                              >
                                <div className="mb-4 flex items-start justify-between gap-4">
                                  <div className="space-y-1">
                                    <h3 className="text-sm font-medium">
                                      Ownership entry {index + 1}
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                      Capture ownership dates, notes, and
                                      verification.
                                    </p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => {
                                      const updated = [
                                        ...(formData.ownershipHistory || []),
                                      ];
                                      updated.splice(index, 1);
                                      updateField("ownershipHistory", updated);
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>

                                <div className="grid gap-4">
                                  <div className="grid gap-4 md:grid-cols-3">
                                    <div className="md:col-span-1">
                                      <Label htmlFor={`owner-${index}`}>
                                        Owner{" "}
                                        <span className="text-red-500">*</span>
                                      </Label>
                                      <Input
                                        id={`owner-${index}`}
                                        value={entry.owner}
                                        onChange={(event) => {
                                          const updated = [
                                            ...(formData.ownershipHistory ||
                                              []),
                                          ];
                                          updated[index] = {
                                            ...entry,
                                            owner: event.target.value,
                                          };
                                          updateField(
                                            "ownershipHistory",
                                            updated,
                                          );
                                        }}
                                        placeholder="Owner name"
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor={`startYear-${index}`}>
                                        From
                                      </Label>
                                      <Input
                                        id={`startYear-${index}`}
                                        value={entry.startYear || ""}
                                        onChange={(event) => {
                                          const updated = [
                                            ...(formData.ownershipHistory ||
                                              []),
                                          ];
                                          updated[index] = {
                                            ...entry,
                                            startYear: event.target.value,
                                          };
                                          updateField(
                                            "ownershipHistory",
                                            updated,
                                          );
                                        }}
                                        placeholder="e.g., 1920"
                                      />
                                    </div>
                                    <div>
                                      <Label htmlFor={`endYear-${index}`}>
                                        To
                                      </Label>
                                      <Input
                                        id={`endYear-${index}`}
                                        value={entry.endYear || ""}
                                        onChange={(event) => {
                                          const updated = [
                                            ...(formData.ownershipHistory ||
                                              []),
                                          ];
                                          updated[index] = {
                                            ...entry,
                                            endYear: event.target.value,
                                          };
                                          updateField(
                                            "ownershipHistory",
                                            updated,
                                          );
                                        }}
                                        placeholder="e.g., 1985 or Present"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <Label htmlFor={`description-${index}`}>
                                      Notes
                                    </Label>
                                    <Textarea
                                      id={`description-${index}`}
                                      value={entry.description || ""}
                                      onChange={(event) => {
                                        const updated = [
                                          ...(formData.ownershipHistory || []),
                                        ];
                                        updated[index] = {
                                          ...entry,
                                          description: event.target.value,
                                        };
                                        updateField(
                                          "ownershipHistory",
                                          updated,
                                        );
                                      }}
                                      rows={2}
                                      placeholder="Ownership notes"
                                    />
                                  </div>

                                  <div className="flex flex-wrap items-center gap-4">
                                    <div className="flex items-center gap-2">
                                      <Checkbox
                                        id={`verified-${index}`}
                                        checked={entry.verified ?? false}
                                        onCheckedChange={(checked) => {
                                          const updated = [
                                            ...(formData.ownershipHistory ||
                                              []),
                                          ];
                                          updated[index] = {
                                            ...entry,
                                            verified: checked === true,
                                          };
                                          updateField(
                                            "ownershipHistory",
                                            updated,
                                          );
                                        }}
                                      />
                                      <Label
                                        htmlFor={`verified-${index}`}
                                        className="flex items-center gap-1 text-sm font-normal"
                                      >
                                        <CheckCircle className="h-3 w-3 text-green-500" />
                                        Verified
                                      </Label>
                                    </div>

                                    {entry.verified ? (
                                      <div className="flex-1">
                                        <Input
                                          value={entry.verificationSource || ""}
                                          onChange={(event) => {
                                            const updated = [
                                              ...(formData.ownershipHistory ||
                                                []),
                                            ];
                                            updated[index] = {
                                              ...entry,
                                              verificationSource:
                                                event.target.value,
                                            };
                                            updateField(
                                              "ownershipHistory",
                                              updated,
                                            );
                                          }}
                                          placeholder="Verification source"
                                          className="h-9 text-sm"
                                        />
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  </EditSection>

                  <EditSection
                    title="Links"
                    description="Reference external resources, catalog entries, or supporting material."
                  >
                    <div className="space-y-3">
                      {(formData.links || []).map((link, index) => (
                        <div
                          key={`${link.url}-${link.label || ""}-${index}`}
                          className="grid gap-3 rounded-xl border border-border/50 p-4 md:grid-cols-[1fr_1fr_auto]"
                        >
                          <div className="space-y-2">
                            <Label htmlFor={`link-url-${index}`}>URL</Label>
                            <Input
                              id={`link-url-${index}`}
                              type="url"
                              value={link.url}
                              onChange={(event) => {
                                const nextLinks = [...(formData.links || [])];
                                nextLinks[index] = {
                                  ...nextLinks[index],
                                  url: event.target.value,
                                };
                                updateField("links", nextLinks);
                              }}
                              onBlur={(event) => {
                                const nextLinks = [...(formData.links || [])];
                                if (
                                  event.target.value &&
                                  !nextLinks[index]?.label
                                ) {
                                  nextLinks[index] = {
                                    url: nextLinks[index]?.url || "",
                                    label: event.target.value,
                                  };
                                  updateField("links", nextLinks);
                                }
                              }}
                              placeholder="https://example.com"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`link-label-${index}`}>Label</Label>
                            <Input
                              id={`link-label-${index}`}
                              value={link.label || ""}
                              onChange={(event) => {
                                const nextLinks = [...(formData.links || [])];
                                nextLinks[index] = {
                                  url: nextLinks[index]?.url || "",
                                  label: event.target.value,
                                };
                                updateField("links", nextLinks);
                              }}
                              placeholder={placeholders("linkName")}
                            />
                          </div>
                          {(formData.links || []).length > 1 ? (
                            <div className="flex items-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const nextLinks = [...(formData.links || [])];
                                  nextLinks.splice(index, 1);
                                  updateField("links", nextLinks);
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ))}

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          updateField("links", [
                            ...(formData.links || []),
                            { url: "", label: "" },
                          ]);
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Link
                      </Button>
                    </div>
                  </EditSection>
                </div>
              ) : null}

              {activeTab === "physical" ? (
                <div className="space-y-8">
                  <EditSection
                    title="Physical characteristics"
                    description="Material, dimensional, and condition details for the object."
                  >
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="materials">Materials</Label>
                        <MaterialsCombobox
                          organizationId={currentOrganizationId}
                          value={
                            Array.isArray(formData.materials)
                              ? formData.materials
                              : []
                          }
                          onValueChange={(value) =>
                            updateField("materials", value)
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="dimensions">Dimensions</Label>
                        <Input
                          id="dimensions"
                          value={formData.dimensions || ""}
                          onChange={(event) =>
                            updateField("dimensions", event.target.value)
                          }
                          placeholder={placeholders("dimensions")}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="condition">Condition</Label>
                        <ConditionCombobox
                          organizationId={currentOrganizationId}
                          value={formData.condition || ""}
                          onValueChange={(value) =>
                            updateField("condition", value)
                          }
                        />
                      </div>
                    </div>
                  </EditSection>
                </div>
              ) : null}

              {activeTab === "media" ? (
                <div className="space-y-8">
                  <EditSection
                    title="Images"
                    description="Select images for the object and choose which one becomes primary after creation."
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      multiple
                    />

                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileSelect}
                      className="hidden"
                    />

                    <div className="mb-5 flex flex-wrap gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Images
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => cameraInputRef.current?.click()}
                      >
                        <Camera className="mr-2 h-4 w-4" />
                        Take Photo
                      </Button>
                    </div>

                    {selectedFiles.length > 0 ? (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {selectedFiles.map((file) => (
                          <div
                            key={file.id}
                            className="group relative aspect-square overflow-hidden rounded-xl border border-border/60 bg-card"
                          >
                            <Image
                              src={file.previewUrl}
                              alt={file.file.name}
                              fill
                              sizes="(max-width: 768px) 50vw, 25vw"
                              className="object-cover"
                            />

                            <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3">
                              {file.isPrimary ? (
                                <div className="rounded-full bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground">
                                  Primary
                                </div>
                              ) : (
                                <div />
                              )}
                            </div>

                            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/65 p-3 opacity-0 transition-opacity group-hover:opacity-100">
                              <div className="truncate text-xs text-white">
                                {file.file.name}
                              </div>
                              <div className="flex items-center gap-1">
                                {!file.isPrimary ? (
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="secondary"
                                    className="h-8 w-8"
                                    onClick={() => handleSetPrimary(file.id)}
                                    title={common("setAsPrimary")}
                                  >
                                    <Star className="h-3.5 w-3.5" />
                                  </Button>
                                ) : null}
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="destructive"
                                  className="h-8 w-8"
                                  onClick={() => handleDeleteImage(file.id)}
                                  title={common("delete")}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-border/60">
                        <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          No images selected yet.
                        </p>
                      </div>
                    )}
                  </EditSection>

                  <EditSection
                    title="Documents"
                    description="Attach supporting PDFs, scans, and reference files to upload after creation."
                  >
                    <input
                      ref={documentInputRef}
                      type="file"
                      accept=".pdf,image/jpeg,image/jpg,image/png,image/tiff"
                      onChange={handleDocumentSelect}
                      className="hidden"
                      multiple
                    />

                    <div className="mb-5 flex flex-wrap gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => documentInputRef.current?.click()}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Documents
                      </Button>
                    </div>

                    {selectedDocuments.length > 0 ? (
                      <div className="space-y-3">
                        {selectedDocuments.map((document) => (
                          <div
                            key={document.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/70 px-4 py-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {document.fileName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Queued for upload on create
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteDocument(document.id)}
                              title={common("delete")}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-border/60">
                        <p className="text-sm text-muted-foreground">
                          No documents selected yet.
                        </p>
                      </div>
                    )}
                  </EditSection>
                </div>
              ) : null}

              {activeTab === "digital" ? (
                <div className="space-y-8">
                  <EditSection
                    title="Digital asset visibility"
                    description="Control how this object appears and behaves in public experiences."
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 px-4 py-4">
                        <div className="space-y-0.5">
                          <Label htmlFor="isPubliclyVisible">
                            Public Visibility
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Allow this object to appear in public catalogs.
                          </p>
                        </div>
                        <Switch
                          id="isPubliclyVisible"
                          checked={formData.isPubliclyVisible ?? false}
                          onCheckedChange={(checked) =>
                            updateField("isPubliclyVisible", checked)
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 px-4 py-4">
                        <div className="space-y-0.5">
                          <Label htmlFor="isHighResDownloadable">
                            High-Resolution Downloads
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Allow public users to download high-resolution
                            images.
                          </p>
                        </div>
                        <Switch
                          id="isHighResDownloadable"
                          checked={formData.isHighResDownloadable ?? false}
                          onCheckedChange={(checked) =>
                            updateField("isHighResDownloadable", checked)
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 px-4 py-4">
                        <div className="space-y-0.5">
                          <Label htmlFor="isSearchable">Searchable</Label>
                          <p className="text-xs text-muted-foreground">
                            Include this object in public search results.
                          </p>
                        </div>
                        <Switch
                          id="isSearchable"
                          checked={formData.isSearchable ?? true}
                          onCheckedChange={(checked) =>
                            updateField("isSearchable", checked)
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 px-4 py-4">
                        <div className="space-y-0.5">
                          <Label htmlFor="isValuationVisible">
                            Valuation Visibility
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Show valuation information on the public page.
                          </p>
                        </div>
                        <Switch
                          id="isValuationVisible"
                          checked={formData.isValuationVisible ?? false}
                          onCheckedChange={(checked) =>
                            updateField("isValuationVisible", checked)
                          }
                        />
                      </div>
                    </div>
                  </EditSection>

                  <EditSection
                    title="Public URL"
                    description="Optional custom slug for public-facing access."
                  >
                    <div className="space-y-2">
                      <Label htmlFor="publicSlug">Public URL Slug</Label>
                      <Input
                        id="publicSlug"
                        value={formData.publicSlug ?? ""}
                        onChange={(event) =>
                          updateField("publicSlug", event.target.value)
                        }
                        placeholder="custom-url-slug"
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Leave blank to use the default public path.
                      </p>
                    </div>
                  </EditSection>
                </div>
              ) : null}
            </div>
          </div>
        </form>
      </div>

      <div className="shrink-0 border-t border-border/60 bg-background/95 px-6 py-3 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            {error ? (
              <span className="text-destructive">{error}</span>
            ) : isSubmitting ? (
              <span className="text-foreground">
                {selectedFiles.length > 0 || selectedDocuments.length > 0
                  ? "Submitting and uploading"
                  : "Submitting"}
              </span>
            ) : isSavingDraft ? (
              <span className="text-foreground">Saving draft…</span>
            ) : hasSavedFieldDraft && isFormDirty ? (
              <span className="text-foreground">
                Draft exists, but your latest field changes are not saved yet.
              </span>
            ) : hasLocalMediaSelections ? (
              <span className="text-muted-foreground">
                Draft saves field data only. Images and documents stay local
                until you submit the object request.
              </span>
            ) : isDraftCurrent ? (
              <span className="text-muted-foreground">Draft saved.</span>
            ) : isFormDirty ? (
              <span className="text-foreground">
                You have unsaved field changes across tabs.
              </span>
            ) : (
              <span className="text-muted-foreground">
                No draft changes pending.
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isSavingDraft || isSubmitting}
            >
              <Archive className="mr-2 h-4 w-4" />
              {isSavingDraft ? "Saving draft..." : "Save Draft"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleNavigate("/objects")}
            >
              {common("cancel")}
            </Button>
            <Button
              type="submit"
              form="object-create-form"
              disabled={isSubmitting}
            >
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting
                ? selectedFiles.length > 0 || selectedDocuments.length > 0
                  ? "Submitting and uploading"
                  : "Submitting"
                : "Submit for Approval"}
            </Button>
          </div>
        </div>
      </div>

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onDiscard={handleDiscardAndNavigate}
        onSave={handleSaveAndNavigate}
        isSaving={isSavingDraft}
      />
    </div>
  );
}
