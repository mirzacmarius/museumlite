"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Link2,
  Pencil,
  Printer,
  QrCode,
  Tags,
} from "lucide-react";
import Link from "next/link";
import { PermissionGate } from "@/components/permission-gate";
import { useBackToResultsLink } from "@/components/record-recovery-state";
import { writeTextToClipboard } from "@/lib/clipboard";
import { ObjectDeaccessionAction } from "../../../_components/object-deaccession-action";
import type { ObjectDetailData } from "../types";

interface ObjectDetailHeaderProps {
  collection: NonNullable<ObjectDetailData["collection"]>;
  collectionGroupName?: string;
  collectionId: Id<"collections">;
  editTab?: string;
  linkCopied: boolean;
  onLinkCopiedChange: (copied: boolean) => void;
  onPrintClick: () => void;
  onObjectLabelClick: () => void;
  onQrLabelClick: () => void;
  collectionsLabel: string;
  copyLinkLabel: string;
  linkCopiedLabel: string;
  printRecordLabel: string;
  printLabel: string;
  printObjectLabel: string;
  printMenuLabel: string;
  editObjectLabel: string;
}

const iconButtonClass = "size-8 text-muted-foreground hover:text-foreground";

export function ObjectDetailHeader({
  collection,
  collectionGroupName,
  collectionId,
  editTab,
  linkCopied,
  onLinkCopiedChange,
  onPrintClick,
  onObjectLabelClick,
  onQrLabelClick,
  collectionsLabel,
  copyLinkLabel,
  linkCopiedLabel,
  printRecordLabel,
  printLabel,
  printObjectLabel,
  printMenuLabel,
  editObjectLabel,
}: ObjectDetailHeaderProps) {
  const back = useBackToResultsLink("objects");
  const handleCopyLink = async () => {
    const didCopy = await writeTextToClipboard(window.location.href);
    if (!didCopy) {
      return;
    }

    onLinkCopiedChange(true);
    setTimeout(() => onLinkCopiedChange(false), 2000);
  };
  const copyLabel = linkCopied ? linkCopiedLabel : copyLinkLabel;

  return (
    <header className="sticky top-0 z-50 flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border/60 bg-background/80 px-4 py-2 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-2 text-xs">
        <Button variant="ghost" size="icon" className="size-8 shrink-0" asChild>
          <Link href={back.href} aria-label={back.label} title={back.label}>
            <ArrowLeft className="size-4 text-muted-foreground" />
          </Link>
        </Button>
        <span className="hidden text-muted-foreground sm:inline">
          {collectionsLabel}
        </span>
        <span className="hidden text-muted-foreground/50 sm:inline">/</span>
        {collectionGroupName ? (
          <>
            <span className="hidden text-muted-foreground sm:inline">
              {collectionGroupName}
            </span>
            <span className="hidden text-muted-foreground/50 sm:inline">/</span>
          </>
        ) : null}
        <span className="truncate font-medium text-foreground">
          {collection.title}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <Button
          variant="ghost"
          size="icon"
          className={iconButtonClass}
          aria-label={copyLabel}
          title={copyLabel}
          onClick={handleCopyLink}
        >
          {linkCopied ? (
            <Check className="size-4 text-green-500" />
          ) : (
            <Link2 className="size-4" />
          )}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
              aria-label={printMenuLabel}
              title={printMenuLabel}
            >
              <Printer className="size-4" />
              <span className="hidden md:inline">{printMenuLabel}</span>
              <ChevronDown className="size-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuItem onSelect={onPrintClick}>
              <Printer className="mr-2 size-4 text-muted-foreground" />
              {printRecordLabel}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onObjectLabelClick}>
              <Tags className="mr-2 size-4 text-muted-foreground" />
              {printObjectLabel}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onQrLabelClick}>
              <QrCode className="mr-2 size-4 text-muted-foreground" />
              {printLabel}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="h-4 w-px bg-border" />
        <ObjectDeaccessionAction
          collectionId={collectionId}
          collectionTitle={collection.title}
          organizationId={collection.organizationId}
        />
        <PermissionGate permission="collections.update">
          <Button size="sm" asChild>
            <Link
              href={
                editTab
                  ? `/objects/${collectionId}/edit?tab=${editTab}`
                  : `/objects/${collectionId}/edit`
              }
            >
              <Pencil className="mr-2 size-3.5" />
              {editObjectLabel}
            </Link>
          </Button>
        </PermissionGate>
      </div>
    </header>
  );
}
