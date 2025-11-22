"use client"

import * as React from "react"
import {
  Activity,
  Archive,
  Box,
  FileCheck,
  FileX,
  Handshake,
  MapPin,
  Settings,
  CreditCard,
  BookOpen,
  Plus,
  ChevronsUpDown,
  LogOut,
  Building2,
  Check,
  LayoutDashboard
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@v1/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@v1/ui/avatar"
import { useOrganization } from "@/components/organization-provider"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { Logo } from "@v1/ui/logo"
import { useAuthActions } from "@convex-dev/auth/react"
import { Preloaded, usePreloadedQuery } from "convex/react"
import { api } from "@v1/backend/convex/_generated/api"
import { ThemeSwitcher } from "@/app/[locale]/(dashboard)/_components/theme-switcher"
import { LanguageSwitcher } from "@/app/[locale]/(dashboard)/_components/language-switcher"
import { CheckoutLink } from "@convex-dev/polar/react"
import { Button } from "@v1/ui/button"

export function AppSidebar({
  preloadedUser,
  preloadedProducts,
}: {
  preloadedUser: Preloaded<typeof api.users.getUser>
  preloadedProducts: Preloaded<typeof api.subscriptions.listAllProducts>
}) {
  const {
    organizations,
    currentOrganizationId,
    setCurrentOrganizationId,
  } = useOrganization()
  const user = usePreloadedQuery(preloadedUser)
  const products = usePreloadedQuery(preloadedProducts)
  const { signOut } = useAuthActions()
  const pathname = usePathname()
  const router = useRouter()

  const monthlyProProduct = products?.find(
    (product) => product.recurringInterval === "month",
  );
  const yearlyProProduct = products?.find(
    (product) => product.recurringInterval === "year",
  );

  const currentOrg = organizations.find(org => org._id === currentOrganizationId)

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
      title: "Activity",
      url: "/activity",
      icon: Activity,
    },
  ]

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
    {
      title: "Billing",
      url: "/settings/billing",
      icon: CreditCard,
    },
  ]

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <Logo className="size-6" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {currentOrg?.name || "Select Org"}
                    </span>
                    <span className="truncate text-xs">
                      {currentOrg?.role.name || "No Organization"}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
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
                    className="gap-2 p-2"
                  >
                    <div className="flex size-6 items-center justify-center rounded-sm border">
                      <Building2 className="size-4 shrink-0" />
                    </div>
                    {org.name}
                    {currentOrganizationId === org._id && <Check className="ml-auto size-4" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 p-2" onClick={() => router.push("/organizations/new")}>
                  <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                    <Plus className="size-4" />
                  </div>
                  <div className="font-medium text-muted-foreground">Add organization</div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navMain.map((item) => {
                // Active state logic: Exact match for root, startsWith for others
                const isActive = item.url === "/" 
                  ? pathname === "/" 
                  : pathname?.startsWith(item.url);
                  
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {navSecondary.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild size="sm" isActive={pathname?.startsWith(item.url)} tooltip={item.title}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user?.avatarUrl} alt={user?.name} />
                    <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{user?.name}</span>
                    <span className="truncate text-xs">{user?.email}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={user?.avatarUrl} alt={user?.name} />
                      <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{user?.name}</span>
                      <span className="truncate text-xs">{user?.email}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
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
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem className="flex justify-between">
                   <span>Theme</span>
                   <ThemeSwitcher />
                </DropdownMenuItem>
                <DropdownMenuItem className="flex justify-between">
                   <span>Language</span>
                   <LanguageSwitcher />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
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
  )
}
