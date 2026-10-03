import type { Id } from "@v1/backend/convex/_generated/dataModel";

export const STATUS_FILTER_VALUES = [
  "all",
  "pending",
  "available",
  "fulfilled",
  "cancelled",
  "expired",
] as const;

export type StatusFilter = (typeof STATUS_FILTER_VALUES)[number];
export type HoldStatus =
  | "pending"
  | "available"
  | "fulfilled"
  | "cancelled"
  | "expired";

export interface HoldsPageState {
  statusFilter: StatusFilter;
  isPlaceHoldDialogOpen: boolean;
  patronCardNumber: string;
  itemSearch: string;
  selectedPatronId: Id<"accounts"> | null;
  selectedItemId: Id<"libraryItems"> | null;
  isProcessing: boolean;
}

export type HoldsPageAction =
  | { type: "setStatusFilter"; value: StatusFilter }
  | { type: "openPlaceHoldDialog" }
  | { type: "closePlaceHoldDialog" }
  | { type: "setPatronCardNumber"; value: string }
  | { type: "setItemSearch"; value: string }
  | { type: "selectPatron"; patronId: Id<"accounts"> }
  | { type: "selectItem"; itemId: Id<"libraryItems"> }
  | { type: "setProcessing"; value: boolean };

export const initialHoldsPageState: HoldsPageState = {
  statusFilter: "all",
  isPlaceHoldDialogOpen: false,
  patronCardNumber: "",
  itemSearch: "",
  selectedPatronId: null,
  selectedItemId: null,
  isProcessing: false,
};

export function holdsPageReducer(
  state: HoldsPageState,
  action: HoldsPageAction,
): HoldsPageState {
  switch (action.type) {
    case "setStatusFilter":
      return { ...state, statusFilter: action.value };
    case "openPlaceHoldDialog":
      return {
        ...state,
        isPlaceHoldDialogOpen: true,
        patronCardNumber: "",
        itemSearch: "",
        selectedPatronId: null,
        selectedItemId: null,
      };
    case "closePlaceHoldDialog":
      return {
        ...state,
        isPlaceHoldDialogOpen: false,
        patronCardNumber: "",
        itemSearch: "",
        selectedPatronId: null,
        selectedItemId: null,
      };
    case "setPatronCardNumber":
      return {
        ...state,
        patronCardNumber: action.value,
        selectedPatronId: null,
      };
    case "setItemSearch":
      return { ...state, itemSearch: action.value, selectedItemId: null };
    case "selectPatron":
      return { ...state, selectedPatronId: action.patronId };
    case "selectItem":
      return { ...state, selectedItemId: action.itemId };
    case "setProcessing":
      return { ...state, isProcessing: action.value };
  }
}
