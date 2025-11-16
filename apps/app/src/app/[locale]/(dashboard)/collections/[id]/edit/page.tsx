"use client";

import { Header } from "@/app/[locale]/(dashboard)/_components/header";
import { ConditionCombobox } from "@/components/condition-combobox";
import { LocationSelector } from "@/components/location-selector";
import { MaterialsCombobox } from "@/components/materials-combobox";
import { TypeCombobox } from "@/components/type-combobox";
import { RepeatableTextField } from "@/components/repeatable-text-field";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { DatePicker } from "@v1/ui/date-picker";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  TagsInput,
  TagsInputInput,
  TagsInputItem,
  TagsInputLabel,
  TagsInputList,
} from "@v1/ui/tags-input";
import { Textarea } from "@v1/ui/textarea";
import { useUploadFiles } from "@xixixao/uploadstuff/react";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Save, Star, Upload, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useRef, useState } from "react";

interface CollectionFormData {
  title: string;
  creator?: string;
  objectType?: string | string[]; // Can be string or array depending on state
  objectName?: string;
  culture?: string;
  period?: string;
  dateCreated?: string;
  materials?: string | string[]; // Can be string or array depending on state
  dimensions?: string;
  description?: string;
  condition?: string;
  provenance?: string;
  exhibitionHistory?: string;
  donated_by?: string[];
  donated_date?: string;
  donation_info?: string;
  previous_owners?: string[];
  currentLocationId?: string;
  alternateAccessionNumbers?: string[];
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
  const images = media?.filter((m) => (m as any).mediaCategory === "image" || !(m as any).mediaCategory) || [];
  const documents = media?.filter((m) => (m as any).mediaCategory === "document") || [];

  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<File[]>([]);
  const documentsRef = useRef<File[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    currentLocationId: "",
    alternateAccessionNumbers: [],
  });

  // Upload handling
  const { startUpload } = useUploadFiles(
    async () => {
      if (!currentOrganizationId) {
        throw new Error("Organization missing");
      }

      const file = filesRef.current.shift();
      if (!file) {
        throw new Error("No file available for upload");
      }

      const result = await generateUploadUrl({
        organizationId: currentOrganizationId as Id<"organizations">,
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

          if (!currentOrganizationId) {
            setError("Organization not found");
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
                organizationId: currentOrganizationId as Id<"organizations">,
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

  // Document upload handling
  const { startUpload: startDocumentUpload } = useUploadFiles(
    async () => {
      if (!currentOrganizationId) {
        throw new Error("Organization missing");
      }

      const file = documentsRef.current.shift();
      if (!file) {
        throw new Error("No file available for upload");
      }

      const result = await generateUploadUrl({
        organizationId: currentOrganizationId as Id<"organizations">,
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

          if (!currentOrganizationId) {
            setError("Organization not found");
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
                organizationId: currentOrganizationId as Id<"organizations">,
                collectionId: collectionId as Id<"collections">,
                storageId: storageId,
                fileName: file.name || "unknown",
                fileSize: file.size || 0,
                mimeType: file.type || "application/octet-stream",
                isPrimary: false, // Documents are never primary
                mediaCategory: "document",
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
            : "Document upload failed",
        );
      },
    },
  );

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
        currentLocationId: collection.currentLocationId || "",
        alternateAccessionNumbers: collection.alternateAccessionNumbers || [],
      });
    }
  }, [collection]);

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to edit collections.
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

  const handleDocumentSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
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

      documentsRef.current = [...files];
      startDocumentUpload(files);

      if (documentInputRef.current) {
        documentInputRef.current.value = "";
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to process document selection",
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
        currentLocationId: formData.currentLocationId
          ? (formData.currentLocationId as Id<"locations">)
          : undefined,
        alternateAccessionNumbers: formData.alternateAccessionNumbers,
      });
      router.push(`/collections/${collectionId}`);
    } catch (err) {
      console.error("Error updating collection:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update collection. Please try again.",
      );
      setIsSubmitting(false);
    }
  };

  const updateField = (
    field: keyof CollectionFormData,
    value: string | string[],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <Header
        title="Edit Collection"
        description={`Editing: ${collection.title}`}
      />
      <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
        <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
          <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
            <div className="flex w-full items-center justify-between rounded-lg p-6">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/collections/${collectionId}`}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Link>
                </Button>
                <h2 className="text-xl font-medium text-primary">
                  Edit Collection
                </h2>
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
                        <Label htmlFor="accessionNumber">
                          Accession Number
                        </Label>
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

                      <div className="md:col-span-2 lg:col-span-3">
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
                          Historical accession numbers previously assigned to
                          this object
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="objectType">Object Type</Label>
                        <TypeCombobox
                          organizationId={currentOrganizationId}
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
                        <Label htmlFor="culture">Culture</Label>
                        <Input
                          id="culture"
                          value={formData.culture || ""}
                          onChange={(e) =>
                            updateField("culture", e.target.value)
                          }
                          placeholder="e.g., French"
                        />
                      </div>

                      <div>
                        <Label htmlFor="period">Period</Label>
                        <Input
                          id="period"
                          value={formData.period || ""}
                          onChange={(e) =>
                            updateField("period", e.target.value)
                          }
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
                          onChange={(e) =>
                            updateField("creator", e.target.value)
                          }
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
                          organizationId={currentOrganizationId}
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
                          organizationId={currentOrganizationId}
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
                      <Label htmlFor="currentLocationId">
                        Current Location
                      </Label>
                      <LocationSelector
                        organizationId={currentOrganizationId}
                        value={formData.currentLocationId}
                        onValueChange={(value) =>
                          updateField("currentLocationId", value)
                        }
                        placeholder="Select a location (optional)"
                      />
                    </div>
                  </div>

                  {/* Historical Information Section */}
                  <div className="rounded-lg border border-border bg-card p-4">
                    <h3 className="mb-3 text-base font-semibold">
                      Historical Information
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
                          <RepeatableTextField
                            label="Donated by"
                            value={formData.donated_by || []}
                            onChange={(values) =>
                              updateField("donated_by", values)
                            }
                            placeholder="e.g., John Smith Foundation"
                          />
                        </div>

                        <div>
                          <Label htmlFor="donated_date">Donated Date</Label>
                          <DatePicker
                            date={formData.donated_date ? new Date(formData.donated_date) : undefined}
                            onSelect={(date) => {
                              const dateString: string = date ? (date.toISOString().split('T')[0] ?? "") : "";
                              updateField("donated_date", dateString);
                            }}
                            placeholder="Select donation date"
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

                  {/* Form Actions */}
                  <div className="flex justify-end gap-4">
                    <Button type="button" variant="outline" asChild>
                      <Link href={`/collections/${collectionId}`}>Cancel</Link>
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      <Save className="mr-2 h-4 w-4" />
                      {isSubmitting ? "Updating..." : "Update Collection"}
                    </Button>
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
                                        onClick={() =>
                                          handleSetPrimary(file._id)
                                        }
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
      </div>
    </>
  );
}
