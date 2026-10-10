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
  session: RecordFormSession<CollectionEditValues>;
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
    () =>
      save(({ values, changedFields, expectedEditVersion }) =>
        updateCollection({
          ...collectionUpdatePatch(typedCollectionId, values, changedFields),
          expectedEditVersion,
        }),
      ),
    [save, typedCollectionId, updateCollection],
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!isDirty && hasMediaChanges) {
        push(`/objects/${collectionId}`);
        return;
      }

      if (await saveRecord()) {
        push(`/objects/${collectionId}`);
      }
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
