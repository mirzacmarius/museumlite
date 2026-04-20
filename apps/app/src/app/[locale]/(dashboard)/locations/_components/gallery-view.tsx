"use client";

import { cn } from "@v1/ui/utils";
import { Package } from "lucide-react";
import { LocationObjectThumbnail } from "./location-object-thumbnail";

interface GalleryObject {
  _id: string;
  title: string;
  accessionNumber?: string;
  status?: string;
  thumbnailUrl?: string | null;
}

interface GalleryViewProps {
  objects: GalleryObject[];
  vitrineCount?: number;
  wallCount?: number;
  wallItemsPerWall?: number;
  cabinetCount?: number;
  shelfCount?: number;
  backgroundImageUrl?: string | null;
}

const DEFAULT_VITRINE_COUNT = 0;
const DEFAULT_WALL_COUNT = 0;
const DEFAULT_WALL_ITEMS_PER_WALL = 3;
const DEFAULT_CABINET_COUNT = 0;
const DEFAULT_SHELF_COUNT = 0;
const VITRINE_TYPES = ["Roman", "Greek", "Busts", "Tools", "Ceramics", "Coins"];

export function GalleryView({
  objects,
  vitrineCount = DEFAULT_VITRINE_COUNT,
  wallCount = DEFAULT_WALL_COUNT,
  wallItemsPerWall = DEFAULT_WALL_ITEMS_PER_WALL,
  cabinetCount = DEFAULT_CABINET_COUNT,
  shelfCount = DEFAULT_SHELF_COUNT,
  backgroundImageUrl,
}: GalleryViewProps) {
  const normalizedVitrineCount = Math.max(0, vitrineCount);
  const normalizedWallCount = Math.max(0, wallCount);
  const normalizedWallItemsPerWall = Math.max(1, wallItemsPerWall);
  const normalizedCabinetCount = Math.max(0, cabinetCount);
  const normalizedShelfCount = Math.max(0, shelfCount);

  const vitrineCapacity = normalizedVitrineCount * 2;
  const wallCapacity = normalizedWallCount * normalizedWallItemsPerWall;
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

  const wallSlots = Array.from({ length: normalizedWallCount }, (_, index) => ({
    id: `W${index + 1}`,
    objects: wallObjects.slice(
      index * normalizedWallItemsPerWall,
      index * normalizedWallItemsPerWall + normalizedWallItemsPerWall,
    ),
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
  const occupiedWalls = wallSlots.filter((slot) => slot.objects.length > 0);
  const occupiedCabinets = cabinets.filter(
    (cabinet) => cabinet.objects.length > 0,
  );
  const occupiedShelves = shelves.filter((shelf) => shelf.objects.length > 0);
  const hasVitrines = normalizedVitrineCount > 0;
  const hasWalls = normalizedWallCount > 0;
  const hasCabinets = normalizedCabinetCount > 0;
  const hasShelves = normalizedShelfCount > 0;
  const hasConfiguredUnits =
    hasVitrines || hasWalls || hasCabinets || hasShelves;

  return (
    <div className="space-y-8">
      {!hasConfiguredUnits ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 px-4 py-10 text-center">
          <div className="text-sm font-medium text-zinc-300">
            No display units configured
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Add vitrines, walls, cabinets, or shelves in the location settings
            to visualize object placement here.
          </p>
        </div>
      ) : null}

      {hasVitrines ? (
        <div>
          <div className="mb-4 flex items-end justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
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
      ) : null}

      {hasWalls || hasCabinets ? (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {hasWalls ? (
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-300">
                Wall Mounted Display
              </h3>
              <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                {backgroundImageUrl ? (
                  <>
                    <img
                      src={backgroundImageUrl}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 h-full w-full object-cover opacity-15"
                    />
                    <div className="absolute inset-0 bg-black/70" />
                  </>
                ) : null}
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
                <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
                  <span>
                    {normalizedWallCount} walls configured ·{" "}
                    {normalizedWallItemsPerWall} item
                    {normalizedWallItemsPerWall === 1 ? "" : "s"} per wall
                  </span>
                  <span>{occupiedWalls.length} in use</span>
                </div>
              </div>
            </div>
          ) : null}

          {hasCabinets ? (
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-300">
                Cabinets
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {cabinets.map((cabinet) => (
                  <UnitStackCard key={cabinet.id} unit={cabinet} />
                ))}
              </div>
              <div className="mt-3 text-right text-xs text-zinc-500">
                {occupiedCabinets.length}/{normalizedCabinetCount} cabinets in
                use
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {hasShelves ? (
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
      ) : null}
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
            <LocationObjectThumbnail
              object={obj}
              metadataLabel="Placement"
              metadataValue={`${vitrine.id} · ${vitrine.type}`}
              className="h-24 w-24 rounded-2xl border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
              imageClassName="aspect-square"
              titleClassName="text-xs"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface WallSlotProps {
  slot: {
    id: string;
    objects: GalleryObject[];
  };
}

function WallSlot({ slot }: WallSlotProps) {
  if (slot.objects.length === 0) {
    return (
      <div className="aspect-[3/4] bg-black/40 border border-zinc-800 rounded flex items-center justify-center">
        <span className="text-[9px] text-zinc-700">Empty</span>
      </div>
    );
  }

  return (
    <div className="aspect-[3/4] rounded-2xl border border-white/10 bg-black/30 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
      <div
        className={cn(
          "grid h-full gap-2",
          slot.objects.length === 1
            ? "grid-cols-1"
            : slot.objects.length === 2
              ? "grid-cols-1 grid-rows-2"
              : "grid-cols-1 grid-rows-3",
        )}
      >
        {slot.objects.map((object) => (
          <LocationObjectThumbnail
            key={object._id}
            object={object}
            metadataLabel="Placement"
            metadataValue={`Wall ${slot.id}`}
            className="h-full rounded-xl border-white/10"
            imageClassName="aspect-auto h-full"
            titleClassName="text-[11px]"
          />
        ))}
      </div>
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
          <div
            className={cn(
              "grid gap-2",
              unit.objects.length === 1 ? "grid-cols-1" : "grid-cols-2",
            )}
          >
            {unit.objects.map((object) => (
              <LocationObjectThumbnail
                key={object._id}
                object={object}
                metadataLabel="Placement"
                metadataValue={unit.id}
                className="rounded-xl border-white/10"
                imageClassName="aspect-square"
                titleClassName="text-[11px]"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
