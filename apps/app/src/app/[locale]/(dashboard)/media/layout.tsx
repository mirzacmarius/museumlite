import type { ReactNode } from "react";
import { AdministrationGate } from "@/components/administration-gate";
import { RequireOrganizationPermission } from "@/components/require-organization-permission";

export default function MediaLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <RequireOrganizationPermission permission="organization.manage_settings" />
      <AdministrationGate>{children}</AdministrationGate>
    </>
  );
}
