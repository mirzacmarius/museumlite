"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import type { TransferStage } from "@v1/backend/convex/utils/transferStages";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { cn } from "@v1/ui/utils";
import type { FunctionReturnType } from "convex/server";
import { ArrowRightLeft } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import type { RefObject } from "react";
import {
  FieldError,
  fieldErrorProps,
} from "@/components/record-form/record-form-notices";
import { getCollectionStatusLabel } from "@/lib/record-enum-labels";
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

type CollectionDoc = NonNullable<
  FunctionReturnType<typeof api.collections.get>
>;

interface PendingMoveRequest {
  _id: string;
  stage: TransferStage;
  targetOrganizationName: string;
}

interface CollectionEditFormHeroProps {
  collection: CollectionDoc;
  formData: CollectionFormData;
  images: ObjectImageGalleryItem[];
  pendingMoveRequest?: PendingMoveRequest | null;
  placeholders: (key: string) => string;
  common: (key: string) => string;
  isLocationTrackingEnabled: boolean;
  locationSummary: string;
  collectionSummary: string;
  getStatusBadgeClass: (status: CollectionDoc["status"]) => string;
  onTitleChange: (value: string) => void;
  /** Why the title cannot be saved, if it cannot. */
  titleError?: string;
  onDescriptionChange: (value: string) => void;
  onTabSelect: (tabId: CollectionEditTabId) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  cameraInputRef: RefObject<HTMLInputElement | null>;
  handleFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function CollectionEditFormHero({
  collection,
  formData,
  images,
  pendingMoveRequest,
  placeholders,
  common,
  isLocationTrackingEnabled,
  locationSummary,
  collectionSummary,
  getStatusBadgeClass,
  onTitleChange,
  titleError,
  onDescriptionChange,
  onTabSelect,
  fileInputRef,
  cameraInputRef,
  handleFileSelect,
}: CollectionEditFormHeroProps) {
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
          {pendingMoveRequest ? (
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-blue-100">
                    <ArrowRightLeft className="size-4" />
                    {pendingMoveRequest.stage === "waiting_for_receiver"
                      ? tRoot(
                          "untranslatedRecords.objects.transfer.awaitingAcceptance",
                        )
                      : tRoot(
                          "untranslatedRecords.objects.transfer.pendingApproval",
                        )}
                  </div>
                  <p className="text-sm text-blue-200/80">
                    {tRoot("untranslatedRecords.objects.move.thisObject")}{" "}
                    {pendingMoveRequest.stage === "waiting_for_receiver"
                      ? tRoot(
                          "untranslatedRecords.objects.transfer.awaitingAcceptanceShort",
                        )
                      : tRoot(
                          "untranslatedRecords.objects.transfer.awaitingApprovalShort",
                        )}{" "}
                    {tRoot("untranslatedRecords.objects.move.toMove")}{" "}
                    {pendingMoveRequest.targetOrganizationName}.
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={`/objects/move-requests/${pendingMoveRequest._id}`}
                  >
                    {tRoot("untranslatedRecords.objects.move.openTransfer")}
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
              {getCollectionStatusLabel(collection.status, tRoot)}
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
              {tRoot("untranslatedRecords.objects.form.objectTitle")}
            </Label>
            <Input
              id="hero-title"
              value={formData.title}
              onChange={(event) => onTitleChange(event.target.value)}
              {...fieldErrorProps("title", titleError)}
              placeholder={placeholders("title")}
              className="h-14 border-border/60 bg-background/90 text-xl font-semibold sm:text-2xl"
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

          <ObjectFormSummaryCards
            creator={formData.creator}
            dateCreated={formData.dateCreated}
            dateCreatedEdtf={formData.dateCreatedEdtf}
            locationSummary={locationSummary}
            collectionSummary={collectionSummary}
            isLocationTrackingEnabled={isLocationTrackingEnabled}
            unknownLabel={common("unknown")}
            onTabSelect={onTabSelect}
          />

          <p className="text-sm text-muted-foreground">
            {tRoot("untranslatedRecords.objects.form.editRecordDescription")}
          </p>
        </div>
      </div>
    </div>
  );
}
