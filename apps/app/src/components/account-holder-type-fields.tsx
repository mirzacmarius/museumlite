"use client";

import { Label } from "@v1/ui/label";
import { RadioGroup, RadioGroupItem } from "@v1/ui/radio-group";
import { cn } from "@v1/ui/utils";
import {
  ACCOUNT_HOLDER_TYPES,
  type AccountHolderType,
  isAccountHolderType,
} from "@/lib/account-holder";
import type { useScopedI18n } from "@/locales/client";

interface AccountHolderTypeFieldsProps {
  holderType: AccountHolderType;
  onChange: (value: AccountHolderType) => void;
  idPrefix?: string;
  privatePersonLabel: string;
  privatePersonDescription: string;
  organizationLabel: string;
  organizationDescription: string;
  holderTypeLabel: string;
}

interface TranslatedAccountHolderTypeFieldsProps {
  holderType: AccountHolderType;
  onChange: (value: AccountHolderType) => void;
  idPrefix?: string;
  t: ReturnType<typeof useScopedI18n<"accounts">>;
}

export function TranslatedAccountHolderTypeFields({
  holderType,
  onChange,
  idPrefix,
  t,
}: TranslatedAccountHolderTypeFieldsProps) {
  return (
    <AccountHolderTypeFields
      holderType={holderType}
      holderTypeLabel={t("form.holderType")}
      idPrefix={idPrefix}
      organizationDescription={t("form.holderOrganizationDescription")}
      organizationLabel={t("form.holderOrganization")}
      privatePersonDescription={t("form.holderPrivatePersonDescription")}
      privatePersonLabel={t("form.holderPrivatePerson")}
      onChange={onChange}
    />
  );
}

export function AccountHolderTypeFields({
  holderType,
  onChange,
  idPrefix = "holder-type",
  privatePersonLabel,
  privatePersonDescription,
  organizationLabel,
  organizationDescription,
  holderTypeLabel,
}: AccountHolderTypeFieldsProps) {
  const copy: Record<
    AccountHolderType,
    { label: string; description: string }
  > = {
    privatePerson: {
      label: privatePersonLabel,
      description: privatePersonDescription,
    },
    organization: {
      label: organizationLabel,
      description: organizationDescription,
    },
  };

  return (
    <div className="space-y-3">
      <Label>{holderTypeLabel}</Label>
      <RadioGroup
        className="grid gap-3 md:grid-cols-2"
        value={holderType}
        onValueChange={(value) => {
          if (isAccountHolderType(value)) onChange(value);
        }}
      >
        {ACCOUNT_HOLDER_TYPES.map((value) => (
          <HolderTypeOption
            key={value}
            checked={holderType === value}
            description={copy[value].description}
            id={`${idPrefix}-${value}`}
            label={copy[value].label}
            value={value}
          />
        ))}
      </RadioGroup>
    </div>
  );
}

function HolderTypeOption({
  checked,
  description,
  id,
  label,
  value,
}: {
  checked: boolean;
  description: string;
  id: string;
  label: string;
  value: AccountHolderType;
}) {
  return (
    <Label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-4",
        checked ? "border-primary bg-primary/5" : "border-border",
      )}
    >
      <RadioGroupItem id={id} value={value} className="mt-0.5" />
      <div className="space-y-1">
        <div className="font-medium">{label}</div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Label>
  );
}
