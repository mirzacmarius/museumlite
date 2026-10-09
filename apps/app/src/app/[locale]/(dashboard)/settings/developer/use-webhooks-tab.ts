"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { writeTextToClipboard } from "@/lib/clipboard";
import { useScopedI18n } from "@/locales/client";
import { useWebhookErrorMessage } from "./webhook-delivery-labels";
import type { DeliveryFilter } from "./webhook-delivery-log";

export function useWebhooksTab(organizationId: Id<"organizations">) {
  const t = useScopedI18n("settings");
  const tDeliveries = useScopedI18n("webhookDeliveries");
  const errorMessage = useWebhookErrorMessage();
  const webhooks = useQuery(api.webhooks.list, { organizationId });
  const availableEvents = useQuery(api.webhooks.listEvents, {});
  const createWebhook = useMutation(api.webhooks.create);
  const updateWebhook = useMutation(api.webhooks.update);
  const deleteWebhook = useMutation(api.webhooks.deleteWebhook);
  const sendTest = useMutation(api.webhookDeliveries.sendTest);

  const [showCreate, setShowCreate] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
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
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>({});
  const [selectedDeliveryId, setSelectedDeliveryId] =
    useState<Id<"webhookDeliveries"> | null>(null);
  const [rotatingWebhook, setRotatingWebhook] = useState<{
    _id: Id<"webhooks">;
    name: string;
  } | null>(null);

  const handleCreate = async () => {
    if (!newWebhook.name.trim() || !newWebhook.url.trim()) return;
    setIsCreating(true);
    setCreateError(null);
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
      setCreateError(errorMessage(error));
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
      toast.error(errorMessage(error));
    }
  };

  const handleDelete = async (webhookId: Id<"webhooks">) => {
    try {
      await deleteWebhook({ webhookId });
      setDeliveryFilter((filter) =>
        filter.webhookId === webhookId ? { status: filter.status } : filter,
      );
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const handleTest = async (webhookId: Id<"webhooks">) => {
    setTestingId(webhookId);
    setTestResult(null);
    try {
      const deliveryId = await sendTest({ organizationId, webhookId });
      setTestResult({
        id: webhookId,
        success: true,
        message: tDeliveries("endpoint.testQueued"),
      });
      setSelectedDeliveryId(deliveryId);
    } catch (error) {
      setTestResult({
        id: webhookId,
        success: false,
        message: errorMessage(error),
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleViewDeliveries = (webhookId: Id<"webhooks">) => {
    setDeliveryFilter((filter) => ({ ...filter, webhookId }));
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
    setCreateError(null);
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
  };
}
