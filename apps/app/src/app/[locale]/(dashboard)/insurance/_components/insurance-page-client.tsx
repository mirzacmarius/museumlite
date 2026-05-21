"use client";

import { DashboardListPageSkeleton } from "@/components/dashboard-list-page-skeleton";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useCurrentLocale } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@v1/ui/dialog";
import { FeatureGuard } from "@v1/ui/feature-guard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import { useMutation, useQuery } from "convex/react";
import { Building2, Plus, Shield } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ClaimForm } from "./claim-form";
import { InsuranceClaimsTab } from "./insurance-claims-tab";
import { InsurancePoliciesTab } from "./insurance-policies-tab";
import { PolicyForm } from "./policy-form";
import type { ClaimStatus, PolicyStatus, PolicyType } from "./types";

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
      <div className="flex size-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border/60 bg-card p-8">
          <Building2 className="size-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">No Organization Selected</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Please select or create an organization to view insurance records.
            </p>
          </div>
          <Button asChild>
            <Link href="/organizations/new">
              <Plus className="mr-2 size-4" />
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
      <div className="flex size-full flex-col overflow-y-auto bg-background">
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
                      <Plus className="mr-2 size-4" />
                      Add Policy
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[540px]">
                    <DialogHeader>
                      <DialogTitle>New Insurance Policy</DialogTitle>
                      <DialogDescription className="sr-only">
                        Add an insurance policy for this organization.
                      </DialogDescription>
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
                      <Shield className="mr-2 size-4" />
                      New Claim
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[540px]">
                    <DialogHeader>
                      <DialogTitle>New Insurance Claim</DialogTitle>
                      <DialogDescription className="sr-only">
                        Record a new insurance claim for this organization.
                      </DialogDescription>
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
                <InsurancePoliciesTab
                  locale={locale}
                  policies={policies}
                  loading={listPolicies === undefined}
                  searchPolicies={searchPolicies}
                  onSearchPoliciesChange={setSearchPolicies}
                  policyStatus={policyStatus}
                  onPolicyStatusChange={setPolicyStatus}
                  policyType={policyType}
                  onPolicyTypeChange={setPolicyType}
                />
              </TabsContent>

              <TabsContent value="claims">
                <InsuranceClaimsTab
                  locale={locale}
                  claims={claims}
                  loading={listClaims === undefined}
                  searchClaims={searchClaims}
                  onSearchClaimsChange={setSearchClaims}
                  claimStatus={claimStatus}
                  onClaimStatusChange={setClaimStatus}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </FeatureGuard>
  );
}
