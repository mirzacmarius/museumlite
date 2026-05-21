"use client";

import { DashboardListPageSkeleton } from "@/components/dashboard-list-page-skeleton";
import { useOrganization } from "@/components/organization-provider";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { formatDate as formatDateUtil } from "@/lib/format-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import { useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  Library,
  Loader2,
  RefreshCw,
  Search,
  User,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CirculationCheckinDialog } from "./circulation-checkin-dialog";
import { CirculationCheckoutDialog } from "./circulation-checkout-dialog";
import { CirculationQuickScan } from "./circulation-quick-scan";
import { CirculationStatistics } from "./circulation-statistics";
import { CirculationTabsPanel } from "./circulation-tabs-panel";

import { useLibraryCirculation } from "./use-library-circulation";

export function LibraryCirculationPageClient() {
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const { hasModule } = useFeatureAccess();
  const locale = useCurrentLocale();
  const t = useScopedI18n("library.placeholders");
  const tCirc = useScopedI18n("library.circulation");
  const tLib = useScopedI18n("library");
  const isLibraryEnabled = hasModule("library");
  const [searchQuery, setSearchQuery] = useState("");

  const statistics = useQuery(
    api.library.circulation.getStatistics,
    currentOrganizationId && isLibraryEnabled
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const overdueItems = useQuery(
    api.library.circulation.listOverdue,
    currentOrganizationId && isLibraryEnabled
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          paginationOpts: { numItems: 10, cursor: null },
        }
      : "skip",
  );

  const activeCheckouts = useQuery(
    api.library.circulation.listActive,
    currentOrganizationId && isLibraryEnabled
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          paginationOpts: { numItems: 20, cursor: null },
        }
      : "skip",
  );

  const copyLookup = useQuery(
    api.library.circulation.getByBarcode,
    currentOrganizationId && searchQuery.trim() && isLibraryEnabled
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          barcode: searchQuery.trim(),
        }
      : "skip",
  );

  const patronLookup = useQuery(
    api.accounts.getByCardNumber,
    currentOrganizationId && searchQuery.trim() && isLibraryEnabled
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          cardNumber: searchQuery.trim(),
        }
      : "skip",
  );

  const {
    selectedPatron,
    selectedCopy,
    isCheckoutDialogOpen,
    setIsCheckoutDialogOpen,
    isCheckinDialogOpen,
    setIsCheckinDialogOpen,
    isProcessing,
    checkinResult,
    handleScan,
    handleKeyDown,
    handleCheckout,
    handleCheckin,
    handleRenew,
    resetCheckinFlow,
    resetCheckoutFlow,
    cancelCheckinDialog,
  } = useLibraryCirculation({
    patronLookup,
    copyLookup,
    searchQuery,
    setSearchQuery,
  });

  if (isLoading) {
    return <DashboardListPageSkeleton actionsCount={2} showStats />;
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex size-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
          <Building2 className="size-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">{tCirc("noOrganization")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {tCirc("noOrganizationDescription")}
            </p>
          </div>
          <Button asChild>
            <Link href="/organizations/new">{tLib("createOrganization")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
          <Library className="size-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">
              {tCirc("selectOrganization")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {tCirc("selectOrganizationDescription")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLibraryEnabled === false) {
    return (
      <div className="flex size-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
          <Library className="size-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">{tCirc("notEnabled")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {tCirc("notEnabledDescription")}
            </p>
          </div>
          <Button asChild>
            <Link href="/settings/integrations">
              {tLib("enableIntegration")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return formatDateUtil(new Date(timestamp), locale);
  };

  return (
    <div className="flex size-full bg-background px-6">
      <div className="z-10 mx-auto flex size-full max-w-screen-xl flex-col gap-6 py-6">
        {statistics && (
          <CirculationStatistics statistics={statistics} tCirc={tCirc} />
        )}

        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="flex w-full items-center justify-between rounded-lg p-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-medium text-primary">
                {tCirc("title")}
              </h2>
              <p className="text-sm font-normal text-primary/60">
                {tCirc("description")}
              </p>
            </div>
          </div>
          <div className="flex w-full px-6">
            <div className="w-full border-b border-border" />
          </div>

          <CirculationQuickScan
            t={t}
            tCirc={tCirc}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onKeyDown={handleKeyDown}
            onScan={handleScan}
          />

          <CirculationTabsPanel
            tCirc={tCirc}
            overdueItems={overdueItems}
            activeCheckouts={activeCheckouts}
            formatDate={formatDate}
            handleRenew={handleRenew}
            handleCheckin={handleCheckin}
            isProcessing={isProcessing}
          />
        </div>

        <CirculationCheckoutDialog
          open={isCheckoutDialogOpen}
          onOpenChange={setIsCheckoutDialogOpen}
          tCirc={tCirc}
          tLib={tLib}
          selectedPatron={selectedPatron}
          selectedCopy={selectedCopy}
          isProcessing={isProcessing}
          onCheckout={handleCheckout}
          onClose={resetCheckoutFlow}
        />

        <CirculationCheckinDialog
          open={isCheckinDialogOpen}
          onOpenChange={setIsCheckinDialogOpen}
          tCirc={tCirc}
          tLib={tLib}
          selectedCopy={selectedCopy}
          checkinResult={checkinResult}
          isProcessing={isProcessing}
          formatDate={formatDate}
          onCheckin={handleCheckin}
          onDone={resetCheckinFlow}
          onCancel={cancelCheckinDialog}
        />
      </div>
    </div>
  );
}
