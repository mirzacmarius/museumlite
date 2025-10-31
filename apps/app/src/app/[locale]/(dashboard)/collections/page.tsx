"use client";

import { Header } from "@/app/[locale]/(dashboard)/_components/header";
import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useQuery } from "convex/react";
import { Plus, Building2, MapPin, Search, Filter, X } from "lucide-react";
import Link from "next/link";
import { useState, useMemo, useEffect, useRef } from "react";

export default function CollectionsPage() {
  const { currentOrganizationId, organizations, isLoading } = useOrganization();

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <>
        <Header
          title="Collections"
          description="Manage your collection objects"
        />
        <div className="flex h-full w-full items-center justify-center bg-secondary px-6 py-8 dark:bg-black">
          <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 dark:bg-black">
            <Building2 className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">No Organization Found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                You need to create an organization to start managing collections.
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
      </>
    );
  }

  if (!currentOrganizationId) {
    return (
      <>
        <Header
          title="Collections"
          description="Manage your collection objects"
        />
        <div className="flex h-full w-full items-center justify-center bg-secondary px-6 py-8 dark:bg-black">
          <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 dark:bg-black">
            <Building2 className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">Select an Organization</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Please select an organization from the dropdown above to view collections.
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title="Collections"
        description="Manage your collection objects"
      />
      <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
        <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
          <div className="flex w-full flex-col rounded-lg border border-border bg-card dark:bg-black">
            <div className="flex w-full items-center justify-between rounded-lg p-6">
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-medium text-primary">
                  Collection Objects
                </h2>
                <p className="text-sm font-normal text-primary/60">
                  Browse and manage your collection
                </p>
              </div>
              <PermissionGate permission="collections.create">
                <Button asChild>
                  <Link href="/collections/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Object
                  </Link>
                </Button>
              </PermissionGate>
            </div>
            <div className="flex w-full px-6">
              <div className="w-full border-b border-border" />
            </div>
            <CollectionFiltersAndList organizationId={currentOrganizationId} />
          </div>
        </div>
      </div>
    </>
  );
}

interface CollectionFilters {
  search: string;
  status: "active" | "loaned" | "deaccessioned" | "all";
  objectType: string;
  culture: string;
  period: string;
  materials: string;
}

function CollectionFiltersAndList({
  organizationId,
}: {
  organizationId: string;
}) {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<CollectionFilters>({
    search: "",
    status: "all",
    objectType: "",
    culture: "",
    period: "",
    materials: "",
  });

  const [cursor, setCursor] = useState<string | null>(null);
  const prevFiltersRef = useRef(filters);

  // Reset cursor when filters change
  useEffect(() => {
    if (JSON.stringify(prevFiltersRef.current) !== JSON.stringify(filters)) {
      prevFiltersRef.current = filters;
      setCursor(null);
    }
  }, [filters]);

  const collections = useQuery(
    api.collections.list,
    organizationId
      ? {
          organizationId: organizationId as Id<"organizations">,
          paginationOpts: { numItems: 50, cursor },
          search: filters.search || undefined,
          status:
            filters.status !== "all"
              ? (filters.status as "active" | "loaned" | "deaccessioned")
              : undefined,
          objectType: filters.objectType || undefined,
          culture: filters.culture || undefined,
          period: filters.period || undefined,
          materials: filters.materials || undefined,
        }
      : "skip",
  );

  const uniqueObjectTypes = useMemo(() => {
    if (!collections?.page) return [];
    const types = new Set<string>();
    collections.page.forEach((item) => {
      if (item.objectType) types.add(item.objectType);
    });
    return Array.from(types).sort();
  }, [collections]);

  const hasActiveFilters =
    filters.search ||
    filters.status !== "all" ||
    filters.objectType ||
    filters.culture ||
    filters.period ||
    filters.materials;

  const clearFilters = () => {
    setFilters({
      search: "",
      status: "all",
      objectType: "",
      culture: "",
      period: "",
      materials: "",
    });
  };

  return (
    <div className="flex flex-col">
      {/* Search and Filter Bar */}
      <div className="border-b border-border p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by title, accession number, description..."
                value={filters.search}
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value })
                }
                className="pl-9"
              />
            </div>
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

          {/* Advanced Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={filters.status}
                  onValueChange={(value) =>
                    setFilters({
                      ...filters,
                      status: value as CollectionFilters["status"],
                    })
                  }
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="loaned">Loaned</SelectItem>
                    <SelectItem value="deaccessioned">Deaccessioned</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="objectType">Object Type</Label>
                <Select
                  value={filters.objectType || "all"}
                  onValueChange={(value) =>
                    setFilters({
                      ...filters,
                      objectType: value === "all" ? "" : value,
                    })
                  }
                >
                  <SelectTrigger id="objectType">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {uniqueObjectTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="culture">Culture</Label>
                <Input
                  id="culture"
                  placeholder="Filter by culture"
                  value={filters.culture}
                  onChange={(e) =>
                    setFilters({ ...filters, culture: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="period">Period</Label>
                <Input
                  id="period"
                  placeholder="Filter by period"
                  value={filters.period}
                  onChange={(e) =>
                    setFilters({ ...filters, period: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="materials">Materials</Label>
                <Input
                  id="materials"
                  placeholder="Filter by materials"
                  value={filters.materials}
                  onChange={(e) =>
                    setFilters({ ...filters, materials: e.target.value })
                  }
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Collection List */}
      <CollectionList
        organizationId={organizationId}
        collections={collections}
        onLoadMore={() => {
          if (collections && !collections.isDone) {
            setCursor(collections.continueCursor);
          }
        }}
        onReset={() => setCursor(null)}
      />
    </div>
  );
}

