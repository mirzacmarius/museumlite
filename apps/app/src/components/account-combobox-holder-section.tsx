"use client";

import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { RadioGroup, RadioGroupItem } from "@v1/ui/radio-group";
import { cn } from "@v1/ui/utils";
import type { Dispatch, SetStateAction } from "react";
import type { AccountHolderType } from "@/lib/account-holder";
import type { NewAccountForm } from "./account-combobox-types";

interface AccountComboboxHolderSectionProps {
  formData: NewAccountForm;
  setFormData: Dispatch<SetStateAction<NewAccountForm>>;
}

export function AccountComboboxHolderSection({
  formData,
  setFormData,
}: AccountComboboxHolderSectionProps) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium">Account Holder</h4>
      <div className="grid gap-4">
        <div className="space-y-3">
          <Label>Holder type</Label>
          <RadioGroup
            className="grid gap-3 sm:grid-cols-2"
            value={formData.holderType}
            onValueChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                holderType: value as AccountHolderType,
              }))
            }
          >
            <Label
              htmlFor="holderType-organization"
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border border-border p-4",
                formData.holderType === "organization" &&
                  "border-primary bg-primary/5",
              )}
            >
              <RadioGroupItem
                id="holderType-organization"
                value="organization"
                className="mt-0.5"
              />
              <div className="space-y-1">
                <div className="font-medium">Business / Organization</div>
                <p className="text-sm text-muted-foreground">
                  Use this for companies, museums, galleries, and institutions.
                </p>
              </div>
            </Label>
            <Label
              htmlFor="holderType-privatePerson"
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border border-border p-4",
                formData.holderType === "privatePerson" &&
                  "border-primary bg-primary/5",
              )}
            >
              <RadioGroupItem
                id="holderType-privatePerson"
                value="privatePerson"
                className="mt-0.5"
              />
              <div className="space-y-1">
                <div className="font-medium">Private Person</div>
                <p className="text-sm text-muted-foreground">
                  Use this for individuals acting in their own name.
                </p>
              </div>
            </Label>
          </RadioGroup>
        </div>
        <div>
          <Label htmlFor="businessName">
            {formData.holderType === "organization"
              ? "Business Name / Organisation *"
              : "Full Name *"}
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
              formData.holderType === "organization"
                ? "Enter business or organization name"
                : "Enter full name"
            }
          />
        </div>
        {formData.holderType === "organization" ? (
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
