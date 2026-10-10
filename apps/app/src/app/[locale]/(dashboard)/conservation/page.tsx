"use client";

import { Button } from "@v1/ui/button";
import { GalleryVerticalEnd, Plus } from "lucide-react";
import Link from "next/link";
import { CapabilityGuard } from "@/components/capability-guard";
import { DashboardListPageSkeleton } from "@/components/dashboard-list-page-skeleton";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { TreatmentList } from "./_components/treatment-list";

export default function ConservationPage() {
  const t = useScopedI18n("conservation");
  const { currentOrganizationId, isLoading } = useOrganization();

  if (isLoading) {
    return <DashboardListPageSkeleton actionsCount={1} />;
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-muted/50 p-8">
          <GalleryVerticalEnd className="size-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">
              {t("noOrganizationTitle")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("noOrganizationDescription")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <CapabilityGuard capability="conservation" featureName={t("title")}>
      <div className="flex size-full flex-col overflow-y-auto bg-background">
        <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:space-y-8 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex flex-col gap-2">
              <h2 className="page-title">{t("title")}</h2>
              <p className="page-description">{t("description")}</p>
            </div>
            <PermissionGate permission="collections.update">
              <Button asChild>
                <Link href="/conservation/new">
                  <Plus className="mr-2 size-4" />
                  {t("newTreatment")}
                </Link>
              </Button>
            </PermissionGate>
          </div>

          <TreatmentList organizationId={currentOrganizationId} />
        </div>
      </div>
    </CapabilityGuard>
  );
}
