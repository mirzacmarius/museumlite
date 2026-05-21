import type { Id } from "@v1/backend/convex/_generated/dataModel";

export interface SelectedPatron {
  _id: Id<"accounts">;
  firstName?: string;
  lastName?: string;
  cardNumber?: string;
}

export interface SelectedCopy {
  copy: {
    _id: Id<"itemCopies">;
    barcode: string;
  };
  item?: { title: string } | null;
  circulation?: {
    _id: Id<"circulations">;
    dueDate: number;
    item?: { title: string } | null;
    account?: { firstName?: string; lastName?: string } | null;
  } | null;
}

export interface CheckinResult {
  success: boolean;
  fineCreated: boolean;
  fineAmount?: number;
}
