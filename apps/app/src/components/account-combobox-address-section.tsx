"use client";

import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import type { Dispatch, SetStateAction } from "react";
import { useI18n } from "@/locales/client";
import type { NewAccountForm } from "./account-combobox-types";

interface AccountComboboxAddressSectionProps {
  formData: NewAccountForm;
  setFormData: Dispatch<SetStateAction<NewAccountForm>>;
}

export function AccountComboboxAddressSection({
  formData,
  setFormData,
}: AccountComboboxAddressSectionProps) {
  const translate = useI18n();
  return (
    <div className="space-y-4">
      <h4 className="font-medium text-sm">
        {translate("untranslatedComponents.labels.address")}
      </h4>
      <div className="grid gap-4">
        <div>
          <Label htmlFor="address">
            {translate("untranslatedComponents.labels.address")}
          </Label>
          <Input
            id="address"
            value={formData.address}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, address: e.target.value }))
            }
            placeholder={translate(
              "untranslatedComponents.labels.streetAddress",
            )}
          />
        </div>
        <div>
          <Label htmlFor="address2">
            {translate("untranslatedComponents.labels.address2")}
          </Label>
          <Input
            id="address2"
            value={formData.address2}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, address2: e.target.value }))
            }
            placeholder={translate(
              "untranslatedComponents.labels.apartmentSuiteUnitEtc",
            )}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="zipCode">
              {translate("untranslatedComponents.labels.zipCode")}
            </Label>
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
            <Label htmlFor="city">
              {translate("untranslatedComponents.labels.city")}
            </Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, city: e.target.value }))
              }
              placeholder={translate("untranslatedComponents.labels.city")}
            />
          </div>
          <div>
            <Label htmlFor="country">
              {translate("untranslatedComponents.labels.country")}
            </Label>
            <Input
              id="country"
              value={formData.country}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, country: e.target.value }))
              }
              placeholder={translate("untranslatedComponents.labels.norway")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
