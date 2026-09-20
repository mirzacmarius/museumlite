import type { ReactNode } from "react";
import { AdministrationGate } from "@/components/administration-gate";
import { requireCurrentOrganizationPermission } from "@/lib/organization-permissions";
import { SettingsLayoutClient } from "./settings-layout-client";

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireCurrentOrganizationPermission("organization.manage_settings");
  return (
    <AdministrationGate>
      <SettingsLayoutClient>{children}</SettingsLayoutClient>
    </AdministrationGate>
  );
}
