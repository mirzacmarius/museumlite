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
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { FileText, Mail, Printer } from "lucide-react";
import { useState } from "react";
import { useI18n, useScopedI18n } from "@/locales/client";
import { LoanAgreementDocument } from "./loan-agreement-document";
import type { LoanAgreementProps } from "./types";
import { useLoanAgreementActions } from "./use-loan-agreement-actions";
import {
  STANDARD_AGREEMENT,
  useLoanAgreementTemplate,
} from "./use-loan-agreement-template";

function LoanAgreementPreview({
  loanId,
  loan,
  items,
  organizationName,
  onClose,
}: LoanAgreementProps & { onClose: () => void }) {
  const tRoot = useI18n();
  const t = useScopedI18n("loanAgreementTemplates");
  const { printRef, handlePrint, handleEmail } = useLoanAgreementActions({
    loan,
    items,
    organizationName,
  });
  const agreement = useLoanAgreementTemplate({
    loanId,
    loan,
    items,
    organizationName,
  });

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Label htmlFor="loan-agreement-template">
          {t("agreement.template")}
        </Label>
        <Select
          value={agreement.selectedValue}
          onValueChange={agreement.selectTemplate}
          disabled={agreement.isLoading}
        >
          <SelectTrigger id="loan-agreement-template" className="sm:w-80">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {agreement.templates.map((template) => (
              <SelectItem key={template._id} value={template._id}>
                {template.name}
              </SelectItem>
            ))}
            <SelectItem value={STANDARD_AGREEMENT}>
              {t("standardAgreement")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {agreement.isLoading ? (
        <p className="text-sm text-muted-foreground">
          {tRoot("common.loading")}
        </p>
      ) : (
        <LoanAgreementDocument
          printRef={printRef}
          loan={loan}
          organizationName={organizationName}
          language={agreement.language}
          sections={agreement.sections}
        />
      )}

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onClose}>
          {tRoot("deaccessions.actions.close")}
        </Button>
        <Button variant="outline" onClick={handleEmail}>
          <Mail className="mr-2 size-4" />
          {tRoot("untranslatedRecords.loans.agreement.sendEmail")}
        </Button>
        <Button onClick={handlePrint} disabled={agreement.isLoading}>
          <Printer className="mr-2 size-4" />
          {tRoot("untranslatedRecords.loans.agreement.printAgreement")}
        </Button>
      </DialogFooter>
    </>
  );
}

export function LoanAgreement(props: LoanAgreementProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const tActions = useScopedI18n("loans.actions");

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
        <LoanAgreementPreview {...props} onClose={() => setDialogOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
