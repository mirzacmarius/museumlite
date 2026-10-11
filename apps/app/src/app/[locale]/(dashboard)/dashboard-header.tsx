"use client";

import { Separator } from "@v1/ui/separator";
import { SidebarTrigger } from "@v1/ui/sidebar";
import { Building2 } from "lucide-react";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";

const pageTitleKeys: Record<string, string> = {
  accessions: "accessions",
  accounts: "accounts",
  activity: "activity",
  analytics: "analytics",
  assignments: "assignments",
  collections: "collections",
  conservation: "conservation",
  deaccessions: "deaccessions",
  exhibitions: "exhibitions",
  insurance: "insurance",
  installations: "installations",
  library: "library",
  loans: "loans",
  locations: "locations",
  media: "media",
  notifications: "notifications",
  organizations: "organizations",
  portal: "portal",
  scan: "scan",
  settings: "settings",
  transit: "transit",
  transfers: "transfers",
};

export function DashboardHeader({ children }: { children: ReactNode }) {
  const { currentOrganization } = useOrganization();
  const pathname = usePathname();
  const params = useParams();
  const locale = params?.locale as string;
  // A record page names its section; the record's identifier means nothing.
  const recordId = typeof params?.id === "string" ? params.id : undefined;
  const t = useScopedI18n("untranslatedDashboard.dashboardHeader");
  const tEntries = useScopedI18n("objectEntries");
  const tQuality = useScopedI18n("documentationQuality");
  const tReproduction = useScopedI18n("reproductionRequests");
  const tInventory = useScopedI18n("inventory");
  const tRecipes = useScopedI18n("preparationRecipes");

  const getPageTitle = (path: string) => {
    // Strip only a leading locale segment: "/entries" also contains "/en".
    const cleanPath =
      path === `/${locale}`
        ? "/"
        : path.startsWith(`/${locale}/`)
          ? path.slice(locale.length + 1)
          : path;

    if (cleanPath === "/" || cleanPath === "") return t("overview");
    if (cleanPath === "/objects/new") return t("newObject");
    if (/^\/objects\/[^/]+\/edit$/.test(cleanPath)) return t("editObject");
    if (/^\/objects\/[^/]+$/.test(cleanPath)) return t("objectDetails");
    if (cleanPath.startsWith("/objects")) return t("objectCatalog");
    if (cleanPath === "/exhibitions/new") return t("newExhibition");
    if (/^\/exhibitions\/[^/]+\/edit$/.test(cleanPath))
      return t("editExhibition");
    if (/^\/exhibitions\/[^/]+$/.test(cleanPath)) return t("exhibitionDetails");
    if (cleanPath.startsWith("/exhibitions")) return t("exhibitions");
    if (cleanPath === "/accessions/entries") return tEntries("title");
    if (cleanPath === "/accessions/entries/new")
      return tEntries("receiveForm.title");
    if (/^\/accessions\/entries\/[^/]+$/.test(cleanPath))
      return tEntries("columns.entry");
    if (cleanPath === "/documentation-quality") return tQuality("title");
    if (/^\/documentation-quality\/[^/]+$/.test(cleanPath))
      return tQuality("detail.headerTitle");
    if (cleanPath === "/reproduction-requests") return tReproduction("title");
    if (/^\/reproduction-requests\/[^/]+$/.test(cleanPath))
      return tReproduction("headerTitle");
    if (cleanPath === "/settings/preparation-recipes") return tRecipes("title");
    if (cleanPath === "/inventory" || cleanPath.startsWith("/inventory/"))
      return tInventory("title");

    // A page without its own title (new, edit, import, a record) is named by
    // its section; route words are never shown as English titles.
    const section = cleanPath
      .split("/")
      .filter((part) => part && part !== recordId)
      .findLast((part) => pageTitleKeys[part]);
    return section ? t(`pageTitles.${pageTitleKeys[section]}`) : t("overview");
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="-ml-1 shrink-0" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <span className="hidden min-w-0 items-center gap-2 text-muted-foreground sm:flex">
            <Building2 className="size-3.5 shrink-0" />
            <span className="truncate">
              {currentOrganization?.name ?? "MuseumLite"}
            </span>
          </span>
          <span className="hidden text-muted-foreground/60 sm:inline">/</span>
          <span className="truncate font-medium text-foreground">
            {getPageTitle(pathname)}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">{children}</div>
    </header>
  );
}
