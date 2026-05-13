"use client";

import { useOrganization } from "@/components/organization-provider";
import { writeTextToClipboard } from "@/lib/clipboard";
import { formatDate } from "@/lib/format-date";
import { formatCurrency } from "@/lib/format-number";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { SidebarProvider } from "@v1/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  CalendarRange,
  Check,
  Copy,
  Layers,
  Printer,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  ActivityTab,
  FacilityTab,
  type Loan,
  LoanAgreement,
  LoanContextSidebar,
  LogisticsTab,
  ObjectsTab,
  OverviewTab,
} from "./_components";

export default function LoanDetailPage() {
  const tActions = useScopedI18n("loans.actions");
  const tLoans = useScopedI18n("loans");
  const params = useParams();
  const loanId = params.id as string;
  const locale = useCurrentLocale();
  const common = useScopedI18n("common");
  const { currentOrganizationId } = useOrganization();
  const [activeTab, setActiveTab] = useState("overview");
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const loan = useQuery(
    api.loans.get,
    loanId ? { loanId: loanId as Id<"loans"> } : "skip",
  ) as Loan | null | undefined;

  const documents = useQuery(
    api.loans.listLoanDocuments,
    loanId ? { loanId: loanId as Id<"loans"> } : "skip",
  );

  const organization = useQuery(
    api.organizations.get,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  if (!currentOrganizationId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          {tLoans("selectOrg.description")}
        </p>
      </div>
    );
  }

  if (loan === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">{common("loading")}</p>
      </div>
    );
  }

  if (loan === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">
          {tLoans("emptyState.noLoansFound")}
        </p>
      </div>
    );
  }

  const handleCopyId = async () => {
    const didCopy = await writeTextToClipboard(loan.loanNumber);
    if (!didCopy) {
      return;
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <SidebarProvider
        style={{ "--sidebar-width": "20rem" } as React.CSSProperties}
        className="flex h-full min-h-0 w-full print:hidden"
      >
        <main className="z-10 flex min-h-0 min-w-0 flex-1 flex-col bg-background">
          {/* Navbar */}
          <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-xs">
              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                <Link href="/loans">
                  <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                </Link>
              </Button>
              <span className="text-muted-foreground flex items-center gap-2">
                Loans
              </span>
              <span className="text-muted-foreground/50">/</span>
              <span className="text-muted-foreground">
                {loan.type === "incoming"
                  ? tActions("incoming")
                  : tActions("outgoing")}
              </span>
              <span className="text-muted-foreground/50">/</span>
              <span className="font-medium text-foreground">
                {loan.loanNumber}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded text-[10px] font-medium text-amber-600 dark:text-amber-500">
                <AlertCircle className="h-3 w-3" />
                {tActions("pendingFacilityReportApproval")}
              </div>
              <div className="h-4 w-px bg-border" />
              <LoanAgreement
                loan={{
                  loanNumber: loan.loanNumber,
                  type: loan.type,
                  lenderBorrowerName: loan.lenderBorrowerName,
                  lenderBorrowerContact: loan.lenderBorrowerContact,
                  startDate: loan.startDate,
                  endDate: loan.endDate,
                  insuranceValue: loan.insuranceValue,
                }}
                items={loan.items.map((item) => ({
                  accessionNumber: item.accessionNumber,
                  title: item.title,
                  conditionOut: item.conditionOut,
                }))}
                organizationName={organization?.name ?? "Museum"}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title={common("printManifest")}
                onClick={() => setIsPrintModalOpen(true)}
              >
                <Printer className="h-4 w-4" />
              </Button>
            </div>
          </header>

          {/* Main Scrollable Area */}
          <div className="flex-1 overflow-y-auto scroll-smooth">
            {/* Hero Section */}
            <div className="border-b border-border/60 bg-secondary/10 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mx-auto flex max-w-7xl items-start gap-8">
                <div className="shrink-0 relative group">
                  {/* Borrower Logo Mockup */}
                  <div className="w-32 h-32 rounded-xl border border-border shadow-2xl bg-background flex items-center justify-center p-2 relative overflow-hidden">
                    <div
                      className="absolute inset-0 opacity-10"
                      style={{
                        backgroundImage:
                          "radial-gradient(#6b7280 1px, transparent 1px)",
                        backgroundSize: "8px 8px",
                      }}
                    />
                    <span className="text-4xl font-bold tracking-tighter relative z-10 text-foreground">
                      {loan.lenderBorrowerName.slice(0, 4).toUpperCase()}
                    </span>
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border-2 border-background">
                    {tActions("trusted")}
                  </div>
                </div>

                <div className="flex-1 space-y-4">
                  {/* Status & Type */}
                  <div className="flex items-center flex-wrap gap-2.5">
                    <div
                      className={cn(
                        "px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-wider shadow-sm",
                        loan.type === "outgoing"
                          ? "bg-cyan-100 dark:bg-cyan-900/30 border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-400"
                          : "bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400",
                      )}
                    >
                      {loan.type === "outgoing"
                        ? tActions("outgoingLoan")
                        : tActions("incomingLoan")}
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-secondary border border-border text-[11px] text-muted-foreground">
                      <span className="font-medium">
                        {tActions("international")}
                      </span>
                    </div>

                    {/* Loan ID */}
                    <div className="flex items-center gap-1.5 text-xs text-foreground font-mono bg-background px-2 py-1 rounded border border-border shadow-sm ml-auto">
                      <span className="text-muted-foreground select-none">
                        ID:
                      </span>
                      <span>{loan.loanNumber}</span>
                      {copied ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy
                          className="h-3 w-3 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                          onClick={handleCopyId}
                        />
                      )}
                    </div>
                  </div>

                  {/* Titles */}
                  <div>
                    <h1 className="text-3xl font-semibold text-foreground tracking-tight leading-tight mb-1">
                      Loan {loan.loanNumber}
                    </h1>
                    <p className="text-muted-foreground text-sm">
                      {loan.type === "outgoing"
                        ? tActions("borrower")
                        : tActions("lenderLabel")}
                      : {loan.lenderBorrowerName}
                    </p>
                  </div>

                  {/* Metadata Row */}
                  <div className="flex items-center gap-6 pt-2">
                    <div className="flex items-center gap-2 text-xs">
                      <CalendarRange className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {formatDate(new Date(loan.startDate), locale, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}{" "}
                        —{" "}
                        {loan.endDate
                          ? formatDate(new Date(loan.endDate), locale, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : tActions("indefinite")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {loan.items.length} Objects (Paintings)
                      </span>
                    </div>
                    {loan.insuranceValue && (
                      <div className="flex items-center gap-2 text-xs">
                        <Banknote className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {tActions("totalValue")}{" "}
                          {formatCurrency(loan.insuranceValue, locale, "USD")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <div className="sticky top-0 z-40 border-b border-border/60 bg-background/80 px-8 backdrop-blur-md">
                <div className="mx-auto max-w-7xl">
                  <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-b-0 bg-transparent p-0">
                    <TabsTrigger
                      value="overview"
                      className="rounded-none border-b-2 border-transparent py-3 text-xs font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-cyan-500 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                    >
                      Overview &{" "}
                      {loan.type === "outgoing"
                        ? tActions("borrower")
                        : tActions("lenderLabel")}
                    </TabsTrigger>
                    <TabsTrigger
                      value="objects"
                      className="rounded-none border-b-2 border-transparent py-3 text-xs font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-cyan-500 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                    >
                      Objects ({loan.items.length})
                    </TabsTrigger>
                    <TabsTrigger
                      value="facility"
                      className="rounded-none border-b-2 border-transparent py-3 text-xs font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-cyan-500 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none flex items-center gap-1.5"
                    >
                      {tActions("facilityTab")}
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
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
                  <OverviewTab loan={loan} documents={documents ?? []} />
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
                <TabsContent
                  value="activity"
                  className="mt-0 focus-visible:ring-0"
                >
                  <ActivityTab workflowHistory={loan.workflowHistory} />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </main>

        <LoanContextSidebar loan={loan} />
      </SidebarProvider>

      {/* Print Modal */}
      <Dialog open={isPrintModalOpen} onOpenChange={setIsPrintModalOpen}>
        {/* [PRINT-EXEMPT] Light zinc colors intentionally used for PDF/print output */}
        <DialogContent className="max-w-[210mm] w-full h-[90vh] p-0 gap-0 overflow-hidden bg-zinc-50 dark:bg-background flex flex-col">
          <DialogHeader className="px-6 py-4 border-b border-border bg-background flex-shrink-0 flex-row items-center justify-between space-y-0">
            <DialogTitle>Print Dispatch Manifest</DialogTitle>
            <div className="flex items-center gap-3">
              <Button onClick={() => window.print()} className="h-8 text-xs">
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-zinc-100/50 dark:bg-muted/50">
            <div
              id="print-paper"
              className="bg-white text-zinc-900 w-[210mm] min-h-[297mm] shadow-xl p-[15mm] space-y-8 relative mx-auto box-border"
            >
              <div className="border-b border-zinc-200 pb-6 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <div className="w-6 h-6 bg-cyan-600 rounded flex items-center justify-center text-white font-bold text-xs">
                      NM
                    </div>
                    <span className="text-[10px] uppercase tracking-widest font-semibold">
                      National Museum
                    </span>
                  </div>
                  <h1 className="text-2xl font-serif text-zinc-900 font-bold tracking-tight leading-none">
                    Outgoing Loan Manifest
                  </h1>
                  <p className="text-muted-foreground mt-2 font-mono text-sm">
                    Ref: {loan.loanNumber}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>Date: {formatDate(new Date(), locale)}</p>
                  <p>Page 1 of 4</p>
                </div>
              </div>

              <div className="bg-zinc-50 border border-zinc-100 p-4 rounded text-sm grid grid-cols-2 gap-8">
                <div>
                  <h4 className="font-bold text-zinc-900 uppercase text-[10px] tracking-wide mb-1">
                    Lender
                  </h4>
                  <p>National Museum</p>
                </div>
                <div>
                  <h4 className="font-bold text-zinc-900 uppercase text-[10px] tracking-wide mb-1">
                    Borrower (Consignee)
                  </h4>
                  <p>{loan.lenderBorrowerName}</p>
                  {loan.lenderBorrowerContact && (
                    <p className="text-muted-foreground text-xs">
                      {loan.lenderBorrowerContact}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-zinc-900 uppercase text-[10px] tracking-wide mb-4 border-b border-zinc-100 pb-1">
                  Loan Items
                </h4>
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-zinc-200">
                      <th className="py-2">Acc. No</th>
                      <th className="py-2">Object Title</th>
                      <th className="py-2 text-right">Condition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {loan.items.map((item) => (
                      <tr key={item.accessionNumber}>
                        <td className="py-2 font-mono">
                          {item.accessionNumber}
                        </td>
                        <td className="py-2">{item.title}</td>
                        <td className="py-2 text-right">
                          {item.conditionOut || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="absolute bottom-12 left-12 right-12 border-t border-zinc-200 pt-8 flex justify-between items-end">
                <div>
                  <div className="h-12 w-48 border-b border-zinc-300 mb-1" />
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                    Released By (Registrar)
                  </div>
                </div>
                <div>
                  <div className="h-12 w-48 border-b border-zinc-300 mb-1" />
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                    Received By (Shipper)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
