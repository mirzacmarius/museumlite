"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { FeatureGuard } from "@v1/ui/feature-guard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import { useQuery } from "convex/react";
import { Building2, Plus } from "lucide-react";
import Link from "next/link";
import { useReducer } from "react";
import { DashboardListPageSkeleton } from "@/components/dashboard-list-page-skeleton";
import { useOrganization } from "@/components/organization-provider";
import { useClientNow } from "@/hooks/use-client-date-format";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { InsuranceClaimsTab } from "./insurance-claims-tab";
import { InsuranceCoveragesTab } from "./insurance-coverages-tab";
import { InsuranceOverviewTab } from "./insurance-overview-tab";
import { InsurancePageActions } from "./insurance-page-actions";
import { InsurancePoliciesTab } from "./insurance-policies-tab";
import { LegacyCoverageReviewTab } from "./legacy-coverage-review-tab";
import {
  type ClaimStatus,
  INSURANCE_TABS,
  type InsuranceTab,
  type PolicyStatus,
  type PolicyType,
} from "./types";

interface InsurancePageState {
  searchPolicies: string;
  searchClaims: string;
  policyStatus: PolicyStatus;
  policyType: PolicyType;
  claimStatus: ClaimStatus;
  activeTab: InsuranceTab;
}

type InsurancePageAction =
  | { type: "setSearchPolicies"; value: string }
  | { type: "setSearchClaims"; value: string }
  | { type: "setPolicyStatus"; value: PolicyStatus }
  | { type: "setPolicyType"; value: PolicyType }
  | { type: "setClaimStatus"; value: ClaimStatus }
  | { type: "setActiveTab"; value: InsuranceTab };

const initialInsurancePageState: InsurancePageState = {
  searchPolicies: "",
  searchClaims: "",
  policyStatus: "all",
  policyType: "all",
  claimStatus: "all",
  activeTab: "overview",
};

function insurancePageReducer(
  state: InsurancePageState,
  action: InsurancePageAction,
): InsurancePageState {
  switch (action.type) {
    case "setSearchPolicies":
      return { ...state, searchPolicies: action.value };
    case "setSearchClaims":
      return { ...state, searchClaims: action.value };
    case "setPolicyStatus":
      return { ...state, policyStatus: action.value };
    case "setPolicyType":
      return { ...state, policyType: action.value };
    case "setClaimStatus":
      return { ...state, claimStatus: action.value };
    case "setActiveTab":
      return { ...state, activeTab: action.value };
  }
}

function NoOrganization() {
  const t = useScopedI18n("untranslatedDashboard.insurance");
  return (
    <div className="flex size-full items-center justify-center bg-background px-6 py-8">
      <div className="flex flex-col items-center gap-4 rounded-lg border border-border/60 bg-card p-8">
        <Building2 className="size-12 text-muted-foreground" />
        <div className="text-center">
          <h3 className="text-lg font-semibold">
            {t("noOrganizationSelected")}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("selectOrganizationDescription")}
          </p>
        </div>
        <Button asChild>
          <Link href="/organizations/new">
            <Plus className="mr-2 size-4" />
            {t("createOrganization")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function InsurancePageClient() {
  const t = useScopedI18n("untranslatedDashboard.insurance");
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const { hasFeature } = useFeatureAccess();

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
    return <NoOrganization />;
  }

  return (
    <FeatureGuard
      featureName={t("title")}
      isLocked={!hasFeature("conservation")}
      tierNeeded="pro"
    >
      <InsuranceWorkspace
        organizationId={currentOrganizationId as Id<"organizations">}
      />
    </FeatureGuard>
  );
}

function InsuranceWorkspace({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("untranslatedDashboard.insurance");
  const locale = useCurrentLocale();
  const now = useClientNow();
  const [state, dispatch] = useReducer(
    insurancePageReducer,
    initialInsurancePageState,
  );

  const listPolicies = useQuery(
    api.insurance.listPolicies,
    now === undefined
      ? "skip"
      : {
          organizationId,
          now,
          paginationOpts: { numItems: 50, cursor: null },
          status: state.policyStatus === "all" ? undefined : state.policyStatus,
          policyType: state.policyType === "all" ? undefined : state.policyType,
          search: state.searchPolicies || undefined,
        },
  );

  const listClaims = useQuery(api.insurance.listClaims, {
    organizationId,
    paginationOpts: { numItems: 50, cursor: null },
    status: state.claimStatus === "all" ? undefined : state.claimStatus,
    search: state.searchClaims || undefined,
  });

  return (
    <div className="flex size-full flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:space-y-8 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-2">
            <h2 className="page-title">{t("title")}</h2>
            <p className="page-description">{t("description")}</p>
          </div>
          <InsurancePageActions
            organizationId={organizationId}
            locale={locale}
            now={now}
          />
        </div>

        <Tabs
          value={state.activeTab}
          onValueChange={(value) => {
            const tab = INSURANCE_TABS.find((entry) => entry === value);
            if (tab) dispatch({ type: "setActiveTab", value: tab });
          }}
        >
          <TabsList className="mb-6 flex-wrap rounded-lg bg-muted p-1">
            <TabsTrigger value="overview">{t("tabs.overview")}</TabsTrigger>
            <TabsTrigger value="policies">{t("policies")}</TabsTrigger>
            <TabsTrigger value="coverages">{t("tabs.coverages")}</TabsTrigger>
            <TabsTrigger value="claims">{t("claims")}</TabsTrigger>
            <TabsTrigger value="review">{t("tabs.review")}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <InsuranceOverviewTab
              organizationId={organizationId}
              now={now}
              locale={locale}
            />
          </TabsContent>

          <TabsContent value="policies">
            <InsurancePoliciesTab
              locale={locale}
              policies={listPolicies?.page ?? []}
              loading={listPolicies === undefined}
              searchPolicies={state.searchPolicies}
              onSearchPoliciesChange={(value) =>
                dispatch({ type: "setSearchPolicies", value })
              }
              policyStatus={state.policyStatus}
              onPolicyStatusChange={(value) =>
                dispatch({ type: "setPolicyStatus", value })
              }
              policyType={state.policyType}
              onPolicyTypeChange={(value) =>
                dispatch({ type: "setPolicyType", value })
              }
            />
          </TabsContent>

          <TabsContent value="coverages">
            <InsuranceCoveragesTab
              organizationId={organizationId}
              now={now}
              locale={locale}
            />
          </TabsContent>

          <TabsContent value="claims">
            <InsuranceClaimsTab
              locale={locale}
              claims={listClaims?.page ?? []}
              loading={listClaims === undefined}
              searchClaims={state.searchClaims}
              onSearchClaimsChange={(value) =>
                dispatch({ type: "setSearchClaims", value })
              }
              claimStatus={state.claimStatus}
              onClaimStatusChange={(value) =>
                dispatch({ type: "setClaimStatus", value })
              }
            />
          </TabsContent>

          <TabsContent value="review">
            <LegacyCoverageReviewTab
              organizationId={organizationId}
              locale={locale}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
