"use client";

import type { ReactNode } from "react";

type WorkflowStepInfo = {
  stepNumber: number;
  name: string;
  roleName?: string;
  approvalMode?: "single" | "multi" | "unanimous";
  requiredApprovals?: number;
};

export function formatWorkflowStepDetails(step: WorkflowStepInfo) {
  const details: string[] = [];

  if (step.roleName) {
    details.push(`Approval by ${step.roleName}`);
  }

  if (step.approvalMode === "multi" && step.requiredApprovals) {
    details.push(`${step.requiredApprovals} approvals required`);
  } else if (step.approvalMode === "unanimous") {
    details.push("All approvers must approve");
  }

  return details.length > 0 ? details.join(" • ") : "Approval step";
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
