"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import { Building2, Library } from "lucide-react";
import Link from "next/link";
import { useReducer } from "react";
import { DashboardListPageSkeleton } from "@/components/dashboard-list-page-skeleton";
import { useOrganization } from "@/components/organization-provider";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { formatDate as formatDateUtil } from "@/lib/format-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { HoldsMainCard } from "./holds-main-card";
import {
  AccessState,
  getHoldStatusBadge,
  HoldsStatisticsGrid,
} from "./holds-page-parts";
import {
  type HoldStatus,
  holdsPageReducer,
  initialHoldsPageState,
} from "./holds-page-state";
import { PlaceHoldDialog } from "./place-hold-dialog";

export function LibraryHoldsPageClient() {
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const { hasModule } = useFeatureAccess();
  const locale = useCurrentLocale();
  const tLib = useScopedI18n("library");
  const tHolds = useScopedI18n("library.holds");
  const [state, dispatch] = useReducer(holdsPageReducer, initialHoldsPageState);

  const isLibraryEnabled = hasModule("library");

  const statistics = useQuery(
    api.library.holds.getStatistics,
    currentOrganizationId && isLibraryEnabled
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const holds = useQuery(
    api.library.holds.list,
    currentOrganizationId && isLibraryEnabled
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          paginationOpts: { numItems: 50, cursor: null },
          status:
            state.statusFilter !== "all"
              ? (state.statusFilter as HoldStatus)
              : undefined,
        }
      : "skip",
  );

  const patronLookup = useQuery(
    api.accounts.getByCardNumber,
    currentOrganizationId &&
      state.isPlaceHoldDialogOpen &&
      state.patronCardNumber.trim() &&
      isLibraryEnabled
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          cardNumber: state.patronCardNumber.trim(),
        }
      : "skip",
  );

  const itemResults = useQuery(
    api.library.items.list,
    currentOrganizationId &&
      state.isPlaceHoldDialogOpen &&
      state.itemSearch.trim() &&
      isLibraryEnabled
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          paginationOpts: { numItems: 10, cursor: null },
          search: state.itemSearch.trim(),
        }
      : "skip",
  );

  const placeHold = useMutation(api.library.holds.place);
  const cancelHold = useMutation(api.library.holds.cancel);
  const fulfillHold = useMutation(api.library.holds.fulfill);

  const handlePlaceHold = async () => {
    if (!state.selectedPatronId || !state.selectedItemId) return;
    dispatch({ type: "setProcessing", value: true });
    try {
      await placeHold({
        accountId: state.selectedPatronId,
        itemId: state.selectedItemId,
      });
      dispatch({ type: "closePlaceHoldDialog" });
    } catch (error) {
      console.error("Place hold failed:", error);
    } finally {
      dispatch({ type: "setProcessing", value: false });
    }
  };

  const handleCancel = async (holdId: Id<"libraryHolds">) => {
    dispatch({ type: "setProcessing", value: true });
    try {
      await cancelHold({ holdId });
    } catch (error) {
      console.error("Cancel hold failed:", error);
    } finally {
      dispatch({ type: "setProcessing", value: false });
    }
  };

  const handleFulfill = async (holdId: Id<"libraryHolds">) => {
    dispatch({ type: "setProcessing", value: true });
    try {
      await fulfillHold({ holdId });
    } catch (error) {
      console.error("Fulfill hold failed:", error);
    } finally {
      dispatch({ type: "setProcessing", value: false });
    }
  };

  if (isLoading) {
    return <DashboardListPageSkeleton actionsCount={1} showStats />;
  }

  if (!organizations || organizations.length === 0) {
    return (
      <AccessState
        icon={Building2}
        title={tHolds("noOrganization")}
        description={tHolds("noOrganizationDescription")}
        action={
          <Button asChild>
            <Link href="/organizations/new">{tLib("createOrganization")}</Link>
          </Button>
        }
      />
    );
  }

  if (!currentOrganizationId) {
    return (
      <AccessState
        icon={Library}
        title={tHolds("selectOrganization")}
        description={tHolds("selectOrganizationDescription")}
      />
    );
  }

  if (isLibraryEnabled === false) {
    return (
      <AccessState
        icon={Library}
        title={tHolds("notEnabled")}
        description={tHolds("notEnabledDescription")}
        action={
          <Button asChild>
            <Link href="/settings/integrations">
              {tLib("enableIntegration")}
            </Link>
          </Button>
        }
      />
    );
  }

  const formatDate = (timestamp: number) =>
    formatDateUtil(new Date(timestamp), locale);

  const getStatusBadge = (status: string) => getHoldStatusBadge(status, tHolds);

  return (
    <div className="flex size-full bg-background px-6">
      <div className="z-10 mx-auto flex size-full max-w-screen-xl flex-col gap-6 py-6">
        {statistics && (
          <HoldsStatisticsGrid statistics={statistics} tHolds={tHolds} />
        )}

        <HoldsMainCard
          state={state}
          dispatch={dispatch}
          holds={holds}
          formatDate={formatDate}
          getStatusBadge={getStatusBadge}
          onCancel={handleCancel}
          onFulfill={handleFulfill}
          tHolds={tHolds}
          tLib={tLib}
        />

        <PlaceHoldDialog
          state={state}
          dispatch={dispatch}
          patronLookup={patronLookup}
          itemPage={itemResults?.page ?? []}
          isProcessing={state.isProcessing}
          onPlaceHold={handlePlaceHold}
          tHolds={tHolds}
          tLib={tLib}
        />
      </div>
    </div>
  );
}
