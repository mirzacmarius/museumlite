"use client";

import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";
import {
  ObjectRequestFormFooter,
  resolveObjectRequestFormFooterDraft,
  resolveObjectRequestFormFooterPhase,
} from "./object-request-form-footer";
import { ObjectRequestFormHeader } from "./object-request-form-header";
import { ObjectRequestFormHero } from "./object-request-form-hero";
import { ObjectRequestFormTabShell } from "./object-request-form-tab-shell";
import type { useObjectRequestForm } from "./use-object-request-form";

interface ObjectRequestFormLayoutProps {
  form: ReturnType<typeof useObjectRequestForm>;
}

export function ObjectRequestFormLayout({
  form,
}: ObjectRequestFormLayoutProps) {
  const {
    t,
    common,
    placeholders,
    formData,
    activeTab,
    setActiveTab,
    tabs,
    error,
    isSubmitting,
    isSavingDraft,
    pageTitle,
    resolvedBackHref,
    handleNavigate,
    handleSubmit,
    handleSaveDraft,
    selectedFiles,
    selectedDocuments,
    persistedDraftMedia,
    fileInputRef,
    cameraInputRef,
    documentInputRef,
    handleFileSelect,
    handleDocumentSelect,
    handleSetPrimary,
    handleDeleteImage,
    handleDeleteDocument,
    currentOrganizationId,
    isLocationTrackingEnabled,
    enabledModules,
    locationSummary,
    collectionSummary,
    updateField,
    isDraftCurrent,
    hasSavedFieldDraft,
    hasLocalMediaSelections,
    isFormDirty,
    showUnsavedDialog,
    setShowUnsavedDialog,
    handleDiscardAndNavigate,
    handleSaveAndNavigate,
    pageBadge,
    mode,
  } = form;

  const galleryImages = [
    ...selectedFiles.map((file) => ({
      id: file.id,
      src: file.previewUrl,
      alt: file.file.name,
      isPrimary: file.isPrimary,
    })),
    ...persistedDraftMedia.flatMap((item) =>
      item.mediaCategory === "image" && item.url
        ? [
            {
              id: item.storageId,
              src: item.url,
              alt: item.fileName,
              isPrimary: item.isPrimary,
            },
          ]
        : [],
    ),
  ];

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <ObjectRequestFormHeader
        t={t}
        common={common}
        pageTitle={pageTitle}
        resolvedBackHref={resolvedBackHref}
        isSubmitting={isSubmitting}
        isSavingDraft={isSavingDraft}
        selectedFileCount={selectedFiles.length}
        selectedDocumentCount={selectedDocuments.length}
        onNavigate={handleNavigate}
        onSaveDraft={() => void handleSaveDraft({ redirectToDetail: true })}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <form id="object-create-form" onSubmit={handleSubmit}>
          <ObjectRequestFormHero
            formData={formData}
            images={galleryImages}
            pageBadge={pageBadge}
            isDraftCurrent={isDraftCurrent}
            hasSavedFieldDraft={hasSavedFieldDraft}
            fileInputRef={fileInputRef}
            cameraInputRef={cameraInputRef}
            handleFileSelect={handleFileSelect}
            placeholders={placeholders}
            onTitleChange={(value) => updateField("title", value)}
            onDescriptionChange={(value) => updateField("description", value)}
            locationSummary={locationSummary}
            collectionSummary={collectionSummary}
            isLocationTrackingEnabled={isLocationTrackingEnabled}
            onTabSelect={setActiveTab}
            unknownLabel={common("unknown")}
            mode={mode}
          />

          <ObjectRequestFormTabShell
            mode={mode}
            error={error}
            tabs={tabs}
            activeTab={activeTab}
            onTabSelect={setActiveTab}
            formData={formData}
            updateField={updateField}
            placeholders={placeholders}
            currentOrganizationId={currentOrganizationId ?? ""}
            isLocationTrackingEnabled={isLocationTrackingEnabled}
            enabledModules={enabledModules}
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
        </form>
      </div>

      <ObjectRequestFormFooter
        phase={resolveObjectRequestFormFooterPhase({
          error,
          isSubmitting,
          isSavingDraft,
          hasUploads: selectedFiles.length > 0 || selectedDocuments.length > 0,
        })}
        draft={resolveObjectRequestFormFooterDraft({
          hasSavedFieldDraft,
          hasLocalMediaSelections,
          isDraftCurrent,
          isFormDirty,
        })}
        resolvedBackHref={resolvedBackHref}
        common={common}
        onNavigate={handleNavigate}
        onSaveDraft={() => void handleSaveDraft({ redirectToDetail: true })}
      />

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onDiscard={handleDiscardAndNavigate}
        onSave={handleSaveAndNavigate}
        isSaving={isSavingDraft}
      />
    </div>
  );
}
