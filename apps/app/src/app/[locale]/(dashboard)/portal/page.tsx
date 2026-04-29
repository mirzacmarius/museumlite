"use client";

import { useOrganization } from "@/components/organization-provider";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { FeatureGuard } from "@v1/ui/feature-guard";
import { useQuery } from "convex/react";
import { Building2, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { PortalPreview } from "./_components/portal-preview";
import { PortalSettingsSidebar } from "./_components/portal-settings-sidebar";

export default function PublicPortalPage() {
  const common = useScopedI18n("common");
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const { hasFeature } = useFeatureAccess();
  const isPortalLocked = !hasFeature("public_portal");

  const portalSettings = useQuery(
    api.organizations.getPortalSettings,
    currentOrganizationId && !isPortalLocked
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
            <h3 className="section-title">No Organization Selected</h3>
            <p className="caption mt-2 text-muted-foreground">
              Please select or create an organization to manage your public
              portal.
            </p>
          </div>
          <Button asChild>
            <Link href="/organizations/new">
              <Plus className="mr-2 h-4 w-4" />
              {common("createOrganization")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (isPortalLocked) {
    return (
      <FeatureGuard
        featureName="Public Portal"
        isLocked
        tierNeeded="pro"
      >
        <div className="min-h-[400px]" />
      </FeatureGuard>
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
    <FeatureGuard featureName="Public Portal" isLocked={false} tierNeeded="pro">
      <div className="flex h-full w-full flex-col overflow-hidden bg-background">
        <div className="shrink-0 border-b border-border px-6 py-4">
          <h1 className="page-title">Public Portal</h1>
          <p className="page-description mt-1">
            Configure and preview your public-facing collection portal
          </p>
        </div>

        <div className="flex min-h-0 flex-1 gap-6 p-6">
          <PortalSettingsSidebar />
          <PortalPreview
            isEnabled={portalSettings.isEnabled}
            orgSlug={portalSettings.orgSlug}
            portalSlug={portalSettings.portalSlug}
          />
        </div>
      </div>
    </FeatureGuard>
  );
}
