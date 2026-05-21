"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import type React from "react";
import { useCallback, useState } from "react";
import type {
  CollectionFormData,
  DraftMediaItem,
} from "../collection-form-shared/types";
import {
  buildDraftMediaPayload,
  buildObjectDraftPayload,
} from "../collection-form-shared/utils";

interface UseObjectRequestFormSubmitOptions {
  currentOrganizationId: Id<"organizations"> | null | undefined;
  activeDraftAccessionId: Id<"accessions"> | null;
  formData: CollectionFormData;
  persistedDraftMedia: DraftMediaItem[];
  selectedFilesCount: number;
  selectedDocumentsCount: number;
  uploadDraftMedia: () => Promise<DraftMediaItem[]>;
  setError: (error: string | null) => void;
  t: (key: string) => string;
  push: (href: string) => void;
}

export function useObjectRequestFormSubmit({
  currentOrganizationId,
  activeDraftAccessionId,
  formData,
  persistedDraftMedia,
  selectedFilesCount,
  selectedDocumentsCount,
  uploadDraftMedia,
  setError,
  t,
  push,
}: UseObjectRequestFormSubmitOptions) {
  const upsertObjectDraft = useMutation(api.accessions.upsertObjectDraft);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setError(null);

      if (!formData.title?.trim()) {
        setError(t("form.errors.titleRequired"));
        return;
      }

      if (!currentOrganizationId) {
        return;
      }

      setIsSubmitting(true);

      try {
        const newDraftMedia =
          selectedFilesCount > 0 || selectedDocumentsCount > 0
            ? await uploadDraftMedia()
            : [];
        const draftMedia =
          persistedDraftMedia.length > 0 || newDraftMedia.length > 0
            ? [...persistedDraftMedia, ...newDraftMedia]
            : undefined;

        const accessionId = await upsertObjectDraft({
          organizationId: currentOrganizationId,
          accessionId: activeDraftAccessionId || undefined,
          saveMode: "submit",
          objectData: buildObjectDraftPayload(formData),
          draftMedia: draftMedia
            ? buildDraftMediaPayload(draftMedia)
            : undefined,
        });
        push(`/accessions/${accessionId}`);
      } catch (err) {
        console.error("Error submitting object request:", err);
        setError(
          err instanceof Error ? err.message : t("form.errors.saveFailed"),
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      activeDraftAccessionId,
      currentOrganizationId,
      formData,
      persistedDraftMedia,
      push,
      selectedDocumentsCount,
      selectedFilesCount,
      setError,
      t,
      uploadDraftMedia,
      upsertObjectDraft,
    ],
  );

  return { isSubmitting, handleSubmit };
}
