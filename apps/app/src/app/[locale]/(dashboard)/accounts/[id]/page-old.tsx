"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { AccountDetailHeader } from "./account-detail-header";
import { AccountDetailInfo } from "./account-detail-info";

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
        <AccountDetailHeader
          accountId={accountId}
          businessName={account.businessName}
          accountNumber={account.accountNumber}
          isDeleting={isDeleting}
          onDelete={handleDelete}
        />

        {error && (
          <div className="mx-6 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <AccountDetailInfo account={account} roles={roles} />
      </div>
    </div>
  );
}
