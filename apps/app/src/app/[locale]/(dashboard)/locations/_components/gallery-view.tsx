"use client";

import { cn } from "@v1/ui/utils";
import { Package } from "lucide-react";
import { LocationObjectThumbnail } from "./location-object-thumbnail";

interface GalleryObject {
  _id: string;
  title: string;
  accessionNumber?: string;
  status?: string;
  currentLocationId?: string;
  thumbnailUrl?: string | null;
}

interface DisplayUnitLocation {
  _id: string;
  name: string;
  locationCode: string;
  type: string;
  isActive: boolean;
  descendantLocationIds?: string[];
}

interface GalleryViewProps {
  objects: GalleryObject[];
  vitrineCount?: number;
  vitrineLocations?: DisplayUnitLocation[];
  wallCount?: number;
  wallLocations?: DisplayUnitLocation[];
  wallItemsPerWall?: number;
  cabinetCount?: number;
  cabinetLocations?: DisplayUnitLocation[];
  shelfCount?: number;
  shelfLocations?: DisplayUnitLocation[];
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
  vitrineLocations = [],
  wallCount = DEFAULT_WALL_COUNT,
  wallLocations = [],
  wallItemsPerWall = DEFAULT_WALL_ITEMS_PER_WALL,
  cabinetCount = DEFAULT_CABINET_COUNT,
  cabinetLocations = [],
  shelfCount = DEFAULT_SHELF_COUNT,
  shelfLocations = [],
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
  const generatedCabinetObjects = objects.slice(
    vitrineCapacity + wallCapacity,
    vitrineCapacity + wallCapacity + cabinetCapacity,
  );
  const shelfObjects = objects.slice(
    vitrineCapacity + wallCapacity + cabinetCapacity,
    vitrineCapacity + wallCapacity + cabinetCapacity + shelfCapacity,
  );

  const vitrines =
    vitrineLocations.length > 0
      ? vitrineLocations.map((vitrineLocation) => ({
          id: vitrineLocation.locationCode,
          name: vitrineLocation.name,
          type: vitrineLocation.type,
          isActive: vitrineLocation.isActive,
          objects: getObjectsForDisplayUnit(objects, vitrineLocation),
        }))
      : Array.from({ length: normalizedVitrineCount }, (_, index) => ({
          id: `VIT-${String(index + 1).padStart(2, "0")}`,
          type: VITRINE_TYPES[index % VITRINE_TYPES.length] ?? "Display",
          isActive: true,
          objects: vitrineObjects.slice(index * 2, index * 2 + 2),
        }));

  const wallSlots =
    wallLocations.length > 0
      ? wallLocations.map((wallLocation) => ({
          id: wallLocation.locationCode,
          name: wallLocation.name,
          type: wallLocation.type,
          isActive: wallLocation.isActive,
          objects: getObjectsForDisplayUnit(objects, wallLocation),
        }))
      : Array.from({ length: normalizedWallCount }, (_, index) => ({
          id: `W${index + 1}`,
          type: "Wall",
          isActive: true,
          objects: wallObjects.slice(
            index * normalizedWallItemsPerWall,
            index * normalizedWallItemsPerWall + normalizedWallItemsPerWall,
          ),
        }));

  const cabinets =
    cabinetLocations.length > 0
      ? cabinetLocations.map((cabinetLocation) => {
          return {
            id: cabinetLocation.locationCode,
            name: cabinetLocation.name,
            type: cabinetLocation.type,
            isActive: cabinetLocation.isActive,
            objects: getObjectsForDisplayUnit(objects, cabinetLocation),
          };
        })
      : Array.from({ length: normalizedCabinetCount }, (_, index) => ({
          id: `CAB-${String(index + 1).padStart(2, "0")}`,
          type: "Cabinet",
          isActive: true,
          objects: generatedCabinetObjects.slice(index * 2, index * 2 + 2),
        }));

