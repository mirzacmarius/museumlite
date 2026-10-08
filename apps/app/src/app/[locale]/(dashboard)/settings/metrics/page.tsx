"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useOrganization } from "@/components/organization-provider";
import { usePermissions } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { ProjectionHealthPanel } from "./projection-health-panel";

export default function MetricsHealthPage() {
  const t = useScopedI18n("projectionHealth.page");
  const { currentOrganizationId } = useOrganization();
  const { hasPermission, isLoading } = usePermissions();

  return (
    <div className="flex size-full flex-col gap-6">
      <div className="flex w-full flex-col gap-2">
        <h2 className="text-xl font-medium text-foreground">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      {!currentOrganizationId ? (
        <p className="text-sm text-muted-foreground">
          {t("selectOrganization")}
        </p>
      ) : isLoading ? null : !hasPermission("organization.manage_settings") ? (
        <p className="text-sm text-muted-foreground">{t("noPermission")}</p>
      ) : (
        <ProjectionHealthPanel
          organizationId={currentOrganizationId as Id<"organizations">}
        />
      )}
    </div>
  );
}
