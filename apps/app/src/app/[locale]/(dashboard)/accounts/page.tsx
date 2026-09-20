import { notFound } from "next/navigation";
import { getCurrentOrganizationPermissions } from "@/lib/organization-permissions";
import { AccountsPageClient } from "./accounts-page-client";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ type }, permissions] = await Promise.all([
    searchParams,
    getCurrentOrganizationPermissions(),
  ]);
  const isPatronView = type === "patron";
  const hasAccountRead = permissions?.includes("accounts.read") ?? false;
  const canAccessAdministration =
    permissions?.includes("organization.manage_settings") ?? false;

  if (!hasAccountRead || (!canAccessAdministration && !isPatronView)) {
    notFound();
  }

  return <AccountsPageClient />;
}
