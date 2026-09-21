"use client";

import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Textarea } from "@v1/ui/textarea";
import { UserCog } from "lucide-react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { TranslatedAccountHolderTypeFields } from "@/components/account-holder-type-fields";
import {
  formPatchForHolderType,
  isOrganizationHolder,
  type LoanAccountType,
  loanAccountTypesForHolder,
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
  const isOrganization = isOrganizationHolder(formData.holderType);
  const availableAccountTypes = loanAccountTypesForHolder(formData.holderType);

  function setStringField(
    key:
      | "businessName"
      | "taxId"
      | "dateOfBirth"
      | "phone"
      | "email"
      | "address"
      | "address2"
      | "zipCode"
      | "city"
      | "country"
      | "contactPerson"
      | "contactPhone"
      | "contactEmail"
      | "notes",
    value: string,
  ) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <>
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          {isOrganization
            ? t("form.businessInformation")
            : t("form.personalInformation")}
        </h3>
        <div className="space-y-4">
          <TranslatedAccountHolderTypeFields
            holderType={formData.holderType}
            idPrefix="edit-holder-type"
            t={t}
            onChange={(holderType) =>
              setFormData((prev) => ({
                ...prev,
                ...formPatchForHolderType(holderType, prev.accountType),
              }))
            }
          />
          <TextField
            id="businessName"
            label={
              <>
                {isOrganization ? t("form.businessName") : t("form.fullName")}{" "}
                <span className="text-red-500">*</span>
              </>
            }
            value={formData.businessName}
            onChange={(value) => setStringField("businessName", value)}
            placeholder={
              isOrganization
                ? t("form.placeholders.businessName")
                : t("form.placeholders.fullName")
            }
            required
          />

          {isOrganization ? (
            <TextField
              id="taxId"
              label={t("form.organizationNumber")}
              value={formData.taxId}
              onChange={(value) => setStringField("taxId", value)}
              placeholder={t("form.placeholders.organizationNumber")}
            />
          ) : (
            <TextField
              id="dateOfBirth"
              label={t("form.dateOfBirth")}
              type="date"
              value={formData.dateOfBirth}
              onChange={(value) => setStringField("dateOfBirth", value)}
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <TextField
              id="phone"
              label={t("form.phone")}
              value={formData.phone}
              onChange={(value) => setStringField("phone", value)}
              placeholder={t("form.placeholders.phone")}
            />
            <TextField
              id="email"
              label={t("form.email")}
              type="email"
              value={formData.email}
              onChange={(value) => setStringField("email", value)}
              placeholder={t("form.placeholders.email")}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          {t("form.address")}
        </h3>
        <div className="space-y-4">
          <TextField
            id="address"
            label={t("form.streetAddress")}
            value={formData.address}
            onChange={(value) => setStringField("address", value)}
            placeholder={t("form.placeholders.streetAddress")}
          />
          <TextField
            id="address2"
            label={t("form.addressLine2")}
            value={formData.address2}
            onChange={(value) => setStringField("address2", value)}
            placeholder={t("form.placeholders.addressLine2")}
          />
          <div className="grid grid-cols-3 gap-4">
            <TextField
              id="city"
              label={t("form.city")}
              value={formData.city}
              onChange={(value) => setStringField("city", value)}
              placeholder={t("form.placeholders.city")}
            />
            <TextField
              id="zipCode"
              label={t("form.zipCode")}
              value={formData.zipCode}
              onChange={(value) => setStringField("zipCode", value)}
              placeholder={t("form.placeholders.zipCode")}
            />
            <TextField
              id="country"
              label={t("form.country")}
              value={formData.country}
              onChange={(value) => setStringField("country", value)}
              placeholder={t("form.placeholders.country")}
            />
          </div>
        </div>
      </div>

      {isOrganization ? (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            {t("form.contactPerson")}
          </h3>
          <div className="space-y-4">
            <TextField
              id="contactPerson"
              label={t("form.contactName")}
              value={formData.contactPerson}
              onChange={(value) => setStringField("contactPerson", value)}
              placeholder={t("form.placeholders.contactName")}
            />
            <div className="grid grid-cols-2 gap-4">
              <TextField
                id="contactPhone"
                label={t("form.contactPhone")}
                value={formData.contactPhone}
                onChange={(value) => setStringField("contactPhone", value)}
                placeholder={t("form.placeholders.phone")}
              />
              <TextField
                id="contactEmail"
                label={t("form.contactEmail")}
                type="email"
                value={formData.contactEmail}
                onChange={(value) => setStringField("contactEmail", value)}
                placeholder={t("form.placeholders.contactEmail")}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="notes">{t("form.notes")}</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setStringField("notes", e.target.value)}
          placeholder={t("form.placeholders.notes")}
          rows={4}
        />
      </div>

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
              onValueChange={(value: LoanAccountType) =>
                setFormData((prev) => ({ ...prev, accountType: value }))
              }
            >
              <SelectTrigger id="accountType">
                <SelectValue placeholder={t("form.placeholders.accountType")} />
              </SelectTrigger>
              <SelectContent>
                {availableAccountTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`types.${type}`)}
                  </SelectItem>
                ))}
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

function TextField({
  id,
  label,
  onChange,
  placeholder,
  required,
  type = "text",
  value,
}: {
  id: string;
  label: ReactNode;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
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
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}
