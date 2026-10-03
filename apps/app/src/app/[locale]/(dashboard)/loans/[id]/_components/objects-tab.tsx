"use client";

import { Button } from "@v1/ui/button";
import { Box, Search } from "lucide-react";
import { PermissionGate } from "@/components/permission-gate";
import { useI18n, useScopedI18n } from "@/locales/client";
import type { Loan } from "./types";

interface ObjectsTabProps {
  loan: Loan;
}

export function ObjectsTab({ loan }: ObjectsTabProps) {
  const tRoot = useI18n();
  const t = useScopedI18n("loans.placeholders");
  const tActions = useScopedI18n("loans.actions");

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="size-4 text-muted-foreground group-focus-within:text-cyan-500 transition-colors" />
            </div>
            <input
              type="text"
              className="bg-background border border-border text-foreground text-xs rounded-lg block w-64 pl-10 p-2 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
              placeholder={t("searchAccession")}
            />
          </div>
        </div>
        <PermissionGate permission="loans.update">
          <div className="flex gap-2">
            <Button variant="default" size="sm" className="h-8 text-xs">
              {tRoot("loans.actions.addObject")}
            </Button>
          </div>
        </PermissionGate>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loan.items.length > 0 ? (
          loan.items.map((item) => (
            <div
              key={item.accessionNumber}
              className="bg-card border border-border rounded-xl overflow-hidden hover:border-foreground/20 transition-colors group"
            >
              <div className="h-40 bg-secondary relative overflow-hidden flex items-center justify-center">
                <Box className="size-10 text-muted-foreground/30" />
                <div className="absolute top-2 right-2 px-2 py-1 bg-zinc-950/50 backdrop-blur-md rounded text-[10px] font-mono text-white">
                  {item.accessionNumber}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-foreground truncate">
                  {item.title}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {tRoot("loans.actions.artistUnknown")}
                </p>

                <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground font-medium">
                      {tRoot("loans.actions.conditionOut")}
                    </p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-emerald-500" />{" "}
                      {item.conditionOut || tActions("stable")}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground font-medium">
                      {tRoot("loans.table.status")}
                    </p>
                    {item.conditionIn ? (
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-blue-500" />{" "}
                        {tRoot("loans.status.returned")}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-600 dark:text-amber-500 font-medium flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-amber-500" />{" "}
                        {tRoot("loans.actions.onLoan")}
                      </p>
                    )}
                  </div>
                </div>
                {item.conditionIn && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <p className="text-[10px] uppercase text-muted-foreground font-medium">
                      {tRoot("loans.actions.conditionIn")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.conditionIn}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-muted-foreground text-sm">
            {tRoot("loans.actions.noObjectsInLoan")}
          </div>
        )}
      </div>
    </>
  );
}
