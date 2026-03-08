"use client";

import { Package } from "lucide-react";

interface GalleryObject {
  _id: string;
  title: string;
  accessionNumber?: string;
}

interface GalleryViewProps {
  objects: GalleryObject[];
  vitrineCount?: number;
  wallCount?: number;
  cabinetCount?: number;
  shelfCount?: number;
}

const DEFAULT_VITRINE_COUNT = 4;
const DEFAULT_WALL_COUNT = 6;
const DEFAULT_CABINET_COUNT = 4;
const DEFAULT_SHELF_COUNT = 4;
const VITRINE_TYPES = ["Roman", "Greek", "Busts", "Tools", "Ceramics", "Coins"];

export function GalleryView({
  objects,
  vitrineCount = DEFAULT_VITRINE_COUNT,
  wallCount = DEFAULT_WALL_COUNT,
  cabinetCount = DEFAULT_CABINET_COUNT,
  shelfCount = DEFAULT_SHELF_COUNT,
}: GalleryViewProps) {
  const normalizedVitrineCount = Math.max(0, vitrineCount);
  const normalizedWallCount = Math.max(0, wallCount);
  const normalizedCabinetCount = Math.max(0, cabinetCount);
  const normalizedShelfCount = Math.max(0, shelfCount);

  const vitrineCapacity = normalizedVitrineCount * 2;
  const wallCapacity = normalizedWallCount;
  const cabinetCapacity = normalizedCabinetCount * 2;
  const shelfCapacity = normalizedShelfCount * 2;

  const vitrineObjects = objects.slice(0, vitrineCapacity);
  const wallObjects = objects.slice(
    vitrineCapacity,
    vitrineCapacity + wallCapacity,
  );
  const cabinetObjects = objects.slice(
    vitrineCapacity + wallCapacity,
    vitrineCapacity + wallCapacity + cabinetCapacity,
  );
  const shelfObjects = objects.slice(
    vitrineCapacity + wallCapacity + cabinetCapacity,
    vitrineCapacity + wallCapacity + cabinetCapacity + shelfCapacity,
  );

  const vitrines = Array.from(
    { length: normalizedVitrineCount },
    (_, index) => ({
      id: `VIT-${String(index + 1).padStart(2, "0")}`,
      type: VITRINE_TYPES[index % VITRINE_TYPES.length] ?? "Display",
      objects: vitrineObjects.slice(index * 2, index * 2 + 2),
    }),
  );

  const wallSlots = Array.from({ length: normalizedWallCount }, (_, i) => ({
    id: `W${i + 1}`,
    object: wallObjects[i],
  }));

  const cabinets = Array.from(
    { length: normalizedCabinetCount },
    (_, index) => ({
      id: `CAB-${String(index + 1).padStart(2, "0")}`,
      objects: cabinetObjects.slice(index * 2, index * 2 + 2),
    }),
  );

  const shelves = Array.from({ length: normalizedShelfCount }, (_, index) => ({
    id: `SH-${String(index + 1).padStart(2, "0")}`,
    objects: shelfObjects.slice(index * 2, index * 2 + 2),
  }));

  const occupiedVitrines = vitrines.filter(
    (vitrine) => vitrine.objects.length > 0,
  );
  const occupiedWalls = wallSlots.filter((slot) => slot.object);
  const occupiedCabinets = cabinets.filter(
    (cabinet) => cabinet.objects.length > 0,
  );
  const occupiedShelves = shelves.filter((shelf) => shelf.objects.length > 0);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">
            Freestanding Vitrines
          </h3>
          <div className="text-xs text-zinc-500">
            In use:{" "}
            <span className="text-zinc-300">
              {occupiedVitrines.length}/{normalizedVitrineCount} Vitrines
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {vitrines.map((vitrine) => (
            <VitrineCard key={vitrine.id} vitrine={vitrine} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-4">
            Wall Mounted Display
          </h3>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
            <div
              className="relative z-10 grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${Math.max(
                  1,
                  Math.min(normalizedWallCount, 6),
                )}, minmax(0, 1fr))`,
              }}
            >
              {wallSlots.map((slot) => (
                <WallSlot key={slot.id} slot={slot} />
              ))}
            </div>
            <div className="mt-4 flex justify-between items-center text-xs text-zinc-500">
              <span>{normalizedWallCount} walls configured</span>
              <span>{occupiedWalls.length} in use</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-4">
            Cabinets
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {cabinets.map((cabinet) => (
              <UnitStackCard key={cabinet.id} unit={cabinet} />
            ))}
          </div>
          <div className="mt-3 text-right text-xs text-zinc-500">
            {occupiedCabinets.length}/{normalizedCabinetCount} cabinets in use
          </div>
        </div>
      </div>

      <div>
        <div className="mb-4 flex items-end justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
            Shelves
          </h3>
          <div className="text-xs text-zinc-500">
            <span className="text-zinc-300">
              {occupiedShelves.length}/{normalizedShelfCount} shelves in use
            </span>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {shelves.map((shelf) => (
            <UnitStackCard key={shelf.id} unit={shelf} />
          ))}
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

interface UnitStackCardProps {
  unit: {
    id: string;
    objects: GalleryObject[];
  };
}

function UnitStackCard({ unit }: UnitStackCardProps) {
  const isEmpty = unit.objects.length === 0;
  const statusColor = isEmpty ? "bg-zinc-600" : "bg-emerald-500";

  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        isEmpty
          ? "border-zinc-800/50 bg-zinc-900/40 opacity-70"
          : "border-zinc-700/50 bg-zinc-900/70"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-1.5 w-1.5 rounded-full ${statusColor}`} />
          <span
            className={`font-mono text-xs ${isEmpty ? "text-zinc-500" : "text-zinc-300"}`}
          >
            {unit.id}
          </span>
        </div>
        <span className="text-[10px] text-zinc-500">
          {unit.objects.length}/2
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {unit.objects.length === 0 ? (
          <div className="rounded border border-dashed border-zinc-800 px-2 py-3 text-center text-[10px] text-zinc-600">
            Empty
          </div>
        ) : (
          unit.objects.map((object) => (
            <div
              key={object._id}
              className="rounded border border-white/5 bg-black/20 px-2 py-2"
            >
              <div className="font-mono text-[10px] text-zinc-500">
                {object.accessionNumber ?? "—"}
              </div>
              <div className="truncate text-xs text-zinc-200">
                {object.title}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
