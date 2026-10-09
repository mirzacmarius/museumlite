"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@v1/ui/alert-dialog";
import { Button } from "@v1/ui/button";
import { Label } from "@v1/ui/label";
import { useMutation } from "convex/react";
import { Check, Copy, Loader2 } from "lucide-react";
import { useState } from "react";
import { writeTextToClipboard } from "@/lib/clipboard";
import { useScopedI18n } from "@/locales/client";
import { useWebhookErrorMessage } from "./webhook-delivery-labels";

export function WebhookRotateSecretDialog({
  webhook,
  onClose,
}: {
  webhook: { _id: Id<"webhooks">; name: string } | null;
  onClose: () => void;
}) {
  const t = useScopedI18n("webhookDeliveries");
  const tSettings = useScopedI18n("settings");
  const rotateSecret = useMutation(api.webhooks.rotateSecret);
  const errorMessage = useWebhookErrorMessage();
  const [secret, setSecret] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);

  // A rotation in flight must finish here so its new secret is shown once,
  // for the endpoint it belongs to.
  function close() {
    if (pending) return;
    setSecret(null);
    setError(undefined);
    setCopied(false);
    onClose();
  }

  async function handleRotate() {
    if (!webhook) return;
    setPending(true);
    setError(undefined);
    try {
      const result = await rotateSecret({ webhookId: webhook._id });
      setSecret(result.secret);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  async function handleCopy() {
    if (secret && (await writeTextToClipboard(secret))) {
      setCopied(true);
    }
  }

  return (
    <AlertDialog
      open={webhook !== null}
      onOpenChange={(open) => !open && close()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {secret ? t("rotate.rotatedTitle") : t("rotate.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {secret ? t("rotate.rotatedDescription") : t("rotate.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {secret ? (
          <div className="rounded-lg border border-white/10 bg-muted p-4">
            <Label className="text-xs text-muted-foreground">
              {tSettings("webhooks.signingSecret")}
            </Label>
            <div className="mt-1 flex items-center justify-between gap-4">
              <code className="flex-1 break-all text-sm">{secret}</code>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                aria-label={tSettings("webhooks.signingSecret")}
              >
                {copied ? (
                  <Check className="size-4 text-green-500" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          {secret ? (
            <Button onClick={close}>{t("rotate.done")}</Button>
          ) : (
            <>
              <AlertDialogCancel disabled={pending}>
                {t("rotate.cancel")}
              </AlertDialogCancel>
              <Button onClick={handleRotate} disabled={pending}>
                {pending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                {t("rotate.confirm")}
              </Button>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
