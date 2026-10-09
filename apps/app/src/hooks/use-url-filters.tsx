"use client";

import "@/lib/nuqs-localstorage-shim";
import {
  createParser,
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from "nuqs";
import { useCallback, useEffect, useMemo } from "react";

export type ObjectStatus =
  | "any"
  | "all"
  | "active"
  | "loaned"
  | "deaccessioned"
  | "archived"
  | "deleted";

export type ObjectDisplayStatus = "" | "on_display";

// Advanced filter types matching AdvancedSearchDialog
export type FilterOperator =
  | "eq"
  | "ne"
  | "in"
  | "contains"
  | "gt"
  | "lt"
  | "gte"
  | "lte";

export type FilterValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[];

export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: FilterValue;
}

export interface FilterGroup {
  filters: FilterCondition[];
  operator: "AND" | "OR";
}

// Custom parser for JSON serialization of advanced filters
const parseAsJson = <T,>() =>
  createParser({
    parse: (value: string) => {
      try {
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    },
    serialize: (value: T) => JSON.stringify(value),
    eq: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  });

export function useObjectFilters() {
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault(""),
  );
  const [status, setStatus] = useQueryState(
    "status",
    parseAsStringLiteral([
      "any",
      "all",
      "active",
      "loaned",
      "deaccessioned",
      "archived",
      "deleted",
    ] as const).withDefault("any"),
  );
  const [inventoryScope, setInventoryScope] = useQueryState(
    "inventory",
    parseAsString.withDefault(""),
  );
  const [objectType, setObjectType] = useQueryState(
    "objectType",
    parseAsString.withDefault(""),
  );
  const [displayStatus, setDisplayStatus] = useQueryState(
    "displayStatus",
    parseAsStringLiteral(["", "on_display"] as const).withDefault(""),
  );
  const [culture, setCulture] = useQueryState(
    "culture",
    parseAsString.withDefault(""),
  );
  const [period, setPeriod] = useQueryState(
    "period",
    parseAsString.withDefault(""),
  );
  const [materials, setMaterials] = useQueryState(
    "materials",
    parseAsString.withDefault(""),
  );
  const [collectionGroupId, setCollectionGroupId] = useQueryState(
    "collectionGroupId",
    parseAsString.withDefault(""),
  );
  const [locationIds, setLocationIds] = useQueryState(
    "locationIds",
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [legacyLocationId, setLegacyLocationId] = useQueryState(
    "locationId",
    parseAsString.withDefault(""),
  );
  const [catalogedFrom, setCatalogedFrom] = useQueryState(
    "catalogedFrom",
    parseAsString.withDefault(""),
  );
  const [catalogedTo, setCatalogedTo] = useQueryState(
    "catalogedTo",
    parseAsString.withDefault(""),
  );

  // Advanced filter state using JSON serialization
  const [advancedFilters, setAdvancedFilters] = useQueryState(
    "advancedFilters",
    parseAsJson<FilterGroup[]>().withDefault([]),
  );
  const [filterCombinations, setFilterCombinations] = useQueryState(
    "filterCombinations",
    parseAsStringLiteral(["AND", "OR"] as const).withDefault("AND"),
  );

  useEffect(() => {
    if (!legacyLocationId || locationIds.length > 0) return;
    void setLocationIds([legacyLocationId]);
    void setLegacyLocationId(null);
  }, [
    legacyLocationId,
    locationIds.length,
    setLegacyLocationId,
    setLocationIds,
  ]);

  const filters = useMemo(
    () => ({
      search,
      status: status as ObjectStatus,
      inventoryScope,
      objectType,
      displayStatus: displayStatus as ObjectDisplayStatus,
      culture,
      period,
      materials,
      collectionGroupId,
      locationIds,
      catalogedFrom,
      catalogedTo,
      advancedFilters,
      filterCombinations: filterCombinations as "AND" | "OR",
    }),
    [
      search,
      status,
      inventoryScope,
      objectType,
      displayStatus,
      culture,
      period,
      materials,
      collectionGroupId,
      locationIds,
      catalogedFrom,
      catalogedTo,
      advancedFilters,
      filterCombinations,
    ],
  );

  const setFilters = useCallback(
    (newFilters: Partial<typeof filters>) => {
      if (newFilters.search !== undefined) setSearch(newFilters.search || null);
      if (newFilters.status !== undefined) setStatus(newFilters.status || null);
      if (newFilters.objectType !== undefined)
        setObjectType(newFilters.objectType || null);
      if (newFilters.displayStatus !== undefined)
        setDisplayStatus(newFilters.displayStatus || null);
      if (newFilters.culture !== undefined)
        setCulture(newFilters.culture || null);
      if (newFilters.period !== undefined) setPeriod(newFilters.period || null);
      if (newFilters.materials !== undefined)
        setMaterials(newFilters.materials || null);
      if (newFilters.collectionGroupId !== undefined)
        setCollectionGroupId(newFilters.collectionGroupId || null);
      if (newFilters.locationIds !== undefined) {
        void setLegacyLocationId(null);
        setLocationIds(
          newFilters.locationIds.length > 0 ? newFilters.locationIds : null,
        );
      }
      if (newFilters.catalogedFrom !== undefined)
        setCatalogedFrom(newFilters.catalogedFrom || null);
      if (newFilters.catalogedTo !== undefined)
        setCatalogedTo(newFilters.catalogedTo || null);
      if (newFilters.advancedFilters !== undefined)
        setAdvancedFilters(
          newFilters.advancedFilters.length > 0
            ? newFilters.advancedFilters
            : null,
        );
      if (newFilters.filterCombinations !== undefined)
        setFilterCombinations(newFilters.filterCombinations || null);
    },
    [
      setSearch,
      setStatus,
      setObjectType,
      setDisplayStatus,
      setCulture,
      setPeriod,
      setMaterials,
      setCollectionGroupId,
      setLocationIds,
      setLegacyLocationId,
      setCatalogedFrom,
      setCatalogedTo,
      setAdvancedFilters,
      setFilterCombinations,
    ],
  );

  const resetFilters = useCallback(() => {
    setSearch(null);
    setStatus(null);
    setInventoryScope(null);
    setObjectType(null);
    setDisplayStatus(null);
    setCulture(null);
    setPeriod(null);
    setMaterials(null);
    setCollectionGroupId(null);
    setLocationIds(null);
    setLegacyLocationId(null);
    setCatalogedFrom(null);
    setCatalogedTo(null);
    setAdvancedFilters(null);
    setFilterCombinations(null);
  }, [
    setSearch,
    setStatus,
    setInventoryScope,
    setObjectType,
    setDisplayStatus,
    setCulture,
    setPeriod,
    setMaterials,
    setCollectionGroupId,
    setLocationIds,
    setLegacyLocationId,
    setCatalogedFrom,
    setCatalogedTo,
    setAdvancedFilters,
    setFilterCombinations,
  ]);

  const hasActiveFilters = useMemo(() => {
    const hasAdvancedFilters =
      advancedFilters.length > 0 &&
      advancedFilters.some((group) => group.filters.length > 0);

    return (
      search !== "" ||
      status !== "any" ||
      inventoryScope !== "" ||
      objectType !== "" ||
      displayStatus !== "" ||
      culture !== "" ||
      period !== "" ||
      materials !== "" ||
      collectionGroupId !== "" ||
      locationIds.length > 0 ||
      catalogedFrom !== "" ||
      catalogedTo !== "" ||
      hasAdvancedFilters
    );
  }, [
    search,
    status,
    inventoryScope,
    objectType,
    displayStatus,
    culture,
    period,
    materials,
    collectionGroupId,
    locationIds,
    catalogedFrom,
    catalogedTo,
    advancedFilters,
  ]);

  return {
    filters,
    setFilters,
    resetFilters,
    hasActiveFilters,
    setSearch,
    setStatus,
    setObjectType,
    setDisplayStatus,
    setCulture,
    setPeriod,
    setMaterials,
    setCollectionGroupId,
    setLocationIds,
    setCatalogedFrom,
    setCatalogedTo,
    setAdvancedFilters,
    setFilterCombinations,
  };
}

export type MediaFileType = "all" | "image" | "document" | "3d";

export function useMediaFilters() {
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault(""),
  );
  const [fileType, setFileType] = useQueryState(
    "fileType",
    parseAsStringLiteral([
      "all",
      "image",
      "document",
      "3d",
    ] as const).withDefault("all"),
  );

  const filters = useMemo(
    () => ({
      search,
      fileType: fileType as MediaFileType,
    }),
    [fileType, search],
  );

  const setFilters = useCallback(
    (newFilters: Partial<typeof filters>) => {
      if (newFilters.search !== undefined) setSearch(newFilters.search || null);
      if (newFilters.fileType !== undefined)
        setFileType(newFilters.fileType || null);
    },
    [setFileType, setSearch],
  );

  const resetFilters = useCallback(() => {
    setSearch(null);
    setFileType(null);
  }, [setFileType, setSearch]);

  const hasActiveFilters = useMemo(() => {
    return search !== "" || fileType !== "all";
  }, [fileType, search]);

  return {
    filters,
    setFilters,
    resetFilters,
    hasActiveFilters,
    setSearch,
    setFileType,
  };
}

