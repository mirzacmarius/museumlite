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
import { type FormatLocale, formatCurrency } from "@/lib/format-number";
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
  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search claims..."
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
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {claimStatusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        loading={loading}
        data={claims}
        columns={[
          {
            key: "claimNumber",
            label: "Claim",
            className: "min-w-0 flex-[1.25]",
            render: (claim: InsuranceClaimRow) => (
              <span className="truncate font-semibold text-foreground">
                {claim.claimNumber}
              </span>
            ),
          },
          {
            key: "policyNumber",
            label: "Policy",
            className: "min-w-0 flex-[1.5]",
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
            label: "Incident",
            className: "min-w-0 flex-[1.1]",
            render: (claim: InsuranceClaimRow) => (
              <span className="truncate capitalize">
                {claim.incidentType.replace("_", " ")}
              </span>
            ),
          },
          {
            key: "incidentDate",
            label: "Date",
            className: "w-32 flex-none",
            render: (claim: InsuranceClaimRow) => (
              <ClientDate timestamp={claim.incidentDate} locale={locale} />
            ),
          },
          {
            key: "claimedAmount",
            label: "Claimed",
            className: "w-36 flex-none",
            render: (claim) =>
              formatCurrency(
                claim.claimedAmount,
                locale as FormatLocale,
                "USD",
              ),
          },
          {
            key: "status",
            label: "Status",
            className: "w-36 flex-none",
            render: (claim: InsuranceClaimRow) => (
              <Badge
                variant="outline"
                className={
                  claimStatusColor[claim.status] ??
                  "border-border text-muted-foreground"
                }
              >
                {claim.status.replace("_", " ")}
              </Badge>
            ),
          },
        ]}
        emptyState={
          <EmptyState
            title="No claims yet"
            description="Create a claim to track incidents and reimbursements."
            icon={Shield}
          />
        }
      />
    </>
  );
}
