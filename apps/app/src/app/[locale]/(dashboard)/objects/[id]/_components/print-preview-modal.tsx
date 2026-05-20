"use client";

import { ClientCurrentDate } from "@/components/client-date";
import { formatStringListField } from "@/lib/string-list-field";
import { useScopedI18n } from "@/locales/client";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { cn } from "@v1/ui/utils";
import { Printer } from "lucide-react";
import { useEffect, useRef } from "react";
import { formatOwnershipDateRange } from "./format-ownership-date-range";
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
  const materials = formatStringListField(collection.materials);
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
          <div className="space-y-5 bg-white text-black p-6 print:p-[15mm] print:space-y-4 print:break-inside-avoid-page">
            {/* Header */}
            <div className="flex items-start gap-4 border-b border-zinc-200 pb-4 print:gap-3 print:pb-3">
              {heroImage?.url && (
                <img
                  src={heroImage.thumbnailUrl || heroImage.url}
                  alt={collection.title}
                  className="size-28 flex-shrink-0 rounded border border-zinc-300 object-cover print:size-20"
                />
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-black print:text-lg">
                  {collection.title}
                </h1>
                {collection.alternativeTitle && (
                  <p className="text-sm text-zinc-600 italic print:text-xs">
                    {collection.alternativeTitle}
                  </p>
                )}
                <p className="mt-1 font-mono text-xs text-zinc-600">
                  {collection.accessionNumber}
                </p>
                {collection.alternateAccessionNumbers &&
                  collection.alternateAccessionNumbers.length > 0 && (
                    <p className="text-[10px] text-zinc-500">
                      Alt: {collection.alternateAccessionNumbers.join(", ")}
                    </p>
                  )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {collection.displayStatus && (
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700">
                      {collection.displayStatus}
                    </span>
                  )}
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-medium",
                      collection.status === "active"
                        ? "bg-green-100 text-green-700"
                        : collection.status === "loaned"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-red-100 text-red-700",
                    )}
                  >
                    {collection.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Basic Information */}
            <div className="print:break-inside-avoid">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500 print:text-[10px]">
                {t("basicInformation")}
              </h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm print:text-xs print:gap-x-4 print:gap-y-1">
                {collection.objectType && (
                  <div>
                    <p className="text-xs font-medium text-zinc-500">
                      {t("objectType")}
                    </p>
                    <p className="text-black">{collection.objectType}</p>
                  </div>
                )}
                {collection.objectName && (
                  <div>
                    <p className="text-xs font-medium text-zinc-500">
                      {t("objectName")}
                    </p>
                    <p className="text-black">{collection.objectName}</p>
                  </div>
                )}
                {collection.creator && (
                  <div>
                    <p className="text-xs font-medium text-zinc-500">
                      {t("creatorArtist")}
                    </p>
                    <p className="text-black">{collection.creator}</p>
                  </div>
                )}
                {collection.dateCreated && (
                  <div>
                    <p className="text-xs font-medium text-zinc-500">
                      {t("dateCreated")}
                    </p>
                    <p className="text-black">{collection.dateCreated}</p>
                  </div>
                )}
                {collection.culture && (
                  <div>
                    <p className="text-xs font-medium text-zinc-500">
                      {t("culture")}
                    </p>
                    <p className="text-black">{collection.culture}</p>
                  </div>
                )}
                {collection.period && (
                  <div>
                    <p className="text-xs font-medium text-zinc-500">
                      {t("period")}
                    </p>
                    <p className="text-black">{collection.period}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Physical Description */}
            <div className="print:break-inside-avoid">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500 print:text-[10px]">
                {t("physicalDescription")}
              </h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm print:text-xs print:gap-x-4 print:gap-y-1">
                {materials && (
                  <div>
                    <p className="text-xs font-medium text-zinc-500">
                      {t("materials")}
                    </p>
                    <p className="text-black">{materials}</p>
                  </div>
                )}
                {collection.technique && (
                  <div>
                    <p className="text-xs font-medium text-zinc-500">
                      {t("technique")}
                    </p>
                    <p className="text-black">{collection.technique}</p>
                  </div>
                )}
                {collection.dimensions && (
                  <div>
                    <p className="text-xs font-medium text-zinc-500">
                      {t("dimensions")}
                    </p>
                    <p className="text-black">{collection.dimensions}</p>
                  </div>
                )}
                {collection.dimensionDiameter && (
                  <div>
                    <p className="text-xs font-medium text-zinc-500">
                      {t("diameter")}
                    </p>
                    <p className="text-black">{collection.dimensionDiameter}</p>
                  </div>
                )}
                {(collection.dimensionHeight ||
                  collection.dimensionWidth ||
                  collection.dimensionDepth) && (
                  <div>
                    <p className="text-xs font-medium text-zinc-500">
                      {t("detailedDimensions")}
                    </p>
                    <p className="text-black">
                      {[
                        collection.dimensionHeight &&
                          `H: ${collection.dimensionHeight}`,
                        collection.dimensionWidth &&
                          `W: ${collection.dimensionWidth}`,
                        collection.dimensionDepth &&
                          `D: ${collection.dimensionDepth}`,
                      ]
                        .filter(Boolean)
                        .join(" × ")}{" "}
                      {collection.dimensionUnit || "cm"}
                    </p>
                  </div>
                )}
                {collection.dimensionWeight !== undefined && (
                  <div>
                    <p className="text-xs font-medium text-zinc-500">
                      {t("weight")}
                    </p>
                    <p className="text-black">
                      {collection.dimensionWeight}{" "}
                      {collection.weightUnit || "kg"}
                    </p>
                  </div>
                )}
                {collection.condition && (
                  <div className="col-span-2">
                    <p className="text-xs font-medium text-zinc-500">
                      {t("condition")}
                    </p>
                    <p className="text-black">{collection.condition}</p>
                  </div>
                )}
                {collection.inscriptions && (
                  <div className="col-span-2">
                    <p className="text-xs font-medium text-zinc-500">
                      {t("inscriptions")}
                    </p>
                    <p className="text-black whitespace-pre-wrap">
                      {collection.inscriptions}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            {collection.description && (
              <div>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500 print:text-[10px]">
                  {t("description")}
                </h2>
                <p className="text-sm text-black whitespace-pre-wrap print:text-xs">
                  {collection.description}
                </p>
              </div>
            )}

            {/* Provenance & Acquisition */}
            {(collection.provenance ||
              collection.creditLine ||
              collection.acquisitionMethod ||
              collection.donated_by) && (
              <div>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500 print:text-[10px]">
                  {t("provenanceAndAcquisition")}
                </h2>
                <div className="space-y-2 text-sm print:text-xs print:space-y-1">
                  {collection.creditLine && (
                    <div>
                      <p className="text-xs font-medium text-zinc-500">
                        {t("creditLine")}
                      </p>
                      <p className="text-black">{collection.creditLine}</p>
                    </div>
                  )}
                  {collection.acquisitionMethod && (
                    <div>
                      <p className="text-xs font-medium text-zinc-500">
                        {t("acquisitionMethod")}
                      </p>
                      <p className="text-black">
                        {collection.acquisitionMethod}
                      </p>
                    </div>
                  )}
                  {collection.donated_by &&
                    collection.donated_by.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-zinc-500">
                          {t("donatedBy")}
                        </p>
                        <p className="text-black">
                          {collection.donated_by.join(", ")}
                        </p>
                      </div>
                    )}
                  {collection.donated_date && (
                    <div>
                      <p className="text-xs font-medium text-zinc-500">
                        {t("donationDate")}
                      </p>
                      <p className="text-black">{collection.donated_date}</p>
                    </div>
                  )}
                  {collection.provenance && (
                    <div>
                      <p className="text-xs font-medium text-zinc-500">
                        {t("provenance")}
                      </p>
                      <p className="text-black whitespace-pre-wrap">
                        {collection.provenance}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Ownership History */}
            {collection.ownershipHistory &&
              collection.ownershipHistory.length > 0 && (
                <div>
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500 print:text-[10px]">
                    {t("ownershipHistory")}
                  </h2>
                  <div className="space-y-2">
                    {collection.ownershipHistory.map((entry) => (
                      <div
                        key={`${entry.owner}-${entry.startYear || "unknown"}`}
                        className="rounded border border-zinc-200 p-2 text-sm"
                      >
                        <p className="font-medium text-black">{entry.owner}</p>
                        {formatOwnershipDateRange(entry, {
                          presentLabel: t("present"),
                          separator: " – ",
                        }) ? (
                          <p className="text-xs text-zinc-500">
                            {formatOwnershipDateRange(entry, {
                              presentLabel: t("present"),
                              separator: " – ",
                            })}
                          </p>
                        ) : null}
                        {entry.description && (
                          <p className="mt-1 text-zinc-600">
                            {entry.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Exhibition History */}
            {collection.exhibitionHistory && (
              <div>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500 print:text-[10px]">
                  {t("exhibitionHistory")}
                </h2>
                <p className="text-sm text-black whitespace-pre-wrap print:text-xs">
                  {collection.exhibitionHistory}
                </p>
              </div>
            )}

            {/* Location */}
            {locationPath && locationPath.length > 0 && (
              <div>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500 print:text-[10px]">
                  {t("currentLocation")}
                </h2>
                <p className="text-sm text-black print:text-xs">
                  {locationPath.map((loc) => loc.name).join(" > ")}
                </p>
              </div>
            )}

            {/* Tags */}
            {collection.tags && collection.tags.length > 0 && (
              <div>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500 print:text-[10px]">
                  {t("tags")}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {collection.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Legal & Visibility */}
            <div>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500 print:text-[10px]">
                {t("legalAndVisibility")}
              </h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm print:text-xs print:gap-x-4 print:gap-y-1">
                <div>
                  <p className="text-xs font-medium text-zinc-500 print:text-[10px]">
                    {t("publicVisibility")}
                  </p>
                  <p className="text-black">
                    {collection.isPubliclyVisible ? t("yes") : t("no")}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 print:text-[10px]">
                    {t("legalRestrictions")}
                  </p>
                  <p className="text-black">
                    {collection.legalRestrictions ? t("yes") : t("none")}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer with print date */}
            <div className="border-t border-zinc-200 pt-3 text-[10px] text-zinc-400 print:pt-2 print:text-[9px]">
              <p>
                {t("printedOn")}{" "}
                <ClientCurrentDate
                  locale={locale}
                  options={{ year: "numeric", month: "long", day: "numeric" }}
                />
              </p>
            </div>
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
