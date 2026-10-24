"use client";

import { Button } from "@v1/ui/button";
import { FormMessage } from "@v1/ui/form-message";
import { cn } from "@v1/ui/utils";
import { AlertTriangle, History, Info, RotateCcw } from "lucide-react";
import { type ReactNode, useEffect, useEffectEvent, useRef } from "react";
import { useClientRelativeTime } from "@/hooks/use-client-date-format";
import type { RecordSaveFailure } from "@/lib/record-form";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

/** The parts of a record form session the notices read and act on. */
export interface RecordFormNoticeSession {
  recoveryOffer: {
    savedAt: number;
    fields: string[];
    recordChanged: boolean;
  } | null;
  restoreRecovered: () => void;
  discardRecovered: () => void;
  remote: { changedFields: string[]; overlappingFields: string[] } | null;
  applyLatest: () => void;
  discardChanges: () => void;
  overlaps: Record<string, unknown>;
  takeTheirValue: (field: string) => void;
  keepMyValue: (field: string) => void;
  failure: RecordSaveFailure | null;
  retry: () => Promise<boolean>;
  saving: boolean;
  keepsDeviceCopy: boolean;
}

interface RecordFormNoticesProps {
  session: RecordFormNoticeSession;
  fieldLabel: (field: string) => string;
  /** A colleague's value as text for a field whose form value is not text. */
  fieldValue?: (field: string, value: unknown) => string | null;
  /** Shows a field, switching tabs if needed, and focuses it. */
  onGoToField?: (field: string) => void;
}

