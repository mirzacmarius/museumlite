"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { useReproductionErrorMessage } from "@/hooks/use-reproduction-error-message";
import { useScopedI18n } from "@/locales/client";
import { useRequestDateTime } from "../../_components/request-status";
import type { RequestView } from "./request-view";
import { Section } from "./section";

type Delivery = RequestView["deliveries"][number];

function DeliveryRow({
  delivery,
  canRetry,
}: {
  delivery: Delivery;
  canRetry: boolean;
}) {
  const t = useScopedI18n("reproductionRequests.delivery");
  const formatDateTime = useRequestDateTime();
  const errorMessage = useReproductionErrorMessage();
  const retry = useMutation(api.reproductionRequests.retryDelivery);
  const [saving, setSaving] = useState(false);
  const retryable =
    delivery.status !== "pending" && delivery.status !== "succeeded";

  const onRetry = async () => {
    setSaving(true);
    try {
      await retry({ deliveryId: delivery._id as Id<"reproductionDeliveries"> });
      toast.success(t("retried"));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="space-y-2 rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={delivery.status === "succeeded" ? "secondary" : "outline"}
          >
            {delivery.inFlight
              ? t("sending")
              : t(`statuses.${delivery.status}`)}
          </Badge>
          <span className="break-all">
            {t("to", { email: delivery.recipientEmail })}
          </span>
        </div>
        {canRetry && retryable ? (
          <Button
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={onRetry}
          >
            {t("retry")}
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {t("queuedAt", { date: formatDateTime(delivery._creationTime) })}
        {" · "}
        {t("attempts", {
          count: delivery.seriesAttempts,
          max: delivery.maxAttempts,
        })}
        {delivery.nextAttemptAt !== undefined
          ? ` · ${t("nextAttempt", { date: formatDateTime(delivery.nextAttemptAt) })}`
          : null}
      </p>
      {delivery.lastErrorCode && delivery.status !== "succeeded" ? (
        <p className="text-xs text-muted-foreground">
          {t(`errors.${delivery.lastErrorCode}`)}
        </p>
      ) : null}
      {delivery.attempts.length > 0 ? (
        <ol className="space-y-1 border-l border-border pl-3 text-xs text-muted-foreground">
          {delivery.attempts.map((attempt) => (
            <li key={attempt.attemptNumber}>
              {t("attemptLine", {
                number: attempt.attemptNumber,
                date: formatDateTime(attempt.startedAt),
              })}
              {" · "}
              {t(`outcomes.${attempt.outcome}`)}
              {attempt.responseStatus !== undefined
                ? ` · ${t("responseStatus", { status: attempt.responseStatus })}`
                : null}
              {attempt.errorCode && attempt.errorCode !== "http_error"
                ? ` · ${t(`errors.${attempt.errorCode}`)}`
                : null}
            </li>
          ))}
        </ol>
      ) : null}
    </li>
  );
}

export function DeliverySection({ view }: { view: RequestView }) {
  const t = useScopedI18n("reproductionRequests.delivery");
  const formatDateTime = useRequestDateTime();
  const errorMessage = useReproductionErrorMessage();
  const resend = useMutation(api.reproductionRequests.resendDelivery);
  const [saving, setSaving] = useState(false);
  const grantActive = view.decision?.grant === "active";
  const canSend = view.commands.canDecide && grantActive;
  if (view.decision?.outcome !== "approved") return null;

  const onResend = async () => {
    setSaving(true);
    try {
      await resend({ requestId: view.request._id });
      toast.success(t("resent"));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      id="delivery-title"
      title={t("title")}
      description={t("description")}
      action={
        canSend && view.emailAvailable ? (
          <Button variant="outline" disabled={saving} onClick={onResend}>
            {t("resend")}
          </Button>
        ) : null
      }
    >
      {view.deliveries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-2">
          {view.deliveries.map((delivery) => (
            <DeliveryRow
              key={delivery._id}
              delivery={delivery}
              canRetry={canSend && view.emailAvailable}
            />
          ))}
        </ul>
      )}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">{t("usesTitle")}</h3>
        {view.downloads.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("usesEmpty")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {view.downloads.map((download) => (
              <li
                key={download._id}
                className="flex flex-wrap justify-between gap-2"
              >
                <span>{t(`downloadOutcomes.${download.outcome}`)}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(download.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
