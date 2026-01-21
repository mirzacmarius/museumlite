"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
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
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Loader2, Save, Shield, UserCog } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function EditAccountPage() {
  const t = useScopedI18n("accounts");
  const tCommon = useScopedI18n("common");
  const params = useParams();
  const router = useRouter();
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
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
    accountType: "" as "lender" | "borrower" | "both" | "institution" | "",
    selectedRoles: [] as Id<"roles">[],
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
        selectedRoles: account.roleIds || [],
      });
    }
  }, [account]);

  // Get roles that have loans permissions
  const rolesWithLoansPermissions = roles?.filter((role) => {
    // Check if role has any loans-related permissions
    return role.permissions.some((perm) => perm.category === "loans");
  });

  const groupedPermissions = permissions?.reduce(
    (acc, perm) => {
      const category = perm.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category]!.push(perm);
      return acc;
    },
    {} as Record<string, Array<(typeof permissions)[0]>>,
  );

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
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">{t("selectOrganizationEdit")}</p>
      </div>
    );
  }

  if (account === undefined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-muted-foreground">{tCommon("loading")}</p>
      </div>
    );
  }

  if (account === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
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
        roleIds:
          formData.selectedRoles.length > 0
            ? formData.selectedRoles
            : undefined,
      });
      router.push(`/accounts/${accountId}`);
    } catch (err) {
      console.error("Error updating account:", err);
      setError(
        err instanceof Error ? err.message : t("form.errors.updateFailed"),
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full w-full bg-background px-6">
      <div className="z-10 mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="flex w-full flex-col rounded-lg border border-border bg-card">
          <div className="flex w-full items-center justify-between rounded-lg border-b border-border p-6">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/accounts/${accountId}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
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
              {/* Business Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {t("form.businessInformation")}
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="businessName">
                      {t("form.businessName")}{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="businessName"
                      value={formData.businessName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          businessName: e.target.value,
                        })
                      }
                      placeholder={t("form.placeholders.businessName")}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">{t("form.phone")}</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
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
                          setFormData({ ...formData, email: e.target.value })
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
                        setFormData({ ...formData, address: e.target.value })
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
                        setFormData({ ...formData, address2: e.target.value })
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
                          setFormData({ ...formData, city: e.target.value })
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
                          setFormData({ ...formData, zipCode: e.target.value })
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
                          setFormData({ ...formData, country: e.target.value })
                        }
                        placeholder={t("form.placeholders.country")}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Person */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {t("form.contactPerson")}
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactPerson">
                      {t("form.contactName")}
                    </Label>
                    <Input
                      id="contactPerson"
                      value={formData.contactPerson}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contactPerson: e.target.value,
                        })
                      }
                      placeholder={t("form.placeholders.contactName")}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contactPhone">
                        {t("form.contactPhone")}
                      </Label>
                      <Input
                        id="contactPhone"
                        value={formData.contactPhone}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            contactPhone: e.target.value,
                          })
                        }
                        placeholder={t("form.placeholders.phone")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactEmail">
                        {t("form.contactEmail")}
                      </Label>
                      <Input
                        id="contactEmail"
                        type="email"
                        value={formData.contactEmail}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            contactEmail: e.target.value,
                          })
                        }
                        placeholder={t("form.placeholders.contactEmail")}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">{t("form.notes")}</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder={t("form.placeholders.notes")}
                  rows={4}
                />
              </div>

              {/* Account Type / Role */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <UserCog className="h-4 w-4" />
                  {t("form.accountTypeRole")}
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="accountType">{t("form.accountType")}</Label>
                    <Select
                      value={formData.accountType}
                      onValueChange={(
                        value:
                          | "lender"
                          | "borrower"
                          | "both"
                          | "institution"
                          | "",
                      ) => setFormData({ ...formData, accountType: value })}
                    >
                      <SelectTrigger id="accountType">
                        <SelectValue
                          placeholder={t("form.placeholders.accountType")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lender">
                          {t("types.lender")}
                        </SelectItem>
                        <SelectItem value="borrower">
                          {t("types.borrower")}
                        </SelectItem>
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

              {/* Permissions */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  {t("form.rolesWithAccess")}
                </h3>
                <div className="space-y-4 rounded-lg border border-border p-4">
                  <p className="text-sm text-muted-foreground">
                    {t("form.rolesDescription")}
                  </p>
                  {rolesWithLoansPermissions &&
                  rolesWithLoansPermissions.length > 0 ? (
                    <div className="space-y-3">
                      {rolesWithLoansPermissions.map((role) => (
                        <div
                          key={role._id}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`role-${role._id}`}
                            checked={formData.selectedRoles.includes(role._id)}
                            onCheckedChange={() => toggleRole(role._id)}
                          />
                          <Label
                            htmlFor={`role-${role._id}`}
                            className="text-sm font-normal cursor-pointer flex-1"
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
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No roles found. Roles with loans permissions will appear
                      here.
                    </p>
                  )}
                </div>
              </div>

              {/* Permissions Details */}
              {groupedPermissions &&
                Object.keys(groupedPermissions).length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Available Permissions
                    </h3>
                    <div className="space-y-4 rounded-lg border border-border p-4">
                      {Object.entries(groupedPermissions).map(
                        ([category, perms]) => (
                          <div key={category} className="space-y-2">
                            <h4 className="text-sm font-medium capitalize">
                              {category}
                            </h4>
                            <div className="space-y-1 pl-4">
                              {perms.map((perm) => (
                                <div
                                  key={perm._id}
                                  className="text-xs text-muted-foreground"
                                >
                                  • {perm.name}
                                  {perm.description && (
                                    <span className="ml-2">
                                      - {perm.description}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  {tCommon("cancel")}
                </Button>
                <PermissionGate permission="loans.update">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
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
