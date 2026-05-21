"use client";

import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import type { Dispatch, SetStateAction } from "react";
import type { NewAccountForm } from "./account-combobox-types";

interface AccountComboboxContactSectionProps {
  formData: NewAccountForm;
  setFormData: Dispatch<SetStateAction<NewAccountForm>>;
}

export function AccountComboboxContactSection({
  formData,
  setFormData,
}: AccountComboboxContactSectionProps) {
  if (formData.holderType !== "organization") return null;

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium">Contact Person</h4>
      <div className="grid gap-4">
        <div>
          <Label htmlFor="contactPerson">Name</Label>
          <Input
            id="contactPerson"
            value={formData.contactPerson}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                contactPerson: e.target.value,
              }))
            }
            placeholder="Contact person name"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="contactPhone">Phone</Label>
            <Input
              id="contactPhone"
              value={formData.contactPhone}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  contactPhone: e.target.value,
                }))
              }
              placeholder="+47 123 45 678"
            />
          </div>
          <div>
            <Label htmlFor="contactEmail">Email</Label>
            <Input
              id="contactEmail"
              type="email"
              value={formData.contactEmail}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  contactEmail: e.target.value,
                }))
              }
              placeholder="person@company.com"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
