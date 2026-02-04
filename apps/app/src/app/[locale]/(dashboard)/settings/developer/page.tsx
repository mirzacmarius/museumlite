"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { formatDate } from "@/lib/format-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Check,
  Copy,
  Key,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Webhook,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";

interface ApiKeyItem {
  _id: Id<"apiKeys">;
  name: string;
  prefix: string;
  isRevoked: boolean;
  createdAt: number;
  lastUsedAt?: number;
}

interface WebhookItem {
  _id: Id<"webhooks">;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastTriggeredAt?: number;
}

export default function DeveloperPage() {
  const { currentOrganizationId } = useOrganization();
  const t = useScopedI18n("settings.developer");

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">{t("selectOrganization")}</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-2">{t("description")}</p>
      </div>

      <Tabs defaultValue="api-keys" className="w-full">
        <TabsList>
          <TabsTrigger value="api-keys" className="gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-2">
            <Webhook className="h-4 w-4" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="utilities" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Utilities
          </TabsTrigger>
        </TabsList>

        <TabsContent value="api-keys" className="mt-6">
          <ApiKeysTab
            organizationId={currentOrganizationId as Id<"organizations">}
          />
        </TabsContent>

        <TabsContent value="webhooks" className="mt-6">
          <WebhooksTab
            organizationId={currentOrganizationId as Id<"organizations">}
          />
        </TabsContent>

        <TabsContent value="utilities" className="mt-6">
          <UtilitiesTab
            organizationId={currentOrganizationId as Id<"organizations">}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ApiKeysTab({
  organizationId,
}: { organizationId: Id<"organizations"> }) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("settings");
  const apiKeys = useQuery(api.apiKeys.list, { organizationId });
  const createKey = useMutation(api.apiKeys.create);
  const revokeKey = useMutation(api.apiKeys.revoke);
  const deleteKey = useMutation(api.apiKeys.deleteKey);

  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setIsCreating(true);
    try {
      const result = await createKey({
        organizationId,
        name: newKeyName.trim(),
        permissions: ["read", "write"],
      });
      setCreatedKey(result.key);
      setNewKeyName("");
    } catch (error) {
      alert(
        error instanceof Error ? error.message : t("errors.failedToCreateKey"),
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = useCallback(() => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [createdKey]);

  const handleRevoke = async (keyId: Id<"apiKeys">) => {
    try {
      await revokeKey({ organizationId, keyId });
    } catch (error) {
      alert(
        error instanceof Error ? error.message : t("errors.failedToRevokeKey"),
      );
    }
  };

  const handleDelete = async (keyId: Id<"apiKeys">) => {
    try {
      await deleteKey({ organizationId, keyId });
    } catch (error) {
      alert(
        error instanceof Error ? error.message : t("errors.failedToDeleteKey"),
      );
    }
  };

  const closeDialog = () => {
    setShowCreate(false);
    setCreatedKey(null);
    setNewKeyName("");
  };

  return (
    <PermissionGate permission="organization.manage_settings">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{t("apiKeys.title")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("apiKeys.description")}
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("apiKeys.createButton")}
          </Button>
        </div>

        <div className="rounded-lg border border-border">
          {!apiKeys ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {t("apiKeys.noKeys")}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {apiKeys.map((key: ApiKeyItem) => (
                <div
                  key={key._id}
                  className="flex items-center justify-between p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{key.name}</span>
                      {key.isRevoked && (
                        <span className="rounded bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                          {t("apiKeys.revoked")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <code className="rounded bg-muted px-2 py-0.5">
                        {key.prefix}...
                      </code>
                      <span>
                        {t("apiKeys.created")}{" "}
                        {formatDate(new Date(key.createdAt), locale)}
                      </span>
                      {key.lastUsedAt && (
                        <span>
                          {t("apiKeys.lastUsed")}{" "}
                          {formatDate(new Date(key.lastUsedAt), locale)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!key.isRevoked && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            {t("apiKeys.revokeButton")}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t("apiKeys.revokeDialog.title")}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("apiKeys.revokeDialog.description")}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              {t("apiKeys.revokeDialog.cancel")}
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRevoke(key._id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {t("apiKeys.revokeDialog.confirm")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {t("apiKeys.deleteDialog.title")}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("apiKeys.deleteDialog.description")}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            {t("apiKeys.deleteDialog.cancel")}
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(key._id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {t("apiKeys.deleteDialog.confirm")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Dialog open={showCreate} onOpenChange={closeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {createdKey
                  ? t("apiKeys.createDialog.createdTitle")
                  : t("apiKeys.createDialog.title")}
              </DialogTitle>
              <DialogDescription>
                {createdKey
                  ? t("apiKeys.createDialog.createdDescription")
                  : t("apiKeys.createDialog.description")}
              </DialogDescription>
            </DialogHeader>

            {createdKey ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-muted p-4">
                  <div className="flex items-center justify-between gap-4">
                    <code className="flex-1 break-all text-sm">
                      {createdKey}
                    </code>
                    <Button variant="outline" size="icon" onClick={handleCopy}>
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-amber-600">
                  {t("apiKeys.createDialog.warning")}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="key-name">
                    {t("apiKeys.createDialog.nameLabel")}
                  </Label>
                  <Input
                    id="key-name"
                    placeholder={t("apiKeys.createDialog.namePlaceholder")}
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              {createdKey ? (
                <Button onClick={closeDialog}>
                  {t("apiKeys.createDialog.done")}
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={closeDialog}>
                    {t("apiKeys.createDialog.cancel")}
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={!newKeyName.trim() || isCreating}
                  >
                    {isCreating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {t("apiKeys.createDialog.create")}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGate>
  );
}

function WebhooksTab({
  organizationId,
}: { organizationId: Id<"organizations"> }) {
  const t = useScopedI18n("settings");
  const webhooks = useQuery(api.webhooks.list, { organizationId });
  const availableEvents = useQuery(api.webhooks.listEvents, {});
  const createWebhook = useMutation(api.webhooks.create);
  const updateWebhook = useMutation(api.webhooks.update);
  const deleteWebhook = useMutation(api.webhooks.deleteWebhook);
  const testWebhook = useAction(api.webhooksActions.test);

  const [showCreate, setShowCreate] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [newWebhook, setNewWebhook] = useState({
    name: "",
    url: "",
    events: [] as string[],
  });
  const [isCreating, setIsCreating] = useState(false);
  const [testingId, setTestingId] = useState<Id<"webhooks"> | null>(null);
  const [testResult, setTestResult] = useState<{
    id: Id<"webhooks">;
    success: boolean;
    message: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!newWebhook.name.trim() || !newWebhook.url.trim()) return;
    setIsCreating(true);
    try {
      const result = await createWebhook({
        organizationId,
        name: newWebhook.name.trim(),
        url: newWebhook.url.trim(),
        events:
          newWebhook.events.length > 0
            ? newWebhook.events
            : availableEvents || [],
      });
      setCreatedSecret(result.secret);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : t("errors.failedToCreateWebhook"),
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleActive = async (
    webhookId: Id<"webhooks">,
    isActive: boolean,
  ) => {
    try {
      await updateWebhook({ webhookId, isActive: !isActive });
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : t("errors.failedToUpdateWebhook"),
      );
    }
  };

  const handleDelete = async (webhookId: Id<"webhooks">) => {
    try {
      await deleteWebhook({ webhookId });
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : t("errors.failedToDeleteWebhook"),
      );
    }
  };

  const handleTest = async (webhookId: Id<"webhooks">) => {
    setTestingId(webhookId);
    setTestResult(null);
    try {
      const result = await testWebhook({ webhookId });
      setTestResult({
        id: webhookId,
        success: result.success,
        message: result.success
          ? t("webhooks.testSuccess", { statusCode: result.statusCode })
          : result.error || t("webhooks.testFailed"),
      });
    } catch (error) {
      setTestResult({
        id: webhookId,
        success: false,
        message:
          error instanceof Error ? error.message : t("webhooks.testFailed"),
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleCopy = useCallback(() => {
    if (createdSecret) {
      navigator.clipboard.writeText(createdSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [createdSecret]);

  const closeDialog = () => {
    setShowCreate(false);
    setCreatedSecret(null);
    setNewWebhook({ name: "", url: "", events: [] });
  };

  const toggleEvent = (event: string) => {
    setNewWebhook((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

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
            <Plus className="mr-2 h-4 w-4" />
            {t("webhooks.addButton")}
          </Button>
        </div>

        <div className="rounded-lg border border-border">
          {!webhooks ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : webhooks.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {t("webhooks.noWebhooks")}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {webhooks.map((webhook: WebhookItem) => (
                <div key={webhook._id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-2 w-2 rounded-full ${webhook.isActive ? "bg-green-500" : "bg-muted-foreground"}`}
                      />
                      <span className="font-medium">{webhook.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTest(webhook._id)}
                        disabled={testingId === webhook._id}
                      >
                        {testingId === webhook._id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-4 w-4" />
                        )}
                        {t("webhooks.test")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleToggleActive(webhook._id, webhook.isActive)
                        }
                      >
                        {webhook.isActive
                          ? t("webhooks.disable")
                          : t("webhooks.enable")}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
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
                              onClick={() => handleDelete(webhook._id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {t("webhooks.delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <code className="rounded bg-muted px-2 py-0.5">
                      {webhook.url}
                    </code>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {webhook.events.slice(0, 5).map((event: string) => (
                      <span
                        key={event}
                        className="rounded bg-primary/10 px-2 py-0.5 text-xs"
                      >
                        {event}
                      </span>
                    ))}
                    {webhook.events.length > 5 && (
                      <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        +{webhook.events.length - 5} more
                      </span>
                    )}
                  </div>
                  {testResult?.id === webhook._id && (
                    <div
                      className={`text-sm ${testResult.success ? "text-green-600" : "text-destructive"}`}
                    >
                      {testResult.success ? (
                        <Check className="mr-1 inline h-4 w-4" />
                      ) : (
                        <X className="mr-1 inline h-4 w-4" />
                      )}
                      {testResult.message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <Dialog open={showCreate} onOpenChange={closeDialog}>
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
                    <Button variant="outline" size="icon" onClick={handleCopy}>
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-amber-600">
                  {t("webhooks.useSecret")}
                </p>
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
                      setNewWebhook((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
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
                      setNewWebhook((prev) => ({
                        ...prev,
                        url: e.target.value,
                      }))
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
                <Button onClick={closeDialog}>{t("webhooks.done")}</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={closeDialog}>
                    {t("webhooks.cancel")}
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={
                      !newWebhook.name.trim() ||
                      !newWebhook.url.trim() ||
                      isCreating
                    }
                  >
                    {isCreating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {t("webhooks.createWebhook")}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGate>
  );
}

function UtilitiesTab({
  organizationId,
}: { organizationId: Id<"organizations"> }) {
  const t = useScopedI18n("settings.developer");
  const common = useScopedI18n("common");
  const [isDeletingLoans, setIsDeletingLoans] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{
    deletedLoans: number;
    deletedLoanItems: number;
    updatedCollections: number;
  } | null>(null);

  const deleteAllLoans = useMutation(api.loans.deleteAllLoans);

  const handleDeleteAllLoans = async () => {
    setIsDeletingLoans(true);
    setDeleteResult(null);
    try {
      const result = await deleteAllLoans({ organizationId });
      setDeleteResult(result);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete loans");
    } finally {
      setIsDeletingLoans(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t("utilities")}</h2>
        <p className="text-sm text-muted-foreground">{t("utilitiesDesc")}</p>
      </div>

      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-destructive/10 p-2">
            <Trash2 className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1 space-y-2">
            <div>
              <h3 className="text-lg font-semibold">{t("deleteAllLoans")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("deleteLoansDesc")}
              </p>
            </div>

            {deleteResult && (
              <div className="rounded-md bg-muted p-4 space-y-1">
                <p className="text-sm font-medium">{t("operationCompleted")}</p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>
                    {t("deletedLoans", {
                      count: deleteResult.deletedLoans,
                      plural: deleteResult.deletedLoans !== 1 ? "s" : "",
                    })}
                  </li>
                  <li>
                    {t("deletedLoanItems", {
                      count: deleteResult.deletedLoanItems,
                      plural: deleteResult.deletedLoanItems !== 1 ? "s" : "",
                    })}
                  </li>
                  <li>
                    {t("updatedCollections", {
                      count: deleteResult.updatedCollections,
                      plural: deleteResult.updatedCollections !== 1 ? "s" : "",
                    })}
                  </li>
                </ul>
              </div>
            )}

            <PermissionGate permission="loans.update">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isDeletingLoans}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {isDeletingLoans ? common("deleting") : t("deleteAllLoans")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      {t("deleteLoansDialog")}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <p className="font-medium">{t("willDelete")}</p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>{t("allLoans")}</li>
                        <li>{t("allLoanItems")}</li>
                        <li>{t("restoreActive")}</li>
                      </ul>
                      <p className="pt-2 font-semibold text-destructive">
                        {t("cannotUndo")}
                      </p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAllLoans}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t("confirmDelete")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </PermissionGate>
          </div>
        </div>
      </div>
    </div>
  );
}
