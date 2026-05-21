export const STATUS_FILTER_VALUES = [
  "all",
  "submitted",
  "under_review",
  "approved",
  "ordered",
  "received",
  "cataloged",
  "rejected",
] as const;

export const PRIORITY_FILTER_VALUES = [
  "all",
  "urgent",
  "high",
  "normal",
  "low",
] as const;

export type RequestStatus =
  | "submitted"
  | "under_review"
  | "approved"
  | "ordered"
  | "received"
  | "cataloged"
  | "rejected"
  | "cancelled";

export type Priority = "low" | "normal" | "high" | "urgent";

export interface NewAcquisitionRequestForm {
  title: string;
  authors: string;
  isbn: string;
  publisher: string;
  reason: string;
  priority: Priority;
  quantity: string;
  estimatedPrice: string;
}

export const EMPTY_NEW_REQUEST: NewAcquisitionRequestForm = {
  title: "",
  authors: "",
  isbn: "",
  publisher: "",
  reason: "",
  priority: "normal",
  quantity: "1",
  estimatedPrice: "",
};
