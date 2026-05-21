"use client";

import { ClientCurrentDate } from "@/components/client-date";
import { useScopedI18n } from "@/locales/client";
import { formatOwnershipDateRange } from "./format-ownership-date-range";
import type { CollectionData, LocationPathItem } from "./types";

interface PrintPreviewExtendedSectionsProps {
  collection: CollectionData;
  locationPath: LocationPathItem[] | undefined;
  locale: string;
}

export function PrintPreviewExtendedSections({
  collection,
  locationPath,
  locale,
}: PrintPreviewExtendedSectionsProps) {
  const t = useScopedI18n("objects.printPreview");

  return (
    <div className="contents">
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
                <p className="text-black">{collection.acquisitionMethod}</p>
              </div>
            )}
            {collection.donated_by && collection.donated_by.length > 0 && (
              <div>
                <p className="text-xs font-medium text-zinc-500">
                  {t("donatedBy")}
                </p>
                <p className="text-black">{collection.donated_by.join(", ")}</p>
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
                    <p className="mt-1 text-zinc-600">{entry.description}</p>
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
  );
}
