"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useReducer, useRef } from "react";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { AddChildLocationDialog } from "../add-child-location-dialog/add-child-location-dialog";
import { DeleteLocationDialog } from "../delete-location-dialog";
import { EditLocationDialog } from "../edit-location-dialog/edit-location-dialog";
import { MoveLocationDialog } from "../move-location-dialog";
import { LocationTreeInner } from "./location-tree-inner";
import type { LocationTreeProps, SelectedLocationAction } from "./types";
import { getLocationTreeDataVersion } from "./use-location-tree-items";

interface LocationTreeState {
  editDialogOpen: boolean;
  addChildDialogOpen: boolean;
  moveDialogOpen: boolean;
  deleteDialogOpen: boolean;
  selectedLocation: SelectedLocationAction | null;
  treeVersion: number;
  expandedItems: string[];
}

type LocationTreeAction =
  | { type: "setEditDialogOpen"; value: boolean }
  | { type: "setAddChildDialogOpen"; value: boolean }
  | { type: "setMoveDialogOpen"; value: boolean }
  | { type: "setDeleteDialogOpen"; value: boolean }
  | { type: "setSelectedLocation"; value: SelectedLocationAction | null }
  | { type: "incrementTreeVersion" }
  | { type: "setExpandedItems"; value: string[] }
  | { type: "openAddNewLocation" }
  | { type: "openEdit"; location: SelectedLocationAction }
  | { type: "openAddChild"; location: SelectedLocationAction }
  | { type: "openMove"; location: SelectedLocationAction }
  | { type: "openDelete"; location: SelectedLocationAction }
  | { type: "closeDeleteDialog" }
  | { type: "deleteCompleted" };

const initialLocationTreeState: LocationTreeState = {
  editDialogOpen: false,
  addChildDialogOpen: false,
  moveDialogOpen: false,
  deleteDialogOpen: false,
  selectedLocation: null,
  treeVersion: 0,
  expandedItems: [],
};

function locationTreeReducer(
  state: LocationTreeState,
  action: LocationTreeAction,
): LocationTreeState {
  switch (action.type) {
    case "setEditDialogOpen":
      return { ...state, editDialogOpen: action.value };
    case "setAddChildDialogOpen":
      return { ...state, addChildDialogOpen: action.value };
    case "setMoveDialogOpen":
      return { ...state, moveDialogOpen: action.value };
    case "setDeleteDialogOpen":
      return { ...state, deleteDialogOpen: action.value };
    case "setSelectedLocation":
      return { ...state, selectedLocation: action.value };
    case "incrementTreeVersion":
      return { ...state, treeVersion: state.treeVersion + 1 };
    case "setExpandedItems":
      return { ...state, expandedItems: action.value };
    case "openAddNewLocation":
      return {
        ...state,
        selectedLocation: null,
        addChildDialogOpen: true,
      };
    case "openEdit":
      return {
        ...state,
        selectedLocation: action.location,
        editDialogOpen: true,
      };
    case "openAddChild":
      return {
        ...state,
        selectedLocation: action.location,
        addChildDialogOpen: true,
      };
    case "openMove":
      return {
        ...state,
        selectedLocation: action.location,
        moveDialogOpen: true,
      };
    case "openDelete":
      return {
        ...state,
        selectedLocation: action.location,
        deleteDialogOpen: true,
      };
    case "closeDeleteDialog":
      return {
        ...state,
        deleteDialogOpen: false,
        selectedLocation: null,
      };
    case "deleteCompleted":
      return {
        ...state,
        deleteDialogOpen: false,
        selectedLocation: null,
      };
  }
}

export function LocationTree({ organizationId }: LocationTreeProps) {
  const { push } = useRouter();
  const t = useScopedI18n("locations");
  const [state, dispatch] = useReducer(
    locationTreeReducer,
    initialLocationTreeState,
  );

  const allLocations = useQuery(
    api.locations.listAll,
    organizationId
      ? { organizationId: organizationId as Id<"organizations"> }
      : "skip",
  );

  const prevDataVersionRef = useRef<string>("");
  const expandedItemsRef = useRef<string[]>(state.expandedItems);

  useEffect(() => {
    expandedItemsRef.current = state.expandedItems;
  }, [state.expandedItems]);

  useEffect(() => {
    const hash = getLocationTreeDataVersion(allLocations);
    if (prevDataVersionRef.current && prevDataVersionRef.current !== hash) {
      dispatch({ type: "incrementTreeVersion" });
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
            onClick={() => dispatch({ type: "openAddNewLocation" })}
          >
            <Plus className="mr-2 size-4" />
            {t("tree.addNewLocation")}
          </Button>
        </PermissionGate>
      </div>

      <LocationTreeInner
        key={`tree-${state.treeVersion}`}
        organizationId={organizationId}
        initialExpandedItems={state.expandedItems}
        onExpandedItemsChange={(items) => {
          const previousItems = expandedItemsRef.current;
          if (
            previousItems.length === items.length &&
            previousItems.every((item, index) => item === items[index])
          ) {
            return;
          }

          expandedItemsRef.current = items;
          dispatch({ type: "setExpandedItems", value: items });
        }}
        onEdit={(location) => dispatch({ type: "openEdit", location })}
        onAddChild={(location) => dispatch({ type: "openAddChild", location })}
        onMove={(location) => dispatch({ type: "openMove", location })}
        onDelete={(location) => dispatch({ type: "openDelete", location })}
      />

      <EditLocationDialog
        locationId={state.selectedLocation?.id || ""}
        open={state.editDialogOpen && !!state.selectedLocation}
        onOpenChange={(open) =>
          dispatch({ type: "setEditDialogOpen", value: open })
        }
      />

      <AddChildLocationDialog
        parentLocationId={state.selectedLocation?.id}
        parentLocationName={state.selectedLocation?.name}
        parentLocationType={state.selectedLocation?.type}
        parentLocationAddress={state.selectedLocation?.address}
        organizationId={organizationId}
        open={state.addChildDialogOpen}
        onOpenChange={(open) =>
          dispatch({ type: "setAddChildDialogOpen", value: open })
        }
      />

      <MoveLocationDialog
        locationId={state.selectedLocation?.id || ""}
        locationName={state.selectedLocation?.name || ""}
        currentParentId={state.selectedLocation?.parentId}
        open={state.moveDialogOpen && !!state.selectedLocation}
        onOpenChange={(open) =>
          dispatch({ type: "setMoveDialogOpen", value: open })
        }
      />

      <DeleteLocationDialog
        locationId={state.selectedLocation?.id || ""}
        locationName={state.selectedLocation?.name || ""}
        open={state.deleteDialogOpen && !!state.selectedLocation}
        onOpenChange={(open) => {
          dispatch({ type: "setDeleteDialogOpen", value: open });
          if (!open) {
            dispatch({ type: "closeDeleteDialog" });
          }
        }}
        onDeleted={({ sentToDeaccessions }) => {
          dispatch({ type: "deleteCompleted" });
          if (sentToDeaccessions) {
            push("/deaccessions");
          }
        }}
      />
    </>
  );
}
