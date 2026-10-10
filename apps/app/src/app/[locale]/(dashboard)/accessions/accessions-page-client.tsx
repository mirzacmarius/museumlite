"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { FileUp, Plus, Search } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import {
  ExportButtonWithFormat,
  type ExportFormat,
} from "@/components/export-button-with-format";
import { PermissionGate, usePermissions } from "@/components/permission-gate";
import { useListState } from "@/hooks/use-list-state";
import { useListReturnPath } from "@/hooks/use-return-path";
import { useI18n, useScopedI18n } from "@/locales/client";
import { AccessionKanban } from "./accession-kanban";
import {
  ACCESSION_LIST_KEYS,
  accessionListState,
} from "./accession-list-state";
import { AccessionsPageSkeleton } from "./accessions-page-skeleton";
import { AccessionsStats } from "./accessions-stats";
import { AccessionsWorkbenchNav } from "./accessions-workbench-nav";

type AccessionsPageClientProps = {
  organizationId: Id<"organizations">;
};

export function AccessionsPageClient({
  organizationId,
}: AccessionsPageClientProps) {
  const tRoot = useI18n();
  const t = useScopedI18n("accessions");
  const list = useListState(accessionListState);
  const { searchInput: searchQuery, setSearchInput: setSearchQuery } = list;
  const returnPath = useListReturnPath(ACCESSION_LIST_KEYS);
  const counts = useQuery(api.accessions.getBoardCounts, { organizationId });
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const canReviewTransfers =
    !permissionsLoading && hasPermission("organization.manage_settings");
  const transferRequests = useQuery(
    api.objectMoves.listForOrganization,
    canReviewTransfers ? { organizationId } : "skip",
  );

  const exportAccessionsWithFormat = useMutation(
    api.imports.exportAccessionsWithFormat,
  );

  if (counts === undefined) {
    return <AccessionsPageSkeleton />;
  }

  const { pending, approved, rejected, withdrawn } = counts;
  const pendingTransfers =
    transferRequests?.filter((request) => request.status === "pending")
      .length ?? "-";

  const handleExport = async (format: ExportFormat) => {
    // Accessions don't support Dublin Core
    if (format === "dublin-core") return undefined;
    return exportAccessionsWithFormat({
      organizationId,
      format: format as "csv" | "json" | "xml" | "spectrum",
    });
  };

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex min-h-[52px] items-center justify-between gap-6">
        <div className="space-y-2">
          <AccessionsStats
            stats={{
              pending,
              approved,
              rejected,
              withdrawn,
            }}
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="group relative">
            <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground transition-colors group-focus-within:text-foreground" />
            <input
              type="search"
              aria-label={t("searchPlaceholder")}
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 rounded-md border border-input bg-background/60 py-1.5 pl-8 pr-3 text-xs text-foreground transition-all placeholder:text-muted-foreground focus:border-ring focus:bg-background focus:outline-none"
            />
          </div>
          <PermissionGate
            loadingFallback={
              <div className="h-8 w-20 animate-pulse rounded-md bg-muted/60" />
            }
            permission="collections.read"
          >
            <ExportButtonWithFormat
              buttonClassName="h-8 px-2.5 text-xs"
              buttonSize="sm"
              onExport={handleExport}
              filename="accessions"
              supportedFormats={["csv", "json", "xml", "spectrum"]}
            />
          </PermissionGate>
          <PermissionGate
            loadingFallback={
              <div className="h-8 w-20 animate-pulse rounded-md bg-muted/60" />
            }
            permission="collections.create"
          >
            <Link
              href="/accessions/import"
              className="flex h-8 items-center gap-1.5 rounded-md border border-input bg-background/60 px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <FileUp className="size-3.5" />
              {tRoot("untranslatedRecords.objects.actions.import")}
            </Link>
          </PermissionGate>
          <PermissionGate
            loadingFallback={
              <div className="h-8 w-24 animate-pulse rounded-md bg-muted/60" />
            }
            permission="collections.create"
          >
            <Link
              href="/objects/new"
              className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground shadow-[0_0_15px_-3px_rgba(99,102,241,0.3)] transition-colors hover:bg-primary/90"
            >
              <Plus className="size-3.5" />
              {t("addObject")}
            </Link>
          </PermissionGate>
        </div>
      </div>

      <AccessionsWorkbenchNav
        activeView="overview"
        pendingAccessions={pending}
        pendingTransfers={pendingTransfers}
      />

      <Suspense fallback={<AccessionsPageSkeleton />}>
        <AccessionKanban
          organizationId={organizationId}
          searchQuery={list.state.search}
          columnCounts={counts.columns}
          withdrawnCount={withdrawn}
          returnPath={returnPath}
        />
      </Suspense>
    </div>
  );
}
