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
import { useScopedI18n } from "@/locales/client";
import { MoneyCell } from "./money-cell";
import {
  type PolicyStatus,
  type PolicyType,
  policyStatusColor,
  policyStatusOptions,
  policyTypeOptions,
} from "./types";

interface InsurancePolicyRow extends Record<string, unknown> {
  _id: string;
  policyNumber: string;
  carrier: string;
  policyType: string;
  coverageAmount: number;
  currency?: string;
  effectiveDate: number;
  expirationDate: number;
  status: string;
  coverageCount: number;
  claimsCount: number;
}

interface InsurancePoliciesTabProps {
  locale: string;
  policies: InsurancePolicyRow[];
  loading: boolean;
  searchPolicies: string;
  onSearchPoliciesChange: (value: string) => void;
  policyStatus: PolicyStatus;
  onPolicyStatusChange: (value: PolicyStatus) => void;
  policyType: PolicyType;
  onPolicyTypeChange: (value: PolicyType) => void;
}

export function InsurancePoliciesTab({
  locale,
  policies,
  loading,
  searchPolicies,
  onSearchPoliciesChange,
  policyStatus,
  onPolicyStatusChange,
  policyType,
  onPolicyTypeChange,
}: InsurancePoliciesTabProps) {
  const t = useScopedI18n("untranslatedDashboard.insurance");
  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("searchPoliciesPlaceholder")}
            value={searchPolicies}
            onChange={(e) => onSearchPoliciesChange(e.target.value)}
            className="rounded-lg border-border/60 bg-card pl-9 text-xs transition-all focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          />
        </div>
        <div className="flex gap-2">
          <Select
            value={policyStatus}
            onValueChange={(value) =>
              onPolicyStatusChange(value as PolicyStatus)
            }
          >
            <SelectTrigger className="w-[160px] border-border/60 bg-card text-xs">
              <SelectValue placeholder={t("status")} />
            </SelectTrigger>
            <SelectContent>
              {policyStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(`policyStatus.${option.value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={policyType}
            onValueChange={(value) => onPolicyTypeChange(value as PolicyType)}
          >
            <SelectTrigger className="w-[160px] border-border/60 bg-card text-xs">
              <SelectValue placeholder={t("type")} />
            </SelectTrigger>
            <SelectContent>
              {policyTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(`policyType.${option.value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        loading={loading}
        data={policies}
        columns={[
          {
            key: "policyNumber",
            label: t("policy"),
            className: "min-w-0 flex-[1.35]",
            render: (policy: InsurancePolicyRow) => (
              <span className="truncate font-semibold text-foreground">
                {policy.policyNumber}
              </span>
            ),
          },
          {
            key: "carrier",
            label: t("carrier"),
            className: "min-w-0 flex-[1.5]",
            render: (policy: InsurancePolicyRow) => (
              <span className="truncate">{policy.carrier}</span>
            ),
          },
          {
            key: "policyType",
            label: t("type"),
            className: "w-28 flex-none",
            render: (policy: InsurancePolicyRow) => (
              <span className="capitalize">
                {t(`policyType.${policy.policyType}`)}
              </span>
            ),
          },
          {
            key: "coverageAmount",
            label: t("coverage"),
            className: "w-36 flex-none",
            render: (policy: InsurancePolicyRow) => (
              <MoneyCell
                value={policy.coverageAmount}
                currency={policy.currency}
                locale={locale}
                notRecordedLabel={t("currencyNotRecorded")}
              />
            ),
          },
          {
            key: "effectiveDate",
            label: t("effective"),
            className: "w-28 flex-none",
            render: (policy: InsurancePolicyRow) => (
              <ClientDate timestamp={policy.effectiveDate} locale={locale} />
            ),
          },
          {
            key: "expirationDate",
            label: t("expires"),
            className: "w-28 flex-none",
            render: (policy: InsurancePolicyRow) => (
              <ClientDate timestamp={policy.expirationDate} locale={locale} />
            ),
          },
          {
            key: "status",
            label: t("status"),
            className: "w-32 flex-none",
            render: (policy: InsurancePolicyRow) => (
              <Badge
                variant="outline"
                className={
                  policyStatusColor[policy.status] ??
                  "border-border text-muted-foreground"
                }
              >
                {t(`policyStatus.${policy.status}`)}
              </Badge>
            ),
          },
          {
            key: "coverageCount",
            label: t("coverages"),
            className: "w-24 flex-none justify-end text-right",
          },
          {
            key: "claimsCount",
            label: t("claims"),
            className: "w-20 flex-none justify-end text-right",
          },
        ]}
        emptyState={
          <EmptyState
            title={t("noPoliciesYet")}
            description={t("noPoliciesDescription")}
            icon={Shield}
          />
        }
      />
    </>
  );
}
