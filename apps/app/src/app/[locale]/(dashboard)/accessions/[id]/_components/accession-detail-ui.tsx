"use client";

import type { ReactNode } from "react";
import type { useI18n } from "@/locales/client";

type WorkflowStepInfo = {
  stepNumber: number;
  name: string;
  roleName?: string;
  approvalMode?: "single" | "multi" | "unanimous";
  requiredApprovals?: number;
};

export function formatAccessionMethodLabel(
  method: string,
  tRoot: ReturnType<typeof useI18n>,
): string {
  const knownMethods: Record<string, Parameters<typeof tRoot>[0]> = {
    purchase: "accessions.form.methods.purchase",
    gift: "accessions.form.methods.gift",
    loan: "accessions.form.methods.loan",
    transfer: "accessions.form.methods.transfer",
    donation: "accessions.form.methods.donation",
    bequest: "accessions.form.methods.bequest",
    other: "accessions.form.methods.other",
  };
  const key = knownMethods[method];
  return key ? tRoot(key) : method;
}

export function formatWorkflowStepDetails(
  step: WorkflowStepInfo,
  tRoot: ReturnType<typeof useI18n>,
) {
  const details: string[] = [];

  if (step.roleName) {
    details.push(
      tRoot("untranslatedRecords.accessions.workflow.approvalBy", {
        role: step.roleName,
      }),
    );
  }

  if (step.approvalMode === "multi" && step.requiredApprovals) {
    details.push(
      tRoot("untranslatedRecords.accessions.workflow.approvalsRequired", {
        count: step.requiredApprovals,
      }),
    );
  } else if (step.approvalMode === "unanimous") {
    details.push(tRoot("untranslatedRecords.accessions.workflow.unanimous"));
  }

  return details.length > 0
    ? details.join(" • ")
    : tRoot("untranslatedRecords.accessions.workflow.approvalStep");
}

export function SectionCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-background/70 p-5 shadow-sm sm:p-6">
      <div className="space-y-1">
        {eyebrow ? (
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function DetailField({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <div className="text-sm leading-6 text-foreground">{value}</div>
    </div>
  );
}

export function StatusTile({
  label,
  value,
  tone = "default",
  compact = false,
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "success" | "warning";
  compact?: boolean;
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-500/20 bg-emerald-500/5"
      : tone === "warning"
        ? "border-yellow-500/20 bg-yellow-500/5"
        : "border-border/60 bg-background/50";

  return (
    <div
      className={`rounded-xl border ${compact ? "p-3" : "p-4"} ${toneClass}`}
    >
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <div
        className={`font-medium text-foreground ${compact ? "mt-1 text-[15px] leading-5" : "mt-2 text-sm leading-6"}`}
      >
        {value}
      </div>
    </div>
  );
}
