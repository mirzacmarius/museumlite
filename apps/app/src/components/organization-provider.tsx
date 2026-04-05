"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
  type ReactNode,
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
    settings?: {
      enabledIntegrations?: string[];
      enabledModules?: Array<
        | "library"
        | "fine_art"
        | "wine"
        | "automotive"
        | "natural_history"
        | "archive"
        | "accounts"
      >;
    };
    subscriptionTier?: "free" | "pro" | "enterprise";
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
    settings?: {
      enabledIntegrations?: string[];
      enabledModules?: Array<
        | "library"
        | "fine_art"
        | "wine"
        | "automotive"
        | "natural_history"
        | "archive"
        | "accounts"
      >;
    };
    subscriptionTier?: "free" | "pro" | "enterprise";
  } | null;
  isLoading: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(
  undefined,
);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const organizations = useQuery(api.organizations.listUserOrganizations);
  const activeOrgPreference = useQuery(api.userPreferences.get, {
    key: "organization.activeOrgId",
  });
  const setPreference = useMutation(api.userPreferences.set);
  const removePreference = useMutation(api.userPreferences.remove);
  const [currentOrganizationId, setCurrentOrganizationId] =
    useState<Id<"organizations"> | null>(null);
  const hasBootstrappedPreference = useRef(false);

  const persistOrganizationSelection = useCallback(
    (organizationId: Id<"organizations"> | null) => {
      if (organizationId) {
        void setPreference({
          key: "organization.activeOrgId",
          value: organizationId,
        });
        return;
      }

      void removePreference({ key: "organization.activeOrgId" });
    },
    [removePreference, setPreference],
  );

  const handleSetCurrentOrganizationId = useCallback(
    (organizationId: Id<"organizations"> | null) => {
      setCurrentOrganizationId(organizationId);
      persistOrganizationSelection(organizationId);
    },
    [persistOrganizationSelection],
  );

  useEffect(() => {
    if (organizations === undefined || activeOrgPreference === undefined) {
      return;
    }

    if (!organizations || organizations.length === 0) {
      if (currentOrganizationId !== null) {
        setCurrentOrganizationId(null);
      }
      if (activeOrgPreference && !hasBootstrappedPreference.current) {
        hasBootstrappedPreference.current = true;
        persistOrganizationSelection(null);
      }
      return;
    }

    const orgIds = new Set(organizations.map((o) => o._id));
    const currentIsValid = currentOrganizationId
      ? orgIds.has(currentOrganizationId)
      : false;

    if (currentIsValid) {
      return;
    }

    const preferredId = activeOrgPreference as Id<"organizations"> | null;
    const preferredIsValid = preferredId ? orgIds.has(preferredId) : false;
    const fallbackId = organizations[0]?._id ?? null;
    const desiredId = preferredIsValid ? preferredId : fallbackId;

    if (desiredId !== currentOrganizationId) {
      setCurrentOrganizationId(desiredId);
    }

    if (
      fallbackId &&
      !hasBootstrappedPreference.current &&
      (!activeOrgPreference || !preferredIsValid)
    ) {
      hasBootstrappedPreference.current = true;
      persistOrganizationSelection(fallbackId);
    }
  }, [
    activeOrgPreference,
    organizations,
    currentOrganizationId,
    persistOrganizationSelection,
  ]);

  const currentOrganization = useMemo(() => {
    if (!currentOrganizationId || !organizations) return null;
    return (
      organizations.find((org) => org._id === currentOrganizationId) ?? null
    );
  }, [currentOrganizationId, organizations]);

  const value = useMemo(
    () => ({
      currentOrganizationId,
      setCurrentOrganizationId: handleSetCurrentOrganizationId,
      organizations: organizations ?? [],
      currentOrganization,
      isLoading: organizations === undefined,
    }),
    [
      currentOrganizationId,
      handleSetCurrentOrganizationId,
      organizations,
      currentOrganization,
    ],
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
