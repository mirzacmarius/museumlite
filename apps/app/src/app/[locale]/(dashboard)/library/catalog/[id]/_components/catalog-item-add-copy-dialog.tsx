"use client";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Loader2, Plus } from "lucide-react";
import { useScopedI18n } from "@/locales/client";
import { CONDITION_VALUES, type Condition } from "./catalog-item-detail-types";
import type { CatalogItemDetailViewProps } from "./catalog-item-detail-view-props";

export function CatalogItemAddCopyDialog({
  isAddCopyOpen,
  setIsAddCopyOpen,
  newCopyBarcode,
  setNewCopyBarcode,
  newCopyCondition,
  setNewCopyCondition,
  newCopyShelfLocation,
  setNewCopyShelfLocation,
  isAddingCopy,
  handleAddCopy,
  generateBarcode,
  getConditionLabel,
}: Pick<
  CatalogItemDetailViewProps,
  | "isAddCopyOpen"
  | "setIsAddCopyOpen"
  | "newCopyBarcode"
  | "setNewCopyBarcode"
  | "newCopyCondition"
  | "setNewCopyCondition"
  | "newCopyShelfLocation"
  | "setNewCopyShelfLocation"
  | "isAddingCopy"
  | "handleAddCopy"
  | "generateBarcode"
  | "getConditionLabel"
>) {
  const t = useScopedI18n("library.placeholders");
  const tDetail = useScopedI18n("library.catalog.detail");
  const tLib = useScopedI18n("library");

  return (
    <Dialog open={isAddCopyOpen} onOpenChange={setIsAddCopyOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tDetail("addCopyDialog.title")}</DialogTitle>
          <DialogDescription>
            {tDetail("addCopyDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="barcode">
              {tDetail("addCopyDialog.barcodeLabel")}
            </Label>
            <div className="flex gap-2">
              <Input
                id="barcode"
                value={newCopyBarcode}
                onChange={(e) => setNewCopyBarcode(e.target.value)}
                placeholder={t("enterOrGenerateBarcode")}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (generateBarcode) {
                    setNewCopyBarcode(generateBarcode);
                  }
                }}
              >
                {tLib("generate")}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="condition">
              {tDetail("addCopyDialog.conditionLabel")}
            </Label>
            <Select
              value={newCopyCondition}
              onValueChange={(value: Condition) => setNewCopyCondition(value)}
            >
              <SelectTrigger>
                <SelectValue>{getConditionLabel(newCopyCondition)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CONDITION_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {getConditionLabel(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="shelfLocation">
              {tDetail("addCopyDialog.shelfLocationLabel")}
            </Label>
            <Input
              id="shelfLocation"
              value={newCopyShelfLocation}
              onChange={(e) => setNewCopyShelfLocation(e.target.value)}
              placeholder={tDetail("addCopyDialog.shelfLocationPlaceholder")}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsAddCopyOpen(false)}>
            {tLib("cancel")}
          </Button>
          <Button
            onClick={handleAddCopy}
            disabled={isAddingCopy || !newCopyBarcode.trim()}
          >
            {isAddingCopy ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Plus className="mr-2 size-4" />
            )}
            {tDetail("addCopyDialog.addCopyButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
