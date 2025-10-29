"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from "react";

interface OrganizationContextType {
  currentOrganizationId: Id<"organizations"> | null;
  setCurrentOrganizationId: (id: Id<"organizations"> | null) => void;
  organizations: Array<{
    _id: Id<"organizations">;
    name: string;
    slug: string;
    type: "museum" | "gallery" | "library" | "collector";
    role: {
      _id: Id<"roles">;
      name: string;
      description?: string;
      isSystemRole: boolean;
    };
    _creationTime: number;
  }>;
  currentOrganization: {
    _id: Id<"organizations">;
    name: string;
    slug: string;
    type: "museum" | "gallery" | "library" | "collector";
    role: {
      _id: Id<"roles">;
      name: string;
      description?: string;
      isSystemRole: boolean;
    };
  } | null;
  isLoading: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(
  undefined,
);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const organizations = useQuery(api.organizations.listUserOrganizations);
  const [currentOrganizationId, setCurrentOrganizationId] = useState<
    Id<"organizations"> | null
  >(null);

  // Set first organization as default if none selected
  useEffect(() => {
    if (!currentOrganizationId && organizations && organizations.length > 0) {
      setCurrentOrganizationId(organizations[0]._id);
    }
  }, [currentOrganizationId, organizations]);

  const currentOrganization = useMemo(() => {
    if (!currentOrganizationId || !organizations) return null;
    return (
      organizations.find((org) => org._id === currentOrganizationId) ?? null
    );
  }, [currentOrganizationId, organizations]);

  const value = useMemo(
    () => ({
      currentOrganizationId,
      setCurrentOrganizationId,
      organizations: organizations ?? [],
      currentOrganization,
      isLoading: organizations === undefined,
    }),
    [currentOrganizationId, organizations, currentOrganization],
  );

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error(
      "useOrganization must be used within an OrganizationProvider",
    );
  }
  return context;
}