type AccountType = "all" | "individual" | "organization";

export function useAccountFilters() {
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault(""),
  );
  const [type, setType] = useQueryState(
    "type",
    parseAsStringLiteral([
      "all",
      "individual",
      "organization",
    ] as const).withDefault("all"),
  );
  const [role, setRole] = useQueryState("role", parseAsString.withDefault(""));

  const filters = useMemo(
    () => ({
      search,
      type: type as AccountType,
      role,
    }),
    [search, type, role],
  );

  const setFilters = useCallback(
    (newFilters: Partial<typeof filters>) => {
      if (newFilters.search !== undefined) setSearch(newFilters.search || null);
      if (newFilters.type !== undefined) setType(newFilters.type || null);
      if (newFilters.role !== undefined) setRole(newFilters.role || null);
    },
    [setSearch, setType, setRole],
  );

  const resetFilters = useCallback(() => {
    setSearch(null);
    setType(null);
    setRole(null);
  }, [setSearch, setType, setRole]);

  const hasActiveFilters = useMemo(() => {
    return search !== "" || type !== "all" || role !== "";
  }, [search, type, role]);

  return {
    filters,
    setFilters,
    resetFilters,
    hasActiveFilters,
    setSearch,
    setType,
    setRole,
  };
}

type LocationType = "all" | string;

