"use client";

import { LocationObjectThumbnail } from "./location-object-thumbnail";
import { LocationUnitCard } from "./location-unit-card";

interface StorageUnit {
  _id: string;
  name: string;
  locationCode: string;
  type: string;
  isActive: boolean;
}

interface StorageViewProps {
  units: StorageUnit[];
  objects: Array<{
    _id: string;
    currentLocationId: string;
    accessionNumber?: string;
    title: string;
    status?: string;
    thumbnailUrl?: string | null;
  }>;
  includesDescendants?: boolean;
}

export function StorageView({
  units,
  objects,
  includesDescendants = false,
}: StorageViewProps) {
  const unitObjects = new Map(
    units.map((unit) => [
      unit._id,
      objects.filter((object) => object.currentLocationId === unit._id),
    ]),
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-medium text-foreground">
              Storage Units
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Shelves, cabinets, boxes, and rooms with their assigned objects
            </p>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Occupied
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-muted-foreground/40" />
              Empty
            </span>
            <span className="tabular-nums">
              {units.length.toLocaleString()} units
            </span>
          </div>
        </div>

        {units.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-xs text-muted-foreground">
            No storage units found
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,160px),1fr))] items-start gap-4">
            {units.map((unit) => (
              <LocationUnitCard
                key={unit._id}
                name={unit.name}
                isActive={unit.isActive}
                objects={unitObjects.get(unit._id) ?? []}
              />
            ))}
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border border-border/60 bg-background dark:border-white/10">
        <div className="border-b border-border/60 bg-muted/20 px-4 py-3 dark:border-white/10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xs font-medium text-foreground">
                Objects in Active Location
              </h3>
              {includesDescendants && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Includes objects in this location and its child units
                </p>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {objects.length.toLocaleString()} objects
            </div>
          </div>
        </div>

        <table className="w-full min-w-[440px] text-start text-xs">
          <thead className="border-b border-border/60 bg-muted/20 text-muted-foreground font-medium">
            <tr>
              <th className="px-4 py-3">Accession Number</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {objects.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {includesDescendants
                    ? "No objects in this location or its child units"
                    : "No objects in this location"}
                </td>
              </tr>
            ) : (
              objects.map((object) => (
                <tr key={object._id} className="hover:bg-muted/40">
                  <td className="px-4 py-3 font-mono text-muted-foreground align-top">
                    {object.accessionNumber ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 shrink-0">
                        <LocationObjectThumbnail
                          object={object}
                          className="rounded-lg"
                          imageClassName="aspect-square"
                          titleClassName="text-[10px]"
                          textPlacement="overlay"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-foreground">
                          {object.title}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground capitalize align-top">
                    {object.status ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
