"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
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

import { ConditionCombobox } from "@/components/condition-combobox";
import { DonorCombobox } from "@/components/donor-combobox";
import { LocationSelector } from "@/components/location-selector";
import { MaterialsCombobox } from "@/components/materials-combobox";
import { ObjectCombobox } from "@/components/object-combobox";
import { useOrganization } from "@/components/organization-provider";
import { RepeatableTextField } from "@/components/repeatable-text-field";
import { TypeCombobox } from "@/components/type-combobox";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { NaturalLanguageDatePicker } from "@v1/ui/natural-language-date-picker";
import { useMutation } from "convex/react";
import { ArrowLeft, Plus, Save, Star, Upload, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { useEffect, useRef, useState } from "react";

interface CollectionFormData {
  accessionNumber?: string;
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
  links?: Array<{ url: string; label?: string }>;
  parentObjectId?: string;
  currentLocationId?: string;
  collectionGroupId?: string;
  alternateAccessionNumbers?: string[];
}

export default function CollectionFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const collectionGroupId = searchParams.get("collectionGroupId");
  const { currentOrganizationId } = useOrganization();
  const createCollection = useMutation(api.collections.create);
  const generateUploadUrl = useMutation(api.media.generateUploadUrl);
  const createMedia = useMutation(api.media.create);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
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
    parentObjectId: "",
    currentLocationId: "",
    collectionGroupId: collectionGroupId || "",
    alternateAccessionNumbers: [],
  });

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      selectedFiles.forEach((file) => URL.revokeObjectURL(file.previewUrl));
    };
  }, [selectedFiles]);

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
          : "Failed to process document selection",
      );
    }
  };

  const handleDeleteDocument = (docId: string) => {
    setSelectedDocuments((prev) => prev.filter((item) => item.id !== docId));
  };

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
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to process file selection",
      );
    }
  };

  const handleSetPrimary = (fileId: string) => {
    setSelectedFiles((prev) =>
      prev.map((item) => ({
        ...item,
        isPrimary: item.id === fileId,
      })),
    );
  };

  const handleDelete = (fileId: string) => {
    setSelectedFiles((prev) => {
      const fileToDelete = prev.find((item) => item.id === fileId);
      if (fileToDelete) {
        URL.revokeObjectURL(fileToDelete.previewUrl);
      }
      return prev.filter((item) => item.id !== fileId);
    });
  };

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to create objects.
        </p>
      </div>
    );
  }

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

      // Step 1: Create the collection
      const collectionId = await createCollection({
        organizationId: currentOrganizationId,
        accessionNumber: formData.accessionNumber,
        title: formData.title,
        creator: formData.creator,
        objectType: objectTypeString,
        objectName: formData.objectName,
        culture: formData.culture,
        period: formData.period,
        dateCreated: formData.dateCreated,
        materials: materialsString,
        dimensions: formData.dimensions,
        description: formData.description,
        condition: formData.condition,
        provenance: formData.provenance,
        exhibitionHistory: formData.exhibitionHistory,
        donated_by: formData.donated_by,
        donated_date: formData.donated_date,
        donation_info: formData.donation_info,
        previous_owners: formData.previous_owners,
        links: formData.links?.filter((link) => link.url.trim() !== ""),
        alternateAccessionNumbers: formData.alternateAccessionNumbers,
        currentLocationId: formData.currentLocationId
          ? (formData.currentLocationId as Id<"locations">)
          : undefined,
        collectionGroupId: formData.collectionGroupId
          ? (formData.collectionGroupId as Id<"collectionGroups">)
          : undefined,
      });

      // Step 2: Upload all selected image files
      if (selectedFiles.length > 0) {
        for (const fileData of selectedFiles) {
          try {
            // Generate upload URL
            const uploadUrlResult = await generateUploadUrl({
              organizationId: currentOrganizationId as Id<"organizations">,
              collectionId: collectionId as Id<"collections">,
              fileName: fileData.file.name,
              fileSize: fileData.file.size,
              mimeType: fileData.file.type,
            });

            if (!uploadUrlResult.uploadUrl) {
              throw new Error(
                `Failed to generate upload URL for ${fileData.file.name}`,
              );
            }

            // Upload file to storage
            const uploadResponse = await fetch(uploadUrlResult.uploadUrl, {
              method: "POST",
              body: fileData.file,
            });

            if (!uploadResponse.ok) {
              throw new Error(`Failed to upload ${fileData.file.name}`);
            }

            const uploadResult = await uploadResponse.json();
            const storageId = uploadResult.storageId;

            if (!storageId) {
              throw new Error(
                `No storage ID returned for ${fileData.file.name}`,
              );
            }

            // Create media record for image
            await createMedia({
              organizationId: currentOrganizationId as Id<"organizations">,
              collectionId: collectionId as Id<"collections">,
              storageId: storageId,
              fileName: fileData.file.name,
              fileSize: fileData.file.size,
              mimeType: fileData.file.type,
              mediaCategory: "image",
              isPrimary: fileData.isPrimary,
            });
          } catch (uploadErr) {
            console.error(`Error uploading ${fileData.file.name}:`, uploadErr);
            // Continue with other files even if one fails
          }
        }
      }

      // Step 3: Upload all selected document files
      if (selectedDocuments.length > 0) {
        for (const docData of selectedDocuments) {
          try {
            // Generate upload URL
            const uploadUrlResult = await generateUploadUrl({
              organizationId: currentOrganizationId as Id<"organizations">,
              collectionId: collectionId as Id<"collections">,
              fileName: docData.file.name,
              fileSize: docData.file.size,
              mimeType: docData.file.type,
            });

            if (!uploadUrlResult.uploadUrl) {
              throw new Error(
                `Failed to generate upload URL for ${docData.file.name}`,
              );
            }

            // Upload file to storage
            const uploadResponse = await fetch(uploadUrlResult.uploadUrl, {
              method: "POST",
              body: docData.file,
            });

            if (!uploadResponse.ok) {
              throw new Error(`Failed to upload ${docData.file.name}`);
            }

            const uploadResult = await uploadResponse.json();
            const storageId = uploadResult.storageId;

            if (!storageId) {
              throw new Error(
                `No storage ID returned for ${docData.file.name}`,
              );
            }

            // Create media record for document
            await createMedia({
              organizationId: currentOrganizationId as Id<"organizations">,
              collectionId: collectionId as Id<"collections">,
              storageId: storageId,
              fileName: docData.file.name,
              fileSize: docData.file.size,
              mimeType: docData.file.type,
              mediaCategory: "document",
              isPrimary: false, // Documents are never primary
            });
          } catch (uploadErr) {
            console.error(`Error uploading ${docData.file.name}:`, uploadErr);
            // Continue with other files even if one fails
          }
        }
      }

      // Navigate to collections list or group detail if part of a group
      if (formData.collectionGroupId) {
        router.push(`/collections/${formData.collectionGroupId}`);
      } else {
        router.push("/objects");
      }
    } catch (err) {
      console.error("Error saving collection:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save object. Please try again.",
      );
      setIsSubmitting(false);
    }
  };

  const updateField = (
    field: keyof CollectionFormData,
    value: string | string[] | Array<{ url: string; label?: string }> | undefined,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
        <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
          <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
            <div className="flex w-full items-center justify-between rounded-lg p-6">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/objects">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Link>
                </Button>
                <h2 className="text-xl font-medium text-primary">New Object</h2>
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
                          value={formData.accessionNumber || ""}
                          onChange={(e) =>
                            updateField("accessionNumber", e.target.value)
                          }
                          placeholder="Auto-generated if empty"
                        />
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
                          Historical accession numbers previously assigned to
                          this object
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
                          organizationId={currentOrganizationId}
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

                  {/* Object Relationships Section */}
                  <div className="rounded-lg border border-border bg-card p-4">
                    <h3 className="mb-3 text-base font-semibold">
                      Object Relationships
                    </h3>
                    <div>
                      <Label htmlFor="parentObjectId">
                        Parent Object
                      </Label>
                      <p className="mb-2 text-xs text-muted-foreground">
                        Link this object to a parent object (e.g., a treasure chest containing this object)
                      </p>
                      <ObjectCombobox
                        organizationId={currentOrganizationId}
                        value={formData.parentObjectId}
                        onValueChange={(value) =>
                          updateField("parentObjectId", value)
                        }
                        placeholder="Select parent object (optional)"
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

                        <RepeatableTextField
                          label="Previous Owner(s)"
                          value={formData.previous_owners || []}
                          onChange={(value) =>
                            updateField("previous_owners", value)
                          }
                          placeholder="Enter previous owner name"
                          id="previous_owners"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            onChange={(value) =>
                              updateField("donated_date", value)
                            }
                            placeholder="today"
                            defaultDate={new Date()}
                            required={
                              (formData.donated_by || []).length > 0
                            }
                          />
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
                            placeholder="Context, circumstances, conditions, etc."
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Links Section */}
                  <div className="rounded-lg border border-border bg-card p-4">
                    <h3 className="mb-3 text-base font-semibold">Links</h3>
                    <div className="space-y-3">
                      {(formData.links || []).map((link, index) => (
                        <div key={`${link.url}-${link.label || ""}-${index}`} className="flex gap-2">
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
                          <div className="flex-1">
                            <Label htmlFor={`link-url-${index}`}>
                              URL {index === 0 ? "" : <span className="text-red-500">*</span>}
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
                              placeholder="https://example.com"
                              required={index > 0}
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

                  {/* Form Actions */}
                  <div className="flex justify-end gap-4">
                    <Button type="button" variant="outline" asChild>
                      <Link href="/objects">Cancel</Link>
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      <Save className="mr-2 h-4 w-4" />
                      {isSubmitting
                        ? selectedFiles.length > 0
                          ? "Creating and uploading..."
                          : "Creating..."
                        : "Create Object"}
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

                      {selectedFiles.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2">
                          {selectedFiles.map((file) => (
                            <div
                              key={file.id}
                              className="group relative aspect-square overflow-hidden rounded-md border bg-card"
                            >
                              <Image
                                src={file.previewUrl}
                                alt={file.file.name}
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
                                    onClick={() => handleSetPrimary(file.id)}
                                    title="Set as primary"
                                  >
                                    <Star className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDelete(file.id)}
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
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed">
                          <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">
                            No images selected
                          </p>
                        </div>
                      )}

                      {selectedFiles.length > 0 && (
                        <p className="mt-3 text-center text-xs text-muted-foreground">
                          {selectedFiles.length}{" "}
                          {selectedFiles.length === 1 ? "image" : "images"}
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

                      {selectedDocuments.length > 0 ? (
                        <div className="space-y-2">
                          {selectedDocuments.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between rounded-md border bg-card p-2 text-sm"
                            >
                              <span className="truncate">{doc.fileName}</span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteDocument(doc.id)}
                                title="Delete"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                          <p className="mt-2 text-center text-xs text-muted-foreground">
                            {selectedDocuments.length}{" "}
                            {selectedDocuments.length === 1
                              ? "document"
                              : "documents"}
                          </p>
                        </div>
                      ) : (
                        <div className="flex h-20 flex-col items-center justify-center rounded-lg border border-dashed">
                          <p className="text-xs text-muted-foreground">
                            No documents selected
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
  );
}
