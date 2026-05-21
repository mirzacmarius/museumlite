"use client";

import { useOrganization } from "@/components/organization-provider";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import { Download, Upload } from "lucide-react";
import { DataExportTab } from "./data-export-tab";
import { DataImportTab } from "./data-import-tab";

export default function DataPage() {
  const { currentOrganizationId } = useOrganization();

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">
          Please select an organization to manage data.
        </p>
      </div>
    );
  }

  const organizationId = currentOrganizationId as Id<"organizations">;

  return (
    <div className="flex size-full flex-col gap-6">
      <div className="flex w-full flex-col gap-2">
        <h2 className="text-xl font-medium text-foreground">
          Data Import/Export
        </h2>
        <p className="text-sm text-muted-foreground">
          Import data from CSV files or export your data for backup and
          analysis.
        </p>
      </div>

      <Tabs defaultValue="import" className="w-full">
        <TabsList>
          <TabsTrigger value="import" className="gap-2">
            <Upload className="size-4" />
            Import
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-2">
            <Download className="size-4" />
            Export
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
