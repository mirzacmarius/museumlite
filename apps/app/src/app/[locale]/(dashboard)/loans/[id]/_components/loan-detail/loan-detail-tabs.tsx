"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import { useI18n, useScopedI18n } from "@/locales/client";
import { ActivityTab } from "../activity-tab";
import { ObjectsTab } from "../objects-tab";
import { OverviewTab } from "../overview-tab";
import type { Loan, LoanDocument } from "../types";
import { LOAN_TABS } from "./use-loan-detail-page";

type LoanTab = (typeof LOAN_TABS)[number];

interface LoanDetailTabsProps {
  loan: Loan;
  documents: LoanDocument[];
  activeTab: LoanTab;
  onTabChange: (value: LoanTab) => void;
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
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        const tab = LOAN_TABS.find((candidate) => candidate === value);
        if (tab) onTabChange(tab);
      }}
      className="w-full"
    >
      <div className="sticky top-0 z-40 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md sm:px-8">
        {/* On a phone the tabs scroll sideways inside their bar, not the page. */}
        <div className="mx-auto max-w-7xl overflow-x-auto">
          <TabsList className="h-auto w-max min-w-full justify-start gap-6 rounded-none border-b-0 bg-transparent p-0">
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
              value="activity"
              className="rounded-none border-b-2 border-transparent py-3 text-xs font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-cyan-500 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              {tActions("activityLog")}
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      <div className="mx-auto min-h-[500px] max-w-7xl p-4 sm:p-8">
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
        <TabsContent value="activity" className="mt-0 focus-visible:ring-0">
          <ActivityTab organizationId={loan.organizationId} loanId={loan._id} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