  const shelves =
    shelfLocations.length > 0
      ? shelfLocations.map((shelfLocation) => ({
          id: shelfLocation.locationCode,
          name: shelfLocation.name,
          type: shelfLocation.type,
          isActive: shelfLocation.isActive,
          objects: getObjectsForDisplayUnit(objects, shelfLocation),
        }))
      : Array.from({ length: normalizedShelfCount }, (_, index) => ({
          id: `SH-${String(index + 1).padStart(2, "0")}`,
          type: "Shelf",
          isActive: true,
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
  const hasVitrines = vitrines.length > 0;
  const hasWalls = wallSlots.length > 0;
  const hasCabinets = cabinets.length > 0;
  const hasShelves = shelves.length > 0;
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
                {occupiedVitrines.length}/{vitrines.length} Vitrines
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
        <div className="grid grid-cols-1 gap-8 2xl:grid-cols-2">
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
                    {wallSlots.length} walls configured ·{" "}
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
                {occupiedCabinets.length}/{cabinets.length} cabinets in use
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
                {occupiedShelves.length}/{shelves.length} shelves in use
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

function getObjectsForDisplayUnit(
  objects: GalleryObject[],
  location: DisplayUnitLocation,
) {
  const locationIds = new Set([
    location._id,
    ...(location.descendantLocationIds ?? []),
  ]);

  return objects.filter(
    (object) =>
      object.currentLocationId !== undefined &&
      locationIds.has(object.currentLocationId),
  );
}

interface VitrineCardProps {
  vitrine: {
    id: string;
    name?: string;
    type: string;
    isActive?: boolean;
    objects: GalleryObject[];
  };
}

function VitrineCard({ vitrine }: VitrineCardProps) {
  const hasObjects = vitrine.objects.length > 0;
  const isInactive = vitrine.isActive === false;
  const statusColor = isInactive
    ? "bg-zinc-700"
    : hasObjects
      ? "bg-emerald-500"
      : "bg-zinc-700";

  if (!hasObjects) {
    return (
      <div className="group relative aspect-[4/5] rounded-xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent backdrop-blur-md shadow-2xl transition-all hover:border-zinc-700/40">
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-30 pointer-events-none" />
        <div className="absolute left-0 right-0 top-0 flex items-center justify-between gap-3 border-b border-white/5 bg-black/20 p-3">
          <div className="min-w-0">
            <div className="truncate font-mono text-[10px] text-zinc-500">
              {vitrine.name ?? vitrine.id}
            </div>
            <div className="mt-0.5 truncate text-[9px] uppercase tracking-[0.16em] text-zinc-600">
              {vitrine.name ? `${vitrine.id} · ${vitrine.type}` : vitrine.type}
            </div>
          </div>
          <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusColor}`} />
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
      <div className="absolute left-0 right-0 top-0 flex items-center justify-between gap-3 border-b border-white/5 bg-black/20 p-3">
        <div className="min-w-0">
          <div className="truncate font-mono text-[10px] text-zinc-400">
            {vitrine.name ?? vitrine.id}
          </div>
          <div className="mt-0.5 truncate text-[9px] uppercase tracking-[0.16em] text-zinc-600">
            {vitrine.name ? `${vitrine.id} · ${vitrine.type}` : vitrine.type}
          </div>
        </div>
        <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusColor}`} />
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
              metadataValue={vitrine.name ?? `${vitrine.id} · ${vitrine.type}`}
              className="h-16 w-16 rounded-xl border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
              imageClassName="aspect-square"
              titleClassName="text-[10px]"
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
    name?: string;
    type?: string;
    isActive?: boolean;
    objects: GalleryObject[];
  };
}

function WallSlot({ slot }: WallSlotProps) {
  const title = slot.name ?? `Wall ${slot.id}`;
  const subtitle = slot.name
    ? `${slot.id} · ${slot.type ?? "Wall"}`
    : slot.type;

  if (slot.objects.length === 0) {
    return (
      <div className="flex aspect-[3/4] flex-col items-center justify-center rounded border border-zinc-800 bg-black/40 px-3 text-center">
        <span className="max-w-full truncate font-mono text-[10px] text-zinc-600">
          {title}
        </span>
        <span className="mt-1 max-w-full truncate text-[9px] uppercase tracking-[0.16em] text-zinc-700">
          {subtitle}
        </span>
        <span className="text-[9px] text-zinc-700">Empty</span>
      </div>
    );
  }

  return (
    <div className="flex aspect-[3/4] flex-col rounded-2xl border border-white/10 bg-black/30 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-mono text-[10px] text-zinc-400">
            {title}
          </div>
          <div className="mt-0.5 truncate text-[9px] uppercase tracking-[0.16em] text-zinc-600">
            {subtitle}
          </div>
        </div>
        {slot.isActive === false ? (
          <span className="shrink-0 text-[9px] uppercase tracking-[0.14em] text-zinc-600">
            Inactive
          </span>
        ) : null}
      </div>
      <div
        className={cn(
          "grid min-h-0 flex-1 gap-2",
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
            metadataValue={title}
            className="h-full rounded-xl border-white/10"
            imageClassName="aspect-auto h-full"
            titleClassName="text-[10px]"
          />
        ))}
      </div>
    </div>
  );
}

interface UnitStackCardProps {
  unit: {
    id: string;
    name?: string;
    type?: string;
    isActive?: boolean;
    objects: GalleryObject[];
  };
}

function UnitStackCard({ unit }: UnitStackCardProps) {
  const isEmpty = unit.objects.length === 0;
  const isInactive = unit.isActive === false;
  const statusColor = isInactive
    ? "bg-zinc-700"
    : isEmpty
      ? "bg-zinc-600"
      : "bg-emerald-500";

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
          <div className="min-w-0">
            <div
              className={`truncate font-mono text-xs ${
                isEmpty ? "text-zinc-500" : "text-zinc-300"
              }`}
            >
              {unit.name ?? unit.id}
            </div>
            <div className="mt-0.5 truncate text-[10px] uppercase tracking-[0.16em] text-zinc-600">
              {unit.name ? `${unit.id} · ${unit.type ?? "Cabinet"}` : unit.type}
            </div>
          </div>
        </div>
        <span className="shrink-0 text-[10px] text-zinc-500">
          {isInactive ? "Inactive" : `${unit.objects.length}/2`}
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
              unit.objects.length === 1
                ? "grid-cols-[minmax(0,5rem)]"
                : "grid-cols-2",
            )}
          >
            {unit.objects.map((object) => (
              <LocationObjectThumbnail
                key={object._id}
                object={object}
                metadataLabel="Placement"
                metadataValue={unit.name ?? unit.id}
                className="rounded-lg border-white/10"
                imageClassName="aspect-square"
                titleClassName="text-[10px]"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
