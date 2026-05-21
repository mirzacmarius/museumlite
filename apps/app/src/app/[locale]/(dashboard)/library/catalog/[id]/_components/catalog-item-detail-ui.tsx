"use client";

import { useScopedI18n } from "@/locales/client";
import { Badge } from "@v1/ui/badge";
import type { CatalogItemDetailItem } from "./catalog-item-detail-view-props";

export function CatalogItemStatusBadge({
  catalogStatus,
}: {
  catalogStatus: CatalogItemDetailItem["catalogStatus"];
}) {
  const tDetail = useScopedI18n("library.catalog.detail");

  switch (catalogStatus) {
    case "draft":
      return (
        <Badge variant="secondary">{tDetail("catalogStatus.draft")}</Badge>
      );
    case "published":
      return (
        <Badge variant="default" className="bg-green-500">
          {tDetail("catalogStatus.published")}
        </Badge>
      );
    case "archived":
      return (
        <Badge variant="outline">{tDetail("catalogStatus.archived")}</Badge>
      );
    default:
      return null;
  }
}

export function CatalogItemCopyStatusBadge({ status }: { status: string }) {
  const tDetail = useScopedI18n("library.catalog.detail");

  switch (status) {
    case "available":
      return (
        <Badge variant="default" className="bg-green-500">
          {tDetail("copyStatus.available")}
        </Badge>
      );
    case "checked_out":
      return (
        <Badge variant="secondary">{tDetail("copyStatus.checkedOut")}</Badge>
      );
    case "on_hold":
      return (
        <Badge variant="default" className="bg-blue-500">
          {tDetail("copyStatus.onHold")}
        </Badge>
      );
    case "lost":
      return <Badge variant="destructive">{tDetail("copyStatus.lost")}</Badge>;
    case "damaged":
      return (
        <Badge variant="default" className="bg-orange-500">
          {tDetail("copyStatus.damaged")}
        </Badge>
      );
    case "withdrawn":
      return <Badge variant="outline">{tDetail("copyStatus.withdrawn")}</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}
