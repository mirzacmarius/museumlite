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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
      case "verified":
        return (
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/80 text-[9px] text-white font-medium capitalize shadow-sm">
            {status}
          </span>
        );
      case "loaned":
        return (
          <span className="px-1.5 py-0.5 rounded bg-blue-500/80 text-[9px] text-white font-medium capitalize shadow-sm">
            {status}
          </span>
        );
      case "deaccessioned":
        return (
          <span className="px-1.5 py-0.5 rounded bg-red-500/80 text-[9px] text-white font-medium capitalize shadow-sm">
            {status}
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.5 rounded bg-zinc-500/80 text-[9px] text-white font-medium capitalize shadow-sm">
            {status}
          </span>
        );
    }
  };

  return (
    <>
      <div
        className={`group relative rounded-lg border bg-zinc-900 border-zinc-800 overflow-hidden transition-all duration-300 hover:border-zinc-600 hover:shadow-xl ${
          isSelected ? "border-indigo-500 ring-1 ring-indigo-500" : ""
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
              className="bg-zinc-950/80 border-zinc-700 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
            />
          </div>
        )}
        <Link href={`/objects/${item._id}`} className="block">
          <div className="relative aspect-square bg-zinc-950 overflow-hidden">
            {primaryImageUrl ? (
              <Image
                src={primaryImageUrl}
                alt={item.title}
                fill
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                className="object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-zinc-700 group-hover:text-zinc-500 transition-colors">
                <Building2 className="h-12 w-12" />
              </div>
            )}

            {/* Status Badge Top Right */}
            <div className="absolute top-2 right-2 z-10">
              {getStatusBadge(item.status)}
            </div>
          </div>
          <div className="p-3">
            <h3 className="font-medium text-xs text-zinc-200 truncate">
              {item.title}
            </h3>
            <p className="text-[10px] text-zinc-500 font-mono mt-1 truncate">
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
                          className="inline-flex items-center rounded bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 text-[9px] text-zinc-400 font-medium"
                        >
                          {type}
                        </span>
                      ));
                    }
                    return (
                      <span className="inline-flex items-center rounded bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 text-[9px] text-zinc-400 font-medium">
                        {item.objectType}
                      </span>
                    );
                  } catch {
                    return (
                      <span className="inline-flex items-center rounded bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 text-[9px] text-zinc-400 font-medium">
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
                  className="h-6 w-6 bg-zinc-950/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-full border border-zinc-700"
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
                className="bg-zinc-950 border-zinc-800 text-zinc-300"
              >
                <PermissionGate permission="collections.create">
                  <DropdownMenuItem
                    className="hover:bg-zinc-900 focus:bg-zinc-900 cursor-pointer"
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
