"use client";

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
    accessionNumber?: string;
    title: string;
    status?: string;
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

      <div className="flex-1 border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/20">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-900/50 text-zinc-500 font-medium border-b border-zinc-800">
            <tr>
              <th className="px-4 py-3">Unit / Shelf</th>
              <th className="px-4 py-3">Classification</th>
              <th className="px-4 py-3">Occupancy</th>
              <th className="px-4 py-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {units.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-600">
                  No storage units found
                </td>
              </tr>
            ) : (
              units.map((unit) => <StorageUnitRow key={unit._id} unit={unit} />)
            )}
          </tbody>
        </table>
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
                  <td className="px-4 py-3 font-mono text-zinc-400">
                    {object.accessionNumber ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-200">{object.title}</td>
                  <td className="px-4 py-3 text-right text-zinc-400 capitalize">
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

interface StorageUnitRowProps {
  unit: StorageUnit;
}

function StorageUnitRow({ unit }: StorageUnitRowProps) {
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
    <tr className="hover:bg-zinc-900/40">
      <td className="px-4 py-3 font-mono text-zinc-400">{unit.name}</td>
      <td className="px-4 py-3 text-zinc-300 capitalize">{unit.type}</td>
      <td className="px-4 py-3 text-zinc-400">—</td>
      <td className={`px-4 py-3 text-right ${status.className}`}>
        {status.text}
      </td>
    </tr>
  );
}
