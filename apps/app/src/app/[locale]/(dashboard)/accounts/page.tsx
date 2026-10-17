import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCurrentOrganizationPermissions } from "@/lib/organization-permissions";
import { AccountsPageClient } from "./accounts-page-client";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function AccountsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // The access check streams beside the list so the page stays in the
  // prefetched shell; a missing permission swaps in the not-found page.
  return (
    <>
      <Suspense fallback={null}>
        <AccountsAccessCheck searchParams={searchParams} />
      </Suspense>
      <AccountsPageClient />
    </>
  );
}

async function AccountsAccessCheck({
  searchParams,
}: {
  searchParams: SearchParams;
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

  return null;
}
