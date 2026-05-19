"use client";

import { CollectionGroupCombobox } from "@/components/collection-group-combobox";
import { ConditionCombobox } from "@/components/condition-combobox";
import { DeaccessionDialog } from "@/components/deaccession-dialog";
import { DonationDetailsField } from "@/components/donation-details-field";
import { LocationSelector } from "@/components/location-selector";
import { MaterialsCombobox } from "@/components/materials-combobox";
import { MediaEditorDialog } from "@/components/media-editor-dialog";
import { ObjectCombobox } from "@/components/object-combobox";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { TypeCombobox } from "@/components/type-combobox";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";
import { useBeforeUnload } from "@/hooks/use-before-unload";
import {
  parseStringListField,
  serializeStringListField,
} from "@/lib/string-list-field";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Switch } from "@v1/ui/switch";
import { Textarea } from "@v1/ui/textarea";
import { cn } from "@v1/ui/utils";
import { useUploadFiles } from "@xixixao/uploadstuff/react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  AlertOctagon,
  Archive,
  ArrowLeft,
  ArrowRightLeft,
  Calendar,
  Camera,
  CheckCircle,
  Edit,
  Image as ImageIcon,
  Info,
  MapPin,
  MoreHorizontal,
  Plus,
  Save,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatOwnershipDateRange } from "../_components/format-ownership-date-range";
import {
  type ObjectTabId,
  getObjectEditTabs,
} from "../_components/object-tab-config";

interface OwnershipEntry {
  localId?: string;
  owner: string;
  startYear?: string;
  endYear?: string;
  description?: string;
  verified?: boolean;
  verificationSource?: string;
}

interface LinkEntry {
  localId?: string;
  url: string;
  label?: string;
}

interface CollectionFormData {
  title: string;
  creator?: string;
  objectType?: string | string[];
  objectName?: string;
  culture?: string;
  period?: string;
  dateCreated?: string;
  materials?: string | string[];
  dimensions?: string;
  dimensionDiameter?: string;
  dimensionWeight?: string | number;
  weightUnit?: string;
  inscriptions?: string;
  description?: string;
  condition?: string;
  provenance?: string;
  exhibitionHistory?: string;
  donated_by?: string[];
  donated_date?: string;
  donation_info?: string;
  acquisitionMethod?: string;
  previous_owners?: string[];
  links?: LinkEntry[];
  parentObjectId?: string;
  currentLocationId?: string;
  collectionGroupId?: string;
  collectionGroupIds?: string[];
  alternateAccessionNumbers?: string[];
  ownershipHistory?: OwnershipEntry[];
  displayStatus?: string;
  isPubliclyVisible?: boolean;
  isHighResDownloadable?: boolean;
  isSearchable?: boolean;
  isValuationVisible?: boolean;
  publicSlug?: string;
}

type CollectionDoc = NonNullable<
  FunctionReturnType<typeof api.collections.get>
>;
type MediaItem = NonNullable<FunctionReturnType<typeof api.media.list>>[number];
type EditTabId = Extract<
  ObjectTabId,
  | "general"
  | "provenance"
  | "physical"
  | "media"
  | "digital"
  | "accession"
  | "placement"
>;

const ACQUISITION_METHODS = [
  "Donated",
  "Bequest",
  "Found",
  "Gift",
  "Loan",
  "Purchase",
  "Trade",
  "Transfer",
] as const;

const EMPTY_FORM: CollectionFormData = {
  title: "",
  creator: "",
  objectType: [],
  objectName: "",
  culture: "",
  period: "",
  dateCreated: "",
  materials: [],
  dimensions: "",
  dimensionDiameter: "",
  dimensionWeight: "",
  weightUnit: "",
  inscriptions: "",
  description: "",
  condition: "",
  provenance: "",
  exhibitionHistory: "",
  donated_by: [],
  donated_date: "",
  donation_info: "",
  acquisitionMethod: "",
  previous_owners: [],
  links: [{ localId: createLinkEntryLocalId(), url: "", label: "" }],
  parentObjectId: "",
  currentLocationId: "",
  collectionGroupId: "",
  collectionGroupIds: [],
  alternateAccessionNumbers: [],
  ownershipHistory: [],
  displayStatus: undefined,
  isPubliclyVisible: false,
  isHighResDownloadable: false,
  isSearchable: true,
  isValuationVisible: false,
  publicSlug: "",
};

