"use client";

import { Dialog } from "@v1/ui/dialog";
import { useEffect, useRef } from "react";
import { useScopedI18n } from "@/locales/client";
import { PrintDialogShell, PrintPreviewStage } from "./print-dialog-shell";
import { PrintPreviewDocument } from "./print-preview-document";
import type { CollectionData, HeroImageData, LocationPathItem } from "./types";

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: CollectionData;
  heroImage: HeroImageData | null;
  locationPath: LocationPathItem[] | undefined;
  locale: string;
  printOnOpen?: boolean;
  onPrintOnOpenComplete?: () => void;
}

export function PrintPreviewModal({
  isOpen,
  onClose,
  collection,
  heroImage,
  locationPath,
  locale,
  printOnOpen = false,
  onPrintOnOpenComplete,
}: PrintPreviewModalProps) {
  const t = useScopedI18n("objects.printPreview");
  const tCommon = useScopedI18n("common");
  const hasPrintedOnOpenRef = useRef(false);

  useEffect(() => {
    if (!printOnOpen) {
      hasPrintedOnOpenRef.current = false;
      return;
    }

    if (!isOpen || hasPrintedOnOpenRef.current) {
      return;
    }

    hasPrintedOnOpenRef.current = true;
    const printTimeout = window.setTimeout(() => {
      window.print();
      onPrintOnOpenComplete?.();
    }, 100);

    return () => window.clearTimeout(printTimeout);
  }, [isOpen, onPrintOnOpenComplete, printOnOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <PrintDialogShell
        title={t("title")}
        description={t("dialogDescription")}
        cancelLabel={tCommon("cancel")}
        printLabel={t("print")}
        onCancel={onClose}
        onPrint={() => window.print()}
        className="max-w-4xl"
      >
        <PrintPreviewStage className="items-start">
          <div className="w-full max-w-[210mm] overflow-hidden rounded-sm shadow-lg print:max-w-none print:rounded-none print:shadow-none">
            <PrintPreviewDocument
              collection={collection}
              heroImage={heroImage}
              locationPath={locationPath}
              locale={locale}
            />
          </div>
        </PrintPreviewStage>
      </PrintDialogShell>
    </Dialog>
  );
}
