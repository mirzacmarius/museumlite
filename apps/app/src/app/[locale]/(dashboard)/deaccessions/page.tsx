"use client";

import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { Archive, Plus } from "lucide-react";
import Link from "next/link";
import { AccessionsPageSkeleton } from "../accessions/accessions-page-skeleton";
import { DeaccessionsPageClient } from "./deaccessions-page-client";

export default function DeaccessionsPage() {
  const { currentOrganizationId, organizations, isLoading } = useOrganization();

  if (isLoading) {
    return (
      <AccessionsPageSkeleton
        actionsCount={3}
        showWorkbenchNav={false}
        statsCount={2}
      />
    );
  }

  if (!organizations || organizations.length === 0) {
    return <NoOrganizationState />;
  }

  if (!currentOrganizationId) {
    return (
      <AccessionsPageSkeleton
        actionsCount={3}
        showWorkbenchNav={false}
        statsCount={2}
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <DeaccessionsPageClient organizationId={currentOrganizationId} />
    </div>
  );
}

function NoOrganizationState() {
  const t = useScopedI18n("deaccessions");

  return (
    <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border/60 bg-card p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Archive className="h-6 w-6" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground">
            {t("noOrg.title")}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("noOrg.description")}
          </p>
        </div>
        <Link
          href="/organizations/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-[0_0_15px_-3px_rgba(99,102,241,0.3)] transition-all hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          {t("noOrg.createButton")}
        </Link>
      </div>
    </div>
  );
}