function Notice({
  tone,
  icon,
  role,
  children,
  actions,
}: {
  tone: "error" | "warning" | "info";
  icon: ReactNode;
  role: "alert" | "status";
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      role={role}
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4 text-sm sm:flex-row sm:items-start",
        tone === "error" &&
          "border-destructive/50 bg-destructive/10 text-destructive",
        tone === "warning" &&
          "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        tone === "info" && "border-border bg-secondary/40 text-foreground",
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1 space-y-2">{children}</div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

/** A colleague's value as text, when it is simple enough to show. */
function shownValue(value: unknown) {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return null;
}

/**
 * What a record form needs to tell staff about their input: recovered input
 * after an interruption, colleagues' saves, and why a save did not happen,
 * each with the action that resolves it.
 */
export function RecordFormNotices({
  session,
  fieldLabel,
  fieldValue,
  onGoToField,
}: RecordFormNoticesProps) {
  const t = useScopedI18n("recordForm.notices");
  const locale = useCurrentLocale();
  const savedAgo = useClientRelativeTime(
    session.recoveryOffer?.savedAt,
    locale,
    { addSuffix: true },
  );
  const fieldList = (fields: string[]) => fields.map(fieldLabel).join(", ");
  const { failure, remote, recoveryOffer } = session;
  // A save refused for its fields takes staff to the first field to fix.
  // Otherwise the save, usually started far below these notices, brings its
  // outcome into view and focus, like an error summary.
  const noticesRef = useRef<HTMLDivElement>(null);
  // Only a new failure moves focus, never a later render of the form.
  const showFailure = useEffectEvent((failure: RecordSaveFailure) => {
    const notices = noticesRef.current;
    if (!notices) return;
    const fields =
      failure.kind === "invalid"
        ? failure.fields
        : failure.kind === "field"
          ? [failure.field]
          : [];
    const shown = firstShownFieldInError(
      notices.closest("form") ?? document.body,
      fields,
    );
    if (shown) {
      shown.focus();
      return;
    }
    const [hidden] = fields;
    if (hidden && onGoToField) {
      onGoToField(hidden);
      return;
    }
    notices.scrollIntoView({ block: "nearest" });
    notices.focus({ preventScroll: true });
  });
  useEffect(() => {
    if (failure) showFailure(failure);
  }, [failure]);
  const reviewActions = (
    <>
      <Button type="button" size="sm" onClick={session.applyLatest}>
        {t("applyLatest")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={session.discardChanges}
      >
        {t("discardMine")}
      </Button>
    </>
  );
  const goToField = (field: string) =>
    onGoToField ? (
      <Button
        key={field}
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onGoToField(field)}
      >
        {t("goToField", { field: fieldLabel(field) })}
      </Button>
    ) : null;

  return (
    <div
      ref={noticesRef}
      tabIndex={-1}
      className="space-y-3 outline-none empty:hidden"
    >
      {recoveryOffer ? (
        <Notice
          tone="info"
          role="status"
          icon={<History className="size-4" />}
          actions={
            <>
              <Button
                type="button"
                size="sm"
                onClick={session.restoreRecovered}
              >
                {t("restore")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={session.discardRecovered}
              >
                {t("discardRecovered")}
              </Button>
            </>
          }
        >
          <p className="font-medium">{t("recoveredTitle")}</p>
          <p>
            {t("recoveredBody", {
              fields: fieldList(recoveryOffer.fields),
              time: savedAgo,
            })}
          </p>
          {recoveryOffer.recordChanged ? <p>{t("recoveredChanged")}</p> : null}
        </Notice>
      ) : null}

      {failure?.kind === "conflict" ? (
        <Notice
          tone="error"
          role="alert"
          icon={<AlertTriangle className="size-4" />}
          actions={reviewActions}
        >
          <p className="font-medium">{failure.message}</p>
          {remote ? (
            <p>
              {t("changedByOthers", {
                fields: fieldList(remote.changedFields),
              })}
            </p>
          ) : null}
        </Notice>
      ) : null}

      {failure && failure.kind !== "conflict" ? (
        <Notice
          tone={failure.kind === "locked" ? "warning" : "error"}
          role="alert"
          icon={<AlertTriangle className="size-4" />}
          actions={
            failure.kind === "failed" ? (
              <Button
                type="button"
                size="sm"
                disabled={session.saving}
                onClick={() => void session.retry()}
              >
                <RotateCcw className="mr-2 size-4" />
                {t("retry")}
              </Button>
            ) : failure.kind === "field" ? (
              goToField(failure.field)
            ) : undefined
          }
        >
          <p className="font-medium">{failure.message}</p>
          {failure.kind === "invalid" ? (
            <div className="flex flex-wrap gap-2">
              {failure.fields.map(goToField)}
            </div>
          ) : null}
          {failure.kind === "denied" || failure.kind === "failed" ? (
            <p>
              {session.keepsDeviceCopy
                ? t("inputKeptOnDevice")
                : t("inputKept")}
            </p>
          ) : null}
        </Notice>
      ) : null}

      {remote && failure?.kind !== "conflict" ? (
        <Notice
          tone="warning"
          role="status"
          icon={<Info className="size-4" />}
          actions={reviewActions}
        >
          <p className="font-medium">
            {t("remoteChanged", { fields: fieldList(remote.changedFields) })}
          </p>
          {remote.overlappingFields.length > 0 ? (
            <p>
              {t("remoteOverlap", {
                fields: fieldList(remote.overlappingFields),
              })}
            </p>
          ) : (
            <p>{t("remoteKeepsYours")}</p>
          )}
        </Notice>
      ) : null}

      {Object.entries(session.overlaps).map(([field, theirValue]) => {
        const shown = fieldValue?.(field, theirValue) ?? shownValue(theirValue);
        return (
          <Notice
            key={field}
            tone="warning"
            role="status"
            icon={<Info className="size-4" />}
            actions={
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => session.takeTheirValue(field)}
                >
                  {t("useTheirs")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => session.keepMyValue(field)}
                >
                  {t("keepMine")}
                </Button>
              </>
            }
          >
            <p>
              {shown === null
                ? t("overlapChanged", { field: fieldLabel(field) })
                : t("overlapValue", { field: fieldLabel(field), value: shown })}
            </p>
          </Notice>
        );
      })}
    </div>
  );
}

/** The record left the state in which this form may change it. */
export function RecordLockedNotice({ message }: { message: string }) {
  return (
    <Notice
      tone="warning"
      role="alert"
      icon={<AlertTriangle className="size-4" />}
    >
      <p>{message}</p>
    </Notice>
  );
}

export function fieldErrorId(field: string) {
  return `${field}-error`;
}

/** Accessible link between an input and its error message. */
export function fieldErrorProps(field: string, message: string | undefined) {
  return message
    ? {
        "aria-invalid": true as const,
        "aria-describedby": fieldErrorId(field),
      }
    : {};
}

/** The first input on screen, in reading order, described by a field's error. */
function firstShownFieldInError(container: Element, fields: string[]) {
  const errorIds = new Set(fields.map(fieldErrorId));
  return Array.from(
    container.querySelectorAll<HTMLElement>("[aria-describedby]"),
  ).find((element) =>
    element
      .getAttribute("aria-describedby")
      ?.split(/\s+/)
      .some((id) => errorIds.has(id)),
  );
}

/**
 * Focuses the first field with an error, in the order `errors` was built
 * (reading order); keys are the fields' element ids. False when none.
 */
export function focusFirstFieldInError(
  errors: Record<string, string | undefined>,
) {
  const first = Object.keys(errors).find((field) => errors[field]);
  if (!first) return false;
  document.getElementById(first)?.focus();
  return true;
}

/** A field's error, placed under its input. */
export function FieldError({
  field,
  message,
}: {
  field: string;
  message: string | undefined;
}) {
  if (!message) return null;
  return (
    <FormMessage className="text-xs" id={fieldErrorId(field)}>
      {message}
    </FormMessage>
  );
}
