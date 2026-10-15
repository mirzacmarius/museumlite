"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import type { FunctionReturnType } from "convex/server";
import type React from "react";
import type { ReactNode, RefObject } from "react";
import { useCurrentLocale, useI18n } from "@/locales/client";
import type { ObjectTabDefinition } from "../../[id]/_components/object-tab-config";
import { ValuationTab } from "../../[id]/_components/valuation-tab";
import type {
  CollectionEditTabId,
  CollectionFormData,
  OwnershipEntry,
  UpdateCollectionFormField,
} from "../collection-form-shared/types";
import { CollectionEditAccessionTab } from "./tabs/accession-tab";
import { CollectionEditDigitalTab } from "./tabs/digital-tab";
import { CollectionEditGeneralTab } from "./tabs/general-tab";
import type { CollectionEditMediaTabProps } from "./tabs/media-tab";
import { CollectionEditMediaTab } from "./tabs/media-tab";
import { CollectionEditPhysicalTab } from "./tabs/physical-tab";
import { CollectionEditPlacementTab } from "./tabs/placement-tab";
import { CollectionEditProvenanceTab } from "./tabs/provenance-tab";

type CollectionDoc = NonNullable<
  FunctionReturnType<typeof api.collections.get>
>;

interface CollectionEditFormTab {
  id: CollectionEditTabId;
  label: ObjectTabDefinition["label"];
}

interface CollectionEditFormTabShellProps {
  error: string | null;
  /** Recovery, conflict and save notices for the record. */
  notices: ReactNode;
  fieldErrors: Record<string, string>;
  tabs: CollectionEditFormTab[];
  activeTab: CollectionEditTabId;
  onTabSelect: (tabId: CollectionEditTabId) => void;
  formData: CollectionFormData;
  updateField: UpdateCollectionFormField;
  placeholders: (key: string) => string;
  currentOrganizationId: Id<"organizations">;
  isLocationTrackingEnabled: boolean;
  collection: CollectionDoc;
  typedCollectionId: Id<"collections">;
  alternateAccessionDraft: string;
  onAlternateAccessionDraftChange: (value: string) => void;
  onAddAlternateAccessionNumber: () => void;
  onRemoveAlternateAccessionNumber: (index: number) => void;
  editingOwnershipEntryId: string | null;
  setEditingOwnershipEntryId: (id: string | null) => void;
  createOwnershipEntry: (
    entry: Omit<OwnershipEntry, "localId">,
  ) => OwnershipEntry;
  resolvedCurrentLocationId?: string;
  hasConditionChanged: boolean;
  requiresConditionChangeNote: boolean;
  conditionChangeNote: string;
  onConditionChangeNoteChange: (value: string) => void;
  images: CollectionEditMediaTabProps["images"];
  documents: CollectionEditMediaTabProps["documents"];
  common: (key: string) => string;
  t: (key: string) => string;
  documentInputRef: RefObject<HTMLInputElement | null>;
  handleDocumentSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSetPrimary: CollectionEditMediaTabProps["handleSetPrimary"];
  setEditingImageId: CollectionEditMediaTabProps["setEditingImageId"];
}

export function CollectionEditFormTabShell({
  error,
  notices,
  fieldErrors,
  tabs,
  activeTab,
  onTabSelect,
  formData,
  updateField,
  placeholders,
  currentOrganizationId,
  isLocationTrackingEnabled,
  collection,
  typedCollectionId,
  alternateAccessionDraft,
  onAlternateAccessionDraftChange,
  onAddAlternateAccessionNumber,
  onRemoveAlternateAccessionNumber,
  editingOwnershipEntryId,
  setEditingOwnershipEntryId,
  createOwnershipEntry,
  resolvedCurrentLocationId,
  hasConditionChanged,
  requiresConditionChangeNote,
  conditionChangeNote,
  onConditionChangeNoteChange,
  images,
  documents,
  common,
  t,
  documentInputRef,
  handleDocumentSelect,
  handleSetPrimary,
  setEditingImageId,
}: CollectionEditFormTabShellProps) {
  const tRoot = useI18n();
  const locale = useCurrentLocale();
  const tabProps = {
    formData,
    updateField,
    placeholders,
    currentOrganizationId,
    isLocationTrackingEnabled,
    fieldErrors,
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-6">{notices}</div>
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
            onClick={() => onTabSelect(tab.id)}
          >
            {tRoot(tab.label)}
          </Button>
        ))}
      </div>

      <div className="rounded-2xl border border-border/60 bg-background/70 px-5 py-6 shadow-sm sm:px-8 sm:py-8">
        <div className="rounded-2xl border border-border/60 bg-background/70 px-5 py-6 shadow-sm sm:px-8 sm:py-8">
          {activeTab === "general" ? (
            <CollectionEditGeneralTab
              {...tabProps}
              collection={collection}
              alternateAccessionDraft={alternateAccessionDraft}
              onAlternateAccessionDraftChange={onAlternateAccessionDraftChange}
              onAddAlternateAccessionNumber={onAddAlternateAccessionNumber}
              onRemoveAlternateAccessionNumber={
                onRemoveAlternateAccessionNumber
              }
              typedCollectionId={typedCollectionId}
            />
          ) : null}
          {activeTab === "accession" ? (
            <CollectionEditAccessionTab
              {...tabProps}
              typedCollectionId={typedCollectionId}
            />
          ) : null}
          {activeTab === "provenance" ? (
            <CollectionEditProvenanceTab
              {...tabProps}
              editingOwnershipEntryId={editingOwnershipEntryId}
              setEditingOwnershipEntryId={setEditingOwnershipEntryId}
              createOwnershipEntry={createOwnershipEntry}
            />
          ) : null}
          {activeTab === "valuation" ? (
            <ValuationTab
              mode="edit"
              collectionId={typedCollectionId}
              locale={locale}
            />
          ) : null}
          {activeTab === "placement" ? (
            <CollectionEditPlacementTab
              {...tabProps}
              collection={collection}
              typedCollectionId={typedCollectionId}
              resolvedCurrentLocationId={resolvedCurrentLocationId ?? ""}
            />
          ) : null}
          {activeTab === "physical" ? (
            <CollectionEditPhysicalTab
              {...tabProps}
              typedCollectionId={typedCollectionId}
            />
          ) : null}
          {activeTab === "media" ? (
            <CollectionEditMediaTab
              {...tabProps}
              collection={collection}
              typedCollectionId={typedCollectionId}
              images={images}
              documents={documents}
              common={common}
              t={t}
              documentInputRef={documentInputRef}
              handleDocumentSelect={handleDocumentSelect}
              handleSetPrimary={handleSetPrimary}
              setEditingImageId={setEditingImageId}
              hasConditionChanged={hasConditionChanged}
              requiresConditionChangeNote={requiresConditionChangeNote}
              conditionChangeNote={conditionChangeNote}
              onConditionChangeNoteChange={onConditionChangeNoteChange}
            />
          ) : null}
          {activeTab === "digital" ? (
            <CollectionEditDigitalTab {...tabProps} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
