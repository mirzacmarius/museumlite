"use client";

import { Button } from "@v1/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Building2, Check, ChevronDown, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOrganization } from "./organization-provider";

export function OrganizationSwitcher() {
  const {
    organizations,
    currentOrganizationId,
    setCurrentOrganizationId,
    isLoading,
  } = useOrganization();
  const router = useRouter();

  const handleOrganizationChange = (
    organizationId: typeof currentOrganizationId,
  ) => {
    if (organizationId === currentOrganizationId) {
      return;
    }

    setCurrentOrganizationId(organizationId);
    router.replace("/");
  };

  if (isLoading) {
    return (
      <Button variant="ghost" className="gap-2 px-2" disabled>
        <Building2 className="h-4 w-4" />
        <span className="text-sm font-medium">Loading...</span>
      </Button>
    );
  }

  if (organizations.length === 0) {
    return (
      <Button variant="ghost" className="gap-2 px-2" asChild>
        <Link href="/settings/organization/new">
          <Plus className="h-4 w-4" />
          <span className="text-sm font-medium">Create Organization</span>
        </Link>
      </Button>
    );
  }

  const currentOrg = organizations.find(
    (org) => org._id === currentOrganizationId,
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-2">
          <Building2 className="h-4 w-4" />
          <span className="text-sm font-medium">
            {currentOrg?.name || "Select Organization"}
          </span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org._id}
            onClick={() => handleOrganizationChange(org._id)}
            className="cursor-pointer"
          >
            <div className="flex w-full items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-medium">{org.name}</span>
                <span className="text-xs text-muted-foreground">
                  {org.role.name}
                </span>
              </div>
              {currentOrganizationId === org._id && (
                <Check className="h-4 w-4" />
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
