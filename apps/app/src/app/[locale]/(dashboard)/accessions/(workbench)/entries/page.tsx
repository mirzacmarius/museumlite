"use client";

import { Suspense } from "react";
import { useOrganization } from "@/components/organization-provider";
import { usePermissions } from "@/components/permission-gate";
import { useI18n } from "@/locales/client";
import { AccessionsPageSkeleton } from "../../accessions-page-skeleton";
import { EntriesPageClient } from "../../entries/_components/entries-page-client";

export default function AccessionEntriesPage() {
  const tRoot = useI18n();
  const { currentOrganizationId, isLoading } = useOrganization();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();

  if (isLoading || permissionsLoading || !currentOrganizationId) {
    return <AccessionsPageSkeleton />;
  }

  if (!hasPermission("collections.read")) {
    return (
      <div className="flex size-full items-center justify-center px-6">
        <p className="text-muted-foreground">
          {tRoot("objectEntries.noPermission")}
        </p>
      </div>
    );
  }

  return (
    <Suspense fallback={<AccessionsPageSkeleton />}>
      <EntriesPageClient organizationId={currentOrganizationId} />
    </Suspense>
  );
}
