"use client";

import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
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
} from "@v1/ui/alert-dialog";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Switch } from "@v1/ui/switch";
import { useMutation, useQuery } from "convex/react";
import { BookOpen, Check, ChevronRight, Loader2, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const INTEGRATION_ICONS: Record<string, React.ReactNode> = {
  library: <BookOpen className="h-6 w-6" />,
};

export default function IntegrationsSettingsPage() {
  const { currentOrganizationId } = useOrganization();
  const tToast = useScopedI18n("common.toast");
  const t = useScopedI18n("integrations");
  const tCommon = useScopedI18n("common");
  const searchParams = useSearchParams();
  const router = useRouter();
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [subscribeDialogOpen, setSubscribeDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(
    null,
  );
  const [isToggling, setIsToggling] = useState<string | null>(null);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [pendingEnableIntegration, setPendingEnableIntegration] = useState<
    string | null
  >(null);

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
    const subscribedIntegrationId = searchParams?.get("subscribed");
    if (
      subscribedIntegrationId &&
      currentOrganizationId &&
      availableIntegrations
    ) {
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete("subscribed");
      router.replace(`?${newParams.toString()}`);
      setPendingEnableIntegration(subscribedIntegrationId);
      toast.info(tToast("waitingSubscription"));
    }
  }, [searchParams, currentOrganizationId, availableIntegrations, router]);

  useEffect(() => {
    const tryEnablePendingIntegration = async () => {
      if (!pendingEnableIntegration || !currentOrganizationId) {
        return;
      }

      try {
        const result = await enableIntegration({
          organizationId: currentOrganizationId as Id<"organizations">,
          integrationId: pendingEnableIntegration,
        });

        if (result.ok) {
          toast.success(tToast("integrationEnabled"));
        } else if (result.reason === "already_enabled") {
          toast.info(tToast("integrationAlreadyEnabled"));
        }

        setPendingEnableIntegration(null);
      } catch (error) {
        console.error("Failed to auto-enable integration:", error);
        toast.error(tToast("integrationEnableFailed"));
      }
    };

    tryEnablePendingIntegration();
  }, [pendingEnableIntegration, currentOrganizationId, enableIntegration]);

  const handleToggle = async (
    integrationId: string,
    currentlyEnabled: boolean,
  ) => {
    if (!currentOrganizationId) return;

    if (currentlyEnabled) {
      setSelectedIntegration(integrationId);
      setDisableDialogOpen(true);
    } else {
      setIsToggling(integrationId);
      try {
        const result = await enableIntegration({
          organizationId: currentOrganizationId as Id<"organizations">,
          integrationId,
        });

        if (result.ok) {
          toast.success(tToast("integrationEnabled"));
        } else {
          toast.info(tToast("integrationAlreadyEnabled"));
        }
      } finally {
        setIsToggling(null);
      }
    }
  };

  const handleSubscribe = async () => {
    if (!currentOrganizationId || !selectedIntegration) return;

    setIsCreatingCheckout(true);
    try {
      const result = await enableIntegration({
        organizationId: currentOrganizationId as Id<"organizations">,
        integrationId: selectedIntegration,
      });

      if (result.ok) {
        toast.success(tToast("integrationEnabled"));
      } else if (result.reason === "already_enabled") {
        toast.info(tToast("integrationAlreadyEnabled"));
      } else {
        toast.error(tToast("integrationEnableFailed"));
      }

      setSubscribeDialogOpen(false);
      setSelectedIntegration(null);
    } catch (error) {
      console.error("Failed to enable integration:", error);
      toast.error(tToast("integrationEnableFailed"));
    } finally {
      setIsCreatingCheckout(false);
    }
  };

  const handleConfirmDisable = async () => {
    if (!currentOrganizationId || !selectedIntegration) return;

    setIsToggling(selectedIntegration);
    setDisableDialogOpen(false);
    try {
      await disableIntegration({
        organizationId: currentOrganizationId as Id<"organizations">,
        integrationId: selectedIntegration,
      });
    } finally {
      setIsToggling(null);
      setSelectedIntegration(null);
    }
  };

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full flex-col gap-6">
        <div className="flex w-full flex-col items-start rounded-lg border border-border bg-card p-6">
          <p className="text-muted-foreground">{t("selectOrganization")}</p>
        </div>
      </div>
    );
  }

  if (
    availableIntegrations === undefined ||
    enabledIntegrations === undefined
  ) {
    return (
      <div className="flex h-full w-full flex-col gap-6">
        <div className="flex w-full items-center justify-center rounded-lg border border-border bg-card p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-6">
      {/* Header */}
      <div className="flex w-full flex-col items-start rounded-lg border border-border bg-card">
        <div className="flex w-full flex-col gap-2 p-6">
          <h2 className="text-xl font-medium text-primary">{t("title")}</h2>
          <p className="text-sm font-normal text-primary/60">
            {t("description")}
          </p>
        </div>
      </div>

      {/* Integrations List */}
      <div className="flex w-full flex-col gap-4">
        {availableIntegrations.map((integration) => {
          const isEnabled = enabledIntegrations.includes(integration.id);
          const isLoading = isToggling === integration.id;
          const requiresSubscription = integration.requiresSubscription;

          return (
            <div
              key={integration.id}
              className="flex w-full flex-col rounded-lg border border-border bg-card"
            >
              <div className="flex w-full items-start justify-between p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/5 text-primary">
                    {INTEGRATION_ICONS[integration.id] || (
                      <Settings className="h-6 w-6" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-medium">
                        {integration.name}
                      </h3>
                      {isEnabled && (
                        <Badge variant="secondary" className="text-xs">
                          <Check className="mr-1 h-3 w-3" />
                          {t("enabled")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {integration.description}
                    </p>
                    {requiresSubscription && (
                      <p className="mt-1 text-xs font-medium text-muted-foreground">
                        {t("requiresSubscription")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={() =>
                        handleToggle(integration.id, isEnabled)
                      }
                    />
                  )}
                </div>
              </div>

              {/* Features */}
              <div className="border-t border-border px-6 py-4">
                <h4 className="mb-3 text-sm font-medium text-muted-foreground">
                  {t("featuresIncluded")}
                </h4>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {integration.features.map((feature) => (
                    <div
                      key={feature}
                      className="flex items-center gap-2 text-sm text-primary/80"
                    >
                      <Check className="h-4 w-4 text-green-500" />
                      {feature}
                    </div>
                  ))}
                </div>
              </div>

              {/* Settings Link (when enabled) */}
              {isEnabled && (
                <div className="flex items-center justify-between border-t border-border bg-secondary/50 px-6 py-3 dark:bg-card">
                  <p className="text-sm text-muted-foreground">
                    {t("configureSettings", {
                      name: integration.name.toLowerCase(),
                    })}
                  </p>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/settings/integrations/${integration.id}`}>
                      {t("settings")}
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Disable Confirmation Dialog */}
      <AlertDialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("disableIntegration")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("disableDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDisable}>
              {t("disable")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Subscribe Dialog */}
      <Dialog open={subscribeDialogOpen} onOpenChange={setSubscribeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("subscribeToEnable")}</DialogTitle>
            <DialogDescription>{t("subscribeDescription")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <p className="text-sm text-muted-foreground">{t("redirectInfo")}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setSubscribeDialogOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleSubscribe} disabled={isCreatingCheckout}>
              {isCreatingCheckout ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("redirecting")}
                </>
              ) : (
                <>{t("subscribe")}</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
