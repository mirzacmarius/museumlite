"use client";

interface StorageUnit {
  id: string;
  classification: string;
  occupancy: string;
  status: "accessible" | "locked" | "restricted" | "holding";
}

interface StorageUnitsTableProps {
  units: StorageUnit[];
}

export function StorageUnitsTable({ units }: StorageUnitsTableProps) {
  const statusColors = {
    accessible: "text-emerald-400",
    locked: "text-amber-500",
    restricted: "text-rose-500",
    holding: "text-zinc-500",
  };

  return (
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
          {units.map((unit) => (
            <tr
              key={unit.id}
              className="hover:bg-zinc-900/40 transition-colors"
            >
              <td className="px-4 py-3 font-mono text-zinc-400">{unit.id}</td>
              <td className="px-4 py-3 text-zinc-300">{unit.classification}</td>
              <td className="px-4 py-3 text-zinc-400">{unit.occupancy}</td>
              <td className="px-4 py-3 text-right">
                <span className={statusColors[unit.status]}>
                  {unit.status.charAt(0).toUpperCase() + unit.status.slice(1)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
