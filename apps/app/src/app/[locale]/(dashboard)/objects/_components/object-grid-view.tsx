"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { cn } from "@v1/ui/utils";
import { useMutation, useQuery } from "convex/react";
import {
  Archive,
  ArrowRightLeft,
  Building2,
  Check,
  DollarSign,
  FileDown,
  Link2,
  MoreVertical,
  Printer,
  RotateCcw,
} from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useReducer } from "react";
import { toast } from "sonner";
import {
  DeaccessionDialog,
  type RemovalType,
} from "@/components/deaccession-dialog";
import { PermissionGate } from "@/components/permission-gate";
import { writeTextToClipboard } from "@/lib/clipboard";
import { useCurrentLocale } from "@/locales/client";

const LoadingPanel = () => (
  <div className="h-32 w-full animate-pulse rounded-xl bg-card/40" />
);

const PrintPreviewModal = dynamic(
  () =>
    import("../[id]/_components/print-preview-modal").then(
      (mod) => mod.PrintPreviewModal,
    ),
  { loading: LoadingPanel },
);

interface ObjectActionsMenuProps {
  item: {
    _id: Id<"collections">;
    title: string;
    status: string;
  };
  organizationId: Id<"organizations">;
  triggerClassName?: string;
  iconClassName?: string;
}

interface ObjectActionsMenuState {
  isDeaccessionDialogOpen: boolean;
  selectedRemovalType: RemovalType | null;
  isPrintModalOpen: boolean;
  shouldPrintWhenReady: boolean;
  linkCopied: boolean;
}

type ObjectActionsMenuAction =
  | { type: "setDeaccessionDialogOpen"; value: boolean }
  | { type: "openRemovalFlow"; removalType: RemovalType }
  | { type: "closeRemovalFlow" }
  | { type: "openPrintPreview" }
  | { type: "openExportToPdf" }
  | { type: "closePrintModal" }
  | { type: "clearPrintWhenReady" }
  | { type: "setLinkCopied"; value: boolean };

const initialObjectActionsMenuState: ObjectActionsMenuState = {
  isDeaccessionDialogOpen: false,
  selectedRemovalType: null,
  isPrintModalOpen: false,
  shouldPrintWhenReady: false,
  linkCopied: false,
};

function objectActionsMenuReducer(
  state: ObjectActionsMenuState,
  action: ObjectActionsMenuAction,
): ObjectActionsMenuState {
  switch (action.type) {
    case "setDeaccessionDialogOpen":
      return { ...state, isDeaccessionDialogOpen: action.value };
    case "openRemovalFlow":
      return {
        ...state,
        selectedRemovalType: action.removalType,
        isDeaccessionDialogOpen: true,
      };
    case "closeRemovalFlow":
      return {
        ...state,
        isDeaccessionDialogOpen: false,
        selectedRemovalType: null,
      };
    case "openPrintPreview":
      return {
        ...state,
        shouldPrintWhenReady: false,
        isPrintModalOpen: true,
      };
    case "openExportToPdf":
      return {
        ...state,
        shouldPrintWhenReady: true,
        isPrintModalOpen: true,
      };
    case "closePrintModal":
      return {
        ...state,
        isPrintModalOpen: false,
        shouldPrintWhenReady: false,
      };
    case "clearPrintWhenReady":
      return { ...state, shouldPrintWhenReady: false };
    case "setLinkCopied":
      return { ...state, linkCopied: action.value };
  }
}

