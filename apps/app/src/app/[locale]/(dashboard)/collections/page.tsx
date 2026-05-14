"use client";

import {
  DashboardListPageSkeleton,
  GridCardsSkeleton,
} from "@/components/dashboard-list-page-skeleton";
import {
  ExportButtonWithFormat,
  type ExportFormat,
} from "@/components/export-button-with-format";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { formatDate } from "@/lib/format-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { useMutation, useQuery } from "convex/react";
import {
  Building2,
  FileUp,
  Folder,
  FolderPlus,
  Plus,
  Search,
  User,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

export default function CollectionsPage() {
  const t = useScopedI18n("collections");
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const [search, setSearch] = useState("");

  const exportObjectsWithFormat = useMutation(
    api.imports.exportObjectsWithFormat,
  );

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!currentOrganizationId) return undefined;
      // Map UI format to backend format
      const backendFormat = format === "dublin-core" ? "dublincore" : format;
      return exportObjectsWithFormat({
        organizationId: currentOrganizationId,
        format: backendFormat as
          | "csv"
          | "json"
          | "xml"
          | "dublincore"
          | "spectrum",
      });
    },
    [currentOrganizationId, exportObjectsWithFormat],
  );

  if (isLoading) {
    return <DashboardListPageSkeleton actionsCount={3} />;
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex size-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border/60 bg-card p-8">
          <Building2 className="size-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">
              {t("noOrganizationTitle")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("noOrganizationDescription")}
            </p>
          </div>
          <Button asChild>
            <Link href="/organizations/new">
              <Plus className="mr-2 size-4" />
              {t("createOrganization")}
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
            <h3 className="text-lg font-semibold">{t("selectOrganization")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("selectOrganizationDescription")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex size-full bg-background px-6 py-0">
      <div className="z-10 mx-auto flex size-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border/60 bg-card">
          <div className="flex w-full items-center justify-between rounded-lg p-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-medium text-primary">{t("title")}</h2>
              <p className="text-sm font-normal text-primary/60">
                {t("description")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <PermissionGate permission="collections.read">
                <ExportButtonWithFormat
                  onExport={handleExport}
                  filename="objects"
                />
              </PermissionGate>
              <PermissionGate permission="collections.create">
                <Button asChild variant="outline">
                  <Link href="/collections/import">
                    <FileUp className="mr-2 size-4" />
                    {t("importCSV")}
                  </Link>
                </Button>
              </PermissionGate>
              <PermissionGate permission="collections.create">
                <Button asChild>
                  <Link href="/collections/new">
                    <FolderPlus className="mr-2 size-4" />
                    {t("newCollection")}
                  </Link>
                </Button>
              </PermissionGate>
            </div>
          </div>
          <div className="flex w-full px-6">
            <div className="w-full border-b border-border/60" />
          </div>

          <div className="p-6">
            <div className="mb-6 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t("searchPlaceholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <CollectionGroupsList
              organizationId={currentOrganizationId}
              search={search}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function CollectionGroupsList({
  organizationId,
  search,
}: {
  organizationId: Id<"organizations">;
  search: string;
}) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("collections");
  const groups = useQuery(api.collectionGroups.list, {
    organizationId,
    search: search || undefined,
  });

  if (groups === undefined) {
    return <GridCardsSkeleton count={6} />;
  }

  if (groups.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{t("noCollections")}</p>
        <PermissionGate permission="collections.create">
          <Button asChild>
            <Link href="/collections/new">
              <FolderPlus className="mr-2 size-4" />
              {t("createFirst")}
            </Link>
          </Button>
        </PermissionGate>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {groups.map((group) => (
        <Link
          key={group._id}
          href={`/collections/${group._id}`}
          className="group flex flex-col rounded-xl border border-border/60 bg-card p-4 transition-all duration-300 hover:border-indigo-500/30 hover:ring-1 hover:ring-indigo-500/30 hover:shadow-xl hover:shadow-indigo-900/10"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <Folder className="size-5 text-primary/60 group-hover:text-primary" />
              <h3 className="font-medium line-clamp-1">{group.name}</h3>
            </div>
            <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {group.itemsCount || 0} {t("items")}
            </span>
          </div>
          {group.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2 flex-1">
              {group.description}
            </p>
          )}
          <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {t("created")} {formatDate(new Date(group.createdAt), locale)}
            </span>
            {group.curatorName && (
              <span className="flex items-center gap-1">
                <User className="size-3" />
                {group.curatorName}
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
