"use client";

import type { Doc } from "@v1/backend/convex/_generated/dataModel";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { cn } from "@v1/ui/utils";
import { AlertTriangle, Box, X } from "lucide-react";
import Image from "next/image";

export interface SelectedCollectionItemProps {
  collection: Pick<Doc<"collections">, "_id" | "accessionNumber" | "title"> & {
    primaryImageUrl?: string;
  };
  condition: string;
  onConditionChange: (value: string) => void;
  onRemove: () => void;
  hasIssue?: boolean;
  issueMessage?: string;
  conditionPlaceholder: string;
}

export function SelectedCollectionItem({
  collection,
  condition,
  onConditionChange,
  onRemove,
  hasIssue = false,
  issueMessage,
  conditionPlaceholder,
}: SelectedCollectionItemProps) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-2 transition-colors",
        hasIssue
          ? "border-destructive bg-destructive/5"
          : "border-border bg-secondary/20",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="size-10 rounded bg-secondary ring-1 ring-border flex-shrink-0 overflow-hidden">
          {collection.primaryImageUrl ? (
            <Image
              src={collection.primaryImageUrl}
              alt={collection.title}
              width={40}
              height={40}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Box className="size-5 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{collection.title}</p>
            {hasIssue && (
              <AlertTriangle className="size-4 text-destructive flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            {collection.accessionNumber}
          </p>
          {hasIssue && issueMessage && (
            <p className="text-xs text-destructive mt-1">{issueMessage}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="p-1 hover:bg-destructive/10 hover:text-destructive rounded transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`condition-${collection._id}`} className="text-xs">
          Condition Out
        </Label>
        <Input
          id={`condition-${collection._id}`}
          value={condition}
          onChange={(e) => onConditionChange(e.target.value)}
          placeholder={conditionPlaceholder}
          className={cn(
            "bg-background text-sm",
            hasIssue && "border-destructive",
          )}
        />
      </div>
    </div>
  );
}
