import type { ReactNode } from "react";
import { AdministrationGate } from "@/components/administration-gate";
import { RequireOrganizationPermission } from "@/components/require-organization-permission";
import { SettingsLayoutClient } from "./settings-layout-client";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <RequireOrganizationPermission permission="organization.manage_settings" />
      <AdministrationGate>
        <SettingsLayoutClient>{children}</SettingsLayoutClient>
      </AdministrationGate>
    </>
  );
}
