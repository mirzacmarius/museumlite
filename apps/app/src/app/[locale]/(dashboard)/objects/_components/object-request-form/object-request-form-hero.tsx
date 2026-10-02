"use client";

import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";

import type * as React from "react";
import type { RefObject } from "react";
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
  locationSummary,
  collectionSummary,
  isLocationTrackingEnabled,
  onTabSelect,
  unknownLabel,
  mode,
}: ObjectRequestFormHeroProps) {
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
            <div className="rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500">
              {pageBadge}
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
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder={placeholders("title")}
              className="h-14 border-border/60 bg-background/90 text-xl font-semibold sm:text-2xl"
              required
            />
          </div>

          {mode === "draft-edit" ? (
            <ObjectFormSummaryCards
              creator={formData.creator}
              dateCreated={formData.dateCreated}
              locationSummary={locationSummary}
              collectionSummary={collectionSummary}
              isLocationTrackingEnabled={isLocationTrackingEnabled}
              unknownLabel={unknownLabel}
              onTabSelect={onTabSelect}
            />
          ) : null}

          <p className="text-sm text-muted-foreground">
            Build the record using the same tab structure as object detail and
            edit. Draft saves keep this object in the accession draft workflow
            until you explicitly submit it for approval. Images and documents
            are saved with the draft and submitted for approval with the object.
          </p>
        </div>
      </div>
    </div>
  );
}
