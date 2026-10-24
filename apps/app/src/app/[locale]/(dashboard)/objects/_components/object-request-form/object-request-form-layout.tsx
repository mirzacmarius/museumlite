"use client";

import {
  RecordFormNotices,
  RecordLockedNotice,
} from "@/components/record-form/record-form-notices";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";
import { useI18n } from "@/locales/client";
import { CollectionTypeChangeDialog } from "./collection-type-change-dialog";
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
  const tRoot = useI18n();
  const {
    t,
    common,
    placeholders,
    session,
    fieldLabel,
    fieldValue,
    goToField,
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
    pendingCollectionType,
    confirmCollectionTypeChange,
    cancelCollectionTypeChange,
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

  if (!currentOrganizationId) return null;

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <ObjectRequestFormHeader
        t={t}
        common={common}
        labels={{
          savingDraft: tRoot("untranslatedRecords.objects.form.savingDraftNow"),
          saveDraft: tRoot("untranslatedRecords.objects.form.saveDraft"),
          submitting: tRoot("untranslatedRecords.objects.form.submitting"),
          submittingWithUploads: tRoot(
            "untranslatedRecords.objects.form.submittingWithUploads",
          ),
          submitForApproval: tRoot(
            "untranslatedRecords.objects.form.submitForApproval",
          ),
        }}
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
        <form id="object-create-form" onSubmit={handleSubmit} noValidate>
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
            titleError={session.fieldErrors.title}
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
            notices={
              <div className="space-y-3">
                {form.isLocked ? (
                  <RecordLockedNotice
                    message={tRoot("recordForm.notices.lockedWhileEditing")}
                  />
                ) : null}
                <RecordFormNotices
                  session={session}
                  fieldLabel={fieldLabel}
                  fieldValue={fieldValue}
                  onGoToField={goToField}
                />
              </div>
            }
            fieldErrors={session.fieldErrors}
            tabs={tabs}
            activeTab={activeTab}
            onTabSelect={setActiveTab}
            formData={formData}
            updateField={updateField}
            placeholders={placeholders}
            currentOrganizationId={currentOrganizationId}
            identifierAccessionId={form.activeDraftAccessionId ?? undefined}
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

      <CollectionTypeChangeDialog
        currentCollectionType={formData.collectionType}
        pendingCollectionType={pendingCollectionType}
        onConfirm={confirmCollectionTypeChange}
        onCancel={cancelCollectionTypeChange}
      />
    </div>
  );
}
