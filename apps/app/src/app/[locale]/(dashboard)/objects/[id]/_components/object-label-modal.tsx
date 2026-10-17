"use client";

import { Dialog } from "@v1/ui/dialog";
import { Label } from "@v1/ui/label";
import { RadioGroup, RadioGroupItem } from "@v1/ui/radio-group";
import { Switch } from "@v1/ui/switch";
import { Textarea } from "@v1/ui/textarea";
import { useReducer, useRef } from "react";
import {
  ObjectTextLabelGenerator,
  type ObjectTextLabelSize,
} from "@/components/object-text-label-generator";
import { useScopedI18n } from "@/locales/client";
import {
  PrintDialogShell,
  PrintInstructions,
  PrintPreviewStage,
} from "./print-dialog-shell";
import type { CollectionData } from "./types";

const OBJECT_LABEL_SIZES = [
  { value: "small", key: "sizeSmall" },
  { value: "medium", key: "sizeMedium" },
  { value: "large", key: "sizeLarge" },
] as const satisfies readonly {
  value: ObjectTextLabelSize;
  key: "sizeSmall" | "sizeMedium" | "sizeLarge";
}[];

type LabelledObject = Pick<
  CollectionData,
  "_id" | "title" | "description" | "accessionNumber"
>;

interface ObjectLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: LabelledObject;
  qrCodeUrl: string;
}

const ACCESSION_FONT_SIZE_MIN = 7;
const ACCESSION_FONT_SIZE_MAX = 14;
const ACCESSION_FONT_SIZE_DEFAULT = 9;

interface ObjectLabelFormState {
  labelSize: ObjectTextLabelSize;
  showBorder: boolean;
  accessionFontSize: number;
  showQrCode: boolean;
  objectName: string;
  description: string;
}

type ObjectLabelFormAction =
  | { type: "setLabelSize"; value: ObjectTextLabelSize }
  | { type: "setShowBorder"; value: boolean }
  | { type: "setAccessionFontSize"; value: number }
  | { type: "setShowQrCode"; value: boolean }
  | { type: "setObjectName"; value: string }
  | { type: "setDescription"; value: string };

function createInitialFormState(
  collection: LabelledObject,
): ObjectLabelFormState {
  return {
    labelSize: "medium",
    showBorder: true,
    accessionFontSize: ACCESSION_FONT_SIZE_DEFAULT,
    showQrCode: false,
    objectName: collection.title,
    description: collection.description ?? "",
  };
}

function objectLabelFormReducer(
  state: ObjectLabelFormState,
  action: ObjectLabelFormAction,
): ObjectLabelFormState {
  switch (action.type) {
    case "setLabelSize":
      return { ...state, labelSize: action.value };
    case "setShowBorder":
      return { ...state, showBorder: action.value };
    case "setAccessionFontSize":
      return { ...state, accessionFontSize: action.value };
    case "setShowQrCode":
      return { ...state, showQrCode: action.value };
    case "setObjectName":
      return { ...state, objectName: action.value };
    case "setDescription":
      return { ...state, description: action.value };
  }
}

export function ObjectLabelModal({
  isOpen,
  onClose,
  collection,
  qrCodeUrl,
}: ObjectLabelModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {isOpen ? (
        <ObjectLabelModalContent
          key={collection._id}
          collection={collection}
          qrCodeUrl={qrCodeUrl}
          onClose={onClose}
        />
      ) : null}
    </Dialog>
  );
}

interface ObjectLabelModalContentProps {
  collection: LabelledObject;
  qrCodeUrl: string;
  onClose: () => void;
}

function ObjectLabelModalContent({
  collection,
  qrCodeUrl,
  onClose,
}: ObjectLabelModalContentProps) {
  const t = useScopedI18n("objects.objectLabel");
  const tCommon = useScopedI18n("common");
  const [formState, dispatch] = useReducer(
    objectLabelFormReducer,
    collection,
    createInitialFormState,
  );
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <PrintDialogShell
      title={t("title")}
      description={t("dialogDescription")}
      cancelLabel={tCommon("cancel")}
      printLabel={t("print")}
      onCancel={onClose}
      onPrint={handlePrint}
      className="max-w-5xl"
    >
      <div className="grid min-h-full md:grid-cols-[minmax(0,20rem)_1fr] print:block">
        <div className="space-y-6 border-b p-4 sm:p-6 md:border-r md:border-b-0 print:hidden">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="object-label-name">{t("objectName")}</Label>
              <Textarea
                id="object-label-name"
                value={formState.objectName}
                onChange={(event) =>
                  dispatch({ type: "setObjectName", value: event.target.value })
                }
                rows={2}
                className="resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="object-label-description">
                {t("description")}
              </Label>
              <Textarea
                id="object-label-description"
                value={formState.description}
                onChange={(event) =>
                  dispatch({
                    type: "setDescription",
                    value: event.target.value,
                  })
                }
                rows={4}
                className="resize-y"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("accessionNumber")}</Label>
              <p className="rounded-md border bg-muted px-3 py-2 font-mono text-sm text-muted-foreground">
                {collection.accessionNumber}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="block text-sm font-medium">
              {t("labelSize")}
            </Label>
            <RadioGroup
              value={formState.labelSize}
              onValueChange={(value) =>
                dispatch({
                  type: "setLabelSize",
                  value: value as ObjectTextLabelSize,
                })
              }
              className="grid gap-2"
            >
              {OBJECT_LABEL_SIZES.map(({ value, key }) => (
                <Label
                  key={value}
                  htmlFor={`object-label-${value}`}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5 text-sm font-normal transition-colors hover:bg-muted/50 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                >
                  <RadioGroupItem value={value} id={`object-label-${value}`} />
                  {t(key)}
                </Label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="object-label-border">{t("showBorder")}</Label>
              <Switch
                id="object-label-border"
                checked={formState.showBorder}
                onCheckedChange={(value) =>
                  dispatch({ type: "setShowBorder", value })
                }
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="object-label-qr-code">{t("showQrCode")}</Label>
              <Switch
                id="object-label-qr-code"
                checked={formState.showQrCode}
                onCheckedChange={(value) =>
                  dispatch({ type: "setShowQrCode", value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="object-label-accession-size">
                {t("accessionFontSize")} ({formState.accessionFontSize}pt)
              </Label>
              <input
                id="object-label-accession-size"
                type="range"
                min={ACCESSION_FONT_SIZE_MIN}
                max={ACCESSION_FONT_SIZE_MAX}
                step={1}
                value={formState.accessionFontSize}
                onChange={(event) =>
                  dispatch({
                    type: "setAccessionFontSize",
                    value: Number(event.target.value),
                  })
                }
                className="w-full accent-primary"
              />
            </div>
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

        <PrintPreviewStage className="min-h-[280px]">
          <div
            ref={printRef}
            className="max-w-full overflow-x-auto shadow-lg print:m-0 print:overflow-visible print:shadow-none"
          >
            <ObjectTextLabelGenerator
              data={{
                objectName: formState.objectName.trim() || collection.title,
                description: formState.description.trim(),
                accessionNumber: collection.accessionNumber,
              }}
              showQrCode={formState.showQrCode}
              qrCodeUrl={qrCodeUrl}
              qrCodeAlt={t("qrCodeAlt")}
              size={formState.labelSize}
              showBorder={formState.showBorder}
              accessionFontSizePt={formState.accessionFontSize}
            />
          </div>
        </PrintPreviewStage>
      </div>
    </PrintDialogShell>
  );
}
