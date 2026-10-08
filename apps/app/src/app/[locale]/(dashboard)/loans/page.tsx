"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { FeatureGuard } from "@v1/ui/feature-guard";
import { useMutation } from "convex/react";
import { Building2, Handshake, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { ExportCSVButton } from "@/components/export-csv-button";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useScopedI18n } from "@/locales/client";
import { LoanList } from "./_components/loan-list";
import type { LoanStatus, LoanType } from "./_components/types";
import { LoansPageSkeleton } from "./loans-page-skeleton";

export default function LoansPage() {
  const t = useScopedI18n("loans");
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const { hasFeature } = useFeatureAccess();
  const [statusFilter, setStatusFilter] = useState<LoanStatus>("all");
  const [typeFilter, setTypeFilter] = useState<LoanType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const exportLoans = useMutation(api.imports.exportLoans);

  const handleExport = useCallback(async () => {
    if (!currentOrganizationId) return [];
    const loans = await exportLoans({ organizationId: currentOrganizationId });
    return loans.map((loan) => ({
      ...loan,
      startDate: new Date(loan.startDate),
      endDate: loan.endDate === undefined ? undefined : new Date(loan.endDate),
      createdAt: new Date(loan.createdAt),
    }));
  }, [currentOrganizationId, exportLoans]);

  if (isLoading) {
    return <LoansPageSkeleton />;
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex size-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
          <Building2 className="size-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">{t("noOrg.title")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("noOrg.description")}
            </p>
          </div>
          <Button asChild>
            <Link href="/organizations/new">
              <Plus className="mr-2 size-4" />
              {t("noOrg.createButton")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
          <Handshake className="size-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">{t("selectOrg.title")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("selectOrg.description")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <FeatureGuard
      featureName={t("title")}
      isLocked={!hasFeature("loans")}
      tierNeeded="pro"
    >
      <div className="flex size-full flex-col overflow-y-auto bg-background">
        <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:space-y-8 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="page-title">{t("title")}</h1>
              <p className="page-description mt-1">{t("description")}</p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <PermissionGate permission="loans.read">
                <ExportCSVButton onExport={handleExport} filename="loans" />
              </PermissionGate>
              <PermissionGate permission="loans.create">
                <Button asChild>
                  <Link href="/loans/new">
                    <Plus className="size-3.5 sm:mr-1" />
                    <span className="hidden sm:inline">{t("newLoan")}</span>
                  </Link>
                </Button>
              </PermissionGate>
            </div>
          </div>

          <LoanList
            organizationId={currentOrganizationId}
            statusFilter={statusFilter}
            typeFilter={typeFilter}
            searchQuery={searchQuery}
            onStatusFilterChange={setStatusFilter}
            onTypeFilterChange={setTypeFilter}
            onSearchQueryChange={setSearchQuery}
          />
        </div>
      </div>
    </FeatureGuard>
  );
}
