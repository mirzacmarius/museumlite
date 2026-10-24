"use client";

import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import type * as React from "react";
import type { RefObject } from "react";
import {
  FieldError,
  fieldErrorProps,
} from "@/components/record-form/record-form-notices";
import { useI18n } from "@/locales/client";
import { ObjectFormSummaryCards } from "../collection-form-shared/object-form-summary-cards";
import {
  ObjectImageGallery,
  type ObjectImageGalleryItem,
} from "../collection-form-shared/object-image-gallery";
import type {
  CollectionEditTabId,
  CollectionFormData,
} from "../collection-form-shared/types";

interface ObjectRequestFormHeroProps {
  formData: CollectionFormData;
  images: ObjectImageGalleryItem[];
  pageBadge: string;
  isDraftCurrent: boolean;
  hasSavedFieldDraft: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  cameraInputRef: RefObject<HTMLInputElement | null>;
  handleFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  placeholders: (key: string) => string;
  onTitleChange: (value: string) => void;
  /** Why the title cannot be saved, if it cannot. */
  titleError?: string;
  onDescriptionChange: (value: string) => void;
  locationSummary: string;
  collectionSummary: string;
  isLocationTrackingEnabled: boolean;
  onTabSelect: (tabId: CollectionEditTabId) => void;
  unknownLabel: string;
  mode: "create" | "draft-edit";
}

export function ObjectRequestFormHero({
  formData,
  images,
  pageBadge,
  isDraftCurrent,
  hasSavedFieldDraft,
  fileInputRef,
  cameraInputRef,
  handleFileSelect,
  placeholders,
  onTitleChange,
  titleError,
  onDescriptionChange,
  locationSummary,
  collectionSummary,
  isLocationTrackingEnabled,
  onTabSelect,
  unknownLabel,
  mode,
}: ObjectRequestFormHeroProps) {
  const tRoot = useI18n();
  return (
    <div className="border-b border-border/60 bg-secondary/10 px-6 py-8 sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 lg:flex-row lg:items-start">
        <ObjectImageGallery
          images={images}
          fileInputRef={fileInputRef}
          cameraInputRef={cameraInputRef}
          onFileSelect={handleFileSelect}
        />

        <div className="flex-1 space-y-6">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-status-warning/10 text-status-warning-foreground dark:bg-amber-500/10 dark:text-amber-500">
              {pageBadge}
            </div>
            <div className="rounded bg-background/80 px-2 py-1 text-[10px] font-mono text-muted-foreground">
              {isDraftCurrent
                ? tRoot("untranslatedRecords.objects.draft.saved")
                : hasSavedFieldDraft
                  ? tRoot("untranslatedRecords.objects.draft.outdated")
                  : tRoot("untranslatedRecords.objects.draft.notCreated")}
            </div>
          </div>

          <div className="space-y-3">
            <Label
              htmlFor="hero-title"
              className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground"
            >
              {tRoot("untranslatedRecords.objects.form.objectTitle")}
            </Label>
            <Input
              id="hero-title"
              value={formData.title}
              onChange={(event) => onTitleChange(event.target.value)}
              {...fieldErrorProps("title", titleError)}
              placeholder={placeholders("title")}
              className="h-14 bg-background/90 text-xl font-semibold dark:border-border/60 sm:text-2xl"
              required
            />
            <FieldError field="title" message={titleError} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hero-description">
              {tRoot("objects.form.description")}
            </Label>
            <Textarea
              autoResize
              id="hero-description"
              value={formData.description || ""}
              onChange={(event) => onDescriptionChange(event.target.value)}
              rows={5}
              placeholder={placeholders("description")}
            />
          </div>

          {mode === "draft-edit" ? (
            <ObjectFormSummaryCards
              creator={formData.creator}
              dateCreated={formData.dateCreated}
              dateCreatedEdtf={formData.dateCreatedEdtf}
              locationSummary={locationSummary}
              collectionSummary={collectionSummary}
              isLocationTrackingEnabled={isLocationTrackingEnabled}
              unknownLabel={unknownLabel}
              onTabSelect={onTabSelect}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
