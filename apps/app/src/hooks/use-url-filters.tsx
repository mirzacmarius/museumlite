"use client";

import "@/lib/nuqs-localstorage-shim";
import {
  createParser,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from "nuqs";
import { useCallback, useMemo } from "react";

export type ObjectStatus =
  | "any"
  | "all"
  | "active"
  | "loaned"
  | "deaccessioned"
  | "archived"
  | "deleted";

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
  const [objectType, setObjectType] = useQueryState(
    "objectType",
    parseAsString.withDefault(""),
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
  const [locationId, setLocationId] = useQueryState(
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

  const filters = useMemo(
    () => ({
      search,
      status: status as ObjectStatus,
      objectType,
      culture,
      period,
      materials,
      collectionGroupId,
      locationId,
      catalogedFrom,
      catalogedTo,
      advancedFilters,
      filterCombinations: filterCombinations as "AND" | "OR",
    }),
    [
      search,
      status,
      objectType,
      culture,
      period,
      materials,
      collectionGroupId,
      locationId,
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
      if (newFilters.culture !== undefined)
        setCulture(newFilters.culture || null);
      if (newFilters.period !== undefined) setPeriod(newFilters.period || null);
      if (newFilters.materials !== undefined)
        setMaterials(newFilters.materials || null);
      if (newFilters.collectionGroupId !== undefined)
        setCollectionGroupId(newFilters.collectionGroupId || null);
      if (newFilters.locationId !== undefined)
        setLocationId(newFilters.locationId || null);
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
      setCulture,
      setPeriod,
      setMaterials,
      setCollectionGroupId,
      setLocationId,
      setCatalogedFrom,
      setCatalogedTo,
      setAdvancedFilters,
      setFilterCombinations,
    ],
  );

  const resetFilters = useCallback(() => {
    setSearch(null);
    setStatus(null);
    setObjectType(null);
    setCulture(null);
    setPeriod(null);
    setMaterials(null);
    setCollectionGroupId(null);
    setLocationId(null);
    setCatalogedFrom(null);
    setCatalogedTo(null);
    setAdvancedFilters(null);
    setFilterCombinations(null);
  }, [
    setSearch,
    setStatus,
    setObjectType,
    setCulture,
    setPeriod,
    setMaterials,
    setCollectionGroupId,
    setLocationId,
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
      objectType !== "" ||
      culture !== "" ||
      period !== "" ||
      materials !== "" ||
      collectionGroupId !== "" ||
      locationId !== "" ||
      catalogedFrom !== "" ||
      catalogedTo !== "" ||
      hasAdvancedFilters
    );
  }, [
    search,
    status,
    objectType,
    culture,
    period,
    materials,
    collectionGroupId,
    locationId,
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
    setCulture,
    setPeriod,
    setMaterials,
    setCollectionGroupId,
    setLocationId,
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

type LoanStatus =
  | "all"
  | "pending"
  | "approved"
  | "active"
  | "returned"
  | "overdue"
  | "rejected";
type LoanType = "all" | "incoming" | "outgoing";

export function useLoanFilters() {
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault(""),
  );
  const [status, setStatus] = useQueryState(
    "status",
    parseAsStringLiteral([
      "all",
      "pending",
      "approved",
      "active",
      "returned",
      "overdue",
      "rejected",
    ] as const).withDefault("all"),
  );
  const [type, setType] = useQueryState(
    "type",
    parseAsStringLiteral(["all", "incoming", "outgoing"] as const).withDefault(
      "all",
    ),
  );
  const [borrowerId, setBorrowerId] = useQueryState(
    "borrowerId",
    parseAsString.withDefault(""),
  );
  const [dateFrom, setDateFrom] = useQueryState(
    "dateFrom",
    parseAsString.withDefault(""),
  );
  const [dateTo, setDateTo] = useQueryState(
    "dateTo",
    parseAsString.withDefault(""),
  );

  const filters = useMemo(
    () => ({
      search,
      status: status as LoanStatus,
      type: type as LoanType,
      borrowerId,
      dateFrom,
      dateTo,
    }),
    [search, status, type, borrowerId, dateFrom, dateTo],
  );

  const setFilters = useCallback(
    (newFilters: Partial<typeof filters>) => {
      if (newFilters.search !== undefined) setSearch(newFilters.search || null);
      if (newFilters.status !== undefined) setStatus(newFilters.status || null);
      if (newFilters.type !== undefined) setType(newFilters.type || null);
      if (newFilters.borrowerId !== undefined)
        setBorrowerId(newFilters.borrowerId || null);
      if (newFilters.dateFrom !== undefined)
        setDateFrom(newFilters.dateFrom || null);
      if (newFilters.dateTo !== undefined) setDateTo(newFilters.dateTo || null);
    },
    [setSearch, setStatus, setType, setBorrowerId, setDateFrom, setDateTo],
  );

  const resetFilters = useCallback(() => {
    setSearch(null);
    setStatus(null);
    setType(null);
    setBorrowerId(null);
    setDateFrom(null);
    setDateTo(null);
  }, [setSearch, setStatus, setType, setBorrowerId, setDateFrom, setDateTo]);

  const hasActiveFilters = useMemo(() => {
    return (
      search !== "" ||
      status !== "all" ||
      type !== "all" ||
      borrowerId !== "" ||
      dateFrom !== "" ||
      dateTo !== ""
    );
  }, [search, status, type, borrowerId, dateFrom, dateTo]);

  return {
    filters,
    setFilters,
    resetFilters,
    hasActiveFilters,
    setSearch,
    setStatus,
    setType,
    setBorrowerId,
    setDateFrom,
    setDateTo,
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
