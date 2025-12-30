"use client";

import {
  Archive,
  BookCopy,
  BookOpen,
  BookUser,
  Box,
  Building2,
  Check,
  ChevronsUpDown,
  ChevronRight,
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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@v1/ui/sidebar";
import { type Preloaded, usePreloadedQuery, useQuery } from "convex/react";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@v1/ui/utils";

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
    <Sidebar className="border-r border-zinc-800/60 bg-zinc-950">
      <SidebarHeader className="border-b border-zinc-800/60 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="group flex w-full items-center justify-between gap-2 rounded-lg border border-transparent p-2 transition-all duration-200 hover:border-zinc-800 hover:bg-zinc-900 data-[state=open]:bg-zinc-900">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-medium text-white shadow-inner">
                  {currentOrg?.name?.substring(0, 2).toUpperCase() || "OR"}
                </div>
                <div className="text-left">
                  <p className="text-xs font-medium text-zinc-200 transition-colors group-hover:text-white">
                    {currentOrg?.name || "Select Org"}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    {currentOrg?.role.name || "No Organization"}
                  </p>
                </div>
              </div>
              <ChevronsUpDown className="h-3.5 w-3.5 text-zinc-600 transition-colors group-hover:text-zinc-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg bg-zinc-950 border-zinc-800"
            align="start"
            side="bottom"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">
              Switch Organization
            </DropdownMenuLabel>
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org._id}
                onClick={() => setCurrentOrganizationId(org._id)}
                className="flex items-center justify-between gap-2 rounded-md p-2 text-xs focus:bg-zinc-900 focus:text-white"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-zinc-800 text-[9px] text-zinc-400">
                    {org.name.substring(0, 2).toUpperCase()}
                  </div>
                  {org.name}
                </div>
                {currentOrganizationId === org._id && (
                  <Check className="h-3.5 w-3.5 text-indigo-500" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="bg-zinc-800/50" />
            <DropdownMenuItem
              className="flex items-center gap-2 rounded-md p-2 text-xs text-zinc-400 focus:bg-zinc-900 focus:text-white"
              onClick={() => router.push("/organizations/new")}
            >
              <Plus className="h-3.5 w-3.5" />
              Create Organization
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <div className="px-2 mb-6">
          <div className="relative group">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-500 transition-colors group-focus-within:text-zinc-300" />
            <input
              type="text"
              placeholder="Search users, roles..."
              className="w-full rounded-md border border-zinc-800/60 bg-zinc-900/40 py-1.5 pl-8 pr-3 text-xs text-zinc-300 placeholder-zinc-600 transition-all focus:border-zinc-700 focus:bg-zinc-900 focus:outline-none"
            />
            <div className="absolute right-2 top-1.5 flex gap-1">
              <span className="rounded border border-zinc-700 bg-zinc-800 px-1 text-[10px] text-zinc-500">
                ⌘K
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="px-1">
            <div className="px-2 pb-2 text-[10px] font-medium uppercase tracking-widest text-zinc-500">
              Workspace
            </div>
            <div className="space-y-0.5">
              {navMain.map((item) => {
                const isActive =
                  item.url === "/"
                    ? pathname === "/"
                    : pathname?.startsWith(item.url);
                return (
                  <Link
                    key={item.title}
                    href={item.url}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-xs transition-all group",
                      isActive
                        ? "bg-zinc-800/40 border border-zinc-800/60 text-zinc-200 shadow-sm"
                        : "text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200 border border-transparent",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4 transition-colors",
                        isActive
                          ? "text-indigo-400"
                          : "text-zinc-500 group-hover:text-zinc-400",
                      )}
                    />
                    <span className="font-medium">{item.title}</span>
                    {isActive && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {isLibraryEnabled && (
            <details className="group/coll px-1" open>
              <summary className="flex cursor-pointer list-none items-center justify-between px-2 pb-2 text-zinc-500 transition-colors hover:text-zinc-300 group-hover/summary:text-zinc-300 [&::-webkit-details-marker]:hidden">
                <span className="text-[10px] font-medium uppercase tracking-widest">
                  Library
                </span>
                <ChevronRight className="h-3 w-3 transition-transform duration-200 group-open/coll:rotate-90" />
              </summary>
              <div className="space-y-0.5 pt-1">
                {navLibrary.map((item) => {
                  const isActive = pathname?.startsWith(item.url);
                  return (
                    <Link
                      key={item.title}
                      href={item.url}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-xs transition-all group",
                        isActive
                          ? "bg-zinc-800/40 border border-zinc-800/60 text-zinc-200 shadow-sm"
                          : "text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200 border border-transparent",
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-3.5 w-3.5 transition-colors",
                          isActive
                            ? "text-indigo-400"
                            : "text-zinc-500 group-hover:text-zinc-300",
                        )}
                      />
                      <span>{item.title}</span>
                    </Link>
                  );
                })}
              </div>
            </details>
          )}

          <details className="group/sys px-1" open>
            <summary className="flex cursor-pointer list-none items-center justify-between px-2 pb-2 text-zinc-500 transition-colors hover:text-zinc-300 group-hover/summary:text-zinc-300 [&::-webkit-details-marker]:hidden">
              <span className="text-[10px] font-medium uppercase tracking-widest">
                System
              </span>
              <ChevronRight className="h-3 w-3 transition-transform duration-200 group-open/sys:rotate-90" />
            </summary>
            <div className="space-y-0.5 pt-1">
              {navSecondary.map((item) => {
                const isActive = pathname?.startsWith(item.url);
                return (
                  <Link
                    key={item.title}
                    href={item.url}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-xs transition-all group",
                      isActive
                        ? "bg-zinc-800/40 border border-zinc-800/60 text-zinc-200 shadow-sm"
                        : "text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200 border border-transparent",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4 transition-colors",
                        isActive
                          ? "text-indigo-400"
                          : "text-zinc-500 group-hover:text-zinc-400",
                      )}
                    />
                    <span>{item.title}</span>
                  </Link>
                );
              })}
            </div>
          </details>
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t border-zinc-800/60 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors hover:bg-zinc-900/50">
              <div className="relative">
                <Avatar className="h-8 w-8 rounded-full border border-zinc-700">
                  <AvatarImage
                    src={user?.avatarUrl ?? undefined}
                    alt={user?.name ?? undefined}
                  />
                  <AvatarFallback className="rounded-full bg-zinc-800 text-xs">
                    {user?.name?.substring(0, 2).toUpperCase() || "CN"}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-950 bg-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-medium text-zinc-200">
                  {user?.name ?? "User"}
                </p>
                <p className="truncate text-[10px] text-zinc-500">
                  {user?.email ?? "Signed In"}
                </p>
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-56 rounded-lg bg-zinc-950 border-zinc-800"
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
            <DropdownMenuSeparator className="bg-zinc-800/50" />
            {monthlyProProduct && yearlyProProduct && (
              <>
                <DropdownMenuItem className="p-0 focus:bg-transparent">
                  <Button size="sm" className="w-full" asChild>
                    <CheckoutLink
                      polarApi={api.subscriptions}
                      productIds={[monthlyProProduct.id, yearlyProProduct.id]}
                    >
                      Upgrade to PRO
                    </CheckoutLink>
                  </Button>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-zinc-800/50" />
              </>
            )}
            <DropdownMenuItem className="flex justify-between focus:bg-zinc-900 focus:text-white">
              <span>Theme</span>
              <ThemeSwitcher />
            </DropdownMenuItem>
            <DropdownMenuItem className="flex justify-between focus:bg-zinc-900 focus:text-white">
              <span>Language</span>
              <LanguageSwitcher />
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-zinc-800/50" />
            <DropdownMenuItem
              onClick={() => signOut()}
              className="focus:bg-zinc-900 focus:text-white"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
