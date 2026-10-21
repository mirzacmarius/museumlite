export type RemovalType = "sold" | "archived" | "move";
export type AccessionMode = "keep" | "auto" | "manual";

export interface DeaccessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId: import("@v1/backend/convex/_generated/dataModel").Id<"collections">;
  collectionTitle: string;
  organizationId: import("@v1/backend/convex/_generated/dataModel").Id<"organizations">;
  initialRemovalType?: RemovalType | null;
}

/** What the Object allows now, from `objectActions.get`. */
export type ObjectActions = NonNullable<
  import("convex/server").FunctionReturnType<
    typeof import("@v1/backend/convex/_generated/api").api.objectActions.get
  >
>;

type BlockedReason = Extract<
  ObjectActions["deaccession"] | ObjectActions["remove"],
  { state: "blocked" }
>["reason"];

/** The copy for each reason `objectActions.get` gives for a blocked action. */
export const BLOCKED_REASON_KEYS = {
  on_loan: "objects.deaccessionAction.onLoan",
  not_accessioned: "objects.deaccessionAction.notAccessioned",
  in_transfer: "objects.deaccessionAction.inTransfer",
} as const satisfies Record<BlockedReason, string>;
