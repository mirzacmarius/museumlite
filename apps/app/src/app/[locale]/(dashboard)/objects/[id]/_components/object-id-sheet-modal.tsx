"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { Dialog } from "@v1/ui/dialog";
import { useQuery } from "convex/react";
import { useMemo } from "react";
import { useObjectDescriptionFormat } from "@/components/object-description/use-object-description-format";
import { useProductionDateFormat } from "@/components/production-date/use-production-date-format";
import { formatDate } from "@/lib/format-date";
import { type FormatLocale, formatNumber } from "@/lib/format-number";
import { useScopedI18n } from "@/locales/client";
import { ObjectIdSheet, type ObjectIdSheetImage } from "./object-id-sheet";
import {
  objectIdCategoryValues,
  shortDescription,
} from "./object-id-sheet-data";
import { PrintDialogShell, PrintPreviewStage } from "./print-dialog-shell";
import type { CollectionData } from "./types";

interface ObjectIdSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: CollectionData;
  images: ObjectIdSheetImage[];
  organizationName?: string;
  locale: FormatLocale;
}

export function ObjectIdSheetModal({
  isOpen,
  onClose,
  collection,
  images,
  organizationName,
  locale,
}: ObjectIdSheetModalProps) {
  const t = useScopedI18n("objects.objectIdSheet");
  const tCommon = useScopedI18n("common");
  const { dateMade } = useProductionDateFormat();
  const { part } = useObjectDescriptionFormat().measurements;
  // Read by the record's pointer, so later drafts never hide the accepted one.
  const accepted = useQuery(
    api.conditionAssessments.getCurrentAccepted,
    isOpen ? { collectionId: collection._id } : "skip",
  );
  const distinguishingFeatures = useMemo(
    () =>
      accepted
        ? [
            accepted.summary,
            ...accepted.observations.map(
              (observation) =>
                `${observation.area}: ${observation.description}`,
            ),
          ]
        : [],
    [accepted],
  );
  const format = useMemo(
    () => ({
      measurementLabels: {
        height: t("measurement.height"),
        width: t("measurement.width"),
        depth: t("measurement.depth"),
      },
      number: (value: number) => formatNumber(value, locale),
      part,
      dateMade,
    }),
    [t, locale, part, dateMade],
  );
  const values = useMemo(
    () =>
      objectIdCategoryValues({ collection, distinguishingFeatures, format }),
    [collection, distinguishingFeatures, format],
  );
  const printedOn = useMemo(
    () => (isOpen ? formatDate(new Date(), locale, { dateStyle: "long" }) : ""),
    [isOpen, locale],
  );

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
            <ObjectIdSheet
              title={collection.title}
              accessionNumber={collection.accessionNumber}
              numberOfObjects={
                collection.numberOfObjects === undefined
                  ? undefined
                  : formatNumber(collection.numberOfObjects, locale)
              }
              organizationName={organizationName}
              printedOn={printedOn}
              values={values}
              featuresFromAssessment={!!accepted}
              description={shortDescription(collection.description)}
              images={images}
            />
          </div>
        </PrintPreviewStage>
      </PrintDialogShell>
    </Dialog>
  );
}
