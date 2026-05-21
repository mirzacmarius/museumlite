"use client";

import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Printer } from "lucide-react";
import { useEffect, useRef } from "react";
import { useScopedI18n } from "@/locales/client";
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
      <DialogContent
        aria-describedby={undefined}
        className="flex flex-col max-w-[210mm] w-full h-[90vh] bg-white text-black p-0 print:max-w-none print:max-h-none print:h-auto print:w-full print:overflow-visible print:shadow-none print:border-none print:rounded-none print:p-0"
      >
        <DialogHeader className="flex-shrink-0 print:hidden border-b border-zinc-200 p-6 pb-4">
          <DialogTitle className="text-black">{t("title")}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <PrintPreviewDocument
            collection={collection}
            heroImage={heroImage}
            locationPath={locationPath}
            locale={locale}
          />
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
            onClick={() => window.print()}
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
