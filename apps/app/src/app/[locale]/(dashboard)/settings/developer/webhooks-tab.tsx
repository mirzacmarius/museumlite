"use client";

import { PermissionGate } from "@/components/permission-gate";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Plus } from "lucide-react";
import { useWebhooksTab } from "./use-webhooks-tab";
import { WebhooksCreateDialog } from "./webhooks-create-dialog";
import { WebhooksList } from "./webhooks-list";

export function WebhooksTab({
  organizationId,
}: { organizationId: Id<"organizations"> }) {
  const {
    t,
    webhooks,
    availableEvents,
    showCreate,
    setShowCreate,
    createdSecret,
    newWebhook,
    setNewWebhook,
    isCreating,
    testingId,
    testResult,
    copied,
    handleCreate,
    handleToggleActive,
    handleDelete,
    handleTest,
    handleCopy,
    closeDialog,
    toggleEvent,
  } = useWebhooksTab(organizationId);

  return (
    <PermissionGate permission="organization.manage_settings">
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
          t={t}
        />

        <WebhooksCreateDialog
          open={showCreate}
          onClose={closeDialog}
          createdSecret={createdSecret}
          copied={copied}
          onCopy={handleCopy}
          newWebhook={newWebhook}
          setNewWebhook={setNewWebhook}
          availableEvents={availableEvents}
          toggleEvent={toggleEvent}
          isCreating={isCreating}
          onCreate={handleCreate}
        />
      </div>
    </PermissionGate>
  );
}
