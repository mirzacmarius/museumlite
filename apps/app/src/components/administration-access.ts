export const ADMINISTRATOR_PERMISSION = "organization.manage_settings";

export type AdministrationAccess = "admin" | "member" | "unknown";

interface AdministrationAccessInput {
  isLoading: boolean;
  isAdministrator: boolean;
}

export function getAdministrationAccess({
  isLoading,
  isAdministrator,
}: AdministrationAccessInput): AdministrationAccess {
  if (isLoading) return "unknown";
  if (isAdministrator) return "admin";
  return "member";
}

export function isOrganizationSettingsPath(pathname: string | null): boolean {
  return Boolean(pathname?.startsWith("/settings/"));
}
