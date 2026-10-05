"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Doc, Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import NextImage from "next/image";
import { useState } from "react";
import { z } from "zod";
import { useI18n } from "@/locales/client";

type RightsStatus = NonNullable<Doc<"mediaFiles">["rightsStatus"]>;
type LicenseType = NonNullable<Doc<"mediaFiles">["licenseType"]>;

const rightsStatuses: RightsStatus[] = [
  "unknown",
  "owned",
  "public_domain",
  "licensed",
  "restricted",
  "orphan_work",
];
const licenseTypes: LicenseType[] = [
  "creative_commons_by",
  "creative_commons_by_sa",
  "creative_commons_by_nc",
  "creative_commons_by_nd",
  "creative_commons_zero",
  "editorial_only",
  "commercial",
  "internal_only",
  "custom",
];
const expirySchema = z.union([
  z.literal(""),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
]);

interface MediaPublicationPanelProps {
  mediaId: Id<"mediaFiles">;
  item: Pick<
    Doc<"mediaFiles">,
    | "rightsStatus"
    | "licenseType"
    | "licenseExpiry"
    | "usageRestrictions"
    | "requiresAcknowledgment"
  >;
}

export function MediaPublicationPanel({
  mediaId,
  item,
}: MediaPublicationPanelProps) {
  const t = useI18n();
  const review = useQuery(api.mediaPublications.getReview, { mediaId });
  const updateRights = useMutation(api.media.updateRights);
  const approve = useMutation(api.mediaPublications.approve);
  const unpublish = useMutation(api.mediaPublications.unpublish);
  const setOriginalDownload = useMutation(
    api.mediaPublications.setOriginalDownload,
  );
  const [rightsStatus, setRightsStatus] = useState<RightsStatus>(
    item.rightsStatus ?? "unknown",
  );
  const [licenseType, setLicenseType] = useState<LicenseType | "">(
    item.licenseType ?? "",
  );
  const [licenseExpiry, setLicenseExpiry] = useState(
    item.licenseExpiry
      ? new Date(item.licenseExpiry).toISOString().slice(0, 10)
      : "",
  );
  const [usageRestrictions, setUsageRestrictions] = useState(
    item.usageRestrictions ?? "",
  );
  const [requiresAcknowledgment, setRequiresAcknowledgment] = useState(
    item.requiresAcknowledgment ?? false,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(operation: () => Promise<unknown>) {
    setError(null);
    setIsSaving(true);
    try {
      await operation();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("mediaPage.publication.failed"),
      );
    } finally {
      setIsSaving(false);
    }
  }

  function saveRights() {
    const parsed = expirySchema.safeParse(licenseExpiry);
    if (
      !parsed.success ||
      (licenseExpiry &&
        Number.isNaN(Date.parse(`${licenseExpiry}T23:59:59.999Z`)))
    ) {
      setError(t("mediaPage.publication.invalidExpiry"));
      return;
    }
    void run(() =>
      updateRights({
        mediaId,
        rightsStatus,
        licenseType: licenseType || null,
        licenseExpiry: licenseExpiry
          ? Date.parse(`${licenseExpiry}T23:59:59.999Z`)
          : null,
        usageRestrictions: usageRestrictions.trim() || null,
        requiresAcknowledgment,
      }),
    );
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
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs text-zinc-300">
                  <span>{t("mediaPage.publication.rightsStatus")}</span>
                  <select
                    value={rightsStatus}
                    onChange={(event) =>
                      setRightsStatus(
                        rightsStatuses.find(
                          (status) => status === event.target.value,
                        ) ?? "unknown",
                      )
                    }
                    className="w-full rounded border border-white/10 bg-zinc-950 p-2"
                  >
                    {rightsStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs text-zinc-300">
                  <span>{t("mediaPage.publication.licenseType")}</span>
                  <select
                    value={licenseType}
                    onChange={(event) =>
                      setLicenseType(
                        licenseTypes.find(
                          (license) => license === event.target.value,
                        ) ?? "",
                      )
                    }
                    className="w-full rounded border border-white/10 bg-zinc-950 p-2"
                  >
                    <option value="">
                      {t("mediaPage.publication.noLicense")}
                    </option>
                    {licenseTypes.map((license) => (
                      <option key={license} value={license}>
                        {license.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs text-zinc-300">
                  <span>{t("mediaPage.publication.expiry")}</span>
                  <input
                    type="date"
                    value={licenseExpiry}
                    onChange={(event) => setLicenseExpiry(event.target.value)}
                    className="w-full rounded border border-white/10 bg-zinc-950 p-2"
                  />
                </label>
                <label className="space-y-1 text-xs text-zinc-300">
                  <span>{t("mediaPage.publication.restrictions")}</span>
                  <input
                    type="text"
                    value={usageRestrictions}
                    onChange={(event) =>
                      setUsageRestrictions(event.target.value)
                    }
                    className="w-full rounded border border-white/10 bg-zinc-950 p-2"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={requiresAcknowledgment}
                  onChange={(event) =>
                    setRequiresAcknowledgment(event.target.checked)
                  }
                />
                {t("mediaPage.publication.acknowledgment")}
              </label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isSaving}
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
                      isSaving ||
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
                {review.status !== "private" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isSaving}
                    onClick={() => void run(() => unpublish({ mediaId }))}
                  >
                    {t("mediaPage.publication.unpublish")}
                  </Button>
                )}
              </div>
              {review.status === "approved" && (
                <label className="flex items-center gap-2 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={review.originalDownloadAllowed}
                    disabled={isSaving}
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
          {error && (
            <p role="alert" className="text-xs text-red-300">
              {error}
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
