"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useScopedI18n } from "@/locales/client";
import { CheckPanel } from "./check-panel";
import { FindingsList } from "./findings-list";
import { ProfilesPanel } from "./profiles-panel";

const VIEWS = ["findings", "profiles"] as const;

export function QualityPageClient({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("documentationQuality");
  const [view, setView] = useQueryState(
    "view",
    parseAsStringLiteral(VIEWS)
      .withDefault("findings")
      .withOptions({ history: "replace", scroll: false }),
  );

  return (
    <div className="flex size-full flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-2">
          <h1 className="page-title">{t("title")}</h1>
          <p className="page-description max-w-3xl">{t("description")}</p>
        </div>
        <CheckPanel organizationId={organizationId} />
        <Tabs
          value={view}
          onValueChange={(value) =>
            void setView(value === "profiles" ? "profiles" : null)
          }
        >
          <TabsList>
            <TabsTrigger value="findings">{t("tabs.findings")}</TabsTrigger>
            <TabsTrigger value="profiles">{t("tabs.profiles")}</TabsTrigger>
          </TabsList>
          <TabsContent value="findings" className="pt-4">
            <FindingsList organizationId={organizationId} />
          </TabsContent>
          <TabsContent value="profiles" className="pt-4">
            <ProfilesPanel organizationId={organizationId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
