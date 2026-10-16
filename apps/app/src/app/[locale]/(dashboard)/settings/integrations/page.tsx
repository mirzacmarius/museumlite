"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { useMutation, useQuery } from "convex/react";
import { BookOpen, Check, ChevronRight, Loader2, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, Suspense, useEffect, useReducer } from "react";
import { ConfirmedSwitch } from "@/components/confirmed-switch";
import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";

interface IntegrationsSettingsState {
  subscribeDialogOpen: boolean;
  selectedIntegration: string | null;
  isCreatingCheckout: boolean;
  pendingEnableIntegration: string | null;
}

type IntegrationsSettingsAction =
  | { type: "setSubscribeDialogOpen"; value: boolean }
  | { type: "setSelectedIntegration"; value: string | null }
  | { type: "setIsCreatingCheckout"; value: boolean }
  | { type: "setPendingEnableIntegration"; value: string | null }
  | { type: "closeSubscribeDialog" };

const initialIntegrationsSettingsState: IntegrationsSettingsState = {
  subscribeDialogOpen: false,
  selectedIntegration: null,
  isCreatingCheckout: false,
  pendingEnableIntegration: null,
};

function integrationsSettingsReducer(
  state: IntegrationsSettingsState,
  action: IntegrationsSettingsAction,
): IntegrationsSettingsState {
  switch (action.type) {
    case "setSubscribeDialogOpen":
      return { ...state, subscribeDialogOpen: action.value };
    case "setSelectedIntegration":
      return { ...state, selectedIntegration: action.value };
    case "setIsCreatingCheckout":
      return { ...state, isCreatingCheckout: action.value };
    case "setPendingEnableIntegration":
      return { ...state, pendingEnableIntegration: action.value };
    case "closeSubscribeDialog":
      return {
        ...state,
        subscribeDialogOpen: false,
        selectedIntegration: null,
      };
  }
}

import { toast } from "sonner";

const INTEGRATION_ICONS: Record<string, ReactNode> = {
  library: <BookOpen className="size-6" />,
};

interface AvailableIntegration {
  id: string;
  name: string;
  description: string;
  features: string[];
  requiresSubscription: boolean;
}

