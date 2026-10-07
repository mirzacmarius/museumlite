import { toast } from "sonner";
import type { BulkExportItem } from "./collection-catalog-types";

export function exportCollectionsToCsv(
  bulkExport: BulkExportItem[],
  headers: string[],
  exportedMessage: string,
) {
  if (bulkExport.length === 0) {
    return;
  }

  const rows = bulkExport.map((item): string[] => {
    const catalogedDate =
      new Date(item.catalogedAt).toISOString().split("T")[0] ?? "";

    return [
      item.accessionNumber,
      item.title,
      item.alternativeTitle ?? "",
      item.creator ?? "",
      item.objectType ?? "",
      item.objectName ?? "",
      item.culture ?? "",
      item.period ?? "",
      item.dateCreated ?? "",
      item.materials ?? "",
      item.technique ?? "",
      item.dimensions ?? "",
      item.description?.replace(/[\n\r]/g, " ") ?? "",
      item.condition ?? "",
      item.provenance?.replace(/[\n\r]/g, " ") ?? "",
      item.status,
      item.locationPath ?? "",
      item.collectionGroup ?? "",
      JSON.stringify(item.collectionGroups),
      catalogedDate,
    ];
  });

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","),
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `collection-export-${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);

  toast.success(exportedMessage);
}
