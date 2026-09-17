"use client";

import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { RadioGroup, RadioGroupItem } from "@v1/ui/radio-group";
import { cn } from "@v1/ui/utils";
import type { Dispatch, SetStateAction } from "react";
import type { CustomerCategory } from "@/lib/account-holder";
import type { NewAccountForm } from "./account-combobox-types";

interface AccountComboboxHolderSectionProps {
  formData: NewAccountForm;
  setFormData: Dispatch<SetStateAction<NewAccountForm>>;
}

const CUSTOMER_CATEGORY_OPTIONS: Array<{
  value: CustomerCategory;
  label: string;
  description: string;
  prefix: string;
}> = [
  {
    value: "person",
    label: "Private Person",
    description: "Individuals acting in their own name.",
    prefix: "0100",
  },
  {
    value: "business",
    label: "Business / Organization",
    description: "Companies, museums, galleries, and institutions.",
    prefix: "0200",
  },
  {
    value: "nonProfit",
    label: "Non-profit organisation",
    description: "Registered non-profit or charitable organisations.",
    prefix: "0300",
  },
];

export function AccountComboboxHolderSection({
  formData,
  setFormData,
}: AccountComboboxHolderSectionProps) {
  const isOrganization = formData.customerCategory !== "person";

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium">Account Holder</h4>
      <div className="grid gap-4">
        <div className="space-y-3">
          <Label>Customer category</Label>
          <RadioGroup
            className="grid gap-3"
            value={formData.customerCategory}
            onValueChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                customerCategory: value as CustomerCategory,
              }))
            }
          >
            {CUSTOMER_CATEGORY_OPTIONS.map((option) => (
              <Label
                key={option.value}
                htmlFor={`customerCategory-${option.value}`}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-md border border-border p-4",
                  formData.customerCategory === option.value &&
                    "border-primary bg-primary/5",
                )}
              >
                <RadioGroupItem
                  id={`customerCategory-${option.value}`}
                  value={option.value}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <div className="font-medium">
                    {option.label}{" "}
                    <span className="font-mono text-xs text-muted-foreground">
                      ({option.prefix})
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {option.description}
                  </p>
                </div>
              </Label>
            ))}
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
