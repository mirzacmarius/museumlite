"use client";

import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { EmptyState } from "@v1/ui/empty-state";
import { GlassPanel } from "@v1/ui/glass-panel";
import { SkeletonCard } from "@v1/ui/skeleton-variants";
import { useQuery } from "convex/react";
import { ClipboardList } from "lucide-react";
import Link from "next/link";

export function AssignmentsQueue() {
  const { currentOrganizationId } = useOrganization();
  const t = useScopedI18n("assignments");

  const assignments = useQuery(
    api.assignments.listMyAssignments,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  if (assignments === undefined) {
    return <SkeletonCard className="h-96" />;
  }

  if (!assignments.pendingApprovals.length) {
    return (
      <GlassPanel>
        <EmptyState
          icon={ClipboardList}
          title={t("noPendingAssignments")}
          description={t("allCaughtUpDescription")}
        />
      </GlassPanel>
    );
  }

  const grouped = assignments.pendingApprovals.reduce(
    (acc, item) => {
      const group = acc[item.type] || [];
      group.push(item);
      acc[item.type] = group;
      return acc;
    },
    {} as Record<string, typeof assignments.pendingApprovals>,
  );

  const urgencyColors = {
    high: "text-rose-400",
    medium: "text-amber-400",
    low: "text-muted-foreground",
  };

  return (
    <GlassPanel className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">
        {t("pendingApprovals")}
      </h3>

      <div className="space-y-6">
        {Object.entries(grouped).map(([type, items]) => (
          <div key={type}>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              {t(
                `typeLabels.${type as "loan" | "accession" | "deaccession" | "exhibition" | "conservation"}`,
              )}
            </h4>
            <div className="space-y-2">
              {items.map((item) => {
                const href = `/${type}s/${item._id}`;
                return (
                  <Link
                    key={item._id}
                    href={href}
                    className="block p-3 rounded-lg border border-border/60 hover:border-border hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className="text-sm font-medium text-foreground truncate">
                            {item.title}
                          </h5>
                          <span
                            className={`text-xs ${urgencyColors[item.urgency]}`}
                          >
                            {item.urgency}
                          </span>
                        </div>
                        {item.subtitle && (
                          <p className="text-xs text-muted-foreground truncate">
                            {item.subtitle}
                          </p>
                        )}
                        {item.workflowStep !== undefined && (
                          <p className="text-xs text-muted-foreground/60 mt-1">
                            {t("stepNumber", { step: item.workflowStep })}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}