function formatMeasurementValue(value?: number, unit?: string) {
  if (value === undefined) {
    return "";
  }

  return unit ? `${value} ${unit}` : value.toString();
}

function parseOptionalWeight(value?: string | number) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0
      ? { isValid: true as const, value, unit: undefined }
      : { isValid: false as const, value: undefined, unit: undefined };
  }

  const trimmed = value?.trim();
  if (!trimmed) {
    return { isValid: true as const, value: undefined, unit: undefined };
  }

  const match = trimmed.match(
    /^(\d+(?:[,.]\d+)?)(?:\s*([a-zA-Z][a-zA-Z.]*))?$/,
  );
  const quantity = match?.[1];
  if (!quantity) {
    return { isValid: false as const, value: undefined, unit: undefined };
  }

  const parsed = Number(quantity.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0
    ? { isValid: true as const, value: parsed, unit: match[2] }
    : { isValid: false as const, value: undefined, unit: undefined };
}

function normalizeOptionalString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "";
}

function createOwnershipEntryLocalId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `ownership-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createLinkEntryLocalId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `link-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function withOwnershipEntryLocalIds(entries?: OwnershipEntry[]) {
  return (entries || []).map((entry) =>
    entry.localId
      ? entry
      : {
          ...entry,
          localId: createOwnershipEntryLocalId(),
        },
  );
}

function withLinkEntryLocalIds(entries?: LinkEntry[]) {
  return (entries || []).map((entry) =>
    entry.localId
      ? entry
      : {
          ...entry,
          localId: createLinkEntryLocalId(),
        },
  );
}

function createInitialFormData(
  collection: CollectionDoc,
  collectionGroups: Array<{ _id: Id<"collectionGroups"> }> = [],
): CollectionFormData {
  let objectTypeArray: string[] = [];
  if (collection.objectType) {
    try {
      const parsed = JSON.parse(collection.objectType);
      objectTypeArray = Array.isArray(parsed)
        ? parsed
        : [collection.objectType];
    } catch {
      objectTypeArray = [collection.objectType];
    }
  }

  const collectionGroupIds =
    collectionGroups.length > 0
      ? collectionGroups.map((group) => group._id as string)
      : collection.collectionGroupId
        ? [collection.collectionGroupId as string]
        : [];

  return {
    title: collection.title,
    creator: collection.creator || "",
    objectType: objectTypeArray,
    objectName: collection.objectName || "",
    culture: collection.culture || "",
    period: collection.period || "",
    dateCreated: collection.dateCreated || "",
    materials: parseStringListField(collection.materials),
    dimensions: collection.dimensions || "",
    dimensionDiameter:
      collection.dimensionDiameter ||
      (!collection.dimensionHeight &&
      !collection.dimensionDepth &&
      collection.dimensionWidth !== undefined
        ? formatMeasurementValue(
            collection.dimensionWidth,
            collection.dimensionUnit,
          )
        : ""),
    dimensionWeight: formatMeasurementValue(
      collection.dimensionWeight,
      collection.weightUnit,
    ),
    weightUnit: collection.weightUnit || "",
    inscriptions: collection.inscriptions || "",
    description: collection.description || "",
    condition: collection.condition || "",
    provenance: collection.provenance || "",
    exhibitionHistory: collection.exhibitionHistory || "",
    donated_by: collection.donated_by || [],
    donated_date: collection.donated_date || "",
    donation_info: collection.donation_info || "",
    acquisitionMethod: collection.acquisitionMethod || "",
    previous_owners: collection.previous_owners || [],
    links:
      collection.links && collection.links.length > 0
        ? withLinkEntryLocalIds(collection.links)
        : [{ localId: createLinkEntryLocalId(), url: "", label: "" }],
    parentObjectId: (collection.parentObjectId as string) || "",
    currentLocationId: (collection.currentLocationId as string) || "",
    collectionGroupId: collectionGroupIds[0] || "",
    collectionGroupIds,
    alternateAccessionNumbers: collection.alternateAccessionNumbers || [],
    ownershipHistory: withOwnershipEntryLocalIds(collection.ownershipHistory),
    displayStatus: collection.displayStatus,
    isPubliclyVisible: collection.isPubliclyVisible ?? false,
    isHighResDownloadable: collection.isHighResDownloadable ?? false,
    isSearchable: collection.isSearchable ?? true,
    isValuationVisible: collection.isValuationVisible ?? false,
    publicSlug: collection.publicSlug ?? "",
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
    collectionGroupIds: formData.collectionGroupIds || [],
    alternateAccessionNumbers: formData.alternateAccessionNumbers || [],
    ownershipHistory:
      formData.ownershipHistory?.map(
        ({ localId: _localId, ...entry }) => entry,
      ) || [],
    links:
      formData.links?.map(({ localId: _localId, ...entry }) => entry) || [],
  });
}

