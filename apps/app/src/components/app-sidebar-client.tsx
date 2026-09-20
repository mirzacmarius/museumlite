"use client";

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
  SidebarGroupContent,
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
import { Skeleton } from "@v1/ui/skeleton";
import { cn } from "@v1/ui/utils";
import { type Preloaded, usePreloadedQuery } from "convex/react";
import {
  Building2,
  Check,
  ChevronRight,
  ChevronsUpDown,
  Lock,
  LogOut,
  Search,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Suspense } from "react";
import { LanguageSwitcher } from "@/app/[locale]/(dashboard)/_components/language-switcher";
import { ThemeSwitcher } from "@/app/[locale]/(dashboard)/_components/theme-switcher";
import {
  buildSidebarNavigation,
  type NavigationGroup,
  type NavigationItem,
} from "@/components/app-sidebar-navigation";
import { useCommandPalette } from "@/components/command-palette-provider";
import { useOrganization } from "@/components/organization-provider";
import { usePermissions } from "@/components/permission-gate";
import { useFeatureAccess } from "@/hooks/use-feature-access";

function getUserInitials(user: {
  name?: string | null;
  email?: string | null;
}) {
  const initials =
    user.name
      ?.trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") ?? "";

  return initials || user.email?.[0]?.toUpperCase() || "U";
}

interface SidebarOrganization {
  _id: Id<"organizations">;
  name: string;
  role: {
    name: string;
  };
}

interface SidebarUser {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  image?: string | null;
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
            const subItems = item.subItems ?? [];

            if (subItems.length > 0) {
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
                  <SidebarMenuSub className="gap-0 py-0.5">
                    {subItems.map((subItem) => {
                      const SubItemIcon = subItem.icon;
                      const subItemActive = isPathActive(subItem.url);

                      return (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton
                            asChild
                            size="sm"
                            isActive={subItemActive}
                            aria-disabled={subItem.locked}
                            className={cn(
                              "h-7 text-xs font-medium",
                              subItem.locked &&
                                "pointer-events-none opacity-60",
                            )}
                          >
                            <Link
                              href={subItem.url}
                              onClick={
                                subItem.locked
                                  ? (event) => event.preventDefault()
                                  : undefined
                              }
                            >
                              {SubItemIcon ? <SubItemIcon /> : null}
                              <span>{subItem.title}</span>
                              {subItem.locked ? (
                                <Lock className="ml-auto size-3" />
                              ) : null}
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      );
                    })}
                  </SidebarMenuSub>
                </SidebarMenuItem>
              );
            }

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

function OrganizationSwitcher({
  currentOrg,
  currentOrganizationId,
  isMobile,
  organizations,
  onOrganizationChange,
}: {
  currentOrg: SidebarOrganization | undefined;
  currentOrganizationId: Id<"organizations"> | null | undefined;
  isMobile: boolean;
  organizations: SidebarOrganization[];
  onOrganizationChange: (organizationId: Id<"organizations">) => void;
}) {
  return (
    <SidebarHeader className="px-2 pb-1 pt-2">
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild id="org-menu-trigger">
              <SidebarMenuButton
                size="lg"
                className="h-10 text-xs text-sidebar-foreground hover:bg-transparent hover:text-sidebar-foreground data-[state=open]:bg-transparent data-[state=open]:text-sidebar-foreground"
              >
                <div className="flex aspect-square size-7 items-center justify-center rounded-md bg-background text-foreground shadow-sm ring-1 ring-sidebar-border/80">
                  <Logo className="size-5 text-foreground" />
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
                  onClick={() => onOrganizationChange(org._id)}
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
  );
}

function SidebarSearch({ onOpen }: { onOpen: () => void }) {
  return (
    <SidebarGroup className="px-2 py-1 group-data-[collapsible=icon]:hidden">
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="default"
              className="h-9 rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-muted-foreground shadow-none ring-offset-background transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={onOpen}
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
  );
}

