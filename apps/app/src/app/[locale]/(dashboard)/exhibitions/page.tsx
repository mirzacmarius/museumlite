"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
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
import { useEffect, useState } from "react";
import { ExhibitionTimeline } from "./_components/exhibition-timeline";
import {
  type ExhibitionViewMode,
  ExhibitionViewToggle,
} from "./_components/view-toggle";

type ExhibitionStatus = "all" | "current" | "upcoming" | "past";

export default function ExhibitionsPage() {
  const { currentOrganizationId, isLoading } = useOrganization();
  const { hasFeature } = useFeatureAccess();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ExhibitionStatus>("all");
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
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-muted/50 p-8">
          <GalleryVerticalEnd className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">
              No Organization Found
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              You need to create an organization to manage exhibitions.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const hasActiveFilters = searchQuery || statusFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
  };

  return (
    <FeatureGuard
      featureName="Exhibitions"
      isLocked={!hasFeature("exhibitions")}
      tierNeeded="pro"
    >
      <div className="flex h-full w-full bg-background px-6">
        <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
          <div className="flex w-full flex-col rounded-lg border border-border bg-muted/20">
            <div className="flex w-full items-center justify-between rounded-lg p-6">
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-medium text-foreground">
                  Exhibitions
                </h2>
                <p className="text-sm font-normal text-muted-foreground">
                  Manage your exhibition history and planning
                </p>
              </div>
              <PermissionGate permission="collections.update">
                <Button
                  asChild
                  className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  <Link href="/exhibitions/new">
                    <Plus className="mr-2 h-4 w-4" />
                    New Exhibition
                  </Link>
                </Button>
              </PermissionGate>
            </div>
            <div className="flex w-full px-6">
              <div className="w-full border-b border-border" />
            </div>

            <div className="border-b border-border px-6 py-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by title, location, or notes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 bg-muted/50 border-border text-foreground/80 placeholder:text-muted-foreground focus-visible:ring-ring"
                    />
                  </div>
                  <ExhibitionViewToggle
                    value={viewMode}
                    onChange={handleViewModeChange}
                  />
                  <Button
                    variant={showFilters ? "default" : "outline"}
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    Filters
                  </Button>
                  {hasActiveFilters && (
                    <Button variant="ghost" onClick={clearFilters}>
                      <X className="mr-2 h-4 w-4" />
                      Clear
                    </Button>
                  )}
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
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Exhibitions</SelectItem>
                          <SelectItem value="current">Current</SelectItem>
                          <SelectItem value="upcoming">Upcoming</SelectItem>
                          <SelectItem value="past">Past</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <ExhibitionList
              organizationId={currentOrganizationId}
              searchQuery={searchQuery}
              statusFilter={statusFilter}
              viewMode={viewMode}
            />
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
  viewMode,
}: {
  organizationId: string;
  searchQuery: string;
  statusFilter: ExhibitionStatus;
  viewMode: ExhibitionViewMode;
}) {
  const exhibitions = useQuery(api.exhibitions.listByOrganization, {
    organizationId: organizationId as Id<"organizations">,
  });

  if (exhibitions === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Loading exhibitions...</p>
      </div>
    );
  }

  const filteredExhibitions = exhibitions.filter((ex) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      ex.title.toLowerCase().includes(query) ||
      ex.location?.toLowerCase().includes(query) ||
      ex.notes?.toLowerCase().includes(query) ||
      ex.collectionTitle?.toLowerCase().includes(query);

    if (!matchesSearch) return false;

    if (statusFilter === "all") return true;

    const now = Date.now();
    const isPast = ex.endDate && ex.endDate < now;
    const isUpcoming = ex.startDate > now;

    if (statusFilter === "past") return isPast;
    if (statusFilter === "upcoming") return isUpcoming;
    if (statusFilter === "current") return !isPast && !isUpcoming;

    return true;
  });

  if (filteredExhibitions.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <GalleryVerticalEnd className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-muted-foreground">No exhibitions found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {searchQuery || statusFilter !== "all"
              ? "Try adjusting your filters"
              : "Create your first exhibition record to get started"}
          </p>
        </div>
      </div>
    );
  }

  if (viewMode === "timeline") {
    return (
      <div className="p-6">
        <ExhibitionTimeline exhibitions={filteredExhibitions} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
      {filteredExhibitions.map((ex) => (
        <ExhibitionCard key={ex._id} exhibition={ex} />
      ))}
    </div>
  );
}

interface Exhibition {
  _id: string;
  title: string;
  location?: string;
  notes?: string;
  collectionTitle?: string;
  startDate: number;
  endDate?: number;
  isLoan?: boolean;
}

function ExhibitionCard({ exhibition }: { exhibition: Exhibition }) {
  const isPast = exhibition.endDate && exhibition.endDate < Date.now();
  const isUpcoming = exhibition.startDate > Date.now();

  let statusColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  let statusText = "Current";

  if (isPast) {
    statusColor = "bg-muted text-muted-foreground border-border";
    statusText = "Past";
  } else if (isUpcoming) {
    statusColor = "bg-blue-500/10 text-blue-400 border-blue-500/20";
    statusText = "Upcoming";
  }

  return (
    <Link
      href={`/exhibitions/${exhibition._id}`}
      className="group flex flex-col justify-between rounded-xl border border-border bg-card p-5 transition-all hover:bg-muted/80 hover:border-border hover:shadow-lg hover:shadow-black/30"
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
              LOAN
            </span>
          )}
        </div>

        <div>
          <h3 className="font-semibold text-foreground group-hover:text-white line-clamp-2">
            {exhibition.title}
          </h3>
          {exhibition.location && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {exhibition.location}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-border/50 pt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span>
              {new Date(exhibition.startDate).toLocaleDateString()}
              {exhibition.endDate
                ? ` — ${new Date(exhibition.endDate).toLocaleDateString()}`
                : " (Ongoing)"}
            </span>
          </div>
        </div>
      </div>

      {exhibition.collectionTitle && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-background/50 px-3 py-2 text-xs text-muted-foreground group-hover:text-muted-foreground transition-colors">
          <Box className="h-3.5 w-3.5" />
          <span className="truncate">{exhibition.collectionTitle}</span>
        </div>
      )}
    </Link>
  );
}
