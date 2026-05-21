import type { api } from "@v1/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

export type CollectionListItem = FunctionReturnType<
  typeof api.collections.list
>["page"][number];

export type TypeOption = FunctionReturnType<
  typeof api.typeOptions.list
>[number];

export type BulkExportItem = FunctionReturnType<
  typeof api.collections.bulkExport
>[number];
