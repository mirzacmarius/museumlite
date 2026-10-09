"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import { Download, Upload } from "lucide-react";
import { Suspense } from "react";
import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { DataBatchJobs } from "./data-batch-jobs";
import { DataExportTab } from "./data-export-tab";
import { DataImportTab } from "./data-import-tab";
import { DataIntegrityReview } from "./data-integrity-review";
import { PartyReview } from "./party-review";
export default function DataPage() {
  const t = useScopedI18n("untranslatedDashboard.settings");
  const { currentOrganizationId } = useOrganization();

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{t("selectOrganizationData")}</p>
      </div>
    );
  }

  const organizationId = currentOrganizationId as Id<"organizations">;

  return (
    <div className="flex size-full flex-col gap-6">
      <div className="flex w-full flex-col gap-2">
        <h2 className="text-xl font-medium text-foreground">
          {t("dataImportExport")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("dataImportDescription")}
        </p>
      </div>

      <Suspense fallback={<p role="status">Loading record review…</p>}>
        <DataBatchJobs key={organizationId} organizationId={organizationId} />
        <DataIntegrityReview organizationId={organizationId} />
        <PartyReview organizationId={organizationId} />
      </Suspense>
      <Tabs defaultValue="import" className="w-full">
        <TabsList>
          <TabsTrigger value="import" className="gap-2">
            <Upload className="size-4" />
            {t("import")}
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-2">
            <Download className="size-4" />
            {t("export")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import">
          <DataImportTab organizationId={organizationId} />
        </TabsContent>

        <TabsContent value="export">
          <DataExportTab organizationId={organizationId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
