"use client";

interface Drawer {
  id: string;
  name: string;
  status: "active" | "warning" | "empty";
  contents?: string;
}

interface SecureDrawersProps {
  title: string;
  drawers: Drawer[];
}

export function SecureDrawers({ title, drawers }: SecureDrawersProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-4">
        {title}
      </h3>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
        <div className="flex-1 bg-zinc-950 p-1 space-y-1">
          {drawers.map((drawer) => (
            <DrawerItem key={drawer.id} drawer={drawer} />
          ))}
        </div>
        <div className="bg-zinc-950 border-t border-zinc-800 p-2 text-center">
          <button
            type="button"
            className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            View Manifest
          </button>
        </div>
      </div>
    </div>
  );
}

interface DrawerItemProps {
  drawer: Drawer;
}

function DrawerItem({ drawer }: DrawerItemProps) {
  const statusColors = {
    active: "bg-emerald-500",
    warning: "bg-red-500",
    empty: "bg-zinc-600",
  };

  const isEmpty = drawer.status === "empty";

  return (
    <div
      className={`h-10 rounded flex items-center px-3 justify-between transition-colors cursor-pointer group ${
        isEmpty
          ? "bg-zinc-900 border border-zinc-800/50 opacity-50"
          : "bg-zinc-800/50 border border-zinc-700/50 hover:bg-zinc-800"
      }`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`size-1.5 rounded-full ${statusColors[drawer.status]}`}
        />
        <span
          className={`text-xs font-mono ${isEmpty ? "text-zinc-500" : "text-zinc-300"}`}
        >
          {drawer.id.toUpperCase()}
        </span>
      </div>
      <span
        className={`text-[9px] ${isEmpty ? "text-zinc-600" : "text-zinc-500 group-hover:text-zinc-300"}`}
      >
        {drawer.contents || "Empty"}
      </span>
    </div>
  );
}
