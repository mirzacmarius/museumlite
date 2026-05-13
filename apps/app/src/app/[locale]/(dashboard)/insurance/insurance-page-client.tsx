"use client";

import { DashboardListPageSkeleton } from "@/components/dashboard-list-page-skeleton";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { formatDate } from "@/lib/format-date";
import { formatCurrency } from "@/lib/format-number";
import { useCurrentLocale } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { DataTable } from "@v1/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@v1/ui/dialog";
import { EmptyState } from "@v1/ui/empty-state";
import { FeatureGuard } from "@v1/ui/feature-guard";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import { useMutation, useQuery } from "convex/react";
import { Building2, Plus, Search, Shield } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type PolicyStatus =
  | "all"
  | "active"
  | "pending"
  | "expired"
  | "cancelled"
  | "suspended";
type PolicyType =
  | "all"
  | "blanket"
  | "scheduled"
  | "exhibition"
  | "transit"
  | "loan";
type ClaimStatus =
  | "all"
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "denied"
  | "settled"
  | "closed"
  | "appealed";

const policyTypeOptions: Array<{ label: string; value: PolicyType }> = [
  { label: "All types", value: "all" },
  { label: "Blanket", value: "blanket" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Exhibition", value: "exhibition" },
  { label: "Transit", value: "transit" },
  { label: "Loan", value: "loan" },
];

const policyStatusOptions: Array<{ label: string; value: PolicyStatus }> = [
  { label: "All statuses", value: "all" },
  { label: "Active", value: "active" },
  { label: "Pending", value: "pending" },
  { label: "Expired", value: "expired" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Suspended", value: "suspended" },
];

const claimStatusOptions: Array<{ label: string; value: ClaimStatus }> = [
  { label: "All statuses", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Submitted", value: "submitted" },
  { label: "Under review", value: "under_review" },
  { label: "Approved", value: "approved" },
  { label: "Denied", value: "denied" },
  { label: "Settled", value: "settled" },
  { label: "Closed", value: "closed" },
  { label: "Appealed", value: "appealed" },
];

const policyStatusColor: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  expired: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  cancelled: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  suspended: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

const claimStatusColor: Record<string, string> = {
  draft: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  submitted: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  under_review: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  denied: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  settled: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  closed: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  appealed: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

export function InsurancePageClient() {
  const locale = useCurrentLocale();
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const { hasFeature } = useFeatureAccess();
  const [searchPolicies, setSearchPolicies] = useState("");
  const [searchClaims, setSearchClaims] = useState("");
  const [policyStatus, setPolicyStatus] = useState<PolicyStatus>("all");
  const [policyType, setPolicyType] = useState<PolicyType>("all");
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>("all");
  const [activeTab, setActiveTab] = useState<"policies" | "claims">("policies");
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false);
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);

  const listPolicies = useQuery(
    api.insurance.listPolicies,
    currentOrganizationId
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          paginationOpts: { numItems: 50, cursor: null },
          status: policyStatus === "all" ? undefined : policyStatus,
          policyType: policyType === "all" ? undefined : policyType,
          search: searchPolicies || undefined,
        }
      : "skip",
  );

  const listClaims = useQuery(
    api.insurance.listClaims,
    currentOrganizationId
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          paginationOpts: { numItems: 50, cursor: null },
          status: claimStatus === "all" ? undefined : claimStatus,
          search: searchClaims || undefined,
        }
      : "skip",
  );

  const createPolicy = useMutation(api.insurance.createPolicy);
  const createClaim = useMutation(api.insurance.createClaim);

  const policies = listPolicies?.page ?? [];
  const claims = listClaims?.page ?? [];

  const policyOptions = useMemo(
    () =>
      policies.map((p) => ({
        label: `${p.policyNumber} · ${p.carrier}`,
        value: p._id,
      })),
    [policies],
  );

  if (isLoading) {
    return (
      <DashboardListPageSkeleton
        actionsCount={2}
        filtersCount={2}
        layout="list"
      />
    );
  }

  if (!organizations || organizations.length === 0 || !currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border/60 bg-card p-8">
          <Building2 className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">No Organization Selected</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Please select or create an organization to view insurance records.
            </p>
          </div>
          <Button asChild>
            <Link href="/organizations/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Organization
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <FeatureGuard
      featureName="Insurance"
      isLocked={!hasFeature("conservation")}
      tierNeeded="pro"
    >
      <div className="flex h-full w-full flex-col overflow-y-auto bg-background">
        <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:space-y-8 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex flex-col gap-2">
              <h2 className="page-title">Insurance</h2>
              <p className="page-description">
                Manage insurance policies, coverages, and claims
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <PermissionGate permission="organization.manage_settings">
                <Dialog
                  open={policyDialogOpen}
                  onOpenChange={setPolicyDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Policy
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[540px]">
                    <DialogHeader>
                      <DialogTitle>New Insurance Policy</DialogTitle>
                    </DialogHeader>
                    <PolicyForm
                      organizationId={
                        currentOrganizationId as Id<"organizations">
                      }
                      onSubmit={async (payload) => {
                        try {
                          await createPolicy(payload);
                          toast.success("Policy created");
                          setPolicyDialogOpen(false);
                        } catch (err) {
                          toast.error(
                            err instanceof Error
                              ? err.message
                              : "Failed to create policy",
                          );
                        }
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </PermissionGate>
              <PermissionGate permission="organization.manage_settings">
                <Dialog
                  open={claimDialogOpen}
                  onOpenChange={setClaimDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button>
                      <Shield className="mr-2 h-4 w-4" />
                      New Claim
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[540px]">
                    <DialogHeader>
                      <DialogTitle>New Insurance Claim</DialogTitle>
                    </DialogHeader>
                    <ClaimForm
                      organizationId={
                        currentOrganizationId as Id<"organizations">
                      }
                      policyOptions={policyOptions}
                      onSubmit={async (payload) => {
                        try {
                          await createClaim(payload);
                          toast.success("Claim created");
                          setClaimDialogOpen(false);
                        } catch (err) {
                          toast.error(
                            err instanceof Error
                              ? err.message
                              : "Failed to create claim",
                          );
                        }
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </PermissionGate>
            </div>
          </div>

          <div>
            <Tabs
              value={activeTab}
              onValueChange={(value) =>
                setActiveTab(value as "policies" | "claims")
              }
            >
              <TabsList className="mb-6 rounded-lg bg-muted p-1">
                <TabsTrigger value="policies">Policies</TabsTrigger>
                <TabsTrigger value="claims">Claims</TabsTrigger>
              </TabsList>

              <TabsContent value="policies">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search policies..."
                      value={searchPolicies}
                      onChange={(e) => setSearchPolicies(e.target.value)}
                      className="rounded-lg border-border/60 bg-card pl-9 text-xs transition-all focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Select
                      value={policyStatus}
                      onValueChange={(value) =>
                        setPolicyStatus(value as PolicyStatus)
                      }
                    >
                      <SelectTrigger className="w-[160px] border-border/60 bg-card text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {policyStatusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={policyType}
                      onValueChange={(value) =>
                        setPolicyType(value as PolicyType)
                      }
                    >
                      <SelectTrigger className="w-[160px] border-border/60 bg-card text-xs">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {policyTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DataTable
                  loading={listPolicies === undefined}
                  data={policies}
                  columns={[
                    {
                      key: "policyNumber",
                      label: "Policy",
                      className: "min-w-0 flex-[1.35]",
                      render: (policy) => (
                        <span className="truncate font-semibold text-foreground">
                          {policy.policyNumber}
                        </span>
                      ),
                    },
                    {
                      key: "carrier",
                      label: "Carrier",
                      className: "min-w-0 flex-[1.5]",
                      render: (policy) => (
                        <span className="truncate">{policy.carrier}</span>
                      ),
                    },
                    {
                      key: "policyType",
                      label: "Type",
                      className: "w-28 flex-none",
                      render: (policy) => (
                        <span className="capitalize">{policy.policyType}</span>
                      ),
                    },
                    {
                      key: "coverageAmount",
                      label: "Coverage",
                      className: "w-36 flex-none",
                      render: (policy) =>
                        formatCurrency(policy.coverageAmount, locale, "USD"),
                    },
                    {
                      key: "effectiveDate",
                      label: "Effective",
                      className: "w-28 flex-none",
                      render: (policy) =>
                        formatDate(new Date(policy.effectiveDate), locale),
                    },
                    {
                      key: "expirationDate",
                      label: "Expires",
                      className: "w-28 flex-none",
                      render: (policy) =>
                        formatDate(new Date(policy.expirationDate), locale),
                    },
                    {
                      key: "status",
                      label: "Status",
                      className: "w-32 flex-none",
                      render: (policy) => (
                        <Badge
                          variant="outline"
                          className={
                            policyStatusColor[policy.status] ??
                            "border-border text-muted-foreground"
                          }
                        >
                          {policy.status.replace("_", " ")}
                        </Badge>
                      ),
                    },
                    {
                      key: "coverageCount",
                      label: "Coverages",
                      className: "w-24 flex-none justify-end text-right",
                    },
                    {
                      key: "claimsCount",
                      label: "Claims",
                      className: "w-20 flex-none justify-end text-right",
                    },
                  ]}
                  emptyState={
                    <EmptyState
                      title="No policies yet"
                      description="Create your first policy to start tracking coverage."
                      icon={Shield}
                    />
                  }
                />
              </TabsContent>

              <TabsContent value="claims">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search claims..."
                      value={searchClaims}
                      onChange={(e) => setSearchClaims(e.target.value)}
                      className="rounded-lg border-border/60 bg-card pl-9 text-xs transition-all focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                  <Select
                    value={claimStatus}
                    onValueChange={(value) =>
                      setClaimStatus(value as ClaimStatus)
                    }
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
                  loading={listClaims === undefined}
                  data={claims}
                  columns={[
                    {
                      key: "claimNumber",
                      label: "Claim",
                      className: "min-w-0 flex-[1.25]",
                      render: (claim) => (
                        <span className="truncate font-semibold text-foreground">
                          {claim.claimNumber}
                        </span>
                      ),
                    },
                    {
                      key: "policyNumber",
                      label: "Policy",
                      className: "min-w-0 flex-[1.5]",
                      render: (claim) => (
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
                      render: (claim) => (
                        <span className="truncate capitalize">
                          {claim.incidentType.replace("_", " ")}
                        </span>
                      ),
                    },
                    {
                      key: "incidentDate",
                      label: "Date",
                      className: "w-32 flex-none",
                      render: (claim) =>
                        formatDate(new Date(claim.incidentDate), locale),
                    },
                    {
                      key: "claimedAmount",
                      label: "Claimed",
                      className: "w-36 flex-none",
                      render: (claim) =>
                        formatCurrency(claim.claimedAmount, locale, "USD"),
                    },
                    {
                      key: "status",
                      label: "Status",
                      className: "w-36 flex-none",
                      render: (claim) => (
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
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </FeatureGuard>
  );
}

function PolicyForm({
  organizationId,
  onSubmit,
}: {
  organizationId: Id<"organizations">;
  onSubmit: (payload: {
    organizationId: Id<"organizations">;
    policyNumber: string;
    carrier: string;
    policyType: "blanket" | "scheduled" | "exhibition" | "transit" | "loan";
    coverageAmount: number;
    effectiveDate: number;
    expirationDate: number;
    deductible?: number;
    premiumAmount?: number;
  }) => Promise<void>;
}) {
  const [form, setForm] = useState({
    policyNumber: "",
    carrier: "",
    policyType: "blanket" as
      | "blanket"
      | "scheduled"
      | "exhibition"
      | "transit"
      | "loan",
    coverageAmount: "",
    deductible: "",
    premiumAmount: "",
    effectiveDate: "",
    expirationDate: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !form.policyNumber ||
      !form.carrier ||
      !form.coverageAmount ||
      !form.effectiveDate ||
      !form.expirationDate
    ) {
      toast.error("Please fill all required fields.");
      return;
    }

    const effectiveDate = Date.parse(form.effectiveDate);
    const expirationDate = Date.parse(form.expirationDate);
    if (Number.isNaN(effectiveDate) || Number.isNaN(expirationDate)) {
      toast.error("Please provide valid dates.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        organizationId,
        policyNumber: form.policyNumber.trim(),
        carrier: form.carrier.trim(),
        policyType: form.policyType,
        coverageAmount: Number.parseFloat(form.coverageAmount),
        deductible: form.deductible
          ? Number.parseFloat(form.deductible)
          : undefined,
        premiumAmount: form.premiumAmount
          ? Number.parseFloat(form.premiumAmount)
          : undefined,
        effectiveDate,
        expirationDate,
      });
      setForm({
        policyNumber: "",
        carrier: "",
        policyType: "blanket",
        coverageAmount: "",
        deductible: "",
        premiumAmount: "",
        effectiveDate: "",
        expirationDate: "",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="policyNumber">Policy Number *</Label>
          <Input
            id="policyNumber"
            value={form.policyNumber}
            onChange={(event) =>
              setForm({ ...form, policyNumber: event.target.value })
            }
            placeholder="POL-2024-001"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="carrier">Carrier *</Label>
          <Input
            id="carrier"
            value={form.carrier}
            onChange={(event) =>
              setForm({ ...form, carrier: event.target.value })
            }
            placeholder="Chubb Insurance"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Policy Type *</Label>
          <Select
            value={form.policyType}
            onValueChange={(value) =>
              setForm({ ...form, policyType: value as typeof form.policyType })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="blanket">Blanket</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="exhibition">Exhibition</SelectItem>
              <SelectItem value="transit">Transit</SelectItem>
              <SelectItem value="loan">Loan</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="coverageAmount">Coverage Amount *</Label>
          <Input
            id="coverageAmount"
            type="number"
            min="0"
            value={form.coverageAmount}
            onChange={(event) =>
              setForm({ ...form, coverageAmount: event.target.value })
            }
            placeholder="500000"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="effectiveDate">Effective Date *</Label>
          <Input
            id="effectiveDate"
            type="date"
            value={form.effectiveDate}
            onChange={(event) =>
              setForm({ ...form, effectiveDate: event.target.value })
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expirationDate">Expiration Date *</Label>
          <Input
            id="expirationDate"
            type="date"
            value={form.expirationDate}
            onChange={(event) =>
              setForm({ ...form, expirationDate: event.target.value })
            }
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="deductible">Deductible</Label>
          <Input
            id="deductible"
            type="number"
            min="0"
            value={form.deductible}
            onChange={(event) =>
              setForm({ ...form, deductible: event.target.value })
            }
            placeholder="500"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="premiumAmount">Premium Amount</Label>
          <Input
            id="premiumAmount"
            type="number"
            min="0"
            value={form.premiumAmount}
            onChange={(event) =>
              setForm({ ...form, premiumAmount: event.target.value })
            }
            placeholder="1500"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Policy"}
        </Button>
      </div>
    </form>
  );
}

function ClaimForm({
  organizationId,
  policyOptions,
  onSubmit,
}: {
  organizationId: Id<"organizations">;
  policyOptions: Array<{ label: string; value: Id<"insurancePolicies"> }>;
  onSubmit: (payload: {
    organizationId: Id<"organizations">;
    policyId: Id<"insurancePolicies">;
    incidentDate: number;
    incidentType:
      | "damage"
      | "theft"
      | "loss"
      | "fire"
      | "water"
      | "vandalism"
      | "natural_disaster"
      | "transit"
      | "other";
    incidentDescription: string;
    claimedAmount: number;
    incidentLocation?: string;
  }) => Promise<void>;
}) {
  const [form, setForm] = useState({
    policyId: "",
    incidentDate: "",
    incidentType: "damage" as
      | "damage"
      | "theft"
      | "loss"
      | "fire"
      | "water"
      | "vandalism"
      | "natural_disaster"
      | "transit"
      | "other",
    incidentLocation: "",
    incidentDescription: "",
    claimedAmount: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !form.policyId ||
      !form.incidentDate ||
      !form.incidentDescription ||
      !form.claimedAmount
    ) {
      toast.error("Please fill all required fields.");
      return;
    }

    const incidentDate = Date.parse(form.incidentDate);
    if (Number.isNaN(incidentDate)) {
      toast.error("Please provide a valid incident date.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        organizationId,
        policyId: form.policyId as Id<"insurancePolicies">,
        incidentDate,
        incidentType: form.incidentType,
        incidentDescription: form.incidentDescription.trim(),
        claimedAmount: Number.parseFloat(form.claimedAmount),
        incidentLocation: form.incidentLocation.trim() || undefined,
      });
      setForm({
        policyId: "",
        incidentDate: "",
        incidentType: "damage",
        incidentLocation: "",
        incidentDescription: "",
        claimedAmount: "",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label>Policy *</Label>
        <Select
          value={form.policyId}
          onValueChange={(value) => setForm({ ...form, policyId: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select policy" />
          </SelectTrigger>
          <SelectContent>
            {policyOptions.length === 0 && (
              <SelectItem value="none" disabled>
                No policies found
              </SelectItem>
            )}
            {policyOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="incidentDate">Incident Date *</Label>
          <Input
            id="incidentDate"
            type="date"
            value={form.incidentDate}
            onChange={(event) =>
              setForm({ ...form, incidentDate: event.target.value })
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Incident Type *</Label>
          <Select
            value={form.incidentType}
            onValueChange={(value) =>
              setForm({
                ...form,
                incidentType: value as typeof form.incidentType,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="damage">Damage</SelectItem>
              <SelectItem value="theft">Theft</SelectItem>
              <SelectItem value="loss">Loss</SelectItem>
              <SelectItem value="fire">Fire</SelectItem>
              <SelectItem value="water">Water</SelectItem>
              <SelectItem value="vandalism">Vandalism</SelectItem>
              <SelectItem value="natural_disaster">Natural disaster</SelectItem>
              <SelectItem value="transit">Transit</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="incidentLocation">Incident Location</Label>
        <Input
          id="incidentLocation"
          value={form.incidentLocation}
          onChange={(event) =>
            setForm({ ...form, incidentLocation: event.target.value })
          }
          placeholder="Gallery A, Storage, etc."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="incidentDescription">Incident Description *</Label>
        <Input
          id="incidentDescription"
          value={form.incidentDescription}
          onChange={(event) =>
            setForm({ ...form, incidentDescription: event.target.value })
          }
          placeholder="Describe the incident..."
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="claimedAmount">Claimed Amount *</Label>
        <Input
          id="claimedAmount"
          type="number"
          min="0"
          value={form.claimedAmount}
          onChange={(event) =>
            setForm({ ...form, claimedAmount: event.target.value })
          }
          placeholder="25000"
          required
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isSubmitting || policyOptions.length === 0}
        >
          {isSubmitting ? "Creating..." : "Create Claim"}
        </Button>
      </div>
    </form>
  );
}
