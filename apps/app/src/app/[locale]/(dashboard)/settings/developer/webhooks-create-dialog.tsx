"use client";

import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Check, Copy, Loader2 } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { useScopedI18n } from "@/locales/client";

interface NewWebhookState {
  name: string;
  url: string;
  events: string[];
}

interface WebhooksCreateDialogProps {
  open: boolean;
  onClose: () => void;
  createdSecret: string | null;
  copied: boolean;
  onCopy: () => void;
  newWebhook: NewWebhookState;
  setNewWebhook: Dispatch<SetStateAction<NewWebhookState>>;
  availableEvents: string[] | undefined;
  toggleEvent: (event: string) => void;
  isCreating: boolean;
  onCreate: () => void;
}

export function WebhooksCreateDialog({
  open,
  onClose,
  createdSecret,
  copied,
  onCopy,
  newWebhook,
  setNewWebhook,
  availableEvents,
  toggleEvent,
  isCreating,
  onCreate,
}: WebhooksCreateDialogProps) {
  const t = useScopedI18n("settings");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {createdSecret
              ? t("webhooks.webhookCreated")
              : t("webhooks.addWebhook")}
          </DialogTitle>
          <DialogDescription>
            {createdSecret
              ? t("webhooks.copySecret")
              : t("webhooks.configureWebhook")}
          </DialogDescription>
        </DialogHeader>

        {createdSecret ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted p-4">
              <Label className="text-xs text-muted-foreground">
                {t("webhooks.signingSecret")}
              </Label>
              <div className="mt-1 flex items-center justify-between gap-4">
                <code className="flex-1 break-all text-sm">
                  {createdSecret}
                </code>
                <Button variant="outline" size="icon" onClick={onCopy}>
                  {copied ? (
                    <Check className="size-4 text-green-500" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>
            </div>
            <p className="text-sm text-amber-600">{t("webhooks.useSecret")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wh-name">{t("webhooks.name")}</Label>
              <Input
                id="wh-name"
                placeholder={t("webhooks.namePlaceholder")}
                value={newWebhook.name}
                onChange={(e) =>
                  setNewWebhook((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-url">{t("webhooks.endpointURL")}</Label>
              <Input
                id="wh-url"
                placeholder={t("webhooks.urlPlaceholder")}
                value={newWebhook.url}
                onChange={(e) =>
                  setNewWebhook((prev) => ({ ...prev, url: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                {t("webhooks.httpsRequired")}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{t("webhooks.events")}</Label>
              <p className="text-xs text-muted-foreground mb-2">
                {t("webhooks.selectEvents")}
              </p>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border p-3">
                <div className="grid grid-cols-2 gap-2">
                  {(availableEvents || []).map((event: string) => (
                    <label
                      key={event}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={newWebhook.events.includes(event)}
                        onChange={() => toggleEvent(event)}
                        className="rounded"
                      />
                      {event}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {createdSecret ? (
            <Button onClick={onClose}>{t("webhooks.done")}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                {t("webhooks.cancel")}
              </Button>
              <Button
                onClick={onCreate}
                disabled={
                  !newWebhook.name.trim() ||
                  !newWebhook.url.trim() ||
                  isCreating
                }
              >
                {isCreating ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                {t("webhooks.createWebhook")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
