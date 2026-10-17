"use client";

import { Dialog } from "@v1/ui/dialog";
import { Label } from "@v1/ui/label";
import { RadioGroup, RadioGroupItem } from "@v1/ui/radio-group";
import { Switch } from "@v1/ui/switch";
import { useRef, useState } from "react";
import type { LabelData, LabelSize } from "@/components/qr-label-generator";
import { QRLabelGenerator } from "@/components/qr-label-generator";
import { useScopedI18n } from "@/locales/client";
import {
  PrintDialogShell,
  PrintInstructions,
  PrintPreviewStage,
} from "./print-dialog-shell";
import type { CollectionData } from "./types";

const QR_LABEL_SIZES = [
  { value: "1x1", key: "size1x1", dimensions: '1" × 1"' },
  { value: "2x2", key: "size2x2", dimensions: '2" × 2"' },
  { value: "1x3", key: "size1x3", dimensions: '1" × 3"' },
] as const satisfies readonly {
  value: LabelSize;
  key: "size1x1" | "size2x2" | "size1x3";
  dimensions: string;
}[];

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
  const [labelSize, setLabelSize] = useState<LabelSize>("1x1");
  const [showObjectName, setShowObjectName] = useState(true);
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
      <PrintDialogShell
        title={t("title")}
        description={t("dialogDescription")}
        cancelLabel={tCommon("cancel")}
        printLabel={t("print")}
        onCancel={onClose}
        onPrint={handlePrint}
        className="max-w-3xl"
      >
        <div className="grid min-h-full md:grid-cols-[minmax(0,17rem)_1fr] print:block">
          <div className="space-y-6 border-b p-4 sm:p-6 md:border-r md:border-b-0 print:hidden">
            <div className="space-y-3">
              <Label className="block text-sm font-medium">
                {t("labelSize")}
              </Label>
              <RadioGroup
                value={labelSize}
                onValueChange={(value) => setLabelSize(value as LabelSize)}
                className="grid gap-2"
              >
                {QR_LABEL_SIZES.map(({ value, key, dimensions }) => (
                  <Label
                    key={value}
                    htmlFor={`size-${value}`}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5 text-sm font-normal transition-colors hover:bg-muted/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                  >
                    <RadioGroupItem value={value} id={`size-${value}`} />
                    <span className="flex-1">{t(key)}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {dimensions}
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="qr-label-object-name">
                {t("showObjectName")}
              </Label>
              <Switch
                id="qr-label-object-name"
                checked={showObjectName}
                onCheckedChange={setShowObjectName}
              />
            </div>
            <PrintInstructions
              title={t("printInstructions")}
              items={[
                t("instructionPaperSize"),
                t("instructionOrientation"),
                t("instructionMargins"),
                t("instructionScale"),
              ]}
            />
          </div>

          <PrintPreviewStage className="min-h-[240px]">
            <div
              ref={printRef}
              className="shadow-lg print:m-0 print:shadow-none"
            >
              <QRLabelGenerator
                data={labelData}
                size={labelSize}
                showObjectName={showObjectName}
              />
            </div>
          </PrintPreviewStage>
        </div>
      </PrintDialogShell>
    </Dialog>
  );
}
