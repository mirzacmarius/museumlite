"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { DatePickerInput } from "@v1/ui/date-picker";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useState } from "react";
import { toast } from "sonner";
import { CurrencyInput, isCurrencyCode } from "@/components/currency-input";
import { useScopedI18n } from "@/locales/client";

export function PolicyForm({
  organizationId,
  onSubmit,
}: {
  organizationId: Id<"organizations">;
  onSubmit: (payload: {
    organizationId: Id<"organizations">;
    policyNumber: string;
    carrier: string;
    policyType: "blanket" | "scheduled" | "exhibition" | "transit" | "loan";
    coverageAmount: number;
    currency: string;
    effectiveDate: number;
    expirationDate: number;
    deductible?: number;
    premiumAmount?: number;
  }) => Promise<void>;
}) {
  const t = useScopedI18n("untranslatedDashboard.insurance");
  const tValuation = useScopedI18n("valuation");
  const [form, setForm] = useState({
    policyNumber: "",
    carrier: "",
    policyType: "blanket" as
      | "blanket"
      | "scheduled"
      | "exhibition"
      | "transit"
      | "loan",
    coverageAmount: "",
    currency: "",
    deductible: "",
    premiumAmount: "",
    effectiveDate: "",
    expirationDate: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !form.policyNumber ||
      !form.carrier ||
      !form.coverageAmount ||
      !form.effectiveDate ||
      !form.expirationDate
    ) {
      toast.error(t("requiredFieldsError"));
      return;
    }

    if (!isCurrencyCode(form.currency)) {
      toast.error(tValuation("invalidCurrency"));
      return;
    }
    const effectiveDate = Date.parse(form.effectiveDate);
    const expirationDate = Date.parse(form.expirationDate);
    if (
      Number.isNaN(effectiveDate) ||
      Number.isNaN(expirationDate) ||
      expirationDate <= effectiveDate
    ) {
      toast.error(t("validDatesError"));
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        organizationId,
        policyNumber: form.policyNumber.trim(),
        carrier: form.carrier.trim(),
        policyType: form.policyType,
        coverageAmount: Number.parseFloat(form.coverageAmount),
        currency: form.currency.trim(),
        deductible: form.deductible
          ? Number.parseFloat(form.deductible)
          : undefined,
        premiumAmount: form.premiumAmount
          ? Number.parseFloat(form.premiumAmount)
          : undefined,
        effectiveDate,
        expirationDate,
      });
      setForm({
        policyNumber: "",
        carrier: "",
        policyType: "blanket",
        coverageAmount: "",
        currency: "",
        deductible: "",
        premiumAmount: "",
        effectiveDate: "",
        expirationDate: "",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="policyNumber">{t("policyNumberRequiredLabel")}</Label>
          <Input
            id="policyNumber"
            value={form.policyNumber}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, policyNumber: event.target.value }))
            }
            placeholder={t("policyNumberPlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="carrier">{t("carrierRequiredLabel")}</Label>
          <Input
            id="carrier"
            value={form.carrier}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, carrier: event.target.value }))
            }
            placeholder={t("carrierPlaceholder")}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("policyTypeRequiredLabel")}</Label>
          <Select
            value={form.policyType}
            onValueChange={(value) =>
              setForm((prev) => ({
                ...prev,
                policyType: value as typeof form.policyType,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="blanket">{t("policyTypeBlanket")}</SelectItem>
              <SelectItem value="scheduled">
                {t("policyTypeScheduled")}
              </SelectItem>
              <SelectItem value="exhibition">
                {t("policyTypeExhibition")}
              </SelectItem>
              <SelectItem value="transit">{t("policyTypeTransit")}</SelectItem>
              <SelectItem value="loan">{t("policyTypeLoan")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="coverageAmount">
            {t("coverageAmountRequiredLabel")}
          </Label>
          <Input
            id="coverageAmount"
            type="number"
            min="0"
            value={form.coverageAmount}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                coverageAmount: event.target.value,
              }))
            }
            placeholder="500000"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <CurrencyInput
          id="policyCurrency"
          label={t("currencyRequiredLabel")}
          hint={t("policyCurrencyHint")}
          value={form.currency}
          onChange={(currency) => setForm((prev) => ({ ...prev, currency }))}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DatePickerInput
          label={t("effectiveDateRequiredLabel")}
          id="effectiveDate"
          value={form.effectiveDate}
          onChange={(value) =>
            setForm((prev) => ({
              ...prev,
              effectiveDate: value,
            }))
          }
        />
        <DatePickerInput
          label={t("expirationDateRequiredLabel")}
          id="expirationDate"
          value={form.expirationDate}
          onChange={(value) =>
            setForm((prev) => ({
              ...prev,
              expirationDate: value,
            }))
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="deductible">{t("deductible")}</Label>
          <Input
            id="deductible"
            type="number"
            min="0"
            value={form.deductible}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, deductible: event.target.value }))
            }
            placeholder="500"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="premiumAmount">{t("premiumAmount")}</Label>
          <Input
            id="premiumAmount"
            type="number"
            min="0"
            value={form.premiumAmount}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                premiumAmount: event.target.value,
              }))
            }
            placeholder="1500"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("creating") : t("createPolicy")}
        </Button>
      </div>
    </form>
  );
}
