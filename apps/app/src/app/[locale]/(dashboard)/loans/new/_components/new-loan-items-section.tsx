"use client";

import { CollectionMultiSelectCombobox } from "@/components/collection-multi-select-combobox";
import { useScopedI18n } from "@/locales/client";
import type { Doc, Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Label } from "@v1/ui/label";
import { SelectedCollectionItem } from "./selected-collection-item";

interface CollectionInActiveLoan {
  collectionId: string;
  status: string;
  loanNumber: string;
}

interface NewLoanItemsSectionProps {
  organizationId: string;
  selectedCollectionIds: string[];
  selectedCollectionsList: Array<
    Pick<Doc<"collections">, "_id" | "accessionNumber" | "title"> & {
      primaryImageUrl?: string;
    }
  >;
  itemConditions: Record<string, string>;
  problematicCollectionIds: Set<string>;
  collectionsInActiveLoans: CollectionInActiveLoan[] | undefined;
  onSelectionChange: (ids: string[]) => void;
  onConditionChange: (collectionId: string, value: string) => void;
  onRemoveCollection: (collectionId: string) => void;
  onClearAll: () => void;
}

export function NewLoanItemsSection({
  organizationId,
  selectedCollectionIds,
  selectedCollectionsList,
  itemConditions,
  problematicCollectionIds,
  collectionsInActiveLoans,
  onSelectionChange,
  onConditionChange,
  onRemoveCollection,
  onClearAll,
}: NewLoanItemsSectionProps) {
  const t = useScopedI18n("loans");

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
        <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] text-foreground">
          3
        </span>
        Loan Items
      </h2>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label>Select Collections</Label>
          <CollectionMultiSelectCombobox
            organizationId={organizationId as Id<"organizations">}
            selectedIds={selectedCollectionIds}
            onSelectionChange={onSelectionChange}
            placeholder={t("placeholders.collections")}
          />
        </div>

        {selectedCollectionIds.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                Selected ({selectedCollectionIds.length})
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs text-muted-foreground hover:text-destructive"
                onClick={onClearAll}
              >
                Clear all
              </Button>
            </div>

            <div className="space-y-3">
              {selectedCollectionsList.map((collection) => {
                const hasIssue = problematicCollectionIds.has(collection._id);
                const issueInfo = collectionsInActiveLoans?.find(
                  (item) => item.collectionId === collection._id,
                );
                const issueMessage = issueInfo
                  ? `Already in ${issueInfo.status} loan ${issueInfo.loanNumber}`
                  : undefined;

                return (
                  <SelectedCollectionItem
                    key={collection._id}
                    collection={collection}
                    condition={itemConditions[collection._id] || ""}
                    onConditionChange={(value) =>
                      onConditionChange(collection._id, value)
                    }
                    onRemove={() => onRemoveCollection(collection._id)}
                    hasIssue={hasIssue}
                    issueMessage={issueMessage}
                    conditionPlaceholder={t("placeholders.condition")}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