function getMediaSignature(media: MediaItem[]) {
  return JSON.stringify(
    media.map((item) => ({
      id: item._id,
      fileName: item.fileName,
      fileType: item.fileType,
      url: item.url,
      thumbnailUrl: item.thumbnailUrl,
      isPrimary: item.isPrimary,
      mediaCategory: (item as { mediaCategory?: "image" | "document" })
        .mediaCategory,
    })),
  );
}

function getStatusBadgeClass(status: CollectionDoc["status"]) {
  switch (status) {
    case "active":
      return "bg-emerald-500/10 text-emerald-400";
    case "loaned":
      return "bg-blue-500/10 text-blue-400";
    case "deaccessioned":
      return "bg-red-500/10 text-red-400";
    default:
      return "bg-muted text-muted-foreground";
  }
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

export default function CollectionEditPage() {
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

  const [formData, setFormData] = useState<CollectionFormData>(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState<EditTabId>("general");
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
      }).map((tab) => ({ ...tab, id: tab.id as EditTabId })),
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

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to edit objects.
        </p>
      </div>
    );
  }

  if (collection === undefined) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{common("loading")}</p>
      </div>
    );
  }

  if (collection === null) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">Collection not found</p>
      </div>
    );
  }

  const locationSummary =
    currentLocationPath?.map((location) => location.name).join(" / ") ||
    "No location assigned";
  const collectionSummary =
    collectionGroups
      ?.flatMap((group) =>
        formData.collectionGroupIds?.includes(group._id) ? [group.name] : [],
      )
      .join(", ") || "Not assigned to a collection";

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-background/90 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-xs">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => handleNavigate(`/objects/${collectionId}`)}
          >
            <ArrowLeft className="size-4 text-muted-foreground" />
          </Button>
          <span className="text-muted-foreground">
            {t("detail.collections")}
          </span>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium text-foreground">Edit object</span>
        </div>

        <div className="flex items-center gap-3">
          <PermissionGate permission="collections.update">
            {collection.status === "active" && !hasActiveLoan ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setDeaccessionDialogOpen(true)}
              >
                <Archive className="mr-2 size-4" />
                Deaccession
              </Button>
            ) : null}
            {collection.status === "active" && hasActiveLoan ? (
              <div
                className="hidden items-center text-xs text-muted-foreground lg:flex"
                title={common("cannotDeaccession")}
              >
                <AlertOctagon className="mr-2 size-4" />
                Cannot remove while on loan
              </div>
            ) : null}
          </PermissionGate>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleNavigate(`/objects/${collectionId}`)}
          >
            {common("cancel")}
          </Button>
          <Button
            type="submit"
            size="sm"
            form="object-edit-form"
            disabled={isSubmitting || !canUpdateObject}
          >
            <Save className="mr-2 size-4" />
            {isSubmitting ? common("updating") : t("form.actions.updateObject")}
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <form id="object-edit-form" onSubmit={handleSubmit}>
          <div className="border-b border-border/60 bg-secondary/10 px-6 py-8 sm:px-8">
            <div className="mx-auto flex max-w-5xl flex-col gap-8 lg:flex-row lg:items-start">
              <button
                type="button"
                className="group relative shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-secondary transition-colors hover:border-primary/40"
                onClick={() => setActiveTab("media")}
              >
                {heroImage?.url ? (
                  <img
                    src={heroImage.thumbnailUrl || heroImage.url}
                    alt={collection.title}
                    className="size-48 object-cover"
                  />
                ) : (
                  <div className="flex size-48 items-center justify-center">
                    <ImageIcon className="size-12 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-black/55 px-3 py-2 text-left text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                  Open media tab
                </div>
              </button>

              <div className="flex-1 space-y-6">
                {pendingMoveRequest ? (
                  <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-medium text-blue-100">
                          <ArrowRightLeft className="size-4" />
                          {pendingMoveRequest.status === "awaiting_acceptance"
                            ? "Awaiting transfer acceptance"
                            : "Pending transfer approval"}
                        </div>
                        <p className="text-sm text-blue-200/80">
                          This object is{" "}
                          {pendingMoveRequest.status === "awaiting_acceptance"
                            ? "awaiting acceptance"
                            : "awaiting approval"}{" "}
                          to move to {pendingMoveRequest.targetOrganizationName}
                          .
                        </p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={`/objects/move-requests/${pendingMoveRequest._id}`}
                        >
                          Open transfer request
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2.5">
                  <div
                    className={cn(
                      "rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider",
                      getStatusBadgeClass(collection.status),
                    )}
                  >
                    {collection.status}
                  </div>
                  <div className="rounded bg-background/80 px-2 py-1 text-[10px] font-mono text-muted-foreground">
                    {collection.accessionNumber}
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
                      <Info className="size-3.5" />
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
                      <Calendar className="size-3.5" />
                      Date created
                    </div>
                    <div className="truncate text-sm text-foreground">
                      {formData.dateCreated || common("unknown")}
                    </div>
                  </button>
                  {isLocationTrackingEnabled ? (
                    <>
                      <button
                        type="button"
                        className="rounded-xl border border-border/50 bg-background/70 p-3 text-left transition-colors hover:border-primary/30 hover:text-foreground"
                        onClick={() => setActiveTab("placement")}
                      >
                        <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          <MapPin className="size-3.5" />
                          Location
                        </div>
                        <div className="truncate text-sm text-foreground">
                          {locationSummary}
                        </div>
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-border/50 bg-background/70 p-3 text-left transition-colors hover:border-primary/30 hover:text-foreground"
                        onClick={() => setActiveTab("placement")}
                      >
                        <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          <Info className="size-3.5" />
                          Collection
                        </div>
                        <div className="truncate text-sm text-foreground">
                          {collectionSummary}
                        </div>
                      </button>
                    </>
                  ) : null}
                </div>

                <p className="text-sm text-muted-foreground">
                  Edit the record using the same structure as the object detail
                  page. Field changes save together. Media uploads and primary
                  image changes apply immediately.
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
                        <Label htmlFor="accessionNumber">
                          Accession Number
                        </Label>
                        <Input
                          id="accessionNumber"
                          value={collection.accessionNumber}
                          disabled
                          className="bg-muted/60"
                        />
                        <p className="text-xs text-muted-foreground">
                          Accession number cannot be changed.
                        </p>
                      </div>

                      <div className="space-y-3 xl:col-span-2">
                        <Label htmlFor="alternateAccessionNumbers">
                          Alternate Accession Numbers
                        </Label>
                        <div className="space-y-2">
                          {(formData.alternateAccessionNumbers || []).length >
                          0 ? (
                            (formData.alternateAccessionNumbers || []).map(
                              (alternateAccessionNumber, index, values) => {
                                const occurrence = values
                                  .slice(0, index + 1)
                                  .filter(
                                    (value) =>
                                      value === alternateAccessionNumber,
                                  ).length;

                                return (
                                  <div
                                    key={`${alternateAccessionNumber}-${occurrence}`}
                                    className="flex items-center gap-2"
                                  >
                                    <Input
                                      value={alternateAccessionNumber}
                                      disabled
                                      className="bg-muted/60 font-mono"
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      onClick={() =>
                                        handleRemoveAlternateAccessionNumber(
                                          index,
                                        )
                                      }
                                      title="Remove alternate accession number"
                                    >
                                      <Trash2 className="size-4" />
                                    </Button>
                                  </div>
                                );
                              },
                            )
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No alternate accession numbers added.
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            id="alternateAccessionNumbers"
                            value={alternateAccessionDraft}
                            onChange={(event) =>
                              setAlternateAccessionDraft(event.target.value)
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                handleAddAlternateAccessionNumber();
                              }
                            }}
                            placeholder={placeholders("alternateId")}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleAddAlternateAccessionNumber}
                          >
                            <Plus className="mr-2 size-4" />
                            Add
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Existing alternate accession numbers can be removed,
                          but not edited in place.
                        </p>
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
                          organizationId={collection.organizationId}
                          collectionId={collectionId}
                          canDeleteTypes={false}
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

              {activeTab === "accession" ? (
                <div className="space-y-8">
                  <EditSection
                    title="Acquisition information"
                    description="Record how the object entered the collection and who it came from."
                  >
                    <div className="grid gap-5 lg:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="acquisitionMethod">
                          Acquisition Type
                        </Label>
                        <Select
                          value={formData.acquisitionMethod || undefined}
                          onValueChange={(value) =>
                            updateField("acquisitionMethod", value)
                          }
                        >
                          <SelectTrigger id="acquisitionMethod">
                            <SelectValue placeholder="Select acquisition type" />
                          </SelectTrigger>
                          <SelectContent>
                            {ACQUISITION_METHODS.map((method) => (
                              <SelectItem key={method} value={method}>
                                {method}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <DonationDetailsField
                        organizationId={collection.organizationId}
                        collectionId={collectionId}
                        donatedBy={formData.donated_by || []}
                        donatedDate={formData.donated_date}
                        donationInfo={formData.donation_info}
                        donorPlaceholder={placeholders("selectDonors")}
                        donationInfoPlaceholder={placeholders(
                          "donationInfoLong",
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
                            const newEntry = createOwnershipEntry({
                              owner: "",
                              startYear: "",
                              endYear: "",
                              description: "",
                              verified: false,
                              verificationSource: "",
                            });
                            updateField("ownershipHistory", [
                              ...(formData.ownershipHistory || []),
                              newEntry,
                            ]);
                            setEditingOwnershipEntryId(
                              newEntry.localId ?? null,
                            );
                          }}
                        >
                          <Plus className="mr-2 size-4" />
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
                            (entry, index) => {
                              const entryId = entry.localId ?? `${index}`;
                              const isEditingEntry =
                                editingOwnershipEntryId === entryId;

                              if (!isEditingEntry) {
                                return (
                                  <div
                                    key={entryId}
                                    className="rounded-xl border border-border/60 bg-secondary/20 p-4"
                                  >
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="min-w-0 space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <h3 className="truncate text-sm font-medium">
                                            {entry.owner ||
                                              `Ownership entry ${index + 1}`}
                                          </h3>
                                          {entry.verified ? (
                                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-500">
                                              <CheckCircle className="size-3" />
                                              Verified
                                            </span>
                                          ) : null}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                          {formatOwnershipDateRange(entry)}
                                        </p>
                                        {entry.description ? (
                                          <p className="text-sm text-muted-foreground">
                                            {entry.description}
                                          </p>
                                        ) : null}
                                        {entry.verificationSource ? (
                                          <p className="text-xs text-muted-foreground">
                                            Source: {entry.verificationSource}
                                          </p>
                                        ) : null}
                                      </div>

                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="size-8 shrink-0 text-muted-foreground"
                                          >
                                            <MoreHorizontal className="size-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem
                                            onClick={() =>
                                              setEditingOwnershipEntryId(
                                                entryId,
                                              )
                                            }
                                          >
                                            <Edit className="mr-2 size-4" />
                                            Edit
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            className="text-destructive focus:text-destructive"
                                            onClick={() => {
                                              const updated = [
                                                ...(formData.ownershipHistory ||
                                                  []),
                                              ];
                                              updated.splice(index, 1);
                                              updateField(
                                                "ownershipHistory",
                                                updated,
                                              );
                                            }}
                                          >
                                            <Trash2 className="mr-2 size-4" />
                                            Delete
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={entryId}
                                  className="rounded-xl border border-border/60 bg-secondary/20 p-4"
                                >
                                  <div className="mb-4 flex items-start justify-between gap-4">
                                    <div className="space-y-1">
                                      <h3 className="text-sm font-medium">
                                        Edit ownership entry {index + 1}
                                      </h3>
                                      <p className="text-xs text-muted-foreground">
                                        Capture ownership dates, notes, and
                                        verification.
                                      </p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        setEditingOwnershipEntryId(null)
                                      }
                                    >
                                      Finish editing
                                    </Button>
                                  </div>

                                  <div className="grid gap-4">
                                    <div className="grid gap-4 md:grid-cols-3">
                                      <div className="md:col-span-1">
                                        <Label htmlFor={`owner-${index}`}>
                                          Owner{" "}
                                          <span className="text-red-500">
                                            *
                                          </span>
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
                                          placeholder={placeholders(
                                            "ownerName",
                                          )}
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
                                            ...(formData.ownershipHistory ||
                                              []),
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
                                        placeholder={placeholders(
                                          "ownershipNotes",
                                        )}
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
                                          <CheckCircle className="size-3 text-green-500" />
                                          Verified
                                        </Label>
                                      </div>

                                      {entry.verified ? (
                                        <div className="flex-1">
                                          <Input
                                            value={
                                              entry.verificationSource || ""
                                            }
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
                                            placeholder={placeholders(
                                              "verificationSource",
                                            )}
                                            className="h-9 text-sm"
                                          />
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              );
                            },
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
                          key={link.localId ?? `link-${index}`}
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
                                    localId: nextLinks[index]?.localId,
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
                                  localId: nextLinks[index]?.localId,
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
                                <X className="size-4" />
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
                            {
                              localId: createLinkEntryLocalId(),
                              url: "",
                              label: "",
                            },
                          ]);
                        }}
                      >
                        <Plus className="mr-2 size-4" />
                        Add Link
                      </Button>
                    </div>
                  </EditSection>
                </div>
              ) : null}

              {activeTab === "placement" ? (
                <div className="space-y-8">
                  <EditSection
                    title="Placement and relationships"
                    description="Where the object lives in the system and how it relates to other records."
                  >
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                      <div className="space-y-2 xl:col-span-2">
                        <Label htmlFor="placementCurrentLocationId">
                          Current Location
                        </Label>
                        <LocationSelector
                          organizationId={collection.organizationId}
                          value={resolvedCurrentLocationId}
                          onValueChange={(value) => {
                            updateField("currentLocationId", value);
                            if (!value) {
                              updateField("displayStatus", "");
                            }
                          }}
                          placeholder={placeholders("location")}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="placementCollectionGroupId">
                          Collection
                        </Label>
                        <CollectionGroupCombobox
                          organizationId={collection.organizationId}
                          value={formData.collectionGroupIds}
                          onValueChange={(value) => {
                            updateField("collectionGroupIds", value);
                            updateField("collectionGroupId", value[0] || "");
                          }}
                          placeholder={placeholders("collection")}
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2 xl:col-span-3">
                        <Label htmlFor="placementParentObjectId">
                          Parent Object
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Link this object to a parent record when it belongs to
                          a larger set or container.
                        </p>
                        <ObjectCombobox
                          organizationId={collection.organizationId}
                          collectionId={collectionId}
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
                            <Label htmlFor="placementDisplayStatus">
                              On display
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Mark this object as visible to visitors in its
                              current location.
                            </p>
                          </div>
                          <Switch
                            id="placementDisplayStatus"
                            checked={formData.displayStatus === "on_display"}
                            onCheckedChange={(checked) =>
                              updateField(
                                "displayStatus",
                                checked ? "on_display" : "",
                              )
                            }
                          />
                        </div>
                      </div>
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
                          organizationId={collection.organizationId}
                          collectionId={collectionId}
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
                        <Label htmlFor="condition">Condition</Label>
                        <ConditionCombobox
                          organizationId={collection.organizationId}
                          value={formData.condition || ""}
                          onValueChange={(value) =>
                            updateField("condition", value)
                          }
                        />
                        {hasConditionChanged ? (
                          <div className="rounded-lg border border-dashed border-border/60 bg-secondary/10 p-3">
                            <p className="text-xs text-muted-foreground">
                              This change will be dated and attributed
                              automatically.
                            </p>
                            <div className="mt-3 space-y-2">
                              <Label htmlFor="conditionChangeNote">
                                Condition change note
                              </Label>
                              <Textarea
                                autoResize
                                id="conditionChangeNote"
                                value={conditionChangeNote}
                                onChange={(event) =>
                                  setConditionChangeNote(event.target.value)
                                }
                                rows={3}
                                placeholder="Explain what changed and why."
                              />
                              <p className="text-xs text-muted-foreground">
                                {requiresConditionChangeNote
                                  ? "Required when replacing an existing condition."
                                  : "Optional for the initial condition entry."}
                              </p>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-3 md:col-span-2 xl:col-span-3">
                        <div className="space-y-1">
                          <h3 className="text-sm font-medium text-foreground">
                            Detailed Dimensions
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Document dimensions, diameter, and weight.
                          </p>
                        </div>
                        <div className="grid gap-5 md:grid-cols-3">
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
                            <Label htmlFor="dimensionDiameter">Diameter</Label>
                            <Input
                              id="dimensionDiameter"
                              value={formData.dimensionDiameter || ""}
                              onChange={(event) =>
                                updateField(
                                  "dimensionDiameter",
                                  event.target.value,
                                )
                              }
                              placeholder="e.g., 43 mm"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="dimensionWeight">Weight</Label>
                            <Input
                              id="dimensionWeight"
                              inputMode="decimal"
                              value={formData.dimensionWeight ?? ""}
                              onChange={(event) =>
                                updateField(
                                  "dimensionWeight",
                                  event.target.value,
                                )
                              }
                              placeholder="e.g., 200gram or 2kg"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 md:col-span-2 xl:col-span-3">
                        <Label htmlFor="inscriptions">
                          Inscriptions & Marks
                        </Label>
                        <Textarea
                          autoResize
                          id="inscriptions"
                          value={formData.inscriptions || ""}
                          onChange={(event) =>
                            updateField("inscriptions", event.target.value)
                          }
                          rows={4}
                          placeholder="Document signatures, stamps, labels, engravings, or collector marks"
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
                    description="Upload images, assign a primary image, and manage thumbnails for the object record."
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
                        <Upload className="mr-2 size-4" />
                        Upload Images
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => cameraInputRef.current?.click()}
                      >
                        <Camera className="mr-2 size-4" />
                        Take Photo
                      </Button>
                    </div>

                    {images.length > 0 ? (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {images.map((file) => (
                          <div
                            key={file._id}
                            className="group relative aspect-square overflow-hidden rounded-xl border border-border/60 bg-card"
                          >
                            {file.url ? (
                              <Image
                                src={file.url}
                                alt={file.fileName}
                                fill
                                sizes="(max-width: 768px) 50vw, 25vw"
                                className="object-cover"
                              />
                            ) : null}

                            <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3">
                              {file.isPrimary ? (
                                <div className="rounded-full bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground">
                                  Primary
                                </div>
                              ) : (
                                <div />
                              )}
                            </div>

                            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/65 p-3">
                              <div className="truncate text-xs text-white">
                                {file.fileName}
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="secondary"
                                  className="size-8"
                                  onClick={() =>
                                    setEditingImageId(
                                      file._id as Id<"mediaFiles">,
                                    )
                                  }
                                  title={common("edit")}
                                >
                                  <Edit className="size-3.5" />
                                </Button>
                                {!file.isPrimary ? (
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="secondary"
                                    className="size-8"
                                    onClick={() => handleSetPrimary(file._id)}
                                    title={common("setAsPrimary")}
                                  >
                                    <Star className="size-3.5" />
                                  </Button>
                                ) : null}
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="destructive"
                                  className="size-8"
                                  onClick={() => handleDeleteMedia(file._id)}
                                  title={common("delete")}
                                >
                                  <X className="size-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-border/60">
                        <Upload className="mb-2 size-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          No images uploaded yet.
                        </p>
                      </div>
                    )}
                  </EditSection>

                  <EditSection
                    title="Documents"
                    description="Upload supporting PDFs, scans, and related object files."
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
                        <Upload className="mr-2 size-4" />
                        Upload Documents
                      </Button>
                    </div>

                    {documents.length > 0 ? (
                      <div className="space-y-3">
                        {documents.map((document) => (
                          <div
                            key={document._id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/70 px-4 py-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {document.fileName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Saved to this object
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteMedia(document._id)}
                              title={common("delete")}
                            >
                              <X className="size-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-border/60">
                        <p className="text-sm text-muted-foreground">
                          No documents uploaded yet.
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
              <span className="text-foreground">Saving changes…</span>
            ) : isFormDirty ? (
              <span className="text-foreground">
                You have unsaved field changes across tabs.
              </span>
            ) : hasMediaChanges ? (
              <span className="text-muted-foreground">
                Media changes are already applied.
              </span>
            ) : (
              <span className="text-muted-foreground">
                No unsaved field changes.
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleNavigate(`/objects/${collectionId}`)}
            >
              {common("cancel")}
            </Button>
            <Button
              type="submit"
              form="object-edit-form"
              disabled={isSubmitting || !canUpdateObject}
            >
              <Save className="mr-2 size-4" />
              {isSubmitting
                ? common("updating")
                : t("form.actions.updateObject")}
            </Button>
          </div>
        </div>
      </div>

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onDiscard={handleDiscardAndNavigate}
        onSave={handleSaveAndNavigate}
        isSaving={isSubmitting}
      />

      <DeaccessionDialog
        open={deaccessionDialogOpen}
        onOpenChange={setDeaccessionDialogOpen}
        collectionId={typedCollectionId}
        collectionTitle={collection.title}
        organizationId={collection.organizationId}
      />
      <MediaEditorDialog
        mediaId={editingImageId}
        isOpen={!!editingImageId}
        onClose={() => setEditingImageId(null)}
      />
    </div>
  );
}
