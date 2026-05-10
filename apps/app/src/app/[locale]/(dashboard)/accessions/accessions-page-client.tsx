"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useDeferredValue, useState } from "react";

import {
  ExportButtonWithFormat,
  type ExportFormat,
} from "@/components/export-button-with-format";
import { PermissionGate, usePermissions } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { Button } from "@v1/ui/button";
import { FileUp, Loader2, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { AccessionKanban } from "./accession-kanban";
import { AccessionsPageSkeleton } from "./accessions-page-skeleton";
import { AccessionsStats } from "./accessions-stats";
import { AccessionsWorkbenchNav } from "./accessions-workbench-nav";

type AccessionsPageClientProps = {
  organizationId: Id<"organizations">;
};

type AccessionListItem = FunctionReturnType<
  typeof api.accessions.list
>["page"][number];

export function AccessionsPageClient({
  organizationId,
}: AccessionsPageClientProps) {
  const t = useScopedI18n("accessions");
  const [searchQuery, setSearchQuery] = useState("");
  const [isEmptyingTrash, setIsEmptyingTrash] = useState(false);
  const [bulkActionError, setBulkActionError] = useState<string | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const accessions = useQuery(api.accessions.list, {
    organizationId,
    paginationOpts: { numItems: 100, cursor: null },
  });
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
  const emptyRejectedAccessions = useMutation(api.accessions.emptyRejected);

  if (accessions === undefined) {
    return <AccessionsPageSkeleton />;
  }

  const pending = accessions.page.filter(
    (item: AccessionListItem) => item.status === "pending",
  ).length;
  const approved = accessions.page.filter(
    (item: AccessionListItem) => item.status === "approved",
  ).length;
  const rejected = accessions.page.filter(
    (item: AccessionListItem) => item.status === "rejected",
  ).length;
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

  const handleEmptyTrash = async () => {
    if (rejected === 0) {
      return;
    }

    const confirmed = window.confirm(
      t("actions.emptyTrashConfirm", { count: rejected }),
    );
    if (!confirmed) {
      return;
    }

    setIsEmptyingTrash(true);
    setBulkActionError(null);

    try {
      await emptyRejectedAccessions({ organizationId });
    } catch (error) {
      console.error("Failed to empty rejected accessions:", error);
      setBulkActionError(t("error.failedToEmptyTrash"));
    } finally {
      setIsEmptyingTrash(false);
    }
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
            }}
          />
          {bulkActionError ? (
            <p className="text-xs text-destructive">{bulkActionError}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <div className="group relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground transition-colors group-focus-within:text-foreground" />
            <input
              type="text"
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
              <FileUp className="h-3.5 w-3.5" />
              Import
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
              <Plus className="h-3.5 w-3.5" />
              {t("addObject")}
            </Link>
          </PermissionGate>
          <PermissionGate
            loadingFallback={
              <div className="h-8 w-24 animate-pulse rounded-md bg-muted/60" />
            }
            permission="collections.delete"
          >
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={handleEmptyTrash}
              disabled={rejected === 0 || isEmptyingTrash}
            >
              {isEmptyingTrash ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              {isEmptyingTrash
                ? t("actions.emptyingTrash")
                : t("actions.emptyTrash")}
            </Button>
          </PermissionGate>
        </div>
      </div>

      <AccessionsWorkbenchNav
        activeView="overview"
        pendingAccessions={pending}
        pendingTransfers={pendingTransfers}
      />

      <AccessionKanban
        accessions={accessions}
        organizationId={organizationId}
        searchQuery={deferredSearchQuery}
      />
    </div>
  );
}
