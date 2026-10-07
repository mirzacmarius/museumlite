"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Doc } from "@v1/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useScopedI18n } from "@/locales/client";
import { DisposalDecisionStage } from "./disposal-decision-stage";
import { DisposalExitStage } from "./disposal-exit-stage";
import { DisposalProceedsStage } from "./disposal-proceeds-stage";

export function DisposalStagesSection({
  deaccession,
  locale,
}: {
  deaccession: Doc<"deaccessions">;
  locale: string;
}) {
  const t = useScopedI18n("deaccessions.stages");
  const stages = useQuery(api.deaccessions.getDisposalStages, {
    deaccessionId: deaccession._id,
  });

  if (!stages) return null;

  return (
    <section className="rounded-[20px] border border-border/70 bg-card p-5 shadow-[0_14px_36px_rgba(0,0,0,0.1)]">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/65">
        {t("eyebrow")}
      </p>
      <h2 className="mt-1 text-lg font-semibold">{t("title")}</h2>
      {stages.appliesToDisposal ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <DisposalDecisionStage
            deaccession={deaccession}
            stages={stages}
            locale={locale}
          />
          <DisposalExitStage
            deaccessionId={deaccession._id}
            exit={stages.exit}
            locale={locale}
          />
          <DisposalProceedsStage
            deaccessionId={deaccession._id}
            proceeds={stages.proceeds}
            locale={locale}
          />
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {t("withdrawalNotice")}
        </p>
      )}
    </section>
  );
}