export function useLocationFilters() {
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault(""),
  );
  const [type, setType] = useQueryState(
    "type",
    parseAsString.withDefault("all"),
  );
  const [parentId, setParentId] = useQueryState(
    "parentId",
    parseAsString.withDefault(""),
  );
  const [status, setStatus] = useQueryState(
    "status",
    parseAsStringLiteral([
      "all",
      "active",
      "closed",
      "renovation",
      "restricted",
    ] as const).withDefault("all"),
  );

  const filters = useMemo(
    () => ({
      search,
      type: type as LocationType,
      parentId,
      status,
    }),
    [search, type, parentId, status],
  );

  const setFilters = useCallback(
    (newFilters: Partial<typeof filters>) => {
      if (newFilters.search !== undefined) setSearch(newFilters.search || null);
      if (newFilters.type !== undefined) setType(newFilters.type || null);
      if (newFilters.parentId !== undefined)
        setParentId(newFilters.parentId || null);
      if (newFilters.status !== undefined) setStatus(newFilters.status || null);
    },
    [setSearch, setType, setParentId, setStatus],
  );

  const resetFilters = useCallback(() => {
    setSearch(null);
    setType(null);
    setParentId(null);
    setStatus(null);
  }, [setSearch, setType, setParentId, setStatus]);

  const hasActiveFilters = useMemo(() => {
    return (
      search !== "" || type !== "all" || parentId !== "" || status !== "all"
    );
  }, [search, type, parentId, status]);

  return {
    filters,
    setFilters,
    resetFilters,
    hasActiveFilters,
    setSearch,
    setType,
    setParentId,
    setStatus,
  };
}
