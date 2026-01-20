"use client";

import { useOrganization } from "@/components/organization-provider";
import { usePermission } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { Switch } from "@v1/ui/switch";
import { useMutation, useQuery } from "convex/react";
import {
  Archive,
  BookOpen,
  Car,
  Check,
  Leaf,
  Loader2,
  Palette,
  Users,
  Wine,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const MODULES = [
  {
    id: "accounts",
    name: "Accounts & CRM",
    description:
      "Manage donors, lenders, institutions, contacts, documents, and relationships.",
    icon: Users,
  },
  {
    id: "fine_art",
    name: "Fine Art",
    description:
      "Fine art cataloging with provenance tracking and curation workflows.",
    icon: Palette,
  },
  {
    id: "wine",
    name: "Wine",
    description:
      "Wine collection management with cellar tracking and tasting notes.",
    icon: Wine,
  },
  {
    id: "automotive",
    name: "Automotive",
    description:
      "Automotive collections with VIN tracking and restoration history.",
    icon: Car,
  },
  {
    id: "natural_history",
    name: "Natural History",
    description:
      "Specimen cataloging with taxonomy classification and collection data.",
    icon: Leaf,
  },
  {
    id: "archive",
    name: "Archive",
    description:
      "Archival collections with finding aids and hierarchical arrangement.",
    icon: Archive,
  },
  {
    id: "library",
    name: "Library",
    description:
      "Library management with patrons, circulation, holds, and fines.",
    icon: BookOpen,
    requiresIntegration: "library",
  },
] as const;

type ModuleId = (typeof MODULES)[number]["id"];

export default function ModulesSettingsPage() {
  const { currentOrganizationId } = useOrganization();
  const t = useScopedI18n("settings.modules");
  const tToast = useScopedI18n("common.toast");
  const canManage = usePermission(
    currentOrganizationId,
    "organization.manage_settings",
  );
  const [enabledModules, setEnabledModules] = useState<ModuleId[]>([]);
  const [isSaving, setIsSaving] = useState<ModuleId | null>(null);

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
    setIsSaving(moduleId);
    try {
      await updateOrganization({
        organizationId: currentOrganizationId as Id<"organizations">,
        settings: { enabledModules: next },
      });
      toast.success(
        tToast("moduleToggled", { action: enabled ? "enabled" : "disabled" }),
      );
    } catch (error) {
      setEnabledModules(previous);
      toast.error(tToast("moduleUpdateFailed"));
    } finally {
      setIsSaving(null);
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

  if (organization === undefined || enabledIntegrations === undefined) {
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
      <div className="flex w-full flex-col items-start rounded-lg border border-border bg-card">
        <div className="flex w-full flex-col gap-2 p-6">
          <h2 className="text-xl font-medium text-primary">{t("title")}</h2>
          <p className="text-sm font-normal text-primary/60">
            {t("description")}
          </p>
        </div>
      </div>
      <div className="flex w-full flex-col gap-4">
        {MODULES.map((module) => {
          const isEnabled = enabledModules.includes(module.id);
          const isLoading = isSaving === module.id;
          const requiredIntegration =
            "requiresIntegration" in module ? module.requiresIntegration : null;
          const integrationLocked =
            requiredIntegration &&
            !enabledIntegrations.includes(requiredIntegration);
          const Icon = module.icon;
          return (
            <div
              key={module.id}
              className="flex w-full flex-col rounded-lg border border-border bg-card"
            >
              <div className="flex w-full items-start justify-between p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/5 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-medium">{module.name}</h3>
                      {isEnabled && (
                        <Badge variant="secondary" className="text-xs">
                          <Check className="mr-1 h-3 w-3" />
                          {t("enabled")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {module.description}
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
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <Switch
                      checked={isEnabled}
                      disabled={!canManage || integrationLocked}
                      onCheckedChange={(checked) =>
                        toggleModule(module.id, checked)
                      }
                    />
                  )}
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
