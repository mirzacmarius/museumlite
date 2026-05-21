export type DeaccessionMethod =
  | "sale"
  | "donation"
  | "destruction"
  | "transfer";

export type DeaccessionTargetStatus = "deaccessioned" | "archived" | "deleted";

export interface EditDeaccessionFormData {
  reason: string;
  method: DeaccessionMethod;
  targetCollectionStatus: DeaccessionTargetStatus;
  disposition: string;
  notes: string;
  proceedsAmount: string;
  proceedsCurrency: string;
  proceedsRecipient: string;
  proceedsDate: string;
  proceedsNotes: string;
}
