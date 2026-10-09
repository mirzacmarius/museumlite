"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@v1/ui/alert-dialog";
import { Button } from "@v1/ui/button";
import { Check, KeyRound, List, Loader2, Send, Trash2, X } from "lucide-react";

import { useClientRelativeTime } from "@/hooks/use-client-date-format";
import { useCurrentLocale, useI18n, useScopedI18n } from "@/locales/client";

export interface WebhookItem {
  _id: Id<"webhooks">;
  name: string;
  url: string;
  isActive: boolean;
  events: string[];
  lastTriggeredAt?: number;
}

function LastDelivered({ timestamp }: { timestamp: number | undefined }) {
  const t = useScopedI18n("webhookDeliveries");
  const locale = useCurrentLocale();
  const time = useClientRelativeTime(timestamp, locale, { addSuffix: true });
  return (
    <span className="text-xs text-white/60">
      {timestamp
        ? t("endpoint.lastDelivery", { time })
        : t("endpoint.neverDelivered")}
    </span>
  );
}

interface WebhooksListProps {
  webhooks: WebhookItem[] | undefined;
  testingId: Id<"webhooks"> | null;
  testResult: {
    id: Id<"webhooks">;
    success: boolean;
    message: string;
  } | null;
  onTest: (webhookId: Id<"webhooks">) => void;
  onToggleActive: (webhookId: Id<"webhooks">, isActive: boolean) => void;
  onDelete: (webhookId: Id<"webhooks">) => void;
  onViewDeliveries: (webhookId: Id<"webhooks">) => void;
  onRotateSecret: (webhook: { _id: Id<"webhooks">; name: string }) => void;
  t: ReturnType<typeof import("@/locales/client").useScopedI18n<"settings">>;
}

export function WebhooksList({
  webhooks,
  testingId,
  testResult,
  onTest,
  onToggleActive,
  onDelete,
  onViewDeliveries,
  onRotateSecret,
  t,
}: WebhooksListProps) {
  const tRoot = useI18n();
  const tDeliveries = useScopedI18n("webhookDeliveries");
  return (
    <div className="rounded-lg border border-border">
      {!webhooks ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : webhooks.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          {t("webhooks.noWebhooks")}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {webhooks.map((webhook) => (
            <div key={webhook._id} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`size-2 rounded-full ${webhook.isActive ? "bg-green-500" : "bg-muted-foreground"}`}
                  />
                  <span className="font-medium">{webhook.name}</span>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewDeliveries(webhook._id)}
                  >
                    <List className="mr-2 size-4" />
                    {tDeliveries("endpoint.viewDeliveries")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onTest(webhook._id)}
                    disabled={testingId === webhook._id || !webhook.isActive}
                  >
                    {testingId === webhook._id ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 size-4" />
                    )}
                    {tDeliveries("endpoint.sendTest")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      onRotateSecret({ _id: webhook._id, name: webhook.name })
                    }
                  >
                    <KeyRound className="mr-2 size-4" />
                    {tDeliveries("endpoint.rotateSecret")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      onToggleActive(webhook._id, webhook.isActive)
                    }
                  >
                    {webhook.isActive
                      ? t("webhooks.disable")
                      : t("webhooks.enable")}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="size-4 text-muted-foreground" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t("webhooks.deleteWebhook")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("webhooks.deleteWebhookDesc")}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>
                          {t("webhooks.cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onDelete(webhook._id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {t("webhooks.delete")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <code className="rounded bg-muted px-2 py-0.5">
                  {webhook.url}
                </code>
                <LastDelivered timestamp={webhook.lastTriggeredAt} />
              </div>
              <div className="flex flex-wrap gap-1">
                {webhook.events.slice(0, 5).map((event) => (
                  <span
                    key={event}
                    className="rounded bg-primary/10 px-2 py-0.5 text-xs"
                  >
                    {event}
                  </span>
                ))}
                {webhook.events.length > 5 && (
                  <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    +{webhook.events.length - 5}{" "}
                    {tRoot("untranslatedDashboard.settings.more")}
                  </span>
                )}
              </div>
              {testResult?.id === webhook._id && (
                <div
                  className={`text-sm ${testResult.success ? "text-green-600" : "text-destructive"}`}
                >
                  {testResult.success ? (
                    <Check className="mr-1 inline size-4" />
                  ) : (
                    <X className="mr-1 inline size-4" />
                  )}
                  {testResult.message}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
