"use client";

import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { useScopedI18n } from "@/locales/client";

interface LoanCurrencyInputProps
  extends Pick<React.AriaAttributes, "aria-invalid" | "aria-describedby"> {
  id: string;
  value: string;
  onChange: (value: string) => void;
}

/** ISO 4217 code for a loan's insurance value, entered in upper case. */
export function LoanCurrencyInput({
  id,
  value,
  onChange,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: LoanCurrencyInputProps) {
  const t = useScopedI18n("loanAgreementTemplates.currency");
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{t("label")}</Label>
      <Input
        id={id}
        value={value}
        maxLength={3}
        autoComplete="off"
        placeholder={t("placeholder")}
        aria-invalid={ariaInvalid}
        aria-describedby={[`${id}-hint`, ariaDescribedBy]
          .filter(Boolean)
          .join(" ")}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        className="bg-background uppercase"
      />
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {t("hint")}
      </p>
    </div>
  );
}
