"use client";

import {
  Activity,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@v1/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Logo } from "@v1/ui/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@v1/ui/sidebar";
import { cn } from "@v1/ui/utils";
import { type Preloaded, usePreloadedQuery, useQuery } from "convex/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const COLLECTION_COLORS = [
  "#d97706",
  "#059669",
  "#2563eb",
  "#e11d48",
  "#7c3aed",
  "#0891b2",
];

type SidebarIcon = React.ComponentType<{ className?: string }>;

interface NavigationItem {
  title: string;
  url: string;
  icon?: SidebarIcon;
  locked?: boolean;
}

interface NavigationGroup {
  title: string;
  icon: SidebarIcon;
  items: NavigationItem[];
  defaultOpen?: boolean;
}

function TopLevelNavigation({
  items,
  isPathActive,
}: {
  items: NavigationItem[];
  isPathActive: (url: string) => boolean;
}) {
  return (
    <SidebarGroup className="px-2 py-1">
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const ItemIcon = item.icon;
            const itemActive = isPathActive(item.url);

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  size="sm"
                  tooltip={item.title}
                  isActive={itemActive}
                  aria-disabled={item.locked}
                  className={cn(
                    "h-7 text-xs font-medium",
                    item.locked && "pointer-events-none opacity-60",
                  )}
                >
                  <Link
                    href={item.url}
                    onClick={
                      item.locked
                        ? (event) => event.preventDefault()
                        : undefined
                    }
                  >
                    {ItemIcon ? <ItemIcon /> : null}
                    <span>{item.title}</span>
                    {item.locked ? <Lock className="ml-auto size-3" /> : null}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function NavigationGroups({
  groups,
  isPathActive,
}: {
  groups: NavigationGroup[];
  isPathActive: (url: string) => boolean;
}) {
  return (
    <SidebarGroup className="px-2 py-1">
      <SidebarGroupContent>
        <SidebarMenu>
          {groups.map((group) => {
            const isActive = group.items.some((item) => isPathActive(item.url));
            const Icon = group.icon;

            return (
              <Collapsible
                key={group.title}
                asChild
                defaultOpen={group.defaultOpen || isActive}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      size="sm"
                      tooltip={group.title}
                      isActive={isActive}
                      className="h-7 text-xs font-medium"
                    >
                      <Icon />
                      <span>{group.title}</span>
                      <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub className="gap-0 py-0.5">
                      {group.items.map((item) => {
                        const ItemIcon = item.icon;
                        const itemActive = isPathActive(item.url);

                        return (
                          <SidebarMenuSubItem key={item.title}>
                            <SidebarMenuSubButton
                              asChild
                              size="sm"
                              isActive={itemActive}
                              aria-disabled={item.locked}
                              className={cn(
                                "h-7 text-xs font-medium",
                                item.locked && "pointer-events-none opacity-60",
                              )}
                            >
                              <Link
                                href={item.url}
                                onClick={
                                  item.locked
                                    ? (event) => event.preventDefault()
                                    : undefined
                                }
                              >
                                {ItemIcon ? <ItemIcon /> : null}
                                <span>{item.title}</span>
                                {item.locked ? (
                                  <Lock className="ml-auto size-3" />
                                ) : null}
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function CollectionGroupNav({
  groups,
  activeCollectionGroupId,
  onCreate,
}: {
  groups:
    | {
        _id: string;
        name: string;
      }[]
    | undefined;
  activeCollectionGroupId: string | null;
  onCreate: () => void;
}) {
  return (
    <SidebarGroup className="px-2 py-1 group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="h-6 px-2 text-[10px] font-medium uppercase tracking-widest">
        Collection Groups
      </SidebarGroupLabel>
      <SidebarGroupAction
        className="top-1.5"
        onClick={onCreate}
        title="New collection group"
      >
        <Plus />
        <span className="sr-only">New collection group</span>
      </SidebarGroupAction>
      <SidebarGroupContent>
        <SidebarMenu>
          {groups?.slice(0, 5).map((group, index) => (
            <SidebarMenuItem key={group._id}>
              <SidebarMenuButton
                asChild
                size="sm"
                isActive={activeCollectionGroupId === group._id}
                className="h-7 text-xs font-medium"
              >
                <Link href={`/objects?collectionGroupId=${group._id}`}>
                  <span
                    className="size-2 rounded-full"
                    style={{
                      backgroundColor:
                        COLLECTION_COLORS[index % COLLECTION_COLORS.length],
                    }}
                  />
                  <span>{group.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          {(!groups || groups.length === 0) && (
            <SidebarMenuItem>
              <div className="px-2 py-1.5 text-xs text-sidebar-foreground/60">
                No collection groups yet
              </div>
            </SidebarMenuItem>
          )}
          {groups && groups.length > 5 ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                size="sm"
                className="h-7 text-xs font-medium"
              >
                <Link href="/collections">
                  <span>View all {groups.length} collection groups</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
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
  const { isMobile } = useSidebar();
  const user = usePreloadedQuery(preloadedUser);
  const { signOut } = useAuthActions();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const handleOrganizationChange = React.useCallback(
    (organizationId: Id<"organizations">) => {
      if (organizationId === currentOrganizationId) {
        return;
      }

      setCurrentOrganizationId(organizationId);
      router.replace("/");
    },
    [currentOrganizationId, router, setCurrentOrganizationId],
  );

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

  const topLevelNavigation = navCoreInventory;

  const navigationGroups: NavigationGroup[] = [
    {
      title: "Exhibitions & Loans",
      icon: Truck,
      items: navExhibitionsLoans,
    },
    {
      title: "Conservation & Care",
      icon: Shield,
      items: navConservation,
    },
    ...(showLibrarySection
      ? [
          {
            title: "Library & Research",
            icon: BookOpen,
            items: navLibrary,
          },
        ]
      : []),
    {
      title: "Administration",
      icon: Settings2,
      items: navAdministration,
    },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-2 pb-1 pt-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild id="org-menu-trigger">
                <SidebarMenuButton
                  size="lg"
                  className="h-10 text-xs data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="flex aspect-square size-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                    <Logo className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate font-medium">
                      {currentOrg?.name || "Select Org"}
                    </span>
                    <span className="truncate text-[10px] text-sidebar-foreground/70">
                      {currentOrg?.role.name || "No Organization"}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                align="start"
                side={isMobile ? "bottom" : "right"}
                sideOffset={4}
              >
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Organizations
                </DropdownMenuLabel>
                {organizations.map((org, index) => (
                  <DropdownMenuItem
                    key={org._id}
                    onClick={() => handleOrganizationChange(org._id)}
                    className="gap-2 p-2"
                  >
                    <div className="flex size-6 items-center justify-center rounded-md border">
                      <Building2 className="size-4 shrink-0" />
                    </div>
                    <span>{org.name}</span>
                    <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                    {currentOrganizationId === org._id && (
                      <Check className="size-4" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-0 py-1">
        <SidebarGroup className="px-2 py-1 group-data-[collapsible=icon]:hidden">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  size="default"
                  className="h-9 rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-muted-foreground shadow-none ring-offset-background transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={openCommandPalette}
                >
                  <Search />
                  <span>Search</span>
                  <kbd className="ml-auto rounded border border-sidebar-border px-1 text-[10px] text-sidebar-foreground/70">
                    ⌘K
                  </kbd>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <TopLevelNavigation
          items={topLevelNavigation}
          isPathActive={isPathActive}
        />

        <NavigationGroups
          groups={navigationGroups}
          isPathActive={isPathActive}
        />

        <CollectionGroupNav
          groups={collectionGroups}
          activeCollectionGroupId={searchParams.get("collectionGroupId")}
          onCreate={() => router.push("/collections/new")}
        />
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild id="user-menu-trigger">
                <SidebarMenuButton
                  size="lg"
                  className="text-xs data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="size-8 rounded-lg">
                    <AvatarImage
                      src={user?.avatarUrl ?? undefined}
                      alt={user?.name ?? undefined}
                    />
                    <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate font-medium">
                      {user?.name ?? undefined}
                    </span>
                    <span className="truncate text-[10px] text-sidebar-foreground/70">
                      {user?.email ?? undefined}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                side={isMobile ? "bottom" : "right"}
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
                      <span className="truncate font-medium">
                        {user?.name ?? undefined}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user?.email ?? undefined}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {currentOrganizationId ? (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/settings/billing">Manage Billing</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                ) : null}
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    className="grid grid-cols-[1fr_auto] items-center gap-4"
                    onSelect={(event) => event.preventDefault()}
                  >
                    <span>Theme</span>
                    <div className="justify-self-end">
                      <ThemeSwitcher triggerClass="w-auto min-w-24" />
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="grid grid-cols-[1fr_auto] items-center gap-4"
                    onSelect={(event) => event.preventDefault()}
                  >
                    <span>Language</span>
                    <div className="justify-self-end">
                      <LanguageSwitcher triggerClass="w-auto min-w-28" />
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut />
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
