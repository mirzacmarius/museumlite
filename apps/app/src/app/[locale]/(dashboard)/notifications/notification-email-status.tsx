"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Mail } from "lucide-react";
import { useState } from "react";
import { useClientRelativeTime } from "@/hooks/use-client-date-format";
import { useEmailRetryErrorMessage } from "@/hooks/use-notification-error-message";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

export type NotificationEmailOutcome = NonNullable<
  FunctionReturnType<
    typeof api.notifications.getNotificationCenter
  >["notifications"][number]["email"]
>;
type ErrorCode = NonNullable<NotificationEmailOutcome["lastErrorCode"]>;
type Translate = ReturnType<typeof useScopedI18n<"notificationsPage.email">>;

function reasonLabel(
  code: ErrorCode | undefined,
  responseStatus: number | undefined,
  t: Translate,
) {
  switch (code) {
    case undefined:
      return null;
    case "http_error":
      return t("reasons.http_error", { status: responseStatus ?? "?" });
    case "timeout":
      return t("reasons.timeout");
    case "network_error":
      return t("reasons.network_error");
    case "attempt_lost":
      return t("reasons.attempt_lost");
    case "event_expired":
      return t("reasons.event_expired");
    case "recipient_removed":
      return t("reasons.recipient_removed");
    case "access_revoked":
      return t("reasons.access_revoked");
    case "email_disabled":
      return t("reasons.email_disabled");
    case "address_missing":
      return t("reasons.address_missing");
    case "channel_unavailable":
      return t("reasons.channel_unavailable");
    case "digest_empty":
      return t("reasons.digest_empty");
  }
}

/** What happened to the email, for a notification emailed on its own. */
function instantSummary(
  email: NotificationEmailOutcome,
  times: { completed: string; next: string },
  t: Translate,
) {
  switch (email.status) {
    case "succeeded":
      return t("sent", { time: times.completed });
    case "pending":
      return email.attemptCount > 0 && !email.inFlight
        ? t("retrying", { time: times.next })
        : t("sending");
    case "cancelled":
      return t("notSent");
    case "failed_transient":
    case "failed_permanent":
      return t("notDelivered");
  }
}

/** What happened to the digest that carries the notification. */
function digestSummary(
  email: NotificationEmailOutcome,
  digest: NonNullable<NotificationEmailOutcome["digest"]>,
  times: { completed: string; next: string },
  t: Translate,
) {
  const daily = digest.cadence === "daily";
  if (digest.excludedReason) {
    return t("digest.leftOut");
  }
  if (
    email.status === "pending" &&
    email.attemptCount === 0 &&
    !email.inFlight
  ) {
    return daily
      ? t("digest.waitingDaily", { time: times.next })
      : t("digest.waitingWeekly", { time: times.next });
  }
  if (email.status === "succeeded") {
    return daily
      ? t("digest.sentDaily", { time: times.completed })
      : t("digest.sentWeekly", { time: times.completed });
  }
  return instantSummary(email, times, t);
}

function outcomeLabel(
  outcome: "succeeded" | "failed_transient" | "failed_permanent",
  t: Translate,
) {
  switch (outcome) {
    case "succeeded":
      return t("outcome.succeeded");
    case "failed_transient":
      return t("outcome.failed_transient");
    case "failed_permanent":
      return t("outcome.failed_permanent");
  }
}

function RelativeTime({ timestamp }: { timestamp: number }) {
  const locale = useCurrentLocale();
  return <>{useClientRelativeTime(timestamp, locale, { addSuffix: true })}</>;
}

function EmailAttempts({ email }: { email: NotificationEmailOutcome }) {
  const t = useScopedI18n("notificationsPage.email");
  const trace = useQuery(api.notificationEmails.get, {
    deliveryId: email.deliveryId,
  });
  if (trace === undefined) return null;
  if (!trace || trace.attempts.length === 0) {
    return <p>{t("noAttempts")}</p>;
  }
  return (
    <ol className="space-y-1">
      {trace.attempts.map((attempt) => (
        <li
          key={attempt.attemptNumber}
          className="flex flex-wrap items-center gap-x-2"
        >
          <span className="font-medium text-foreground">
            {t("attempt", { number: attempt.attemptNumber })}
          </span>
          <span>{outcomeLabel(attempt.outcome, t)}</span>
          {attempt.errorCode ? (
            <span>
              {reasonLabel(attempt.errorCode, attempt.responseStatus, t)}
            </span>
          ) : null}
          <span>{t("duration", { ms: attempt.durationMs })}</span>
          <span className="ml-auto text-white/60">
            <RelativeTime timestamp={attempt.startedAt} />
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * What happened to the email that carried a notification, on its own or in
 * a digest, with the recipient's own retry for an email that failed or was
 * not sent. Retrying a digest resends every notification it still may list.
 */
export function NotificationEmailStatus({
  email,
}: {
  email: NotificationEmailOutcome;
}) {
  const t = useScopedI18n("notificationsPage.email");
  const locale = useCurrentLocale();
  const retryEmail = useMutation(api.notificationEmails.retry);
  const retryErrorMessage = useEmailRetryErrorMessage();
  const [showDetails, setShowDetails] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const completedAt = useClientRelativeTime(email.completedAt, locale, {
    addSuffix: true,
  });
  const nextAttempt = useClientRelativeTime(email.nextAttemptAt, locale, {
    addSuffix: true,
  });

  const times = { completed: completedAt, next: nextAttempt };
  const leftOut = email.digest?.excludedReason;
  const summary = email.digest
    ? digestSummary(email, email.digest, times, t)
    : instantSummary(email, times, t);
  const retrying =
    email.status === "pending" && email.attemptCount > 0 && !email.inFlight;
  const reason = leftOut
    ? reasonLabel(leftOut, undefined, t)
    : email.status === "succeeded" || (email.status === "pending" && !retrying)
      ? null
      : reasonLabel(email.lastErrorCode, email.lastResponseStatus, t);
  const canRetry =
    !leftOut &&
    (email.status === "failed_transient" ||
      email.status === "failed_permanent" ||
      email.status === "cancelled");

  async function handleRetry() {
    setRetryError(null);
    setIsRetrying(true);
    try {
      await retryEmail({ deliveryId: email.deliveryId });
    } catch (error) {
      setRetryError(retryErrorMessage(error));
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <div className="space-y-2 pb-3 pl-16 pr-4 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5">
          <Mail className="size-3.5" strokeWidth={1.75} aria-hidden />
          <span
            className={
              canRetry ? "font-medium text-destructive" : "text-foreground"
            }
          >
            {summary}
          </span>
        </span>
        {reason ? <span>{reason}</span> : null}
        {canRetry ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={isRetrying}
            onClick={handleRetry}
          >
            {t("retry")}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          aria-expanded={showDetails}
          onClick={() => setShowDetails((open) => !open)}
        >
          {showDetails ? t("hideDetails") : t("details")}
        </Button>
      </div>
      {retryError ? (
        <p role="alert" className="text-destructive">
          {retryError}
        </p>
      ) : null}
      {showDetails ? <EmailAttempts email={email} /> : null}
    </div>
  );
}
