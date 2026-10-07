"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { FeatureGuard } from "@v1/ui/feature-guard";
import { useQuery } from "convex/react";
import { Building2, Plus } from "lucide-react";
import Link from "next/link";
import { useOrganization } from "@/components/organization-provider";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useScopedI18n } from "@/locales/client";
import { PortalPreview } from "./_components/portal-preview";
import { PortalSettingsSidebar } from "./_components/portal-settings-sidebar";
import { PortalPageSkeleton } from "./portal-page-skeleton";

export default function PublicPortalPage() {
  const common = useScopedI18n("common");
  const t = useScopedI18n("untranslatedDashboard.portal");
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
    return <PortalPageSkeleton />;
  }

  if (!organizations || organizations.length === 0 || !currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border/60 bg-card p-8">
          <Building2 className="size-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="section-title">{t("noOrganizationSelected")}</h3>
            <p className="caption mt-2 text-muted-foreground">
              {t("selectOrganizationPortal")}
            </p>
          </div>
          <Button asChild>
            <Link href="/organizations/new">
              <Plus className="mr-2 size-4" />
              {common("createOrganization")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (isPortalLocked) {
    return (
      <FeatureGuard featureName={t("publicPortal")} isLocked tierNeeded="pro">
        <div className="min-h-[400px]" />
      </FeatureGuard>
    );
  }

  if (portalSettings === undefined) {
    return <PortalPageSkeleton />;
  }

  return (
    <FeatureGuard featureName={t("publicPortal")} isLocked={false} tierNeeded="pro">
      <div className="flex size-full flex-col overflow-hidden bg-background">
        <div className="shrink-0 border-b border-border px-6 py-4">
          <h1 className="page-title">{t("publicPortal")}</h1>
          <p className="page-description mt-1">
            {t("configureAndPreview")}
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
