import type { ReactNode } from "react";
import { AdministrationGate } from "@/components/administration-gate";
import { requireCurrentOrganizationPermission } from "@/lib/organization-permissions";

export default async function MediaLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireCurrentOrganizationPermission("organization.manage_settings");
  return <AdministrationGate>{children}</AdministrationGate>;
}
