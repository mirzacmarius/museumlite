"use client";

import { LocationObjectThumbnail } from "./location-object-thumbnail";

interface StorageUnit {
  _id: string;
  name: string;
  type: string;
  isActive: boolean;
}

interface StorageViewProps {
  units: StorageUnit[];
  totalObjects: number;
  capacity: number;
  lastAuditDate?: Date;
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
  totalObjects,
  capacity,
  lastAuditDate,
  objects,
  includesDescendants = false,
}: StorageViewProps) {
  const occupancyPercent =
    capacity > 0 ? Math.round((totalObjects / capacity) * 100) : 0;
  const unitObjects = new Map(
    units.map((unit) => [
      unit._id,
      objects.filter((object) => object.currentLocationId === unit._id),
    ]),
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-lg">
          <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">
            Capacity
          </div>
          <div className="text-xl font-semibold text-zinc-200">
            {occupancyPercent}% Full
          </div>
          <div className="w-full bg-zinc-900 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-indigo-500 h-full"
              style={{ width: `${Math.min(occupancyPercent, 100)}%` }}
            />
          </div>
        </div>

        <div className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-lg">
          <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">
            Total Items
          </div>
          <div className="text-xl font-semibold text-zinc-200">
            {totalObjects.toLocaleString()} Objects
          </div>
        </div>

        <div className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-lg">
          <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">
            Last Audit
          </div>
          <div className="text-xl font-semibold text-zinc-200">
            {lastAuditDate
              ? new Intl.DateTimeFormat("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }).format(lastAuditDate)
              : "Never"}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-4">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-200">
              Storage Units
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              Shelves, cabinets, boxes, and rooms with their assigned objects
            </p>
          </div>
          <div className="text-xs text-zinc-500">
            {units.length.toLocaleString()} units
          </div>
        </div>

        {units.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-10 text-center text-xs text-zinc-600">
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

      <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/20">
        <div className="border-b border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">
                Objects in Active Location
              </h3>
              {includesDescendants && (
                <p className="mt-1 text-xs text-zinc-500">
                  Includes objects in this location and its child units
                </p>
              )}
            </div>
            <div className="text-xs text-zinc-500">
              {objects.length.toLocaleString()} objects
            </div>
          </div>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="border-b border-zinc-800 bg-zinc-900/30 text-zinc-500 font-medium">
            <tr>
              <th className="px-4 py-3">Accession Number</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {objects.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-zinc-600">
                  {includesDescendants
                    ? "No objects in this location or its child units"
                    : "No objects in this location"}
                </td>
              </tr>
            ) : (
              objects.map((object) => (
                <tr key={object._id} className="hover:bg-zinc-900/40">
                  <td className="px-4 py-3 font-mono text-zinc-400 align-top">
                    {object.accessionNumber ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-16 shrink-0">
                        <LocationObjectThumbnail
                          object={object}
                          className="rounded-lg"
                          imageClassName="aspect-square"
                          titleClassName="text-[11px]"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-zinc-200">
                          {object.title}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-400 capitalize align-top">
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
        className: "text-zinc-500",
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
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
            {unit.name}
          </div>
          <div className="mt-1 text-sm capitalize text-zinc-200">
            {unit.type}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-xs font-medium ${status.className}`}>
            {status.text}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            {objects.length} item{objects.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="mt-4">
        {objects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-800 px-3 py-6 text-center text-[11px] text-zinc-600">
            No assigned objects
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {objects.slice(0, 4).map((object) => (
              <LocationObjectThumbnail
                key={object._id}
                object={object}
                metadataLabel="Stored In"
                metadataValue={unit.name}
                className="rounded-xl"
                imageClassName="aspect-square"
                titleClassName="text-[11px]"
                showFooter
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