function CollectionList({
  organizationId,
  collections,
  onLoadMore,
  onReset,
}: {
  organizationId: string;
  collections:
    | {
        page: Array<{
          _id: string;
          accessionNumber: string;
          title: string;
          objectType?: string;
          currentLocationId?: string;
          status: string;
          _creationTime: number;
        }>;
        isDone: boolean;
        continueCursor: string;
      }
    | undefined;
  onLoadMore: () => void;
  onReset: () => void;
}) {

  if (collections === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (collections.page.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">No collections found</p>
        <PermissionGate permission="collections.create">
          <Button asChild>
            <Link href="/collections/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Object
            </Link>
          </Button>
        </PermissionGate>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="space-y-4">
        {collections.page.map((item) => (
          <CollectionListItem
            key={item._id}
            item={item}
            organizationId={organizationId}
          />
        ))}
      </div>
      {!collections.isDone && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={onLoadMore}>
            Load More
          </Button>
        </div>
      )}
      {collections.page.length > 0 && (
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Showing {collections.page.length} {collections.isDone ? "items" : "items (more available)"}
        </div>
      )}
    </div>
  );
}

function CollectionListItem({
  item,
  organizationId,
}: {
  item: {
    _id: string;
    accessionNumber: string;
    title: string;
    objectType?: string;
    currentLocationId?: string;
    status: string;
  };
  organizationId: string;
}) {
  const locationPath = useQuery(
    api.locations.getLocationPath,
    item.currentLocationId && organizationId
      ? { locationId: item.currentLocationId as Id<"locations"> }
      : "skip",
  );

  const primaryImageUrl = useQuery(
    api.media.getPrimaryImageUrl,
    { collectionId: item._id as Id<"collections"> },
  );

  return (
    <Link
      href={`/collections/${item._id}`}
      className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent"
    >
      <div className="flex items-center gap-4">
        {/* Primary Image Thumbnail */}
        <div className="flex h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
          {primaryImageUrl ? (
            <img
              src={primaryImageUrl}
              alt={item.title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-1 items-center justify-between">
          <div className="flex-1">
            <h3 className="font-medium">{item.title}</h3>
            <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
              <span>{item.accessionNumber}</span>
              {locationPath && locationPath.length > 0 && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {locationPath.map((loc) => loc.name).join(" → ")}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">{item.objectType || "—"}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {item.status}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}

