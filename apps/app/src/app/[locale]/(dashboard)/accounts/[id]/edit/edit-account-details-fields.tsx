"use client";

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
import type { Dispatch, SetStateAction } from "react";
import {
  type AccountHolderType,
  accountHolderFields,
} from "@/lib/account-holder";
import type { useScopedI18n } from "@/locales/client";
import type { EditAccountFormData } from "./edit-account-form-types";

interface EditAccountDetailsFieldsProps {
  t: ReturnType<typeof useScopedI18n<"accounts">>;
  formData: EditAccountFormData;
  setFormData: Dispatch<SetStateAction<EditAccountFormData>>;
}

export function EditAccountDetailsFields({
  t,
  formData,
  setFormData,
}: EditAccountDetailsFieldsProps) {
  const holder = accountHolderFields(formData.holderType);
  const isPrivatePerson = holder.kind === "privatePerson";

  return (
    <>
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          {isPrivatePerson
            ? t("form.personalInformation")
            : t("form.businessInformation")}
        </h3>
        <div className="space-y-4">
          <div className="space-y-3">
            <Label>{t("form.holderType")}</Label>
            <RadioGroup
              className="grid gap-3 md:grid-cols-2"
              value={formData.holderType}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  holderType: value as AccountHolderType,
                }))
              }
            >
              <Label
                htmlFor="edit-holder-privatePerson"
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${
                  isPrivatePerson
                    ? "border-primary bg-primary/5"
                    : "border-border"
                }`}
              >
                <RadioGroupItem
                  id="edit-holder-privatePerson"
                  value="privatePerson"
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <div className="font-medium">{t("form.privatePerson")}</div>
                  <p className="text-sm text-muted-foreground">
                    {t("form.privatePersonDescription")}
                  </p>
                </div>
              </Label>
              <Label
                htmlFor="edit-holder-organization"
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${
                  isPrivatePerson
                    ? "border-border"
                    : "border-primary bg-primary/5"
                }`}
              >
                <RadioGroupItem
                  id="edit-holder-organization"
                  value="organization"
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <div className="font-medium">{t("form.organization")}</div>
                  <p className="text-sm text-muted-foreground">
                    {t("form.organizationDescription")}
                  </p>
                </div>
              </Label>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="businessName">
              {isPrivatePerson ? t("form.fullName") : t("form.businessName")}{" "}
              <span className="text-red-500">*</span>
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
                isPrivatePerson
                  ? t("form.placeholders.fullName")
                  : t("form.placeholders.businessName")
              }
              required
            />
          </div>
          {holder.showDateOfBirth ? (
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">{t("form.dateOfBirth")}</Label>
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
          ) : null}
          {holder.showOrganizationNumber ? (
            <div className="space-y-2">
              <Label htmlFor="taxId">{t("form.organizationNumber")}</Label>
              <Input
                id="taxId"
                value={formData.taxId}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    taxId: e.target.value,
                  }))
                }
                placeholder={t("form.placeholders.organizationNumber")}
              />
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">{t("form.phone")}</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    phone: e.target.value,
                  }))
                }
                placeholder={t("form.placeholders.phone")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("form.email")}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
                placeholder={t("form.placeholders.email")}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          {t("form.address")}
        </h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address">{t("form.streetAddress")}</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  address: e.target.value,
                }))
              }
              placeholder={t("form.placeholders.streetAddress")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address2">{t("form.addressLine2")}</Label>
            <Input
              id="address2"
              value={formData.address2}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  address2: e.target.value,
                }))
              }
              placeholder={t("form.placeholders.addressLine2")}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">{t("form.city")}</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    city: e.target.value,
                  }))
                }
                placeholder={t("form.placeholders.city")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zipCode">{t("form.zipCode")}</Label>
              <Input
                id="zipCode"
                value={formData.zipCode}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    zipCode: e.target.value,
                  }))
                }
                placeholder={t("form.placeholders.zipCode")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">{t("form.country")}</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    country: e.target.value,
                  }))
                }
                placeholder={t("form.placeholders.country")}
              />
            </div>
          </div>
        </div>
      </div>

      {holder.showContactPerson ? (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            {t("form.contactPerson")}
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contactPerson">{t("form.contactName")}</Label>
              <Input
                id="contactPerson"
                value={formData.contactPerson}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    contactPerson: e.target.value,
                  }))
                }
                placeholder={t("form.placeholders.contactName")}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactPhone">{t("form.contactPhone")}</Label>
                <Input
                  id="contactPhone"
                  value={formData.contactPhone}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      contactPhone: e.target.value,
                    }))
                  }
                  placeholder={t("form.placeholders.phone")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">{t("form.contactEmail")}</Label>
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
                  placeholder={t("form.placeholders.contactEmail")}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">{t("form.notes")}</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, notes: e.target.value }))
          }
          placeholder={t("form.placeholders.notes")}
          rows={4}
        />
      </div>

      {/* Account Type / Role */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <UserCog className="size-4" />
          {t("form.accountTypeRole")}
        </h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="accountType">{t("form.accountType")}</Label>
            <Select
              value={formData.accountType}
              onValueChange={(
                value: "lender" | "borrower" | "both" | "institution" | "",
              ) => setFormData((prev) => ({ ...prev, accountType: value }))}
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
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("form.accountTypeDescription")}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
