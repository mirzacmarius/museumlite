"use client";
import { buttonVariants } from "@v1/ui/button";
import { cn } from "@v1/ui/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useScopedI18n } from "@/locales/client";

const LayoutContainer = ({ children }: { children: React.ReactNode }) => {
  const t = useScopedI18n("settings.sidebar");
  const pathname = usePathname();
  const isBillingPath = pathname === "/settings/billing";
  const isUsersPath = pathname === "/settings/users";
  const isRolesPath = pathname === "/settings/roles";
  const isSitesPath = pathname === "/settings/sites";
  const isOrganizationPath = pathname?.startsWith("/settings/organization");
  const isPreferencesPath = pathname === "/settings/preferences";
  const isIntegrationsPath = pathname?.startsWith("/settings/integrations");
  const isModulesPath = pathname === "/settings/modules";
  const isActivityPath = pathname === "/settings/activity";
  const isDeveloperPath = pathname === "/settings/developer";
  const isDataPath = pathname === "/settings/data";
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
  ];

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden px-4 py-4 sm:px-6 sm:py-8">
      <div className="lg:hidden mb-4 -mx-4 px-4 overflow-x-auto scrollbar-none">
        <div className="flex gap-1 min-w-max pb-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors",
                item.active
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mx-auto flex h-full min-h-0 w-full max-w-screen-xl gap-10 overflow-hidden">
        <div className="hidden w-full max-w-48 shrink-0 flex-col gap-0.5 lg:flex">
          <Link
            href="/settings/organization"
            className={cn(
              `${buttonVariants({ variant: "ghost" })} ${isOrganizationPath && "bg-muted"} justify-start rounded-md`,
            )}
          >
            <span
              className={cn(
                `text-sm text-foreground/80 ${isOrganizationPath && "font-medium text-foreground"}`,
              )}
            >
              {t("organization")}
            </span>
          </Link>
          <Link
            href="/settings/preferences"
            className={cn(
              `${buttonVariants({ variant: "ghost" })} ${isPreferencesPath && "bg-muted"} justify-start rounded-md`,
            )}
          >
            <span
              className={cn(
                `text-sm text-foreground/80 ${isPreferencesPath && "font-medium text-foreground"}`,
              )}
            >
              {t("preferences")}
            </span>
          </Link>
          <Link
            href="/settings/users"
            className={cn(
              `${buttonVariants({ variant: "ghost" })} ${isUsersPath && "bg-muted"} justify-start rounded-md`,
            )}
          >
            <span
              className={cn(
                `text-sm text-foreground/80 ${isUsersPath && "font-medium text-foreground"}`,
              )}
            >
              {t("users")}
            </span>
          </Link>
          <Link
            href="/settings/roles"
            className={cn(
              `${buttonVariants({ variant: "ghost" })} ${isRolesPath && "bg-muted"} justify-start rounded-md`,
            )}
          >
            <span
              className={cn(
                `text-sm text-foreground/80 ${isRolesPath && "font-medium text-foreground"}`,
              )}
            >
              {t("roles")}
            </span>
          </Link>
          <Link
            href="/settings/sites"
            className={cn(
              `${buttonVariants({ variant: "ghost" })} ${isSitesPath && "bg-muted"} justify-start rounded-md`,
            )}
          >
            <span
              className={cn(
                `text-sm text-foreground/80 ${isSitesPath && "font-medium text-foreground"}`,
              )}
            >
              {t("sites")}
            </span>
          </Link>
          <Link
            href="/settings/integrations"
            className={cn(
              `${buttonVariants({ variant: "ghost" })} ${isIntegrationsPath && "bg-muted"} justify-start rounded-md`,
            )}
          >
            <span
              className={cn(
                `text-sm text-foreground/80 ${isIntegrationsPath && "font-medium text-foreground"}`,
              )}
            >
              {t("integrations")}
            </span>
          </Link>
          <Link
            href="/settings/modules"
            className={cn(
              `${buttonVariants({ variant: "ghost" })} ${isModulesPath && "bg-muted"} justify-start rounded-md`,
            )}
          >
            <span
              className={cn(
                `text-sm text-foreground/80 ${isModulesPath && "font-medium text-foreground"}`,
              )}
            >
              {t("modules")}
            </span>
          </Link>
          <Link
            href="/settings/billing"
            className={cn(
              `${buttonVariants({ variant: "ghost" })} ${isBillingPath && "bg-muted"} justify-start rounded-md`,
            )}
          >
            <span
              className={cn(
                `text-sm text-foreground/80 ${isBillingPath && "font-medium text-foreground"}`,
              )}
            >
              {t("billing")}
            </span>
          </Link>
          <Link
            href="/settings/activity"
            className={cn(
              `${buttonVariants({ variant: "ghost" })} ${isActivityPath && "bg-muted"} justify-start rounded-md`,
            )}
          >
            <span
              className={cn(
                `text-sm text-foreground/80 ${isActivityPath && "font-medium text-foreground"}`,
              )}
            >
              {t("activity")}
            </span>
          </Link>
          <Link
            href="/settings/developer"
            className={cn(
              `${buttonVariants({ variant: "ghost" })} ${isDeveloperPath && "bg-muted"} justify-start rounded-md`,
            )}
          >
            <span
              className={cn(
                `text-sm text-foreground/80 ${isDeveloperPath && "font-medium text-foreground"}`,
              )}
            >
              {t("developer")}
            </span>
          </Link>
          <Link
            href="/settings/data"
            className={cn(
              `${buttonVariants({ variant: "ghost" })} ${isDataPath && "bg-muted"} justify-start rounded-md`,
            )}
          >
            <span
              className={cn(
                `text-sm text-foreground/80 ${isDataPath && "font-medium text-foreground"}`,
              )}
            >
              {t("data")}
            </span>
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <LayoutContainer>{children}</LayoutContainer>;
}
