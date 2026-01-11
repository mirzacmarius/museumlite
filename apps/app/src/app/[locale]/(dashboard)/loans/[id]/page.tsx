"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@v1/ui/avatar";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarProvider,
  SidebarSeparator,
} from "@v1/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import { cn } from "@v1/ui/utils";
import { useQuery } from "convex/react";
import { LoanApprovalWorkflow } from "./_components/loan-approval-workflow";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  Banknote,
  CalendarRange,
  ChevronRight,
  ChevronsUpDown,
  Circle,
  Clock,
  Copy,
  FileText,
  LayoutGrid,
  Layers,
  Moon,
  PackageCheck,
  Printer,
  Shield,
  Sun,
  Upload,
  User,
  Check,
  Search,
  Box,
  MapPin,
  Truck,
  History,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

type LoanStatus =
  | "pending"
  | "active"
  | "dispatched"
  | "returned"
  | "cancelled";

type LoanItem = {
  _id: Id<"loanItems">;
  accessionNumber: string;
  title: string;
  conditionOut?: string;
  conditionIn?: string;
};

type WorkflowHistoryEntry = {
  step: number;
  approvedBy: Id<"users">;
  approvedByName?: string;
  approvedAt: number;
  comment?: string;
};

type Loan = {
  _id: Id<"loans">;
  loanNumber: string;
  type: "incoming" | "outgoing";
  lenderBorrowerName: string;
  lenderBorrowerContact?: string;
  startDate: number;
  endDate?: number;
  insuranceValue?: number;
  status: LoanStatus;
  workflowStep?: number;
  workflowHistory: WorkflowHistoryEntry[];
  items: LoanItem[];
};

