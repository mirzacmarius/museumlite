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
