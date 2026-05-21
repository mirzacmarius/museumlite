"use client";

import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AddChildLocationDialog } from "../add-child-location-dialog";
import { DeleteLocationDialog } from "../delete-location-dialog";
import { EditLocationDialog } from "../edit-location-dialog";
import { MoveLocationDialog } from "../move-location-dialog";
import { LocationTreeInner } from "./location-tree-inner";
import type { LocationTreeProps, SelectedLocationAction } from "./types";
import { getLocationTreeDataVersion } from "./use-location-tree-items";

export function LocationTree({ organizationId }: LocationTreeProps) {
  const { push } = useRouter();
  const t = useScopedI18n("locations");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addChildDialogOpen, setAddChildDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] =
    useState<SelectedLocationAction | null>(null);
  const [treeVersion, setTreeVersion] = useState(0);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const allLocations = useQuery(
    api.locations.listAll,
    organizationId
      ? { organizationId: organizationId as Id<"organizations"> }
      : "skip",
  );

  const prevDataVersionRef = useRef<string>("");

  useEffect(() => {
    const hash = getLocationTreeDataVersion(allLocations);
    if (prevDataVersionRef.current && prevDataVersionRef.current !== hash) {
      setTreeVersion((v) => v + 1);
    }
    prevDataVersionRef.current = hash;
  }, [allLocations]);

  return (
    <>
      <div className="px-6 pt-4">
        <PermissionGate permission="locations.create">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedLocation(null);
              setAddChildDialogOpen(true);
            }}
          >
            <Plus className="mr-2 size-4" />
            {t("tree.addNewLocation")}
          </Button>
        </PermissionGate>
      </div>

      <LocationTreeInner
        key={`tree-${treeVersion}`}
        organizationId={organizationId}
        initialExpandedItems={expandedItems}
        onExpandedItemsChange={setExpandedItems}
        onEdit={(location) => {
          setSelectedLocation(location);
          setEditDialogOpen(true);
        }}
        onAddChild={(location) => {
          setSelectedLocation(location);
          setAddChildDialogOpen(true);
        }}
        onMove={(location) => {
          setSelectedLocation(location);
          setMoveDialogOpen(true);
        }}
        onDelete={(location) => {
          setSelectedLocation(location);
          setDeleteDialogOpen(true);
        }}
      />

      <EditLocationDialog
        locationId={selectedLocation?.id || ""}
        open={editDialogOpen && !!selectedLocation}
        onOpenChange={setEditDialogOpen}
      />

      <AddChildLocationDialog
        parentLocationId={selectedLocation?.id}
        parentLocationName={selectedLocation?.name}
        parentLocationType={selectedLocation?.type}
        parentLocationAddress={selectedLocation?.address}
        organizationId={organizationId}
        open={addChildDialogOpen}
        onOpenChange={setAddChildDialogOpen}
      />

      <MoveLocationDialog
        locationId={selectedLocation?.id || ""}
        locationName={selectedLocation?.name || ""}
        currentParentId={selectedLocation?.parentId}
        open={moveDialogOpen && !!selectedLocation}
        onOpenChange={setMoveDialogOpen}
      />

      <DeleteLocationDialog
        locationId={selectedLocation?.id || ""}
        locationName={selectedLocation?.name || ""}
        open={deleteDialogOpen && !!selectedLocation}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setSelectedLocation(null);
          }
        }}
        onDeleted={({ sentToDeaccessions }) => {
          setDeleteDialogOpen(false);
          setSelectedLocation(null);
          if (sentToDeaccessions) {
            push("/deaccessions");
          }
        }}
      />
    </>
  );
}
