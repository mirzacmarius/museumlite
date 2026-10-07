"use client";

import { api } from "@v1/backend/convex/_generated/api";
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
import type { FunctionReturnType } from "convex/server";
import { ChevronRight, Grid, List, Search, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useReducer } from "react";
import {
  createInitialPublicCollectionFiltersState,
  publicCollectionFiltersReducer,
} from "@/lib/public-collection-filters";
import { useWebI18n } from "@/locales/provider";

function PublicPortalPageFallback() {
  const { t } = useWebI18n();
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-white/60">{t("common.loadingCollection")}</p>
    </div>
  );
}

function PublicPortalPageClientInner() {
  const { t } = useWebI18n();
  const params = useParams();
  const searchParams = useSearchParams();
  const getSearchParam = searchParams.get.bind(searchParams);
  const { push } = useRouter();
  const orgSlug = params.orgSlug as string;
  const portalSlug = params.portalSlug as string;

  const [filtersState, dispatch] = useReducer(
    publicCollectionFiltersReducer,
    getSearchParam,
    createInitialPublicCollectionFiltersState,
  );
  const { search, objectType, culture, period, viewMode } = filtersState;

  const filters = useQuery(api.collections.getPublicFilters, {
    organizationSlug: orgSlug,
    portalSlug,
  });

  const collections = useQuery(api.collections.listPublic, {
    organizationSlug: orgSlug,
    portalSlug,
    search: search || undefined,
    objectType: objectType !== "all" ? objectType : undefined,
    culture: culture !== "all" ? culture : undefined,
    period: period !== "all" ? period : undefined,
  });

  const basePath = `/${orgSlug}/${portalSlug}`;

  const updateUrl = useCallback(() => {
    const urlParams = new URLSearchParams();
    if (search) urlParams.set("search", search);
    if (objectType !== "all") urlParams.set("type", objectType);
    if (culture !== "all") urlParams.set("culture", culture);
    if (period !== "all") urlParams.set("period", period);
    const queryString = urlParams.toString();
    push(`${basePath}${queryString ? `?${queryString}` : ""}`);
  }, [basePath, culture, objectType, period, push, search]);

  useEffect(() => {
    const timeout = setTimeout(updateUrl, 300);
    return () => clearTimeout(timeout);
  }, [updateUrl]);

  const clearFilters = () => {
    dispatch({ type: "clearFilters" });
  };

  const hasActiveFilters =
    search || objectType !== "all" || culture !== "all" || period !== "all";

  if (collections === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white/60">{t("common.loadingCollection")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
              <Input
                placeholder={t("common.searchObjects")}
                value={search}
                onChange={(e) =>
                  dispatch({ type: "setSearch", value: e.target.value })
                }
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant={viewMode === "grid" ? "secondary" : "outline"}
                size="icon"
                onClick={() => dispatch({ type: "setViewMode", value: "grid" })}
                aria-label={t("public.viewGrid")}
                className="border-white/10"
              >
                <Grid className="size-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "outline"}
                size="icon"
                onClick={() => dispatch({ type: "setViewMode", value: "list" })}
                aria-label={t("public.viewList")}
                className="border-white/10"
              >
                <List className="size-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            {filters?.objectTypes && filters.objectTypes.length > 0 && (
              <Select
                value={objectType}
                onValueChange={(value) =>
                  dispatch({ type: "setObjectType", value })
                }
              >
                <SelectTrigger className="w-[180px] bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder={t("common.objectType")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.allTypes")}</SelectItem>
                  {filters.objectTypes.map((type: string) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {filters?.cultures && filters.cultures.length > 0 && (
              <Select
                value={culture}
                onValueChange={(value) =>
                  dispatch({ type: "setCulture", value })
                }
              >
                <SelectTrigger className="w-[180px] bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder={t("common.culture")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.allCultures")}</SelectItem>
                  {filters.cultures.map((c: string) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {filters?.periods && filters.periods.length > 0 && (
              <Select
                value={period}
                onValueChange={(value) =>
                  dispatch({ type: "setPeriod", value })
                }
              >
                <SelectTrigger className="w-[180px] bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder={t("common.period")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.allPeriods")}</SelectItem>
                  {filters.periods.map((p: string) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {hasActiveFilters && (
              <Button
                variant="ghost"
                onClick={clearFilters}
                className="text-white/60 hover:text-white"
              >
                <X className="mr-2 size-4" />
                {t("common.clearFilters")}
              </Button>
            )}
          </div>
        </div>

        <PublicPortalResults
          collections={collections}
          basePath={basePath}
          hasActiveFilters={Boolean(hasActiveFilters)}
          viewMode={viewMode}
        />
      </div>
    </div>
  );
}

export function PublicPortalPageClient() {
  return (
    <Suspense fallback={<PublicPortalPageFallback />}>
      <PublicPortalPageClientInner />
    </Suspense>
  );
}

type PublicCollections = NonNullable<
  FunctionReturnType<typeof api.collections.listPublic>
>;

function PublicPortalResults({
  collections,
  basePath,
  hasActiveFilters,
  viewMode,
}: {
  collections: PublicCollections;
  basePath: string;
  hasActiveFilters: boolean;
  viewMode: "grid" | "list";
}) {
  const { t } = useWebI18n();

  return (
    <div>
      <div className="mb-4 text-sm text-white/60">
        {t("public.searchResults", { count: collections.items.length })}
      </div>

      {collections.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-xl text-white/60 mb-2">
            {t("common.noItemsFound")}
          </p>
          <p className="text-white/40">
            {collections.portalStatus === "portal_disabled"
              ? t("public.disabledOrganizationPortal")
              : collections.portalStatus === "portal_slug_mismatch"
                ? t("public.collectionUnavailable")
                : collections.portalStatus === "org_not_found"
                  ? t("public.organizationNotFound")
                  : hasActiveFilters
                    ? t("public.tryAdjustingFilters")
                    : t("public.collectionNoPublicItems")}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {collections.items.map(
            (item: {
              _id: string;
              urlSlug: string;
              accessionNumber: string;
              title: string;
              creator?: string;
              objectType?: string;
              primaryImageUrl?: string;
            }) => (
              <Link
                key={item._id}
                href={`${basePath}/${encodeURIComponent(item.urlSlug || item.accessionNumber)}`}
                className="group block"
              >
                <div className="aspect-square relative rounded-lg overflow-hidden bg-white/5 border border-white/10 mb-3">
                  {item.primaryImageUrl ? (
                    <Image
                      src={item.primaryImageUrl}
                      alt={item.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-white/20">
                      {t("common.noImage")}
                    </div>
                  )}
                </div>
                <h3 className="font-medium text-white group-hover:text-white/80 line-clamp-2">
                  {item.title}
                </h3>
                {item.creator && (
                  <p className="text-sm text-white/60 mt-1">{item.creator}</p>
                )}
                <p className="text-xs text-white/40 mt-1">
                  {item.accessionNumber}
                </p>
              </Link>
            ),
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {collections.items.map(
            (item: {
              _id: string;
              urlSlug: string;
              accessionNumber: string;
              title: string;
              creator?: string;
              objectType?: string;
              dateCreated?: string;
              primaryImageUrl?: string;
            }) => (
              <Link
                key={item._id}
                href={`${basePath}/${encodeURIComponent(item.urlSlug || item.accessionNumber)}`}
                className="group flex gap-4 p-4 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="size-24 relative rounded overflow-hidden flex-shrink-0">
                  {item.primaryImageUrl ? (
                    <Image
                      src={item.primaryImageUrl}
                      alt={item.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/5 text-white/20 text-xs">
                      {t("common.noImage")}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white group-hover:text-white/80">
                    {item.title}
                  </h3>
                  {item.creator && (
                    <p className="text-sm text-white/60 mt-1">{item.creator}</p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-white/40">
                    <span>{item.accessionNumber}</span>
                    {item.objectType && <span>{item.objectType}</span>}
                    {item.dateCreated && <span>{item.dateCreated}</span>}
                  </div>
                </div>
                <ChevronRight className="size-5 text-white/40 self-center flex-shrink-0" />
              </Link>
            ),
          )}
        </div>
      )}
    </div>
  );
}
