"use client";

import { LocationObjectThumbnail } from "./location-object-thumbnail";

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
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Storage Units
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Shelves, cabinets, boxes, and rooms with their assigned objects
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            {units.length.toLocaleString()} units
          </div>
        </div>

        {units.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-xs text-muted-foreground">
            No storage units found
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {units.map((unit) => (
              <StorageUnitCard
                key={unit._id}
                unit={unit}
                objects={unitObjects.get(unit._id) ?? []}
              />
            ))}
          </div>
        )}
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <div className="border-b border-border bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
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

        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-card text-muted-foreground font-medium">
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

interface StorageUnitCardProps {
  unit: StorageUnit;
  objects: StorageViewProps["objects"];
}

function StorageUnitCard({ unit, objects }: StorageUnitCardProps) {
  const getStatusInfo = () => {
    if (!unit.isActive) {
      return {
        text: "Holding",
        className: "text-muted-foreground",
      };
    }

    const type = unit.type.toLowerCase();
    if (type.includes("restricted") || type.includes("secure")) {
      return {
        text: "Restricted",
        className: "text-rose-500",
      };
    }

    if (type.includes("locked")) {
      return {
        text: "Locked",
        className: "text-amber-500",
      };
    }

    return {
      text: "Accessible",
      className: "text-emerald-400",
    };
  };

  const status = getStatusInfo();

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {unit.name}
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            {unit.locationCode} · {unit.type}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-xs font-medium ${status.className}`}>
            {status.text}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {objects.length} item{objects.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="mt-4">
        {objects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[11px] text-muted-foreground">
            No assigned objects
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2">
            {objects.slice(0, 4).map((object) => (
              <LocationObjectThumbnail
                key={object._id}
                object={object}
                metadataLabel="Stored In"
                metadataValue={unit.name}
                className="rounded-lg"
                imageClassName="aspect-square"
                titleClassName="text-[10px]"
                showFooter
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
