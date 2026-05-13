"use client";

import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { Building2, Plus } from "lucide-react";
import Link from "next/link";
import { AccessionsPageClient } from "./accessions-page-client";
import { AccessionsPageSkeleton } from "./accessions-page-skeleton";

export default function AccessionsPage() {
  const { currentOrganizationId, organizations, isLoading } = useOrganization();

  if (isLoading) {
    return <AccessionsPageSkeleton />;
  }

  if (!organizations || organizations.length === 0) {
    return <NoOrganizationState />;
  }

  if (!currentOrganizationId) {
    return <AccessionsPageSkeleton />;
  }

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <AccessionsPageClient organizationId={currentOrganizationId} />
    </div>
  );
}

function NoOrganizationState() {
  const t = useScopedI18n("accessions");

  return (
    <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border/60 bg-card p-8">
        <div className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Building2 className="h-6 w-6" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground">
            {t("noOrganizationTitle")}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("noOrganizationDescription")}
          </p>
        </div>
        <Link
          href="/organizations/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-[0_0_15px_-3px_rgba(99,102,241,0.3)] transition-all hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          {t("createOrganization")}
        </Link>
      </div>
    </div>
  );
}
