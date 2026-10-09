import { api } from "@v1/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { useMemo } from "react";
import { useOrganization } from "@/components/organization-provider";
import type {
  CapabilityId,
  CapabilityState,
  CapabilityStateLookup,
} from "@/lib/capability-access";

/**
 * The member's capability states for the active organization, computed by
 * the backend from the capability matrix. States are undefined while loading.
 */
export function useCapabilities() {
  const { currentOrganizationId } = useOrganization();
  const states = useQuery(
    api.capabilities.forOrganization,
    currentOrganizationId ? { organizationId: currentOrganizationId } : "skip",
  );

  return useMemo(() => {
    const byCapability = new Map<CapabilityId, CapabilityState>(
      (states ?? []).map((state) => [state.capability, state]),
    );
    const stateOf: CapabilityStateLookup = (capability) => {
      if (states === undefined) return undefined;
      return (
        byCapability.get(capability) ?? {
          capability,
          listed: true,
          status: "permission_missing",
        }
      );
    };
    return {
      stateOf,
      isAvailable: (capability: CapabilityId) =>
        stateOf(capability)?.status === "available",
    };
  }, [states]);
}
