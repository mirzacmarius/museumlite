"use client";

import Image from "next/image";
import type { DeaccessionDetailViewProps } from "./deaccession-detail-view-props";

type ExportData = NonNullable<DeaccessionDetailViewProps["exportData"]>;

interface DeaccessionBoardReportHeaderProps {
  exportData: ExportData;
}

export function DeaccessionBoardReportHeader({
  exportData,
}: DeaccessionBoardReportHeaderProps) {
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
          Deaccession Report
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
          {exportData.deaccession.status.charAt(0).toUpperCase() +
            exportData.deaccession.status.slice(1)}
        </span>
      </div>
    </div>
  );
}
