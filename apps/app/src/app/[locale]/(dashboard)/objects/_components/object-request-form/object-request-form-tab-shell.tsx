"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { isCollectionModuleId } from "@v1/backend/convex/utils/moduleCatalog";
import { Button } from "@v1/ui/button";
import type { RefObject } from "react";
import { useI18n } from "@/locales/client";
import type { ObjectTabDefinition } from "../../[id]/_components/object-tab-config";
import { CollectionEditAccessionTab } from "../collection-edit-form/tabs/accession-tab";
import { CollectionEditDigitalTab } from "../collection-edit-form/tabs/digital-tab";
import { CollectionEditGeneralTab } from "../collection-edit-form/tabs/general-tab";
import { CollectionEditPhysicalTab } from "../collection-edit-form/tabs/physical-tab";
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
import { ObjectRequestTypeDetailsTab } from "./tabs/type-details-tab";

interface ObjectRequestTab {
  id: CollectionEditTabId;
  label: ObjectTabDefinition["label"];
}

interface ObjectRequestFormTabShellProps {
  mode: "create" | "draft-edit";
  error: string | null;
  tabs: ObjectRequestTab[];
  activeTab: CollectionEditTabId;
  onTabSelect: (tabId: CollectionEditTabId) => void;
  formData: CollectionFormData;
  updateField: UpdateCollectionFormField;
  placeholders: (key: string) => string;
  currentOrganizationId: Id<"organizations">;
  identifierAccessionId?: Id<"accessions">;
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
  mode,
  error,
  tabs,
  activeTab,
  onTabSelect,
  formData,
  updateField,
  placeholders,
  currentOrganizationId,
  identifierAccessionId,
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
  const tRoot = useI18n();
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
            {tRoot(tab.label)}
          </Button>
        ))}
      </div>

      <div className="rounded-2xl border border-border/60 bg-background/70 px-5 py-6 shadow-sm sm:px-8 sm:py-8">
        <div className="rounded-2xl border border-border/60 bg-background/70 px-5 py-6 shadow-sm sm:px-8 sm:py-8">
          {activeTab === "general" ? (
            mode === "draft-edit" && !identifierAccessionId ? (
              <CollectionEditGeneralTab {...tabProps} />
            ) : (
              <ObjectRequestGeneralTab
                {...tabProps}
                enabledModules={enabledModules}
                identifierAccessionId={identifierAccessionId}
              />
            )
          ) : null}
          {isCollectionModuleId(activeTab) ? (
            <ObjectRequestTypeDetailsTab
              collectionType={activeTab}
              formData={formData}
              updateField={updateField}
            />
          ) : null}
          {activeTab === "accession" ? (
            mode === "draft-edit" ? (
              <CollectionEditAccessionTab {...tabProps} />
            ) : (
              <ObjectRequestAccessionTab {...tabProps} />
            )
          ) : null}
          {activeTab === "provenance" ? (
            <ObjectRequestProvenanceTab
              {...tabProps}
              catalogPresentation={mode === "draft-edit"}
            />
          ) : null}
          {activeTab === "placement" ? (
            <ObjectRequestPlacementTab {...tabProps} />
          ) : null}
          {activeTab === "physical" ? (
            mode === "draft-edit" ? (
              <CollectionEditPhysicalTab {...tabProps} />
            ) : (
              <ObjectRequestPhysicalTab {...tabProps} />
            )
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
            mode === "draft-edit" ? (
              <CollectionEditDigitalTab {...tabProps} />
            ) : (
              <ObjectRequestDigitalTab {...tabProps} />
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
