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
import {
  DEFAULT_ACCOUNT_HOLDER_TYPE,
  formatDateInputValue,
  holderScopedAccountFields,
  isLoanAccountType,
  isOrganizationHolder,
  resolveAccountHolderType,
  resolveLoanAccountTypeForHolder,
} from "@/lib/account-holder";
import { useScopedI18n } from "@/locales/client";
import { EditAccountDetailsFields } from "./edit-account-details-fields";
import type { EditAccountFormData } from "./edit-account-form-types";
import { EditAccountPermissionsFields } from "./edit-account-permissions-fields";

export default function EditAccountPage() {
  const t = useScopedI18n("accounts");
  const tCommon = useScopedI18n("common");
  const params = useParams();
  const { push, back } = useRouter();
  const accountId = params.id as Id<"accounts">;
  const { currentOrganizationId } = useOrganization();
  const updateAccount = useMutation(api.accounts.update);

  const account = useQuery(api.accounts.get, { accountId });
  const roles = useQuery(
    api.roles.listRoles,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );
  const permissions = useQuery(api.roles.listPermissions, {});

  type Role = NonNullable<typeof roles>[number];
  type Permission = NonNullable<typeof permissions>[number];
  type PermissionCategory = Permission["category"];

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<EditAccountFormData>({
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
    accountType: "",
    selectedRoles: [],
  });

  useEffect(() => {
    if (account) {
      const holderType = resolveAccountHolderType(account.holderType);
      setFormData({
        holderType,
        businessName: account.businessName || "",
        taxId: account.taxId || "",
        dateOfBirth: formatDateInputValue(account.dateOfBirth),
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
        accountType: resolveLoanAccountTypeForHolder(
          holderType,
          isLoanAccountType(account.accountType)
            ? account.accountType
            : undefined,
        ),
        selectedRoles: account.roleIds || [],
      });
    }
  }, [account]);

  // Get roles that have loans permissions
  const rolesWithLoansPermissions = roles?.filter((role: Role) => {
    // Check if role has any loans-related permissions
    return role.permissions.some((perm) => perm.category === "loans");
  });

  const groupedPermissions = permissions?.reduce(
    (
      acc: Partial<Record<PermissionCategory, Permission[]>>,
      perm: Permission,
    ) => {
      const category = perm.category;
      const existing = acc[category] ?? [];
      acc[category] = [...existing, perm];
      return acc;
    },
    {},
  );
  const groupedPermissionEntries = groupedPermissions
    ? (Object.entries(groupedPermissions) as Array<
        [PermissionCategory, Permission[]]
      >)
    : [];

  const toggleRole = (roleId: Id<"roles">) => {
    setFormData((prev) => ({
      ...prev,
      selectedRoles: prev.selectedRoles.includes(roleId)
        ? prev.selectedRoles.filter((id) => id !== roleId)
        : [...prev.selectedRoles, roleId],
    }));
  };

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
    const isOrganization = isOrganizationHolder(formData.holderType);
    if (!formData.businessName.trim()) {
      setError(
        isOrganization
          ? t("form.errors.businessNameRequired")
          : t("form.errors.fullNameRequired"),
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await updateAccount({
        accountId,
        holderType: formData.holderType,
        businessName: formData.businessName,
        ...holderScopedAccountFields(formData.holderType, formData),
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        address: formData.address || undefined,
        address2: formData.address2 || undefined,
        zipCode: formData.zipCode || undefined,
        city: formData.city || undefined,
        country: formData.country || undefined,
        notes: formData.notes || undefined,
        accountType: formData.accountType || undefined,
        roleIds:
          formData.selectedRoles.length > 0
            ? formData.selectedRoles
            : undefined,
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
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/accounts/${accountId}`}>
                <ArrowLeft className="mr-2 size-4" />
                {t("back")}
              </Link>
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            {error && (
              <div className="mb-6 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="mx-auto max-w-2xl space-y-6">
              <EditAccountDetailsFields
                t={t}
                formData={formData}
                setFormData={setFormData}
              />
              <EditAccountPermissionsFields
                t={t}
                formData={formData}
                toggleRole={toggleRole}
                rolesWithLoansPermissions={rolesWithLoansPermissions}
                groupedPermissionEntries={groupedPermissionEntries}
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
