"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { EmptyState } from "@v1/ui/empty-state";
import { FeatureGuard } from "@v1/ui/feature-guard";
import { Input } from "@v1/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useMutation, useQuery } from "convex/react";
import {
  Box,
  Calendar,
  Filter,
  GalleryVerticalEnd,
  MapPin,
  Plus,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ClientDate } from "@/components/client-date";
import { CollectionSelector } from "@/components/collection-selector";
import {
  DashboardListPageSkeleton,
  GridCardsSkeleton,
} from "@/components/dashboard-list-page-skeleton";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useClientNow } from "@/hooks/use-client-date-format";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import {
  type ExhibitionScheduleStatus,
  getExhibitionScheduleStatus,
  matchesScheduleFilter,
} from "@/lib/exhibition-schedule-status";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { ExhibitionTimeline } from "./_components/exhibition-timeline";
import {
  type ExhibitionViewMode,
  ExhibitionViewToggle,
} from "./_components/view-toggle";

type ExhibitionStatus = "all" | "current" | "upcoming" | "past";

export default function ExhibitionsPage() {
  const t = useScopedI18n("exhibitions");
  const { currentOrganizationId, isLoading } = useOrganization();
  const { hasFeature } = useFeatureAccess();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ExhibitionStatus>("all");
  const [selectedObjectId, setSelectedObjectId] = useState<
    string | undefined
  >();
  const [showFilters, setShowFilters] = useState(false);

  const savedViewMode = useQuery(
    api.userPreferences.get,
    currentOrganizationId
      ? { key: "exhibitions.viewMode", organizationId: currentOrganizationId }
      : "skip",
  );
  const setViewPreference = useMutation(api.userPreferences.set);
  const [viewMode, setViewMode] = useState<ExhibitionViewMode>("gallery");

  useEffect(() => {
    if (savedViewMode) {
      setViewMode(savedViewMode as ExhibitionViewMode);
    }
  }, [savedViewMode]);

  const handleViewModeChange = (mode: ExhibitionViewMode) => {
    setViewMode(mode);
    if (currentOrganizationId) {
      setViewPreference({
        key: "exhibitions.viewMode",
        value: mode,
        organizationId: currentOrganizationId,
      });
    }
  };

  if (isLoading) {
    return <DashboardListPageSkeleton actionsCount={1} filtersCount={2} />;
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-muted/50 p-8">
          <GalleryVerticalEnd className="size-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">
              {t("noOrganizationTitle")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("noOrganizationDescription")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const hasActiveFilters =
    searchQuery || statusFilter !== "all" || selectedObjectId;

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setSelectedObjectId(undefined);
  };

  return (
    <FeatureGuard
      featureName={t("title")}
      isLocked={!hasFeature("exhibitions")}
      tierNeeded="pro"
    >
      <div className="flex size-full flex-col overflow-y-auto bg-background">
        <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:space-y-8 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex flex-col gap-2">
              <h2 className="page-title">{t("title")}</h2>
              <p className="page-description">{t("description")}</p>
            </div>
            <PermissionGate permission="collections.update">
              <Button asChild className="flex-shrink-0">
                <Link href="/exhibitions/new">
                  <Plus className="size-4 sm:mr-2" />
                  <span className="hidden sm:inline">{t("newExhibition")}</span>
                </Link>
              </Button>
            </PermissionGate>
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={t("searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="rounded-lg border-border/60 bg-card pl-9 text-xs transition-all focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <ExhibitionViewToggle
                      value={viewMode}
                      onChange={handleViewModeChange}
                    />
                    <Button
                      variant={showFilters ? "default" : "outline"}
                      onClick={() => setShowFilters(!showFilters)}
                      className="flex-shrink-0"
                    >
                      <Filter className="size-4 sm:mr-2" />
                      <span className="hidden sm:inline">
                        {t("filters.title")}
                      </span>
                    </Button>
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        onClick={clearFilters}
                        className="flex-shrink-0"
                      >
                        <X className="size-4 sm:mr-2" />
                        <span className="hidden sm:inline">
                          {t("filters.clear")}
                        </span>
                      </Button>
                    )}
                  </div>
                </div>

                {showFilters && (
                  <div className="flex items-center gap-4 border-t border-border pt-4">
                    <div className="w-48">
                      <Select
                        value={statusFilter}
                        onValueChange={(value) =>
                          setStatusFilter(value as ExhibitionStatus)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("filters.allStatuses")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            {t("filters.allExhibitions")}
                          </SelectItem>
                          <SelectItem value="current">
                            {t("filters.current")}
                          </SelectItem>
                          <SelectItem value="upcoming">
                            {t("filters.upcoming")}
                          </SelectItem>
                          <SelectItem value="past">
                            {t("filters.past")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-60">
                      <CollectionSelector
                        organizationId={currentOrganizationId}
                        value={selectedObjectId}
                        onValueChange={setSelectedObjectId}
                        label={t("filters.object")}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Suspense fallback={<GridCardsSkeleton count={6} />}>
              <ExhibitionList
                organizationId={currentOrganizationId}
                searchQuery={searchQuery}
                statusFilter={statusFilter}
                selectedObjectId={selectedObjectId}
                viewMode={viewMode}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </FeatureGuard>
  );
}

function ExhibitionList({
  organizationId,
  searchQuery,
  statusFilter,
  selectedObjectId,
  viewMode,
}: {
  organizationId: string;
  searchQuery: string;
  statusFilter: ExhibitionStatus;
  selectedObjectId?: string;
  viewMode: ExhibitionViewMode;
}) {
  const t = useScopedI18n("exhibitions");
  const now = useClientNow();
  const locale = useCurrentLocale();
  const searchParams = useSearchParams();
  const getSearchParam = searchParams.get.bind(searchParams);
  const hasSearchParam = searchParams.has.bind(searchParams);
  const requestedAsOf = Number(getSearchParam("asOf"));
  const requestedSchedule = getSearchParam("status");
  const requestedLifecycle = getSearchParam("lifecycle");
  const metricSchedule =
    requestedSchedule === "current" ||
    requestedSchedule === "upcoming" ||
    requestedSchedule === "past"
      ? requestedSchedule
      : undefined;
  const metricLifecycle =
    requestedLifecycle === "proposed" ||
    requestedLifecycle === "approved" ||
    requestedLifecycle === "installing" ||
    requestedLifecycle === "active" ||
    requestedLifecycle === "deinstalling" ||
    requestedLifecycle === "closed" ||
    requestedLifecycle === "rejected" ||
    requestedLifecycle === "unclassified"
      ? requestedLifecycle
      : undefined;
  const isMetricDrilldown =
    hasSearchParam("asOf") &&
    Number.isFinite(requestedAsOf) &&
    (metricSchedule !== undefined || metricLifecycle !== undefined);
  const exhibitions = useQuery(api.exhibitions.listByOrganization, {
    organizationId: organizationId as Id<"organizations">,
    collectionId: selectedObjectId as Id<"collections"> | undefined,
    metricFilters: isMetricDrilldown
      ? {
          asOf: requestedAsOf,
          schedule: metricSchedule,
          lifecycle: metricLifecycle,
          includeLoans: getSearchParam("excludeLoans") !== "true",
        }
      : undefined,
  });
  const displayAsOf = isMetricDrilldown ? requestedAsOf : now;

  if (exhibitions === undefined) {
    return <GridCardsSkeleton count={6} />;
  }

  const filteredExhibitions = exhibitions.filter((ex) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      ex.title.toLowerCase().includes(query) ||
      ex.location?.toLowerCase().includes(query) ||
      ex.notes?.toLowerCase().includes(query) ||
      ex.collectionTitle?.toLowerCase().includes(query);

    if (!matchesSearch) return false;

    return matchesScheduleFilter(
      getExhibitionScheduleStatus(ex, displayAsOf),
      statusFilter,
    );
  });

  const metricNotice = isMetricDrilldown ? (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>
        {t("metricFilterApplied")}{" "}
        <ClientDate timestamp={requestedAsOf} locale={locale} />
      </span>
      {metricSchedule && <span>{t(`status.${metricSchedule}`)}</span>}
      {metricLifecycle && <span>{t(`lifecycle.${metricLifecycle}`)}</span>}
      <Link href="/exhibitions" className="underline">
        {t("clearMetricFilter")}
      </Link>
    </div>
  ) : null;

  if (filteredExhibitions.length === 0) {
    return (
      <div className="space-y-3">
        {metricNotice}
        <div className="flex h-64 items-center justify-center">
          <EmptyState
            icon={GalleryVerticalEnd}
            title={t("emptyState.noExhibitions")}
            description={
              searchQuery || statusFilter !== "all" || selectedObjectId
                ? t("emptyState.adjustFilters")
                : t("emptyState.createFirst")
            }
          />
        </div>
      </div>
    );
  }

  if (viewMode === "timeline") {
    return (
      <div className="space-y-3">
        {metricNotice}
        <ExhibitionTimeline
          exhibitions={filteredExhibitions}
          now={displayAsOf}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {metricNotice}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {filteredExhibitions.map((ex) => (
          <div key={ex._id}>
            <ExhibitionCard
              exhibition={ex}
              scheduleStatus={getExhibitionScheduleStatus(ex, displayAsOf)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface Exhibition {
  _id: string;
  title: string;
  location?: string;
  notes?: string;
  collectionTitle?: string;
  participantCount: number;
  startDate: number;
  endDate?: number;
  isLoan?: boolean;
}

function ExhibitionCard({
  exhibition,
  scheduleStatus,
}: {
  exhibition: Exhibition;
  scheduleStatus: ExhibitionScheduleStatus | undefined;
}) {
  const t = useScopedI18n("exhibitions");
  const locale = useCurrentLocale();

  let statusColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  let statusText = t("status.current");

  switch (scheduleStatus) {
    case "past":
      statusColor = "bg-muted text-muted-foreground border-border";
      statusText = t("status.past");
      break;
    case "upcoming":
      statusColor = "bg-blue-500/10 text-blue-400 border-blue-500/20";
      statusText = t("status.upcoming");
      break;
    case "current":
      break;
    default:
      break;
  }

  return (
    <Link
      href={`/exhibitions/${exhibition._id}`}
      className="group flex flex-col justify-between rounded-xl border border-border bg-card p-5 transition-all duration-300 hover:border-primary/30 hover:ring-1 hover:ring-primary/30 hover:shadow-xl hover:shadow-primary/10"
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${statusColor}`}
          >
            {statusText}
          </span>
          {exhibition.isLoan && (
            <span className="text-[10px] font-medium text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
              {t("status.loan")}
            </span>
          )}
        </div>

        <div>
          <h3 className="font-semibold text-foreground group-hover:text-white line-clamp-2">
            {exhibition.title}
          </h3>
          {exhibition.location && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3" />
              {exhibition.location}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-border/50 pt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="size-3.5 text-muted-foreground" />
            <span>
              <ClientDate timestamp={exhibition.startDate} locale={locale} />
              {exhibition.endDate ? (
                <>
                  {" — "}
                  <ClientDate timestamp={exhibition.endDate} locale={locale} />
                </>
              ) : (
                ` ${t("card.ongoing")}`
              )}
            </span>
          </div>
        </div>
      </div>

      {exhibition.participantCount > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-background/50 px-3 py-2 text-xs text-muted-foreground group-hover:text-muted-foreground transition-colors">
          <Box className="size-3.5" />
          <span className="truncate">
            {exhibition.participantCount} {t("form.participantsLabel")}
          </span>
        </div>
      )}
    </Link>
  );
}
