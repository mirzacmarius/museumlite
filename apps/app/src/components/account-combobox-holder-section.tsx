"use client";

import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { RadioGroup, RadioGroupItem } from "@v1/ui/radio-group";
import { cn } from "@v1/ui/utils";
import type { Dispatch, SetStateAction } from "react";
import {
  type AccountHolderType,
  isAccountHolderType,
} from "@/lib/account-holder";
import type { NewAccountForm } from "./account-combobox-types";

interface AccountComboboxHolderSectionProps {
  formData: NewAccountForm;
  setFormData: Dispatch<SetStateAction<NewAccountForm>>;
}

interface HolderTypeOptionProps {
  checked: boolean;
  description: string;
  id: string;
  label: string;
  value: AccountHolderType;
}

export function AccountComboboxHolderSection({
  formData,
  setFormData,
}: AccountComboboxHolderSectionProps) {
  const isOrganization = formData.holderType === "organization";

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium">Account Holder</h4>
      <div className="grid gap-4">
        <div className="space-y-3">
          <Label>Holder type</Label>
          <RadioGroup
            className="grid gap-3 sm:grid-cols-2"
            value={formData.holderType}
            onValueChange={(value) => {
              if (!isAccountHolderType(value)) return;
              setFormData((prev) => ({ ...prev, holderType: value }));
            }}
          >
            <HolderTypeOption
              checked={formData.holderType === "privatePerson"}
              description="Use this for individuals acting in their own name."
              id="holderType-privatePerson"
              label="Private Person"
              value="privatePerson"
            />
            <HolderTypeOption
              checked={isOrganization}
              description="Use this for companies, museums, galleries, and institutions."
              id="holderType-organization"
              label="Business / Organization"
              value="organization"
            />
          </RadioGroup>
        </div>
        <div>
          <Label htmlFor="businessName">
            {isOrganization ? "Business Name / Organisation *" : "Full Name *"}
          </Label>
          <Input
            id="businessName"
            value={formData.businessName}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                businessName: e.target.value,
              }))
            }
            placeholder={
              isOrganization
                ? "Enter business or organization name"
                : "Enter full name"
            }
          />
        </div>
        {isOrganization ? (
          <div>
            <Label htmlFor="taxId">Organization Number</Label>
            <Input
              id="taxId"
              value={formData.taxId}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, taxId: e.target.value }))
              }
              placeholder="Enter organization number"
            />
          </div>
        ) : (
          <div>
            <Label htmlFor="dateOfBirth">Date of Birth</Label>
            <Input
              id="dateOfBirth"
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  dateOfBirth: e.target.value,
                }))
              }
            />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, phone: e.target.value }))
              }
              placeholder="+47 123 45 678"
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
              placeholder="contact@company.com"
            />
          </div>
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
}: HolderTypeOptionProps) {
  return (
    <Label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-md border border-border p-4",
        checked && "border-primary bg-primary/5",
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
