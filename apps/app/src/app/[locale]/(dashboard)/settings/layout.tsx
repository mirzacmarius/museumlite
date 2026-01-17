"use client";
import { I18nProviderClient, useScopedI18n } from "@/locales/client";
import { buttonVariants } from "@v1/ui/button";
import { cn } from "@v1/ui/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { use } from "react";

const LayoutContainer = ({ children }: { children: React.ReactNode }) => {
  const t = useScopedI18n("settings.sidebar");
  const pathname = usePathname();
  const isSettingsPath = pathname === "/settings";
  const isBillingPath = pathname === "/settings/billing";
  const isUsersPath = pathname === "/settings/users";
  const isRolesPath = pathname === "/settings/roles";
  const isOrganizationPath = pathname === "/settings/organization";
  const isIntegrationsPath = pathname?.startsWith("/settings/integrations");
  const isModulesPath = pathname === "/settings/modules";
  const isActivityPath = pathname === "/settings/activity";
  const isDeveloperPath = pathname === "/settings/developer";
  return (
    <div className="flex h-full w-full px-6 py-8">
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
              Organization
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
              Users
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
              Roles
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
              Integrations
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
              Modules
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
              Activity
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
              Developer
            </span>
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
};

export default function Layout({
  children,
  params,
}: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  return (
    <I18nProviderClient locale={locale}>
      <LayoutContainer>{children}</LayoutContainer>
    </I18nProviderClient>
  );
}
