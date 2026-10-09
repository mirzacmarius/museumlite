"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { usePaginatedQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { useClientRelativeTime } from "@/hooks/use-client-date-format";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import {
  DELIVERY_STATUSES,
  type DeliveryStatus,
  DeliveryStatusBadge,
  type DeliverySummary,
  RelativeTime,
  reasonLabel,
  statusLabel,
} from "./webhook-delivery-labels";

const PAGE_SIZE = 20;
const ALL = "all";

export interface DeliveryFilter {
  webhookId?: Id<"webhooks">;
  status?: DeliveryStatus;
}

function DeliveryRow({
  delivery,
  onOpen,
}: {
  delivery: DeliverySummary;
  onOpen: () => void;
}) {
  const t = useScopedI18n("webhookDeliveries");
  const locale = useCurrentLocale();
  const nextAttempt = useClientRelativeTime(delivery.nextAttemptAt, locale, {
    addSuffix: true,
  });
  const reason =
    delivery.status === "succeeded"
      ? null
      : reasonLabel(delivery.lastErrorCode, delivery.lastResponseStatus, t);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <DeliveryStatusBadge delivery={delivery} />
          <span className="font-mono text-sm">
            {delivery.eventType === "test"
              ? t("log.testEvent")
              : delivery.eventType}
          </span>
          <span className="text-sm text-muted-foreground">
            {delivery.webhookName ?? t("log.deletedEndpoint")}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          <span>{t("log.attempts", { count: delivery.attemptCount })}</span>
          {reason ? <span>{reason}</span> : null}
          {delivery.inFlight ? <span>{t("log.sending")}</span> : null}
          {delivery.nextAttemptAt && !delivery.inFlight ? (
            <span>{t("log.nextAttempt", { time: nextAttempt })}</span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-white/60">
          <RelativeTime timestamp={delivery._creationTime} />
        </span>
        <Button variant="outline" size="sm" onClick={onOpen}>
          {t("log.details")}
        </Button>
      </div>
    </li>
  );
}

export function WebhookDeliveryLog({
  organizationId,
  webhooks,
  filter,
  onFilterChange,
  onOpenDelivery,
}: {
  organizationId: Id<"organizations">;
  webhooks: Array<{ _id: Id<"webhooks">; name: string }>;
  filter: DeliveryFilter;
  onFilterChange: (filter: DeliveryFilter) => void;
  onOpenDelivery: (deliveryId: Id<"webhookDeliveries">) => void;
}) {
  const t = useScopedI18n("webhookDeliveries");
  const { results, status, loadMore } = usePaginatedQuery(
    api.webhookDeliveries.list,
    { organizationId, webhookId: filter.webhookId, status: filter.status },
    { initialNumItems: PAGE_SIZE },
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">{t("log.title")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("log.description")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={filter.webhookId ?? ALL}
            onValueChange={(value) =>
              onFilterChange({
                ...filter,
                webhookId:
                  value === ALL
                    ? undefined
                    : webhooks.find((webhook) => webhook._id === value)?._id,
              })
            }
          >
            <SelectTrigger
              className="w-48 bg-background"
              aria-label={t("log.endpointFilter")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("log.allEndpoints")}</SelectItem>
              {webhooks.map((webhook) => (
                <SelectItem key={webhook._id} value={webhook._id}>
                  {webhook.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filter.status ?? ALL}
            onValueChange={(value) =>
              onFilterChange({
                ...filter,
                status: DELIVERY_STATUSES.find((option) => option === value),
              })
            }
          >
            <SelectTrigger
              className="w-48 bg-background"
              aria-label={t("log.statusFilter")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("log.allStatuses")}</SelectItem>
              {DELIVERY_STATUSES.map((option) => (
                <SelectItem key={option} value={option}>
                  {statusLabel(option, t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border border-white/10">
        {status === "LoadingFirstPage" ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : results.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {t("log.empty")}
          </p>
        ) : (
          <ul className="divide-y divide-white/10">
            {results.map((delivery) => (
              <DeliveryRow
                key={delivery._id}
                delivery={delivery}
                onOpen={() => onOpenDelivery(delivery._id)}
              />
            ))}
          </ul>
        )}
      </div>
      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={status === "LoadingMore"}
          onClick={() => loadMore(PAGE_SIZE)}
        >
          {t("log.loadMore")}
        </Button>
      ) : null}
    </section>
  );
}