export function ObjectActionsMenu({
  item,
  organizationId,
  triggerClassName,
  iconClassName,
}: ObjectActionsMenuProps) {
  const [state, dispatch] = useReducer(
    objectActionsMenuReducer,
    initialObjectActionsMenuState,
  );
  const locale = useCurrentLocale();
  const canDeaccession =
    item.status !== "deaccessioned" &&
    item.status !== "archived" &&
    item.status !== "deleted";
  const restoreCollection = useMutation(api.collections.restoreCollection);
  const objectDetail = useQuery(
    api.collections.getObjectDetail,
    state.isPrintModalOpen ? { collectionId: item._id } : "skip",
  );
  const heroImageForPrint = objectDetail?.heroImage?.url
    ? {
        url: objectDetail.heroImage.url,
        thumbnailUrl: objectDetail.heroImage.thumbnailUrl,
      }
    : null;

  const handleCopyLink = async () => {
    const objectUrl = new URL(
      `/${locale}/objects/${item._id}`,
      window.location.origin,
    ).toString();
    const didCopy = await writeTextToClipboard(objectUrl);
    if (!didCopy) {
      return;
    }

    dispatch({ type: "setLinkCopied", value: true });
    setTimeout(() => dispatch({ type: "setLinkCopied", value: false }), 2000);
  };

  const handleOpenPrintPreview = () => {
    dispatch({ type: "openPrintPreview" });
  };

  const handleExportToPdf = () => {
    dispatch({ type: "openExportToPdf" });
  };

  const handleRestore = async () => {
    try {
      await restoreCollection({ collectionId: item._id });
      toast.success("Object restored to the routine catalog.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to restore object.",
      );
    }
  };

  const handleOpenRemovalFlow = (removalType: RemovalType) => {
    dispatch({ type: "openRemovalFlow", removalType });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "size-6 rounded-full border border-border bg-background/80 text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              triggerClassName,
            )}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <MoreVertical className={cn("size-3", iconClassName)} />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onClick={(event) => event.stopPropagation()}
          className="w-44 border-border bg-popover text-popover-foreground"
        >
          <DropdownMenuItem
            className="cursor-pointer focus:bg-accent focus:text-accent-foreground"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleCopyLink();
            }}
          >
            {state.linkCopied ? (
              <Check className="mr-2 size-4 text-green-500" />
            ) : (
              <Link2 className="mr-2 size-4" />
            )}
            {state.linkCopied ? "Link copied" : "Copy Link"}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer focus:bg-accent focus:text-accent-foreground"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleOpenPrintPreview();
            }}
          >
            <Printer className="mr-2 size-4" />
            Print
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer focus:bg-accent focus:text-accent-foreground"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleExportToPdf();
            }}
          >
            <FileDown className="mr-2 size-4" />
            Export to PDF
          </DropdownMenuItem>
          {canDeaccession && (
            <>
              <DropdownMenuSeparator />
              <PermissionGate permission="collections.update">
                <DropdownMenuItem
                  className="cursor-pointer focus:bg-accent focus:text-accent-foreground"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleOpenRemovalFlow("sold");
                  }}
                >
                  <DollarSign className="mr-2 size-4 text-green-500" />
                  Sold
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer focus:bg-accent focus:text-accent-foreground"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleOpenRemovalFlow("move");
                  }}
                >
                  <ArrowRightLeft className="mr-2 size-4 text-blue-500" />
                  Transfer
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer focus:bg-accent focus:text-accent-foreground"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleOpenRemovalFlow("archived");
                  }}
                >
                  <Archive className="mr-2 size-4 text-amber-500" />
                  Archive
                </DropdownMenuItem>
              </PermissionGate>
            </>
          )}
          {(item.status === "archived" || item.status === "deleted") && (
            <PermissionGate permission="collections.update">
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer focus:bg-accent focus:text-accent-foreground"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void handleRestore();
                }}
              >
                <RotateCcw className="mr-2 size-4" />
                Restore to catalog
              </DropdownMenuItem>
            </PermissionGate>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DeaccessionDialog
        open={state.isDeaccessionDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            dispatch({ type: "setDeaccessionDialogOpen", value: true });
            return;
          }
          dispatch({ type: "closeRemovalFlow" });
        }}
        collectionId={item._id}
        collectionTitle={item.title}
        organizationId={organizationId}
        initialRemovalType={state.selectedRemovalType}
      />
      {objectDetail?.collection ? (
        <PrintPreviewModal
          isOpen={state.isPrintModalOpen}
          onClose={() => dispatch({ type: "closePrintModal" })}
          collection={objectDetail.collection}
          heroImage={heroImageForPrint}
          locationPath={objectDetail.locationPath}
          locale={locale}
          printOnOpen={state.shouldPrintWhenReady}
          onPrintOnOpenComplete={() =>
            dispatch({ type: "clearPrintWhenReady" })
          }
        />
      ) : null}
    </>
  );
}

interface ObjectGridItemProps {
  item: {
    _id: Id<"collections">;
    accessionNumber: string;
    title: string;
    objectType?: string;
    primaryImageUrl?: string;
    status: string;
  };
  organizationId: Id<"organizations">;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
  shouldEagerLoad?: boolean;
}

