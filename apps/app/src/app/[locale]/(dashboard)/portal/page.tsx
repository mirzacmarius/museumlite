"use client";

import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { Building2, Loader2 } from "lucide-react";
import { PortalPreview } from "./_components/portal-preview";
import { PortalSettingsSidebar } from "./_components/portal-settings-sidebar";

export default function PublicPortalPage() {
  const common = useScopedI18n("common");
  const { currentOrganizationId, organizations, isLoading } = useOrganization();

  const portalSettings = useQuery(
    api.organizations.getPortalSettings,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">{common("loading")}</p>
      </div>
    );
  }

  if (!organizations || organizations.length === 0 || !currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border/60 bg-card p-8">
          <Building2 className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">No Organization Selected</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Please select or create an organization to manage your public
              portal.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (portalSettings === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-background px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">
          Public Portal
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure and preview your public-facing collection portal
        </p>
      </div>

      <div className="flex flex-1 gap-6 min-h-0">
        <PortalSettingsSidebar />
        <PortalPreview
          isEnabled={portalSettings.isEnabled}
          orgSlug={portalSettings.orgSlug}
          portalSlug={portalSettings.portalSlug}
        />
      </div>
    </div>
  );
}
