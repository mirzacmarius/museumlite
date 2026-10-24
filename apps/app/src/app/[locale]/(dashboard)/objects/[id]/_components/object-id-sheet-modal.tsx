"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { Dialog } from "@v1/ui/dialog";
import { useQuery } from "convex/react";
import { useMemo } from "react";
import { formatDate } from "@/lib/format-date";
import { useScopedI18n } from "@/locales/client";
import { ObjectIdSheet, type ObjectIdSheetImage } from "./object-id-sheet";
import {
  objectIdCategoryValues,
  shortDescription,
} from "./object-id-sheet-data";
import { PrintDialogShell, PrintPreviewStage } from "./print-dialog-shell";
import type { CollectionData } from "./types";

/** Recent assessments read to find the accepted one the record points to. */
const ASSESSMENTS_READ = 10;

interface ObjectIdSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: CollectionData;
  images: ObjectIdSheetImage[];
  organizationName?: string;
  locale: string;
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
  const assessments = useQuery(
    api.conditionAssessments.listForObject,
    isOpen
      ? {
          collectionId: collection._id,
          paginationOpts: { numItems: ASSESSMENTS_READ, cursor: null },
        }
      : "skip",
  );
  const accepted = assessments?.page.find(
    (assessment) =>
      assessment._id === collection.currentConditionAssessmentId &&
      assessment.status === "accepted",
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
  const values = useMemo(
    () => objectIdCategoryValues({ collection, distinguishingFeatures }),
    [collection, distinguishingFeatures],
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
              organizationName={organizationName}
              printedOn={printedOn}
              values={values}
              featuresFromAssessment={accepted !== undefined}
              description={shortDescription(collection.description)}
              images={images}
            />
          </div>
        </PrintPreviewStage>
      </PrintDialogShell>
    </Dialog>
  );
}
