"use client";

import { cn } from "@v1/ui/utils";
import { ChevronRight } from "lucide-react";
import * as React from "react";

export interface LocationNode {
  id: string;
  name: string;
  type: "building" | "floor" | "room" | "shelf";
  children?: LocationNode[];
  count?: number;
}

export interface LocationTreeProps {
  locations: LocationNode[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}

interface TreeNodeProps {
  node: LocationNode;
  level: number;
  selectedId?: string;
  onSelect?: (id: string) => void;
}

function TreeNode({ node, level, selectedId, onSelect }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;

  const handleClick = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
    if (onSelect) {
      onSelect(node.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    } else if (e.key === "ArrowRight" && hasChildren && !isExpanded) {
      setIsExpanded(true);
    } else if (e.key === "ArrowLeft" && hasChildren && isExpanded) {
      setIsExpanded(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-colors duration-200 text-left",
          isSelected
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        )}
        style={{ paddingLeft: `${level * 12 + 12}px` }}
      >
        {hasChildren && (
          <ChevronRight
            className={cn(
              "size-3 shrink-0 transition-transform duration-200",
              isExpanded && "rotate-90",
            )}
          />
        )}
        {!hasChildren && <div className="w-3" />}
        <span className="flex-1 text-sm font-medium truncate">{node.name}</span>
        {node.count !== undefined && node.count > 0 && (
          <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
            {node.count}
          </span>
        )}
      </button>
      {hasChildren && isExpanded && (
        <div className="mt-0.5">
          {node.children?.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function LocationTree({
  locations,
  selectedId,
  onSelect,
  className,
}: LocationTreeProps) {
  return (
    <div className={cn("space-y-0.5", className)}>
      {locations.map((location) => (
        <TreeNode
          key={location.id}
          node={location}
          level={0}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
