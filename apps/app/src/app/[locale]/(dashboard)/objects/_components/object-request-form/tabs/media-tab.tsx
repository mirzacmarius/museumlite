"use client";

import { CollectionGroupCombobox } from "@/components/collection-group-combobox";
import { CollectionTypeSelector } from "@/components/collection-type-selector";
import { ConditionCombobox } from "@/components/condition-combobox";
import { DonationDetailsField } from "@/components/donation-details-field";
import { LocationSelector } from "@/components/location-selector";
import { MaterialsCombobox } from "@/components/materials-combobox";
import { ObjectCombobox } from "@/components/object-combobox";
import { RepeatableTextField } from "@/components/repeatable-text-field";
import { TypeCombobox } from "@/components/type-combobox";
import type { useFeatureAccess } from "@/hooks/use-feature-access";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
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
import { Camera, CheckCircle, Plus, Star, Upload, X } from "lucide-react";
import Image from "next/image";
import type React from "react";
import { ACQUISITION_METHODS } from "../../collection-form-shared/constants";
import { EditSection } from "../../collection-form-shared/edit-section";
import type {
  CollectionFormTabProps,
  DraftMediaItem,
  OwnershipEntry,
} from "../../collection-form-shared/types";

export interface ObjectRequestMediaTabProps extends CollectionFormTabProps {
  common: (key: string) => string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  cameraInputRef: React.RefObject<HTMLInputElement | null>;
  documentInputRef: React.RefObject<HTMLInputElement | null>;
  selectedFiles: Array<{
    id: string;
    file: File;
    previewUrl: string;
    isPrimary: boolean;
  }>;
  selectedDocuments: Array<{ id: string; file: File; fileName: string }>;
  persistedDraftMedia: DraftMediaItem[];
  handleFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleDocumentSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleSetPrimary: (fileId: string) => void;
  handleDeleteImage: (fileId: string) => void;
  handleDeleteDocument: (docId: string) => void;
}

export function ObjectRequestMediaTab({
  formData,
  updateField,
  placeholders,
  currentOrganizationId,
  isLocationTrackingEnabled,
  common,
  fileInputRef,
  cameraInputRef,
  documentInputRef,
  selectedFiles,
  selectedDocuments,
  persistedDraftMedia,
  handleFileSelect,
  handleDocumentSelect,
  handleSetPrimary,
  handleDeleteImage,
  handleDeleteDocument,
}: ObjectRequestMediaTabProps) {
  return (
    <div className="space-y-8">
      <EditSection
        title="Images"
        description="Select images for the object and choose which one becomes primary after approval."
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

        {persistedDraftMedia.filter((item) => item.mediaCategory === "image")
          .length > 0 ? (
          <div className="mb-5 space-y-3">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Already attached
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {persistedDraftMedia.flatMap((item) =>
                item.mediaCategory === "image"
                  ? [
                      <div
                        key={item.storageId}
                        className="overflow-hidden rounded-xl border border-border/60 bg-background/70"
                      >
                        {item.url ? (
                          <img
                            src={item.url}
                            alt={item.fileName}
                            className="aspect-square w-full object-cover"
                          />
                        ) : null}
                        <div className="px-4 py-3">
                          <p className="truncate text-sm font-medium text-foreground">
                            {item.fileName}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.isPrimary
                              ? "Primary image already saved"
                              : "Saved with this draft"}
                          </p>
                        </div>
                      </div>,
                    ]
                  : [],
              )}
            </div>
          </div>
        ) : null}

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

                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gray-950/65 p-3 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="truncate text-xs text-white">
                    {file.file.name}
                  </div>
                  <div className="flex items-center gap-1">
                    {!file.isPrimary ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="size-8"
                        onClick={() => handleSetPrimary(file.id)}
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
                      onClick={() => handleDeleteImage(file.id)}
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
              {persistedDraftMedia.some(
                (item) => item.mediaCategory === "image",
              )
                ? "No new images selected yet."
                : "No images selected yet."}
            </p>
          </div>
        )}
      </EditSection>

      <EditSection
        title="Documents"
        description="Attach supporting PDFs, scans, and reference files to upload when this request is submitted."
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

        {persistedDraftMedia.filter((item) => item.mediaCategory === "document")
          .length > 0 ? (
          <div className="mb-5 space-y-3">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Already attached
            </p>
            <div className="space-y-3">
              {persistedDraftMedia.flatMap((item) =>
                item.mediaCategory === "document"
                  ? [
                      <div
                        key={item.storageId}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/70 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {item.fileName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Saved with this draft
                          </p>
                        </div>
                      </div>,
                    ]
                  : [],
              )}
            </div>
          </div>
        ) : null}

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
                    Queued for upload on submit
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDeleteDocument(document.id)}
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
              {persistedDraftMedia.some(
                (item) => item.mediaCategory === "document",
              )
                ? "No new documents selected yet."
                : "No documents selected yet."}
            </p>
          </div>
        )}
      </EditSection>
    </div>
  );
}
