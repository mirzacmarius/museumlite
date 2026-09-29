"use client";

import type { Doc } from "@v1/backend/convex/_generated/dataModel";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { RadioGroup, RadioGroupItem } from "@v1/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Textarea } from "@v1/ui/textarea";
import { UserCog } from "lucide-react";
import type { AccountHolderType } from "@/lib/account-holder";
import type { useScopedI18n } from "@/locales/client";

export type AccountType = NonNullable<Doc<"accounts">["accountType"]> | "";

export interface AccountFormValues {
  holderType: AccountHolderType;
  businessName: string;
  taxId: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  address: string;
  address2: string;
  zipCode: string;
  city: string;
  country: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  notes: string;
  accountType: AccountType;
}

type ChangeField = <Key extends keyof AccountFormValues>(
  key: Key,
  value: AccountFormValues[Key],
) => void;

interface AccountFormFieldsProps {
  formData: AccountFormValues;
  t: ReturnType<typeof useScopedI18n<"accounts">>;
  onChange: ChangeField;
}

export function AccountFormFields({
  formData,
  t,
  onChange,
}: AccountFormFieldsProps) {
  return (
    <>
      <AccountHolderSection formData={formData} t={t} onChange={onChange} />
      <AddressSection formData={formData} t={t} onChange={onChange} />
      {formData.holderType === "organization" && (
        <ContactPersonSection formData={formData} t={t} onChange={onChange} />
      )}
      <NotesSection notes={formData.notes} t={t} onChange={onChange} />
      <AccountTypeSection
        accountType={formData.accountType}
        t={t}
        onChange={onChange}
      />
    </>
  );
}

type FormSectionProps = AccountFormFieldsProps;

