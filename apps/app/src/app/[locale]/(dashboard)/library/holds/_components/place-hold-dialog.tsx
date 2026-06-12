import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Loader2 } from "lucide-react";
import type { Dispatch } from "react";
import type { HoldsPageAction, HoldsPageState } from "./holds-page-state";
import type { Translate } from "./holds-page-parts";

interface LibraryItemOption {
  _id: Id<"libraryItems">;
  title: string;
}

interface PatronLookup {
  _id: Id<"accounts">;
  firstName?: string;
  lastName?: string;
  cardNumber?: string;
}

interface PlaceHoldDialogProps {
  state: HoldsPageState;
  dispatch: Dispatch<HoldsPageAction>;
  patronLookup: PatronLookup | null | undefined;
  itemPage: LibraryItemOption[];
  isProcessing: boolean;
  onPlaceHold: () => void;
  tHolds: Translate;
  tLib: Translate;
}

export function PlaceHoldDialog({
  state,
  dispatch,
  patronLookup,
  itemPage,
  isProcessing,
  onPlaceHold,
  tHolds,
  tLib,
}: PlaceHoldDialogProps) {
  return (
    <Dialog
      open={state.isPlaceHoldDialogOpen}
      onOpenChange={(open) => !open && dispatch({ type: "closePlaceHoldDialog" })}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tHolds("placeDialog.title")}</DialogTitle>
          <DialogDescription>{tHolds("placeDialog.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{tHolds("placeDialog.patronCard")}</Label>
            <Input
              value={state.patronCardNumber}
              onChange={(event) =>
                dispatch({
                  type: "setPatronCardNumber",
                  value: event.target.value,
                })
              }
              placeholder={tLib("placeholders.scanPatronOrBarcode")}
            />
            {patronLookup && (
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={() =>
                  dispatch({
                    type: "selectPatron",
                    patronId: patronLookup._id,
                  })
                }
              >
                {patronLookup.firstName} {patronLookup.lastName}
                {patronLookup.cardNumber ? ` (${patronLookup.cardNumber})` : ""}
              </Button>
            )}
          </div>
          <div className="space-y-2">
            <Label>{tHolds("placeDialog.itemSearch")}</Label>
            <Input
              value={state.itemSearch}
              onChange={(event) =>
                dispatch({
                  type: "setItemSearch",
                  value: event.target.value,
                })
              }
              placeholder={tLib("placeholders.searchCatalog")}
            />
            {itemPage.length > 0 && (
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {itemPage.map((item) => (
                  <Button
                    key={item._id}
                    type="button"
                    variant={
                      state.selectedItemId === item._id ? "default" : "outline"
                    }
                    className="w-full justify-start"
                    onClick={() =>
                      dispatch({
                        type: "selectItem",
                        itemId: item._id,
                      })
                    }
                  >
                    {item.title}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => dispatch({ type: "closePlaceHoldDialog" })}
          >
            {tLib("cancel")}
          </Button>
          <Button
            onClick={() => void onPlaceHold()}
            disabled={
              isProcessing || !state.selectedPatronId || !state.selectedItemId
            }
          >
            {isProcessing && <Loader2 className="mr-2 size-4 animate-spin" />}
            {tHolds("actions.placeHold")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
