"use client";

import type { api } from "@v1/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Shield } from "lucide-react";
import { useI18n, useScopedI18n } from "@/locales/client";

type DetailsDoc = NonNullable<
  FunctionReturnType<typeof api.archiveDetails.get>
>;

interface ArchiveSecuritySectionProps {
  details: DetailsDoc;
}

export function ArchiveSecuritySection({
  details,
}: ArchiveSecuritySectionProps) {
  const tRoot = useI18n();
  const common = useScopedI18n("modules.common");

  return (
    <div>
      <h3 className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground">
        <Shield className="size-4 text-purple-500" />
        {tRoot("modules.archive.securityAccess")}
      </h3>

      <div className="rounded-lg border border-border/60 bg-secondary/20 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
              {tRoot("modules.archive.confidentialityLevel")}
            </div>
            <div className="text-sm font-medium text-foreground">
              {details.confidentialityLevel || "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
              {tRoot("modules.archive.legalHold")}
            </div>
            <div className="text-sm font-medium text-foreground">
              {details.legalHold ? common("yes") : common("no")}
            </div>
          </div>
        </div>
        {details.legalHoldReason ? (
          <div className="mt-4 pt-4 border-t border-border/40">
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
              {tRoot("modules.archive.legalHoldReason")}
            </div>
            <p className="text-sm text-muted-foreground">
              {details.legalHoldReason}
            </p>
          </div>
        ) : null}
        {details.accessRestrictions && details.accessRestrictions.length > 0 ? (
          <div className="mt-4 pt-4 border-t border-border/40">
            <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
              {tRoot("modules.archive.accessRestrictions")}
            </div>
            <div className="flex flex-wrap gap-2">
              {details.accessRestrictions.map((restriction) => (
                <span
                  key={restriction}
                  className="inline-flex rounded px-2 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-500"
                >
                  {restriction}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