function AccountHolderSection({ formData, t, onChange }: FormSectionProps) {
  const isOrganization = formData.holderType === "organization";

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground">
        Account Holder
      </h3>
      <div className="space-y-4">
        <div className="space-y-3">
          <Label>Holder Type</Label>
          <RadioGroup
            className="grid gap-3 md:grid-cols-2"
            value={formData.holderType}
            onValueChange={(value) => {
              if (value === "organization" || value === "privatePerson") {
                onChange("holderType", value);
              }
            }}
          >
            <HolderTypeOption
              checked={formData.holderType === "privatePerson"}
              description="Individuals acting in their own name."
              id="holder-type-privatePerson"
              label="Private Person"
              value="privatePerson"
            />
            <HolderTypeOption
              checked={isOrganization}
              description="Companies, museums, galleries, and institutions."
              id="holder-type-organization"
              label="Business / Organization"
              value="organization"
            />
          </RadioGroup>
        </div>
        <div className="space-y-2">
          <Label htmlFor="businessName">
            {isOrganization ? t("form.businessName") : "Full Name"}{" "}
            <span className="text-red-500">*</span>
          </Label>
          <Input
            id="businessName"
            value={formData.businessName}
            onChange={(event) => onChange("businessName", event.target.value)}
            placeholder={
              isOrganization
                ? t("form.placeholders.businessName")
                : "e.g., Jane Doe"
            }
            required
          />
        </div>
        {isOrganization ? (
          <TextInput
            id="taxId"
            label="Organization Number"
            placeholder="e.g., 987 654 321"
            value={formData.taxId}
            onChange={(value) => onChange("taxId", value)}
          />
        ) : (
          <TextInput
            id="dateOfBirth"
            label="Date of Birth"
            type="date"
            value={formData.dateOfBirth}
            onChange={(value) => onChange("dateOfBirth", value)}
          />
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            id="phone"
            label={t("form.phone")}
            placeholder={t("form.placeholders.phone")}
            value={formData.phone}
            onChange={(value) => onChange("phone", value)}
          />
          <TextInput
            id="email"
            label={t("form.email")}
            placeholder={t("form.placeholders.email")}
            type="email"
            value={formData.email}
            onChange={(value) => onChange("email", value)}
          />
        </div>
      </div>
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
      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${checked ? "border-primary bg-primary/5" : "border-border"}`}
    >
      <RadioGroupItem id={id} value={value} className="mt-0.5" />
      <div className="space-y-1">
        <div className="font-medium">{label}</div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Label>
  );
}

function AddressSection({ formData, t, onChange }: FormSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground">
        {t("form.address")}
      </h3>
      <div className="space-y-4">
        <TextInput
          id="address"
          label={t("form.streetAddress")}
          placeholder={t("form.placeholders.streetAddress")}
          value={formData.address}
          onChange={(value) => onChange("address", value)}
        />
        <TextInput
          id="address2"
          label={t("form.addressLine2")}
          placeholder={t("form.placeholders.addressLine2")}
          value={formData.address2}
          onChange={(value) => onChange("address2", value)}
        />
        <div className="grid gap-4 md:grid-cols-3">
          <TextInput
            id="city"
            label={t("form.city")}
            placeholder={t("form.placeholders.city")}
            value={formData.city}
            onChange={(value) => onChange("city", value)}
          />
          <TextInput
            id="zipCode"
            label={t("form.zipCode")}
            placeholder={t("form.placeholders.zipCode")}
            value={formData.zipCode}
            onChange={(value) => onChange("zipCode", value)}
          />
          <TextInput
            id="country"
            label={t("form.country")}
            placeholder={t("form.placeholders.country")}
            value={formData.country}
            onChange={(value) => onChange("country", value)}
          />
        </div>
      </div>
    </div>
  );
}

function ContactPersonSection({ formData, t, onChange }: FormSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground">
        {t("form.contactPerson")}
      </h3>
      <div className="space-y-4">
        <TextInput
          id="contactPerson"
          label={t("form.contactName")}
          placeholder={t("form.placeholders.contactName")}
          value={formData.contactPerson}
          onChange={(value) => onChange("contactPerson", value)}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            id="contactPhone"
            label={t("form.contactPhone")}
            placeholder={t("form.placeholders.phone")}
            value={formData.contactPhone}
            onChange={(value) => onChange("contactPhone", value)}
          />
          <TextInput
            id="contactEmail"
            label={t("form.contactEmail")}
            placeholder={t("form.placeholders.contactEmail")}
            type="email"
            value={formData.contactEmail}
            onChange={(value) => onChange("contactEmail", value)}
          />
        </div>
      </div>
    </div>
  );
}

function NotesSection({
  notes,
  t,
  onChange,
}: {
  notes: string;
  t: AccountFormFieldsProps["t"];
  onChange: ChangeField;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="notes">Additional Information / Notes</Label>
      <Textarea
        id="notes"
        value={notes}
        onChange={(event) => onChange("notes", event.target.value)}
        placeholder={t("form.placeholders.notes")}
        rows={4}
      />
    </div>
  );
}

function AccountTypeSection({
  accountType,
  t,
  onChange,
}: {
  accountType: AccountType;
  t: AccountFormFieldsProps["t"];
  onChange: ChangeField;
}) {
  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <UserCog className="size-4" />
        {t("form.accountType")}
      </h3>
      <div className="space-y-2">
        <Label htmlFor="accountType">{t("form.accountType")}</Label>
        <Select
          value={accountType}
          onValueChange={(value) => {
            if (
              value === "lender" ||
              value === "borrower" ||
              value === "both" ||
              value === "institution" ||
              value === "patron"
            ) {
              onChange("accountType", value);
            }
          }}
        >
          <SelectTrigger id="accountType">
            <SelectValue placeholder={t("form.placeholders.accountType")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lender">{t("types.lender")}</SelectItem>
            <SelectItem value="borrower">{t("types.borrower")}</SelectItem>
            <SelectItem value="both">{t("types.both")}</SelectItem>
            <SelectItem value="institution">
              {t("types.institution")}
            </SelectItem>
            {accountType === "patron" && (
              <SelectItem value="patron">{t("types.patron")}</SelectItem>
            )}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {t("form.accountTypeDescription")}
        </p>
      </div>
    </div>
  );
}

function TextInput({
  id,
  label,
  onChange,
  placeholder,
  type = "text",
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
