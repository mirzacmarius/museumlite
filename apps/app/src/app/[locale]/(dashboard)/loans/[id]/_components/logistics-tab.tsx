"use client";

import { AlertTriangle, Box, Truck } from "lucide-react";

export function LogisticsTab() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Crate List */}
      <div className="lg:col-span-2 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Crating Plan
        </h3>
        {/* Crate 1 */}
        <div className="bg-card border border-border rounded-xl p-4 flex gap-4 items-center">
          <div className="w-16 h-16 bg-secondary rounded border border-border flex flex-col items-center justify-center shrink-0">
            <Box className="w-5 h-5 text-muted-foreground mb-1" />
            <span className="text-[10px] font-mono text-muted-foreground">
              #01
            </span>
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start mb-1">
              <h4 className="text-sm font-semibold text-foreground">
                Standard Painting Crate
              </h4>
              <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded border border-border">
                120x140x30 cm
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Contains: Pollock (NM.1952.001)
            </p>
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5" /> Shock Sensors
              </span>
              <span className="flex items-center gap-1">
                <Box className="w-2.5 h-2.5" /> Tyvek Lined
              </span>
            </div>
          </div>
        </div>
        {/* Crate 2 */}
        <div className="bg-card border border-border rounded-xl p-4 flex gap-4 items-center opacity-70">
          <div className="w-16 h-16 bg-secondary rounded border border-border flex flex-col items-center justify-center shrink-0 border-dashed">
            <span className="text-[10px] font-mono text-muted-foreground">
              #02
            </span>
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start mb-1">
              <h4 className="text-sm font-semibold text-foreground">
                Slotted Travel Frame
              </h4>
              <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded border border-border">
                Pending Size
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Contains: Rothko (NM.1955.084) + 2 others
            </p>
          </div>
          <button
            type="button"
            className="text-xs font-medium text-cyan-600 dark:text-cyan-500 hover:underline"
          >
            Configure
          </button>
        </div>
      </div>

      {/* Transport Agent */}
      <div className="bg-secondary/50 border border-border rounded-xl p-6">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          Transport Agent
        </h3>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-background rounded-lg flex items-center justify-center shadow-sm">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Dietl International
            </p>
            <p className="text-[10px] text-muted-foreground">
              Fine Art Shipping
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between text-xs border-b border-border pb-2">
            <span className="text-muted-foreground">Service Level</span>
            <span className="text-foreground">Tarmac Supervision</span>
          </div>
          <div className="flex justify-between text-xs border-b border-border pb-2">
            <span className="text-muted-foreground">Route</span>
            <span className="text-foreground">JFK &gt; LHR</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Courier</span>
            <span className="text-foreground">Elena Fisher (NM)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
