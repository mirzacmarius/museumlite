"use client";

import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Label } from "@v1/ui/label";
import { RadioGroup, RadioGroupItem } from "@v1/ui/radio-group";
import { Switch } from "@v1/ui/switch";
import { Textarea } from "@v1/ui/textarea";
import { Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  ObjectTextLabelGenerator,
  type ObjectTextLabelSize,
} from "@/components/object-text-label-generator";
import { useScopedI18n } from "@/locales/client";
import type { CollectionData } from "./types";

interface ObjectLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: CollectionData;
}

const ACCESSION_FONT_SIZE_MIN = 7;
const ACCESSION_FONT_SIZE_MAX = 14;
const ACCESSION_FONT_SIZE_DEFAULT = 9;

export function ObjectLabelModal({
  isOpen,
  onClose,
  collection,
}: ObjectLabelModalProps) {
  const t = useScopedI18n("objects.objectLabel");
  const tCommon = useScopedI18n("common");
  const [labelSize, setLabelSize] = useState<ObjectTextLabelSize>("medium");
  const [showBorder, setShowBorder] = useState(true);
  const [accessionFontSize, setAccessionFontSize] = useState(
    ACCESSION_FONT_SIZE_DEFAULT,
  );
  const [objectName, setObjectName] = useState(collection.title);
  const [description, setDescription] = useState(collection.description ?? "");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setObjectName(collection.title);
    setDescription(collection.description ?? "");
    setLabelSize("medium");
    setShowBorder(true);
    setAccessionFontSize(ACCESSION_FONT_SIZE_DEFAULT);
  }, [collection.description, collection.title, isOpen]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="flex flex-col max-w-3xl w-full h-[90vh] bg-white text-black p-0 print:max-w-none print:max-h-none print:h-auto print:w-full print:overflow-visible print:shadow-none print:border-none print:rounded-none print:p-0"
      >
        <DialogHeader className="flex-shrink-0 print:hidden border-b border-zinc-200 p-6 pb-4">
          <DialogTitle className="text-black">{t("title")}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto print:overflow-visible">
          <div className="grid gap-6 p-6 border-b border-zinc-200 print:hidden md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="object-label-name" className="text-black">
                  {t("objectName")}
                </Label>
                <Textarea
                  id="object-label-name"
                  value={objectName}
                  onChange={(event) => setObjectName(event.target.value)}
                  rows={2}
                  className="resize-none bg-white text-black"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="object-label-description" className="text-black">
                  {t("description")}
                </Label>
                <Textarea
                  id="object-label-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  className="resize-y bg-white text-black"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-black">{t("accessionNumber")}</Label>
                <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                  {collection.accessionNumber}
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <Label className="text-sm font-medium text-black mb-3 block">
                  {t("labelSize")}
                </Label>
                <RadioGroup
                  value={labelSize}
                  onValueChange={(value) =>
                    setLabelSize(value as ObjectTextLabelSize)
                  }
                  className="flex flex-col gap-2"
                >
                  <div className="flex items-center gap-x-2">
                    <RadioGroupItem value="small" id="object-label-small" />
                    <Label
                      htmlFor="object-label-small"
                      className="cursor-pointer text-sm text-black"
                    >
                      {t("sizeSmall")}
                    </Label>
                  </div>
                  <div className="flex items-center gap-x-2">
                    <RadioGroupItem value="medium" id="object-label-medium" />
                    <Label
                      htmlFor="object-label-medium"
                      className="cursor-pointer text-sm text-black"
                    >
                      {t("sizeMedium")}
                    </Label>
                  </div>
                  <div className="flex items-center gap-x-2">
                    <RadioGroupItem value="large" id="object-label-large" />
                    <Label
                      htmlFor="object-label-large"
                      className="cursor-pointer text-sm text-black"
                    >
                      {t("sizeLarge")}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="object-label-border" className="text-black">
                  {t("showBorder")}
                </Label>
                <Switch
                  id="object-label-border"
                  checked={showBorder}
                  onCheckedChange={setShowBorder}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="object-label-accession-size" className="text-black">
                  {t("accessionFontSize")} ({accessionFontSize}pt)
                </Label>
                <input
                  id="object-label-accession-size"
                  type="range"
                  min={ACCESSION_FONT_SIZE_MIN}
                  max={ACCESSION_FONT_SIZE_MAX}
                  step={1}
                  value={accessionFontSize}
                  onChange={(event) =>
                    setAccessionFontSize(Number(event.target.value))
                  }
                  className="w-full accent-zinc-900"
                />
              </div>
            </div>
          </div>

          <div className="p-6 flex items-center justify-center min-h-[320px] bg-zinc-50 print:bg-white print:p-0 print:min-h-0">
            <div
              ref={printRef}
              className="shadow-lg print:shadow-none print:m-0"
            >
              <ObjectTextLabelGenerator
                data={{
                  objectName: objectName.trim() || collection.title,
                  description: description.trim(),
                  accessionNumber: collection.accessionNumber,
                  accessionNumberLabel: t("accessionNumberPrefix"),
                }}
                size={labelSize}
                showBorder={showBorder}
                accessionFontSizePt={accessionFontSize}
              />
            </div>
          </div>

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
