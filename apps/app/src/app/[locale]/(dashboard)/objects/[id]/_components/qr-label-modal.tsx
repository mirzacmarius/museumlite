"use client";

import { QRLabelGenerator } from "@/components/qr-label-generator";
import type { LabelData, LabelSize } from "@/components/qr-label-generator";
import { useScopedI18n } from "@/locales/client";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Label } from "@v1/ui/label";
import { RadioGroup, RadioGroupItem } from "@v1/ui/radio-group";
import { Printer } from "lucide-react";
import { useRef, useState } from "react";
import type { CollectionData } from "./types";

interface QRLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: CollectionData;
  qrCodeUrl: string;
  organizationName?: string;
}

export function QRLabelModal({
  isOpen,
  onClose,
  collection,
  qrCodeUrl,
  organizationName,
}: QRLabelModalProps) {
  const t = useScopedI18n("objects.qrLabel");
  const tCommon = useScopedI18n("common");
  const [labelSize, setLabelSize] = useState<LabelSize>("2x2");
  const printRef = useRef<HTMLDivElement>(null);

  const labelData: LabelData = {
    accessionNumber: collection.accessionNumber,
    title: collection.title,
    qrCodeUrl,
    organizationName,
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="flex flex-col max-w-2xl w-full h-[90vh] bg-white text-black p-0 print:max-w-none print:max-h-none print:h-auto print:w-full print:overflow-visible print:shadow-none print:border-none print:rounded-none print:p-0"
      >
        <DialogHeader className="flex-shrink-0 print:hidden border-b border-zinc-200 p-6 pb-4">
          <DialogTitle className="text-black">{t("title")}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto print:overflow-visible">
          {/* Label Size Selection */}
          <div className="p-6 border-b border-zinc-200 print:hidden">
            <Label className="text-sm font-medium text-black mb-3 block">
              {t("labelSize")}
            </Label>
            <RadioGroup
              value={labelSize}
              onValueChange={(value) => setLabelSize(value as LabelSize)}
              className="flex gap-4"
            >
              <div className="flex items-center gap-x-2">
                <RadioGroupItem value="2x2" id="size-2x2" />
                <Label
                  htmlFor="size-2x2"
                  className="text-sm text-black cursor-pointer"
                >
                  {t("size2x2")} (2" × 2")
                </Label>
              </div>
              <div className="flex items-center gap-x-2">
                <RadioGroupItem value="1x3" id="size-1x3" />
                <Label
                  htmlFor="size-1x3"
                  className="text-sm text-black cursor-pointer"
                >
                  {t("size1x3")} (1" × 3")
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Label Preview */}
          <div className="p-6 flex items-center justify-center min-h-[400px] bg-zinc-50 print:bg-white print:p-0 print:min-h-0">
            <div
              ref={printRef}
              className="shadow-lg print:shadow-none print:m-0"
            >
              <QRLabelGenerator data={labelData} size={labelSize} />
            </div>
          </div>

          {/* Instructions */}
          <div className="p-6 border-t border-zinc-200 bg-blue-50 print:hidden">
            <h3 className="text-sm font-medium text-blue-900 mb-2">
              {t("printInstructions")}
            </h3>
            <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
              <li>{t("instructionPaperSize")}</li>
              <li>{t("instructionOrientation")}</li>
              <li>{t("instructionMargins")}</li>
              <li>{t("instructionScale")}</li>
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex-shrink-0 flex justify-end gap-2 p-6 pt-4 border-t border-zinc-200 bg-white print:hidden">
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-zinc-900 text-white border-zinc-300 hover:bg-zinc-100 hover:text-black"
          >
            {tCommon("cancel")}
          </Button>
          <Button
            onClick={handlePrint}
            className="bg-zinc-900 text-white hover:bg-zinc-800"
          >
            <Printer className="mr-2 size-4" />
            {t("print")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
