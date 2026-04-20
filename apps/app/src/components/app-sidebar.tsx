"use client";

import {
  Activity,
  ArrowRightLeft,
  BookOpen,
  Building2,
  Check,
  ChevronRight,
  ChevronsUpDown,
  Container,
  Database,
  FileCheck,
  FileX,
  GalleryVerticalEnd,
  Globe,
  Hammer,
  IdCard,
  Image,
  LayoutGrid,
  Lock,
  LogOut,
  MapPin,
  Plus,
  QrCode,
  Search,
  Settings2,
  Shield,
  ShoppingCart,
  Ticket,
  Truck,
  Users,
} from "lucide-react";
import * as React from "react";

import { LanguageSwitcher } from "@/app/[locale]/(dashboard)/_components/language-switcher";
import { ThemeSwitcher } from "@/app/[locale]/(dashboard)/_components/theme-switcher";
import { useCommandPalette } from "@/components/command-palette-provider";
import { useOrganization } from "@/components/organization-provider";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useAuthActions } from "@convex-dev/auth/react";
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
      <summary className="px-2 pb-2 flex items-center justify-between cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:text-zinc-300 text-zinc-500 transition-colors group/summary">
        <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 group-hover/summary:text-zinc-300 transition-colors">
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
              className="opacity-0 group-hover/summary:opacity-100 transition-opacity hover:text-zinc-200"
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
  locked,
}: {
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  isActive?: boolean;
  badge?: string | number;
  indicator?: boolean;
  colorIndicator?: string;
  locked?: boolean;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={title}
        disabled={locked}
        className={cn(
          "flex items-center gap-2.5 px-3 py-1.5 text-xs rounded-md transition-all group h-auto",
          isActive
            ? "bg-zinc-800/40 border border-zinc-800/60 shadow-sm text-zinc-200 hover:bg-zinc-800/60 hover:text-zinc-100"
            : "text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200 bg-transparent border border-transparent",
          locked && "opacity-70 pointer-events-none",
        )}
      >
        <Link
          href={href}
          onClick={locked ? (e) => e.preventDefault() : undefined}
        >
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
                  ? "text-indigo-400"
                  : "group-hover:text-zinc-300 transition-colors",
              )}
            />
          ) : null}
          <span className="font-medium flex-1">{title}</span>
          {locked ? (
            <Lock className="ml-auto size-3 text-zinc-500/60" />
          ) : (
            <>
              {badge !== undefined && (
                <span className="ml-auto text-[9px] bg-zinc-900 text-zinc-400 px-1 rounded border border-zinc-800">
                  {badge}
                </span>
              )}
              {indicator && (
                <span className="ml-auto w-1.5 h-1.5 bg-indigo-500 rounded-full" />
              )}
            </>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar({
  preloadedUser,
}: {
  preloadedUser: Preloaded<typeof api.users.getUser>;
}) {
  const { organizations, currentOrganizationId, setCurrentOrganizationId } =
    useOrganization();
  const { hasFeature, hasModule } = useFeatureAccess();
  const { setOpen } = useCommandPalette();
  const user = usePreloadedQuery(preloadedUser);
  const { signOut } = useAuthActions();
  const pathname = usePathname();
  const router = useRouter();

  const openCommandPalette = React.useCallback(() => {
    setOpen(true);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("command-palette:open"));
    }
  }, [setOpen]);

  const currentOrg = organizations.find(
    (org) => org._id === currentOrganizationId,
  );

  const showLibrarySection = hasModule("library");

  const collectionGroups = useQuery(
    api.collectionGroups.list,
    currentOrganizationId
      ? { organizationId: currentOrganizationId as Id<"organizations"> }
      : "skip",
  );

  const navCoreInventory = [
    { title: "Overview", url: "/", icon: LayoutGrid },
    { title: "Object Catalog", url: "/objects", icon: Database },
    { title: "Scan", url: "/scan", icon: QrCode },
    { title: "Accessions", url: "/accessions", icon: FileCheck },
    { title: "Deaccessions", url: "/deaccessions", icon: FileX },
    { title: "Transfers", url: "/transfers", icon: ArrowRightLeft },
    { title: "Location & Tracking", url: "/locations", icon: MapPin },
  ];

  const navExhibitionsLoans = [
    {
      title: "Loans & Transport",
      url: "/loans",
      icon: Truck,
      locked: !hasFeature("loans"),
    },
    {
      title: "Transit Log",
      url: "/transit",
      icon: Container,
      locked: !hasFeature("loans"),
    },
    {
      title: "Exhibitions",
      url: "/exhibitions",
      icon: GalleryVerticalEnd,
      locked: !hasFeature("exhibitions"),
    },
    {
      title: "Installations",
      url: "/installations",
      icon: Hammer,
      locked: !hasFeature("installations"),
    },
  ];

  const navConservation = [
    {
      title: "Conservation",
      url: "/conservation",
      icon: Activity,
      locked: !hasFeature("conservation"),
    },
    {
      title: "Insurance",
      url: "/insurance",
      icon: Shield,
      locked: !hasFeature("conservation"),
    },
  ];

  const navLibrary = [
    { title: "Catalog & Search", url: "/library/catalog", icon: BookOpen },
    { title: "Circulation Desk", url: "/library/circulation", icon: IdCard },
    { title: "Patron Management", url: "/accounts?type=patron", icon: Users },
    { title: "Fines & Fees", url: "/library/fines", icon: Ticket },
    { title: "Acquisitions", url: "/library/acquisitions", icon: ShoppingCart },
  ];

  const navAdministration = [
    {
      title: "Public Portal",
      url: "/portal",
      icon: Globe,
      locked: !hasFeature("public_portal"),
    },
    { title: "Digital Assets", url: "/media", icon: Image },
    { title: "Settings", url: "/settings", icon: Settings2 },
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
      className="border-r border-zinc-800/60 bg-zinc-950"
    >
      <SidebarHeader className="bg-zinc-950 p-3 border-b border-zinc-800/60">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild id="org-menu-trigger">
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-zinc-900 transition-all duration-200 group border border-transparent hover:border-zinc-800 data-[state=open]:bg-zinc-900 outline-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-8 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-md shadow-inner flex items-center justify-center text-white font-medium text-xs border border-white/10 shrink-0">
                      <Logo className="size-5 text-white" />
                    </div>
                    <div className="flex flex-col text-left group-data-[collapsible=icon]:hidden">
                      <span className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors truncate max-w-[120px]">
                        {currentOrg?.name || "Select Org"}
                      </span>
                      <span className="text-[10px] text-zinc-500 truncate max-w-[120px]">
                        {currentOrg?.role.name || "No Organization"}
                      </span>
                    </div>
                  </div>
                  <ChevronsUpDown className="size-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors group-data-[collapsible=icon]:hidden" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg bg-zinc-950 border-zinc-800"
                align="start"
                side="bottom"
                sideOffset={4}
              >
                <DropdownMenuLabel className="text-xs text-zinc-500">
                  Organizations
                </DropdownMenuLabel>
                {organizations.map((org) => (
                  <DropdownMenuItem
                    key={org._id}
                    onClick={() => setCurrentOrganizationId(org._id)}
                    className="gap-2 p-2 focus:bg-zinc-900 focus:text-zinc-200"
                  >
                    <div className="flex size-6 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-900">
                      <Building2 className="size-4 shrink-0 text-zinc-500" />
                    </div>
                    <span className="text-zinc-200">{org.name}</span>
                    {currentOrganizationId === org._id && (
                      <Check className="ml-auto size-4 text-indigo-500" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="py-4 px-2 gap-0 overflow-y-auto">
        <div className="px-2 mb-6 group-data-[collapsible=icon]:hidden">
          <div className="relative group">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-zinc-500 group-focus-within:text-zinc-300 transition-colors" />
            <input
              type="text"
              placeholder="Search objects, loans..."
              className="w-full bg-zinc-900/40 border border-zinc-800/60 rounded-md text-xs py-1.5 pl-8 pr-3 text-zinc-300 placeholder-zinc-600 focus:outline-none focus:bg-zinc-900 focus:border-zinc-700 transition-all cursor-pointer"
              readOnly
              onClick={openCommandPalette}
              onFocus={openCommandPalette}
            />
            <div className="absolute right-2 top-1.5 flex gap-1">
              <span className="text-[10px] bg-zinc-900 text-zinc-500 px-1 rounded border border-zinc-800">
                ⌘K
              </span>
            </div>
          </div>
        </div>

        <NavSection title="Core Inventory" defaultOpen>
          <SidebarMenu>
            {navCoreInventory.map((item) => (
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
          title="Collection Groups"
          defaultOpen
          actionIcon={<Plus className="w-3 h-3" />}
          onAction={() => router.push("/collections/new")}
        >
          <SidebarMenu>
            {collectionGroups?.slice(0, 5).map((group, index) => (
              <NavItem
                key={group._id}
                href={`/objects?collectionGroupId=${group._id}`}
                title={group.name}
                isActive={pathname?.includes(`collectionGroupId=${group._id}`)}
                colorIndicator={
                  COLLECTION_COLORS[index % COLLECTION_COLORS.length]
                }
              />
            ))}
            {(!collectionGroups || collectionGroups.length === 0) && (
              <div className="px-3 py-2 text-[11px] text-zinc-500/60">
                No collection groups yet
              </div>
            )}
            {collectionGroups && collectionGroups.length > 5 && (
              <NavItem
                href="/collections"
                title={`View all ${collectionGroups.length} collection groups`}
                isActive={pathname === "/collections"}
              />
            )}
          </SidebarMenu>
        </NavSection>

        <NavSection
          title="Exhibitions & Loans"
          forceOpen={navExhibitionsLoans.some((item) => isPathActive(item.url))}
        >
          <SidebarMenu>
            {navExhibitionsLoans.map((item) => (
              <NavItem
                key={item.title}
                href={item.url}
                icon={item.icon}
                title={item.title}
                isActive={isPathActive(item.url)}
                locked={item.locked}
              />
            ))}
          </SidebarMenu>
        </NavSection>

        <NavSection
          title="Conservation & Care"
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
                locked={item.locked}
              />
            ))}
          </SidebarMenu>
        </NavSection>

        {showLibrarySection && (
          <NavSection
            title="Library & Research"
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

        <NavSection
          title="Administration"
          forceOpen={navAdministration.some((item) => isPathActive(item.url))}
        >
          <SidebarMenu>
            {navAdministration.map((item) => (
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
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-zinc-800/60 bg-zinc-950">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild id="user-menu-trigger">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 p-2 rounded-lg hover:bg-zinc-900/50 cursor-pointer transition-colors text-left outline-none group-data-[state=open]:bg-zinc-900/50"
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-8 w-8 rounded-full border border-zinc-700">
                      <AvatarImage
                        src={user?.avatarUrl ?? undefined}
                        alt={user?.name ?? undefined}
                      />
                      <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-zinc-950 rounded-full" />
                  </div>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-xs font-medium text-zinc-200 truncate">
                      {user?.name ?? undefined}
                    </p>
                    <p className="text-[10px] text-zinc-500 truncate">
                      {user?.email ?? undefined}
                    </p>
                  </div>
                  <ChevronsUpDown className="ml-auto size-3.5 text-zinc-600 group-data-[collapsible=icon]:hidden" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg bg-zinc-950 border-zinc-800 text-zinc-300"
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
                      <span className="truncate font-semibold text-zinc-200">
                        {user?.name ?? undefined}
                      </span>
                      <span className="truncate text-xs text-zinc-500">
                        {user?.email ?? undefined}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-zinc-800" />
                {currentOrganizationId ? (
                  <>
                    <DropdownMenuItem className="p-0 focus:bg-transparent">
                      <Button size="sm" className="w-full" asChild>
                        <Link href="/settings/billing">Manage Billing</Link>
                      </Button>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-zinc-800" />
                  </>
                ) : null}
                <DropdownMenuItem className="flex justify-between focus:bg-zinc-900 focus:text-zinc-200">
                  <span>Theme</span>
                  <ThemeSwitcher />
                </DropdownMenuItem>
                <DropdownMenuItem className="flex justify-between focus:bg-zinc-900 focus:text-zinc-200">
                  <span>Language</span>
                  <LanguageSwitcher />
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-zinc-800" />
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="focus:bg-zinc-900 focus:text-zinc-200"
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
