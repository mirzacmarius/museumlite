"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useState } from "react";
import { z } from "zod";
import { usePermissions } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";

const assessmentSchema = z.object({
  assessedAt: z.number().finite().positive(),
  condition: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  observations: z
    .array(
      z.object({
        area: z.string().trim().min(1),
        description: z.string().trim().min(1),
        severity: z.enum(["minor", "moderate", "severe"]),
      }),
    )
    .max(100),
});

interface ObservationInput {
  area: string;
  description: string;
  severity: "minor" | "moderate" | "severe";
}

type ObservationDraft = ObservationInput & { id: string };

export function ConditionAssessmentPanel({
  collectionId,
}: {
  collectionId: Id<"collections">;
}) {
  const t = useScopedI18n("conditionAssessments");
  const { hasPermission } = usePermissions();
  const detail = useQuery(api.conditionAssessments.getForObject, {
    collectionId,
  });
  const history = usePaginatedQuery(
    api.conditionAssessments.listForObject,
    { collectionId },
    { initialNumItems: 20 },
  );
  const media = useQuery(
    api.media.list,
    hasPermission("media.read") ? { collectionId } : "skip",
  );
  const create = useMutation(api.conditionAssessments.create);
  const accept = useMutation(api.conditionAssessments.accept);
  const generateUploadUrl = useMutation(api.media.generateUploadUrl);
  const createMedia = useMutation(api.media.create);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [condition, setCondition] = useState("");
  const [summary, setSummary] = useState("");
  const [observations, setObservations] = useState<ObservationDraft[]>([]);
  const [photoIds, setPhotoIds] = useState<Id<"mediaFiles">[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const canCapture = hasPermission("collections.update");
  const canAccept = hasPermission("collections.accept_condition");
  const canUpload =
    hasPermission("media.upload") && hasPermission("media.read");

  async function saveDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const parsed = assessmentSchema.safeParse({
      assessedAt: new Date(`${date}T12:00:00`).getTime(),
      condition,
      summary,
      observations: observations.map(
        ({ id: _id, ...observation }) => observation,
      ),
    });
    if (!parsed.success) {
      setError(t("validation"));
      return;
    }
    setBusy(true);
    try {
      await create({ collectionId, ...parsed.data, photos: photoIds });
      setCondition("");
      setSummary("");
      setObservations([]);
      setPhotoIds([]);
      setNotice(t("draftSaved"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhoto(file: File) {
    setError("");
    setNotice("");
    if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) {
      setError(t("invalidPhoto"));
      return;
    }
    setBusy(true);
    try {
      if (!detail) throw new Error(t("saveFailed"));
      const upload = await generateUploadUrl({
        organizationId: detail.organizationId,
        collectionId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });
      const response = await fetch(upload.uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error(t("uploadFailed"));
      const result = z
        .object({ storageId: z.string() })
        .parse(await response.json());
      const mediaId = await createMedia({
        organizationId: detail.organizationId,
        collectionId,
        storageId: result.storageId as Id<"_storage">,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });
      setPhotoIds((ids) => [...ids, mediaId]);
      setNotice(t("uploaded"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("uploadFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function acceptDraft(assessmentId: Id<"conditionAssessments">) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await accept({ assessmentId });
      setNotice(t("accepted"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("acceptFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (!detail) return <p className="text-sm text-white/60">{t("loading")}</p>;

  return (
    <section
      aria-label={t("title")}
      className="space-y-5 rounded-xl border border-white/10 bg-black p-5 text-white"
    >
      <div>
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="mt-1 text-sm text-white/60">{t("description")}</p>
      </div>
      <div className="rounded-lg border border-white/10 p-4">
        <p className="text-xs uppercase tracking-wide text-white/60">
          {t("current")}
        </p>
        <p className="mt-1 font-medium">
          {detail.current.condition ?? t("unknown")}
        </p>
        <p className="text-xs text-white/60">
          {detail.current.source === "assessment"
            ? t("acceptedSource")
            : t("legacyUncertain")}
        </p>
      </div>
      {detail.comparison.currentCondition &&
      (detail.comparison.previousAccepted ||
        detail.comparison.legacyCondition) ? (
        <div className="rounded-lg border border-white/10 p-4">
          <h3 className="text-sm font-medium">{t("compareTitle")}</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-white/60">
                {t("compareBefore")}
              </p>
              <p className="mt-1 text-sm">
                {detail.comparison.previousAccepted?.condition ??
                  detail.comparison.legacyCondition ??
                  t("unknown")}
              </p>
              {detail.comparison.previousAccepted ? (
                <p className="mt-1 text-xs text-white/60">
                  {new Date(
                    detail.comparison.previousAccepted.assessedAt,
                  ).toLocaleDateString()}
                </p>
              ) : (
                <p className="mt-1 text-xs text-white/60">
                  {t("legacyUncertain")}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-white/60">
                {t("compareAfter")}
              </p>
              <p className="mt-1 text-sm">
                {detail.comparison.currentCondition}
              </p>
              <p className="mt-1 text-xs text-white/60">
                {t("acceptedSource")}
              </p>
            </div>
          </div>
        </div>
      ) : null}
      {detail.legacy.condition || detail.legacy.history.length > 0 ? (
        <details className="rounded-lg border border-white/10 p-4">
          <summary className="cursor-pointer text-sm">
            {t("legacyHistory")}
          </summary>
          <p className="mt-2 text-xs text-white/60">{t("legacyUncertain")}</p>
          {detail.legacy.condition ? (
            <p className="mt-2 text-sm">{detail.legacy.condition}</p>
          ) : null}
          {detail.legacy.history.map((entry) => (
            <p
              className="mt-2 text-sm"
              key={`${entry.changedAt}-${entry.condition}`}
            >
              {new Date(entry.changedAt).toLocaleDateString()}:{" "}
              {entry.condition}
              {entry.note ? ` — ${entry.note}` : ""}
            </p>
          ))}
        </details>
      ) : null}

      {canCapture ? (
        <form
          onSubmit={saveDraft}
          className="space-y-3 rounded-lg border border-white/10 p-4"
        >
          <h3 className="font-medium">{t("newAssessment")}</h3>
          <label className="block text-sm">
            {t("date")}
            <input
              type="date"
              required
              max={new Date().toISOString().slice(0, 10)}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="mt-1 block w-full rounded border border-white/20 bg-black p-2"
            />
          </label>
          <label className="block text-sm">
            {t("condition")}
            <input
              required
              value={condition}
              onChange={(event) => setCondition(event.target.value)}
              className="mt-1 block w-full rounded border border-white/20 bg-black p-2"
            />
          </label>
          <label className="block text-sm">
            {t("summary")}
            <textarea
              required
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              className="mt-1 block w-full rounded border border-white/20 bg-black p-2"
            />
          </label>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">{t("observations")}</span>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setObservations([
                    ...observations,
                    {
                      id: crypto.randomUUID(),
                      area: "",
                      description: "",
                      severity: "minor",
                    },
                  ])
                }
              >
                {t("addObservation")}
              </Button>
            </div>
            {observations.map((item, index) => (
              <div
                className="grid gap-2 rounded border border-white/10 p-3 sm:grid-cols-3"
                key={item.id}
              >
                <input
                  aria-label={t("area")}
                  placeholder={t("area")}
                  value={item.area}
                  onChange={(event) =>
                    setObservations(
                      observations.map((entry, position) =>
                        position === index
                          ? { ...entry, area: event.target.value }
                          : entry,
                      ),
                    )
                  }
                  className="rounded border border-white/20 bg-black p-2"
                />
                <input
                  aria-label={t("descriptionField")}
                  placeholder={t("descriptionField")}
                  value={item.description}
                  onChange={(event) =>
                    setObservations(
                      observations.map((entry, position) =>
                        position === index
                          ? { ...entry, description: event.target.value }
                          : entry,
                      ),
                    )
                  }
                  className="rounded border border-white/20 bg-black p-2"
                />
                <select
                  aria-label={t("severity")}
                  value={item.severity}
                  onChange={(event) =>
                    setObservations(
                      observations.map((entry, position) =>
                        position === index
                          ? {
                              ...entry,
                              severity: event.target
                                .value as ObservationInput["severity"],
                            }
                          : entry,
                      ),
                    )
                  }
                  className="rounded border border-white/20 bg-black p-2"
                >
                  <option value="minor">{t("minor")}</option>
                  <option value="moderate">{t("moderate")}</option>
                  <option value="severe">{t("severe")}</option>
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setObservations(
                      observations.filter((_, position) => position !== index),
                    )
                  }
                >
                  {t("remove")}
                </Button>
              </div>
            ))}
          </div>
          {media ? (
            <div className="space-y-2">
              <p className="text-sm">{t("photos")}</p>
              {media
                .filter(
                  (item) =>
                    item.fileType === "image" &&
                    item.uploadStatus === "completed",
                )
                .map((item) => (
                  <label
                    key={item._id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={photoIds.includes(item._id)}
                      onChange={(event) =>
                        setPhotoIds(
                          event.target.checked
                            ? [...photoIds, item._id]
                            : photoIds.filter((id) => id !== item._id),
                        )
                      }
                    />
                    {item.fileName}
                  </label>
                ))}
            </div>
          ) : null}
          {canUpload ? (
            <label className="block text-sm">
              {t("uploadPhoto")}
              <input
                type="file"
                accept="image/*"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadPhoto(file);
                }}
                className="mt-1 block w-full text-sm"
              />
            </label>
          ) : null}
          <Button type="submit" disabled={busy}>
            {t("saveDraft")}
          </Button>
        </form>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-green-300">
          {notice}
        </p>
      ) : null}
      <div className="space-y-3">
        <h3 className="font-medium">{t("history")}</h3>
        {history.results.length === 0 &&
        history.status !== "LoadingFirstPage" ? (
          <p className="text-sm text-white/60">{t("none")}</p>
        ) : null}
        {history.results.map((assessment) => (
          <article
            key={assessment._id}
            className="rounded-lg border border-white/10 p-4"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <strong>{assessment.condition}</strong>
              <span className="text-sm text-white/60">
                {new Date(assessment.assessedAt).toLocaleDateString()}
              </span>
            </div>
            <p className="mt-1 text-sm text-white/60">
              {assessment.assessorName} ·{" "}
              {assessment.status === "accepted"
                ? t("acceptedStatus")
                : t("draftStatus")}
            </p>
            <p className="mt-2 text-sm">{assessment.summary}</p>
            {assessment.observations.map((item) => (
              <p
                className="mt-1 text-sm"
                key={`${item.area}:${item.description}:${item.severity}`}
              >
                {item.area}: {item.description} ({t(item.severity)})
              </p>
            ))}
            {assessment.photos.map((photo) =>
              photo.url ? (
                <a
                  key={photo.id}
                  href={photo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mr-3 text-sm underline"
                >
                  {photo.name}
                </a>
              ) : (
                <span key={photo.id} className="mr-3 text-sm text-amber-300">
                  {t("missingPhoto")}: {photo.name}
                </span>
              ),
            )}
            {assessment.status === "draft" && canAccept ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void acceptDraft(assessment._id)}
                className="mt-3 block"
              >
                {t("accept")}
              </Button>
            ) : null}
          </article>
        ))}
        {history.status === "CanLoadMore" ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => history.loadMore(20)}
          >
            {t("moreHistory")}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
