"use client";

import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { Button } from "@v1/ui/button";
import { Building2, Plus } from "lucide-react";
import Link from "next/link";
import { CollectionFiltersAndList } from "./_components/collection-filters-and-list";
import { ObjectCatalogSkeleton } from "./loading";

export default function CollectionsPage() {
  const t = useScopedI18n("objects");
  const common = useScopedI18n("common");
  const { currentOrganizationId, organizations, isLoading } = useOrganization();

  if (isLoading) {
    return <ObjectCatalogSkeleton />;
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex size-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border/60 bg-card p-8">
          <Building2 className="size-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">{t("objectNotFound")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("form.errors.selectOrganization")}
            </p>
          </div>
          <Button asChild>
            <Link href="/organizations/new">
              <Plus className="mr-2 size-4" />
              {common("create")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border/60 bg-card p-8">
          <Building2 className="size-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">
              {t("form.errors.selectOrganization")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("form.errors.selectOrganization")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex size-full flex-col overflow-hidden bg-background">
      <CollectionFiltersAndList organizationId={currentOrganizationId} />
    </div>
  );
}
