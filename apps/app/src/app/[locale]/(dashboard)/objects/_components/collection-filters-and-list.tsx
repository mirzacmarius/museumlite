"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { PenLine } from "lucide-react";
import { useRef } from "react";
import { ExportJobControl } from "@/components/export-job-control";
import { PermissionGate } from "@/components/permission-gate";
import { useScopedI18n } from "@/locales/client";
import { AddObjectsToCollectionDialog } from "./add-objects-to-collection-dialog";
import { BulkActionsBar } from "./bulk-actions-bar";
import { BulkAddToGroupDialog } from "./bulk-add-to-group-dialog";
import { BulkDeaccessionDialog } from "./bulk-deaccession-dialog";
import { BulkEditFieldDialog } from "./bulk-edit-field-dialog";
import { BulkEditNotice } from "./bulk-edit-progress";
import { BulkMoveLocationDialog } from "./bulk-move-location-dialog";
import { BulkPrintLabelsDialog } from "./bulk-print-labels-dialog";
import { CollectionCatalogToolbar } from "./collection-catalog-toolbar";
import { CollectionList } from "./collection-list";
import { useCollectionCatalogList } from "./use-collection-catalog-list";

export function CollectionFiltersAndList({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const catalog = useCollectionCatalogList(organizationId);
  const tExport = useScopedI18n("exportJobs");
  const tBulkEdit = useScopedI18n("objects.bulkEdit");
  const selectedIds = Array.from(catalog.selectedIds);
  // Where focus goes when the selection bar, or a dialog it opened, closes.
  const listRef = useRef<HTMLElement>(null);

  return (
    <div className="flex flex-col h-full">
      <CollectionCatalogToolbar catalog={catalog} />

      <PermissionGate permission="collections.read">
        <div className="flex flex-col gap-2 px-4 py-2">
          <ExportJobControl
            organizationId={organizationId}
            source={{
              kind: "objects",
              mode: "filtered",
              filters: catalog.exportFilters,
            }}
            label={tExport("catalogFiltered")}
          />
          {catalog.selectedIds.size > 0 && (
            <ExportJobControl
              organizationId={organizationId}
              source={{ kind: "objects", mode: "selected", filters: {} }}
              selectedIds={Array.from(catalog.selectedIds)}
              label={tExport("selected", { count: catalog.selectedIds.size })}
            />
          )}
          {catalog.isFiltered ? (
            <PermissionGate permission="collections.update">
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => catalog.setBulkEditScope("filters")}
              >
                <PenLine className="mr-2 size-4" aria-hidden="true" />
                {tBulkEdit("editAllMatching")}
              </Button>
            </PermissionGate>
          ) : null}
          <BulkEditNotice organizationId={organizationId} />
        </div>
      </PermissionGate>

      <div className="relative flex-1 overflow-hidden bg-background">
        <CollectionList
          organizationId={organizationId}
          collections={catalog.collections}
          collectionsStatus={catalog.collectionsStatus}
          viewMode={catalog.viewMode}
          columns={catalog.columns ?? catalog.defaultColumns}
          selectedIds={catalog.selectedIds}
          onSelectItem={catalog.handleSelectItem}
          onSelectAll={catalog.handleSelectAll}
          onLoadMore={catalog.loadMore}
          activeCollectionGroup={catalog.activeCollectionGroup}
          onAddToCollection={() => catalog.setShowAddToCollectionDialog(true)}
          isFiltered={catalog.isFiltered}
          onClearFilters={catalog.resetFilters}
          listRef={listRef}
        />
      </div>

      <BulkActionsBar
        selectedCount={catalog.selectedIds.size}
        onClearSelection={catalog.handleClearSelection}
        onAddToGroup={() => catalog.setShowAddToGroupDialog(true)}
        onMoveLocation={() => catalog.setShowMoveLocationDialog(true)}
        onPrintLabels={() => catalog.setShowBulkPrintLabelsDialog(true)}
        onDeaccession={() => catalog.setShowBulkDeaccessionDialog(true)}
        onEditField={() => catalog.setBulkEditScope("selection")}
        returnFocusRef={listRef}
      />

      {catalog.bulkEditScope ? (
        <BulkEditFieldDialog
          open
          onOpenChange={(open) => {
            if (!open) catalog.setBulkEditScope(null);
          }}
          organizationId={organizationId}
          scope={
            catalog.bulkEditScope === "selection"
              ? { kind: "selection", collectionIds: selectedIds }
              : { kind: "filters", filters: catalog.exportFilters }
          }
          onStarted={
            catalog.bulkEditScope === "selection"
              ? catalog.handleBulkSuccess
              : undefined
          }
          fallbackFocusRef={listRef}
        />
      ) : null}

      <BulkMoveLocationDialog
        open={catalog.showMoveLocationDialog}
        onOpenChange={catalog.setShowMoveLocationDialog}
        selectedIds={Array.from(catalog.selectedIds)}
        organizationId={organizationId}
        onSuccess={catalog.handleBulkSuccess}
        fallbackFocusRef={listRef}
      />

      <BulkDeaccessionDialog
        open={catalog.showBulkDeaccessionDialog}
        onOpenChange={catalog.setShowBulkDeaccessionDialog}
        selectedIds={Array.from(catalog.selectedIds)}
        onSuccess={catalog.handleBulkSuccess}
        fallbackFocusRef={listRef}
      />

      <BulkAddToGroupDialog
        open={catalog.showAddToGroupDialog}
        onOpenChange={catalog.setShowAddToGroupDialog}
        selectedIds={Array.from(catalog.selectedIds)}
        organizationId={organizationId}
        onSuccess={catalog.handleBulkSuccess}
        fallbackFocusRef={listRef}
      />

      <BulkPrintLabelsDialog
        open={catalog.showBulkPrintLabelsDialog}
        onOpenChange={catalog.setShowBulkPrintLabelsDialog}
        selectedIds={Array.from(catalog.selectedIds)}
        onSuccess={catalog.handleBulkSuccess}
        fallbackFocusRef={listRef}
      />

      {catalog.activeCollectionGroup ? (
        <AddObjectsToCollectionDialog
          open={catalog.showAddToCollectionDialog}
          onOpenChange={catalog.setShowAddToCollectionDialog}
          groupId={catalog.activeCollectionGroup._id}
          groupName={catalog.activeCollectionGroup.name}
          organizationId={organizationId}
          onSuccess={catalog.handleBulkSuccess}
        />
      ) : null}
    </div>
  );
}
