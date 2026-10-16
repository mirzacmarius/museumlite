"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  MODULE_INTEGRATION_REQUIREMENTS,
  type ModuleId,
  SETTINGS_MODULE_IDS,
} from "@v1/backend/convex/utils/moduleCatalog";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import {
  Archive,
  BookOpen,
  Car,
  Check,
  Coins,
  DollarSign,
  Leaf,
  Loader2,
  Palette,
  Shield,
  Users,
  Wine,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmedSwitch } from "@/components/confirmed-switch";
import { useOrganization } from "@/components/organization-provider";
import { usePermission } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";

const MODULE_ICONS: Record<ModuleId, typeof Users> = {
  library: BookOpen,
  fine_art: Palette,
  wine: Wine,
  automotive: Car,
  natural_history: Leaf,
  archive: Archive,
  accounts: Users,
  coins_stamps: Coins,
  inventory_valuation: DollarSign,
  insurance: Shield,
};

export default function ModulesSettingsPage() {
  const { currentOrganizationId } = useOrganization();
  const t = useScopedI18n("modules");
  const tToast = useScopedI18n("common.toast");
  const canManage = usePermission(
    currentOrganizationId,
    "organization.manage_settings",
  );
  const [enabledModules, setEnabledModules] = useState<ModuleId[]>([]);

  const organization = useQuery(
    api.organizations.get,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );
  const enabledIntegrations = useQuery(
    api.integrations.getEnabled,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );
  const updateOrganization = useMutation(api.organizations.update);

  useEffect(() => {
    if (organization) {
      setEnabledModules(
        (organization.settings?.enabledModules ?? []) as ModuleId[],
      );
    }
  }, [organization]);

  const toggleModule = async (moduleId: ModuleId, enabled: boolean) => {
    if (!currentOrganizationId) return;
    const previous = enabledModules;
    const next = enabled
      ? Array.from(new Set([...enabledModules, moduleId]))
      : enabledModules.filter((id) => id !== moduleId);
    setEnabledModules(next);
    try {
      await updateOrganization({
        organizationId: currentOrganizationId as Id<"organizations">,
        settings: { enabledModules: next },
      });
      toast.success(
        enabled ? tToast("moduleEnabled") : tToast("moduleDisabled"),
      );
    } catch (_error) {
      setEnabledModules(previous);
      toast.error(tToast("moduleUpdateFailed"));
    }
  };

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full flex-col gap-6">
        <div className="flex w-full flex-col items-start rounded-lg border border-border bg-card p-6">
          <p className="text-muted-foreground">{t("selectOrganization")}</p>
        </div>
      </div>
    );
  }

  if (organization === undefined || enabledIntegrations === undefined) {
    return (
      <div className="flex size-full flex-col gap-6">
        <div className="flex w-full items-center justify-center rounded-lg border border-border bg-card p-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex size-full flex-col gap-6">
      <div className="flex w-full flex-col gap-2">
        <h2 className="text-xl font-medium text-foreground">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <div className="flex w-full flex-col gap-4">
        {SETTINGS_MODULE_IDS.map((moduleId) => {
          const isEnabled = enabledModules.includes(moduleId);
          const requiredIntegration =
            MODULE_INTEGRATION_REQUIREMENTS[moduleId] ?? null;
          const integrationLocked =
            requiredIntegration &&
            !enabledIntegrations.includes(requiredIntegration);
          const Icon = MODULE_ICONS[moduleId];
          return (
            <div
              key={moduleId}
              className="flex w-full flex-col rounded-lg border border-border bg-card"
            >
              <div className="flex w-full items-start justify-between p-6">
                <div className="flex items-start gap-4">
                  <div className="flex size-12 items-center justify-center rounded-lg bg-primary/5 text-primary">
                    <Icon className="size-6" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <h3
                        id={`module-${moduleId}-name`}
                        className="text-lg font-medium"
                      >
                        {t(`${moduleId}.name` as const)}
                      </h3>
                      {isEnabled && (
                        <Badge variant="secondary" className="text-xs">
                          <Check className="mr-1 size-3" />
                          {t("enabled")}
                        </Badge>
                      )}
                    </div>
                    <p
                      id={`module-${moduleId}-description`}
                      className="text-sm text-muted-foreground"
                    >
                      {t(`${moduleId}.description` as const)}
                    </p>
                    {integrationLocked && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("requiresIntegration", {
                          integration: requiredIntegration,
                        })}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <ConfirmedSwitch
                    labelId={`module-${moduleId}-name`}
                    descriptionId={`module-${moduleId}-description`}
                    settingName={t(`${moduleId}.name` as const)}
                    checked={isEnabled}
                    disabled={!canManage || !!integrationLocked}
                    onConfirmedChange={(checked) =>
                      toggleModule(moduleId, checked)
                    }
                  />
                </div>
              </div>
              {integrationLocked && (
                <div className="flex items-center justify-between border-t border-border bg-secondary/50 px-6 py-3 dark:bg-card">
                  <p className="text-sm text-muted-foreground">
                    {t("unlockIntegration", {
                      integration: requiredIntegration,
                    })}
                  </p>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/settings/integrations">
                      {t("viewIntegrations")}
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!canManage && (
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">{t("noPermission")}</p>
        </div>
      )}
    </div>
  );
}
