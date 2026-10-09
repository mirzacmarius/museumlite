"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import type { ActionDispatch, MutableRefObject } from "react";
import { useCallback, useState } from "react";
import type {
  CollectionFormData,
  DraftMediaItem,
} from "../collection-form-shared/types";
import {
  buildDraftMediaPayload,
  buildObjectDraftPayload,
  getFormSignature,
} from "../collection-form-shared/utils";
import type { ObjectRequestDraftAction } from "./object-request-form-draft-reducer";

interface UseObjectRequestFormDraftOptions {
  currentOrganizationId: Id<"organizations"> | null | undefined;
  activeDraftAccessionId: Id<"accessions"> | null;
  formData: CollectionFormData;
  persistedDraftMedia: DraftMediaItem[];
  initialFormSignatureRef: MutableRefObject<string>;
  dispatchDraft: ActionDispatch<[ObjectRequestDraftAction]>;
  selectedFilesCount: number;
  selectedDocumentsCount: number;
  uploadDraftMedia: () => Promise<DraftMediaItem[]>;
  clearLocalMediaSelections: () => void;
  setError: (error: string | null) => void;
  describeError: (error: unknown) => string | null;
}

export function useObjectRequestFormDraft({
  currentOrganizationId,
  activeDraftAccessionId,
  formData,
  persistedDraftMedia,
  initialFormSignatureRef,
  dispatchDraft,
  selectedFilesCount,
  selectedDocumentsCount,
  uploadDraftMedia,
  clearLocalMediaSelections,
  setError,
  describeError,
}: UseObjectRequestFormDraftOptions) {
  const { push } = useRouter();
  const upsertObjectDraft = useMutation(api.accessions.upsertObjectDraft);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const handleSaveDraft = useCallback(
    async ({
      redirectToDetail = false,
    }: {
      redirectToDetail?: boolean;
    } = {}) => {
      if (!currentOrganizationId) {
        return false;
      }

      setIsSavingDraft(true);
      setError(null);

      try {
        const newDraftMedia =
          selectedFilesCount > 0 || selectedDocumentsCount > 0
            ? await uploadDraftMedia()
            : [];
        const draftMedia =
          persistedDraftMedia.length > 0 || newDraftMedia.length > 0
            ? [...persistedDraftMedia, ...newDraftMedia]
            : undefined;

        const savedAccessionId = await upsertObjectDraft({
          organizationId: currentOrganizationId,
          accessionId: activeDraftAccessionId || undefined,
          saveMode: "draft",
          objectData: buildObjectDraftPayload(formData),
          draftMedia: draftMedia
            ? buildDraftMediaPayload(draftMedia)
            : undefined,
        });

        dispatchDraft({
          type: "set_draft_accession_id",
          value: savedAccessionId,
        });
        dispatchDraft({
          type: "set_persisted_draft_media",
          value: draftMedia ?? [],
        });
        clearLocalMediaSelections();
        initialFormSignatureRef.current = getFormSignature(formData);
        dispatchDraft({ type: "set_draft_saved_at", value: Date.now() });

        if (redirectToDetail) {
          push(`/accessions/${savedAccessionId}`);
        }

        return true;
      } catch (err) {
        setError(
          describeError(err) ??
            (err instanceof Error ? err.message : "Failed to save draft."),
        );
        return false;
      } finally {
        setIsSavingDraft(false);
      }
    },
    [
      activeDraftAccessionId,
      clearLocalMediaSelections,
      currentOrganizationId,
      describeError,
      dispatchDraft,
      formData,
      initialFormSignatureRef,
      persistedDraftMedia,
      push,
      selectedDocumentsCount,
      selectedFilesCount,
      setError,
      uploadDraftMedia,
      upsertObjectDraft,
    ],
  );

  return { isSavingDraft, handleSaveDraft, push };
}
