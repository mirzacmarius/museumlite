"use client";
import { useScopedI18n } from "@/locales/client";
import { buttonVariants } from "@v1/ui/button";
import { cn } from "@v1/ui/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LayoutContainer = ({ children }: { children: React.ReactNode }) => {
  const t = useScopedI18n("settings.sidebar");
  const pathname = usePathname();
  const isSettingsPath = pathname === "/settings";
  const isBillingPath = pathname === "/settings/billing";
  const isUsersPath = pathname === "/settings/users";
  const isRolesPath = pathname === "/settings/roles";
  const isSitesPath = pathname === "/settings/sites";
  const isOrganizationPath = pathname?.startsWith("/settings/organization");
  const isIntegrationsPath = pathname?.startsWith("/settings/integrations");
  const isModulesPath = pathname === "/settings/modules";
  const isActivityPath = pathname === "/settings/activity";
  const isDeveloperPath = pathname === "/settings/developer";
  const isDataPath = pathname === "/settings/data";
  const navItems = [
    { href: "/settings", label: t("general"), active: isSettingsPath },
    {
      href: "/settings/organization",
      label: t("organization"),
      active: isOrganizationPath,
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
    <div className="flex h-full w-full flex-col px-4 sm:px-6 py-4 sm:py-8">
      <div className="lg:hidden mb-4 -mx-4 px-4 overflow-x-auto scrollbar-none">
        <div className="flex gap-1 min-w-max pb-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors",
                item.active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mx-auto flex h-full w-full max-w-screen-xl gap-12">
        <div className="hidden w-full max-w-64 flex-col gap-0.5 lg:flex">
          <Link
            href="/settings"
            className={cn(
              `${buttonVariants({ variant: "ghost" })} ${isSettingsPath && "bg-primary/5"}`,
              "justify-start rounded-md",
            )}
          >
            <span
              className={cn(
                `text-sm text-primary/80 ${isSettingsPath && "font-medium text-primary"}`,
              )}
            >
              {t("general")}
            </span>
          </Link>
          <Link
            href="/settings/organization"
            className={cn(
              `${buttonVariants({ variant: "ghost" })} ${isOrganizationPath && "bg-primary/5"} justify-start rounded-md`,
            )}
          >
            <span
              className={cn(
                `text-sm text-primary/80 ${isOrganizationPath && "font-medium text-primary"}`,
              )}
            >
              {t("organization")}
            </span>
          </Link>
          <Link
            href="/settings/users"
            className={cn(
              `${buttonVariants({ variant: "ghost" })} ${isUsersPath && "bg-primary/5"} justify-start rounded-md`,
            )}
          >
            <span
              className={cn(
                `text-sm text-primary/80 ${isUsersPath && "font-medium text-primary"}`,
              )}
            >
              {t("users")}
            </span>
          </Link>
          <Link
            href="/settings/roles"
            className={cn(
              `${buttonVariants({ variant: "ghost" })} ${isRolesPath && "bg-primary/5"} justify-start rounded-md`,
            )}
          >
            <span
              className={cn(
                `text-sm text-primary/80 ${isRolesPath && "font-medium text-primary"}`,
              )}
            >
              {t("roles")}
            </span>
          </Link>
          <Link
            href="/settings/sites"
            className={cn(
              `${buttonVariants({ variant: "ghost" })} ${isSitesPath && "bg-primary/5"} justify-start rounded-md`,
            )}
          >
            <span
              className={cn(
                `text-sm text-primary/80 ${isSitesPath && "font-medium text-primary"}`,
              )}
            >
              {t("sites")}
            </span>
          </Link>
          <Link
            href="/settings/integrations"
            className={cn(
              `${buttonVariants({ variant: "ghost" })} ${isIntegrationsPath && "bg-primary/5"} justify-start rounded-md`,
            )}
          >
            <span
              className={cn(
                `text-sm text-primary/80 ${isIntegrationsPath && "font-medium text-primary"}`,
              )}
            >
              {t("integrations")}
            </span>
          </Link>
          <Link
            href="/settings/modules"
            className={cn(
              `${buttonVariants({ variant: "ghost" })} ${isModulesPath && "bg-primary/5"} justify-start rounded-md`,
            )}
          >
            <span
              className={cn(
                `text-sm text-primary/80 ${isModulesPath && "font-medium text-primary"}`,
              )}
            >
              {t("modules")}
            </span>
          </Link>
          <Link
            href="/settings/billing"
            className={cn(
              `${buttonVariants({ variant: "ghost" })} ${isBillingPath && "bg-primary/5"} justify-start rounded-md`,
            )}
          >
            <span
              className={cn(
                `text-sm text-primary/80 ${isBillingPath && "font-medium text-primary"}`,
              )}
            >
              {t("billing")}
            </span>
          </Link>
          <Link
            href="/settings/activity"
            className={cn(
              `${buttonVariants({ variant: "ghost" })} ${isActivityPath && "bg-primary/5"} justify-start rounded-md`,
            )}
          >
            <span
              className={cn(
                `text-sm text-primary/80 ${isActivityPath && "font-medium text-primary"}`,
              )}
            >
              {t("activity")}
            </span>
          </Link>
          <Link
            href="/settings/developer"
            className={cn(
              `${buttonVariants({ variant: "ghost" })} ${isDeveloperPath && "bg-primary/5"} justify-start rounded-md`,
            )}
          >
            <span
              className={cn(
                `text-sm text-primary/80 ${isDeveloperPath && "font-medium text-primary"}`,
              )}
            >
              {t("developer")}
            </span>
          </Link>
          <Link
            href="/settings/data"
            className={cn(
              `${buttonVariants({ variant: "ghost" })} ${isDataPath && "bg-primary/5"} justify-start rounded-md`,
            )}
          >
            <span
              className={cn(
                `text-sm text-primary/80 ${isDataPath && "font-medium text-primary"}`,
              )}
            >
              {t("data")}
            </span>
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <LayoutContainer>{children}</LayoutContainer>;
}
