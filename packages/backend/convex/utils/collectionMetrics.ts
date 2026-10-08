import type { Doc } from "../_generated/dataModel";

export const INVENTORY_METRIC_DEFINITION = "operational_inventory_v1" as const;

export interface InventoryMetricRecord {
  status: Doc<"collections">["status"];
  hasOpenDeaccession: boolean;
  linkedToIncomingLoan: boolean;
  linkedToOutgoingLoan: boolean;
}

export function classifyInventoryRecord(
  record: InventoryMetricRecord,
): "owned" | "incoming" | "unclassified" | "excluded" {
  if (
    record.status === "deleted" ||
    record.status === "deaccessioned" ||
    record.hasOpenDeaccession
  )
    return "excluded";
  if (record.linkedToIncomingLoan && record.linkedToOutgoingLoan)
    return "unclassified";
  if (record.linkedToIncomingLoan) return "incoming";
  if (record.status === "loaned" && !record.linkedToOutgoingLoan)
    return "unclassified";
  return "owned";
}
