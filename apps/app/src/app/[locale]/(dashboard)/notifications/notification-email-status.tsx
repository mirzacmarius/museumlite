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
  }
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
 * What happened to the email that accompanied a notification, with the
 * recipient's own retry for an email that failed or was not sent.
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

  const retrying =
    email.status === "pending" && email.attemptCount > 0 && !email.inFlight;
  const summary =
    email.status === "succeeded"
      ? t("sent", { time: completedAt })
      : email.status === "pending"
        ? retrying
          ? t("retrying", { time: nextAttempt })
          : t("sending")
        : email.status === "cancelled"
          ? t("notSent")
          : t("notDelivered");
  const reason =
    email.status === "succeeded" || (email.status === "pending" && !retrying)
      ? null
      : reasonLabel(email.lastErrorCode, email.lastResponseStatus, t);
  const canRetry =
    email.status === "failed_transient" ||
    email.status === "failed_permanent" ||
    email.status === "cancelled";

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
