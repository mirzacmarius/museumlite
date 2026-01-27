"use client";

import { useOrganization } from "@/components/organization-provider";
import { useScopedI18n } from "@/locales/client";
import { useCurrentLocale } from "@/locales/client";
import { api } from "@v1/backend/convex/_generated/api";
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
import { Label } from "@v1/ui/label";
import { RadioGroup, RadioGroupItem } from "@v1/ui/radio-group";
import { useQuery } from "convex/react";
import { Printer } from "lucide-react";
import { useRef, useState } from "react";
import {
  LabelSize,
  QRLabelSheet,
  type LabelData,
} from "@/components/qr-label-generator";

interface BulkPrintLabelsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: Id<"collections">[];
  onSuccess: () => void;
}

export function BulkPrintLabelsDialog({
  open,
  onOpenChange,
  selectedIds,
  onSuccess,
}: BulkPrintLabelsDialogProps) {
  const t = useScopedI18n("objects.bulkDialogs.printLabels");
  const tQrLabel = useScopedI18n("objects.qrLabel");
  const tCommon = useScopedI18n("common");
  const locale = useCurrentLocale();
  const [labelSize, setLabelSize] = useState<LabelSize>("2x2");
  const printRef = useRef<HTMLDivElement>(null);
  const { currentOrganizationId } = useOrganization();

  // Fetch all collections in a single batch query
  const collections = useQuery(
    api.collections.getBatch,
    currentOrganizationId && selectedIds.length > 0
      ? {
          organizationId: currentOrganizationId,
          collectionIds: selectedIds,
        }
      : "skip",
  );

  // Check if query has loaded
  const isLoading = collections === undefined;
  const loadedCollections = collections ?? [];

  // Build label data for all loaded collections
  const labelData: LabelData[] = loadedCollections.map((collection) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const qrCodeUrl = `${origin}/${locale}/objects/${collection._id}`;

    return {
      accessionNumber: collection.accessionNumber,
      title: collection.title,
      qrCodeUrl,
    };
  });

  const handlePrint = () => {
    window.print();
    // After print dialog closes, mark as success
    setTimeout(() => {
      onSuccess();
      onOpenChange(false);
    }, 500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col max-w-6xl w-full h-[90vh] bg-white text-black p-0 print:max-w-none print:max-h-none print:h-auto print:w-full print:overflow-visible print:shadow-none print:border-none print:rounded-none print:p-0">
        <DialogHeader className="flex-shrink-0 print:hidden border-b border-gray-200 p-6 pb-4">
          <DialogTitle className="text-black">{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", {
              count: selectedIds.length,
              s: selectedIds.length !== 1 ? "s" : "",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto print:overflow-visible">
          {/* Label Size Selection */}
          <div className="p-6 border-b border-gray-200 print:hidden">
            <Label className="text-sm font-medium text-black mb-3 block">
              {tQrLabel("labelSize")}
            </Label>
            <RadioGroup
              value={labelSize}
              onValueChange={(value) => setLabelSize(value as LabelSize)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="2x2" id="bulk-size-2x2" />
                <Label
                  htmlFor="bulk-size-2x2"
                  className="text-sm text-black cursor-pointer"
                >
                  {tQrLabel("size2x2")} (2" × 2")
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="1x3" id="bulk-size-1x3" />
                <Label
                  htmlFor="bulk-size-1x3"
                  className="text-sm text-black cursor-pointer"
                >
                  {tQrLabel("size1x3")} (1" × 3")
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Labels Preview */}
          <div className="print:p-0">
            {isLoading ? (
              <div className="flex items-center justify-center p-12 print:hidden">
                <div className="text-center">
                  <div className="text-sm text-gray-500">
                    {t("loadingLabels")}
                  </div>
                </div>
              </div>
            ) : labelData.length > 0 ? (
              <div ref={printRef}>
                <QRLabelSheet labels={labelData} size={labelSize} />
              </div>
            ) : (
              <div className="flex items-center justify-center p-12 print:hidden">
                <div className="text-center">
                  <div className="text-sm text-gray-500">{t("noLabels")}</div>
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="p-6 border-t border-gray-200 bg-blue-50 print:hidden">
            <h3 className="text-sm font-medium text-blue-900 mb-2">
              {tQrLabel("printInstructions")}
            </h3>
            <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
              <li>{tQrLabel("instructionPaperSize")}</li>
              <li>{tQrLabel("instructionOrientation")}</li>
              <li>{tQrLabel("instructionMargins")}</li>
              <li>{tQrLabel("instructionScale")}</li>
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="flex-shrink-0 p-6 pt-4 border-t border-gray-200 bg-white print:hidden">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            onClick={handlePrint}
            disabled={isLoading || labelData.length === 0}
            className="bg-gray-900 text-white hover:bg-gray-800"
          >
            <Printer className="mr-2 h-4 w-4" />
            {tQrLabel("print")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
