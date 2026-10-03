"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { EmptyState } from "@v1/ui/empty-state";
import { Input } from "@v1/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { usePaginatedQuery } from "convex/react";
import {
  BookCopy,
  BookOpen,
  Building2,
  Filter,
  Library,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { DashboardListPageSkeleton } from "@/components/dashboard-list-page-skeleton";
import { useOrganization } from "@/components/organization-provider";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useScopedI18n } from "@/locales/client";

const ITEM_TYPE_VALUES = [
  "all",
  "book",
  "ebook",
  "audiobook",
  "periodical",
  "newspaper",
  "dvd",
  "cd",
  "other",
] as const;

const STATUS_FILTER_VALUES = ["all", "published", "draft", "archived"] as const;

type ItemType =
  | "book"
  | "ebook"
  | "audiobook"
  | "periodical"
  | "newspaper"
  | "dvd"
  | "cd"
  | "map"
  | "manuscript"
  | "thesis"
  | "other";
type CatalogStatus = "draft" | "published" | "archived";

interface CatalogItem {
  _id: Id<"libraryItems">;
  authors: string[];
  availableCopies: number;
  catalogStatus: string;
  coverImageUrl?: string | null;
  isbn?: string | null;
  itemType: string;
  publicationYear?: number | null;
  subtitle?: string | null;
  title: string;
  totalCopies: number;
}

function LibraryCatalogUnavailableState({
  action,
  description,
  icon: Icon,
  title,
}: {
  action?: React.ReactNode;
  description: string;
  icon: typeof Library;
  title: string;
}) {
  return (
    <div className="flex size-full items-center justify-center bg-background px-6 py-8">
      <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
        <Icon className="size-12 text-muted-foreground" />
        <div className="text-center">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
    </div>
  );
}

function LibraryCatalogHeader({
  addItemLabel,
  description,
  title,
}: {
  addItemLabel: string;
  description: string;
  title: string;
}) {
  return (
    <>
      <div className="flex w-full items-center justify-between rounded-lg p-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-medium text-primary">{title}</h2>
          <p className="text-sm font-normal text-primary/60">{description}</p>
        </div>
        <Button asChild>
          <Link href="/library/catalog/new">
            <Plus className="mr-2 size-4" />
            {addItemLabel}
          </Link>
        </Button>
      </div>
      <div className="flex w-full px-6">
        <div className="w-full border-b border-border" />
      </div>
    </>
  );
}

