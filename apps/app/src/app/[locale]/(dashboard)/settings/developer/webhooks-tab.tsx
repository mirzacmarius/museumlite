"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Plus } from "lucide-react";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { useWebhooksTab } from "./use-webhooks-tab";
import { WebhookDeliveryDialog } from "./webhook-delivery-dialog";
import { WebhookDeliveryLog } from "./webhook-delivery-log";
import { WebhookRotateSecretDialog } from "./webhook-rotate-secret-dialog";
import { WebhookSigningHelp } from "./webhook-signing-help";
import { WebhooksCreateDialog } from "./webhooks-create-dialog";
import { WebhooksList } from "./webhooks-list";

export function WebhooksTab({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("webhookDeliveries");
  return (
    <PermissionGate
      permission="organization.manage_settings"
      fallback={
        <p className="text-sm text-muted-foreground">{t("noPermission")}</p>
      }
    >
      <WebhooksManager organizationId={organizationId} />
    </PermissionGate>
  );
}

function WebhooksManager({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const {
    t,
    webhooks,
    availableEvents,
    showCreate,
    setShowCreate,
    createdSecret,
    createError,
    newWebhook,
    setNewWebhook,
    isCreating,
    testingId,
    testResult,
    copied,
    deliveryFilter,
    setDeliveryFilter,
    selectedDeliveryId,
    setSelectedDeliveryId,
    rotatingWebhook,
    setRotatingWebhook,
    handleCreate,
    handleToggleActive,
    handleDelete,
    handleTest,
    handleViewDeliveries,
    handleCopy,
    closeDialog,
    toggleEvent,
  } = useWebhooksTab(organizationId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t("webhooks.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("webhooks.description")}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 size-4" />
          {t("webhooks.addButton")}
        </Button>
      </div>

      <WebhooksList
        webhooks={webhooks}
        testingId={testingId}
        testResult={testResult}
        onTest={handleTest}
        onToggleActive={handleToggleActive}
        onDelete={handleDelete}
        onViewDeliveries={handleViewDeliveries}
        onRotateSecret={setRotatingWebhook}
        t={t}
      />

      <WebhookSigningHelp />

      <WebhookDeliveryLog
        organizationId={organizationId}
        webhooks={webhooks ?? []}
        filter={deliveryFilter}
        onFilterChange={setDeliveryFilter}
        onOpenDelivery={setSelectedDeliveryId}
      />

      <WebhooksCreateDialog
        open={showCreate}
        onClose={closeDialog}
        createdSecret={createdSecret}
        createError={createError}
        copied={copied}
        onCopy={handleCopy}
        newWebhook={newWebhook}
        setNewWebhook={setNewWebhook}
        availableEvents={availableEvents}
        toggleEvent={toggleEvent}
        isCreating={isCreating}
        onCreate={handleCreate}
      />

      <WebhookDeliveryDialog
        organizationId={organizationId}
        deliveryId={selectedDeliveryId}
        onClose={() => setSelectedDeliveryId(null)}
      />

      <WebhookRotateSecretDialog
        webhook={rotatingWebhook}
        onClose={() => setRotatingWebhook(null)}
      />
    </div>
  );
}
