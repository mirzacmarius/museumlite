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
import { Label } from "@v1/ui/label";
import { RadioGroup, RadioGroupItem } from "@v1/ui/radio-group";
import { Printer } from "lucide-react";
import { type RefObject, useState } from "react";
import type { LabelData, LabelSize } from "@/components/qr-label-generator";
import { QRLabelSheet } from "@/components/qr-label-generator";
import { useScopedI18n } from "@/locales/client";

const LABEL_SIZES: LabelSize[] = ["1x1", "2x2", "3x1"];
const SIZE_DIMENSIONS: Record<LabelSize, string> = {
  "1x1": '(1" × 1")',
  "2x2": '(2" × 2")',
  "3x1": '(3" × 1")',
};

/**
 * A printable sheet of QR labels with a size choice. `labels` is undefined
 * while they load. Printing uses the browser's print dialog.
 */
export function LabelSheetDialog({
  open,
  onOpenChange,
  title,
  description,
  labels,
  onPrinted,
  fallbackFocusRef,
  idPrefix,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  labels: LabelData[] | undefined;
  onPrinted?: () => void;
  /** Takes focus on close when the control that opened it is gone. */
  fallbackFocusRef?: RefObject<HTMLElement | null>;
  idPrefix: string;
}) {
  const t = useScopedI18n("objects.bulkDialogs.printLabels");
  const tQrLabel = useScopedI18n("objects.qrLabel");
  const tCommon = useScopedI18n("common");
  const [labelSize, setLabelSize] = useState<LabelSize>("1x1");
  const isLoading = labels === undefined;

  const handlePrint = () => {
    window.print();
    // After print dialog closes, mark as success
    setTimeout(() => {
      onPrinted?.();
      onOpenChange(false);
    }, 500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        fallbackFocusRef={fallbackFocusRef}
        className="flex flex-col max-w-6xl w-full h-[90vh] bg-white text-black p-0 print:max-w-none print:max-h-none print:h-auto print:w-full print:overflow-visible print:shadow-none print:border-none print:rounded-none print:p-0"
      >
        <DialogHeader className="flex-shrink-0 print:hidden border-b border-zinc-200 p-6 pb-4">
          <DialogTitle className="text-black">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto print:overflow-visible">
          <div className="p-6 border-b border-zinc-200 print:hidden">
            <Label className="text-sm font-medium text-black mb-3 block">
              {tQrLabel("labelSize")}
            </Label>
            <RadioGroup
              value={labelSize}
              onValueChange={(value) => setLabelSize(value as LabelSize)}
              className="flex flex-wrap gap-x-4 gap-y-2"
            >
              {LABEL_SIZES.map((size) => (
                <div key={size} className="flex items-center gap-x-2">
                  <RadioGroupItem
                    value={size}
                    id={`${idPrefix}-size-${size}`}
                  />
                  <Label
                    htmlFor={`${idPrefix}-size-${size}`}
                    className="text-sm text-black cursor-pointer"
                  >
                    {tQrLabel(`size${size}`)} {SIZE_DIMENSIONS[size]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="print:p-0">
            {isLoading ? (
              <div className="flex items-center justify-center p-12 print:hidden">
                <div className="text-sm text-zinc-500">
                  {t("loadingLabels")}
                </div>
              </div>
            ) : labels.length > 0 ? (
              <QRLabelSheet labels={labels} size={labelSize} />
            ) : (
              <div className="flex items-center justify-center p-12 print:hidden">
                <div className="text-sm text-zinc-500">{t("noLabels")}</div>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-zinc-200 bg-blue-50 print:hidden">
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

        <DialogFooter className="flex-shrink-0 p-6 pt-4 border-t border-zinc-200 bg-white print:hidden">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            onClick={handlePrint}
            disabled={isLoading || labels.length === 0}
            className="bg-zinc-900 text-white hover:bg-zinc-800"
          >
            <Printer className="mr-2 size-4" />
            {tQrLabel("print")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The label URL a scanner resolves: the record's page in the app. */
export function recordLabelUrl(
  locale: string,
  kind: "objects" | "locations",
  id: string,
) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/${locale}/${kind}/${id}`;
}
