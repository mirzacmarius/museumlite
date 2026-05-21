"use client";

import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import type { Dispatch, SetStateAction } from "react";
import type { NewAccountForm } from "./account-combobox-types";

interface AccountComboboxAddressSectionProps {
  formData: NewAccountForm;
  setFormData: Dispatch<SetStateAction<NewAccountForm>>;
}

export function AccountComboboxAddressSection({
  formData,
  setFormData,
}: AccountComboboxAddressSectionProps) {
  return (
    <div className="space-y-4">
      <h4 className="font-medium text-sm">Address</h4>
      <div className="grid gap-4">
        <div>
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            value={formData.address}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, address: e.target.value }))
            }
            placeholder="Street address"
          />
        </div>
        <div>
          <Label htmlFor="address2">Address 2</Label>
          <Input
            id="address2"
            value={formData.address2}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, address2: e.target.value }))
            }
            placeholder="Apartment, suite, unit, etc."
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="zipCode">Zip Code</Label>
            <Input
              id="zipCode"
              value={formData.zipCode}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, zipCode: e.target.value }))
              }
              placeholder="0000"
            />
          </div>
          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, city: e.target.value }))
              }
              placeholder="City"
            />
          </div>
          <div>
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={formData.country}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, country: e.target.value }))
              }
              placeholder="Norway"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
