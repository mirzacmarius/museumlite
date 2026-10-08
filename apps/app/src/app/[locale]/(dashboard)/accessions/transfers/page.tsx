"use client";

import { Suspense } from "react";
import { useOrganization } from "@/components/organization-provider";
import { usePermissions } from "@/components/permission-gate";
import { useI18n } from "@/locales/client";
import { AccessionsPageSkeleton } from "../accessions-page-skeleton";
import { TransfersBoard } from "../transfers-board";
export default function AccessionTransfersPage() {
  const tRoot = useI18n();
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();

  if (isLoading || permissionsLoading) {
    return (
      <AccessionsPageSkeleton
        actionsCount={1}
        showWorkbenchNav={true}
        statsCount={5}
      />
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex size-full items-center justify-center px-6">
        <p className="text-muted-foreground">
          {tRoot("untranslatedRecords.accessions.selectOrganizationTransfers")}
        </p>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center px-6">
        <p className="text-muted-foreground">
          {tRoot("collections.selectOrganizationContinue")}
        </p>
      </div>
    );
  }

  if (!hasPermission("organization.manage_settings")) {
    return (
      <div className="flex size-full items-center justify-center px-6">
        <p className="text-muted-foreground">
          {tRoot("untranslatedRecords.accessions.transferPermission")}
        </p>
      </div>
    );
  }

  return (
    <Suspense fallback={<AccessionsPageSkeleton />}>
      <TransfersBoard organizationId={currentOrganizationId} />
    </Suspense>
  );
}
