"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { useMutation } from "convex/react";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import {
  DEFAULT_ACCOUNT_HOLDER_TYPE,
  parseDateInputValue,
} from "@/lib/account-holder";
import { useScopedI18n } from "@/locales/client";
import {
  AccountFormFields,
  type AccountFormValues,
} from "../_components/account-form-fields";

const initialFormData: AccountFormValues = {
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
};

export default function NewAccountPage() {
  const t = useScopedI18n("accounts");
  const tCommon = useScopedI18n("common");
  const { push } = useRouter();
  const { currentOrganizationId } = useOrganization();
  const createAccount = useMutation(api.accounts.create);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<AccountFormValues>(initialFormData);

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{t("selectOrganizationCreate")}</p>
      </div>
    );
  }

  const updateFormData = <Key extends keyof AccountFormValues>(
    key: Key,
    value: AccountFormValues[Key],
  ) => {
    setFormData((previous) => ({ ...previous, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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
        accountType: formData.accountType || "institution",
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
    <div className="h-full min-h-0 w-full overflow-y-auto bg-background p-4 sm:p-6 custom-scrollbar">
      <div className="z-10 mx-auto flex w-full max-w-screen-md flex-col">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="flex w-full items-center justify-between rounded-lg p-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/accounts">
                  <ArrowLeft className="mr-2 size-4" />
                  {t("back")}
                </Link>
              </Button>
              <h2 className="text-xl font-medium text-primary">
                {t("newAccount")}
              </h2>
            </div>
          </div>
          <div className="flex w-full px-6">
            <div className="w-full border-b border-border" />
          </div>
          <form onSubmit={handleSubmit} className="space-y-6 p-6">
            {error && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <AccountFormFields
              formData={formData}
              t={t}
              onChange={updateFormData}
            />
            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="outline" asChild>
                <Link href="/accounts">{tCommon("cancel")}</Link>
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Save className="mr-2 size-4" />
                )}
                {isSubmitting ? t("form.creating") : t("form.createButton")}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
