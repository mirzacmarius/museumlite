"use client";

import { DeaccessionDialog } from "@/components/deaccession-dialog";
import { PermissionGate } from "@/components/permission-gate";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Checkbox } from "@v1/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { useQuery } from "convex/react";
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
    status: string;
  };
  organizationId: Id<"organizations">;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
}

function ObjectGridItem({
  item,
  organizationId,
  isSelected = false,
  onSelect,
}: ObjectGridItemProps) {
  const [isDeaccessionDialogOpen, setIsDeaccessionDialogOpen] = useState(false);
  const canDeaccession = item.status !== "deaccessioned";

  const primaryImageUrl = useQuery(api.media.getPrimaryImageUrl, {
    collectionId: item._id as Id<"collections">,
  });

  return (
    <>
      <div
        className={`group relative rounded-xl border bg-card overflow-hidden transition-all duration-300 hover:border-indigo-500/30 hover:ring-1 hover:ring-indigo-500/30 hover:shadow-xl hover:shadow-indigo-900/10 ${
          isSelected ? "border-primary ring-2 ring-primary/20" : "border-border"
        }`}
      >
        {onSelect && (
          <div
            className={`absolute top-2 left-2 z-10 transition-opacity ${
              isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onSelect(!!checked)}
              onClick={(e) => e.stopPropagation()}
              className="bg-white/80 backdrop-blur-sm"
            />
          </div>
        )}
        <Link href={`/objects/${item._id}`} className="block">
          <div className="relative aspect-square bg-muted">
            {primaryImageUrl ? (
              <Image
                src={primaryImageUrl}
                alt={item.title}
                fill
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Building2 className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
            {item.status === "deaccessioned" && (
              <div className="absolute top-2 left-2 ml-6">
                <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600">
                  <Archive className="mr-1 h-3 w-3" />
                  Deaccessioned
                </span>
              </div>
            )}
          </div>
          <div className="p-3">
            <h3 className="font-medium text-sm truncate">{item.title}</h3>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {item.accessionNumber}
            </p>
            {item.objectType && (
              <div className="mt-2 flex flex-wrap gap-1">
                {(() => {
                  try {
                    const types = JSON.parse(item.objectType);
                    return Array.isArray(types) && types.length > 0
                      ? types.slice(0, 2).map((type: string) => (
                          <span
                            key={type}
                            className="inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium"
                          >
                            {type}
                          </span>
                        ))
                      : null;
                  } catch {
                    return null;
                  }
                })()}
              </div>
            )}
          </div>
        </Link>

        {canDeaccession && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onClick={(e) => e.stopPropagation()}
              >
                <PermissionGate permission="collections.create">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDeaccessionDialogOpen(true);
                    }}
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Deaccession
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
          />
        </div>
      ))}
    </div>
  );
}
