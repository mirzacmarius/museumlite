"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { Truck } from "lucide-react";
import { usePermissions } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { DetailSection } from "../detail-section";
import { MoveRequestCard } from "./move-request-card";

const OPEN_STATUSES = new Set(["pending", "approved", "conflict"]);

interface OpenMoveRequestsProps {
  collectionId: Id<"collections">;
  organizationId: Id<"organizations">;
}

/**
 * Move requests still waiting for review or execution. Staff set an Object's
 * Location in the object form, so the page no longer starts moves (MUS-868);
 * this section shows only while a request made earlier is open, and finished
 * movements are listed in the Logs tab.
 */
export function OpenMoveRequests({
  collectionId,
  organizationId,
}: OpenMoveRequestsProps) {
  const t = useScopedI18n("locations.movements");
  const { hasPermission } = usePermissions();
  const requests = useQuery(
    api.locations.listMoveRequests,
    hasPermission("locations.read") ? { organizationId, collectionId } : "skip",
  );
  const open =
    requests?.filter((request) => OPEN_STATUSES.has(request.status)) ?? [];
  if (open.length === 0) return null;

  return (
    <DetailSection title={t("requests.title")} icon={Truck}>
      <ul className="space-y-3">
        {open.map((request) => (
          <MoveRequestCard
            key={request._id}
            request={request}
            canManage={hasPermission("locations.update")}
          />
        ))}
      </ul>
    </DetailSection>
  );
}
