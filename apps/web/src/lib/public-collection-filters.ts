export type PublicCollectionViewMode = "grid" | "list";

export interface PublicCollectionFiltersState {
  search: string;
  objectType: string;
  culture: string;
  period: string;
  viewMode: PublicCollectionViewMode;
}

export type PublicCollectionFiltersAction =
  | { type: "setSearch"; value: string }
  | { type: "setObjectType"; value: string }
  | { type: "setCulture"; value: string }
  | { type: "setPeriod"; value: string }
  | { type: "setViewMode"; value: PublicCollectionViewMode }
  | { type: "clearFilters" };

export function createInitialPublicCollectionFiltersState(
  getSearchParam: (key: string) => string | null,
): PublicCollectionFiltersState {
  return {
    search: getSearchParam("search") ?? "",
    objectType: getSearchParam("type") ?? "all",
    culture: getSearchParam("culture") ?? "all",
    period: getSearchParam("period") ?? "all",
    viewMode: "grid",
  };
}

export function publicCollectionFiltersReducer(
  state: PublicCollectionFiltersState,
  action: PublicCollectionFiltersAction,
): PublicCollectionFiltersState {
  switch (action.type) {
    case "setSearch":
      return { ...state, search: action.value };
    case "setObjectType":
      return { ...state, objectType: action.value };
    case "setCulture":
      return { ...state, culture: action.value };
    case "setPeriod":
      return { ...state, period: action.value };
    case "setViewMode":
      return { ...state, viewMode: action.value };
    case "clearFilters":
      return {
        ...state,
        search: "",
        objectType: "all",
        culture: "all",
        period: "all",
      };
  }
}