function ObjectGridItem({
  item,
  organizationId,
  isSelected = false,
  onSelect,
  shouldEagerLoad = false,
}: ObjectGridItemProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
      case "verified":
        return (
          <span className="rounded bg-status-success/80 px-1.5 py-0.5 text-[9px] font-medium text-background capitalize shadow-sm">
            {status}
          </span>
        );
      case "loaned":
        return (
          <span className="rounded bg-status-info/80 px-1.5 py-0.5 text-[9px] font-medium text-background capitalize shadow-sm">
            {status}
          </span>
        );
      case "deaccessioned":
        return (
          <span className="rounded bg-status-error/80 px-1.5 py-0.5 text-[9px] font-medium text-background capitalize shadow-sm">
            {status}
          </span>
        );
      default:
        return (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground capitalize shadow-sm">
            {status}
          </span>
        );
    }
  };

  return (
    <div
      className={`group relative overflow-hidden rounded-lg border border-border bg-card transition-all duration-300 hover:border-ring/50 hover:shadow-xl ${
        isSelected ? "border-primary ring-1 ring-primary" : ""
      }`}
    >
      {onSelect && (
        <div
          className={`absolute top-2 left-2 z-20 transition-opacity ${
            isSelected
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
          }`}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelect(!!checked)}
            onClick={(e) => e.stopPropagation()}
            className="border-input bg-background/80"
          />
        </div>
      )}
      <Link href={`/objects/${item._id}`} className="block">
        <div className="relative aspect-square overflow-hidden bg-background">
          {item.primaryImageUrl ? (
            <Image
              src={item.primaryImageUrl}
              alt={item.title}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
              loading={shouldEagerLoad ? "eager" : "lazy"}
              className="object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground/50 transition-colors group-hover:text-muted-foreground">
              <Building2 className="size-12" />
            </div>
          )}

          {/* Status Badge Top Right */}
          <div className="absolute top-2 right-2 z-10">
            {getStatusBadge(item.status)}
          </div>
        </div>
        <div className="p-3">
          <h3 className="truncate text-xs font-medium text-card-foreground">
            {item.title}
          </h3>
          <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
            <p className="shrink-0 font-mono text-[10px] text-muted-foreground">
              {item.accessionNumber}
            </p>
            {item.objectType && (
              <div className="flex min-w-0 justify-end gap-1 overflow-hidden">
                {(() => {
                  try {
                    const types = JSON.parse(item.objectType);
                    if (Array.isArray(types) && types.length > 0) {
                      return types.slice(0, 2).map((type: string) => (
                        <span
                          key={type}
                          title={type}
                          className="block min-w-0 max-w-full truncate rounded border border-border bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground"
                        >
                          {type}
                        </span>
                      ));
                    }
                    return (
                      <span
                        title={item.objectType}
                        className="block min-w-0 max-w-full truncate rounded border border-border bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground"
                      >
                        {item.objectType}
                      </span>
                    );
                  } catch {
                    return (
                      <span
                        title={item.objectType}
                        className="block min-w-0 max-w-full truncate rounded border border-border bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground"
                      >
                        {item.objectType}
                      </span>
                    );
                  }
                })()}
              </div>
            )}
          </div>
        </div>
      </Link>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 aspect-square">
        <div className="pointer-events-auto absolute bottom-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 has-[[data-state=open]]:opacity-100 [@media(hover:none)]:opacity-100">
          <ObjectActionsMenu item={item} organizationId={organizationId} />
        </div>
      </div>
    </div>
  );
}

export interface ObjectGridViewProps {
  items: Array<{
    _id: Id<"collections">;
    accessionNumber: string;
    title: string;
    objectType?: string;
    primaryImageUrl?: string;
    status: string;
  }>;
  organizationId: Id<"organizations">;
  selectedIds?: Set<Id<"collections">>;
  onSelectItem?: (id: Id<"collections">, selected: boolean) => void;
}

export function ObjectGridView({
  items,
  organizationId,
  selectedIds,
  onSelectItem,
}: ObjectGridViewProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {items.map((item, index) => (
        <div key={item._id}>
          <ObjectGridItem
            item={item}
            organizationId={organizationId}
            isSelected={selectedIds?.has(item._id)}
            onSelect={
              onSelectItem
                ? (selected) => onSelectItem(item._id, selected)
                : undefined
            }
            shouldEagerLoad={index < 4}
          />
        </div>
      ))}
    </div>
  );
}
