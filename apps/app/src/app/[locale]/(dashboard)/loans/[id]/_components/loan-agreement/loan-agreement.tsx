"use client";

import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@v1/ui/dialog";
import { FileText, Mail, Printer } from "lucide-react";
import { useState } from "react";
import { useScopedI18n } from "@/locales/client";
import { LoanAgreementDocument } from "./loan-agreement-document";
import type { LoanAgreementProps } from "./types";
import { useLoanAgreementActions } from "./use-loan-agreement-actions";

export function LoanAgreement({
  loan,
  items,
  organizationName,
}: LoanAgreementProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const tActions = useScopedI18n("loans.actions");
  const { printRef, locale, formatLoanDate, handlePrint, handleEmail } =
    useLoanAgreementActions({ loan, items, organizationName });

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="mr-2 size-4" />
          {tActions("loanAgreement")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tActions("loanAgreement")}</DialogTitle>
          <DialogDescription>
            {tActions("loanAgreementPreview")}
          </DialogDescription>
        </DialogHeader>

        <LoanAgreementDocument
          printRef={printRef}
          loan={loan}
          items={items}
          organizationName={organizationName}
          locale={locale}
          formatLoanDate={formatLoanDate}
        />

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setDialogOpen(false)}>
            Close
          </Button>
          <Button variant="outline" onClick={handleEmail}>
            <Mail className="mr-2 size-4" />
            Send via Email
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="mr-2 size-4" />
            Print Agreement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
