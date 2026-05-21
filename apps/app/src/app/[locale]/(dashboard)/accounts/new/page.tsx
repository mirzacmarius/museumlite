"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
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
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Loader2, Save, Shield, UserCog } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import {
  type AccountHolderType,
  DEFAULT_ACCOUNT_HOLDER_TYPE,
  parseDateInputValue,
} from "@/lib/account-holder";
import { useScopedI18n } from "@/locales/client";

type AccountType = "lender" | "borrower" | "both" | "institution";

interface AccountFormData {
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
  selectedRoles: Id<"roles">[];
}

interface RoleWithPermissions {
  _id: Id<"roles">;
  name: string;
  description?: string;
  permissions: Array<{ category: string }>;
}

const initialFormData: AccountFormData = {
  holderType: DEFAULT_ACCOUNT_HOLDER_TYPE,
  businessName: "",
  taxId: "",
  dateOfBirth: "",
  phone: "",
  email: "",
  address: "",
  address2: "",
  zipCode: "",
  city: "",
  country: "",
  contactPerson: "",
  contactPhone: "",
  contactEmail: "",
  notes: "",
  accountType: "institution",
  selectedRoles: [],
};

export default function NewAccountPage() {
  const t = useScopedI18n("accounts");
  const tCommon = useScopedI18n("common");
  const { push } = useRouter();
  const { currentOrganizationId } = useOrganization();
  const createAccount = useMutation(api.accounts.create);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<AccountFormData>(initialFormData);

  const roles = useQuery(
    api.roles.listRoles,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );
  const rolesWithLoansPermissions = roles?.filter((role) =>
    role.permissions.some((permission) => permission.category === "loans"),
  );

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{t("selectOrganizationCreate")}</p>
      </div>
    );
  }

  const updateFormData = <Key extends keyof AccountFormData>(
    key: Key,
    value: AccountFormData[Key],
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const toggleRole = (roleId: Id<"roles">) => {
    setFormData((prev) => ({
      ...prev,
      selectedRoles: prev.selectedRoles.includes(roleId)
        ? prev.selectedRoles.filter((id) => id !== roleId)
        : [...prev.selectedRoles, roleId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.businessName.trim()) {
      setError(t("form.errors.businessNameRequired"));
      return;
    }

    const isOrganization = formData.holderType === "organization";

    setIsSubmitting(true);
    try {
      await createAccount({
        organizationId: currentOrganizationId,
        holderType: formData.holderType,
        businessName: formData.businessName,
        taxId: isOrganization ? formData.taxId || undefined : undefined,
        dateOfBirth: isOrganization
          ? undefined
          : parseDateInputValue(formData.dateOfBirth),
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        address: formData.address || undefined,
        address2: formData.address2 || undefined,
        zipCode: formData.zipCode || undefined,
        city: formData.city || undefined,
        country: formData.country || undefined,
        contactPerson: isOrganization
          ? formData.contactPerson || undefined
          : undefined,
        contactPhone: isOrganization
          ? formData.contactPhone || undefined
          : undefined,
        contactEmail: isOrganization
          ? formData.contactEmail || undefined
          : undefined,
        notes: formData.notes || undefined,
        accountType: formData.accountType,
        roleIds:
          formData.selectedRoles.length > 0
            ? formData.selectedRoles
            : undefined,
      });
      push("/accounts");
    } catch (err) {
      console.error("Error creating account:", err);
      setError(
        err instanceof Error ? err.message : t("form.errors.createFailed"),
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex size-full bg-background px-6">
      <div className="z-10 mx-auto flex size-full max-w-screen-md gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <NewAccountHeader title={t("newAccount")} backLabel={t("back")} />
          <div className="flex w-full px-6">
            <div className="w-full border-b border-border" />
          </div>
          <form onSubmit={handleSubmit} className="space-y-6 p-6">
            {error && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <AccountHolderSection
              formData={formData}
              t={t}
              onChange={updateFormData}
            />
            <AddressSection
              formData={formData}
              t={t}
              onChange={updateFormData}
            />
            {formData.holderType === "organization" && (
              <ContactPersonSection
                formData={formData}
                t={t}
                onChange={updateFormData}
              />
            )}
            <NotesSection
              notes={formData.notes}
              t={t}
              onChange={updateFormData}
            />
            <AccountTypeSection
              accountType={formData.accountType}
              t={t}
              onChange={updateFormData}
            />
            <RolesSection
              roles={rolesWithLoansPermissions}
              selectedRoles={formData.selectedRoles}
              t={t}
              onToggleRole={toggleRole}
            />
            <FormActions
              cancelLabel={tCommon("cancel")}
              createLabel={t("form.createButton")}
              creatingLabel={t("form.creating")}
              isSubmitting={isSubmitting}
            />
          </form>
        </div>
      </div>
    </div>
  );
}

function NewAccountHeader({
  title,
  backLabel,
}: {
  title: string;
  backLabel: string;
}) {
  return (
    <div className="flex w-full items-center justify-between rounded-lg p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/accounts">
            <ArrowLeft className="mr-2 size-4" />
            {backLabel}
          </Link>
        </Button>
        <h2 className="text-xl font-medium text-primary">{title}</h2>
      </div>
    </div>
  );
}

interface FormSectionProps {
  formData: AccountFormData;
  t: ReturnType<typeof useScopedI18n>;
  onChange: <Key extends keyof AccountFormData>(
    key: Key,
    value: AccountFormData[Key],
  ) => void;
}

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
            onValueChange={(value) =>
              onChange("holderType", value as AccountHolderType)
            }
          >
            <HolderTypeOption
              checked={isOrganization}
              description="Companies, museums, galleries, and institutions."
              id="holder-type-organization"
              label="Business / Organization"
              value="organization"
            />
            <HolderTypeOption
              checked={formData.holderType === "privatePerson"}
              description="Individuals acting in their own name."
              id="holder-type-privatePerson"
              label="Private Person"
              value="privatePerson"
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
            onChange={(e) => onChange("businessName", e.target.value)}
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
      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${
        checked ? "border-primary bg-primary/5" : "border-border"
      }`}
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
  t: ReturnType<typeof useScopedI18n>;
  onChange: FormSectionProps["onChange"];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="notes">Additional Information / Notes</Label>
      <Textarea
        id="notes"
        value={notes}
        onChange={(e) => onChange("notes", e.target.value)}
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
  t: ReturnType<typeof useScopedI18n>;
  onChange: FormSectionProps["onChange"];
}) {
  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <UserCog className="size-4" />
        {t("form.accountTypeRole")}
      </h3>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="accountType">{t("form.accountType")}</Label>
          <Select
            value={accountType}
            onValueChange={(value: AccountType) =>
              onChange("accountType", value)
            }
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
  );
}

function RolesSection({
  roles,
  selectedRoles,
  t,
  onToggleRole,
}: {
  roles: RoleWithPermissions[] | undefined;
  selectedRoles: Id<"roles">[];
  t: ReturnType<typeof useScopedI18n>;
  onToggleRole: (roleId: Id<"roles">) => void;
}) {
  if (!roles || roles.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Shield className="size-4" />
        {t("form.rolesWithAccess")}
      </h3>
      <div className="space-y-4 rounded-lg border border-border p-4">
        <p className="text-sm text-muted-foreground">
          {t("form.rolesDescription")}
        </p>
        <div className="space-y-3">
          {roles.map((role) => (
            <div key={role._id} className="flex items-center gap-x-2">
              <Checkbox
                id={`role-${role._id}`}
                checked={selectedRoles.includes(role._id)}
                onCheckedChange={() => onToggleRole(role._id)}
              />
              <Label
                htmlFor={`role-${role._id}`}
                className="flex-1 cursor-pointer text-sm font-normal"
              >
                {role.name}
                {role.description && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    - {role.description}
                  </span>
                )}
              </Label>
            </div>
          ))}
        </div>
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
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function FormActions({
  cancelLabel,
  createLabel,
  creatingLabel,
  isSubmitting,
}: {
  cancelLabel: string;
  createLabel: string;
  creatingLabel: string;
  isSubmitting: boolean;
}) {
  return (
    <div className="flex justify-end gap-4 pt-4">
      <Button type="button" variant="outline" asChild>
        <Link href="/accounts">{cancelLabel}</Link>
      </Button>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Save className="mr-2 size-4" />
        )}
        {isSubmitting ? creatingLabel : createLabel}
      </Button>
    </div>
  );
}
