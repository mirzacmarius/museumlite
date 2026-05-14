"use client";

import { useOrganization } from "@/components/organization-provider";
import { usePermissions } from "@/components/permission-gate";
import { AccessionsPageSkeleton } from "../accessions-page-skeleton";
import { TransfersBoard } from "../transfers-board";

export default function AccessionTransfersPage() {
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
          Create or join an organization to view transfers.
        </p>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center px-6">
        <p className="text-muted-foreground">
          Select an organization to continue.
        </p>
      </div>
    );
  }

  if (!hasPermission("organization.manage_settings")) {
    return (
      <div className="flex size-full items-center justify-center px-6">
        <p className="text-muted-foreground">
          You do not have permission to review transfer approvals.
        </p>
      </div>
    );
  }

  return <TransfersBoard organizationId={currentOrganizationId} />;
}
