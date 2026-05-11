"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  type ReactNode,
  createContext,
  useCallback,
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
      locationTrackingEnabled?: boolean;
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
    parentOrganizationId?: Id<"organizations">;
    rootOrganizationId?: Id<"organizations">;
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
      locationTrackingEnabled?: boolean;
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
    parentOrganizationId?: Id<"organizations">;
    rootOrganizationId?: Id<"organizations">;
  } | null;
  isLoading: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(
  undefined,
);

type UserOrganizations = FunctionReturnType<
  typeof api.organizations.listUserOrganizations
>;

type ActiveOrgPreference = FunctionReturnType<typeof api.userPreferences.get>;

function getInitialOrganizationId(
  organizations: UserOrganizations | undefined,
  activeOrgPreference: ActiveOrgPreference | undefined,
) {
  if (!organizations || organizations.length === 0) {
    return null;
  }

  const preferredId = activeOrgPreference as Id<"organizations"> | null;
  const preferredOrganization = preferredId
    ? organizations.find((organization) => organization._id === preferredId)
    : undefined;

  return preferredOrganization?._id ?? organizations[0]?._id ?? null;
}

interface OrganizationProviderProps {
  children: ReactNode;
  initialOrganizations?: UserOrganizations;
  initialActiveOrgPreference?: ActiveOrgPreference;
}

export function OrganizationProvider({
  children,
  initialOrganizations,
  initialActiveOrgPreference,
}: OrganizationProviderProps) {
  const liveOrganizations = useQuery(
    api.organizations.listUserOrganizations,
    initialOrganizations ? "skip" : {},
  );
  const liveActiveOrgPreference = useQuery(
    api.userPreferences.get,
    initialActiveOrgPreference !== undefined
      ? "skip"
      : {
          key: "organization.activeOrgId",
        },
  );
  const organizations = liveOrganizations ?? initialOrganizations;
  const activeOrgPreference =
    liveActiveOrgPreference === undefined
      ? initialActiveOrgPreference
      : liveActiveOrgPreference;
  const setPreference = useMutation(api.userPreferences.set);
  const removePreference = useMutation(api.userPreferences.remove);
  const [currentOrganizationId, setCurrentOrganizationId] =
    useState<Id<"organizations"> | null>(() =>
      getInitialOrganizationId(
        initialOrganizations,
        initialActiveOrgPreference,
      ),
    );
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
