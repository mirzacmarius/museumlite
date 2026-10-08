import type { api } from "@v1/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { LucideIcon } from "lucide-react";

export type ExhibitionDetail = NonNullable<
  FunctionReturnType<typeof api.exhibitions.get>
>;

export type ExhibitionWorkflowHistoryEntry = FunctionReturnType<
  typeof api.exhibitions.getWorkflowHistory
>["entries"][number];

export type ExhibitionDocumentRecord = FunctionReturnType<
  typeof api.exhibitions.listDocuments
>[number];

export type ExhibitionDetailRecord = ExhibitionDetail;

export interface ExhibitionWorkflowStatusInfo {
  color: string;
  icon: LucideIcon;
  text: string;
}

export interface ExhibitionDurationInfo {
  label: string;
  value: string;
}

export interface ExhibitionTimeStatus {
  color: string;
  text: string;
}
