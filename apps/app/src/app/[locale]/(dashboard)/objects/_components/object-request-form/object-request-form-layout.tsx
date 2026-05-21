"use client";

import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Archive, ArrowLeft, Image as ImageIcon, Save } from "lucide-react";
import Image from "next/image";
import type { CollectionEditTabId } from "../collection-form-shared";
import { ObjectRequestAccessionTab } from "./tabs/accession-tab";
import { ObjectRequestDigitalTab } from "./tabs/digital-tab";
import { ObjectRequestGeneralTab } from "./tabs/general-tab";
import { ObjectRequestMediaTab } from "./tabs/media-tab";
import { ObjectRequestPhysicalTab } from "./tabs/physical-tab";
import { ObjectRequestPlacementTab } from "./tabs/placement-tab";
import { ObjectRequestProvenanceTab } from "./tabs/provenance-tab";
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
    heroImage,
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
            onClick={() => handleNavigate(resolvedBackHref)}
          >
            <ArrowLeft className="size-4 text-muted-foreground" />
          </Button>
          <span className="text-muted-foreground">
            {t("detail.collections")}
          </span>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium text-foreground">{pageTitle}</span>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleSaveDraft({ redirectToDetail: true })}
            disabled={isSavingDraft || isSubmitting}
          >
            <Archive className="mr-2 size-4" />
            {isSavingDraft ? "Saving draft..." : "Save Draft"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleNavigate(resolvedBackHref)}
          >
            {common("cancel")}
          </Button>
          <Button
            type="submit"
            size="sm"
            form="object-create-form"
            disabled={isSubmitting}
          >
            <Save className="mr-2 size-4" />
            {isSubmitting
              ? selectedFiles.length > 0 || selectedDocuments.length > 0
                ? "Submitting and uploading"
                : "Submitting"
              : "Submit for Approval"}
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <form id="object-create-form" onSubmit={handleSubmit}>
          <div className="border-b border-border/60 bg-secondary/10 px-6 py-8 sm:px-8">
            <div className="mx-auto flex max-w-5xl flex-col gap-8 lg:flex-row lg:items-start">
              <button
                type="button"
                className="group relative shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-secondary transition-colors hover:border-primary/40"
                onClick={() => setActiveTab("media")}
              >
                {heroImage ? (
                  <Image
                    src={heroImage.previewUrl}
                    alt={heroImage.file.name}
                    width={192}
                    height={192}
                    className="size-48 object-cover"
                  />
                ) : (
                  <div className="flex size-48 items-center justify-center">
                    <ImageIcon className="size-12 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gray-950/55 px-3 py-2 text-left text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                  Open media tab
                </div>
              </button>

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
                    onChange={(event) =>
                      updateField("title", event.target.value)
                    }
                    placeholder={placeholders("title")}
                    className="h-14 border-border/60 bg-background/90 text-xl font-semibold sm:text-2xl"
                    required
                  />
                </div>

                <p className="text-sm text-muted-foreground">
                  Build the record using the same tab structure as object detail
                  and edit. Draft saves keep this object in the accession draft
                  workflow until you explicitly submit it for approval. Images
                  and documents stay local until you submit the object request
                  for approval.
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
                  <ObjectRequestGeneralTab
                    formData={formData}
                    updateField={updateField}
                    placeholders={placeholders}
                    currentOrganizationId={currentOrganizationId ?? ""}
                    isLocationTrackingEnabled={isLocationTrackingEnabled}
                    enabledModules={enabledModules}
                  />
                ) : null}
                {activeTab === "accession" ? (
                  <ObjectRequestAccessionTab
                    formData={formData}
                    updateField={updateField}
                    placeholders={placeholders}
                    currentOrganizationId={currentOrganizationId ?? ""}
                    isLocationTrackingEnabled={isLocationTrackingEnabled}
                  />
                ) : null}
                {activeTab === "provenance" ? (
                  <ObjectRequestProvenanceTab
                    formData={formData}
                    updateField={updateField}
                    placeholders={placeholders}
                    currentOrganizationId={currentOrganizationId ?? ""}
                    isLocationTrackingEnabled={isLocationTrackingEnabled}
                  />
                ) : null}
                {activeTab === "placement" ? (
                  <ObjectRequestPlacementTab
                    formData={formData}
                    updateField={updateField}
                    placeholders={placeholders}
                    currentOrganizationId={currentOrganizationId ?? ""}
                    isLocationTrackingEnabled={isLocationTrackingEnabled}
                  />
                ) : null}
                {activeTab === "physical" ? (
                  <ObjectRequestPhysicalTab
                    formData={formData}
                    updateField={updateField}
                    placeholders={placeholders}
                    currentOrganizationId={currentOrganizationId ?? ""}
                    isLocationTrackingEnabled={isLocationTrackingEnabled}
                  />
                ) : null}
                {activeTab === "media" ? (
                  <ObjectRequestMediaTab
                    formData={formData}
                    updateField={updateField}
                    placeholders={placeholders}
                    currentOrganizationId={currentOrganizationId ?? ""}
                    isLocationTrackingEnabled={isLocationTrackingEnabled}
                    common={common}
                    fileInputRef={fileInputRef}
                    cameraInputRef={cameraInputRef}
                    documentInputRef={documentInputRef}
                    selectedFiles={selectedFiles}
                    selectedDocuments={selectedDocuments}
                    persistedDraftMedia={persistedDraftMedia}
                    handleFileSelect={handleFileSelect}
                    handleDocumentSelect={handleDocumentSelect}
                    handleSetPrimary={handleSetPrimary}
                    handleDeleteImage={handleDeleteImage}
                    handleDeleteDocument={handleDeleteDocument}
                  />
                ) : null}
                {activeTab === "digital" ? (
                  <ObjectRequestDigitalTab
                    formData={formData}
                    updateField={updateField}
                    placeholders={placeholders}
                    currentOrganizationId={currentOrganizationId ?? ""}
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
              <span className="text-foreground">
                {selectedFiles.length > 0 || selectedDocuments.length > 0
                  ? "Submitting and uploading"
                  : "Submitting"}
              </span>
            ) : isSavingDraft ? (
              <span className="text-foreground">Saving draft…</span>
            ) : hasSavedFieldDraft && isFormDirty ? (
              <span className="text-foreground">
                Draft exists, but your latest field changes are not saved yet.
              </span>
            ) : hasLocalMediaSelections ? (
              <span className="text-muted-foreground">
                Draft saves field data only. Images and documents stay local
                until you submit the object request.
              </span>
            ) : isDraftCurrent ? (
              <span className="text-muted-foreground">Draft saved.</span>
            ) : isFormDirty ? (
              <span className="text-foreground">
                You have unsaved field changes across tabs.
              </span>
            ) : (
              <span className="text-muted-foreground">
                No draft changes pending.
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleSaveDraft({ redirectToDetail: true })}
              disabled={isSavingDraft || isSubmitting}
            >
              <Archive className="mr-2 size-4" />
              {isSavingDraft ? "Saving draft..." : "Save Draft"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleNavigate(resolvedBackHref)}
            >
              {common("cancel")}
            </Button>
            <Button
              type="submit"
              form="object-create-form"
              disabled={isSubmitting}
            >
              <Save className="mr-2 size-4" />
              {isSubmitting
                ? selectedFiles.length > 0 || selectedDocuments.length > 0
                  ? "Submitting and uploading"
                  : "Submitting"
                : "Submit for Approval"}
            </Button>
          </div>
        </div>
      </div>

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
