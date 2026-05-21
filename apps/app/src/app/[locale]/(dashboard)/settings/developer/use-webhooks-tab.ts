"use client";

import { writeTextToClipboard } from "@/lib/clipboard";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useState } from "react";

export function useWebhooksTab(organizationId: Id<"organizations">) {
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

  const handleCopy = useCallback(async () => {
    if (!createdSecret) {
      return;
    }

    const didCopy = await writeTextToClipboard(createdSecret);
    if (!didCopy) {
      return;
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  return {
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
  };
}
