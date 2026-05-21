"use client";

import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { AccountCombobox } from "@/components/account-combobox";
import { useScopedI18n } from "@/locales/client";
import type { NewLoanFormData } from "./types";

interface NewLoanBasicsSectionProps {
  organizationId: string;
  formData: NewLoanFormData;
  onFormDataChange: (
    updater: (prev: NewLoanFormData) => NewLoanFormData,
  ) => void;
}

export function NewLoanBasicsSection({
  organizationId,
  formData,
  onFormDataChange,
}: NewLoanBasicsSectionProps) {
  const tActions = useScopedI18n("loans.actions");
  const t = useScopedI18n("loans");

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
        <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] text-foreground">
          1
        </span>
        Basic Information
      </h2>

      <div className="grid gap-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="type">Loan Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value: "incoming" | "outgoing") =>
                onFormDataChange((prev) => ({ ...prev, type: value }))
              }
            >
              <SelectTrigger id="type" className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="incoming">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full bg-purple-500" />
                    {tActions("incomingLoan")}
                  </div>
                </SelectItem>
                <SelectItem value="outgoing">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full bg-cyan-500" />
                    {tActions("outgoingLoan")}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="loanNumber">
              {tActions("loanNumberLabel")}{" "}
              <span className="text-muted-foreground font-normal text-xs">
                {tActions("optional")}
              </span>
            </Label>
            <Input
              id="loanNumber"
              value={formData.loanNumber}
              onChange={(e) =>
                onFormDataChange((prev) => ({
                  ...prev,
                  loanNumber: e.target.value,
                }))
              }
              placeholder={t("placeholders.loanNumber")}
              className="bg-background font-mono placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        <div className="space-y-4 rounded-lg bg-secondary/30 border border-border/50 p-4">
          <div>
            <Label className="mb-2 block">
              {formData.type === "incoming"
                ? tActions("lenderName")
                : tActions("borrowerName")}
            </Label>
            <AccountCombobox
              organizationId={organizationId}
              value={formData.accountId}
              onValueChange={(accountId) =>
                onFormDataChange((prev) => ({ ...prev, accountId }))
              }
              onAccountSelect={(account) => {
                if (account) {
                  onFormDataChange((prev) => ({
                    ...prev,
                    accountId: account._id,
                    lenderBorrowerName: account.businessName ?? "",
                    lenderBorrowerContact: [
                      account.contactPerson,
                      account.email,
                      account.phone,
                    ]
                      .filter(Boolean)
                      .join(", "),
                  }));
                }
              }}
              placeholder={t("placeholders.lenderBorrower")}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lenderBorrowerName" className="text-xs">
                {tActions("nameInstitution")}{" "}
                <span className="text-destructive">{tActions("required")}</span>
              </Label>
              <Input
                id="lenderBorrowerName"
                value={formData.lenderBorrowerName}
                onChange={(e) =>
                  onFormDataChange((prev) => ({
                    ...prev,
                    lenderBorrowerName: e.target.value,
                  }))
                }
                placeholder={t("placeholders.institutionName")}
                required
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lenderBorrowerContact" className="text-xs">
                {tActions("contactInformation")}
              </Label>
              <Input
                id="lenderBorrowerContact"
                value={formData.lenderBorrowerContact}
                onChange={(e) =>
                  onFormDataChange((prev) => ({
                    ...prev,
                    lenderBorrowerContact: e.target.value,
                  }))
                }
                placeholder={t("placeholders.contactDetails")}
                className="bg-background"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
