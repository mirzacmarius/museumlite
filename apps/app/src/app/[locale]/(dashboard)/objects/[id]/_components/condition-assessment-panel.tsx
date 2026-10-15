"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useRef, useState } from "react";
import { z } from "zod";
import { ActionRefusal, type Refusal } from "@/components/action-refusal";
import { ClientDate } from "@/components/client-date";
import { ConditionCombobox } from "@/components/condition-combobox";
import { usePermissions } from "@/components/permission-gate";
import {
  FieldError,
  fieldErrorProps,
  focusFirstFieldInError,
} from "@/components/record-form/record-form-notices";
import { useCapabilityErrorMessage } from "@/hooks/use-capability-error-message";
import { useCurrentLocale, useI18n, useScopedI18n } from "@/locales/client";
import { formatConditionLabel } from "./condition-display";

interface ObservationInput {
  area: string;
  description: string;
  severity: "minor" | "moderate" | "severe";
}

type ObservationDraft = ObservationInput & { id: string };

const FIELD = {
  date: "assessment-date",
  condition: "assessment-condition",
  summary: "assessment-summary",
} as const;

function observationField(id: string, part: "area" | "description") {
  return `assessment-${id}-${part}`;
}

/** A date input's value for a moment, in the device's time zone. */
function localDateValue(time: number) {
  const date = new Date(time);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * When an assessment on `day` took place: midday, or now when midday has not
 * come yet, so a morning assessment of today is never dated in the future.
 */
function assessedAtFor(day: string, now: number) {
  return Math.min(new Date(`${day}T12:00:00`).getTime(), now);
}

const requiredText = z.string().trim().min(1);

const SOURCE_CAPTION = {
  assessment: "acceptedSource",
  legacy: "legacyUncertain",
  unknown: null,
} as const;

export function ConditionAssessmentPanel({
  collectionId,
}: {
  collectionId: Id<"collections">;
}) {
  const t = useScopedI18n("conditionAssessments");
  const translate = useI18n();
  const conditionLabel = (value: string) =>
    formatConditionLabel(value, translate);
  const { hasPermission } = usePermissions();
  const capabilityMessage = useCapabilityErrorMessage();
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
  const locale = useCurrentLocale();
  const [dayOpened] = useState(() => localDateValue(Date.now()));
  const nextObservationId = useRef(0);
  const photoInput = useRef<HTMLInputElement>(null);
  const [chosenDate, setChosenDate] = useState<string | null>(null);
  const [condition, setCondition] = useState("");
  const [summary, setSummary] = useState("");
  const [observations, setObservations] = useState<ObservationDraft[]>([]);
  const [photoIds, setPhotoIds] = useState<Id<"mediaFiles">[]>([]);
  const [busy, setBusy] = useState<"save" | "upload" | "accept" | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Shown where staff acted: in the form, or on the assessment they accepted.
  const [refusal, setRefusal] = useState<
    (Refusal & { at: "form" | Id<"conditionAssessments"> }) | null
  >(null);
  const [notice, setNotice] = useState("");
  const canCapture = hasPermission("collections.update");
  const canAccept = hasPermission("collections.accept_condition");
  const canUpload =
    hasPermission("media.upload") && hasPermission("media.read");
  const day = chosenDate ?? dayOpened;
  const completedImageMedia = (media ?? []).filter(
    (item) => item.fileType === "image" && item.uploadStatus === "completed",
  );

  function updateObservation(id: string, patch: Partial<ObservationInput>) {
    setObservations((previous) =>
      previous.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry,
      ),
    );
  }

  /** Field errors in reading order; empty when the draft can be saved. */
  function validate() {
    const errors: Record<string, string> = {};
    const currentDay = localDateValue(Date.now());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > currentDay) {
      errors[FIELD.date] = t("errors.date");
    }
    if (!requiredText.safeParse(condition).success) {
      errors[FIELD.condition] = t("errors.condition");
    }
    if (!requiredText.safeParse(summary).success) {
      errors[FIELD.summary] = t("errors.summary");
    }
    for (const observation of observations) {
      if (!requiredText.safeParse(observation.area).success) {
        errors[observationField(observation.id, "area")] = t("errors.area");
      }
      if (!requiredText.safeParse(observation.description).success) {
        errors[observationField(observation.id, "description")] =
          t("errors.observation");
      }
    }
    return errors;
  }

  async function saveDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRefusal(null);
    setNotice("");
    const errors = validate();
    setFieldErrors(errors);
    if (focusFirstFieldInError(errors)) return;
    setBusy("save");
    try {
      await create({
        collectionId,
        assessedAt: assessedAtFor(day, Date.now()),
        condition: condition.trim(),
        summary: summary.trim(),
        observations: observations.map(({ area, description, severity }) => ({
          area: area.trim(),
          description: description.trim(),
          severity,
        })),
        photos: photoIds,
      });
      setChosenDate(null);
      setCondition("");
      setSummary("");
      setObservations([]);
      setPhotoIds([]);
      setNotice(t("draftSaved"));
    } catch (cause) {
      setRefusal({
        at: "form",
        message: capabilityMessage(cause) ?? t("saveFailed"),
      });
    } finally {
      setBusy(null);
    }
  }

  async function uploadPhoto(file: File) {
    setRefusal(null);
    setNotice("");
    if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) {
      setRefusal({ at: "form", message: t("invalidPhoto") });
      return;
    }
    if (!detail) return;
    setBusy("upload");
    try {
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
      if (!response.ok) throw new Error("Upload failed");
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
        isPrimary: false,
      });
      setPhotoIds((ids) => [...ids, mediaId]);
      setNotice(t("uploaded"));
    } catch (cause) {
      setRefusal({
        at: "form",
        message: capabilityMessage(cause) ?? t("uploadFailed"),
      });
    } finally {
      setBusy(null);
    }
  }

  async function acceptDraft(assessmentId: Id<"conditionAssessments">) {
    setRefusal(null);
    setNotice("");
    setBusy("accept");
    try {
      await accept({ assessmentId });
      setNotice(t("accepted"));
    } catch (cause) {
      setRefusal({
        at: assessmentId,
        message: capabilityMessage(cause) ?? t("acceptFailed"),
      });
    } finally {
      setBusy(null);
    }
  }

  if (!detail) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {t("loading")}
      </p>
    );
  }
  const currentCaption = SOURCE_CAPTION[detail.current.source];
  const comparedBefore =
    detail.comparison.previousAccepted?.condition ??
    detail.comparison.legacyCondition;

  return (
    <section
      aria-labelledby="condition-assessments-title"
      className="space-y-5 rounded-xl border border-border bg-card p-4 text-card-foreground sm:p-5"
    >
      <div>
        <h2
          id="condition-assessments-title"
          className="text-base font-semibold"
        >
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <div className="rounded-lg border border-border p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("current")}
        </p>
        <p className="mt-1 break-words font-medium">
          {detail.current.condition
            ? conditionLabel(detail.current.condition)
            : t("unknown")}
        </p>
        {currentCaption ? (
          <p className="text-xs text-muted-foreground">{t(currentCaption)}</p>
        ) : null}
      </div>
      {detail.comparison.currentCondition && comparedBefore ? (
        <div className="rounded-lg border border-border p-4">
          <h3 className="text-sm font-medium">{t("compareTitle")}</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("compareBefore")}
              </p>
              <p className="mt-1 break-words text-sm">
                {conditionLabel(comparedBefore)}
              </p>
              {detail.comparison.previousAccepted ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  <ClientDate
                    timestamp={detail.comparison.previousAccepted.assessedAt}
                    locale={locale}
                  />
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("legacyUncertain")}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("compareAfter")}
              </p>
              <p className="mt-1 break-words text-sm">
                {conditionLabel(detail.comparison.currentCondition)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("acceptedSource")}
              </p>
            </div>
          </div>
        </div>
      ) : null}
      {detail.legacy.condition || detail.legacy.history.length > 0 ? (
        <details className="rounded-lg border border-border p-4">
          <summary className="cursor-pointer text-sm">
            {t("legacyHistory")}
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("legacyUncertain")}
          </p>
          {detail.legacy.condition ? (
            <p className="mt-2 text-sm">
              {conditionLabel(detail.legacy.condition)}
            </p>
          ) : null}
          {detail.legacy.history.map((entry) => (
            <p
              className="mt-2 break-words text-sm"
              key={`${entry.changedAt}-${entry.condition}`}
            >
              <ClientDate timestamp={entry.changedAt} locale={locale} />:{" "}
              {conditionLabel(entry.condition)}
              {entry.changedByName
                ? ` · ${translate("untranslatedRecords.objects.logs.byUser", {
                    name: entry.changedByName,
                  })}`
                : ""}
              {entry.note ? ` — ${entry.note}` : ""}
            </p>
          ))}
        </details>
      ) : null}

      {canCapture ? (
        <form
          noValidate
          onSubmit={saveDraft}
          className="space-y-4 rounded-lg border border-border p-4"
        >
          <h3 className="font-medium">{t("newAssessment")}</h3>
          <div className="space-y-2">
            <Label htmlFor={FIELD.date}>{t("date")}</Label>
            <Input
              id={FIELD.date}
              type="date"
              max={dayOpened}
              value={day}
              onChange={(event) => setChosenDate(event.target.value)}
              {...fieldErrorProps(FIELD.date, fieldErrors[FIELD.date])}
            />
            <FieldError field={FIELD.date} message={fieldErrors[FIELD.date]} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={FIELD.condition}>{t("condition")}</Label>
            <ConditionCombobox
              id={FIELD.condition}
              organizationId={detail.organizationId}
              value={condition}
              onValueChange={setCondition}
              {...fieldErrorProps(
                FIELD.condition,
                fieldErrors[FIELD.condition],
              )}
            />
            <FieldError
              field={FIELD.condition}
              message={fieldErrors[FIELD.condition]}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={FIELD.summary}>{t("summary")}</Label>
            <Textarea
              id={FIELD.summary}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              {...fieldErrorProps(FIELD.summary, fieldErrors[FIELD.summary])}
            />
            <FieldError
              field={FIELD.summary}
              message={fieldErrors[FIELD.summary]}
            />
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">{t("observations")}</span>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  nextObservationId.current += 1;
                  const id = `observation-${nextObservationId.current}`;
                  setObservations((previous) => [
                    ...previous,
                    { id, area: "", description: "", severity: "minor" },
                  ]);
                }}
              >
                {t("addObservation")}
              </Button>
            </div>
            {observations.map((item, index) => {
              const areaField = observationField(item.id, "area");
              const descriptionField = observationField(item.id, "description");
              return (
                <fieldset
                  className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2"
                  key={item.id}
                >
                  <legend className="px-1 text-sm font-medium">
                    {t("observationNumber", { number: index + 1 })}
                  </legend>
                  <div className="space-y-2">
                    <Label htmlFor={areaField}>{t("area")}</Label>
                    <Input
                      id={areaField}
                      value={item.area}
                      onChange={(event) =>
                        updateObservation(item.id, {
                          area: event.target.value,
                        })
                      }
                      {...fieldErrorProps(areaField, fieldErrors[areaField])}
                    />
                    <FieldError
                      field={areaField}
                      message={fieldErrors[areaField]}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`assessment-${item.id}-severity`}>
                      {t("severity")}
                    </Label>
                    <select
                      id={`assessment-${item.id}-severity`}
                      value={item.severity}
                      onChange={(event) =>
                        updateObservation(item.id, {
                          severity: event.target
                            .value as ObservationInput["severity"],
                        })
                      }
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="minor">{t("minor")}</option>
                      <option value="moderate">{t("moderate")}</option>
                      <option value="severe">{t("severe")}</option>
                    </select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor={descriptionField}>
                      {t("descriptionField")}
                    </Label>
                    <Textarea
                      id={descriptionField}
                      rows={2}
                      value={item.description}
                      onChange={(event) =>
                        updateObservation(item.id, {
                          description: event.target.value,
                        })
                      }
                      {...fieldErrorProps(
                        descriptionField,
                        fieldErrors[descriptionField],
                      )}
                    />
                    <FieldError
                      field={descriptionField}
                      message={fieldErrors[descriptionField]}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        setObservations((previous) =>
                          previous.filter((entry) => entry.id !== item.id),
                        )
                      }
                    >
                      {t("remove")}
                    </Button>
                  </div>
                </fieldset>
              );
            })}
          </div>
          {completedImageMedia.length > 0 ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t("photos")}</legend>
              {completedImageMedia.map((item) => (
                <label
                  key={item._id}
                  className="flex min-h-9 items-center gap-2 break-all text-sm"
                >
                  <input
                    type="checkbox"
                    className="size-4 shrink-0"
                    checked={photoIds.includes(item._id)}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setPhotoIds((previous) =>
                        checked
                          ? [...previous, item._id]
                          : previous.filter((id) => id !== item._id),
                      );
                    }}
                  />
                  {item.fileName}
                </label>
              ))}
            </fieldset>
          ) : null}
          {canUpload ? (
            <div>
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                onClick={() => photoInput.current?.click()}
              >
                {t("uploadPhoto")}
              </Button>
              <input
                ref={photoInput}
                aria-label={t("uploadPhoto")}
                hidden
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void uploadPhoto(file);
                }}
              />
            </div>
          ) : null}
          <ActionRefusal refusal={refusal?.at === "form" ? refusal : null} />
          <Button
            type="submit"
            disabled={busy !== null}
            className="w-full sm:w-auto"
          >
            {busy === "save" ? t("saving") : t("saveDraft")}
          </Button>
        </form>
      ) : null}
      {notice ? (
        <p
          role="status"
          className="text-sm text-emerald-700 dark:text-emerald-300"
        >
          {notice}
        </p>
      ) : null}
      <div className="space-y-3">
        <h3 className="font-medium">{t("history")}</h3>
        {history.results.length === 0 &&
        history.status !== "LoadingFirstPage" ? (
          <p className="text-sm text-muted-foreground">{t("none")}</p>
        ) : null}
        {history.results.map((assessment) => (
          <article
            key={assessment._id}
            className="rounded-lg border border-border p-4"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <strong className="break-words">
                {conditionLabel(assessment.condition)}
              </strong>
              <span className="text-sm text-muted-foreground">
                <ClientDate timestamp={assessment.assessedAt} locale={locale} />
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {assessment.assessorName} ·{" "}
              {assessment.status === "accepted"
                ? t("acceptedStatus")
                : t("draftStatus")}
            </p>
            <p className="mt-2 break-words text-sm">{assessment.summary}</p>
            {assessment.observations.map((item) => (
              <p
                className="mt-1 break-words text-sm"
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
                  className="mr-3 break-all text-sm underline"
                >
                  {photo.name}
                </a>
              ) : (
                <span
                  key={photo.id}
                  className="mr-3 text-sm text-amber-700 dark:text-amber-300"
                >
                  {t("missingPhoto")}: {photo.name}
                </span>
              ),
            )}
            <ActionRefusal
              className="mt-3"
              refusal={refusal?.at === assessment._id ? refusal : null}
            />
            {assessment.status === "draft" && canAccept ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                onClick={() => void acceptDraft(assessment._id)}
                className="mt-3 flex"
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
