"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useImageDeletionErrorMessage } from "@/hooks/use-image-deletion-error-message";
import { useI18n } from "@/locales/client";

/** Marked images, each with whether its deletion asks for approval. */
type MarkedImages = ReadonlyMap<Id<"mediaFiles">, boolean>;

const NONE: MarkedImages = new Map();

/**
 * Images staff marked for deletion in the edit form. Nothing is sent until the
 * object is updated, and leaving without updating keeps every image.
 */
export function useMarkedImageDeletions({
  setError,
}: {
  setError: (error: string | null) => void;
}) {
  const t = useI18n();
  const errorMessage = useImageDeletionErrorMessage();
  const requestDeletion = useMutation(api.mediaDeletions.requestImageDeletion);
  const deleteImage = useMutation(api.mediaDeletions.deleteImage);
  const [marked, setMarked] = useState<MarkedImages>(NONE);
  const [isSending, setIsSending] = useState(false);

  const mark = useCallback(
    (mediaId: Id<"mediaFiles">, requiresApproval: boolean) =>
      setMarked((previous) => new Map(previous).set(mediaId, requiresApproval)),
    [],
  );

  const keep = useCallback(
    (mediaId: Id<"mediaFiles">) =>
      setMarked((previous) => {
        const next = new Map(previous);
        next.delete(mediaId);
        return next;
      }),
    [],
  );

  const keepAll = useCallback(() => setMarked(NONE), []);

  /**
   * Sends every marked deletion: for approval, or straight away where the
   * organization needs none. A refused one stays marked and is explained;
   * true when all went through.
   */
  const send = useCallback(async () => {
    if (marked.size === 0) return true;
    setIsSending(true);
    setError(null);
    const entries = [...marked];
    const results = await Promise.allSettled(
      entries.map(([mediaId, requiresApproval]) =>
        requiresApproval
          ? requestDeletion({ mediaId })
          : deleteImage({ mediaId }),
      ),
    );
    let requested = 0;
    let deleted = 0;
    let refusal: string | null = null;
    for (const [index, result] of results.entries()) {
      const [mediaId, requiresApproval] = entries[index] ?? [];
      if (result.status === "rejected") {
        refusal ??= errorMessage(result.reason, t("imageDeletion.failed"));
      } else if (mediaId) {
        if (requiresApproval) requested += 1;
        else deleted += 1;
        keep(mediaId);
      }
    }
    setIsSending(false);
    if (requested > 0) toast.success(t("imageDeletion.requested"));
    if (deleted > 0) toast.success(t("imageDeletion.deleted"));
    if (refusal) {
      setError(refusal);
      return false;
    }
    return true;
  }, [deleteImage, errorMessage, keep, marked, requestDeletion, setError, t]);

  return {
    markedImageIds: marked,
    hasMarkedImages: marked.size > 0,
    isSendingImageDeletions: isSending,
    markImageForDeletion: mark,
    keepImage: keep,
    keepAllImages: keepAll,
    sendImageDeletions: send,
  };
}
