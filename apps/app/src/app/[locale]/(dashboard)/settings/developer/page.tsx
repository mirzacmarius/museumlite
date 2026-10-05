"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import { AlertTriangle, Key, Thermometer, Webhook } from "lucide-react";
import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { ApiKeysTab } from "./api-keys-tab";
import { EnvironmentalDevicesTab } from "./environmental-devices-tab";
import { UtilitiesTab } from "./utilities-tab";
import { WebhooksTab } from "./webhooks-tab";

export default function DeveloperPage() {
  const { currentOrganizationId } = useOrganization();
  const t = useScopedI18n("settings.developer");

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{t("selectOrganization")}</p>
      </div>
    );
  }

  const organizationId = currentOrganizationId as Id<"organizations">;

  return (
    <div className="flex min-w-0 w-full flex-col gap-6">
      <div className="flex min-w-0 w-full flex-col gap-2">
        <h2 className="text-xl font-medium text-foreground">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <Tabs defaultValue="api-keys" className="min-w-0 w-full">
        <div className="min-w-0 max-w-full overflow-x-auto">
          <TabsList className="w-max">
            <TabsTrigger value="api-keys" className="gap-2">
              <Key className="size-4" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-2">
              <Webhook className="size-4" />
              Webhooks
            </TabsTrigger>
            <TabsTrigger value="environmental-devices" className="gap-2">
              <Thermometer className="size-4" />
              Environmental devices
            </TabsTrigger>
            <TabsTrigger value="utilities" className="gap-2">
              <AlertTriangle className="size-4" />
              Utilities
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="api-keys" className="mt-6">
          <ApiKeysTab organizationId={organizationId} />
        </TabsContent>

        <TabsContent value="webhooks" className="mt-6">
          <WebhooksTab organizationId={organizationId} />
        </TabsContent>

        <TabsContent value="environmental-devices" className="mt-6">
          <EnvironmentalDevicesTab organizationId={organizationId} />
        </TabsContent>

        <TabsContent value="utilities" className="mt-6">
          <UtilitiesTab organizationId={organizationId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
