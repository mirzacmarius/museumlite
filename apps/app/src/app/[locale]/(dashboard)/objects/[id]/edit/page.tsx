"use client";

import { DeaccessionDialog } from "@/components/deaccession-dialog";
import { ConditionCombobox } from "@/components/condition-combobox";
import { DonorCombobox } from "@/components/donor-combobox";
import { LocationSelector } from "@/components/location-selector";
import { MaterialsCombobox } from "@/components/materials-combobox";
import { CollectionGroupCombobox } from "@/components/collection-group-combobox";
import { ObjectCombobox } from "@/components/object-combobox";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { RepeatableTextField } from "@/components/repeatable-text-field";
import { TypeCombobox } from "@/components/type-combobox";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { DatePicker } from "@v1/ui/date-picker";
import { NaturalLanguageDatePicker } from "@v1/ui/natural-language-date-picker";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  TagsInput,
  TagsInputInput,
  TagsInputItem,
  TagsInputLabel,
  TagsInputList,
} from "@v1/ui/tags-input";
import { Switch } from "@v1/ui/switch";
import { Textarea } from "@v1/ui/textarea";
import { Checkbox } from "@v1/ui/checkbox";
import { useUploadFiles } from "@xixixao/uploadstuff/react";
import { useMutation, useQuery } from "convex/react";
import {
  AlertOctagon,
  Archive,
  ArrowLeft,
  CheckCircle,
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
import { useEffect, useRef, useState } from "react";

interface OwnershipEntry {
  owner: string;
  startYear?: string;
  endYear?: string;
  description?: string;
  verified?: boolean;
  verificationSource?: string;
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
  isPubliclyVisible?: boolean;
  isHighResDownloadable?: boolean;
}

export default function CollectionEditPage() {
  const params = useParams();
  const router = useRouter();
  const collectionId = params.id as string;
  const { currentOrganizationId } = useOrganization();
  const updateCollection = useMutation(api.collections.update);
  const generateUploadUrl = useMutation(api.media.generateUploadUrl);
  const createMedia = useMutation(api.media.create);
  const setPrimary = useMutation(api.media.setPrimary);
  const deleteMedia = useMutation(api.media.deleteMedia);

  const collection = useQuery(
    api.collections.get,
    collectionId ? { collectionId: collectionId as Id<"collections"> } : "skip",
  );

  const media = useQuery(
    api.media.list,
    collectionId ? { collectionId: collectionId as Id<"collections"> } : "skip",
  );

  // Separate images and documents
  // Only show actual images (fileType === "image") in the image gallery
  // Documents should only appear in the documents list
  const images =
    media?.filter((m) => {
      const category = (m as { mediaCategory?: "image" | "document" })
        .mediaCategory;
      return (category === "image" || !category) && m.fileType === "image";
    }) || [];
  const documents =
    media?.filter(
      (m) =>
        (m as { mediaCategory?: "image" | "document" }).mediaCategory ===
        "document",
    ) || [];

  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<File[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deaccessionDialogOpen, setDeaccessionDialogOpen] = useState(false);
  const [formData, setFormData] = useState<CollectionFormData>({
    title: "",
    creator: "",
    objectType: [], // Initialize as empty array
    objectName: "",
    culture: "",
    period: "",
    dateCreated: "",
    materials: [], // Initialize as empty array
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
    currentLocationId: "",
    alternateAccessionNumbers: [],
  });

  // Upload handling
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
        collectionId: collectionId as Id<"collections">,
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
                collectionId: collectionId as Id<"collections">,
                storageId: storageId,
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
              : "Failed to create media records",
          );
        }
      },
      onUploadError: (error) => {
        setError(
          error && typeof error === "object" && "message" in error
            ? String(error.message)
            : "Upload failed",
        );
      },
    },
  );

  // Document upload handling - upload immediately when selected
  const handleDocumentUpload = async (files: File[]) => {
    if (!collection || !collectionId) {
      setError("Missing collection data");
      return;
    }

    setError(null);

    for (const file of files) {
      try {
        // Generate upload URL
        const uploadUrlResult = await generateUploadUrl({
          organizationId: collection.organizationId,
          collectionId: collectionId as Id<"collections">,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        });

        if (!uploadUrlResult.uploadUrl) {
          throw new Error(`Failed to generate upload URL for ${file.name}`);
        }

        // Upload file to storage
        const uploadResponse = await fetch(uploadUrlResult.uploadUrl, {
          method: "POST",
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        const uploadResult = await uploadResponse.json();
        const storageId = uploadResult.storageId;

        if (!storageId) {
          throw new Error(`No storage ID returned for ${file.name}`);
        }

        // Create media record for document
        await createMedia({
          organizationId: collection.organizationId,
          collectionId: collectionId as Id<"collections">,
          storageId: storageId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          mediaCategory: "document",
          isPrimary: false, // Documents are never primary
        });
      } catch (err) {
        console.error(`Error uploading ${file.name}:`, err);
        setError(
          err instanceof Error
            ? `Failed to upload ${file.name}: ${err.message}`
            : `Failed to upload ${file.name}`,
        );
        // Stop on first error
        break;
      }
    }
  };

  // Load existing data
  useEffect(() => {
    if (collection) {
      // Parse materials from JSON string to array
      let materialsArray: string[] = [];
      if (collection.materials) {
        try {
          materialsArray = JSON.parse(collection.materials);
        } catch {
          // If not valid JSON, treat as empty array
          materialsArray = [];
        }
      }

      // Parse objectType from JSON string to array
      let objectTypeArray: string[] = [];
      if (collection.objectType) {
        try {
          objectTypeArray = JSON.parse(collection.objectType);
        } catch {
          // If not valid JSON, treat as empty array
          objectTypeArray = [];
        }
      }

      setFormData({
        title: collection.title,
        creator: collection.creator || "",
        objectType: objectTypeArray, // Store as array in form state
        objectName: collection.objectName || "",
        culture: collection.culture || "",
        period: collection.period || "",
        dateCreated: collection.dateCreated || "",
        materials: materialsArray, // Store as array in form state
        dimensions: collection.dimensions || "",
        description: collection.description || "",
        condition: collection.condition || "",
        provenance: collection.provenance || "",
        exhibitionHistory: collection.exhibitionHistory || "",
        donated_by: collection.donated_by || [],
        donated_date: collection.donated_date || "",
        donation_info: collection.donation_info || "",
        previous_owners: collection.previous_owners || [],
        links:
          collection.links && collection.links.length > 0
            ? collection.links
            : [{ url: "", label: "" }],
        parentObjectId: (collection.parentObjectId as string) || "",
        currentLocationId:
          (collection.currentLocationId as string) || "__none__",
        collectionGroupId: (collection.collectionGroupId as string) || "",
        alternateAccessionNumbers: collection.alternateAccessionNumbers || [],
        ownershipHistory: collection.ownershipHistory || [],
        isPubliclyVisible: collection.isPubliclyVisible ?? false,
        isHighResDownloadable: collection.isHighResDownloadable ?? false,
      });
    }
  }, [collection]);

  // Query loans to check if item is on active loan
  const loans = useQuery(
    api.loans.getLoansForCollection,
    collection ? { collectionId: collection._id } : "skip",
  );
  const hasActiveLoan =
    loans?.some((loan) => loan.status === "active") ?? false;

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to edit objects.
        </p>
      </div>
    );
  }

  if (collection === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (collection === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Collection not found</p>
      </div>
    );
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    try {
      const filesList = event.target?.files;
      if (!filesList || filesList.length === 0) {
        return;
      }
      const files = Array.from(filesList);
      if (!files || files.length === 0) {
        return;
      }

      filesRef.current = [...files];
      startUpload(files);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to process file selection",
      );
    }
  };

  const handleDocumentSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setError(null);
    try {
      const filesList = event.target?.files;
      if (!filesList || filesList.length === 0) {
        return;
      }
      const files = Array.from(filesList);
      if (!files || files.length === 0) {
        return;
      }

      // Upload documents immediately
      await handleDocumentUpload(files);

      // Clear the input
      if (documentInputRef.current) {
        documentInputRef.current.value = "";
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to process document selection",
      );
    }
  };

  const handleSetPrimary = async (mediaId: string) => {
    setError(null);
    try {
      await setPrimary({ mediaId: mediaId as Id<"mediaFiles"> });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to set primary image",
      );
    }
  };

  const handleDelete = async (mediaId: string) => {
    setError(null);
    try {
      await deleteMedia({ mediaId: mediaId as Id<"mediaFiles"> });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete media");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.title.trim()) {
      setError("Title is required");
      return;
    }

    setIsSubmitting(true);
    try {
      // Convert materials array to JSON string for backend
      const materialsString = Array.isArray(formData.materials)
        ? JSON.stringify(formData.materials)
        : formData.materials;

      // Convert objectType array to JSON string for backend
      const objectTypeString = Array.isArray(formData.objectType)
        ? JSON.stringify(formData.objectType)
        : formData.objectType;

      await updateCollection({
        collectionId: collectionId as Id<"collections">,
        ...formData,
        materials: materialsString,
        objectType: objectTypeString,
        links: formData.links?.filter((link) => link.url.trim() !== ""),
        parentObjectId: formData.parentObjectId
          ? (formData.parentObjectId as Id<"collections">)
          : undefined,
        currentLocationId:
          formData.currentLocationId &&
          formData.currentLocationId !== "__none__"
            ? (formData.currentLocationId as Id<"locations">)
            : undefined,
        collectionGroupId: formData.collectionGroupId
          ? (formData.collectionGroupId as Id<"collectionGroups">)
          : undefined,
        alternateAccessionNumbers: formData.alternateAccessionNumbers,
      });
      router.push(`/objects/${collectionId}`);
    } catch (err) {
      console.error("Error updating collection:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update object. Please try again.",
      );
      setIsSubmitting(false);
    }
  };

  const updateField = (
    field: keyof CollectionFormData,
    value:
      | string
      | string[]
      | boolean
      | Array<{ url: string; label?: string }>
      | OwnershipEntry[]
      | undefined,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="flex h-full w-full bg-background px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="flex w-full items-center justify-between rounded-lg p-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/objects/${collectionId}`}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Link>
              </Button>
              <h2 className="text-xl font-medium text-primary">Edit Object</h2>
            </div>
          </div>

          <div className="flex w-full px-6">
            <div className="w-full border-b border-border" />
          </div>

          <form onSubmit={handleSubmit} className="p-4">
            {error && (
              <div className="mb-4 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex gap-4">
              {/* Left column - Form sections */}
              <div className="flex-1 space-y-4">
                {/* Basic Information Section */}
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="mb-3 text-base font-semibold">
                    Basic Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="title">
                        Title <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => updateField("title", e.target.value)}
                        placeholder="Enter object title"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="accessionNumber">Accession Number</Label>
                      <Input
                        id="accessionNumber"
                        value={collection.accessionNumber}
                        disabled
                        className="bg-muted"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Accession number cannot be changed
                      </p>
                    </div>

                    <div>
                      <TagsInput
                        value={formData.alternateAccessionNumbers || []}
                        onValueChange={(values) =>
                          updateField("alternateAccessionNumbers", values)
                        }
                        editable
                        addOnPaste
                      >
                        <TagsInputLabel>
                          Alternate Accession Numbers
                        </TagsInputLabel>
                        <TagsInputList>
                          {(formData.alternateAccessionNumbers || []).map(
                            (number) => (
                              <TagsInputItem key={number} value={number}>
                                {number}
                              </TagsInputItem>
                            ),
                          )}
                          <TagsInputInput placeholder="Add alternate ID..." />
                        </TagsInputList>
                      </TagsInput>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Historical accession numbers previously assigned to this
                        object
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="objectName">Object Name</Label>
                      <Input
                        id="objectName"
                        value={formData.objectName || ""}
                        onChange={(e) =>
                          updateField("objectName", e.target.value)
                        }
                        placeholder="e.g., Portrait"
                      />
                    </div>

                    <div>
                      <Label htmlFor="objectType">Object Type</Label>
                      <TypeCombobox
                        organizationId={collection.organizationId}
                        collectionId={collectionId}
                        value={
                          Array.isArray(formData.objectType)
                            ? formData.objectType
                            : []
                        }
                        onValueChange={(value) =>
                          updateField("objectType", value)
                        }
                        placeholder="Select or add types..."
                      />
                    </div>

                    <div>
                      <Label htmlFor="culture">Culture</Label>
                      <Input
                        id="culture"
                        value={formData.culture || ""}
                        onChange={(e) => updateField("culture", e.target.value)}
                        placeholder="e.g., French"
                      />
                    </div>

                    <div>
                      <Label htmlFor="period">Period</Label>
                      <Input
                        id="period"
                        value={formData.period || ""}
                        onChange={(e) => updateField("period", e.target.value)}
                        placeholder="e.g., 19th Century"
                      />
                    </div>

                    <div>
                      <Label htmlFor="dateCreated">Date Created</Label>
                      <Input
                        id="dateCreated"
                        value={formData.dateCreated || ""}
                        onChange={(e) =>
                          updateField("dateCreated", e.target.value)
                        }
                        placeholder="e.g., 1850"
                      />
                    </div>

                    <div>
                      <Label htmlFor="creator">Creator</Label>
                      <Input
                        id="creator"
                        value={formData.creator || ""}
                        onChange={(e) => updateField("creator", e.target.value)}
                        placeholder="e.g., Vincent van Gogh"
                      />
                    </div>
                  </div>
                </div>

                {/* Physical Characteristics Section */}
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="mb-3 text-base font-semibold">
                    Physical Characteristics
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
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

                    <div>
                      <Label htmlFor="dimensions">Dimensions</Label>
                      <Input
                        id="dimensions"
                        value={formData.dimensions || ""}
                        onChange={(e) =>
                          updateField("dimensions", e.target.value)
                        }
                        placeholder="e.g., 50 x 60 cm"
                      />
                    </div>

                    <div>
                      <Label htmlFor="condition">Condition</Label>
                      <ConditionCombobox
                        organizationId={collection.organizationId}
                        value={formData.condition || ""}
                        onValueChange={(value) =>
                          updateField("condition", value)
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Location Information Section */}
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="mb-3 text-base font-semibold">
                    Location Information
                  </h3>
                  <div>
                    <Label htmlFor="currentLocationId">Current Location</Label>
                    <LocationSelector
                      organizationId={collection.organizationId}
                      value={
                        formData.currentLocationId !== ""
                          ? formData.currentLocationId
                          : (collection.currentLocationId as string) ||
                            "__none__"
                      }
                      onValueChange={(value) =>
                        updateField("currentLocationId", value)
                      }
                      placeholder="Select a location (optional)"
                    />
                  </div>
                </div>

                {/* Object Relationships Section */}
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="mb-3 text-base font-semibold">
                    Object Relationships
                  </h3>
                  <div>
                    <Label htmlFor="parentObjectId">Parent Object</Label>
                    <p className="mb-2 text-xs text-muted-foreground">
                      Link this object to a parent object (e.g., a treasure
                      chest containing this object)
                    </p>
                    <ObjectCombobox
                      organizationId={collection.organizationId}
                      collectionId={collectionId}
                      value={formData.parentObjectId}
                      onValueChange={(value) =>
                        updateField("parentObjectId", value)
                      }
                      placeholder="Select parent object (optional)"
                    />
                  </div>
                  <div className="mt-4">
                    <Label htmlFor="collectionGroupId">Collection</Label>
                    <p className="mb-2 text-xs text-muted-foreground">
                      Add this object to a collection group
                    </p>
                    <CollectionGroupCombobox
                      organizationId={collection.organizationId}
                      value={formData.collectionGroupId}
                      onValueChange={(value) =>
                        updateField("collectionGroupId", value)
                      }
                      placeholder="Select collection (optional)"
                    />
                  </div>
                </div>

                {/* Object Information Section */}
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="mb-3 text-base font-semibold">
                    Object Information
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description || ""}
                        onChange={(e) =>
                          updateField("description", e.target.value)
                        }
                        rows={4}
                        placeholder="Enter detailed description"
                      />
                    </div>

                    <div>
                      <Label htmlFor="provenance">Provenance</Label>
                      <Textarea
                        id="provenance"
                        value={formData.provenance || ""}
                        onChange={(e) =>
                          updateField("provenance", e.target.value)
                        }
                        rows={3}
                        placeholder="Enter provenance information"
                      />
                    </div>

                    <div>
                      <Label htmlFor="exhibitionHistory">
                        Exhibition History
                      </Label>
                      <Textarea
                        id="exhibitionHistory"
                        value={formData.exhibitionHistory || ""}
                        onChange={(e) =>
                          updateField("exhibitionHistory", e.target.value)
                        }
                        rows={3}
                        placeholder="Enter exhibition history"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="donated_by">Donated by</Label>
                        <DonorCombobox
                          organizationId={currentOrganizationId}
                          collectionId={collectionId}
                          value={formData.donated_by || []}
                          onValueChange={(value) => {
                            updateField("donated_by", value);
                            // Auto-set date to today if donor is selected and no date exists
                            if (value.length > 0 && !formData.donated_date) {
                              const today = new Date();
                              updateField(
                                "donated_date",
                                today.toISOString().split("T")[0] ?? "",
                              );
                            }
                          }}
                          placeholder="Select or add donors..."
                        />
                      </div>

                      <div>
                        <Label htmlFor="donated_date">
                          Donated Date
                          {(formData.donated_by || []).length > 0 && (
                            <span className="text-red-500">*</span>
                          )}
                        </Label>
                        <NaturalLanguageDatePicker
                          id="donated_date"
                          value={formData.donated_date}
                          onChange={(value: string) =>
                            updateField("donated_date", value)
                          }
                          placeholder="today"
                          defaultDate={new Date()}
                          required={(formData.donated_by || []).length > 0}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="donation_info">
                        Info about the Donation
                      </Label>
                      <Textarea
                        id="donation_info"
                        value={formData.donation_info || ""}
                        onChange={(e) =>
                          updateField("donation_info", e.target.value)
                        }
                        rows={3}
                        placeholder="Information about the donation circumstances, conditions, or context"
                      />
                    </div>

                    <div>
                      <RepeatableTextField
                        label="Previous Owner(s)"
                        value={formData.previous_owners || []}
                        onChange={(values) =>
                          updateField("previous_owners", values)
                        }
                        placeholder="e.g., Estate of Jane Doe"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-base font-semibold">
                      Ownership History
                    </h3>
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
                  <p className="mb-4 text-xs text-muted-foreground">
                    Document the chain of ownership for this object
                  </p>
                  {(formData.ownershipHistory || []).length === 0 ? (
                    <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border">
                      <p className="text-sm text-muted-foreground">
                        No ownership history recorded
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(formData.ownershipHistory || []).map((entry, index) => (
                        <div
                          key={`ownership-${entry.owner || ""}-${entry.startYear || ""}-${index}`}
                          className="relative rounded-lg border border-border bg-secondary/20 p-4"
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-2 top-2 h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              const updated = [
                                ...(formData.ownershipHistory || []),
                              ];
                              updated.splice(index, 1);
                              updateField("ownershipHistory", updated);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <div className="grid gap-3">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                              <div className="md:col-span-1">
                                <Label htmlFor={`owner-${index}`}>
                                  Owner <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  id={`owner-${index}`}
                                  value={entry.owner}
                                  onChange={(e) => {
                                    const updated = [
                                      ...(formData.ownershipHistory || []),
                                    ];
                                    updated[index] = {
                                      ...entry,
                                      owner: e.target.value,
                                    };
                                    updateField("ownershipHistory", updated);
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
                                  onChange={(e) => {
                                    const updated = [
                                      ...(formData.ownershipHistory || []),
                                    ];
                                    updated[index] = {
                                      ...entry,
                                      startYear: e.target.value,
                                    };
                                    updateField("ownershipHistory", updated);
                                  }}
                                  placeholder="e.g., 1920"
                                />
                              </div>
                              <div>
                                <Label htmlFor={`endYear-${index}`}>To</Label>
                                <Input
                                  id={`endYear-${index}`}
                                  value={entry.endYear || ""}
                                  onChange={(e) => {
                                    const updated = [
                                      ...(formData.ownershipHistory || []),
                                    ];
                                    updated[index] = {
                                      ...entry,
                                      endYear: e.target.value,
                                    };
                                    updateField("ownershipHistory", updated);
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
                                onChange={(e) => {
                                  const updated = [
                                    ...(formData.ownershipHistory || []),
                                  ];
                                  updated[index] = {
                                    ...entry,
                                    description: e.target.value,
                                  };
                                  updateField("ownershipHistory", updated);
                                }}
                                rows={2}
                                placeholder="How was it acquired, any relevant details..."
                              />
                            </div>
                            <div className="flex flex-wrap items-center gap-4">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`verified-${index}`}
                                  checked={entry.verified ?? false}
                                  onCheckedChange={(checked) => {
                                    const updated = [
                                      ...(formData.ownershipHistory || []),
                                    ];
                                    updated[index] = {
                                      ...entry,
                                      verified: checked === true,
                                    };
                                    updateField("ownershipHistory", updated);
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
                              {entry.verified && (
                                <div className="flex-1">
                                  <Input
                                    value={entry.verificationSource || ""}
                                    onChange={(e) => {
                                      const updated = [
                                        ...(formData.ownershipHistory || []),
                                      ];
                                      updated[index] = {
                                        ...entry,
                                        verificationSource: e.target.value,
                                      };
                                      updateField("ownershipHistory", updated);
                                    }}
                                    placeholder="Verification source (e.g., auction records, provenance research)"
                                    className="h-8 text-sm"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Links Section */}
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="mb-3 text-base font-semibold">Links</h3>
                  <div className="space-y-3">
                    {(formData.links || []).map((link, index) => (
                      <div
                        key={`${link.url}-${link.label || ""}-${index}`}
                        className="flex gap-2"
                      >
                        <div className="flex-1">
                          <Label htmlFor={`link-url-${index}`}>
                            URL{" "}
                            {index === 0 ? (
                              ""
                            ) : (
                              <span className="text-red-500">*</span>
                            )}
                          </Label>
                          <Input
                            id={`link-url-${index}`}
                            type="url"
                            value={link.url}
                            onChange={(e) => {
                              const newLinks = [...(formData.links || [])];
                              newLinks[index] = {
                                ...newLinks[index],
                                url: e.target.value,
                              };
                              updateField("links", newLinks);
                            }}
                            onBlur={(e) => {
                              const newLinks = [...(formData.links || [])];
                              if (e.target.value && !newLinks[index]?.label) {
                                newLinks[index] = {
                                  url: newLinks[index]?.url || "",
                                  label: e.target.value,
                                };
                                updateField("links", newLinks);
                              }
                            }}
                            placeholder="https://example.com"
                            required={index > 0}
                          />
                        </div>
                        <div className="flex-1">
                          <Label htmlFor={`link-label-${index}`}>Label</Label>
                          <Input
                            id={`link-label-${index}`}
                            value={link.label || ""}
                            onChange={(e) => {
                              const newLinks = [...(formData.links || [])];
                              newLinks[index] = {
                                url: newLinks[index]?.url || "",
                                label: e.target.value,
                              };
                              updateField("links", newLinks);
                            }}
                            placeholder="Link name (optional)"
                          />
                        </div>
                        {(formData.links || []).length > 1 && (
                          <div className="flex items-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const newLinks = [...(formData.links || [])];
                                newLinks.splice(index, 1);
                                updateField("links", newLinks);
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
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
                </div>

                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="mb-4 text-sm font-semibold">
                    Visibility Settings
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="isPubliclyVisible">
                          Public Visibility
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Allow this object to appear in public catalogs
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
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="isHighResDownloadable">
                          High-Resolution Downloads
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Allow public users to download high-resolution images
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
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-between gap-4">
                  <PermissionGate permission="collections.approve_deaccession">
                    {collection.status === "active" && !hasActiveLoan && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeaccessionDialogOpen(true)}
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        Deaccession Object
                      </Button>
                    )}
                    {collection.status === "active" && hasActiveLoan && (
                      <div
                        className="flex items-center text-xs text-muted-foreground"
                        title="Cannot deaccession - item is on active loan"
                      >
                        <AlertOctagon className="mr-2 h-4 w-4" />
                        Cannot deaccession (On Loan)
                      </div>
                    )}
                  </PermissionGate>

                  <div className="flex gap-4 ml-auto">
                    <Button type="button" variant="outline" asChild>
                      <Link href={`/objects/${collectionId}`}>Cancel</Link>
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      <Save className="mr-2 h-4 w-4" />
                      {isSubmitting ? "Updating..." : "Update Object"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Right column - Media Uploader */}
              <div className="w-96 flex-shrink-0">
                <div className="sticky top-4 space-y-4">
                  {/* Image Upload Section */}
                  <div className="rounded-lg border border-border bg-card p-4">
                    <h3 className="mb-3 text-base font-semibold">
                      Image Upload
                    </h3>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      multiple
                    />

                    <Button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full mb-4"
                      variant="outline"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Images
                    </Button>

                    {images && images.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {images.map((file) => (
                          <div
                            key={file._id}
                            className="group relative aspect-square overflow-hidden rounded-md border bg-card"
                          >
                            {file.url && file.fileType === "image" && (
                              <>
                                <Image
                                  src={file.url}
                                  alt={file.fileName}
                                  fill
                                  sizes="128px"
                                  className="object-cover"
                                />

                                {/* Hover overlay */}
                                <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                                  {!file.isPrimary && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => handleSetPrimary(file._id)}
                                      title="Set as primary"
                                    >
                                      <Star className="h-3 w-3" />
                                    </Button>
                                  )}
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleDelete(file._id)}
                                    title="Delete"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>

                                {/* Primary badge */}
                                {file.isPrimary && (
                                  <div className="absolute top-1 right-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                                    Primary
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed">
                        <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          No images uploaded
                        </p>
                      </div>
                    )}

                    {images.length > 0 && (
                      <p className="mt-3 text-center text-xs text-muted-foreground">
                        {images.length}{" "}
                        {images.length === 1 ? "image" : "images"}
                      </p>
                    )}
                  </div>

                  {/* Document Upload Section */}
                  <div className="rounded-lg border border-border bg-card p-4">
                    <h3 className="mb-3 text-base font-semibold">
                      Document Upload
                    </h3>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Upload related documents (PDFs, scanned images, etc.)
                    </p>

                    <input
                      ref={documentInputRef}
                      type="file"
                      accept=".pdf,image/jpeg,image/jpg,image/png,image/tiff"
                      onChange={handleDocumentSelect}
                      className="hidden"
                      multiple
                    />

                    <Button
                      type="button"
                      onClick={() => documentInputRef.current?.click()}
                      className="w-full mb-4"
                      variant="outline"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Documents
                    </Button>

                    {documents.length > 0 ? (
                      <div className="space-y-2">
                        {documents.map((doc) => (
                          <div
                            key={doc._id}
                            className="flex items-center justify-between rounded-md border bg-card p-2 text-sm"
                          >
                            <span className="truncate">{doc.fileName}</span>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(doc._id)}
                              title="Delete"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        <p className="mt-2 text-center text-xs text-muted-foreground">
                          {documents.length}{" "}
                          {documents.length === 1 ? "document" : "documents"}
                        </p>
                      </div>
                    ) : (
                      <div className="flex h-20 flex-col items-center justify-center rounded-lg border border-dashed">
                        <p className="text-xs text-muted-foreground">
                          No documents uploaded
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
      <DeaccessionDialog
        open={deaccessionDialogOpen}
        onOpenChange={setDeaccessionDialogOpen}
        collectionId={collectionId as Id<"collections">}
        collectionTitle={collection.title}
        organizationId={collection.organizationId}
      />
    </div>
  );
}