export default function LoanDetailPage() {
  const params = useParams();
  const loanId = params.id as string;
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
          Please select an organization to view loans.
        </p>
      </div>
    );
  }

  if (loan === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (loan === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">Loan not found</p>
      </div>
    );
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(loan.loanNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <SidebarProvider
        style={{ "--sidebar-width": "20rem" } as React.CSSProperties}
        className="flex min-h-screen w-full print:hidden"
      >
        <main className="z-10 flex min-w-0 flex-1 flex-col bg-background">
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
                {loan.type === "incoming" ? "Incoming" : "Outgoing"}
              </span>
              <span className="text-muted-foreground/50">/</span>
              <span className="font-medium text-foreground">
                {loan.loanNumber}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded text-[10px] font-medium text-amber-600 dark:text-amber-500">
                <AlertCircle className="h-3 w-3" />
                Pending Facility Report Approval
              </div>
              <div className="h-4 w-px bg-border" />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Print Manifest"
                onClick={() => setIsPrintModalOpen(true)}
              >
                <Printer className="h-4 w-4" />
              </Button>
            </div>
          </header>

          {/* Main Scrollable Area */}
          <div className="flex-1 overflow-y-auto scroll-smooth">
            {/* Hero Section */}
            <div className="border-b border-border/60 bg-secondary/10 px-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                    TRUSTED
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
                        ? "Outgoing Loan"
                        : "Incoming Loan"}
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-secondary border border-border text-[11px] text-muted-foreground">
                      <span className="font-medium">International</span>
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
                      {loan.type === "outgoing" ? "Borrower" : "Lender"}:{" "}
                      {loan.lenderBorrowerName}
                    </p>
                  </div>

                  {/* Metadata Row */}
                  <div className="flex items-center gap-6 pt-2">
                    <div className="flex items-center gap-2 text-xs">
                      <CalendarRange className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {new Date(loan.startDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}{" "}
                        —{" "}
                        {loan.endDate
                          ? new Date(loan.endDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "Indefinite"}
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
                          Total Value: ${loan.insuranceValue.toLocaleString()}
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
                      {loan.type === "outgoing" ? "Borrower" : "Lender"}
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
                      Facility Report
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    </TabsTrigger>
                    <TabsTrigger
                      value="logistics"
                      className="rounded-none border-b-2 border-transparent py-3 text-xs font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-cyan-500 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                    >
                      Crating & Shipping
                    </TabsTrigger>
                    <TabsTrigger
                      value="activity"
                      className="rounded-none border-b-2 border-transparent py-3 text-xs font-medium text-muted-foreground hover:text-foreground data-[state=active]:border-cyan-500 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                    >
                      Activity Log
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
                  <p>Date: {new Date().toLocaleDateString()}</p>
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

type LoanDocument = {
  _id: Id<"loanDocuments">;
  storageId: Id<"_storage">;
  documentType: "agreement" | "insurance" | "other";
  fileName: string;
  url: string | null;
  uploadedBy: Id<"users">;
  uploadedAt: number;
  uploaderName?: string;
};

function OverviewTab({
  loan,
  documents,
}: {
  loan: Loan;
  documents: LoanDocument[];
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Left: Approval Pipeline */}
      <div className="col-span-2 space-y-6">
        {/* Loan Workflow Actions */}
        <LoanApprovalWorkflow
          key={loan._id}
          loanId={loan._id}
          loanStatus={loan.status}
        />
        {/* Status Flow */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-6">
            Approval Workflow
          </h3>
          <div className="relative">
            <div className="absolute top-4 left-0 w-full h-0.5 bg-secondary z-0" />
            <div className="relative z-10 grid grid-cols-5 gap-4">
              {/* Step 1 */}
              <div className="flex flex-col gap-2">
                <div className="w-8 h-8 rounded-full bg-cyan-600 border-4 border-background flex items-center justify-center text-white z-10 shadow-lg shadow-cyan-900/20">
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                </div>
                <div className="pr-4">
                  <p className="text-xs font-semibold text-foreground">
                    Request
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Rec:{" "}
                    {new Date(loan.startDate).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
              {/* Step 2 */}
              <div className="flex flex-col gap-2">
                <div className="w-8 h-8 rounded-full bg-cyan-600 border-4 border-background flex items-center justify-center text-white z-10 shadow-lg shadow-cyan-900/20">
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                </div>
                <div className="pr-4">
                  <p className="text-xs font-semibold text-foreground">
                    Curatorial
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    App:{" "}
                    {new Date(loan.startDate).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
              {/* Step 3 */}
              <div className="flex flex-col gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-500 border-4 border-background flex items-center justify-center text-white z-10 shadow-lg shadow-amber-900/20 animate-pulse">
                  <span className="text-[10px] font-bold">3</span>
                </div>
                <div className="pr-4">
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-500">
                    Facilities
                  </p>
                  <p className="text-[10px] text-muted-foreground">Reviewing</p>
                </div>
              </div>
              {/* Step 4 */}
              <div className="flex flex-col gap-2">
                <div className="w-8 h-8 rounded-full bg-secondary border-4 border-background flex items-center justify-center text-muted-foreground z-10">
                  <span className="text-[10px] font-bold">4</span>
                </div>
                <div className="pr-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    Conservation
                  </p>
                  <p className="text-[10px] text-muted-foreground">Pending</p>
                </div>
              </div>
              {/* Step 5 */}
              <div className="flex flex-col gap-2">
                <div className="w-8 h-8 rounded-full bg-secondary border-4 border-background flex items-center justify-center text-muted-foreground z-10">
                  <span className="text-[10px] font-bold">5</span>
                </div>
                <div className="pr-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    Dispatch
                  </p>
                  <p className="text-[10px] text-muted-foreground">Locked</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">
              Borrower Details
            </h3>
            <span className="text-xs font-mono text-muted-foreground">
              MOMA-NY-001
            </span>
          </div>
          <div className="grid grid-cols-2 gap-y-6 gap-x-12">
            <div>
              <label className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide">
                Institution
              </label>
              <p className="text-sm text-foreground mt-1">
                {loan.lenderBorrowerName}
              </p>
              <p className="text-xs text-muted-foreground">
                {loan.lenderBorrowerContact}
              </p>
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide">
                Exhibition Space
              </label>
              <p className="text-sm text-foreground mt-1">
                The Robert B. Menschel Galleries
              </p>
              <p className="text-xs text-muted-foreground">
                Floor 4, Wing West (Environment controlled)
              </p>
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide">
                Loan Agreement
              </label>
              <div className="flex items-center gap-2 mt-1">
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-900">
                  <Check className="w-3 h-3" />
                  Countersigned
                </span>
                <span className="text-xs text-muted-foreground">
                  on {new Date(loan.startDate).toLocaleDateString()}
                </span>
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wide">
                Costs
              </label>
              <p className="text-sm text-foreground mt-1">
                All costs to be borne by Borrower
              </p>
              <p className="text-xs text-muted-foreground">
                Wall-to-wall insurance coverage active
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Key Docs */}
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            Documents ({documents.length})
          </h3>
          <div className="space-y-2">
            {documents.map((doc) => {
              const iconClass =
                doc.documentType === "agreement"
                  ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                  : doc.documentType === "insurance"
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400";
              const Icon = doc.documentType === "insurance" ? Shield : FileText;

              return (
                <a
                  key={doc._id}
                  href={doc.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center gap-3 rounded p-2 text-left hover:bg-secondary transition-colors group"
                >
                  <div
                    className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${iconClass}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {doc.fileName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {doc.documentType.charAt(0).toUpperCase() +
                        doc.documentType.slice(1)}{" "}
                      •{" "}
                      {doc.uploaderName
                        ? `Uploaded by ${doc.uploaderName}`
                        : new Date(doc.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                </a>
              );
            })}
            {documents.length === 0 && (
              <p className="text-xs text-muted-foreground italic py-2">
                No documents uploaded yet.
              </p>
            )}
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded p-2 text-left hover:bg-secondary transition-colors group opacity-60"
            >
              <div className="w-8 h-8 rounded bg-secondary text-muted-foreground flex items-center justify-center shrink-0 border border-dashed border-border">
                <Upload className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground italic">
                  Upload Facility Report...
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ObjectsTab({ loan }: { loan: Loan }) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-muted-foreground group-focus-within:text-cyan-500 transition-colors" />
            </div>
            <input
              type="text"
              className="bg-background border border-border text-foreground text-xs rounded-lg block w-64 pl-10 p-2 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
              placeholder="Search accession number..."
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="default" size="sm" className="h-8 text-xs">
            Add Object
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Mock Cards - Replace with real iteration when images are available */}
        {loan.items.length > 0 ? (
          loan.items.map((item) => (
            <div
              key={item.accessionNumber}
              className="bg-card border border-border rounded-xl overflow-hidden hover:border-foreground/20 transition-colors group"
            >
              <div className="h-40 bg-secondary relative overflow-hidden flex items-center justify-center">
                <Box className="w-10 h-10 text-muted-foreground/30" />
                <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 backdrop-blur-md rounded text-[10px] font-mono text-white">
                  {item.accessionNumber}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-foreground truncate">
                  {item.title}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Artist Unknown • Oil on canvas
                </p>

                <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground font-medium">
                      Condition Out
                    </p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{" "}
                      {item.conditionOut || "Stable"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground font-medium">
                      Status
                    </p>
                    {item.conditionIn ? (
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />{" "}
                        Returned
                      </p>
                    ) : (
                      <p className="text-xs text-amber-600 dark:text-amber-500 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{" "}
                        On Loan
                      </p>
                    )}
                  </div>
                </div>
                {item.conditionIn && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <p className="text-[10px] uppercase text-muted-foreground font-medium">
                      Condition In
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.conditionIn}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-muted-foreground text-sm">
            No objects in this loan.
          </div>
        )}
      </div>
    </>
  );
}

function FacilityTab() {
  return (
    <div className="space-y-6">
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 flex gap-4 items-start">
        <AlertCircle className="shrink-0 text-amber-600 dark:text-amber-500 w-5 h-5 mt-0.5" />
        <div>
          <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-500">
            Review Required
          </h4>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
            The environmental readings from MoMA Gallery 4 show slight humidity
            fluctuations (45% ± 4%). Conservation approval is pending.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto text-xs bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-100 border-transparent hover:bg-amber-200 dark:hover:bg-amber-800"
        >
          Review Logs
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Environment Stats */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
            <LayoutGrid className="w-3.5 h-3.5 text-cyan-500" />
            Climate Control (Gallery 4)
          </h3>
          <div className="space-y-6">
            {/* Temperature */}
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-muted-foreground">Temperature</span>
                <span className="text-foreground font-mono">20.5°C</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-[60%] rounded-full" />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1 font-mono">
                <span>15°C</span>
                <span>Target: 21°C</span>
                <span>25°C</span>
              </div>
            </div>

            {/* Humidity */}
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-muted-foreground">Relative Humidity</span>
                <span className="text-amber-600 dark:text-amber-500 font-mono">
                  49%
                </span>
              </div>
              <div className="relative pt-1">
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 w-[70%] rounded-full" />
                </div>
                {/* Markers for safe zone */}
                <div className="absolute top-0 bottom-0 left-[45%] w-[10%] bg-emerald-500/10 border-x border-emerald-500/30" />
              </div>
              <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-1 text-right">
                Deviating slightly (+4%)
              </p>
            </div>

            {/* Lux */}
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-muted-foreground">Light Level (Lux)</span>
                <span className="text-foreground font-mono">45 lx</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-[20%] rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Security Info */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-red-500" />
            Security & Access
          </h3>
          <ul className="space-y-4">
            <li className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">24/7 Guard Presence</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                Confirmed
              </span>
            </li>
            <li className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">CCTV Coverage</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                100% Gallery 4
              </span>
            </li>
            <li className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Fire Suppression</span>
              <span className="text-foreground">Dry Pipe / Pre-action</span>
            </li>
            <li className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Display Cases</span>
              <span className="text-foreground">Acrylic, Alarmed</span>
            </li>
          </ul>
          <div className="mt-6 p-3 bg-secondary rounded border border-border">
            <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">
              Registrar Note
            </p>
            <p className="text-xs italic text-muted-foreground">
              "MoMA has retrofitted Gallery 4 with new vibration sensors in Q3
              2023. Approved for high-value loans."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogisticsTab() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Crate List */}
      <div className="lg:col-span-2 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Crating Plan
        </h3>
        {/* Crate 1 */}
        <div className="bg-card border border-border rounded-xl p-4 flex gap-4 items-center">
          <div className="w-16 h-16 bg-secondary rounded border border-border flex flex-col items-center justify-center shrink-0">
            <Box className="w-5 h-5 text-muted-foreground mb-1" />
            <span className="text-[10px] font-mono text-muted-foreground">
              #01
            </span>
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start mb-1">
              <h4 className="text-sm font-semibold text-foreground">
                Standard Painting Crate
              </h4>
              <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded border border-border">
                120x140x30 cm
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Contains: Pollock (NM.1952.001)
            </p>
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5" /> Shock Sensors
              </span>
              <span className="flex items-center gap-1">
                <Box className="w-2.5 h-2.5" /> Tyvek Lined
              </span>
            </div>
          </div>
        </div>
        {/* Crate 2 */}
        <div className="bg-card border border-border rounded-xl p-4 flex gap-4 items-center opacity-70">
          <div className="w-16 h-16 bg-secondary rounded border border-border flex flex-col items-center justify-center shrink-0 border-dashed">
            <span className="text-[10px] font-mono text-muted-foreground">
              #02
            </span>
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start mb-1">
              <h4 className="text-sm font-semibold text-foreground">
                Slotted Travel Frame
              </h4>
              <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded border border-border">
                Pending Size
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Contains: Rothko (NM.1955.084) + 2 others
            </p>
          </div>
          <button
            type="button"
            className="text-xs font-medium text-cyan-600 dark:text-cyan-500 hover:underline"
          >
            Configure
          </button>
        </div>
      </div>

      {/* Transport Agent */}
      <div className="bg-secondary/50 border border-border rounded-xl p-6">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          Transport Agent
        </h3>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-background rounded-lg flex items-center justify-center shadow-sm">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Dietl International
            </p>
            <p className="text-[10px] text-muted-foreground">
              Fine Art Shipping
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between text-xs border-b border-border pb-2">
            <span className="text-muted-foreground">Service Level</span>
            <span className="text-foreground">Tarmac Supervision</span>
          </div>
          <div className="flex justify-between text-xs border-b border-border pb-2">
            <span className="text-muted-foreground">Route</span>
            <span className="text-foreground">JFK &gt; LHR</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Courier</span>
            <span className="text-foreground">Elena Fisher (NM)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityTab({
  workflowHistory,
}: {
  workflowHistory: WorkflowHistoryEntry[];
}) {
  const getStepLabel = (step: number, comment?: string) => {
    if (comment) return comment;
    switch (step) {
      case 0:
        return "Loan created";
      case 1:
        return "Submitted for approval";
      case 2:
        return "Curatorial review completed";
      case 3:
        return "Facilities review completed";
      case 4:
        return "Conservation review completed";
      case 5:
        return "Ready for dispatch";
      default:
        return `Step ${step} completed`;
    }
  };

  const sortedHistory = [...workflowHistory].sort(
    (a, b) => b.approvedAt - a.approvedAt,
  );

  if (sortedHistory.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No activity recorded yet.
      </div>
    );
  }

  return (
    <div className="relative pl-6 border-l border-border space-y-8">
      {sortedHistory.map((entry, index) => (
        <div key={`${entry.step}-${entry.approvedAt}`} className="relative">
          <div
            className={`absolute -left-[29px] top-0 w-3 h-3 rounded-full border-2 border-background ${
              index === 0 ? "bg-cyan-500" : "bg-secondary"
            }`}
          />
          <p className="text-xs text-muted-foreground mb-1">
            {new Date(entry.approvedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}{" "}
            {new Date(entry.approvedAt).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <p className="text-sm text-foreground">
            {getStepLabel(entry.step, entry.comment)}
            {entry.approvedByName && (
              <span className="text-muted-foreground">
                {" "}
                by {entry.approvedByName}
              </span>
            )}
          </p>
        </div>
      ))}
    </div>
  );
}

function LoanContextSidebar({ loan }: { loan: Loan }) {
  return (
    <Sidebar
      side="right"
      variant="sidebar"
      collapsible="none"
      className="hidden w-80 shrink-0 border-l border-border/60 bg-background 2xl:flex"
    >
      <SidebarHeader className="border-b border-border/60 p-4">
        <h3 className="text-xs font-semibold text-foreground mb-1">
          Borrower Context
        </h3>
        <p className="text-[10px] text-muted-foreground">
          {loan.lenderBorrowerName}
        </p>
      </SidebarHeader>

      <SidebarContent className="p-4 space-y-6">
        {/* Relationship Score */}
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block mb-3">
            Relationship Status
          </span>
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 p-3 rounded-lg flex items-center gap-3">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              A+
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-100">
                Preferred Partner
              </p>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-500">
                0 Incidents in 15 years
              </p>
            </div>
          </div>
        </div>

        <SidebarSeparator />

        {/* Contact */}
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block mb-3">
            Registrar Contact
          </span>
          <div className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border shadow-sm">
            <div className="w-8 h-8 rounded-full bg-secondary text-muted-foreground flex items-center justify-center text-xs font-bold">
              JD
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">
                James Davis
              </p>
              <p className="text-[10px] text-muted-foreground">
                Senior Registrar
              </p>
            </div>
          </div>
        </div>

        <SidebarSeparator />

        {/* Past Loans */}
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block mb-3">
            Loan History
          </span>
          <div className="space-y-2">
            <div className="p-2 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer group">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold text-muted-foreground group-hover:text-foreground">
                  2021
                </span>
                <span className="px-1.5 py-0.5 rounded-full bg-secondary text-[9px] text-muted-foreground">
                  Returned
                </span>
              </div>
              <p className="text-xs font-medium text-foreground">
                Cézanne Drawing
              </p>
            </div>
            <div className="p-2 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer group">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold text-muted-foreground group-hover:text-foreground">
                  2019
                </span>
                <span className="px-1.5 py-0.5 rounded-full bg-secondary text-[9px] text-muted-foreground">
                  Returned
                </span>
              </div>
              <p className="text-xs font-medium text-foreground">
                Surrealism Objects
              </p>
            </div>
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
