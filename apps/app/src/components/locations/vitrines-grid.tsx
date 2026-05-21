"use client";

import { Package } from "lucide-react";

interface VitrineItem {
  id: string;
  name: string;
  type:
    | "roman"
    | "greek"
    | "busts"
    | "tools"
    | "empty"
    | "maintenance"
    | "artifact";
  status: "active" | "warning" | "maintenance" | "empty";
}

interface VitrinesGridProps {
  title: string;
  subtitle?: string;
  occupancy?: string;
  items: VitrineItem[];
}

export function VitrinesGrid({
  title,
  _subtitle,
  occupancy,
  items,
}: VitrinesGridProps) {
  return (
    <div>
      <div className="flex justify-between items-end mb-4">
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
          {title}
        </h3>
        {occupancy && (
          <div className="text-xs text-zinc-500">
            Occupancy: <span className="text-zinc-300">{occupancy}</span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {items.map((item) => (
          <VitrineCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

interface VitrineCardProps {
  item: VitrineItem;
}

function VitrineCard({ item }: VitrineCardProps) {
  const statusColors = {
    active: "bg-emerald-500",
    warning: "bg-amber-500 animate-pulse",
    maintenance: "bg-zinc-600",
    empty: "bg-zinc-700",
  };

  const _borderColors = {
    active: "hover:border-primary/40",
    warning: "hover:border-amber-500/40",
    maintenance: "hover:border-zinc-600/40",
    empty: "hover:border-zinc-700/40",
  };

  const statusDot = statusColors[item.status];

  if (item.type === "empty") {
    return (
      <div className="group relative aspect-[4/5] rounded-xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent backdrop-blur-md transition-all hover:border-zinc-700/40">
        <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-center border-b border-white/5 bg-zinc-950/20">
          <span className="text-[10px] font-mono text-zinc-500">
            {item.id.toUpperCase()}
          </span>
          <div className={`size-1.5 rounded-full ${statusDot}`} />
        </div>
        <div className="p-4 pt-12 h-full flex items-center justify-center">
          <span className="text-[9px] text-zinc-600">Empty Slot</span>
        </div>
      </div>
    );
  }

  if (item.type === "maintenance") {
    return (
      <div className="group relative aspect-[4/5] rounded-xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent backdrop-blur-md transition-all hover:border-zinc-700/40">
        <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-center border-b border-white/5 bg-zinc-950/20">
          <span className="text-[10px] font-mono text-zinc-400">
            {item.id.toUpperCase()}
          </span>
          <div className={`size-1.5 rounded-full ${statusDot}`} />
        </div>
        <div className="p-4 pt-12 h-full flex items-center justify-center">
          <div className="text-center space-y-2">
            <Package className="size-12 text-zinc-600 mx-auto" />
            <p className="text-[10px] text-zinc-500">Under Maintenance</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative aspect-[4/5] rounded-xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent backdrop-blur-md shadow-2xl transition-all hover:border-primary/40 hover:shadow-primary/10">
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-30 pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-center border-b border-white/5 bg-zinc-950/20">
        <span className="text-[10px] font-mono text-zinc-400">
          {item.id.toUpperCase()} (
          {item.type.charAt(0).toUpperCase() + item.type.slice(1)})
        </span>
        <div className={`size-1.5 rounded-full ${statusDot}`} />
      </div>
      <div className="p-4 pt-12 h-full flex flex-col gap-4">
        <div className="flex-1 border-b border-white/5 flex items-end justify-center pb-2 relative">
          <div className="size-16 relative group/item cursor-pointer">
            <div className="absolute inset-0 bg-amber-500/20 blur-xl opacity-0 group-hover/item:opacity-50 transition-opacity" />
            <Package className="size-full text-zinc-300 drop-shadow-xl relative z-10" />
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-zinc-950/80 px-2 py-0.5 rounded text-[8px] text-white opacity-0 group-hover/item:opacity-100 transition-opacity whitespace-nowrap border border-white/10">
              {item.name}
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-end justify-center pb-2 relative">
          <div className="size-12 relative group/item cursor-pointer">
            <Package className="size-full text-zinc-400 drop-shadow-xl relative z-10" />
          </div>
        </div>
      </div>
    </div>
  );
}
