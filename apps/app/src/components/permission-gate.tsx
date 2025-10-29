"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { type ReactNode } from "react";
import { useOrganization } from "./organization-provider";

interface PermissionGateProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Component that conditionally renders children based on user permissions
 */
export function PermissionGate({
  permission,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { currentOrganizationId } = useOrganization();

  const hasPermission = useQuery(
    api.roles.checkPermission,
    currentOrganizationId
      ? {
          organizationId: currentOrganizationId,
          permissionName: permission,
        }
      : "skip",
  );

  if (hasPermission === undefined) {
    // Loading state
    return null;
  }

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Hook to check if user has a permission
 */
export function usePermission(
  organizationId: string | null,
  permission: string,
): boolean {
  const hasPermission = useQuery(
    api.roles.checkPermission,
    organizationId
      ? {
          organizationId: organizationId as any,
          permissionName: permission,
        }
      : "skip",
  );

  return hasPermission ?? false;
}

/**
 * Hook to get all user permissions for current organization
 */
export function useUserPermissions(organizationId: string | null): string[] {
  const permissions = useQuery(
    api.roles.getUserPermissions,
    organizationId
      ? {
          organizationId: organizationId as any,
        }
      : "skip",
  );

  return permissions ?? [];
}

