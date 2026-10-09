"use client";

import { Suspense } from "react";
import { useOrganization } from "@/components/organization-provider";
import { usePermissions } from "@/components/permission-gate";
import { useI18n } from "@/locales/client";
import { AccessionsPageSkeleton } from "../../accessions-page-skeleton";
import { ReceiveEntryForm } from "./receive-entry-form";

export default function ReceiveEntryPage() {
  const tRoot = useI18n();
  const { currentOrganizationId, isLoading } = useOrganization();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();

  if (isLoading || permissionsLoading || !currentOrganizationId) {
    return <AccessionsPageSkeleton />;
  }

  if (!hasPermission("collections.create")) {
    return (
      <div className="flex size-full items-center justify-center px-6">
        <p className="text-muted-foreground">
          {tRoot("objectEntries.noReceivePermission")}
        </p>
      </div>
    );
  }

  return (
    <div className="size-full overflow-y-auto">
      <Suspense fallback={<AccessionsPageSkeleton />}>
        <ReceiveEntryForm organizationId={currentOrganizationId} />
      </Suspense>
    </div>
  );
}
