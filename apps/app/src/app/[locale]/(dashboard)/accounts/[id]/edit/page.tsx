"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { parseDateInputValue } from "@/lib/account-holder";
import { useScopedI18n } from "@/locales/client";
import {
  AccountFormFields,
  type AccountFormValues,
} from "../../_components/account-form-fields";

function formatDateInputValue(timestamp: number | undefined) {
  return timestamp === undefined
    ? ""
    : new Date(timestamp).toISOString().slice(0, 10);
}

export default function EditAccountPage() {
  const t = useScopedI18n("accounts");
  const tCommon = useScopedI18n("common");
  const params = useParams<{ id: Id<"accounts"> }>();
  const accountId = params.id;
  const { push, back } = useRouter();
  const { currentOrganizationId } = useOrganization();
  const updateAccount = useMutation(api.accounts.update);
  const account = useQuery(api.accounts.get, { accountId });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<AccountFormValues>({
    holderType: "organization",
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
    accountType: "",
  });

  useEffect(() => {
    if (account) {
      setFormData({
        holderType: account.holderType ?? "organization",
        businessName: account.businessName ?? "",
        taxId: account.taxId ?? "",
        dateOfBirth: formatDateInputValue(account.dateOfBirth),
        phone: account.phone ?? "",
        email: account.email ?? "",
        address: account.address ?? "",
        address2: account.address2 ?? "",
        zipCode: account.zipCode ?? "",
        city: account.city ?? "",
        country: account.country ?? "",
        contactPerson: account.contactPerson ?? "",
        contactPhone: account.contactPhone ?? "",
        contactEmail: account.contactEmail ?? "",
        notes: account.notes ?? "",
        accountType: account.accountType ?? "",
      });
    }
  }, [account]);

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{t("selectOrganizationEdit")}</p>
      </div>
    );
  }
  if (account === undefined) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{tCommon("loading")}</p>
      </div>
    );
  }
  if (account === null) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">{t("accountNotFound")}</p>
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
      await updateAccount({
        accountId,
        holderType: formData.holderType,
        businessName: formData.businessName,
        taxId: isOrganization ? formData.taxId : undefined,
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
        accountType: formData.accountType || undefined,
      });
      push(`/accounts/${accountId}`);
    } catch (err) {
      console.error("Error updating account:", err);
      setError(
        err instanceof Error ? err.message : t("form.errors.updateFailed"),
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
                <Link href={`/accounts/${accountId}`}>
                  <ArrowLeft className="mr-2 size-4" />
                  {t("back")}
                </Link>
              </Button>
              <h2 className="text-xl font-medium text-primary">
                {t("editAccount")}
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
              <Button type="button" variant="outline" onClick={() => back()}>
                {tCommon("cancel")}
              </Button>
              <PermissionGate permission="loans.update">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 size-4" />
                  )}
                  {isSubmitting ? t("form.updating") : t("form.updateButton")}
                </Button>
              </PermissionGate>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
