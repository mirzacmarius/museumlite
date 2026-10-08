"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import { webhookErrorCodeFromError } from "@v1/backend/convex/utils/webhookErrors";
import { Badge } from "@v1/ui/badge";
import type { FunctionReturnType } from "convex/server";
import { useClientRelativeTime } from "@/hooks/use-client-date-format";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

export type DeliverySummary = FunctionReturnType<
  typeof api.webhookDeliveries.list
>["page"][number];
export type DeliveryStatus = DeliverySummary["status"];
type ErrorCode = NonNullable<DeliverySummary["lastErrorCode"]>;
type Translate = ReturnType<typeof useScopedI18n<"webhookDeliveries">>;

export const DELIVERY_STATUSES: DeliveryStatus[] = [
  "pending",
  "succeeded",
  "failed_transient",
  "failed_permanent",
  "cancelled",
];

export function statusLabel(status: DeliveryStatus, t: Translate) {
  switch (status) {
    case "pending":
      return t("status.pending");
    case "succeeded":
      return t("status.succeeded");
    case "failed_transient":
      return t("status.failed_transient");
    case "failed_permanent":
      return t("status.failed_permanent");
    case "cancelled":
      return t("status.cancelled");
  }
}

export function outcomeLabel(
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

export function reasonLabel(
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
    case "endpoint_deleted":
      return t("reasons.endpoint_deleted");
    case "endpoint_disabled":
      return t("reasons.endpoint_disabled");
    case "endpoint_insecure":
      return t("reasons.endpoint_insecure");
    case "endpoint_unsubscribed":
      return t("reasons.endpoint_unsubscribed");
  }
}

export function DeliveryStatusBadge({
  delivery,
}: {
  delivery: Pick<
    DeliverySummary,
    "status" | "seriesAttempts" | "inFlight" | "attemptCount"
  >;
}) {
  const t = useScopedI18n("webhookDeliveries");
  const retrying =
    delivery.status === "pending" &&
    (delivery.seriesAttempts > 0 || delivery.attemptCount > 0) &&
    !delivery.inFlight;
  const label = retrying
    ? t("status.retrying")
    : statusLabel(delivery.status, t);
  const variant =
    delivery.status === "succeeded"
      ? "default"
      : delivery.status === "failed_transient" ||
          delivery.status === "failed_permanent"
        ? "destructive"
        : delivery.status === "cancelled"
          ? "outline"
          : "secondary";
  return <Badge variant={variant}>{label}</Badge>;
}

export function RelativeTime({ timestamp }: { timestamp: number }) {
  const locale = useCurrentLocale();
  return <>{useClientRelativeTime(timestamp, locale, { addSuffix: true })}</>;
}

/** Translates coded webhook failures; other server text is never shown. */
export function useWebhookErrorMessage() {
  const t = useScopedI18n("webhookDeliveries");
  return (error: unknown) => {
    switch (webhookErrorCodeFromError(error)) {
      case "WEBHOOK_NAME_REQUIRED":
        return t("errors.WEBHOOK_NAME_REQUIRED");
      case "WEBHOOK_URL_INVALID":
        return t("errors.WEBHOOK_URL_INVALID");
      case "WEBHOOK_EVENT_UNSUPPORTED":
        return t("errors.WEBHOOK_EVENT_UNSUPPORTED");
      case "WEBHOOK_LIMIT_REACHED":
        return t("errors.WEBHOOK_LIMIT_REACHED");
      case "WEBHOOK_NOT_FOUND":
        return t("errors.WEBHOOK_NOT_FOUND");
      case "WEBHOOK_DISABLED":
        return t("errors.WEBHOOK_DISABLED");
      case "WEBHOOK_NOT_SUBSCRIBED":
        return t("errors.WEBHOOK_NOT_SUBSCRIBED");
      case "DELIVERY_NOT_FOUND":
        return t("errors.DELIVERY_NOT_FOUND");
      case "DELIVERY_NOT_RETRYABLE":
        return t("errors.DELIVERY_NOT_RETRYABLE");
      case null:
        return t("errors.fallback");
    }
  };
}
