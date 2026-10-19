"use client";
import { buttonVariants } from "@v1/ui/button";
import { Highlight, HighlightScope } from "@v1/ui/motion-highlight";
import { cn } from "@v1/ui/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getUnlocalizedPath } from "@/lib/locale-routes";
import { useScopedI18n } from "@/locales/client";

const LayoutContainer = ({ children }: { children: React.ReactNode }) => {
  const t = useScopedI18n("settings.sidebar");
  const pathname = getUnlocalizedPath(usePathname());
  const isBillingPath = pathname === "/settings/billing";
  const isUsersPath = pathname === "/settings/users";
  const isRolesPath = pathname === "/settings/roles";
  const isSitesPath = pathname === "/settings/sites";
  const isOrganizationPath = pathname.startsWith("/settings/organization");
  const isPreferencesPath = pathname === "/settings/preferences";
  const isIntegrationsPath = pathname.startsWith("/settings/integrations");
  const isModulesPath = pathname === "/settings/modules";
  const isActivityPath = pathname === "/settings/activity";
  const isDeveloperPath = pathname === "/settings/developer";
  const isDataPath = pathname === "/settings/data";
  const isMetricsPath = pathname === "/settings/metrics";
  const isLoanAgreementsPath = pathname === "/settings/loan-agreements";
  const isPreparationRecipesPath = pathname === "/settings/preparation-recipes";
  const navItems = [
    {
      href: "/settings/organization",
      label: t("organization"),
      active: isOrganizationPath,
    },
    {
      href: "/settings/preferences",
      label: t("preferences"),
      active: isPreferencesPath,
    },
    { href: "/settings/users", label: t("users"), active: isUsersPath },
    { href: "/settings/roles", label: t("roles"), active: isRolesPath },
    { href: "/settings/sites", label: t("sites"), active: isSitesPath },
    {
      href: "/settings/loan-agreements",
      label: t("loanAgreements"),
      active: isLoanAgreementsPath,
    },
    {
      href: "/settings/preparation-recipes",
      label: t("preparationRecipes"),
      active: isPreparationRecipesPath,
    },
    {
      href: "/settings/integrations",
      label: t("integrations"),
      active: isIntegrationsPath,
    },
    { href: "/settings/modules", label: t("modules"), active: isModulesPath },
    { href: "/settings/billing", label: t("billing"), active: isBillingPath },
    {
      href: "/settings/activity",
      label: t("activity"),
      active: isActivityPath,
    },
    {
      href: "/settings/developer",
      label: t("developer"),
      active: isDeveloperPath,
    },
    { href: "/settings/data", label: t("data"), active: isDataPath },
    { href: "/settings/metrics", label: t("metrics"), active: isMetricsPath },
  ];

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden px-4 py-4 sm:px-6 sm:py-8">
      <div className="lg:hidden mb-4 -mx-4 px-4 overflow-x-auto scrollbar-none">
        <HighlightScope>
          <div className="isolate flex gap-1 min-w-max pb-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors",
                  item.active
                    ? "text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                {item.active && <Highlight className="bg-muted" />}
                {item.label}
              </Link>
            ))}
          </div>
        </HighlightScope>
      </div>

      <div className="mx-auto flex h-full min-h-0 w-full max-w-screen-xl gap-10 overflow-hidden">
        <HighlightScope>
          <div className="isolate hidden w-full max-w-48 shrink-0 flex-col gap-0.5 lg:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "relative justify-start rounded-md",
                )}
              >
                {item.active && <Highlight className="bg-muted" />}
                <span
                  className={cn(
                    "text-sm text-foreground/80",
                    item.active && "font-medium text-foreground",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        </HighlightScope>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
export function SettingsLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LayoutContainer>{children}</LayoutContainer>;
}
