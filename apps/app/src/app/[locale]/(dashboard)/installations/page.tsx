"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { Button } from "@v1/ui/button";
import { Building2, Hammer, Plus } from "lucide-react";
import Link from "next/link";

export default function InstallationsPage() {
  const common = useScopedI18n("common");
  const { currentOrganizationId, organizations, isLoading } = useOrganization();

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
              Please select or create an organization to view installations.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-background px-4 sm:px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border/60 bg-card">
          <div className="flex w-full flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg p-4 sm:p-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-medium text-primary">
                Installations
              </h2>
              <p className="text-sm font-normal text-primary/60">
                Manage exhibition installations and setups
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <PermissionGate permission="exhibitions.create">
                <Button asChild>
                  <Link href="/installations/new">
                    <Plus className="mr-2 h-4 w-4" />
                    New Installation
                  </Link>
                </Button>
              </PermissionGate>
            </div>
          </div>
          <div className="flex w-full px-6">
            <div className="w-full border-b border-border/60" />
          </div>
          <div className="flex flex-1 flex-col items-center justify-center p-8">
            <Hammer className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Installations Coming Soon
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Plan and manage exhibition installations, track setup progress,
              and coordinate teams. This feature is currently under development.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
