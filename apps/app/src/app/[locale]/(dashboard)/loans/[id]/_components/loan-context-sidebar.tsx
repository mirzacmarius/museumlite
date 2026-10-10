"use client";

import { Sidebar, SidebarContent, SidebarHeader } from "@v1/ui/sidebar";
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
        <TransportStatus loanId={loan._id} />
      </SidebarContent>
    </Sidebar>
  );
}
