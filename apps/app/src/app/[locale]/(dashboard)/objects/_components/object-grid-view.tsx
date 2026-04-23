"use client";

import { DeaccessionDialog } from "@/components/deaccession-dialog";
import { PermissionGate } from "@/components/permission-gate";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Archive, Building2, MoreVertical } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

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
  const [isDeaccessionDialogOpen, setIsDeaccessionDialogOpen] = useState(false);
  const canDeaccession = item.status !== "deaccessioned";

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
    <>
      <div
        className={`group relative overflow-hidden rounded-lg border border-border bg-card transition-all duration-300 hover:border-ring/50 hover:shadow-xl ${
          isSelected ? "border-primary ring-1 ring-primary" : ""
        }`}
      >
        {onSelect && (
          <div
            className={`absolute top-2 left-2 z-20 transition-opacity ${
              isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
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
              <div className="flex h-full w-full items-center justify-center text-muted-foreground/50 transition-colors group-hover:text-muted-foreground">
                <Building2 className="h-12 w-12" />
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
            <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
              {item.accessionNumber}
            </p>
            {item.objectType && (
              <div className="mt-2 flex flex-wrap gap-1">
                {(() => {
                  try {
                    const types = JSON.parse(item.objectType);
                    if (Array.isArray(types) && types.length > 0) {
                      return types.slice(0, 2).map((type: string) => (
                        <span
                          key={type}
                          className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground"
                        >
                          {type}
                        </span>
                      ));
                    }
                    return (
                      <span className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                        {item.objectType}
                      </span>
                    );
                  } catch {
                    return (
                      <span className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                        {item.objectType}
                      </span>
                    );
                  }
                })()}
              </div>
            )}
          </div>
        </Link>

        {canDeaccession && (
          <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-20">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-full border border-border bg-background/80 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onClick={(e) => e.stopPropagation()}
                className="border-border bg-popover text-popover-foreground"
              >
                <PermissionGate permission="collections.update">
                  <DropdownMenuItem
                    className="cursor-pointer focus:bg-accent focus:text-accent-foreground"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDeaccessionDialogOpen(true);
                    }}
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Remove / Transfer
                  </DropdownMenuItem>
                </PermissionGate>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <DeaccessionDialog
        open={isDeaccessionDialogOpen}
        onOpenChange={setIsDeaccessionDialogOpen}
        collectionId={item._id as Id<"collections">}
        collectionTitle={item.title}
        organizationId={organizationId}
      />
    </>
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
        <div
          key={item._id}
          className="animate-enter"
          style={{ animationDelay: `${Math.min(index * 50, 500)}ms` }}
        >
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
