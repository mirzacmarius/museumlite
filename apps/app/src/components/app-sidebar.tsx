"use client";

import {
  BarChart3,
  BookCopy,
  BookUser,
  Building2,
  CalendarRange,
  Check,
  ChevronRight,
  ChevronsUpDown,
  ClipboardList,
  DollarSign,
  FileCheck,
  FileHeart,
  FileX,
  History,
  Image,
  Inbox,
  LayoutGrid,
  Library,
  LogOut,
  MapPin,
  Microscope,
  Plus,
  Presentation,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";
import * as React from "react";

import { LanguageSwitcher } from "@/app/[locale]/(dashboard)/_components/language-switcher";
import { ThemeSwitcher } from "@/app/[locale]/(dashboard)/_components/theme-switcher";
import { useCommandPalette } from "@/components/command-palette-provider";
import { useOrganization } from "@/components/organization-provider";
import { useAuthActions } from "@convex-dev/auth/react";
import { CheckoutLink } from "@convex-dev/polar/react";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@v1/ui/avatar";
import { Button } from "@v1/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Logo } from "@v1/ui/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@v1/ui/sidebar";
import { cn } from "@v1/ui/utils";
import { type Preloaded, usePreloadedQuery, useQuery } from "convex/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const COLLECTION_COLORS = [
  "#d97706",
  "#059669",
  "#2563eb",
  "#e11d48",
  "#7c3aed",
  "#0891b2",
];

function NavSection({
  title,
  children,
  defaultOpen = false,
  forceOpen = false,
  actionIcon,
  onAction,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  actionIcon?: React.ReactNode;
  onAction?: () => void;
}) {
  return (
    <details
      className="group/section px-1 mb-2 group-data-[collapsible=icon]:hidden"
      open={defaultOpen || forceOpen}
    >
      <summary className="px-2 pb-2 flex items-center justify-between cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:text-foreground/80 text-muted-foreground transition-colors group/summary">
        <span className="text-[10px] font-medium uppercase tracking-widest">
          {title}
        </span>
        <div className="flex items-center gap-2">
          {actionIcon && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onAction?.();
              }}
              className="opacity-0 group-hover/summary:opacity-100 transition-opacity hover:text-foreground"
            >
              {actionIcon}
            </button>
          )}
          <ChevronRight className="w-3 h-3 transition-transform duration-200 group-open/section:rotate-90" />
        </div>
      </summary>
      <div className="space-y-0.5 pt-1">{children}</div>
    </details>
  );
}

