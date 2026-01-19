"use client";

import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { KpiCard } from "@v1/ui/kpi-card";
import { ErrorBoundary } from "react-error-boundary";
import { KpiActiveLoans } from "./kpi-active-loans";
import { KpiInTransit } from "./kpi-in-transit";
import { KpiOverdue } from "./kpi-overdue";
import { KpiPendingApprovals } from "./kpi-pending-approvals";

export function AdminOverview() {
  const common = useScopedI18n("common");
  return (
    <PermissionGate permission="loans.view_admin_overview">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ErrorBoundary
          fallback={<KpiCard title={common("unavailable")} value="—" />}
        >
          <KpiActiveLoans />
        </ErrorBoundary>

        <ErrorBoundary
          fallback={<KpiCard title={common("unavailable")} value="—" />}
        >
          <KpiPendingApprovals />
        </ErrorBoundary>

        <ErrorBoundary
          fallback={<KpiCard title={common("unavailable")} value="—" />}
        >
          <KpiInTransit />
        </ErrorBoundary>

        <ErrorBoundary
          fallback={<KpiCard title={common("unavailable")} value="—" />}
        >
          <KpiOverdue />
        </ErrorBoundary>
      </div>
    </PermissionGate>
  );
}
