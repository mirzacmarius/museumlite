"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { type Preloaded, useMutation, usePreloadedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useCallback, useDeferredValue, useState } from "react";

import {
  ExportButtonWithFormat,
  type ExportFormat,
} from "@/components/export-button-with-format";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { Button } from "@v1/ui/button";
import { FileUp, Loader2, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { AccessionKanban } from "./accession-kanban";
import { AccessionsStats } from "./accessions-stats";

type AccessionsPageClientProps = {
  organizationId: Id<"organizations">;
  preloadedAccessions: Preloaded<typeof api.accessions.list>;
};

type AccessionListItem = FunctionReturnType<
  typeof api.accessions.list
>["page"][number];

export function AccessionsPageClient({
  organizationId,
  preloadedAccessions,
}: AccessionsPageClientProps) {
  const t = useScopedI18n("accessions");
  const [searchQuery, setSearchQuery] = useState("");
  const [isEmptyingTrash, setIsEmptyingTrash] = useState(false);
  const [bulkActionError, setBulkActionError] = useState<string | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const accessions = usePreloadedQuery(preloadedAccessions);

  const exportAccessionsWithFormat = useMutation(
    api.imports.exportAccessionsWithFormat,
  );
  const emptyRejectedAccessions = useMutation(api.accessions.emptyRejected);

  const pending = accessions.page.filter(
    (item: AccessionListItem) => item.status === "pending",
  ).length;
  const approved = accessions.page.filter(
    (item: AccessionListItem) => item.status === "approved",
  ).length;
  const rejected = accessions.page.filter(
    (item: AccessionListItem) => item.status === "rejected",
  ).length;

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      // Accessions don't support Dublin Core
      if (format === "dublin-core") return undefined;
      return exportAccessionsWithFormat({
        organizationId,
        format: format as "csv" | "json" | "xml" | "spectrum",
      });
    },
    [exportAccessionsWithFormat, organizationId],
  );

  const handleEmptyTrash = useCallback(async () => {
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
  }, [emptyRejectedAccessions, organizationId, rejected, t]);

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-center justify-between">
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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-56 rounded-full border border-input bg-background/60 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:bg-background focus:outline-none"
            />
          </div>
          <PermissionGate permission="collections.read">
            <ExportButtonWithFormat
              onExport={handleExport}
              filename="accessions"
              supportedFormats={["csv", "json", "xml", "spectrum"]}
            />
          </PermissionGate>
          <PermissionGate permission="collections.create">
            <Link
              href="/accessions/import"
              className="flex items-center gap-1.5 rounded-md border border-input bg-background/60 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <FileUp className="h-3.5 w-3.5" />
              {t("importCSV")}
            </Link>
          </PermissionGate>
          <PermissionGate permission="collections.create">
            <Link
              href="/objects/new"
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-[0_0_15px_-3px_rgba(99,102,241,0.3)] transition-colors hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("addObject")}
            </Link>
          </PermissionGate>
          <PermissionGate permission="collections.delete">
            <Button
              type="button"
              variant="destructive"
              size="sm"
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

      <AccessionKanban
        organizationId={organizationId}
        searchQuery={deferredSearchQuery}
        preloadedAccessions={preloadedAccessions}
      />
    </div>
  );
}
