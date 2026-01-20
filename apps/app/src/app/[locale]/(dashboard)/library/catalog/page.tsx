"use client";

import { useOrganization } from "@/components/organization-provider";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useScopedI18n } from "@/locales/client";
import { useI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useQuery } from "convex/react";
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
import Link from "next/link";
import { useState } from "react";

const ITEM_TYPES = [
  { value: "all", label: "All Types" },
  { value: "book", label: "Book" },
  { value: "ebook", label: "E-Book" },
  { value: "audiobook", label: "Audiobook" },
  { value: "periodical", label: "Periodical" },
  { value: "newspaper", label: "Newspaper" },
  { value: "dvd", label: "DVD" },
  { value: "cd", label: "CD" },
  { value: "other", label: "Other" },
] as const;

const STATUS_FILTERS = [
  { value: "all", label: "All Status" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
] as const;

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

export default function LibraryCatalogPage() {
  const { currentOrganizationId, organizations, isLoading } = useOrganization();
  const { hasModule } = useFeatureAccess();
  const t = useScopedI18n("library.placeholders");
  const tLib = useScopedI18n("library");
  const tCat = useScopedI18n("library.catalog");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const isLibraryEnabled = hasModule("library");

  const items = useQuery(
    api.library.items.list,
    currentOrganizationId && isLibraryEnabled
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          paginationOpts: { numItems: 50, cursor: null },
          search: searchQuery.trim() || undefined,
          itemType: typeFilter !== "all" ? (typeFilter as ItemType) : undefined,
          catalogStatus:
            statusFilter !== "all"
              ? (statusFilter as CatalogStatus)
              : undefined,
        }
      : "skip",
  );

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
          <Building2 className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">{tCat("noOrganization")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {tCat("noOrganizationDescription")}
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
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
          <Library className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">
              {tCat("selectOrganization")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {tCat("selectOrganizationDescription")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLibraryEnabled === false) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6 py-8">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
          <Library className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h3 className="text-lg font-semibold">{tCat("notEnabled")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {tCat("notEnabledDescription")}
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "published":
        return (
          <Badge variant="default" className="bg-green-500">
            Published
          </Badge>
        );
      case "archived":
        return <Badge variant="outline">Archived</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full w-full bg-background px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          {/* Header */}
          <div className="flex w-full items-center justify-between rounded-lg p-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-medium text-primary">
                {tCat("title")}
              </h2>
              <p className="text-sm font-normal text-primary/60">
                {tCat("description")}
              </p>
            </div>
            <Button asChild>
              <Link href="/library/catalog/new">
                <Plus className="mr-2 h-4 w-4" />
                {tCat("addItem")}
              </Link>
            </Button>
          </div>
          <div className="flex w-full px-6">
            <div className="w-full border-b border-border" />
          </div>

          {/* Search & Filters */}
          <div className="space-y-4 border-b border-border px-6 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("searchCatalog")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {tLib("filters")}:
                </span>
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Items List */}
          {items === undefined ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.page.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-4 p-6">
              <BookCopy className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">
                  {searchQuery || typeFilter !== "all" || statusFilter !== "all"
                    ? tCat("emptyState.noItemsFiltered")
                    : tCat("emptyState.noItems")}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {searchQuery || typeFilter !== "all" || statusFilter !== "all"
                    ? tCat("emptyState.tryAdjustSearch")
                    : tCat("emptyState.noItemsDescription")}
                </p>
              </div>
              {!searchQuery &&
                typeFilter === "all" &&
                statusFilter === "all" && (
                  <Button asChild>
                    <Link href="/library/catalog/new">
                      <Plus className="mr-2 h-4 w-4" />
                      {tCat("addFirstItem")}
                    </Link>
                  </Button>
                )}
            </div>
          ) : (
            <div className="p-6">
              <div className="space-y-4">
                {items.page.map((item) => (
                  <Link
                    key={item._id}
                    href={`/library/catalog/${item._id}`}
                    className="flex items-center gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-accent"
                  >
                    {/* Cover Image */}
                    <div className="flex h-20 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                      {item.coverImageUrl ? (
                        <img
                          src={item.coverImageUrl}
                          alt={item.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <BookOpen className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium truncate">{item.title}</h3>
                        {getStatusBadge(item.catalogStatus)}
                      </div>
                      {item.subtitle && (
                        <p className="text-sm text-muted-foreground truncate">
                          {item.subtitle}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                        {item.authors.length > 0 && (
                          <span className="truncate">
                            {item.authors.join(", ")}
                          </span>
                        )}
                        {item.publicationYear && (
                          <>
                            <span>|</span>
                            <span>{item.publicationYear}</span>
                          </>
                        )}
                        {item.isbn && (
                          <>
                            <span>|</span>
                            <span className="font-mono">{item.isbn}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Copies Info */}
                    <div className="flex-shrink-0 text-right">
                      <p className="text-sm font-medium">
                        {item.availableCopies}/{item.totalCopies}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tCat("labels.copiesAvailable")}
                      </p>
                      <Badge variant="secondary" className="mt-1 capitalize">
                        {item.itemType}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
