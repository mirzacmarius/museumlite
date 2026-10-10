"use client";

import { SidebarProvider } from "@v1/ui/sidebar";
import { CaseTaskPanel } from "@/components/case-tasks/case-task-panel";
import { RecordRecoveryState } from "@/components/record-recovery-state";
import { useRecordViewState } from "@/hooks/use-return-path";
import { useScopedI18n } from "@/locales/client";
import { LoanContextSidebar } from "./_components/loan-context-sidebar";
import { LoanDetailHeader } from "./_components/loan-detail/loan-detail-header";
import { LoanDetailHero } from "./_components/loan-detail/loan-detail-hero";
import { LoanDetailTabs } from "./_components/loan-detail/loan-detail-tabs";
import { LoanPrintManifestDialog } from "./_components/loan-detail/loan-print-manifest-dialog";
import { useLoanDetailPage } from "./_components/loan-detail/use-loan-detail-page";

export default function LoanDetailPage() {
  const tLoans = useScopedI18n("loans");
  const common = useScopedI18n("common");
  const {
    locale,
    currentOrganizationId,
    loan,
    documents,
    organization,
    activeTab,
    setActiveTab,
    isPrintModalOpen,
    setIsPrintModalOpen,
    copied,
    handleCopyId,
  } = useLoanDetailPage();
  const viewState = useRecordViewState(loan);

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">
          {tLoans("selectOrg.description")}
        </p>
      </div>
    );
  }

  if (loan === undefined) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{common("loading")}</p>
      </div>
    );
  }

  if (loan === null) {
    return (
      <RecordRecoveryState
        kind={viewState === "removed" ? "removed" : "missing"}
        list="loans"
      />
    );
  }

  return (
    <>
      <SidebarProvider
        style={{ "--sidebar-width": "20rem" } as React.CSSProperties}
        className="flex h-full min-h-0 w-full print:hidden"
      >
        <main className="z-10 flex min-h-0 min-w-0 flex-1 flex-col bg-background">
          <LoanDetailHeader
            loan={loan}
            organizationName={organization?.name ?? "Museum"}
            onOpenPrint={() => setIsPrintModalOpen(true)}
          />

          <div className="flex-1 overflow-y-auto scroll-smooth">
            <LoanDetailHero
              loan={loan}
              locale={locale}
              copied={copied}
              onCopyId={() => handleCopyId(loan.loanNumber)}
            />
            <LoanDetailTabs
              loan={loan}
              documents={documents ?? []}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
            <div className="mx-auto max-w-7xl px-4 pb-10 sm:px-8">
              <CaseTaskPanel
                organizationId={loan.organizationId}
                caseType="loan"
                caseId={loan._id}
              />
            </div>
          </div>
        </main>

        <LoanContextSidebar loan={loan} />
      </SidebarProvider>

      <LoanPrintManifestDialog
        loan={loan}
        locale={locale}
        open={isPrintModalOpen}
        onOpenChange={setIsPrintModalOpen}
      />
    </>
  );
}
