"use client";

import { DeaccessionDialog } from "@/components/deaccession-dialog";
import { MediaEditorDialog } from "@/components/media-editor-dialog";
import { PermissionGate } from "@/components/permission-gate";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";
import type { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { cn } from "@v1/ui/utils";
import type { FunctionReturnType } from "convex/server";
import {
  AlertOctagon,
  Archive,
  ArrowLeft,
  ArrowRightLeft,
  Calendar,
  Image as ImageIcon,
  Info,
  MapPin,
  Save,
} from "lucide-react";
import Link from "next/link";
import { CollectionEditAccessionTab } from "./tabs/accession-tab";
import { CollectionEditDigitalTab } from "./tabs/digital-tab";
import { CollectionEditGeneralTab } from "./tabs/general-tab";
import { CollectionEditMediaTab } from "./tabs/media-tab";
import { CollectionEditPhysicalTab } from "./tabs/physical-tab";
import { CollectionEditPlacementTab } from "./tabs/placement-tab";
import { CollectionEditProvenanceTab } from "./tabs/provenance-tab";
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
    heroImage,
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
    handleDeleteMedia,
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
      <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-background/90 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-xs">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => handleNavigate(`/objects/${collectionId}`)}
          >
            <ArrowLeft className="size-4 text-muted-foreground" />
          </Button>
          <span className="text-muted-foreground">
            {t("detail.collections")}
          </span>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium text-foreground">Edit object</span>
        </div>

        <div className="flex items-center gap-3">
          <PermissionGate permission="collections.update">
            {collection.status === "active" && !hasActiveLoan ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setDeaccessionDialogOpen(true)}
              >
                <Archive className="mr-2 size-4" />
                Deaccession
              </Button>
            ) : null}
            {collection.status === "active" && hasActiveLoan ? (
              <div
                className="hidden items-center text-xs text-muted-foreground lg:flex"
                title={common("cannotDeaccession")}
              >
                <AlertOctagon className="mr-2 size-4" />
                Cannot remove while on loan
              </div>
            ) : null}
          </PermissionGate>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleNavigate(`/objects/${collectionId}`)}
          >
            {common("cancel")}
          </Button>
          <Button
            type="submit"
            size="sm"
            form="object-edit-form"
            disabled={isSubmitting || !canUpdateObject}
          >
            <Save className="mr-2 size-4" />
            {isSubmitting ? common("updating") : t("form.actions.updateObject")}
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <form id="object-edit-form" onSubmit={handleSubmit}>
          <div className="border-b border-border/60 bg-secondary/10 px-6 py-8 sm:px-8">
            <div className="mx-auto flex max-w-5xl flex-col gap-8 lg:flex-row lg:items-start">
              <button
                type="button"
                className="group relative shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-secondary transition-colors hover:border-primary/40"
                onClick={() => setActiveTab("media")}
              >
                {heroImage?.url ? (
                  <img
                    src={heroImage.thumbnailUrl || heroImage.url}
                    alt={collection.title}
                    className="size-48 object-cover"
                  />
                ) : (
                  <div className="flex size-48 items-center justify-center">
                    <ImageIcon className="size-12 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-black/55 px-3 py-2 text-left text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                  Open media tab
                </div>
              </button>

              <div className="flex-1 space-y-6">
                {pendingMoveRequest ? (
                  <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-medium text-blue-100">
                          <ArrowRightLeft className="size-4" />
                          {pendingMoveRequest.status === "awaiting_acceptance"
                            ? "Awaiting transfer acceptance"
                            : "Pending transfer approval"}
                        </div>
                        <p className="text-sm text-blue-200/80">
                          This object is{" "}
                          {pendingMoveRequest.status === "awaiting_acceptance"
                            ? "awaiting acceptance"
                            : "awaiting approval"}{" "}
                          to move to {pendingMoveRequest.targetOrganizationName}
                          .
                        </p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={`/objects/move-requests/${pendingMoveRequest._id}`}
                        >
                          Open transfer request
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
                    {collection.status}
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
                    Object title
                  </Label>
                  <Input
                    id="hero-title"
                    value={formData.title}
                    onChange={(event) =>
                      updateField("title", event.target.value)
                    }
                    placeholder={placeholders("title")}
                    className="h-14 border-border/60 bg-background/90 text-xl font-semibold sm:text-2xl"
                    required
                  />
                </div>

                <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                  <button
                    type="button"
                    className="rounded-xl border border-border/50 bg-background/70 p-3 text-left transition-colors hover:border-primary/30 hover:text-foreground"
                    onClick={() => setActiveTab("general")}
                  >
                    <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      <Info className="size-3.5" />
                      Creator
                    </div>
                    <div className="truncate text-sm text-foreground">
                      {formData.creator || "Not set"}
                    </div>
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-border/50 bg-background/70 p-3 text-left transition-colors hover:border-primary/30 hover:text-foreground"
                    onClick={() => setActiveTab("general")}
                  >
                    <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      <Calendar className="size-3.5" />
                      Date created
                    </div>
                    <div className="truncate text-sm text-foreground">
                      {formData.dateCreated || common("unknown")}
                    </div>
                  </button>
                  {isLocationTrackingEnabled ? (
                    <>
                      <button
                        type="button"
                        className="rounded-xl border border-border/50 bg-background/70 p-3 text-left transition-colors hover:border-primary/30 hover:text-foreground"
                        onClick={() => setActiveTab("placement")}
                      >
                        <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          <MapPin className="size-3.5" />
                          Location
                        </div>
                        <div className="truncate text-sm text-foreground">
                          {locationSummary}
                        </div>
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-border/50 bg-background/70 p-3 text-left transition-colors hover:border-primary/30 hover:text-foreground"
                        onClick={() => setActiveTab("placement")}
                      >
                        <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          <Info className="size-3.5" />
                          Collection
                        </div>
                        <div className="truncate text-sm text-foreground">
                          {collectionSummary}
                        </div>
                      </button>
                    </>
                  ) : null}
                </div>

                <p className="text-sm text-muted-foreground">
                  Edit the record using the same structure as the object detail
                  page. Field changes save together. Media uploads and primary
                  image changes apply immediately.
                </p>
              </div>
            </div>
          </div>

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
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/70 px-5 py-6 shadow-sm sm:px-8 sm:py-8">
              <div className="rounded-2xl border border-border/60 bg-background/70 px-5 py-6 shadow-sm sm:px-8 sm:py-8">
                {activeTab === "general" ? (
                  <CollectionEditGeneralTab
                    formData={formData}
                    updateField={updateField}
                    placeholders={placeholders}
                    currentOrganizationId={currentOrganizationId}
                    isLocationTrackingEnabled={isLocationTrackingEnabled}
                    collection={collection}
                    alternateAccessionDraft={alternateAccessionDraft}
                    onAlternateAccessionDraftChange={setAlternateAccessionDraft}
                    onAddAlternateAccessionNumber={
                      handleAddAlternateAccessionNumber
                    }
                    onRemoveAlternateAccessionNumber={
                      handleRemoveAlternateAccessionNumber
                    }
                    typedCollectionId={typedCollectionId}
                  />
                ) : null}
                {activeTab === "accession" ? (
                  <CollectionEditAccessionTab
                    formData={formData}
                    updateField={updateField}
                    placeholders={placeholders}
                    currentOrganizationId={currentOrganizationId}
                    isLocationTrackingEnabled={isLocationTrackingEnabled}
                    typedCollectionId={typedCollectionId}
                  />
                ) : null}
                {activeTab === "provenance" ? (
                  <CollectionEditProvenanceTab
                    formData={formData}
                    updateField={updateField}
                    placeholders={placeholders}
                    currentOrganizationId={currentOrganizationId}
                    isLocationTrackingEnabled={isLocationTrackingEnabled}
                    editingOwnershipEntryId={editingOwnershipEntryId}
                    setEditingOwnershipEntryId={setEditingOwnershipEntryId}
                    createOwnershipEntry={createOwnershipEntry}
                  />
                ) : null}
                {activeTab === "placement" ? (
                  <CollectionEditPlacementTab
                    formData={formData}
                    updateField={updateField}
                    placeholders={placeholders}
                    currentOrganizationId={currentOrganizationId}
                    isLocationTrackingEnabled={isLocationTrackingEnabled}
                    collection={collection}
                    typedCollectionId={typedCollectionId}
                    resolvedCurrentLocationId={resolvedCurrentLocationId}
                  />
                ) : null}
                {activeTab === "physical" ? (
                  <CollectionEditPhysicalTab
                    formData={formData}
                    updateField={updateField}
                    placeholders={placeholders}
                    currentOrganizationId={currentOrganizationId}
                    isLocationTrackingEnabled={isLocationTrackingEnabled}
                    collection={collection}
                    typedCollectionId={typedCollectionId}
                    hasConditionChanged={hasConditionChanged}
                    requiresConditionChangeNote={requiresConditionChangeNote}
                    conditionChangeNote={conditionChangeNote}
                    onConditionChangeNoteChange={setConditionChangeNote}
                  />
                ) : null}
                {activeTab === "media" ? (
                  <CollectionEditMediaTab
                    formData={formData}
                    updateField={updateField}
                    placeholders={placeholders}
                    currentOrganizationId={currentOrganizationId}
                    isLocationTrackingEnabled={isLocationTrackingEnabled}
                    collection={collection}
                    typedCollectionId={typedCollectionId}
                    images={images}
                    documents={documents}
                    common={common}
                    t={t}
                    fileInputRef={fileInputRef}
                    cameraInputRef={cameraInputRef}
                    documentInputRef={documentInputRef}
                    handleFileSelect={handleFileSelect}
                    handleDocumentSelect={handleDocumentSelect}
                    handleSetPrimary={handleSetPrimary}
                    handleDeleteMedia={handleDeleteMedia}
                    setEditingImageId={setEditingImageId}
                    hasConditionChanged={hasConditionChanged}
                    requiresConditionChangeNote={requiresConditionChangeNote}
                    conditionChangeNote={conditionChangeNote}
                    onConditionChangeNoteChange={setConditionChangeNote}
                  />
                ) : null}
                {activeTab === "digital" ? (
                  <CollectionEditDigitalTab
                    formData={formData}
                    updateField={updateField}
                    placeholders={placeholders}
                    currentOrganizationId={currentOrganizationId}
                    isLocationTrackingEnabled={isLocationTrackingEnabled}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </form>
      </div>

      <div className="shrink-0 border-t border-border/60 bg-background/95 px-6 py-3 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            {error ? (
              <span className="text-destructive">{error}</span>
            ) : isSubmitting ? (
              <span className="text-foreground">Saving changes…</span>
            ) : isFormDirty ? (
              <span className="text-foreground">
                You have unsaved field changes across tabs.
              </span>
            ) : hasMediaChanges ? (
              <span className="text-muted-foreground">
                Media changes are already applied.
              </span>
            ) : (
              <span className="text-muted-foreground">
                No unsaved field changes.
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleNavigate(`/objects/${collectionId}`)}
            >
              {common("cancel")}
            </Button>
            <Button
              type="submit"
              form="object-edit-form"
              disabled={isSubmitting || !canUpdateObject}
            >
              <Save className="mr-2 size-4" />
              {isSubmitting
                ? common("updating")
                : t("form.actions.updateObject")}
            </Button>
          </div>
        </div>
      </div>

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
      />
    </div>
  );
}
