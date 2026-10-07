"use client";

import Image from "next/image";
import { useI18n } from "@/locales/client";
import type { DeaccessionDetailViewProps } from "./deaccession-detail-view-props";

type BoardReportExportData = NonNullable<
  DeaccessionDetailViewProps["exportData"]
>;

interface BoardReportDialogHeaderProps {
  exportData: BoardReportExportData;
}

export function BoardReportDialogHeader({
  exportData,
}: BoardReportDialogHeaderProps) {
  const tRoot = useI18n();
  const status = exportData.deaccession.status;
  const statusLabel =
    status === "approved"
      ? tRoot("deaccessions.status.approved")
      : status === "rejected"
        ? tRoot("deaccessions.status.rejected")
        : status === "pending"
          ? tRoot("deaccessions.status.pending")
          : status;
  return (
    <div className="flex items-start gap-4 border-b border-zinc-200 pb-4 print:gap-3 print:pb-3">
      {exportData.collection?.primaryImageUrl ? (
        <Image
          src={exportData.collection.primaryImageUrl}
          alt={exportData.collection.title}
          width={96}
          height={96}
          className="size-24 flex-shrink-0 rounded border border-zinc-300 object-cover print:size-20"
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 print:text-[10px]">
          {exportData.organization.name}
        </p>
        <h1 className="text-xl font-semibold text-black print:text-lg">
          {tRoot("untranslatedRecords.deaccessions.detail.reportTitle")}
        </h1>
        <p className="text-sm text-zinc-600 print:text-xs">
          {exportData.deaccession.deaccessionNumber}
        </p>
      </div>
      <div className="flex-shrink-0 text-right">
        <span
          className={`inline-block rounded px-2 py-1 text-xs font-medium ${
            exportData.deaccession.status === "approved"
              ? "bg-green-100 text-green-800"
              : exportData.deaccession.status === "rejected"
                ? "bg-red-100 text-red-800"
                : "bg-amber-100 text-amber-800"
          }`}
        >
          {statusLabel}
        </span>
      </div>
    </div>
  );
}
