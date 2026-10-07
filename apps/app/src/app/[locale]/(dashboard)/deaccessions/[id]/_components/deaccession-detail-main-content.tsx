"use client";

import { DeaccessionDetailHeroSection } from "./deaccession-detail-hero-section";
import { DeaccessionDetailReviewPanel } from "./deaccession-detail-review-panel";
import { DeaccessionDetailToolbar } from "./deaccession-detail-toolbar";
import type { DeaccessionDetailViewProps } from "./deaccession-detail-view-props";
import { DeaccessionDetailWorkflowHistory } from "./deaccession-detail-workflow-history";
import { DisposalStagesSection } from "./disposal-stages-section";

export function DeaccessionDetailMainContent(
  props: DeaccessionDetailViewProps,
) {
  return (
    <main className="flex h-full min-h-0 w-full flex-col bg-background">
      <div className="flex-1 overflow-y-auto px-6">
        <div className="mx-auto min-h-full w-full max-w-[1440px] py-6">
          <DeaccessionDetailToolbar {...props} />
          <div className="space-y-4">
            <section className="overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-[0_18px_48px_rgba(0,0,0,0.12)]">
              <DeaccessionDetailHeroSection {...props} />
              <DeaccessionDetailReviewPanel {...props} />
            </section>
            <DisposalStagesSection
              deaccession={props.deaccession}
              locale={props.locale}
            />
            <DeaccessionDetailWorkflowHistory {...props} />
          </div>
        </div>
      </div>
    </main>
  );
}
