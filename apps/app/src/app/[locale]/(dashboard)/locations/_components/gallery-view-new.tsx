"use client";

import { Package } from "lucide-react";

interface GalleryObject {
  _id: string;
  title: string;
  accessionNumber?: string;
}

interface GalleryViewNewProps {
  objects: GalleryObject[];
}

export function GalleryViewNew({ objects }: GalleryViewNewProps) {
  const vitrineObjects = objects.slice(0, 8);
  const wallObjects = objects.slice(8, 14);
  const drawerObjects = objects.slice(14, 18);

  const vitrines = [
    { id: "VIT-01", type: "Roman", objects: vitrineObjects.slice(0, 2) },
    { id: "VIT-02", type: "Greek", objects: vitrineObjects.slice(2, 4) },
    { id: "VIT-03", type: "Busts", objects: vitrineObjects.slice(4, 6) },
    { id: "VIT-04", type: "Tools", objects: vitrineObjects.slice(6, 8) },
  ];

  const wallSlots = Array.from({ length: 6 }, (_, i) => ({
    id: `W${i + 1}`,
    object: wallObjects[i],
  }));

  const drawers = Array.from({ length: 4 }, (_, i) => ({
    id: `DRW-A${i + 1}`,
    object: drawerObjects[i],
  }));

  const totalSlots = 18;
  const occupiedSlots = Math.min(objects.length, totalSlots);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
            Freestanding Vitrines
          </h3>
          <div className="text-xs text-zinc-500">
            Occupancy:{" "}
            <span className="text-zinc-300">
              {occupiedSlots}/{totalSlots} Slots
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {vitrines.map((vitrine) => (
            <VitrineCard key={vitrine.id} vitrine={vitrine} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-4">
            Wall Mounted Display
          </h3>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
            <div className="grid grid-cols-6 gap-2 relative z-10">
              {wallSlots.map((slot) => (
                <WallSlot key={slot.id} slot={slot} />
              ))}
            </div>
            <div className="mt-4 flex justify-between items-center text-xs text-zinc-500">
              <span>North Wall • Case W-01</span>
              <span>Security: Locked</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-4">
            Secure Drawers
          </h3>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
            <div className="flex-1 bg-zinc-950 p-1 space-y-1">
              {drawers.map((drawer) => (
                <DrawerRow key={drawer.id} drawer={drawer} />
              ))}
            </div>
            <div className="bg-zinc-950 border-t border-zinc-800 p-2 text-center">
              <button
                type="button"
                className="text-[10px] text-indigo-400 hover:text-indigo-300"
              >
                View Manifest
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface VitrineCardProps {
  vitrine: {
    id: string;
    type: string;
    objects: GalleryObject[];
  };
}

function VitrineCard({ vitrine }: VitrineCardProps) {
  const hasObjects = vitrine.objects.length > 0;
  const statusColor = hasObjects ? "bg-emerald-500" : "bg-zinc-700";

  if (!hasObjects) {
    return (
      <div className="group relative aspect-[4/5] rounded-xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent backdrop-blur-md shadow-2xl transition-all hover:border-zinc-700/40">
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-30 pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-center border-b border-white/5 bg-black/20">
          <span className="text-[10px] font-mono text-zinc-500">
            {vitrine.id} ({vitrine.type})
          </span>
          <div className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
        </div>
        <div className="p-4 pt-12 h-full flex items-center justify-center">
          <span className="text-[9px] text-zinc-600">Empty Slot</span>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative aspect-[4/5] rounded-xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent backdrop-blur-md shadow-2xl transition-all hover:border-indigo-500/40 hover:shadow-indigo-500/10">
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-30 pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-center border-b border-white/5 bg-black/20">
        <span className="text-[10px] font-mono text-zinc-400">
          {vitrine.id} ({vitrine.type})
        </span>
        <div className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
      </div>
      <div className="p-4 pt-12 h-full flex flex-col gap-4">
        {vitrine.objects.map((obj, idx) => (
          <div
            key={obj._id}
            className={`flex-1 ${idx === 0 ? "border-b border-white/5" : ""} flex items-end justify-center pb-2 relative`}
          >
            <div className="w-16 h-16 relative group/item cursor-pointer">
              <div className="absolute inset-0 bg-amber-500/20 blur-xl opacity-0 group-hover/item:opacity-50 transition-opacity" />
              <Package className="w-full h-full text-zinc-300 drop-shadow-xl relative z-10" />
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-0.5 rounded text-[8px] text-white opacity-0 group-hover/item:opacity-100 transition-opacity whitespace-nowrap border border-white/10">
                {obj.title.slice(0, 20)}
                {obj.title.length > 20 ? "..." : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface WallSlotProps {
  slot: {
    id: string;
    object?: GalleryObject;
  };
}

function WallSlot({ slot }: WallSlotProps) {
  if (!slot.object) {
    return (
      <div className="aspect-[3/4] bg-black/40 border border-zinc-800 rounded flex items-center justify-center">
        <span className="text-[9px] text-zinc-700">Empty</span>
      </div>
    );
  }

  return (
    <div className="aspect-[3/4] bg-black/40 border border-white/10 rounded flex items-center justify-center hover:bg-white/5 transition-colors cursor-pointer group">
      <Package className="w-6 h-6 text-amber-200/80 group-hover:scale-110 transition-transform" />
    </div>
  );
}

interface DrawerRowProps {
  drawer: {
    id: string;
    object?: GalleryObject;
  };
}

function DrawerRow({ drawer }: DrawerRowProps) {
  const isEmpty = !drawer.object;
  const statusColor = isEmpty ? "bg-zinc-600" : "bg-emerald-500";

  return (
    <div
      className={`h-10 rounded border flex items-center px-3 justify-between transition-colors ${
        isEmpty
          ? "bg-zinc-900 border-zinc-800/50 opacity-50"
          : "bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-800 cursor-pointer group"
      }`}
    >
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
        <span
          className={`text-xs font-mono ${isEmpty ? "text-zinc-500" : "text-zinc-300"}`}
        >
          {drawer.id}
        </span>
      </div>
      <span
        className={`text-[9px] ${isEmpty ? "text-zinc-600" : "text-zinc-500 group-hover:text-zinc-300"}`}
      >
        {isEmpty ? "Empty" : drawer.object?.title.slice(0, 15)}
      </span>
    </div>
  );
}
