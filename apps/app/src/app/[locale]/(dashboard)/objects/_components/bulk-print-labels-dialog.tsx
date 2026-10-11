"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import type { RefObject } from "react";
import {
  LabelSheetDialog,
  recordLabelUrl,
} from "@/components/label-sheet-dialog";
import { useOrganization } from "@/components/organization-provider";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

interface BulkPrintLabelsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: Id<"collections">[];
  onSuccess: () => void;
  /** Takes focus on close when the selection bar that opened it is gone. */
  fallbackFocusRef: RefObject<HTMLElement | null>;
}

export function BulkPrintLabelsDialog({
  open,
  onOpenChange,
  selectedIds,
  onSuccess,
  fallbackFocusRef,
}: BulkPrintLabelsDialogProps) {
  const t = useScopedI18n("objects.bulkDialogs.printLabels");
  const locale = useCurrentLocale();
  const { currentOrganizationId } = useOrganization();

  // Fetch all collections in a single batch query
  const collections = useQuery(
    api.collections.getBatch,
    currentOrganizationId && selectedIds.length > 0
      ? {
          organizationId: currentOrganizationId,
          collectionIds: selectedIds,
        }
      : "skip",
  );

  return (
    <LabelSheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description", { count: selectedIds.length })}
      labels={collections?.map((collection) => ({
        accessionNumber: collection.accessionNumber,
        title: collection.title,
        qrCodeUrl: recordLabelUrl(locale, "objects", collection._id),
      }))}
      onPrinted={onSuccess}
      fallbackFocusRef={fallbackFocusRef}
      idPrefix="bulk"
    />
  );
}
