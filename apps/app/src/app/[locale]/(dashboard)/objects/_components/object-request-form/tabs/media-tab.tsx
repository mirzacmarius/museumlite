"use client";

import { Button } from "@v1/ui/button";
import { Star, Upload, X } from "lucide-react";
import Image from "next/image";
import type React from "react";
import { PermissionGate } from "@/components/permission-gate";
import { useI18n } from "@/locales/client";
import { EditSection } from "../../collection-form-shared/edit-section";
import type {
  CollectionFormTabProps,
  DraftMediaItem,
} from "../../collection-form-shared/types";

export interface ObjectRequestMediaTabProps extends CollectionFormTabProps {
  common: (key: string) => string;
  documentInputRef: React.RefObject<HTMLInputElement | null>;
  selectedFiles: Array<{
    id: string;
    file: File;
    previewUrl: string;
    isPrimary: boolean;
  }>;
  selectedDocuments: Array<{ id: string; file: File; fileName: string }>;
  persistedDraftMedia: DraftMediaItem[];
  handleDocumentSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleSetPrimary: (fileId: string) => void;
  handleDeleteImage: (fileId: string) => void;
  handleDeleteDocument: (docId: string) => void;
}

export function ObjectRequestMediaTab({
  common,
  documentInputRef,
  selectedFiles,
  selectedDocuments,
  persistedDraftMedia,
  handleDocumentSelect,
  handleSetPrimary,
  handleDeleteImage,
  handleDeleteDocument,
}: ObjectRequestMediaTabProps) {
  const tRoot = useI18n();
  return (
    <div className="space-y-8">
      <EditSection
        title={tRoot("untranslatedRecords.objects.printView.images")}
        description={tRoot(
          "untranslatedRecords.objects.form.selectImagesAfterApproval",
        )}
      >
        {persistedDraftMedia.filter((item) => item.mediaCategory === "image")
          .length > 0 ? (
          <div className="mb-5 space-y-3">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {tRoot("untranslatedRecords.objects.detail.alreadyAttached")}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {persistedDraftMedia.flatMap((item) =>
                item.mediaCategory === "image"
                  ? [
                      <div
                        key={item.storageId}
                        className="group relative overflow-hidden rounded-xl border border-border/60 bg-background/70"
                      >
                        {item.url ? (
                          <div className="relative aspect-square w-full">
                            <Image
                              src={item.url}
                              alt={item.fileName}
                              fill
                              sizes="200px"
                              className="object-cover w-full object-cover"
                            />
                          </div>
                        ) : null}
                        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3">
                          {item.isPrimary ? (
                            <div className="rounded-full bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground">
                              {tRoot("objects.form.media.primary")}
                            </div>
                          ) : (
                            <PermissionGate permission="media.upload">
                              <Button
                                type="button"
                                size="icon"
                                variant="secondary"
                                className="size-8 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                                onClick={() => handleSetPrimary(item.storageId)}
                                title={common("setAsPrimary")}
                                aria-label={common("setAsPrimary")}
                              >
                                <Star className="size-3.5" />
                              </Button>
                            </PermissionGate>
                          )}
                        </div>
                        <div className="px-4 py-3">
                          <p className="truncate text-sm font-medium text-foreground">
                            {item.fileName}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {tRoot(
                              "untranslatedRecords.objects.media.savedWithDraft",
                            )}
                          </p>
                        </div>
                      </div>,
                    ]
                  : [],
              )}
            </div>
          </div>
        ) : null}

        {selectedFiles.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {selectedFiles.map((file) => (
              <div
                key={file.id}
                className="group relative aspect-square overflow-hidden rounded-xl border border-border/60 bg-card"
              >
                <Image
                  src={file.previewUrl}
                  alt={file.file.name}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-cover"
                />

                <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3">
                  {file.isPrimary ? (
                    <div className="rounded-full bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground">
                      {tRoot("objects.form.media.primary")}
                    </div>
                  ) : (
                    <div />
                  )}
                </div>

                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-zinc-950/65 p-3 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <div className="truncate text-xs text-white">
                    {file.file.name}
                  </div>
                  <div className="flex items-center gap-1">
                    {!file.isPrimary ? (
                      <PermissionGate permission="media.upload">
                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          className="size-8"
                          onClick={() => handleSetPrimary(file.id)}
                          title={common("setAsPrimary")}
                          aria-label={common("setAsPrimary")}
                        >
                          <Star className="size-3.5" />
                        </Button>
                      </PermissionGate>
                    ) : null}
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="size-8"
                      onClick={() => handleDeleteImage(file.id)}
                      title={common("delete")}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-border/60">
            <Upload className="mb-2 size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {persistedDraftMedia.some(
                (item) => item.mediaCategory === "image",
              )
                ? tRoot("untranslatedRecords.objects.media.noNewImages")
                : tRoot("untranslatedRecords.objects.media.noImages")}
            </p>
          </div>
        )}
      </EditSection>

      <EditSection
        title={tRoot("objects.digitalAssetsTab.title")}
        description={tRoot(
          "untranslatedRecords.objects.form.attachDocumentsDescription",
        )}
      >
        <input
          ref={documentInputRef}
          type="file"
          accept=".pdf,image/jpeg,image/jpg,image/png,image/tiff"
          onChange={handleDocumentSelect}
          className="hidden"
          multiple
        />

        <div className="mb-5 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => documentInputRef.current?.click()}
          >
            <Upload className="mr-2 size-4" />
            {tRoot("objects.form.actions.uploadDocuments")}
          </Button>
        </div>

        {persistedDraftMedia.filter((item) => item.mediaCategory === "document")
          .length > 0 ? (
          <div className="mb-5 space-y-3">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {tRoot("untranslatedRecords.objects.detail.alreadyAttached")}
            </p>
            <div className="space-y-3">
              {persistedDraftMedia.flatMap((item) =>
                item.mediaCategory === "document"
                  ? [
                      <div
                        key={item.storageId}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/70 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {item.fileName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {tRoot(
                              "untranslatedRecords.objects.form.savedWithDraft",
                            )}
                          </p>
                        </div>
                      </div>,
                    ]
                  : [],
              )}
            </div>
          </div>
        ) : null}

        {selectedDocuments.length > 0 ? (
          <div className="space-y-3">
            {selectedDocuments.map((document) => (
              <div
                key={document.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/70 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {document.fileName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tRoot("untranslatedRecords.objects.form.queuedForSubmit")}
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDeleteDocument(document.id)}
                  title={common("delete")}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-border/60">
            <p className="text-sm text-muted-foreground">
              {persistedDraftMedia.some(
                (item) => item.mediaCategory === "document",
              )
                ? tRoot("untranslatedRecords.objects.media.noNewDocuments")
                : tRoot("untranslatedRecords.objects.media.noDocuments")}
            </p>
          </div>
        )}
      </EditSection>
    </div>
  );
}