function LibraryCatalogFilters({
  getItemTypeLabel,
  getStatusFilterLabel,
  labels,
  onSearchChange,
  onStatusFilterChange,
  onTypeFilterChange,
  searchQuery,
  statusFilter,
  typeFilter,
}: {
  getItemTypeLabel: (value: string) => string;
  getStatusFilterLabel: (value: string) => string;
  labels: {
    filters: string;
    searchCatalog: string;
  };
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onTypeFilterChange: (value: string) => void;
  searchQuery: string;
  statusFilter: string;
  typeFilter: string;
}) {
  return (
    <div className="space-y-4 border-b border-border px-6 py-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={labels.searchCatalog}
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex gap-4">
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {labels.filters}:
          </span>
        </div>
        <Select value={typeFilter} onValueChange={onTypeFilterChange}>
          <SelectTrigger className="w-40">
            <SelectValue>{getItemTypeLabel(typeFilter)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ITEM_TYPE_VALUES.map((value) => (
              <SelectItem key={value} value={value}>
                {getItemTypeLabel(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-40">
            <SelectValue>{getStatusFilterLabel(statusFilter)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_VALUES.map((value) => (
              <SelectItem key={value} value={value}>
                {getStatusFilterLabel(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function CatalogStatusBadge({
  labels,
  status,
}: {
  labels: {
    archived: string;
    draft: string;
    published: string;
  };
  status: string;
}) {
  switch (status) {
    case "draft":
      return <Badge variant="secondary">{labels.draft}</Badge>;
    case "published":
      return (
        <Badge variant="default" className="bg-green-500">
          {labels.published}
        </Badge>
      );
    case "archived":
      return <Badge variant="outline">{labels.archived}</Badge>;
    default:
      return null;
  }
}

function CatalogItemRow({
  item,
  labels,
}: {
  item: CatalogItem;
  labels: {
    copiesAvailable: string;
    status: {
      archived: string;
      draft: string;
      published: string;
    };
  };
}) {
  return (
    <Link
      key={item._id}
      href={`/library/catalog/${item._id}`}
      className="flex items-center gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-accent"
    >
      <div className="flex h-20 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
        {item.coverImageUrl ? (
          <Image
            src={item.coverImageUrl}
            alt={item.title}
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            className="object-cover"
          />
        ) : (
          <BookOpen className="size-6 text-muted-foreground" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-medium">{item.title}</h3>
          <CatalogStatusBadge
            status={item.catalogStatus}
            labels={labels.status}
          />
        </div>
        {item.subtitle ? (
          <p className="truncate text-sm text-muted-foreground">
            {item.subtitle}
          </p>
        ) : null}
        <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
          {item.authors.length > 0 ? (
            <span className="truncate">{item.authors.join(", ")}</span>
          ) : null}
          {item.publicationYear ? (
            <>
              <span>|</span>
              <span>{item.publicationYear}</span>
            </>
          ) : null}
          {item.isbn ? (
            <>
              <span>|</span>
              <span className="font-mono">{item.isbn}</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex-shrink-0 text-right">
        <p className="text-sm font-medium">
          {item.availableCopies}/{item.totalCopies}
        </p>
        <p className="text-xs text-muted-foreground">
          {labels.copiesAvailable}
        </p>
        <Badge variant="secondary" className="mt-1 capitalize">
          {item.itemType}
        </Badge>
      </div>
    </Link>
  );
}

function LibraryCatalogItems({
  hasFilters,
  items,
  labels,
}: {
  hasFilters: boolean;
  items:
    | {
        page: CatalogItem[];
      }
    | undefined;
  labels: {
    addFirstItem: string;
    copiesAvailable: string;
    emptyNoItems: string;
    emptyNoItemsDescription: string;
    emptyNoItemsFiltered: string;
    emptyTryAdjustSearch: string;
    status: {
      archived: string;
      draft: string;
      published: string;
    };
  };
}) {
  if (items === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.page.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center p-6">
        <EmptyState
          icon={BookCopy}
          title={hasFilters ? labels.emptyNoItemsFiltered : labels.emptyNoItems}
          description={
            hasFilters
              ? labels.emptyTryAdjustSearch
              : labels.emptyNoItemsDescription
          }
          action={
            hasFilters
              ? undefined
              : {
                  label: labels.addFirstItem,
                  href: "/library/catalog/new",
                  icon: Plus,
                }
          }
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="space-y-4">
        {items.page.map((item) => (
          <CatalogItemRow
            key={item._id}
            item={item}
            labels={{
              copiesAvailable: labels.copiesAvailable,
              status: labels.status,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function LibraryCatalogPage() {
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const { hasModule } = useFeatureAccess();
  const t = useScopedI18n("library.placeholders");
  const tLib = useScopedI18n("library");
  const tCat = useScopedI18n("library.catalog");

  const getItemTypeLabel = (value: string) => {
    if (value === "all") return tLib("itemTypes.all");
    return tLib(`itemTypes.${value}` as "itemTypes.book");
  };

  const getStatusFilterLabel = (value: string) => {
    if (value === "all") return tLib("statusFilters.all");
    return tLib(`statusFilters.${value}` as "statusFilters.published");
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const isLibraryEnabled = hasModule("library");

  const { results: catalogItems, status: catalogStatus } = usePaginatedQuery(
    api.library.items.list,
    currentOrganizationId && isLibraryEnabled
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          search: searchQuery.trim() || undefined,
          itemType: typeFilter !== "all" ? (typeFilter as ItemType) : undefined,
          catalogStatus:
            statusFilter !== "all"
              ? (statusFilter as CatalogStatus)
              : undefined,
        }
      : "skip",
    { initialNumItems: 50 },
  );

  const items =
    catalogStatus === "LoadingFirstPage"
      ? undefined
      : { page: catalogItems as CatalogItem[] };

  if (isLoading) {
    return (
      <DashboardListPageSkeleton
        actionsCount={1}
        filtersCount={2}
        layout="list"
      />
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <LibraryCatalogUnavailableState
        icon={Building2}
        title={tCat("noOrganization")}
        description={tCat("noOrganizationDescription")}
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
      <LibraryCatalogUnavailableState
        icon={Library}
        title={tCat("selectOrganization")}
        description={tCat("selectOrganizationDescription")}
      />
    );
  }

  if (isLibraryEnabled === false) {
    return (
      <LibraryCatalogUnavailableState
        icon={Library}
        title={tCat("notEnabled")}
        description={tCat("notEnabledDescription")}
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

  return (
    <div className="flex size-full bg-background px-6">
      <div className="z-10 mx-auto flex size-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <LibraryCatalogHeader
            addItemLabel={tCat("addItem")}
            description={tCat("description")}
            title={tCat("title")}
          />

          <LibraryCatalogFilters
            getItemTypeLabel={getItemTypeLabel}
            getStatusFilterLabel={getStatusFilterLabel}
            labels={{
              filters: tLib("filters"),
              searchCatalog: t("searchCatalog"),
            }}
            onSearchChange={setSearchQuery}
            onStatusFilterChange={setStatusFilter}
            onTypeFilterChange={setTypeFilter}
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            typeFilter={typeFilter}
          />

          <LibraryCatalogItems
            hasFilters={
              Boolean(searchQuery) ||
              typeFilter !== "all" ||
              statusFilter !== "all"
            }
            items={items}
            labels={{
              addFirstItem: tCat("addFirstItem"),
              copiesAvailable: tCat("labels.copiesAvailable"),
              emptyNoItems: tCat("emptyState.noItems"),
              emptyNoItemsDescription: tCat("emptyState.noItemsDescription"),
              emptyNoItemsFiltered: tCat("emptyState.noItemsFiltered"),
              emptyTryAdjustSearch: tCat("emptyState.tryAdjustSearch"),
              status: {
                archived: tCat("status.archived"),
                draft: tCat("status.draft"),
                published: tCat("status.published"),
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