function IntegrationLoadingState() {
  return (
    <div className="flex size-full flex-col gap-6">
      <div className="flex w-full items-center justify-center rounded-lg border border-border bg-card p-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}

function IntegrationEmptyState({ message }: { message: string }) {
  return (
    <div className="flex size-full flex-col gap-6">
      <div className="flex w-full flex-col items-start rounded-lg border border-border bg-card p-6">
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

function IntegrationCard({
  integration,
  isEnabled,
  labels,
  onEnabledChange,
}: {
  integration: AvailableIntegration;
  isEnabled: boolean;
  labels: {
    configureSettings: string;
    disableConsequence: string;
    enabled: string;
    featuresIncluded: string;
    requiresSubscription: string;
    settings: string;
  };
  onEnabledChange: (enabled: boolean) => Promise<void>;
}) {
  const nameId = `integration-${integration.id}-name`;
  const descriptionId = `integration-${integration.id}-description`;
  return (
    <div className="flex w-full flex-col rounded-lg border border-border bg-card">
      <div className="flex w-full items-start justify-between p-6">
        <div className="flex items-start gap-4">
          <div className="flex size-12 items-center justify-center rounded-lg bg-primary/5 text-primary">
            {INTEGRATION_ICONS[integration.id] || (
              <Settings className="size-6" />
            )}
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h3 id={nameId} className="text-lg font-medium">
                {integration.name}
              </h3>
              {isEnabled ? (
                <Badge variant="secondary" className="text-xs">
                  <Check className="mr-1 size-3" />
                  {labels.enabled}
                </Badge>
              ) : null}
            </div>
            <p id={descriptionId} className="text-sm text-muted-foreground">
              {integration.description}
            </p>
            {integration.requiresSubscription ? (
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                {labels.requiresSubscription}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ConfirmedSwitch
            labelId={nameId}
            descriptionId={descriptionId}
            settingName={integration.name}
            checked={isEnabled}
            disableDetails={labels.disableConsequence}
            onConfirmedChange={onEnabledChange}
          />
        </div>
      </div>

      <div className="border-t border-border px-6 py-4">
        <h4 className="mb-3 text-sm font-medium text-muted-foreground">
          {labels.featuresIncluded}
        </h4>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {integration.features.map((feature) => (
            <div
              key={feature}
              className="flex items-center gap-2 text-sm text-primary-foreground"
            >
              <Check className="size-4 text-green-500" />
              {feature}
            </div>
          ))}
        </div>
      </div>

      {isEnabled ? (
        <div className="flex items-center justify-between border-t border-border bg-secondary/50 px-6 py-3 dark:bg-card">
          <p className="text-sm text-muted-foreground">
            {labels.configureSettings}
          </p>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/settings/integrations/${integration.id}`}>
              {labels.settings}
              <ChevronRight className="ml-1 size-4" />
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function SubscribeIntegrationDialog({
  cancelLabel,
  description,
  isCreatingCheckout,
  onOpenChange,
  onSubscribe,
  open,
  redirectingLabel,
  redirectInfo,
  subscribeLabel,
  title,
}: {
  cancelLabel: string;
  description: string;
  isCreatingCheckout: boolean;
  onOpenChange: (open: boolean) => void;
  onSubscribe: () => void;
  open: boolean;
  redirectingLabel: string;
  redirectInfo: string;
  subscribeLabel: string;
  title: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <p className="text-sm text-muted-foreground">{redirectInfo}</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button onClick={onSubscribe} disabled={isCreatingCheckout}>
            {isCreatingCheckout ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {redirectingLabel}
              </>
            ) : (
              subscribeLabel
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IntegrationsSettingsContent() {
  const { currentOrganizationId } = useOrganization();
  const tToast = useScopedI18n("common.toast");
  const t = useScopedI18n("integrations");
  const tCommon = useScopedI18n("common");
  const searchParams = useSearchParams();
  const getSearchParam = searchParams.get.bind(searchParams);
  const stringifySearchParams = searchParams.toString.bind(searchParams);
  const { replace } = useRouter();
  const [state, dispatch] = useReducer(
    integrationsSettingsReducer,
    initialIntegrationsSettingsState,
  );

  const availableIntegrations = useQuery(api.integrations.listAvailable);
  const enabledIntegrations = useQuery(
    api.integrations.getEnabled,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const enableIntegration = useMutation(api.integrations.enable);
  const disableIntegration = useMutation(api.integrations.disable);

  useEffect(() => {
    const subscribedIntegrationId = getSearchParam("subscribed");
    if (
      subscribedIntegrationId &&
      currentOrganizationId &&
      availableIntegrations
    ) {
      const newParams = new URLSearchParams(stringifySearchParams());
      newParams.delete("subscribed");
      replace(`?${newParams.toString()}`);
      dispatch({
        type: "setPendingEnableIntegration",
        value: subscribedIntegrationId,
      });
      toast.info(tToast("waitingSubscription"));
    }
  }, [
    getSearchParam,
    stringifySearchParams,
    currentOrganizationId,
    availableIntegrations,
    replace,
  ]);

  useEffect(() => {
    const tryEnablePendingIntegration = async () => {
      if (!state.pendingEnableIntegration || !currentOrganizationId) {
        return;
      }

      try {
        const result = await enableIntegration({
          organizationId: currentOrganizationId as Id<"organizations">,
          integrationId: state.pendingEnableIntegration,
        });

        if (result.ok) {
          toast.success(tToast("integrationEnabled"));
        } else if (result.reason === "already_enabled") {
          toast.info(tToast("integrationAlreadyEnabled"));
        }

        dispatch({ type: "setPendingEnableIntegration", value: null });
      } catch (error) {
        console.error("Failed to auto-enable integration:", error);
        toast.error(tToast("integrationEnableFailed"));
      }
    };

    tryEnablePendingIntegration();
  }, [
    state.pendingEnableIntegration,
    currentOrganizationId,
    enableIntegration,
  ]);

  const setIntegrationEnabled = async (
    integrationId: string,
    enabled: boolean,
  ) => {
    if (!currentOrganizationId) return;
    const organizationId = currentOrganizationId as Id<"organizations">;

    if (!enabled) {
      await disableIntegration({ organizationId, integrationId });
      return;
    }

    try {
      const result = await enableIntegration({ organizationId, integrationId });
      if (result.ok) {
        toast.success(tToast("integrationEnabled"));
      } else {
        toast.info(tToast("integrationAlreadyEnabled"));
      }
    } catch (error) {
      console.error("Failed to enable integration:", error);
      toast.error(tToast("integrationEnableFailed"));
    }
  };

  const handleSubscribe = async () => {
    if (!currentOrganizationId || !state.selectedIntegration) return;

    dispatch({ type: "setIsCreatingCheckout", value: true });
    try {
      const result = await enableIntegration({
        organizationId: currentOrganizationId as Id<"organizations">,
        integrationId: state.selectedIntegration,
      });

      if (result.ok) {
        toast.success(tToast("integrationEnabled"));
      } else if (result.reason === "already_enabled") {
        toast.info(tToast("integrationAlreadyEnabled"));
      } else {
        toast.error(tToast("integrationEnableFailed"));
      }

      dispatch({ type: "closeSubscribeDialog" });
    } catch (error) {
      console.error("Failed to enable integration:", error);
      toast.error(tToast("integrationEnableFailed"));
    } finally {
      dispatch({ type: "setIsCreatingCheckout", value: false });
    }
  };

  if (!currentOrganizationId) {
    return <IntegrationEmptyState message={t("selectOrganization")} />;
  }

  if (
    availableIntegrations === undefined ||
    enabledIntegrations === undefined
  ) {
    return <IntegrationLoadingState />;
  }

  return (
    <div className="flex size-full flex-col gap-6">
      <div className="flex w-full flex-col gap-2">
        <h2 className="text-xl font-medium text-foreground">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <div className="flex w-full flex-col gap-4">
        {availableIntegrations.map((integration) => (
          <IntegrationCard
            key={integration.id}
            integration={integration}
            isEnabled={enabledIntegrations.includes(integration.id)}
            labels={{
              configureSettings: t("configureSettings", {
                name: integration.name.toLowerCase(),
              }),
              disableConsequence: t("disableConsequence"),
              enabled: t("enabled"),
              featuresIncluded: t("featuresIncluded"),
              requiresSubscription: t("requiresSubscription"),
              settings: t("settings"),
            }}
            onEnabledChange={(enabled) =>
              setIntegrationEnabled(integration.id, enabled)
            }
          />
        ))}
      </div>

      <SubscribeIntegrationDialog
        cancelLabel={tCommon("cancel")}
        description={t("subscribeDescription")}
        isCreatingCheckout={state.isCreatingCheckout}
        onOpenChange={(open) =>
          dispatch({ type: "setSubscribeDialogOpen", value: open })
        }
        onSubscribe={handleSubscribe}
        open={state.subscribeDialogOpen}
        redirectingLabel={t("redirecting")}
        redirectInfo={t("redirectInfo")}
        subscribeLabel={t("subscribe")}
        title={t("subscribeToEnable")}
      />
    </div>
  );
}

export default function IntegrationsSettingsPage() {
  return (
    <Suspense fallback={null}>
      <IntegrationsSettingsContent />
    </Suspense>
  );
}
