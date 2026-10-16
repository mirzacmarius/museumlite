"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { DeaccessionDialog } from "@/components/deaccession-dialog";
import { MediaEditorDialog } from "@/components/media-editor-dialog";
import { RecordFormNotices } from "@/components/record-form/record-form-notices";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";
import {
  CollectionEditFormFooter,
  resolveCollectionEditFormFooterState,
} from "./collection-edit-form-footer";
import { CollectionEditFormHeader } from "./collection-edit-form-header";
import { CollectionEditFormHero } from "./collection-edit-form-hero";
import { CollectionEditFormTabShell } from "./collection-edit-form-tab-shell";
import type { useCollectionEditForm } from "./use-collection-edit-form";

type CollectionDoc = NonNullable<
  FunctionReturnType<typeof api.collections.get>
>;

interface CollectionEditFormLayoutProps {
  form: ReturnType<typeof useCollectionEditForm> & {
    collection: CollectionDoc;
    currentOrganizationId: Id<"organizations">;
  };
}

export function CollectionEditFormLayout({
  form,
}: CollectionEditFormLayoutProps) {
  const {
    t,
    common,
    placeholders,
    collectionId,
    typedCollectionId,
    currentOrganizationId,
    isLocationTrackingEnabled,
    collection,
    pendingMoveRequest,
    session,
    fieldLabel,
    goToField,
    formData,
    activeTab,
    setActiveTab,
    tabs,
    isSubmitting,
    error,
    alternateAccessionDraft,
    setAlternateAccessionDraft,
    conditionChangeNote,
    setConditionChangeNote,
    deaccessionDialogOpen,
    setDeaccessionDialogOpen,
    editingOwnershipEntryId,
    setEditingOwnershipEntryId,
    editingImageId,
    setEditingImageId,
    showUnsavedDialog,
    setShowUnsavedDialog,
    images,
    documents,
    hasActiveLoan,
    hasConditionChanged,
    requiresConditionChangeNote,
    isFormDirty,
    hasMediaChanges,
    canUpdateObject,
    updateField,
    createOwnershipEntry,
    handleAddAlternateAccessionNumber,
    handleRemoveAlternateAccessionNumber,
    fileInputRef,
    cameraInputRef,
    documentInputRef,
    handleFileSelect,
    handleDocumentSelect,
    handleSetPrimary,
    handleSubmit,
    handleNavigate,
    handleDiscardAndNavigate,
    handleSaveAndNavigate,
    locationSummary,
    collectionSummary,
    getStatusBadgeClass,
    resolvedCurrentLocationId,
  } = form;

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <CollectionEditFormHeader
        t={t}
        common={common}
        collectionId={collectionId}
        collection={collection}
        hasActiveLoan={hasActiveLoan}
        isSubmitting={isSubmitting}
        canUpdateObject={canUpdateObject}
        onNavigate={handleNavigate}
        onDeaccessionOpen={() => setDeaccessionDialogOpen(true)}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <form id="object-edit-form" onSubmit={handleSubmit} noValidate>
          <CollectionEditFormHero
            collection={collection}
            formData={formData}
            images={images.flatMap((image) =>
              image.url
                ? [
                    {
                      id: image._id,
                      src: image.url,
                      thumbnailSrc: image.thumbnailUrl,
                      alt: image.fileName,
                      isPrimary: image.isPrimary,
                    },
                  ]
                : [],
            )}
            pendingMoveRequest={pendingMoveRequest}
            placeholders={placeholders}
            common={common}
            isLocationTrackingEnabled={isLocationTrackingEnabled}
            locationSummary={locationSummary}
            collectionSummary={collectionSummary}
            getStatusBadgeClass={getStatusBadgeClass}
            onTitleChange={(value) => updateField("title", value)}
            titleError={session.fieldErrors.title}
            onDescriptionChange={(value) => updateField("description", value)}
            onTabSelect={setActiveTab}
            fileInputRef={fileInputRef}
            cameraInputRef={cameraInputRef}
            handleFileSelect={handleFileSelect}
          />

          <CollectionEditFormTabShell
            error={error}
            notices={
              <RecordFormNotices
                session={session}
                fieldLabel={fieldLabel}
                onGoToField={goToField}
              />
            }
            fieldErrors={session.fieldErrors}
            tabs={tabs}
            activeTab={activeTab}
            onTabSelect={setActiveTab}
            formData={formData}
            updateField={updateField}
            placeholders={placeholders}
            currentOrganizationId={currentOrganizationId}
            isLocationTrackingEnabled={isLocationTrackingEnabled}
            collection={collection}
            typedCollectionId={typedCollectionId}
            alternateAccessionDraft={alternateAccessionDraft}
            onAlternateAccessionDraftChange={setAlternateAccessionDraft}
            onAddAlternateAccessionNumber={handleAddAlternateAccessionNumber}
            onRemoveAlternateAccessionNumber={
              handleRemoveAlternateAccessionNumber
            }
            editingOwnershipEntryId={editingOwnershipEntryId}
            setEditingOwnershipEntryId={setEditingOwnershipEntryId}
            createOwnershipEntry={createOwnershipEntry}
            resolvedCurrentLocationId={resolvedCurrentLocationId}
            hasConditionChanged={hasConditionChanged}
            requiresConditionChangeNote={requiresConditionChangeNote}
            conditionChangeNote={conditionChangeNote}
            onConditionChangeNoteChange={setConditionChangeNote}
            images={images}
            documents={documents}
            common={common}
            t={t}
            documentInputRef={documentInputRef}
            handleDocumentSelect={handleDocumentSelect}
            handleSetPrimary={handleSetPrimary}
            setEditingImageId={setEditingImageId}
          />
        </form>
      </div>

      <CollectionEditFormFooter
        error={error}
        state={resolveCollectionEditFormFooterState({
          isSubmitting,
          isFormDirty,
          hasMediaChanges,
        })}
        canUpdateObject={canUpdateObject}
        collectionId={collectionId}
        common={common}
        t={t}
        onNavigate={handleNavigate}
      />

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onDiscard={handleDiscardAndNavigate}
        onSave={handleSaveAndNavigate}
        isSaving={isSubmitting}
      />

      <DeaccessionDialog
        open={deaccessionDialogOpen}
        onOpenChange={setDeaccessionDialogOpen}
        collectionId={typedCollectionId}
        collectionTitle={collection.title}
        organizationId={collection.organizationId}
      />
      <MediaEditorDialog
        mediaId={editingImageId}
        isOpen={!!editingImageId}
        onClose={() => setEditingImageId(null)}
        allowDelete
      />
    </div>
  );
}
