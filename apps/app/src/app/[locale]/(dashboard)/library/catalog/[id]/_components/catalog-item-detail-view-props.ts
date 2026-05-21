import type { Doc, Id } from "@v1/backend/convex/_generated/dataModel";
import type { Condition } from "./catalog-item-detail-types";

export type CatalogItemDetailItem = Doc<"libraryItems"> & {
  coverImageUrl?: string | null;
  totalCopies: number;
  availableCopies: number;
};

export interface CatalogItemDetailViewProps {
  item: CatalogItemDetailItem;
  itemId: Id<"libraryItems">;
  copies: Doc<"itemCopies">[] | undefined;
  generateBarcode: string | undefined;
  getConditionLabel: (value: string) => string;
  handlePublish: () => Promise<void>;
  handleArchive: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleDeleteCopy: (copyId: Id<"itemCopies">) => Promise<void>;
  isAddCopyOpen: boolean;
  setIsAddCopyOpen: (open: boolean) => void;
  newCopyBarcode: string;
  setNewCopyBarcode: (value: string) => void;
  newCopyCondition: Condition;
  setNewCopyCondition: (value: Condition) => void;
  newCopyShelfLocation: string;
  setNewCopyShelfLocation: (value: string) => void;
  isAddingCopy: boolean;
  handleAddCopy: () => Promise<void>;
}
