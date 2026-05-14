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
        <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center">
          <div className="text-sm font-medium text-foreground">
            No display units configured
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Add vitrines, walls, cabinets, or shelves in the location settings
            to visualize object placement here.
          </p>
        </div>
      ) : null}

      {hasVitrines ? (
        <div>
          <div className="mb-4 flex items-end justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
              Freestanding Vitrines
            </h3>
            <div className="text-xs text-muted-foreground">
              In use:{" "}
              <span className="text-foreground">
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
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-foreground">
                Wall Mounted Display
              </h3>
              <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6">
                {backgroundImageUrl ? (
                  <>
                    <img
                      src={backgroundImageUrl}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 size-full object-cover opacity-15"
                    />
                    <div className="absolute inset-0 bg-background/80" />
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
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
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
            <div className={cn(!hasWalls && "2xl:col-span-2")}>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-foreground">
                Cabinets
              </h3>
              <div className="grid gap-4 xl:grid-cols-2">
                {cabinets.map((cabinet) => (
                  <UnitStackCard key={cabinet.id} unit={cabinet} />
                ))}
              </div>
              <div className="mt-3 text-right text-xs text-muted-foreground">
                {occupiedCabinets.length}/{cabinets.length} cabinets in use
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {hasShelves ? (
        <div>
          <div className="mb-4 flex items-end justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
              Shelves
            </h3>
            <div className="text-xs text-muted-foreground">
              <span className="text-foreground">
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
    ? "bg-muted-foreground"
    : hasObjects
      ? "bg-emerald-500"
      : "bg-muted-foreground";

  if (!hasObjects) {
    return (
      <div className="group relative aspect-[4/5] rounded-xl border border-border bg-card shadow-sm transition-all hover:border-border/80">
        <div className="absolute left-0 right-0 top-0 flex items-center justify-between gap-3 border-b border-border bg-muted/30 p-3">
          <div className="min-w-0">
            <div className="truncate font-mono text-[10px] text-muted-foreground">
              {vitrine.name ?? vitrine.id}
            </div>
            <div className="mt-0.5 truncate text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              {vitrine.name ? `${vitrine.id} · ${vitrine.type}` : vitrine.type}
            </div>
          </div>
          <div className={`size-1.5 shrink-0 rounded-full ${statusColor}`} />
        </div>
        <div className="p-4 pt-12 h-full flex items-center justify-center">
          <span className="text-[9px] text-muted-foreground">Empty Slot</span>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative aspect-[4/5] rounded-xl border border-border bg-card shadow-sm transition-all hover:border-primary/40">
      <div className="absolute left-0 right-0 top-0 flex items-center justify-between gap-3 border-b border-border bg-muted/30 p-3">
        <div className="min-w-0">
          <div className="truncate font-mono text-[10px] text-muted-foreground">
            {vitrine.name ?? vitrine.id}
          </div>
          <div className="mt-0.5 truncate text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
            {vitrine.name ? `${vitrine.id} · ${vitrine.type}` : vitrine.type}
          </div>
        </div>
        <div className={`size-1.5 shrink-0 rounded-full ${statusColor}`} />
      </div>
      <div className="p-4 pt-12 h-full flex flex-col gap-4">
        {vitrine.objects.map((obj, idx) => (
          <div
            key={obj._id}
            className={`flex-1 ${idx === 0 ? "border-b border-border" : ""} flex items-end justify-center pb-2 relative`}
          >
            <LocationObjectThumbnail
              object={obj}
              metadataLabel="Placement"
              metadataValue={vitrine.name ?? `${vitrine.id} · ${vitrine.type}`}
              className="size-16 rounded-xl border-border shadow-sm"
              imageClassName="aspect-square"
              titleClassName="text-[10px]"
              textPlacement="overlay"
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
      <div className="flex aspect-[3/4] flex-col items-center justify-center rounded border border-border bg-muted/40 px-3 text-center">
        <span className="max-w-full truncate font-mono text-[10px] text-muted-foreground">
          {title}
        </span>
        <span className="mt-1 max-w-full truncate text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
          {subtitle}
        </span>
        <span className="text-[9px] text-muted-foreground">Empty</span>
      </div>
    );
  }

  return (
    <div className="flex aspect-[3/4] flex-col rounded-2xl border border-border bg-card p-2 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-mono text-[10px] text-muted-foreground">
            {title}
          </div>
          <div className="mt-0.5 truncate text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
            {subtitle}
          </div>
        </div>
        {slot.isActive === false ? (
          <span className="shrink-0 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
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
            className="h-full rounded-xl border-border"
            imageClassName="aspect-auto h-full"
            titleClassName="text-[10px]"
            textPlacement="overlay"
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
    ? "bg-muted-foreground"
    : isEmpty
      ? "bg-muted-foreground"
      : "bg-emerald-500";

  return (
    <div
      className={`rounded-2xl border p-4 transition-colors ${
        isEmpty
          ? "border-border/50 bg-card opacity-70"
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className={`mt-1.5 size-1.5 rounded-full ${statusColor}`} />
          <div className="min-w-0">
            <div
              className={`truncate font-mono text-xs ${
                isEmpty ? "text-muted-foreground" : "text-foreground"
              }`}
            >
              {unit.name ?? unit.id}
            </div>
            <div className="mt-0.5 truncate text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {unit.name ? `${unit.id} · ${unit.type ?? "Cabinet"}` : unit.type}
            </div>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
          {isInactive ? "Inactive" : `${unit.objects.length}/2`}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {unit.objects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-[11px] text-muted-foreground">
            Empty
          </div>
        ) : (
          <div
            className={cn(
              "grid gap-3",
              unit.objects.length === 1
                ? "grid-cols-[minmax(0,12rem)]"
                : "grid-cols-2 md:grid-cols-[repeat(auto-fit,minmax(8rem,1fr))]",
            )}
          >
            {unit.objects.map((object) => (
              <LocationObjectThumbnail
                key={object._id}
                object={object}
                className="rounded-xl border-border"
                imageClassName="aspect-[4/3]"
                titleClassName="text-[10px]"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
