"use client";

import { useScopedI18n } from "@/locales/client";
import { Badge } from "@v1/ui/badge";
import { CatalogItemDetailCopiesSection } from "./catalog-item-detail-copies-section";
import { CatalogItemDetailSidebar } from "./catalog-item-detail-sidebar";
import type { CatalogItemDetailViewProps } from "./catalog-item-detail-view-props";

export function CatalogItemDetailBody({
  item,
  copies,
  getConditionLabel,
  handleDeleteCopy,
  setIsAddCopyOpen,
}: Pick<
  CatalogItemDetailViewProps,
  | "item"
  | "copies"
  | "getConditionLabel"
  | "handleDeleteCopy"
  | "setIsAddCopyOpen"
>) {
  const tDetail = useScopedI18n("library.catalog.detail");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border p-6">
            <h2 className="text-lg font-medium">{tDetail("details")}</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 p-6">
            <div>
              <p className="text-sm text-muted-foreground">{tDetail("type")}</p>
              <p className="font-medium capitalize">{item.itemType}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {tDetail("language")}
              </p>
              <p className="font-medium">{item.language}</p>
            </div>
            {item.authors.length > 0 ? (
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground">
                  {tDetail("authors")}
                </p>
                <p className="font-medium">{item.authors.join(", ")}</p>
              </div>
            ) : null}
            {item.publisher ? (
              <div>
                <p className="text-sm text-muted-foreground">
                  {tDetail("publisher")}
                </p>
                <p className="font-medium">{item.publisher}</p>
              </div>
            ) : null}
            {item.publicationYear ? (
              <div>
                <p className="text-sm text-muted-foreground">
                  {tDetail("year")}
                </p>
                <p className="font-medium">{item.publicationYear}</p>
              </div>
            ) : null}
            {item.isbn ? (
              <div>
                <p className="text-sm text-muted-foreground">ISBN-10</p>
                <p className="font-medium font-mono">{item.isbn}</p>
              </div>
            ) : null}
            {item.isbn13 ? (
              <div>
                <p className="text-sm text-muted-foreground">ISBN-13</p>
                <p className="font-medium font-mono">{item.isbn13}</p>
              </div>
            ) : null}
            {item.callNumber ? (
              <div>
                <p className="text-sm text-muted-foreground">
                  {tDetail("callNumber")}
                </p>
                <p className="font-medium font-mono">{item.callNumber}</p>
              </div>
            ) : null}
            {item.pages ? (
              <div>
                <p className="text-sm text-muted-foreground">
                  {tDetail("pages")}
                </p>
                <p className="font-medium">{item.pages}</p>
              </div>
            ) : null}
            {item.edition ? (
              <div>
                <p className="text-sm text-muted-foreground">
                  {tDetail("edition")}
                </p>
                <p className="font-medium">{item.edition}</p>
              </div>
            ) : null}
            {item.series ? (
              <div>
                <p className="text-sm text-muted-foreground">
                  {tDetail("series")}
                </p>
                <p className="font-medium">
                  {item.series}
                  {item.seriesNumber ? ` #${item.seriesNumber}` : null}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {item.description ? (
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border p-6">
              <h2 className="text-lg font-medium">{tDetail("description")}</h2>
            </div>
            <div className="p-6">
              <p className="whitespace-pre-wrap text-sm">{item.description}</p>
            </div>
          </div>
        ) : null}

        {(item.subjects?.length ?? 0) > 0 ? (
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border p-6">
              <h2 className="text-lg font-medium">{tDetail("subjects")}</h2>
            </div>
            <div className="flex flex-wrap gap-2 p-6">
              {item.subjects?.map((subject) => (
                <Badge key={subject} variant="secondary">
                  {subject}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        <CatalogItemDetailCopiesSection
          item={item}
          copies={copies}
          getConditionLabel={getConditionLabel}
          handleDeleteCopy={handleDeleteCopy}
          setIsAddCopyOpen={setIsAddCopyOpen}
        />
      </div>

      <CatalogItemDetailSidebar item={item} />
    </div>
  );
}
