"use client";

import { Button } from "@v1/ui/button";
import { AlertCircle, LayoutGrid, Shield } from "lucide-react";

export function FacilityTab() {
  return (
    <div className="space-y-6">
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 flex gap-4 items-start">
        <AlertCircle className="shrink-0 text-amber-600 dark:text-amber-500 w-5 h-5 mt-0.5" />
        <div>
          <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-500">
            Review Required
          </h4>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
            The environmental readings from MoMA Gallery 4 show slight humidity
            fluctuations (45% ± 4%). Conservation approval is pending.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto text-xs bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-100 border-transparent hover:bg-amber-200 dark:hover:bg-amber-800"
        >
          Review Logs
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Environment Stats */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
            <LayoutGrid className="w-3.5 h-3.5 text-cyan-500" />
            Climate Control (Gallery 4)
          </h3>
          <div className="space-y-6">
            {/* Temperature */}
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-muted-foreground">Temperature</span>
                <span className="text-foreground font-mono">20.5°C</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-[60%] rounded-full" />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1 font-mono">
                <span>15°C</span>
                <span>Target: 21°C</span>
                <span>25°C</span>
              </div>
            </div>

            {/* Humidity */}
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-muted-foreground">Relative Humidity</span>
                <span className="text-amber-600 dark:text-amber-500 font-mono">
                  49%
                </span>
              </div>
              <div className="relative pt-1">
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 w-[70%] rounded-full" />
                </div>
                {/* Markers for safe zone */}
                <div className="absolute top-0 bottom-0 left-[45%] w-[10%] bg-emerald-500/10 border-x border-emerald-500/30" />
              </div>
              <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-1 text-right">
                Deviating slightly (+4%)
              </p>
            </div>

            {/* Lux */}
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-muted-foreground">Light Level (Lux)</span>
                <span className="text-foreground font-mono">45 lx</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-[20%] rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Security Info */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-red-500" />
            Security & Access
          </h3>
          <ul className="space-y-4">
            <li className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">24/7 Guard Presence</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                Confirmed
              </span>
            </li>
            <li className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">CCTV Coverage</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                100% Gallery 4
              </span>
            </li>
            <li className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Fire Suppression</span>
              <span className="text-foreground">Dry Pipe / Pre-action</span>
            </li>
            <li className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Display Cases</span>
              <span className="text-foreground">Acrylic, Alarmed</span>
            </li>
          </ul>
          <div className="mt-6 p-3 bg-secondary rounded border border-border">
            <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">
              Registrar Note
            </p>
            <p className="text-xs italic text-muted-foreground">
              "MoMA has retrofitted Gallery 4 with new vibration sensors in Q3
              2023. Approved for high-value loans."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
