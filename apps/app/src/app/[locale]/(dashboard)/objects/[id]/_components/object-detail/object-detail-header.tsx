"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import {
  ArrowLeft,
  Check,
  FileDown,
  Link2,
  Pencil,
  Printer,
  QrCode,
  Send,
  Share2,
  Tags,
} from "lucide-react";
import Link from "next/link";
import { PermissionGate } from "@/components/permission-gate";
import { useBackToResultsLink } from "@/components/record-recovery-state";
import { writeTextToClipboard } from "@/lib/clipboard";
import type { ObjectDetailData } from "../types";

interface ObjectDetailHeaderProps {
  collection: NonNullable<ObjectDetailData["collection"]>;
  collectionGroupName?: string;
  collectionId: Id<"collections">;
  linkCopied: boolean;
  onLinkCopiedChange: (copied: boolean) => void;
  onPrintClick: () => void;
  onObjectLabelClick: () => void;
  onQrLabelClick: () => void;
  collectionsLabel: string;
  copyLinkLabel: string;
  linkCopiedLabel: string;
  exportPdfLabel: string;
  requestLoanLabel: string;
  printLabel: string;
  printObjectLabel: string;
  editObjectLabel: string;
  shareTitle: string;
}

export function ObjectDetailHeader({
  collection,
  collectionGroupName,
  collectionId,
  linkCopied,
  onLinkCopiedChange,
  onPrintClick,
  onObjectLabelClick,
  onQrLabelClick,
  collectionsLabel,
  copyLinkLabel,
  linkCopiedLabel,
  exportPdfLabel,
  requestLoanLabel,
  printLabel,
  printObjectLabel,
  editObjectLabel,
  shareTitle,
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

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-xs">
        <Button variant="ghost" size="icon" className="size-7" asChild>
          <Link href={back.href} aria-label={back.label} title={back.label}>
            <ArrowLeft className="size-4 text-muted-foreground" />
          </Link>
        </Button>
        <span className="text-muted-foreground">{collectionsLabel}</span>
        <span className="text-muted-foreground/50">/</span>
        {collectionGroupName ? (
          <>
            <span className="text-muted-foreground">{collectionGroupName}</span>
            <span className="text-muted-foreground/50">/</span>
          </>
        ) : null}
        <span className="font-medium text-foreground">{collection.title}</span>
      </div>

      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              title={shareTitle}
            >
              <Share2 className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleCopyLink}>
              {linkCopied ? (
                <Check className="mr-2 size-4 text-green-500" />
              ) : (
                <Link2 className="mr-2 size-4" />
              )}
              {linkCopied ? linkCopiedLabel : copyLinkLabel}
            </DropdownMenuItem>
            <DropdownMenuItem>
              <FileDown className="mr-2 size-4" />
              {exportPdfLabel}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Send className="mr-2 size-4" />
              {requestLoanLabel}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          title={shareTitle}
          onClick={onPrintClick}
        >
          <Printer className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          title={printObjectLabel}
          onClick={onObjectLabelClick}
        >
          <Tags className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          title={printLabel}
          onClick={onQrLabelClick}
        >
          <QrCode className="size-4" />
        </Button>
        <div className="h-4 w-px bg-border" />
        <PermissionGate permission="collections.update">
          <Button asChild>
            <Link href={`/objects/${collectionId}/edit`}>
              <Pencil className="mr-2 size-3.5" />
              {editObjectLabel}
            </Link>
          </Button>
        </PermissionGate>
      </div>
    </header>
  );
}
