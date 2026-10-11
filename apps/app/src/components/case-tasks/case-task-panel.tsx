"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { CaseTaskCaseType } from "@v1/backend/convex/utils/caseTaskValidators";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import { ListChecks, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { useScopedI18n } from "@/locales/client";
import { CaseTaskCard } from "./case-task-card";
import { CreateTaskDialog } from "./case-task-dialogs";
import {
  type PreparationCaseType,
  PreparationSummary,
} from "./preparation-summary";

function isPreparationCase(
  caseType: CaseTaskCaseType,
): caseType is PreparationCaseType {
  return (
    caseType === "accession" ||
    caseType === "loan" ||
    caseType === "exhibition" ||
    caseType === "incident"
  );
}

/** Accountable tasks for one case, shown on its detail page. */
export function CaseTaskPanel({
  organizationId,
  caseType,
  caseId,
}: {
  organizationId: Id<"organizations">;
  caseType: CaseTaskCaseType;
  caseId: string;
}) {
  const t = useScopedI18n("caseTasks");
  const view = useQuery(api.caseTasks.listForCase, {
    organizationId,
    caseType,
    caseId,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [now] = useState(() => Date.now());
  const caseRef = { organizationId, caseType, caseId };

  return (
    <section
      className="space-y-4 rounded-xl border border-border bg-card p-6"
      aria-labelledby={`case-tasks-${caseId}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListChecks className="size-4 text-muted-foreground" />
          <h3
            id={`case-tasks-${caseId}`}
            className="text-lg font-medium text-foreground"
          >
            {t("panel.title")}
          </h3>
        </div>
        {view?.canManage ? (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 size-4" />
            {t("panel.add")}
          </Button>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">{t("panel.description")}</p>
      {isPreparationCase(caseType) ? (
        <PreparationSummary
          organizationId={organizationId}
          caseType={caseType}
          caseId={caseId}
        />
      ) : null}

      {view === undefined ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("panel.loading")}
        </div>
      ) : view.tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("panel.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {view.tasks.map((task) => (
            <CaseTaskCard
              key={task._id}
              task={task}
              organizationId={organizationId}
              canManage={view.canManage}
              showCaseLink={false}
              now={now}
            />
          ))}
        </ul>
      )}
      {view && !view.canManage ? (
        <p className="text-xs text-muted-foreground">{t("panel.readOnly")}</p>
      ) : null}

      {view?.canManage && createOpen ? (
        <CreateTaskDialog
          caseRef={caseRef}
          open={createOpen}
          onOpenChange={setCreateOpen}
          dependencyOptions={view.tasks.flatMap((task) =>
            task.status === "done" || task.status === "cancelled"
              ? []
              : [{ _id: task._id, title: task.title }],
          )}
        />
      ) : null}
    </section>
  );
}
