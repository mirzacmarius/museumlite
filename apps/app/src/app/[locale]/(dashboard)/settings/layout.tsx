"use client";

import { buttonVariants } from "@v1/ui/button";
import { cn } from "@v1/ui/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ADMINISTRATOR_PERMISSION,
  isOrganizationSettingsPath,
} from "@/components/administration-access";
import { usePermissions } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";

interface SettingsNavItem {
  href: string;
  label: string;
  active: boolean;
}

const PREFIX_MATCH_HREFS = new Set([
  "/settings/organization",
  "/settings/integrations",
]);

function isSettingsNavActive(pathname: string | null, href: string): boolean {
  if (PREFIX_MATCH_HREFS.has(href)) return Boolean(pathname?.startsWith(href));
  return pathname === href;
}

function SettingsCenteredStatus({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center px-6">
      {children}
    </div>
  );
}

const LayoutContainer = ({ children }: { children: React.ReactNode }) => {
  const t = useScopedI18n("settings.sidebar");
  const pathname = usePathname();
  const { hasPermission, isLoading } = usePermissions();
  const isAdministrator = hasPermission(ADMINISTRATOR_PERMISSION);

  if (isLoading) {
    return (
      <SettingsCenteredStatus>
        <div className="size-8 animate-pulse rounded-full bg-muted" />
      </SettingsCenteredStatus>
    );
  }

  if (!isAdministrator && isOrganizationSettingsPath(pathname)) {
    return (
      <SettingsCenteredStatus>
        <p className="text-muted-foreground">{t("noAccess")}</p>
      </SettingsCenteredStatus>
    );
  }

  const navItems: SettingsNavItem[] = [
    { href: "/settings/organization", label: t("organization") },
    { href: "/settings/preferences", label: t("preferences") },
    { href: "/settings/users", label: t("users") },
    { href: "/settings/roles", label: t("roles") },
    { href: "/settings/sites", label: t("sites") },
    { href: "/settings/integrations", label: t("integrations") },
    { href: "/settings/modules", label: t("modules") },
    { href: "/settings/billing", label: t("billing") },
    { href: "/settings/activity", label: t("activity") },
    { href: "/settings/developer", label: t("developer") },
    { href: "/settings/data", label: t("data") },
  ].map((item) => ({
    ...item,
    active: isSettingsNavActive(pathname, item.href),
  }));

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden px-4 py-4 sm:px-6 sm:py-8">
      {isAdministrator ? (
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
      ) : null}

      <div className="mx-auto flex h-full min-h-0 w-full max-w-screen-xl gap-10 overflow-hidden">
        {isAdministrator ? (
          <div className="hidden w-full max-w-48 shrink-0 flex-col gap-0.5 lg:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  `${buttonVariants({ variant: "ghost" })} ${item.active && "bg-muted"} justify-start rounded-md`,
                )}
              >
                <span
                  className={cn(
                    `text-sm text-foreground/80 ${item.active && "font-medium text-foreground"}`,
                  )}
                >
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <LayoutContainer>{children}</LayoutContainer>;
}
