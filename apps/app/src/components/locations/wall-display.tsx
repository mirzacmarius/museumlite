"use client";

import { Package, Scissors } from "lucide-react";

interface WallSlot {
  id: string;
  occupied: boolean;
  itemType?: string;
}

interface WallDisplayProps {
  title: string;
  location: string;
  securityStatus: string;
  slots: WallSlot[];
}

export function WallDisplay({
  title,
  location,
  securityStatus,
  slots,
}: WallDisplayProps) {
  return (
    <div className="lg:col-span-2">
      <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-4">
        {title}
      </h3>
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 relative overflow-hidden">
        {/* Wall Texture Effect */}
        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.02)_25%,rgba(255,255,255,0.02)_50%,transparent_50%,transparent_75%,rgba(255,255,255,0.02)_75%)] bg-[length:8px_8px]" />

        <div className="grid grid-cols-6 gap-2 relative z-10">
          {slots.map((slot, index) => (
            <WallSlot key={slot.id || index} slot={slot} />
          ))}
        </div>
        <div className="mt-4 flex justify-between items-center text-xs text-zinc-500">
          <span>{location}</span>
          <span>Security: {securityStatus}</span>
        </div>
      </div>
    </div>
  );
}

interface WallSlotProps {
  slot: WallSlot;
}

function WallSlot({ slot }: WallSlotProps) {
  if (slot.occupied) {
    return (
      <div className="aspect-[3/4] bg-zinc-950/40 border border-white/10 rounded flex items-center justify-center hover:bg-white/5 transition-colors cursor-pointer group">
        {slot.itemType === "sculpture" ? (
          <Scissors className="size-6 text-amber-200/80 group-hover:scale-110 transition-transform" />
        ) : (
          <Package className="size-6 text-zinc-400 group-hover:scale-110 transition-transform" />
        )}
      </div>
    );
  }

  return (
    <div className="aspect-[3/4] bg-zinc-950/40 border border-zinc-800 rounded flex items-center justify-center">
      <span className="text-[9px] text-zinc-700">Empty</span>
    </div>
  );
}
