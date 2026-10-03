"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarSeparator,
} from "@v1/ui/sidebar";
import { useI18n } from "@/locales/client";
import { TransportStatus } from "./transport-status";
import type { Loan } from "./types";

interface LoanContextSidebarProps {
  loan: Loan;
}

export function LoanContextSidebar({ loan }: LoanContextSidebarProps) {
  const tRoot = useI18n();
  return (
    <Sidebar
      side="right"
      variant="sidebar"
      collapsible="none"
      className="hidden w-80 shrink-0 border-l border-border/60 bg-background 2xl:flex"
    >
      <SidebarHeader className="border-b border-border/60 p-4">
        <h3 className="text-xs font-semibold text-foreground mb-1">
          {tRoot("loans.actions.borrowerContext")}
        </h3>
        <p className="text-[10px] text-muted-foreground">
          {loan.lenderBorrowerName}
        </p>
      </SidebarHeader>

      <SidebarContent className="p-4 space-y-6">
        {/* Relationship Score */}
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block mb-3">
            {tRoot("loans.actions.relationshipStatus")}
          </span>
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 p-3 rounded-lg flex items-center gap-3">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              A+
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-100">
                {tRoot("loans.actions.preferredPartner")}
              </p>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-500">
                {tRoot("untranslatedRecords.loans.context.incidents", {
                  count: 0,
                  years: 15,
                })}
              </p>
            </div>
          </div>
        </div>

        <SidebarSeparator />

        {/* Contact */}
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block mb-3">
            {tRoot("loans.actions.registrarContact")}
          </span>
          <div className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border shadow-sm">
            <div className="size-8 rounded-full bg-secondary text-muted-foreground flex items-center justify-center text-xs font-bold">
              JD
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">
                James Davis
              </p>
              <p className="text-[10px] text-muted-foreground">
                {tRoot("loans.actions.seniorRegistrar")}
              </p>
            </div>
          </div>
        </div>

        <SidebarSeparator />

        {/* Transport Status */}
        <TransportStatus loanId={loan._id} />

        <SidebarSeparator />

        {/* Past Loans */}
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block mb-3">
            {tRoot("untranslatedRecords.loans.items.loanHistory")}
          </span>
          <div className="space-y-2">
            <div className="p-2 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer group">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold text-muted-foreground group-hover:text-foreground">
                  2021
                </span>
                <span className="px-1.5 py-0.5 rounded-full bg-secondary text-[9px] text-muted-foreground">
                  {tRoot("loans.status.returned")}
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
                  {tRoot("loans.status.returned")}
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
