"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import NextImage from "next/image";
import { useState } from "react";
import { useActionErrorMessage } from "@/hooks/use-action-error-message";
import { useI18n } from "@/locales/client";
import {
  isLicenseExpiryValid,
  type MediaRightsValues,
  mediaRightsUpdate,
  mediaRightsValuesOf,
  type StoredMediaRights,
} from "./media-rights";
import { MediaRightsFields } from "./media-rights-fields";

interface MediaPublicationPanelProps {
  mediaId: Id<"mediaFiles">;
  organizationId: Id<"organizations">;
  item: StoredMediaRights;
}

interface MediaPublicationPanelState extends MediaRightsValues {
  isSaving: boolean;
  error: string | null;
}

export function MediaPublicationPanel({
  mediaId,
  organizationId,
  item,
}: MediaPublicationPanelProps) {
  const t = useI18n();
  const actionErrorMessage = useActionErrorMessage();
  const review = useQuery(api.mediaPublications.getReview, { mediaId });
  const updateRights = useMutation(api.media.updateRights);
  const approve = useMutation(api.mediaPublications.approve);
  const setHiddenFromPortal = useMutation(
    api.mediaPublications.setHiddenFromPortal,
  );
  const setOriginalDownload = useMutation(
    api.mediaPublications.setOriginalDownload,
  );
  const [state, setState] = useState<MediaPublicationPanelState>(() => ({
    ...mediaRightsValuesOf(item),
    isSaving: false,
    error: null,
  }));
  const rightsUpdate = mediaRightsUpdate(state, mediaRightsValuesOf(item));

  function updateState<Key extends keyof MediaPublicationPanelState>(
    key: Key,
    value: MediaPublicationPanelState[Key],
  ) {
    setState((current) => ({ ...current, [key]: value }));
  }

  async function run(operation: () => Promise<unknown>) {
    updateState("error", null);
    updateState("isSaving", true);
    try {
      await operation();
    } catch (cause) {
      updateState(
        "error",
        actionErrorMessage(cause, t("mediaPage.publication.failed")),
      );
    } finally {
      updateState("isSaving", false);
    }
  }

  function saveRights() {
    if (!isLicenseExpiryValid(state.licenseExpiry)) {
      updateState("error", t("mediaPage.publication.invalidExpiry"));
      return;
    }
    void run(() => updateRights({ mediaId, ...rightsUpdate }));
  }

  return (
    <section
      className="space-y-3 border-t border-white/10 pt-4"
      aria-label={t("mediaPage.publication.title")}
    >
      <h3 className="text-sm font-medium text-zinc-200">
        {t("mediaPage.publication.title")}
      </h3>
      {review === undefined ? (
        <p className="text-xs text-zinc-400">{t("mediaPage.loading")}</p>
      ) : review ? (
        <>
          <p className="text-xs text-zinc-400">
            {t(`mediaPage.publication.portal.${review.portal}`)}
          </p>
          {review.canManage && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={state.isSaving}
              onClick={() =>
                void run(() =>
                  setHiddenFromPortal({
                    mediaId,
                    hidden: review.portal !== "hidden",
                  }),
                )
              }
            >
              {review.portal === "hidden"
                ? t("mediaPage.publication.show")
                : t("mediaPage.publication.hide")}
            </Button>
          )}
          <p className="text-xs text-zinc-400">
            {t(`mediaPage.publication.status.${review.status}`)}
          </p>
          {review.blocker && (
            <p className="text-xs text-amber-300">{review.blocker}</p>
          )}
          {review.publicRenditionUrl && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-400">
                {t("mediaPage.publication.publicPreview")}
              </p>
              <div className="relative h-40 overflow-hidden rounded border border-white/10 bg-black">
                <NextImage
                  src={review.publicRenditionUrl}
                  alt={t("mediaPage.publication.publicPreview")}
                  fill
                  sizes="320px"
                  className="object-contain"
                />
              </div>
            </div>
          )}
          {review.canManage && (
            <div className="space-y-3">
              <MediaRightsFields
                organizationId={organizationId}
                values={state}
                onChange={(change) =>
                  setState((current) => ({ ...current, ...change }))
                }
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={
                  state.isSaving || Object.keys(rightsUpdate).length === 0
                }
                onClick={saveRights}
              >
                {t("mediaPage.publication.saveRights")}
              </Button>
              <div className="flex flex-wrap gap-2">
                {review.status !== "approved" && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      state.isSaving ||
                      !!review.blocker ||
                      review.status === "processing"
                    }
                    onClick={() => void run(() => approve({ mediaId }))}
                  >
                    {review.status === "failed"
                      ? t("mediaPage.publication.retry")
                      : t("mediaPage.publication.approve")}
                  </Button>
                )}
              </div>
              {review.status === "approved" && (
                <label className="flex items-center gap-2 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={review.originalDownloadAllowed}
                    disabled={state.isSaving}
                    onChange={(event) =>
                      void run(() =>
                        setOriginalDownload({
                          mediaId,
                          allowed: event.target.checked,
                        }),
                      )
                    }
                  />
                  {t("mediaPage.publication.originalDownload")}
                </label>
              )}
            </div>
          )}
          {state.error && (
            <p role="alert" className="text-xs text-red-300">
              {state.error}
            </p>
          )}
        </>
      ) : (
        <p className="text-xs text-zinc-400">
          {t("mediaPage.publication.unavailable")}
        </p>
      )}
    </section>
  );
}
