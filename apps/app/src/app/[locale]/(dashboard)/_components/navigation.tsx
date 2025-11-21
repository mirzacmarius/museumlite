"use client";

import { NotificationBell } from "@/components/notification-bell";
import { useOrganization } from "@/components/organization-provider";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { useAuthActions } from "@convex-dev/auth/react";
import { CheckoutLink } from "@convex-dev/polar/react";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button, buttonVariants } from "@v1/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Input } from "@v1/ui/input";
import { Logo } from "@v1/ui/logo";
import { cn } from "@v1/ui/utils";
import { type Preloaded, useMutation, usePreloadedQuery } from "convex/react";
import {
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  LogOut,
  Plus,
  Settings,
  Slash,
} from "lucide-react";
import {
  Activity,
  Archive,
  FileCheck,
  FileX,
  Handshake,
  MapPin,
} from "lucide-react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeSwitcher } from "./theme-switcher";

export function Navigation({
  preloadedUser,
  preloadedProducts,
}: {
  preloadedUser: Preloaded<typeof api.users.getUser>;
  preloadedProducts: Preloaded<typeof api.subscriptions.listAllProducts>;
}) {
  const { signOut } = useAuthActions();
  const pathname = usePathname();
  const router = useRouter();
  const pathSegments = pathname?.split("/").filter(Boolean) ?? [];
  const isDashboardPath =
    pathname === "/" || (pathname?.endsWith("/") && pathSegments.length <= 1);
  const isSettingsPath =
    pathname?.startsWith("/settings") &&
    !pathname?.startsWith("/settings/billing") &&
    pathSegments.length > 0 &&
    pathSegments[pathSegments.length - 1] === "settings";
  const isBillingPath = pathname?.startsWith("/settings/billing");
  const isActivityPath = pathname?.startsWith("/activity");
  const {
    organizations,
    currentOrganizationId,
    setCurrentOrganizationId,
    isLoading: orgsLoading,
  } = useOrganization();
  const createOrganization = useMutation(api.organizations.create);
  const [newOrgName, setNewOrgName] = useState("");
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isPersonalAccountOpen, setIsPersonalAccountOpen] = useState(false);

  const user = usePreloadedQuery(preloadedUser);
  const products = usePreloadedQuery(preloadedProducts);

  const monthlyProProduct = products?.find(
    (product) => product.recurringInterval === "month",
  );
  const yearlyProProduct = products?.find(
    (product) => product.recurringInterval === "year",
  );

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    setIsCreatingOrg(true);
    try {
      const slug = newOrgName
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      const organizationId = await createOrganization({
        name: newOrgName.trim(),
        slug,
        type: "museum", // Default type
      });
      setCurrentOrganizationId(organizationId as Id<"organizations">);
      setNewOrgName("");
      setShowCreateForm(false);
      setIsPersonalAccountOpen(false); // Close dropdown after creation
    } catch (error) {
      console.error("Failed to create organization:", error);
    } finally {
      setIsCreatingOrg(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <nav className="sticky top-0 z-50 flex w-full flex-col border-b border-border bg-card px-6">
      <div className="mx-auto flex w-full max-w-screen-xl items-center justify-between py-3">
        <div className="flex h-10 items-center gap-2">
          <Link href="/" className="flex h-10 items-center gap-1">
            <Logo className="w-10 h-10" />
          </Link>
          <Slash className="h-6 w-6 -rotate-12 stroke-[1.5px] text-primary/10" />
          <DropdownMenu
            modal={false}
            open={isPersonalAccountOpen}
            onOpenChange={(open) => {
              // Prevent closing when form is shown
              if (showCreateForm && !open) {
                return;
              }
              setIsPersonalAccountOpen(open);
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="gap-2 px-2 data-[state=open]:bg-primary/5"
              >
                <div className="flex items-center gap-2">
                  {user.avatarUrl ? (
                    <img
                      className="h-8 w-8 rounded-full object-cover"
                      alt={user.name ?? user.email}
                      src={user.avatarUrl}
                    />
                  ) : (
                    <span className="h-8 w-8 rounded-full bg-gradient-to-br from-lime-400 from-10% via-cyan-300 to-blue-500" />
                  )}

                  <p className="text-sm font-medium text-primary/80">
                    {user?.name || ""}
                  </p>
                  <span className="flex h-5 items-center rounded-full bg-primary/10 px-2 text-xs font-medium text-primary/80">
                    Free
                  </span>
                </div>
                <span className="flex flex-col items-center justify-center">
                  <ChevronUp className="relative top-[3px] h-[14px] w-[14px] stroke-[1.5px] text-primary/60" />
                  <ChevronDown className="relative bottom-[3px] h-[14px] w-[14px] stroke-[1.5px] text-primary/60" />
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              sideOffset={8}
              className="min-w-56 bg-card p-2"
            >
              <DropdownMenuLabel className="flex items-center text-xs font-normal text-primary/60">
                Personal Account
              </DropdownMenuLabel>
              <DropdownMenuItem className="h-10 w-full cursor-pointer justify-between rounded-md bg-secondary px-2">
                <div className="flex items-center gap-2">
                  {user.avatarUrl ? (
                    <img
                      className="h-6 w-6 rounded-full object-cover"
                      alt={user.name ?? user.email}
                      src={user.avatarUrl}
                    />
                  ) : (
                    <span className="h-6 w-6 rounded-full bg-gradient-to-br from-lime-400 from-10% via-cyan-300 to-blue-500" />
                  )}

                  <p className="text-sm font-medium text-primary/80">
                    {user.name || ""}
                  </p>
                </div>
                <Check className="h-[18px] w-[18px] stroke-[1.5px] text-primary/60" />
              </DropdownMenuItem>

              <DropdownMenuSeparator className="mx-0 my-2" />
              <DropdownMenuItem className="p-0 focus:bg-transparent">
                {monthlyProProduct && yearlyProProduct && (
                  <Button size="sm" className="w-full" asChild>
                    <CheckoutLink
                      polarApi={api.subscriptions}
                      productIds={[monthlyProProduct.id, yearlyProProduct.id]}
                    >
                      Upgrade to PRO
                    </CheckoutLink>
                  </Button>
                )}
              </DropdownMenuItem>

              <DropdownMenuSeparator className="mx-0 my-2" />

              {/* Organizations Section */}
              <DropdownMenuLabel className="text-xs font-normal text-primary/60">
                Organizations
              </DropdownMenuLabel>

              {orgsLoading ? (
                <DropdownMenuItem className="h-9 w-full cursor-default justify-center rounded-md px-2">
                  <span className="text-sm text-primary/60">Loading...</span>
                </DropdownMenuItem>
              ) : organizations.length > 0 ? (
                organizations.map((org) => (
                  <DropdownMenuItem
                    key={org._id}
                    onClick={() => setCurrentOrganizationId(org._id)}
                    className={cn(
                      "group h-10 w-full cursor-pointer justify-between rounded-md px-2",
                      currentOrganizationId === org._id && "bg-secondary",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-full bg-gradient-to-br from-orange-400 from-10% via-pink-500 to-purple-500 flex-shrink-0" />
                      <span className="text-sm font-medium text-primary/80 group-hover:text-primary group-focus:text-primary">
                        {org.name}
                      </span>
                    </div>
                    {currentOrganizationId === org._id && (
                      <Check className="h-[18px] w-[18px] stroke-[1.5px] text-primary/60" />
                    )}
                  </DropdownMenuItem>
                ))
              ) : null}

              {/* Create Organization Form */}
              {showCreateForm ? (
                <div className="p-2">
                  <form
                    onSubmit={handleCreateOrganization}
                    className="w-full space-y-2"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <Input
                      placeholder="Organization name"
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      className="h-8"
                      autoFocus
                      disabled={isCreatingOrg}
                      onFocus={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        className="h-7 flex-1"
                        disabled={!newOrgName.trim() || isCreatingOrg}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        {isCreatingOrg ? "Creating..." : "Create"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowCreateForm(false);
                          setNewOrgName("");
                          setIsPersonalAccountOpen(false); // Close dropdown when canceling
                        }}
                        disabled={isCreatingOrg}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </div>
              ) : (
                <DropdownMenuItem
                  onClick={() => setShowCreateForm(true)}
                  className="group h-9 w-full cursor-pointer rounded-md px-2"
                >
                  <Plus className="mr-2 h-4 w-4 text-primary/60 group-hover:text-primary group-focus:text-primary" />
                  <span className="text-sm text-primary/60 group-hover:text-primary group-focus:text-primary">
                    Create new organization
                  </span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex h-10 items-center gap-3">
          <a
            href="/"
            className={cn(
              `${buttonVariants({ variant: "outline", size: "sm" })} group hidden h-8 gap-2 rounded-full bg-transparent px-2 pr-2.5 md:flex`,
            )}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-primary"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            <span className="text-sm text-primary/60 transition group-hover:text-primary group-focus:text-primary">
              Documentation
            </span>
          </a>
          {currentOrganizationId && <NotificationBell />}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 rounded-full">
                {user.avatarUrl ? (
                  <img
                    className="min-h-8 min-w-8 rounded-full object-cover"
                    alt={user.name ?? user.email}
                    src={user.avatarUrl}
                  />
                ) : (
                  <span className="min-h-8 min-w-8 rounded-full bg-gradient-to-br from-lime-400 from-10% via-cyan-300 to-blue-500" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              sideOffset={8}
              className="fixed -right-4 min-w-56 bg-card p-2"
            >
              <DropdownMenuItem className="group flex-col items-start focus:bg-transparent">
                <p className="text-sm font-medium text-primary/80 group-hover:text-primary group-focus:text-primary">
                  {user?.name || ""}
                </p>
                <p className="text-sm text-primary/60">{user?.email}</p>
              </DropdownMenuItem>

              <DropdownMenuItem
                className="group h-9 w-full cursor-pointer justify-between rounded-md px-2"
                onClick={() => router.push("/settings")}
              >
                <span className="text-sm text-primary/60 group-hover:text-primary group-focus:text-primary">
                  Settings
                </span>
                <Settings className="h-[18px] w-[18px] stroke-[1.5px] text-primary/60 group-hover:text-primary group-focus:text-primary" />
              </DropdownMenuItem>

              <DropdownMenuItem
                className={cn(
                  "group flex h-9 justify-between rounded-md px-2 hover:bg-transparent",
                )}
              >
                <span className="w-full text-sm text-primary/60 group-hover:text-primary group-focus:text-primary">
                  Theme
                </span>
                <ThemeSwitcher />
              </DropdownMenuItem>

              <DropdownMenuItem
                className={cn(
                  "group flex h-9 justify-between rounded-md px-2 hover:bg-transparent",
                )}
              >
                <span className="w-full text-sm text-primary/60 group-hover:text-primary group-focus:text-primary">
                  Language
                </span>
                <LanguageSwitcher />
              </DropdownMenuItem>

              <DropdownMenuSeparator className="mx-0 my-2" />

              <DropdownMenuItem
                className="group h-9 w-full cursor-pointer justify-between rounded-md px-2"
                onClick={() => signOut()}
              >
                <span className="text-sm text-primary/60 group-hover:text-primary group-focus:text-primary">
                  Log Out
                </span>
                <LogOut className="h-[18px] w-[18px] stroke-[1.5px] text-primary/60 group-hover:text-primary group-focus:text-primary" />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-screen-xl items-center gap-3">
        <div className="flex items-center gap-2">
          <OrganizationSwitcher />
        </div>
        <div className="flex-1" />
        <div className="flex h-12 items-center gap-1">
          <div
            className={cn(
              "flex h-12 items-center border-b-2",
              isDashboardPath ? "border-primary" : "border-transparent",
            )}
          >
            <Link
              href="/"
              className={cn(
                `${buttonVariants({ variant: "ghost", size: "sm" })} text-primary/80`,
              )}
            >
              Dashboard
            </Link>
          </div>
          <div
            className={cn(
              "flex h-12 items-center border-b-2",
              pathname?.startsWith("/collections")
                ? "border-primary"
                : "border-transparent",
            )}
          >
            <Link
              href="/collections"
              className={cn(
                `${buttonVariants({ variant: "ghost", size: "sm" })} text-primary/80 gap-2`,
              )}
            >
              <Archive className="h-4 w-4" />
              Collections
            </Link>
          </div>
          <div
            className={cn(
              "flex h-12 items-center border-b-2",
              pathname?.startsWith("/locations")
                ? "border-primary"
                : "border-transparent",
            )}
          >
            <Link
              href="/locations"
              className={cn(
                `${buttonVariants({ variant: "ghost", size: "sm" })} text-primary/80 gap-2`,
              )}
            >
              <MapPin className="h-4 w-4" />
              Locations
            </Link>
          </div>
          <div
            className={cn(
              "flex h-12 items-center border-b-2",
              pathname?.startsWith("/accessions")
                ? "border-primary"
                : "border-transparent",
            )}
          >
            <Link
              href="/accessions"
              className={cn(
                `${buttonVariants({ variant: "ghost", size: "sm" })} text-primary/80 gap-2`,
              )}
            >
              <FileCheck className="h-4 w-4" />
              Accessions
            </Link>
          </div>
          <div
            className={cn(
              "flex h-12 items-center border-b-2",
              pathname?.startsWith("/deaccessions")
                ? "border-primary"
                : "border-transparent",
            )}
          >
            <Link
              href="/deaccessions"
              className={cn(
                `${buttonVariants({ variant: "ghost", size: "sm" })} text-primary/80 gap-2`,
              )}
            >
              <FileX className="h-4 w-4" />
              Deaccessions
            </Link>
          </div>
          <div
            className={cn(
              "flex h-12 items-center border-b-2",
              pathname?.startsWith("/loans")
                ? "border-primary"
                : "border-transparent",
            )}
          >
            <Link
              href="/loans"
              className={cn(
                `${buttonVariants({ variant: "ghost", size: "sm" })} text-primary/80 gap-2`,
              )}
            >
              <Handshake className="h-4 w-4" />
              Loans
            </Link>
          </div>
          <div
            className={cn(
              "flex h-12 items-center border-b-2",
              isActivityPath ? "border-primary" : "border-transparent",
            )}
          >
            <Link
              href="/activity"
              className={cn(
                `${buttonVariants({ variant: "ghost", size: "sm" })} text-primary/80 gap-2`,
              )}
            >
              <Activity className="h-4 w-4" />
              Activity
            </Link>
          </div>
          <div
            className={cn(
              "flex h-12 items-center border-b-2",
              isSettingsPath ? "border-primary" : "border-transparent",
            )}
          >
            <Link
              href="/settings"
              className={cn(
                `${buttonVariants({ variant: "ghost", size: "sm" })} text-primary/80`,
              )}
            >
              Settings
            </Link>
          </div>
          <div
            className={cn(
              "flex h-12 items-center border-b-2",
              isBillingPath ? "border-primary" : "border-transparent",
            )}
          >
            <Link
              href="/settings/billing"
              className={cn(
                `${buttonVariants({ variant: "ghost", size: "sm" })} text-primary/80`,
              )}
            >
              Billing
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
