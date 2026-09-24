"use client";

import { Button } from "@v1/ui/button";
import type { RefObject } from "react";
import type {
  CollectionEditTabId,
  CollectionFormData,
  DraftMediaItem,
  UpdateCollectionFormField,
} from "../collection-form-shared/types";
import { ObjectRequestAccessionTab } from "./tabs/accession-tab";
import { ObjectRequestDigitalTab } from "./tabs/digital-tab";
import type { ObjectRequestGeneralTabProps } from "./tabs/general-tab";
import { ObjectRequestGeneralTab } from "./tabs/general-tab";
import type { ObjectRequestMediaTabProps } from "./tabs/media-tab";
import { ObjectRequestMediaTab } from "./tabs/media-tab";
import { ObjectRequestPhysicalTab } from "./tabs/physical-tab";
import { ObjectRequestPlacementTab } from "./tabs/placement-tab";
import { ObjectRequestProvenanceTab } from "./tabs/provenance-tab";

interface ObjectRequestTab {
  id: CollectionEditTabId;
  label: string;
}

interface ObjectRequestFormTabShellProps {
  error: string | null;
  tabs: ObjectRequestTab[];
  activeTab: CollectionEditTabId;
  onTabSelect: (tabId: CollectionEditTabId) => void;
  formData: CollectionFormData;
  updateField: UpdateCollectionFormField;
  placeholders: (key: string) => string;
  currentOrganizationId: string;
  isLocationTrackingEnabled: boolean;
  enabledModules: ObjectRequestGeneralTabProps["enabledModules"];
  common: (key: string) => string;
  documentInputRef: RefObject<HTMLInputElement | null>;
  selectedFiles: ObjectRequestMediaTabProps["selectedFiles"];
  selectedDocuments: ObjectRequestMediaTabProps["selectedDocuments"];
  persistedDraftMedia: DraftMediaItem[];
  handleDocumentSelect: ObjectRequestMediaTabProps["handleDocumentSelect"];
  handleSetPrimary: ObjectRequestMediaTabProps["handleSetPrimary"];
  handleDeleteImage: ObjectRequestMediaTabProps["handleDeleteImage"];
  handleDeleteDocument: ObjectRequestMediaTabProps["handleDeleteDocument"];
}

export function ObjectRequestFormTabShell({
  error,
  tabs,
  activeTab,
  onTabSelect,
  formData,
  updateField,
  placeholders,
  currentOrganizationId,
  isLocationTrackingEnabled,
  enabledModules,
  common,
  documentInputRef,
  selectedFiles,
  selectedDocuments,
  persistedDraftMedia,
  handleDocumentSelect,
  handleSetPrimary,
  handleDeleteImage,
  handleDeleteDocument,
}: ObjectRequestFormTabShellProps) {
  const tabProps = {
    formData,
    updateField,
    placeholders,
    currentOrganizationId,
    isLocationTrackingEnabled,
  };

  return (
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
            onClick={() => onTabSelect(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <div className="rounded-2xl border border-border/60 bg-background/70 px-5 py-6 shadow-sm sm:px-8 sm:py-8">
        <div className="rounded-2xl border border-border/60 bg-background/70 px-5 py-6 shadow-sm sm:px-8 sm:py-8">
          {activeTab === "general" ? (
            <ObjectRequestGeneralTab
              {...tabProps}
              enabledModules={enabledModules}
            />
          ) : null}
          {activeTab === "accession" ? (
            <ObjectRequestAccessionTab {...tabProps} />
          ) : null}
          {activeTab === "provenance" ? (
            <ObjectRequestProvenanceTab {...tabProps} />
          ) : null}
          {activeTab === "placement" ? (
            <ObjectRequestPlacementTab {...tabProps} />
          ) : null}
          {activeTab === "physical" ? (
            <ObjectRequestPhysicalTab {...tabProps} />
          ) : null}
          {activeTab === "media" ? (
            <ObjectRequestMediaTab
              {...tabProps}
              common={common}
              documentInputRef={documentInputRef}
              selectedFiles={selectedFiles}
              selectedDocuments={selectedDocuments}
              persistedDraftMedia={persistedDraftMedia}
              handleDocumentSelect={handleDocumentSelect}
              handleSetPrimary={handleSetPrimary}
              handleDeleteImage={handleDeleteImage}
              handleDeleteDocument={handleDeleteDocument}
            />
          ) : null}
          {activeTab === "digital" ? (
            <ObjectRequestDigitalTab {...tabProps} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
