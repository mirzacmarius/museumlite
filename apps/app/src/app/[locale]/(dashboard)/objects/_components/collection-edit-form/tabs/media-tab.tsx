"use client";

import { CollectionGroupCombobox } from "@/components/collection-group-combobox";
import { ConditionCombobox } from "@/components/condition-combobox";
import { DonationDetailsField } from "@/components/donation-details-field";
import { LocationSelector } from "@/components/location-selector";
import { MaterialsCombobox } from "@/components/materials-combobox";
import { MediaEditorDialog } from "@/components/media-editor-dialog";
import { ObjectCombobox } from "@/components/object-combobox";
import { RepeatableTextField } from "@/components/repeatable-text-field";
import { TypeCombobox } from "@/components/type-combobox";
import type { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
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
import { cn } from "@v1/ui/utils";
import type { FunctionReturnType } from "convex/server";
import {
  AlertOctagon,
  Camera,
  CheckCircle,
  Edit,
  Image as ImageIcon,
  Plus,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type React from "react";
import { formatOwnershipDateRange } from "../../../[id]/_components/format-ownership-date-range";
import { ACQUISITION_METHODS } from "../../collection-form-shared/constants";
import { EditSection } from "../../collection-form-shared/edit-section";
import type {
  CollectionFormTabProps,
  LinkEntry,
  OwnershipEntry,
} from "../../collection-form-shared/types";
import {
  createLinkEntryLocalId,
  createOwnershipEntryLocalId,
  normalizeOptionalString,
} from "../../collection-form-shared/utils";

type CollectionDoc = NonNullable<
  FunctionReturnType<typeof api.collections.get>
>;
type MediaItem = NonNullable<FunctionReturnType<typeof api.media.list>>[number];

export interface CollectionEditMediaTabProps extends CollectionFormTabProps {
  collection: CollectionDoc;
  typedCollectionId: Id<"collections">;
  images: MediaItem[];
  documents: MediaItem[];
  common: (key: string) => string;
  t: (key: string) => string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  cameraInputRef: React.RefObject<HTMLInputElement | null>;
  documentInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleDocumentSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleSetPrimary: (mediaId: string) => void;
  handleDeleteMedia: (mediaId: string) => void;
  setEditingImageId: (id: Id<"mediaFiles"> | null) => void;
  hasConditionChanged: boolean;
  requiresConditionChangeNote: boolean;
  conditionChangeNote: string;
  onConditionChangeNoteChange: (value: string) => void;
}

export function CollectionEditMediaTab({
  formData,
  updateField,
  placeholders,
  currentOrganizationId,
  isLocationTrackingEnabled,
  collection,
  typedCollectionId,
  images,
  documents,
  common,
  t,
  fileInputRef,
  cameraInputRef,
  documentInputRef,
  handleFileSelect,
  handleDocumentSelect,
  handleSetPrimary,
  handleDeleteMedia,
  setEditingImageId,
  hasConditionChanged,
  requiresConditionChangeNote,
  conditionChangeNote,
  onConditionChangeNoteChange,
}: CollectionEditMediaTabProps) {
  return (
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
                        setEditingImageId(file._id as Id<"mediaFiles">)
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
  );
}