function UserMenu({
  currentOrganizationId,
  isMobile,
  onSignOut,
  user,
}: {
  currentOrganizationId: Id<"organizations"> | null | undefined;
  isMobile: boolean;
  onSignOut: () => void;
  user: SidebarUser | null | undefined;
}) {
  const userAvatarUrl = user?.avatarUrl ?? user?.image ?? undefined;
  const userInitials = getUserInitials(user ?? {});

  return (
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
                    src={userAvatarUrl}
                    alt={user?.name ?? undefined}
                  />
                  <AvatarFallback className="rounded-lg">
                    {userInitials}
                  </AvatarFallback>
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
                <Link
                  href="/settings"
                  className="flex items-center gap-2 rounded-sm px-1 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                >
                  <Avatar className="size-8 rounded-lg">
                    <AvatarImage
                      src={userAvatarUrl}
                      alt={user?.name ?? undefined}
                    />
                    <AvatarFallback className="rounded-lg">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">
                      {user?.name ?? undefined}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user?.email ?? undefined}
                    </span>
                  </div>
                </Link>
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
              <DropdownMenuItem onClick={onSignOut}>
                <LogOut />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  );
}

const SIDEBAR_SKELETON_KEYS = [
  "nav-skeleton-1",
  "nav-skeleton-2",
  "nav-skeleton-3",
  "nav-skeleton-4",
  "nav-skeleton-5",
  "nav-skeleton-6",
  "nav-skeleton-7",
  "nav-skeleton-8",
] as const;

function AppSidebarFallback() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-2 pb-1 pt-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <Skeleton className="h-10 w-full rounded-md" />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="gap-2 px-2 py-1">
        {SIDEBAR_SKELETON_KEYS.map((skeletonKey) => (
          <Skeleton key={skeletonKey} className="h-7 w-full rounded-md" />
        ))}
      </SidebarContent>
    </Sidebar>
  );
}

function AppSidebarClientInner({
  preloadedUser,
}: {
  preloadedUser: Preloaded<typeof api.users.getUser>;
}) {
  const { organizations, currentOrganizationId, setCurrentOrganizationId } =
    useOrganization();
  const { hasPermission } = usePermissions();
  const { hasFeature, hasModule } = useFeatureAccess();
  const { setOpen } = useCommandPalette();
  const { isMobile } = useSidebar();
  const user = usePreloadedQuery(preloadedUser);
  const { signOut } = useAuthActions();
  const pathname = usePathname();
  const { replace } = useRouter();

  const handleOrganizationChange = React.useCallback(
    (organizationId: Id<"organizations">) => {
      if (organizationId === currentOrganizationId) {
        return;
      }

      setCurrentOrganizationId(organizationId);
      replace("/");
    },
    [currentOrganizationId, replace, setCurrentOrganizationId],
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

  const isLibraryModuleEnabled = hasModule("library");
  const isInsuranceModuleEnabled = hasModule("insurance");
  const isLocationTrackingEnabled =
    currentOrg?.settings?.locationTrackingEnabled ?? true;

  const isPathActive = (url: string) => {
    if (url === "/") return pathname === "/";
    if (url.includes("?")) {
      const basePath = url.split("?")[0];
      return pathname?.startsWith(basePath ?? "");
    }
    return pathname?.startsWith(url);
  };

  const { topLevelNavigation, navigationGroups } = buildSidebarNavigation({
    hasFeature,
    isLibraryModuleEnabled,
    isInsuranceModuleEnabled,
    isLocationTrackingEnabled,
    canAccessAdministration: hasPermission("organization.manage_settings"),
  });

  return (
    <Sidebar collapsible="icon">
      <OrganizationSwitcher
        currentOrg={currentOrg}
        currentOrganizationId={currentOrganizationId}
        isMobile={isMobile}
        organizations={organizations}
        onOrganizationChange={handleOrganizationChange}
      />

      <SidebarContent className="gap-0 py-1">
        <SidebarSearch onOpen={openCommandPalette} />

        <TopLevelNavigation
          items={topLevelNavigation}
          isPathActive={isPathActive}
        />

        <NavigationGroups
          groups={navigationGroups}
          isPathActive={isPathActive}
        />
      </SidebarContent>

      <UserMenu
        currentOrganizationId={currentOrganizationId}
        isMobile={isMobile}
        onSignOut={signOut}
        user={user}
      />
      <SidebarRail />
    </Sidebar>
  );
}

export function AppSidebarClient({
  preloadedUser,
}: {
  preloadedUser: Preloaded<typeof api.users.getUser>;
}) {
  return (
    <Suspense fallback={<AppSidebarFallback />}>
      <AppSidebarClientInner preloadedUser={preloadedUser} />
    </Suspense>
  );
}
