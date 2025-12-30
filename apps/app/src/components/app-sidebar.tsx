"use client";

import {
  Archive,
  BookCopy,
  BookOpen,
  BookUser,
  Box,
  Building2,
  Check,
  ChevronRight,
  ChevronsUpDown,
  CreditCard,
  DollarSign,
  FileCheck,
  FileX,
  Handshake,
  LayoutDashboard,
  Library,
  LogOut,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShoppingCart,
  Users,
} from "lucide-react";
import * as React from "react";

import { LanguageSwitcher } from "@/app/[locale]/(dashboard)/_components/language-switcher";
import { ThemeSwitcher } from "@/app/[locale]/(dashboard)/_components/theme-switcher";
import { useOrganization } from "@/components/organization-provider";
import { useAuthActions } from "@convex-dev/auth/react";
import { CheckoutLink } from "@convex-dev/polar/react";
import { api } from "@v1/backend/convex/_generated/api";
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
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function AppSidebar({
  preloadedUser,
  preloadedProducts,
}: {
  preloadedUser: Preloaded<typeof api.users.getUser>;
  preloadedProducts: Preloaded<typeof api.subscriptions.listAllProducts>;
}) {
  const { organizations, currentOrganizationId, setCurrentOrganizationId } =
    useOrganization();
  const user = usePreloadedQuery(preloadedUser);
  const products = usePreloadedQuery(preloadedProducts);
  const { signOut } = useAuthActions();
  const pathname = usePathname();
  const router = useRouter();

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

  const navMain = [
    {
      title: "Dashboard",
      url: "/",
      icon: LayoutDashboard,
    },
    {
      title: "Collections",
      url: "/collections",
      icon: Archive,
    },
    {
      title: "Objects",
      url: "/objects",
      icon: Box,
    },
    {
      title: "Locations",
      url: "/locations",
      icon: MapPin,
    },
    {
      title: "Accessions",
      url: "/accessions",
      icon: FileCheck,
    },
    {
      title: "Deaccessions",
      url: "/deaccessions",
      icon: FileX,
    },
    {
      title: "Loans",
      url: "/loans",
      icon: Handshake,
    },
    {
      title: "Accounts",
      url: "/accounts",
      icon: Users,
    },
  ];

  const navSecondary = [
    {
      title: "Documentation",
      url: "#",
      icon: BookOpen,
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings,
    },
  ];

  const navLibrary = [
    {
      title: "Library",
      url: "/library",
      icon: Library,
    },
    {
      title: "Catalog",
      url: "/library/catalog",
      icon: BookCopy,
    },
    {
      title: "Patrons",
      url: "/library/patrons",
      icon: BookUser,
    },
    {
      title: "Circulation",
      url: "/library/circulation",
      icon: RefreshCw,
    },
    {
      title: "Fines",
      url: "/library/fines",
      icon: DollarSign,
    },
    {
      title: "Acquisitions",
      url: "/library/acquisitions",
      icon: ShoppingCart,
    },
  ];

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-zinc-800/60 bg-zinc-950"
    >
      <SidebarHeader className="bg-zinc-950 p-3 border-b border-zinc-800/60">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-zinc-900 transition-all duration-200 group border border-transparent hover:border-zinc-800 data-[state=open]:bg-zinc-900 outline-none">
                  <div className="flex items-center gap-3">
                    <div className="size-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-md shadow-inner flex items-center justify-center text-white font-medium text-xs border border-white/10 shrink-0">
                      <Logo className="size-5 text-white" />
                    </div>
                    <div className="flex flex-col text-left group-data-[collapsible=icon]:hidden">
                      <span className="text-xs font-medium text-zinc-200 group-hover:text-white transition-colors truncate max-w-[120px]">
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
                      <Building2 className="size-4 shrink-0 text-zinc-400" />
                    </div>
                    <span className="text-zinc-200">{org.name}</span>
                    {currentOrganizationId === org._id && (
                      <Check className="ml-auto size-4 text-indigo-500" />
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="bg-zinc-800/50" />
                <DropdownMenuItem
                  className="gap-2 p-2 focus:bg-zinc-900 focus:text-zinc-200"
                  onClick={() => router.push("/organizations/new")}
                >
                  <div className="flex size-6 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900">
                    <Plus className="size-4 text-zinc-400" />
                  </div>
                  <div className="font-medium text-zinc-400">
                    Add organization
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="py-4 px-2 gap-0">
        <div className="px-2 mb-6 group-data-[collapsible=icon]:hidden">
          <div className="relative group">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-zinc-500 group-focus-within:text-zinc-300 transition-colors" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full bg-zinc-900/40 border border-zinc-800/60 rounded-md text-xs py-1.5 pl-8 pr-3 text-zinc-300 placeholder-zinc-600 focus:outline-none focus:bg-zinc-900 focus:border-zinc-700 transition-all"
            />
            <div className="absolute right-2 top-1.5 flex gap-1">
              <span className="text-[10px] bg-zinc-800 text-zinc-500 px-1 rounded border border-zinc-700">
                ⌘K
              </span>
            </div>
          </div>
        </div>

        <div className="px-1 mb-6">
          <div className="px-2 pb-2 text-[10px] font-medium text-zinc-500 uppercase tracking-widest group-data-[collapsible=icon]:hidden">
            Workspace
          </div>
          <SidebarMenu>
            {navMain.map((item) => {
              const isActive =
                item.url === "/"
                  ? pathname === "/"
                  : pathname?.startsWith(item.url);

              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={item.title}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-1.5 text-xs rounded-md transition-all group h-auto",
                      isActive
                        ? "text-zinc-200 bg-zinc-800/40 border border-zinc-800/60 shadow-sm hover:bg-zinc-800/40 hover:text-zinc-200"
                        : "text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200 bg-transparent border border-transparent",
                    )}
                  >
                    <Link href={item.url}>
                      <item.icon
                        className={cn(
                          "size-4 shrink-0",
                          isActive
                            ? "text-indigo-400"
                            : "group-hover:text-zinc-400 transition-colors",
                        )}
                      />
                      <span className="font-medium">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </div>

        {isLibraryEnabled && (
          <details
            className="group/coll px-1 mb-2 group-data-[collapsible=icon]:hidden"
            open
          >
            <summary className="px-2 pb-2 flex items-center justify-between cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:text-zinc-300 text-zinc-500 transition-colors group/summary">
              <span className="text-[10px] font-medium uppercase tracking-widest">
                Library
              </span>
              <ChevronRight className="w-3 h-3 transition-transform duration-200 group-open/coll:rotate-90" />
            </summary>
            <SidebarMenu className="pt-1">
              {navLibrary.map((item) => {
                const isActive =
                  item.url === "/library"
                    ? pathname === "/library"
                    : pathname?.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-1.5 text-xs rounded-md transition-all group h-auto",
                        isActive
                          ? "text-zinc-200 bg-zinc-800/40 border border-zinc-800/60 shadow-sm hover:bg-zinc-800/40 hover:text-zinc-200"
                          : "text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200 bg-transparent border border-transparent",
                      )}
                    >
                      <Link href={item.url}>
                        <item.icon
                          className={cn(
                            "size-4 shrink-0",
                            isActive
                              ? "text-indigo-400"
                              : "group-hover:text-zinc-400 transition-colors",
                          )}
                        />
                        <span className="font-medium">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </details>
        )}

        <details
          className="group/sys px-1 group-data-[collapsible=icon]:hidden"
          open
        >
          <summary className="px-2 pb-2 flex items-center justify-between cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:text-zinc-300 text-zinc-500 transition-colors group/summary">
            <span className="text-[10px] font-medium uppercase tracking-widest">
              System
            </span>
            <ChevronRight className="w-3 h-3 transition-transform duration-200 group-open/sys:rotate-90" />
          </summary>
          <SidebarMenu className="pt-1">
            {navSecondary.map((item) => {
              const isActive = pathname?.startsWith(item.url);
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={item.title}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-1.5 text-xs rounded-md transition-all group h-auto",
                      isActive
                        ? "text-zinc-200 bg-zinc-800/40 border border-zinc-800/60 shadow-sm hover:bg-zinc-800/40 hover:text-zinc-200"
                        : "text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200 bg-transparent border border-transparent",
                    )}
                  >
                    <Link href={item.url}>
                      <item.icon
                        className={cn(
                          "size-4 shrink-0",
                          isActive
                            ? "text-indigo-400"
                            : "group-hover:text-zinc-400 transition-colors",
                        )}
                      />
                      <span className="font-medium">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </details>
      </SidebarContent>
      <SidebarFooter className="p-3 border-t border-zinc-800/60 bg-zinc-950">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 p-2 rounded-lg hover:bg-zinc-900/50 cursor-pointer transition-colors text-left outline-none group-data-[state=open]:bg-zinc-900/50">
                  <div className="relative shrink-0">
                    <Avatar className="h-8 w-8 rounded-full border border-zinc-700">
                      <AvatarImage
                        src={user?.avatarUrl ?? undefined}
                        alt={user?.name ?? undefined}
                      />
                      <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-zinc-950 rounded-full"></div>
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
                      <span className="truncate font-semibold">
                        {user?.name ?? undefined}
                      </span>
                      <span className="truncate text-xs">
                        {user?.email ?? undefined}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-zinc-800" />
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
                    <DropdownMenuSeparator className="bg-zinc-800" />
                  </>
                )}
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
