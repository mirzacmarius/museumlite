"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { FileText } from "lucide-react";

import { useI18n } from "@/locales/client";

type DetailsDoc = NonNullable<
  FunctionReturnType<typeof api.archiveDetails.get>
>;

interface ArchiveDocumentInfoSectionProps {
  details: DetailsDoc;
}

export function ArchiveDocumentInfoSection({
  details,
}: ArchiveDocumentInfoSectionProps) {
  const tRoot = useI18n();
  return (
    <div>
      <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
        <FileText className="size-4 text-blue-500" />
        {tRoot("modules.archive.documentInformation")}
      </h3>

      <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
              {tRoot("modules.archive.documentType")}
            </div>
            <div className="text-sm font-medium text-foreground">
              {details.documentType || "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
              {tRoot("modules.archive.retentionCategory")}
            </div>
            <div className="text-sm font-medium text-foreground">
              {details.retentionCategory || "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
              {tRoot("modules.archive.originatingDepartment")}
            </div>
            <div className="text-sm font-medium text-foreground">
              {details.originatingDepartment || "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
              {tRoot("modules.archive.recordSeries")}
            </div>
            <div className="text-sm font-medium text-foreground">
              {details.recordSeries || "—"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
