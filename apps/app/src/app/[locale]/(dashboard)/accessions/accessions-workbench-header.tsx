"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useSelectedLayoutSegment } from "next/navigation";
import { useOrganization } from "@/components/organization-provider";
import { usePermissions } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import {
  AccessionsWorkbenchNav,
  type AccessionsWorkbenchView,
} from "./accessions-workbench-nav";
import { usePendingTransferCount } from "./use-pending-transfer-count";

/**
 * The Accessions title and tabs, shared by Overview, Entries and Transfers so
 * they stay in place while only the tab's own toolbar and content change.
 */
export function AccessionsWorkbenchHeader() {
  const t = useScopedI18n("accessions");
  const segment = useSelectedLayoutSegment();
  const { currentOrganizationId } = useOrganization();
  const activeView: AccessionsWorkbenchView =
    segment === "entries" || segment === "transfers" ? segment : "overview";

  return (
    <div className="px-6 pt-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      {currentOrganizationId ? (
        <CountedWorkbenchNav
          activeView={activeView}
          organizationId={currentOrganizationId}
        />
      ) : (
        <AccessionsWorkbenchNav
          activeView={activeView}
          pendingAccessions="-"
          pendingTransfers="-"
        />
      )}
    </div>
  );
}

function CountedWorkbenchNav({
  activeView,
  organizationId,
}: {
  activeView: AccessionsWorkbenchView;
  organizationId: Id<"organizations">;
}) {
  // Entries and Transfers explain a missing permission themselves, so the
  // tabs never ask for counts the member cannot read.
  const { hasPermission, isLoading } = usePermissions();
  const canReadAccessions = !isLoading && hasPermission("collections.read");
  const counts = useQuery(
    api.accessions.getBoardCounts,
    canReadAccessions ? { organizationId } : "skip",
  );
  const pendingTransfers = usePendingTransferCount(organizationId);

  return (
    <AccessionsWorkbenchNav
      activeView={activeView}
      pendingAccessions={counts?.pending ?? "-"}
      pendingTransfers={pendingTransfers}
    />
  );
}
