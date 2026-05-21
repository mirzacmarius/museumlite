"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { BulkActionsBar } from "./bulk-actions-bar";
import { BulkAddToGroupDialog } from "./bulk-add-to-group-dialog";
import { BulkDeaccessionDialog } from "./bulk-deaccession-dialog";
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

  return (
    <div className="flex flex-col h-full">
      <CollectionCatalogToolbar catalog={catalog} />

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
        />
      </div>

      <BulkActionsBar
        selectedCount={catalog.selectedIds.size}
        onClearSelection={catalog.handleClearSelection}
        onAddToGroup={() => catalog.setShowAddToGroupDialog(true)}
        onMoveLocation={() => catalog.setShowMoveLocationDialog(true)}
        onExport={catalog.handleBulkExport}
        onPrintLabels={() => catalog.setShowBulkPrintLabelsDialog(true)}
        onDeaccession={() => catalog.setShowBulkDeaccessionDialog(true)}
      />

      <BulkMoveLocationDialog
        open={catalog.showMoveLocationDialog}
        onOpenChange={catalog.setShowMoveLocationDialog}
        selectedIds={Array.from(catalog.selectedIds)}
        organizationId={organizationId}
        onSuccess={catalog.handleBulkSuccess}
      />

      <BulkDeaccessionDialog
        open={catalog.showBulkDeaccessionDialog}
        onOpenChange={catalog.setShowBulkDeaccessionDialog}
        selectedIds={Array.from(catalog.selectedIds)}
        onSuccess={catalog.handleBulkSuccess}
      />

      <BulkAddToGroupDialog
        open={catalog.showAddToGroupDialog}
        onOpenChange={catalog.setShowAddToGroupDialog}
        selectedIds={Array.from(catalog.selectedIds)}
        organizationId={organizationId}
        onSuccess={catalog.handleBulkSuccess}
      />

      <BulkPrintLabelsDialog
        open={catalog.showBulkPrintLabelsDialog}
        onOpenChange={catalog.setShowBulkPrintLabelsDialog}
        selectedIds={Array.from(catalog.selectedIds)}
        onSuccess={catalog.handleBulkSuccess}
      />
    </div>
  );
}
