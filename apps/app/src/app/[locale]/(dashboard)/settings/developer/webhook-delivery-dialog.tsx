"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Loader2, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useScopedI18n } from "@/locales/client";
import {
  DeliveryStatusBadge,
  outcomeLabel,
  RelativeTime,
  reasonLabel,
  useWebhookErrorMessage,
} from "./webhook-delivery-labels";

type DeliveryDetails = NonNullable<
  FunctionReturnType<typeof api.webhookDeliveries.get>
>;

function prettyPayload(body: string) {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-all text-right">{children}</span>
    </div>
  );
}

function Attempts({ attempts }: { attempts: DeliveryDetails["attempts"] }) {
  const t = useScopedI18n("webhookDeliveries");
  if (attempts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("detail.noAttempts")}</p>
    );
  }
  return (
    <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
      {attempts.map((attempt) => (
        <li
          key={attempt.attemptNumber}
          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
        >
          <div className="flex flex-col">
            <span className="font-medium">
              {t("detail.attempt", { number: attempt.attemptNumber })} ·{" "}
              {outcomeLabel(attempt.outcome, t)}
            </span>
            <span className="text-xs text-muted-foreground">
              {reasonLabel(
                attempt.errorCode ?? "http_error",
                attempt.responseStatus,
                t,
              )}
              {" · "}
              {t("detail.duration", { ms: attempt.durationMs })}
            </span>
          </div>
          <span className="text-xs text-white/60">
            <RelativeTime timestamp={attempt.startedAt} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function DeliveryBody({
  organizationId,
  details,
}: {
  organizationId: Id<"organizations">;
  details: DeliveryDetails;
}) {
  const t = useScopedI18n("webhookDeliveries");
  const retry = useMutation(api.webhookDeliveries.retry);
  const errorMessage = useWebhookErrorMessage();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const { delivery, event } = details;
  const retryable =
    delivery.status === "failed_transient" ||
    delivery.status === "failed_permanent" ||
    delivery.status === "cancelled";
  const reason =
    delivery.status === "succeeded"
      ? null
      : reasonLabel(delivery.lastErrorCode, delivery.lastResponseStatus, t);

  async function handleRetry() {
    setPending(true);
    setError(undefined);
    try {
      await retry({ organizationId, deliveryId: delivery._id });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <DeliveryStatusBadge delivery={delivery} />
        {reason ? (
          <span className="text-sm text-muted-foreground">{reason}</span>
        ) : null}
      </div>
      <div className="divide-y divide-white/10">
        <DetailRow label={t("detail.event")}>
          <span className="font-mono">{event.type}</span>
        </DetailRow>
        <DetailRow label={t("detail.endpoint")}>
          {delivery.webhookName ?? t("log.deletedEndpoint")}
        </DetailRow>
        <DetailRow label={t("detail.deliveryId")}>
          <code className="text-xs">{delivery._id}</code>
        </DetailRow>
        <DetailRow label={t("detail.eventId")}>
          <code className="text-xs">{event.eventId}</code>
        </DetailRow>
        <DetailRow label={t("detail.created")}>
          <span className="text-white/60">
            <RelativeTime timestamp={delivery._creationTime} />
          </span>
        </DetailRow>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">{t("detail.attemptsTitle")}</h4>
        <Attempts attempts={details.attempts} />
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">
          {t("detail.payload", { version: event.payloadVersion })}
        </h4>
        <pre className="max-h-64 overflow-auto rounded-lg border border-white/10 bg-muted p-3 text-xs">
          {prettyPayload(event.body)}
        </pre>
      </div>

      {retryable ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {t("detail.retryHelp")}
          </p>
          <Button size="sm" onClick={handleRetry} disabled={pending}>
            {pending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 size-4" />
            )}
            {pending ? t("detail.retrying") : t("detail.retry")}
          </Button>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function WebhookDeliveryDialog({
  organizationId,
  deliveryId,
  onClose,
}: {
  organizationId: Id<"organizations">;
  deliveryId: Id<"webhookDeliveries"> | null;
  onClose: () => void;
}) {
  const t = useScopedI18n("webhookDeliveries");
  const details = useQuery(
    api.webhookDeliveries.get,
    deliveryId ? { organizationId, deliveryId } : "skip",
  );

  return (
    <Dialog
      open={deliveryId !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("detail.title")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("log.description")}
          </DialogDescription>
        </DialogHeader>
        {details === undefined ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : details === null ? (
          <p className="text-sm text-muted-foreground">
            {t("detail.notFound")}
          </p>
        ) : (
          <DeliveryBody organizationId={organizationId} details={details} />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("detail.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
