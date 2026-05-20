"use client";

import { ClientDate } from "@/components/client-date";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { EmptyState } from "@v1/ui/empty-state";
import { GlassPanel } from "@v1/ui/glass-panel";
import { SkeletonCard } from "@v1/ui/skeleton-variants";
import { StatusBadge } from "@v1/ui/status-badge";
import { useQuery } from "convex/react";
import { Package } from "lucide-react";
import Link from "next/link";

export function NewArrivalsFeed() {
  const locale = useCurrentLocale();
  const { currentOrganizationId } = useOrganization();
  const t = useScopedI18n("newArrivals");
  const common = useScopedI18n("common");

  const accessions = useQuery(
    api.accessions.list,
    currentOrganizationId
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          paginationOpts: { numItems: 10, cursor: null },
        }
      : "skip",
  );

  return (
    <PermissionGate permission="collections.read" fallback={null}>
      <GlassPanel>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">
            {t("title")}
          </h2>
          <Link
            href="/accessions"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {common("viewAll")}
          </Link>
        </div>

        {accessions === undefined ? (
          <SkeletonCard className="h-64" />
        ) : accessions.page.length === 0 ? (
          <EmptyState
            icon={Package}
            title={t("noRecentAccessions")}
            description={t("description")}
          />
        ) : (
          <div className="space-y-2">
            {accessions.page.map((accession) => {
              const statusBadgeStatus =
                accession.status === "pending"
                  ? "pending"
                  : accession.status === "approved"
                    ? "active"
                    : "overdue";

              const statusLabel =
                accession.status === "pending"
                  ? t("statusProcessing")
                  : accession.status === "approved"
                    ? t("statusCataloged")
                    : t("statusRejected");

              return (
                <Link
                  key={accession._id}
                  href={`/accessions/${accession._id}`}
                  className="block"
                >
                  <div className="group relative bg-card/40 border border-border/60 rounded-lg p-3 hover:border-primary/30 hover:bg-card/60 transition-all duration-200">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-foreground">
                            {accession.accessionNumber}
                          </span>
                          <StatusBadge status={statusBadgeStatus} size="sm">
                            {statusLabel}
                          </StatusBadge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {accession.source}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                          <ClientDate
                            timestamp={accession.dateReceived}
                            locale={locale}
                          />
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </GlassPanel>
    </PermissionGate>
  );
}
