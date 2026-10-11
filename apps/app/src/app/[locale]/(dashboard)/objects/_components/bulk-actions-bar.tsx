"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@v1/ui/tooltip";
import { useQuery } from "convex/react";
import { Archive, FolderPlus, MapPin, Printer } from "lucide-react";
import type { RefObject } from "react";
import { toast } from "sonner";
import { useOrganization } from "@/components/organization-provider";
import { PermissionGate } from "@/components/permission-gate";
import { SelectionActionBar } from "@/components/selection-action-bar";
import { useCapabilityStateMessage } from "@/hooks/use-capability-error-message";
import { useI18n, useScopedI18n } from "@/locales/client";

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onMoveLocation: () => void;
  onAddToGroup: () => void;
  onPrintLabels: () => void;
  onDeaccession: () => void;
  /** The object list, which takes focus back when the bar closes. */
  returnFocusRef: RefObject<HTMLElement | null>;
}

export function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onMoveLocation,
  onAddToGroup,
  onPrintLabels,
  onDeaccession,
  returnFocusRef,
}: BulkActionsBarProps) {
  const tRoot = useI18n();
  const t = useScopedI18n("objects.bulkActions");

  return (
    <SelectionActionBar
      label={t("label")}
      count={selectedCount}
      countLabel={t("objectsSelected", {
        count: selectedCount,
        s: selectedCount === 1 ? "" : "s",
      })}
      clearLabel={t("clearSelection")}
      onClear={onClearSelection}
      returnFocusRef={returnFocusRef}
    >
      <PermissionGate permission="collections.update">
        <Button variant="outline" size="sm" onClick={onAddToGroup}>
          <FolderPlus className="mr-2 size-4" aria-hidden="true" />
          {t("addToGroup")}
        </Button>
      </PermissionGate>

      <PermissionGate permission="locations.update">
        <Button variant="outline" size="sm" onClick={onMoveLocation}>
          <MapPin className="mr-2 size-4" aria-hidden="true" />
          {t("moveLocation")}
        </Button>
      </PermissionGate>

      <PermissionGate permission="collections.read">
        <Button variant="outline" size="sm" onClick={onPrintLabels}>
          <Printer className="mr-2 size-4" aria-hidden="true" />
          {tRoot("untranslatedRecords.objects.detail.printLabels")}
        </Button>
      </PermissionGate>

      <DeaccessionAction
        label={t("deaccession")}
        onDeaccession={onDeaccession}
      />
    </SelectionActionBar>
  );
}

/**
 * Bulk deaccession starts one proposal per object, so it follows the rule for
 * starting a deaccession, not for approving one. Members who may not start
 * one see it unavailable, with the reason.
 */
function DeaccessionAction({
  label,
  onDeaccession,
}: {
  label: string;
  onDeaccession: () => void;
}) {
  const { currentOrganizationId } = useOrganization();
  const state = useQuery(
    api.capabilities.deaccessionInitiation,
    currentOrganizationId ? { organizationId: currentOrganizationId } : "skip",
  );
  const stateMessage = useCapabilityStateMessage();
  if (!state) return null;
  const unavailableReason = stateMessage(state);

  const button = (
    <Button
      variant="outline"
      size="sm"
      className="text-red-600 hover:bg-red-50 hover:text-red-700 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent aria-disabled:hover:text-red-600"
      // Stays focusable so keyboard and screen reader users can reach the
      // reason; a click shows it on touch screens too.
      aria-disabled={unavailableReason ? true : undefined}
      onClick={() =>
        unavailableReason ? toast.info(unavailableReason) : onDeaccession()
      }
    >
      <Archive className="mr-2 size-4" aria-hidden="true" />
      {label}
    </Button>
  );
  if (!unavailableReason) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent className="max-w-xs">{unavailableReason}</TooltipContent>
    </Tooltip>
  );
}
