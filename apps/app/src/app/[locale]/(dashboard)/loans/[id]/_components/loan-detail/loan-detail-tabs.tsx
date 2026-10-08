"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import { useI18n, useScopedI18n } from "@/locales/client";
import { ActivityTab } from "../activity-tab";
import { FacilityTab } from "../facility-tab";
import { LogisticsTab } from "../logistics-tab";
import { ObjectsTab } from "../objects-tab";
import { OverviewTab } from "../overview-tab";
import type { Loan, LoanDocument } from "../types";

interface LoanDetailTabsProps {
  loan: Loan;
  documents: LoanDocument[];
  activeTab: string;
  onTabChange: (value: string) => void;
}

export function LoanDetailTabs({
  loan,
  documents,
  activeTab,
  onTabChange,
}: LoanDetailTabsProps) {
  const tRoot = useI18n();
  const tActions = useScopedI18n("loans.actions");

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <div className="sticky top-0 z-40 border-b border-border/60 bg-background/80 px-8 backdrop-blur-md">
        <div className="mx-auto max-w-7xl">
          <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-b-0 bg-transparent p-0">
            <TabsTrigger
              value="overview"
              className="rounded-none border-b-2 border-transparent py-3 text-xs font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-cyan-500 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              {tRoot("untranslatedRecords.loans.detail.overviewFor")}{" "}
              {loan.type === "outgoing"
                ? tActions("borrower")
                : tActions("lenderLabel")}
            </TabsTrigger>
            <TabsTrigger
              value="objects"
              className="rounded-none border-b-2 border-transparent py-3 text-xs font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-cyan-500 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              {tRoot("loans.actions.objectsTab", {
                count: loan.items.length,
              })}
            </TabsTrigger>
            <TabsTrigger
              value="facility"
              className="rounded-none border-b-2 border-transparent py-3 text-xs font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-cyan-500 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none flex items-center gap-1.5"
            >
              {tActions("facilityTab")}
              <span className="size-1.5 rounded-full bg-amber-500" />
            </TabsTrigger>
            <TabsTrigger
              value="logistics"
              className="rounded-none border-b-2 border-transparent py-3 text-xs font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-cyan-500 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              {tActions("logisticsTab")}
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="rounded-none border-b-2 border-transparent py-3 text-xs font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-cyan-500 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              {tActions("activityLog")}
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      <div className="p-8 max-w-7xl mx-auto min-h-[500px]">
        <TabsContent
          value="overview"
          className="space-y-8 mt-0 focus-visible:ring-0"
        >
          <OverviewTab loan={loan} documents={documents} />
        </TabsContent>
        <TabsContent
          value="objects"
          className="space-y-6 mt-0 focus-visible:ring-0"
        >
          <ObjectsTab loan={loan} />
        </TabsContent>
        <TabsContent
          value="facility"
          className="space-y-6 mt-0 focus-visible:ring-0"
        >
          <FacilityTab />
        </TabsContent>
        <TabsContent
          value="logistics"
          className="space-y-6 mt-0 focus-visible:ring-0"
        >
          <LogisticsTab />
        </TabsContent>
        <TabsContent value="activity" className="mt-0 focus-visible:ring-0">
          <ActivityTab organizationId={loan.organizationId} loanId={loan._id} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
