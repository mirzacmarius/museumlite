"use client";

import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import type { Dispatch, SetStateAction } from "react";
import { isOrganizationHolder } from "@/lib/account-holder";
import type { NewAccountForm } from "./account-combobox-types";
import { AccountHolderTypeFields } from "./account-holder-type-fields";

interface AccountComboboxHolderSectionProps {
  formData: NewAccountForm;
  setFormData: Dispatch<SetStateAction<NewAccountForm>>;
}

export function AccountComboboxHolderSection({
  formData,
  setFormData,
}: AccountComboboxHolderSectionProps) {
  const isOrganization = isOrganizationHolder(formData.holderType);

  function setField<Key extends keyof NewAccountForm>(
    key: Key,
    value: NewAccountForm[Key],
  ) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium">Account Holder</h4>
      <div className="grid gap-4">
        <AccountHolderTypeFields
          holderType={formData.holderType}
          holderTypeLabel="Holder type"
          idPrefix="holderType"
          organizationDescription="Use this for companies, museums, galleries, and institutions."
          organizationLabel="Business / Organization"
          privatePersonDescription="Use this for individuals acting in their own name."
          privatePersonLabel="Private Person"
          onChange={(holderType) => setField("holderType", holderType)}
        />
        <ComboboxField
          id="businessName"
          label={
            isOrganization ? "Business Name / Organisation *" : "Full Name *"
          }
          value={formData.businessName}
          onChange={(value) => setField("businessName", value)}
          placeholder={
            isOrganization
              ? "Enter business or organization name"
              : "Enter full name"
          }
        />
        {isOrganization ? (
          <ComboboxField
            id="taxId"
            label="Organization Number"
            value={formData.taxId}
            onChange={(value) => setField("taxId", value)}
            placeholder="Enter organization number"
          />
        ) : (
          <ComboboxField
            id="dateOfBirth"
            label="Date of Birth"
            type="date"
            value={formData.dateOfBirth}
            onChange={(value) => setField("dateOfBirth", value)}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <ComboboxField
            id="phone"
            label="Phone"
            value={formData.phone}
            onChange={(value) => setField("phone", value)}
            placeholder="+47 123 45 678"
          />
          <ComboboxField
            id="email"
            label="Email"
            type="email"
            value={formData.email}
            onChange={(value) => setField("email", value)}
            placeholder="contact@company.com"
          />
        </div>
      </div>
    </div>
  );
}

function ComboboxField({
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
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
