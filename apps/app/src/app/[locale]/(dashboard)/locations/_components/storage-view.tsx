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
}

export function StorageView({
  units,
  totalObjects,
  capacity,
  lastAuditDate,
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
