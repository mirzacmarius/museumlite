"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import {
  type ReactNode,
  createContext,
  use,
  useCallback,
  useMemo,
} from "react";
import { useOrganization } from "./organization-provider";

interface PermissionContextType {
  permissions: string[];
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
}

const PermissionContext = createContext<PermissionContextType | undefined>(
  undefined,
);

/**
 * Provider that fetches all user permissions once and caches them
 * This eliminates N+1 queries when multiple components check permissions
 */
export function PermissionProvider({ children }: { children: ReactNode }) {
  const { currentOrganizationId } = useOrganization();

  const permissions = useQuery(
    api.roles.getUserPermissions,
    currentOrganizationId ? { organizationId: currentOrganizationId } : "skip",
  );

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!permissions) return false;
      return permissions.includes(permission);
    },
    [permissions],
  );

  const hasAnyPermission = useCallback(
    (perms: string[]): boolean => {
      if (!permissions) return false;
      return perms.some((p) => permissions.includes(p));
    },
    [permissions],
  );

  const hasAllPermissions = useCallback(
    (perms: string[]): boolean => {
      if (!permissions) return false;
      return perms.every((p) => permissions.includes(p));
    },
    [permissions],
  );

  const value = useMemo(
    () => ({
      permissions: permissions ?? [],
      isLoading: permissions === undefined,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
    }),
    [permissions, hasPermission, hasAnyPermission, hasAllPermissions],
  );

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

/**
 * Hook to access permission context
 */
export function usePermissions(): PermissionContextType {
  const context = use(PermissionContext);
  if (context === undefined) {
    throw new Error("usePermissions must be used within a PermissionProvider");
  }
  return context;
}

interface PermissionGateProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
  loadingFallback?: ReactNode;
}

/**
 * Component that conditionally renders children based on user permissions
 * Uses cached permissions from context instead of making individual queries
 */
export function PermissionGate({
  permission,
  children,
  fallback = null,
  loadingFallback = null,
}: PermissionGateProps) {
  const { hasPermission, isLoading } = usePermissions();

  if (isLoading) {
    return <>{loadingFallback}</>;
  }

  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface MultiPermissionGateProps {
  permissions: string[];
  mode?: "any" | "all";
  children: ReactNode;
  fallback?: ReactNode;
  loadingFallback?: ReactNode;
}

/**
 * Component that conditionally renders children based on multiple permissions
 */
export function MultiPermissionGate({
  permissions,
  mode = "any",
  children,
  fallback = null,
  loadingFallback = null,
}: MultiPermissionGateProps) {
  const { hasAnyPermission, hasAllPermissions, isLoading } = usePermissions();

  if (isLoading) {
    return <>{loadingFallback}</>;
  }

  const hasAccess =
    mode === "any"
      ? hasAnyPermission(permissions)
      : hasAllPermissions(permissions);

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Hook to check if user has a permission
 * @deprecated Use usePermissions().hasPermission() instead for better performance
 */
export function usePermission(
  organizationId: string | null,
  permission: string,
): boolean {
  // For backwards compatibility, try to use context first
  const context = use(PermissionContext);

  // Fallback to individual query for backwards compatibility
  // This path should be avoided as it causes N+1 queries
  const hasPermission = useQuery(
    api.roles.checkPermission,
    !context && organizationId
      ? {
          organizationId: organizationId as Id<"organizations">,
          permissionName: permission,
        }
      : "skip",
  );

  // If context is available and org matches, use cached permissions
  // Note: We can't check org match here since context doesn't expose orgId
  // but in practice the PermissionProvider uses the same org from useOrganization
  if (context) {
    return context.hasPermission(permission);
  }

  return hasPermission ?? false;
}

/**
 * Hook to get all user permissions for current organization
 * @deprecated Use usePermissions().permissions instead
 */
export function useUserPermissions(organizationId: string | null): string[] {
  // For backwards compatibility, try to use context first
  const context = use(PermissionContext);

  // Fallback to individual query for backwards compatibility
  const permissions = useQuery(
    api.roles.getUserPermissions,
    !context && organizationId
      ? {
          organizationId: organizationId as Id<"organizations">,
        }
      : "skip",
  );

  if (context) {
    return context.permissions;
  }

  return permissions ?? [];
}
