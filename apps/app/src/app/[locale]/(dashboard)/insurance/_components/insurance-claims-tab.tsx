"use client";

import { Badge } from "@v1/ui/badge";
import { DataTable } from "@v1/ui/data-table";
import { EmptyState } from "@v1/ui/empty-state";
import { Input } from "@v1/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Search, Shield } from "lucide-react";
import { ClientDate } from "@/components/client-date";
import { MoneyCell } from "@/components/money-cell";
import { useScopedI18n } from "@/locales/client";
import {
  type ClaimStatus,
  claimStatusColor,
  claimStatusOptions,
} from "./types";

interface InsuranceClaimRow extends Record<string, unknown> {
  _id: string;
  claimNumber: string;
  carrier: string;
  policyNumber: string;
  incidentType: string;
  incidentDate: number;
  claimedAmount: number;
  currency?: string;
  status: string;
}

interface InsuranceClaimsTabProps {
  locale: string;
  claims: InsuranceClaimRow[];
  loading: boolean;
  searchClaims: string;
  onSearchClaimsChange: (value: string) => void;
  claimStatus: ClaimStatus;
  onClaimStatusChange: (value: ClaimStatus) => void;
}

export function InsuranceClaimsTab({
  locale,
  claims,
  loading,
  searchClaims,
  onSearchClaimsChange,
  claimStatus,
  onClaimStatusChange,
}: InsuranceClaimsTabProps) {
  const t = useScopedI18n("untranslatedDashboard.insurance");
  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("searchClaimsPlaceholder")}
            value={searchClaims}
            onChange={(e) => onSearchClaimsChange(e.target.value)}
            className="rounded-lg border-border/60 bg-card pl-9 text-xs transition-all focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          />
        </div>
        <Select
          value={claimStatus}
          onValueChange={(value) => onClaimStatusChange(value as ClaimStatus)}
        >
          <SelectTrigger className="w-[180px] border-border/60 bg-card text-xs">
            <SelectValue placeholder={t("status")} />
          </SelectTrigger>
          <SelectContent>
            {claimStatusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(`claimStatus.${option.value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        label={t("claims")}
        loading={loading}
        data={claims}
        columns={[
          {
            key: "claimNumber",
            label: t("claim"),
            render: (claim: InsuranceClaimRow) => (
              <span className="truncate font-semibold text-foreground">
                {claim.claimNumber}
              </span>
            ),
          },
          {
            key: "policyNumber",
            label: t("policy"),
            render: (claim: InsuranceClaimRow) => (
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-muted-foreground">
                  {claim.carrier}
                </span>
                <span className="truncate font-medium">
                  {claim.policyNumber}
                </span>
              </div>
            ),
          },
          {
            key: "incidentType",
            label: t("incident"),
            render: (claim: InsuranceClaimRow) => (
              <span className="truncate capitalize">
                {t(
                  `incident${claim.incidentType
                    .split("_")
                    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                    .join("")}`,
                )}
              </span>
            ),
          },
          {
            key: "incidentDate",
            label: t("date"),
            className: "w-32",
            render: (claim: InsuranceClaimRow) => (
              <ClientDate timestamp={claim.incidentDate} locale={locale} />
            ),
          },
          {
            key: "claimedAmount",
            label: t("claimed"),
            className: "w-36",
            render: (claim: InsuranceClaimRow) => (
              <MoneyCell
                value={claim.claimedAmount}
                currency={claim.currency}
                locale={locale}
                notRecordedLabel={t("currencyNotRecorded")}
              />
            ),
          },
          {
            key: "status",
            label: t("status"),
            className: "w-36",
            render: (claim: InsuranceClaimRow) => (
              <Badge
                variant="outline"
                className={
                  claimStatusColor[claim.status] ??
                  "border-border text-muted-foreground"
                }
              >
                {t(`claimStatus.${claim.status}`)}
              </Badge>
            ),
          },
        ]}
        emptyState={
          <EmptyState
            title={t("noClaimsYet")}
            description={t("noClaimsDescription")}
            icon={Shield}
          />
        }
      />
    </>
  );
}
