"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useCallback } from "react";
import type { RecordFormSession } from "@/hooks/use-record-form-session";
import {
  type CollectionEditValues,
  collectionUpdatePatch,
} from "./collection-edit-values";

interface UseCollectionEditFormSubmitOptions {
  collectionId: string;
  typedCollectionId: Id<"collections">;
  session: Pick<RecordFormSession<CollectionEditValues>, "isDirty" | "save">;
  hasMediaChanges: boolean;
  hasMarkedImages: boolean;
  /** Sends the images marked for deletion; true when all went through. */
  sendImageDeletions: () => Promise<boolean>;
}

export function useCollectionEditFormSubmit({
  collectionId,
  typedCollectionId,
  session,
  hasMediaChanges,
  hasMarkedImages,
  sendImageDeletions,
}: UseCollectionEditFormSubmitOptions) {
  const { push } = useRouter();
  const updateCollection = useMutation(api.collections.update);
  const { isDirty, save } = session;

  const canUpdateObject = isDirty || hasMediaChanges || hasMarkedImages;

  const saveRecord = useCallback(
    async (afterSave?: () => void) => {
      const saveFields = (then?: () => void) =>
        save(
          ({ values, changedFields, expectedEditVersion }) =>
            updateCollection({
              ...collectionUpdatePatch(
                typedCollectionId,
                values,
                changedFields,
              ),
              expectedEditVersion,
            }),
          then,
        );
      if (!hasMarkedImages) {
        if (isDirty) return saveFields(afterSave);
        afterSave?.();
        return true;
      }
      // Marked images go only once the fields have saved, so a refused field
      // leaves every image in place for Cancel to keep; a refused deletion
      // keeps staff on the form with the reason.
      if (isDirty && !(await saveFields())) return false;
      if (!(await sendImageDeletions())) return false;
      afterSave?.();
      return true;
    },
    [
      hasMarkedImages,
      isDirty,
      save,
      sendImageDeletions,
      typedCollectionId,
      updateCollection,
    ],
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      // Dialogs in a tab, such as Record appraisal, render in a portal, but
      // their submit still bubbles here through the React tree.
      if (event.target !== event.currentTarget) return;
      event.preventDefault();
      await saveRecord(() => push(`/objects/${collectionId}`));
    },
    [collectionId, push, saveRecord],
  );

  return {
    canUpdateObject,
    saveRecord,
    handleSubmit,
    push,
  };
}
