"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import { Plus } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useState } from "react";
import { usePermissions } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { NewRequestDialog } from "./new-request-dialog";
import { RequestsList } from "./requests-list";
import { TermsPanel } from "./terms-panel";

const VIEWS = ["requests", "terms"] as const;

export function RequestsPageClient({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("reproductionRequests");
  const { hasPermission } = usePermissions();
  const [creating, setCreating] = useState(false);
  const [view, setView] = useQueryState(
    "view",
    parseAsStringLiteral(VIEWS)
      .withDefault("requests")
      .withOptions({ history: "replace", scroll: false }),
  );

  return (
    <div className="flex size-full flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="page-title">{t("title")}</h1>
            <p className="page-description max-w-3xl">{t("description")}</p>
          </div>
          {hasPermission("media.upload") ? (
            <Button className="shrink-0" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              {t("newRequest")}
            </Button>
          ) : null}
        </div>
        <Tabs
          value={view}
          onValueChange={(value) =>
            void setView(value === "terms" ? "terms" : null)
          }
        >
          <TabsList>
            <TabsTrigger value="requests">{t("tabs.requests")}</TabsTrigger>
            <TabsTrigger value="terms">{t("tabs.terms")}</TabsTrigger>
          </TabsList>
          <TabsContent value="requests" className="pt-4">
            <RequestsList organizationId={organizationId} />
          </TabsContent>
          <TabsContent value="terms" className="pt-4">
            <TermsPanel organizationId={organizationId} />
          </TabsContent>
        </Tabs>
      </div>
      {creating ? (
        <NewRequestDialog
          organizationId={organizationId}
          onClose={() => setCreating(false)}
        />
      ) : null}
    </div>
  );
}
