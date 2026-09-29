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
import { useScopedI18n } from "@/locales/client";
import { EditAccountDetailsFields } from "./edit-account-details-fields";
import type { EditAccountFormData } from "./edit-account-form-types";

export default function EditAccountPage() {
  const t = useScopedI18n("accounts");
  const tCommon = useScopedI18n("common");
  const params = useParams();
  const { push, back } = useRouter();
  const accountId = params.id as Id<"accounts">;
  const { currentOrganizationId } = useOrganization();
  const updateAccount = useMutation(api.accounts.update);

  const account = useQuery(api.accounts.get, { accountId });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<EditAccountFormData>({
    businessName: "",
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
        businessName: account.businessName || "",
        phone: account.phone || "",
        email: account.email || "",
        address: account.address || "",
        address2: account.address2 || "",
        zipCode: account.zipCode || "",
        city: account.city || "",
        country: account.country || "",
        contactPerson: account.contactPerson || "",
        contactPhone: account.contactPhone || "",
        contactEmail: account.contactEmail || "",
        notes: account.notes || "",
        accountType: (account.accountType || "") as
          | "lender"
          | "borrower"
          | "both"
          | "institution"
          | "",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.businessName.trim()) {
      setError(t("form.errors.businessNameRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      await updateAccount({
        accountId,
        businessName: formData.businessName,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        address: formData.address || undefined,
        address2: formData.address2 || undefined,
        zipCode: formData.zipCode || undefined,
        city: formData.city || undefined,
        country: formData.country || undefined,
        contactPerson: formData.contactPerson || undefined,
        contactPhone: formData.contactPhone || undefined,
        contactEmail: formData.contactEmail || undefined,
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
    <div className="flex size-full bg-background px-6">
      <div className="z-10 mx-auto flex size-full max-w-screen-xl gap-12">
        <div className="flex min-h-0 w-full flex-col rounded-lg border border-border bg-card">
          <div className="flex w-full shrink-0 items-center justify-between rounded-lg border-b border-border p-6">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/accounts/${accountId}`}>
                <ArrowLeft className="mr-2 size-4" />
                {t("back")}
              </Link>
            </Button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="min-h-0 flex-1 overflow-y-auto p-6 custom-scrollbar"
          >
            {error && (
              <div className="mb-6 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="@container mx-auto max-w-4xl space-y-5">
              <EditAccountDetailsFields
                t={t}
                formData={formData}
                setFormData={setFormData}
              />
              <div className="flex justify-end gap-4">
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
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
