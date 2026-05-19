"use client";

import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@v1/ui/alert-dialog";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Building2,
  Edit,
  Mail,
  MapPin,
  Phone,
  Shield,
  Trash2,
  User,
  UserCog,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function AccountDetailPage() {
  const t = useScopedI18n("accounts");
  const tCommon = useScopedI18n("common");
  const params = useParams();
  const { push } = useRouter();
  const accountId = params.id as Id<"accounts">;
  const { currentOrganizationId } = useOrganization();
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const account = useQuery(api.accounts.get, { accountId });
  const deleteAccount = useMutation(api.accounts.remove);
  const roles = useQuery(
    api.roles.listRoles,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );
  type Role = NonNullable<typeof roles>[number];

  if (!currentOrganizationId) {
    return (
      <div className="flex size-full items-center justify-center">
        <p className="text-muted-foreground">
          {t("selectOrganizationDescription")}
        </p>
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

  const handleDelete = async () => {
    setError(null);
    setIsDeleting(true);
    try {
      await deleteAccount({ accountId });
      push("/accounts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account");
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex size-full bg-background px-6">
      <div className="z-10 mx-auto flex size-full max-w-screen-xl flex-col gap-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/accounts">
                <ArrowLeft className="mr-2 size-4" />
                Back
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-medium">{account.businessName}</h1>
              </div>
              <p className="font-mono text-sm text-muted-foreground">
                Account: {account.accountNumber}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <PermissionGate permission="loans.update">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/accounts/${accountId}/edit`}>
                  <Edit className="mr-2 size-4" />
                  Edit
                </Link>
              </Button>
            </PermissionGate>
            <PermissionGate permission="loans.update">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={isDeleting}
                  >
                    <Trash2 className="mr-2 size-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Account</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{account.businessName}"?
                      This action cannot be undone. If this account is used in
                      any loans, it cannot be deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? "Deleting..." : "Delete Account"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </PermissionGate>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-6 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Account Details */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-6 text-lg font-medium">Account Information</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Business Information */}
            <div className="space-y-4">
              <div>
                <h3 className="mb-4 text-sm font-medium text-muted-foreground">
                  Business Information
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Building2 className="mt-0.5 size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {account.businessName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Business Name
                      </p>
                    </div>
                  </div>
                  {account.phone && (
                    <div className="flex items-start gap-3">
                      <Phone className="mt-0.5 size-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm">{account.phone}</p>
                        <p className="text-xs text-muted-foreground">Phone</p>
                      </div>
                    </div>
                  )}
                  {account.email && (
                    <div className="flex items-start gap-3">
                      <Mail className="mt-0.5 size-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm">{account.email}</p>
                        <p className="text-xs text-muted-foreground">Email</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Address */}
            {(account.address ||
              account.address2 ||
              account.city ||
              account.zipCode ||
              account.country) && (
              <div className="space-y-4">
                <div>
                  <h3 className="mb-4 text-sm font-medium text-muted-foreground">
                    Address
                  </h3>
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 size-4 text-muted-foreground" />
                    <div className="space-y-1">
                      {account.address && (
                        <p className="text-sm">{account.address}</p>
                      )}
                      {account.address2 && (
                        <p className="text-sm">{account.address2}</p>
                      )}
                      {(account.city || account.zipCode) && (
                        <p className="text-sm">
                          {[account.city, account.zipCode]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      )}
                      {account.country && (
                        <p className="text-sm">{account.country}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Contact Person */}
            {(account.contactPerson ||
              account.contactPhone ||
              account.contactEmail) && (
              <div className="space-y-4">
                <div>
                  <h3 className="mb-4 text-sm font-medium text-muted-foreground">
                    Contact Person
                  </h3>
                  <div className="space-y-3">
                    {account.contactPerson && (
                      <div className="flex items-start gap-3">
                        <User className="mt-0.5 size-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm">{account.contactPerson}</p>
                          <p className="text-xs text-muted-foreground">
                            Contact Name
                          </p>
                        </div>
                      </div>
                    )}
                    {account.contactPhone && (
                      <div className="flex items-start gap-3">
                        <Phone className="mt-0.5 size-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm">{account.contactPhone}</p>
                          <p className="text-xs text-muted-foreground">
                            Contact Phone
                          </p>
                        </div>
                      </div>
                    )}
                    {account.contactEmail && (
                      <div className="flex items-start gap-3">
                        <Mail className="mt-0.5 size-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm">{account.contactEmail}</p>
                          <p className="text-xs text-muted-foreground">
                            Contact Email
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            {account.notes && (
              <div className="space-y-4 md:col-span-2">
                <div>
                  <h3 className="mb-4 text-sm font-medium text-muted-foreground">
                    Notes
                  </h3>
                  <p className="text-sm whitespace-pre-wrap">{account.notes}</p>
                </div>
              </div>
            )}

            {/* Account Type */}
            {account.accountType && (
              <div className="space-y-4">
                <div>
                  <h3 className="mb-4 text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <UserCog className="size-4" />
                    Account Type
                  </h3>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary capitalize">
                        {account.accountType}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Associated Roles */}
            {account.roleIds && account.roleIds.length > 0 && roles && (
              <div className="space-y-4 md:col-span-2">
                <div>
                  <h3 className="mb-4 text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Shield className="size-4" />
                    Roles with Access
                  </h3>
                  <div className="space-y-2">
                    {account.roleIds.map((roleId) => {
                      const role = roles.find((r: Role) => r._id === roleId);
                      if (!role) return null;
                      return (
                        <div
                          key={roleId}
                          className="flex items-center gap-2 rounded-lg border border-border bg-card p-3"
                        >
                          <Shield className="size-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{role.name}</p>
                            {role.description && (
                              <p className="text-xs text-muted-foreground">
                                {role.description}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