function NavItem({
  href,
  icon: Icon,
  title,
  isActive,
  badge,
  indicator,
  colorIndicator,
}: {
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  isActive?: boolean;
  badge?: string | number;
  indicator?: boolean;
  colorIndicator?: string;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={title}
        className={cn(
          "flex items-center gap-2.5 px-3 py-1.5 text-xs rounded-md transition-all group h-auto",
          isActive
            ? "text-foreground bg-muted/40 border border-border shadow-sm hover:bg-muted/40 hover:text-foreground"
            : "text-muted-foreground hover:bg-muted/30 hover:text-foreground bg-transparent border border-transparent",
        )}
      >
        <Link href={href}>
          {colorIndicator ? (
            <div
              className="w-1 h-4 rounded-full border"
              style={{
                backgroundColor: `${colorIndicator}20`,
                borderColor: `${colorIndicator}40`,
              }}
            />
          ) : Icon ? (
            <Icon
              className={cn(
                "size-4 shrink-0",
                isActive
                  ? "text-accent"
                  : "group-hover:text-muted-foreground transition-colors",
              )}
            />
          ) : null}
          <span className="font-medium flex-1">{title}</span>
          {badge !== undefined && (
            <span className="ml-auto text-[9px] bg-muted text-muted-foreground px-1 rounded">
              {badge}
            </span>
          )}
          {indicator && (
            <span className="ml-auto w-1.5 h-1.5 bg-indigo-500 rounded-full" />
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar({
  preloadedUser,
  preloadedProducts,
}: {
  preloadedUser: Preloaded<typeof api.users.getUser>;
  preloadedProducts: Preloaded<typeof api.subscriptions.listAllProducts>;
}) {
  const { organizations, currentOrganizationId, setCurrentOrganizationId } =
    useOrganization();
  const { setOpen } = useCommandPalette();
  const user = usePreloadedQuery(preloadedUser);
  const products = usePreloadedQuery(preloadedProducts);
  const { signOut } = useAuthActions();
  const pathname = usePathname();
  const router = useRouter();

  const openCommandPalette = React.useCallback(() => {
    setOpen(true);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("command-palette:open"));
    }
  }, [setOpen]);

  const monthlyProProduct = products?.find(
    (product) => product.recurringInterval === "month",
  );
  const yearlyProProduct = products?.find(
    (product) => product.recurringInterval === "year",
  );

  const currentOrg = organizations.find(
    (org) => org._id === currentOrganizationId,
  );

  const isLibraryEnabled = useQuery(
    api.integrations.isEnabled,
    currentOrganizationId
      ? {
          organizationId: currentOrganizationId as Id<"organizations">,
          integrationId: "library",
        }
      : "skip",
  );

  const collectionGroups = useQuery(
    api.collectionGroups.list,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const navWorkspace = [
    { title: "All Objects", url: "/objects", icon: LayoutGrid },
    { title: "New Arrivals", url: "/accessions", icon: Inbox, indicator: true },
    {
      title: "My Assignments",
      url: "/assignments",
      icon: ClipboardList,
    },
    { title: "Recent Activity", url: "/activity", icon: History },
  ];

  const navExhibitions = [
    { title: "Active Rotations", url: "/exhibitions", icon: Presentation },
    {
      title: "Planning Queue",
      url: "/exhibitions?status=planning",
      icon: CalendarRange,
    },
  ];

  const navConservation = [
    {
      title: "Lab Requests",
      url: "/conservation",
      icon: Microscope,
      badge: "2",
    },
    {
      title: "Condition Reports",
      url: "/conservation?type=reports",
      icon: FileHeart,
    },
  ];

  const navManagement = [
    { title: "Analytics", url: "/analytics", icon: BarChart3 },
    { title: "Donors & Sources", url: "/accounts", icon: Users },
    { title: "Loans & Transport", url: "/loans", icon: Truck },
    { title: "Locations", url: "/locations", icon: MapPin },
    { title: "Media Library", url: "/media", icon: Image },
    { title: "Accessions", url: "/accessions", icon: FileCheck },
    { title: "Deaccessions", url: "/deaccessions", icon: FileX },
    {
      title: "Insurance & Audit",
      url: "/settings/activity",
      icon: ShieldCheck,
    },
    { title: "Settings", url: "/settings", icon: Settings2 },
  ];

  const navLibrary = [
    { title: "Overview", url: "/library", icon: Library },
    { title: "Catalog", url: "/library/catalog", icon: BookCopy },
    { title: "Patrons", url: "/accounts?type=patron", icon: BookUser },
    { title: "Circulation", url: "/library/circulation", icon: RefreshCw },
    { title: "Fines", url: "/library/fines", icon: DollarSign },
    { title: "Acquisitions", url: "/library/acquisitions", icon: ShoppingCart },
  ];

  const isPathActive = (url: string) => {
    if (url === "/") return pathname === "/";
    if (url.includes("?")) {
      const basePath = url.split("?")[0];
      return pathname?.startsWith(basePath ?? "");
    }
    return pathname?.startsWith(url);
  };

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border bg-background"
    >
      <SidebarHeader className="bg-background p-3 border-b border-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-muted/50 transition-all duration-200 group border border-transparent hover:border-border data-[state=open]:bg-muted/50 outline-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-md shadow-inner flex items-center justify-center text-primary-foreground font-medium text-xs border border-primary/10 shrink-0">
                      <Logo className="size-5 text-primary-foreground" />
                    </div>
                    <div className="flex flex-col text-left group-data-[collapsible=icon]:hidden">
                      <span className="text-xs font-medium text-foreground group-hover:text-foreground transition-colors truncate max-w-[120px]">
                        {currentOrg?.name || "Select Org"}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                        {currentOrg?.role.name || "No Organization"}
                      </span>
                    </div>
                  </div>
                  <ChevronsUpDown className="size-3.5 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors group-data-[collapsible=icon]:hidden" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg bg-popover border-border"
                align="start"
                side="bottom"
                sideOffset={4}
              >
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Organizations
                </DropdownMenuLabel>
                {organizations.map((org) => (
                  <DropdownMenuItem
                    key={org._id}
                    onClick={() => setCurrentOrganizationId(org._id)}
                    className="gap-2 p-2 focus:bg-muted focus:text-foreground"
                  >
                    <div className="flex size-6 items-center justify-center rounded-sm border border-border bg-muted">
                      <Building2 className="size-4 shrink-0 text-muted-foreground" />
                    </div>
                    <span className="text-foreground">{org.name}</span>
                    {currentOrganizationId === org._id && (
                      <Check className="ml-auto size-4 text-accent" />
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="bg-border/50" />
                <DropdownMenuItem
                  className="gap-2 p-2 focus:bg-muted focus:text-foreground"
                  onClick={() => router.push("/organizations/new")}
                >
                  <div className="flex size-6 items-center justify-center rounded-md border border-border bg-muted">
                    <Plus className="size-4 text-muted-foreground" />
                  </div>
                  <div className="font-medium text-muted-foreground">
                    Add organization
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="py-4 px-2 gap-0 overflow-y-auto">
        <div className="px-2 mb-6 group-data-[collapsible=icon]:hidden">
          <div className="relative group">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-foreground/80 transition-colors" />
            <input
              type="text"
              placeholder="Search objects, loans..."
              className="w-full bg-muted/40 border border-border rounded-md text-xs py-1.5 pl-8 pr-3 text-foreground/80 placeholder-muted-foreground/60 focus:outline-none focus:bg-muted focus:border-input transition-all cursor-pointer"
              readOnly
              onClick={openCommandPalette}
              onFocus={openCommandPalette}
            />
            <div className="absolute right-2 top-1.5 flex gap-1">
              <span className="text-[10px] bg-muted text-muted-foreground px-1 rounded border border-input">
                ⌘K
              </span>
            </div>
          </div>
        </div>

        <div className="px-1 mb-6">
          <div className="px-2 pb-2 text-[10px] font-medium text-muted-foreground uppercase tracking-widest group-data-[collapsible=icon]:hidden">
            Workspace
          </div>
          <SidebarMenu>
            {navWorkspace.map((item) => (
              <NavItem
                key={item.title}
                href={item.url}
                icon={item.icon}
                title={item.title}
                isActive={isPathActive(item.url)}
                indicator={item.indicator}
              />
            ))}
          </SidebarMenu>
        </div>

        <NavSection
          title="Collections"
          defaultOpen
          actionIcon={<Plus className="w-3 h-3" />}
          onAction={() => router.push("/collections/new")}
        >
          <SidebarMenu>
            {collectionGroups?.slice(0, 5).map((group, index) => (
              <NavItem
                key={group._id}
                href={`/objects?collectionGroup=${group._id}`}
                title={group.name}
                isActive={pathname?.includes(`collectionGroup=${group._id}`)}
                colorIndicator={
                  COLLECTION_COLORS[index % COLLECTION_COLORS.length]
                }
              />
            ))}
            {(!collectionGroups || collectionGroups.length === 0) && (
              <div className="px-3 py-2 text-[11px] text-muted-foreground/60">
                No collections yet
              </div>
            )}
            {collectionGroups && collectionGroups.length > 5 && (
              <NavItem
                href="/collections"
                title={`View all ${collectionGroups.length} collections`}
                isActive={pathname === "/collections"}
              />
            )}
          </SidebarMenu>
        </NavSection>

        <NavSection
          title="Exhibitions"
          forceOpen={navExhibitions.some((item) => isPathActive(item.url))}
        >
          <SidebarMenu>
            {navExhibitions.map((item) => (
              <NavItem
                key={item.title}
                href={item.url}
                icon={item.icon}
                title={item.title}
                isActive={isPathActive(item.url)}
              />
            ))}
          </SidebarMenu>
        </NavSection>

        <NavSection
          title="Conservation"
          forceOpen={navConservation.some((item) => isPathActive(item.url))}
        >
          <SidebarMenu>
            {navConservation.map((item) => (
              <NavItem
                key={item.title}
                href={item.url}
                icon={item.icon}
                title={item.title}
                isActive={isPathActive(item.url)}
                badge={item.badge}
              />
            ))}
          </SidebarMenu>
        </NavSection>

        <NavSection
          title="Management"
          forceOpen={navManagement.some((item) => isPathActive(item.url))}
        >
          <SidebarMenu>
            {navManagement.map((item) => (
              <NavItem
                key={item.title}
                href={item.url}
                icon={item.icon}
                title={item.title}
                isActive={isPathActive(item.url)}
              />
            ))}
          </SidebarMenu>
        </NavSection>

        {isLibraryEnabled && (
          <NavSection
            title="Library"
            forceOpen={navLibrary.some((item) => isPathActive(item.url))}
          >
            <SidebarMenu>
              {navLibrary.map((item) => (
                <NavItem
                  key={item.title}
                  href={item.url}
                  icon={item.icon}
                  title={item.title}
                  isActive={isPathActive(item.url)}
                />
              ))}
            </SidebarMenu>
          </NavSection>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-border bg-background">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors text-left outline-none group-data-[state=open]:bg-muted/50"
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-8 w-8 rounded-full border border-input">
                      <AvatarImage
                        src={user?.avatarUrl ?? undefined}
                        alt={user?.name ?? undefined}
                      />
                      <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-background rounded-full" />
                  </div>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-xs font-medium text-foreground truncate">
                      {user?.name ?? undefined}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {user?.email ?? undefined}
                    </p>
                  </div>
                  <ChevronsUpDown className="ml-auto size-3.5 text-muted-foreground/60 group-data-[collapsible=icon]:hidden" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg bg-popover border-border text-foreground/80"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage
                        src={user?.avatarUrl ?? undefined}
                        alt={user?.name ?? undefined}
                      />
                      <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {user?.name ?? undefined}
                      </span>
                      <span className="truncate text-xs">
                        {user?.email ?? undefined}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border" />
                {monthlyProProduct && yearlyProProduct && (
                  <>
                    <DropdownMenuItem className="p-0 focus:bg-transparent">
                      <Button size="sm" className="w-full" asChild>
                        <CheckoutLink
                          polarApi={api.subscriptions}
                          productIds={[
                            monthlyProProduct.id,
                            yearlyProProduct.id,
                          ]}
                        >
                          Upgrade to PRO
                        </CheckoutLink>
                      </Button>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-border" />
                  </>
                )}
                <DropdownMenuItem className="flex justify-between focus:bg-muted focus:text-foreground">
                  <span>Theme</span>
                  <ThemeSwitcher />
                </DropdownMenuItem>
                <DropdownMenuItem className="flex justify-between focus:bg-muted focus:text-foreground">
                  <span>Language</span>
                  <LanguageSwitcher />
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="focus:bg-muted focus:text-foreground"
                >
                  <LogOut className="mr-2 size-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
