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
}

export function useCollectionEditFormSubmit({
  collectionId,
  typedCollectionId,
  session,
  hasMediaChanges,
}: UseCollectionEditFormSubmitOptions) {
  const { push } = useRouter();
  const updateCollection = useMutation(api.collections.update);
  const { isDirty, save } = session;

  const canUpdateObject = isDirty || hasMediaChanges;

  const saveRecord = useCallback(
    (afterSave?: () => void) =>
      save(
        ({ values, changedFields, expectedEditVersion }) =>
          updateCollection({
            ...collectionUpdatePatch(typedCollectionId, values, changedFields),
            expectedEditVersion,
          }),
        afterSave,
      ),
    [save, typedCollectionId, updateCollection],
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      // Dialogs in a tab, such as Record appraisal, render in a portal, but
      // their submit still bubbles here through the React tree.
      if (event.target !== event.currentTarget) return;
      event.preventDefault();
      if (!isDirty && hasMediaChanges) {
        push(`/objects/${collectionId}`);
        return;
      }

      await saveRecord(() => push(`/objects/${collectionId}`));
    },
    [collectionId, hasMediaChanges, isDirty, push, saveRecord],
  );

  return {
    canUpdateObject,
    saveRecord,
    handleSubmit,
    push,
  };
}
