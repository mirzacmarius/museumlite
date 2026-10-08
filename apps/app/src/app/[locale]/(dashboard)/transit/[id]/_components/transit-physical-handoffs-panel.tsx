"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { PackageCheck, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useReducer, useState } from "react";
import { AcceptedConditionAssessmentSelector } from "@/components/accepted-condition-assessment-selector";
import { LocationSelector } from "@/components/location-selector";
import { usePermissions } from "@/components/permission-gate";
import { useCustodyConflictMessage } from "@/hooks/use-custody-conflict-message";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

type TransitHandoffItem = FunctionReturnType<
  typeof api.transit.getTransitHandoffSummary
>["items"][number];
type InstallationTask = FunctionReturnType<
  typeof api.installations.listTasks
>[number];
type RunTransitAction = (
  transitItemId: Id<"transitItems">,
  action: () => Promise<unknown>,
) => Promise<void>;

interface TransitPhysicalHandoffsPanelProps {
  transitRecordId: Id<"transitRecords">;
  organizationId: Id<"organizations">;
  defaultDestinationLocationId?: Id<"locations">;
  linkedExhibitionId?: Id<"exhibitions">;
}

interface TransitHandoffDraft {
  observedFrom: string;
  destination?: string;
  installationDestination: string;
  condition: string;
  assessmentId: string;
  taskId: string;
}

interface TransitHandoffDraftAction {
  field: keyof TransitHandoffDraft;
  value: string;
}

const initialTransitHandoffDraft: TransitHandoffDraft = {
  observedFrom: "__none__",
  installationDestination: "",
  condition: "",
  assessmentId: "",
  taskId: "",
};

function transitHandoffDraftReducer(
  state: TransitHandoffDraft,
  action: TransitHandoffDraftAction,
): TransitHandoffDraft {
  return { ...state, [action.field]: action.value };
}

function toObservedLocationId(value: string): Id<"locations"> | null {
  if (!value || value === "__none__") {
    return null;
  }
  return value as Id<"locations">;
}

export function TransitPhysicalHandoffsPanel({
  transitRecordId,
  organizationId,
  defaultDestinationLocationId,
  linkedExhibitionId,
}: TransitPhysicalHandoffsPanelProps) {
  const t = useScopedI18n("untranslatedDashboard.transit.handoffs");
  const { hasFeature } = useFeatureAccess();
  const { hasPermission } = usePermissions();
  const canInstall = hasPermission("collections.update");

  const summary = useQuery(api.transit.getTransitHandoffSummary, {
    transitRecordId,
  });

  const tasks = useQuery(
    api.installations.listTasks,
    linkedExhibitionId &&
      canInstall &&
      hasPermission("collections.read") &&
      hasFeature("installations")
      ? { organizationId, exhibitionId: linkedExhibitionId }
      : "skip",
  );

  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const custodyConflictMessage = useCustodyConflictMessage();

  if (summary === undefined) {
    return (
      <div className="rounded-xl border border-border bg-muted/20 p-6">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (summary.itemCount === 0) {
    return null;
  }

  async function runAction(
    transitItemId: Id<"transitItems">,
    action: () => Promise<unknown>,
  ) {
    setError("");
    setBusyItemId(transitItemId);
    try {
      await action();
    } catch (cause) {
      setError(custodyConflictMessage(cause));
    } finally {
      setBusyItemId(null);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          <PackageCheck className="size-4" />
          {t("title")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t("outstandingReceipt", { count: summary.outstandingReceiptCount })}
          {linkedExhibitionId
            ? ` · ${t("outstandingInstallation", {
                count: summary.outstandingInstallationCount,
              })}`
            : ""}
        </p>
      </div>

      {error ? (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="space-y-4">
        {summary.items.map((item) => (
          <TransitHandoffItemRow
            key={item.transitItemId}
            item={item}
            organizationId={organizationId}
            defaultDestinationLocationId={defaultDestinationLocationId}
            linkedExhibitionId={linkedExhibitionId}
            tasks={tasks}
            busy={busyItemId === item.transitItemId}
            runAction={runAction}
          />
        ))}
      </ul>
    </div>
  );
}

function TransitHandoffItemRow({
  item,
  organizationId,
  defaultDestinationLocationId,
  linkedExhibitionId,
  tasks,
  busy,
  runAction,
}: {
  item: TransitHandoffItem;
  organizationId: Id<"organizations">;
  defaultDestinationLocationId?: Id<"locations">;
  linkedExhibitionId?: Id<"exhibitions">;
  tasks: InstallationTask[] | undefined;
  busy: boolean;
  runAction: RunTransitAction;
}) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("untranslatedDashboard.transit.handoffs");
  const { hasPermission } = usePermissions();
  const canUpdateTransit = hasPermission("loans.update");
  const canInstall = hasPermission("collections.update");
  const markArrived = useMutation(api.transit.markTransitItemCarrierArrived);
  const [draft, dispatch] = useReducer(
    transitHandoffDraftReducer,
    initialTransitHandoffDraft,
  );
  const label = item.accessionNumber ?? item.title ?? item.collectionId;

  return (
    <li className="rounded-lg border border-border/60 bg-background/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">
            {t(`itemStatus.${item.status}`)}
            {item.receiptMovementId ? ` · ${t("receiptRecorded")}` : ""}
            {item.installationMovementId
              ? ` · ${t("installationRecorded")}`
              : ""}
          </p>
          <Link
            href={`/${locale}/objects/${item.collectionId}`}
            className="mt-1 inline-block text-xs text-primary hover:underline"
          >
            {t("viewObject")}
          </Link>
        </div>
      </div>

      {canUpdateTransit || canInstall ? (
        <div className="mt-4 space-y-3 border-t border-border/40 pt-4">
          {canUpdateTransit &&
          item.status !== "arrived" &&
          item.status !== "received" &&
          item.status !== "missing" &&
          item.status !== "damaged" ? (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                runAction(item.transitItemId, () =>
                  markArrived({ transitItemId: item.transitItemId }),
                )
              }
            >
              {busy ? <RefreshCw className="mr-2 size-3 animate-spin" /> : null}
              {t("markCarrierArrived")}
            </Button>
          ) : null}

          {canUpdateTransit &&
          (item.status === "arrived" ||
            item.status === "in_transit" ||
            item.status === "delivered") ? (
            <TransitReceiptForm
              item={item}
              organizationId={organizationId}
              defaultDestinationLocationId={defaultDestinationLocationId}
              busy={busy}
              draft={draft}
              dispatch={dispatch}
              runAction={runAction}
            />
          ) : null}

          {linkedExhibitionId &&
          canInstall &&
          item.status === "received" &&
          !item.installedAt ? (
            <TransitInstallationForm
              item={item}
              organizationId={organizationId}
              tasks={tasks}
              busy={busy}
              draft={draft}
              dispatch={dispatch}
              runAction={runAction}
            />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function TransitReceiptForm({
  item,
  organizationId,
  defaultDestinationLocationId,
  busy,
  draft,
  dispatch,
  runAction,
}: {
  item: TransitHandoffItem;
  organizationId: Id<"organizations">;
  defaultDestinationLocationId?: Id<"locations">;
  busy: boolean;
  draft: TransitHandoffDraft;
  dispatch: (action: TransitHandoffDraftAction) => void;
  runAction: RunTransitAction;
}) {
  const t = useScopedI18n("untranslatedDashboard.transit.handoffs");
  const { hasPermission } = usePermissions();
  const recordReceipt = useMutation(api.transit.recordTransitItemReceipt);
  const { observedFrom, condition, assessmentId } = draft;
  const destination = draft.destination ?? defaultDestinationLocationId ?? "";

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          {t("observedFrom")}
        </Label>
        <LocationSelector
          organizationId={organizationId}
          value={observedFrom}
          onValueChange={(value) => dispatch({ field: "observedFrom", value })}
          allowNone
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          {t("receiptDestination")}
        </Label>
        <LocationSelector
          organizationId={organizationId}
          value={destination}
          onValueChange={(value) => dispatch({ field: "destination", value })}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          {t("conditionNotes")}
        </Label>
        <Input
          value={condition}
          onChange={(event) =>
            dispatch({ field: "condition", value: event.target.value })
          }
          placeholder={t("conditionPlaceholder")}
          className="text-xs"
        />
      </div>
      {hasPermission("collections.read") ? (
        <AcceptedConditionAssessmentSelector
          collectionId={item.collectionId}
          value={assessmentId}
          onValueChange={(value) => dispatch({ field: "assessmentId", value })}
          disabled={busy}
        />
      ) : null}
      <Button
        size="sm"
        disabled={busy || !destination || (!condition.trim() && !assessmentId)}
        onClick={() =>
          runAction(item.transitItemId, () =>
            recordReceipt({
              transitItemId: item.transitItemId,
              observedFromLocationId: toObservedLocationId(observedFrom),
              destinationLocationId: destination as Id<"locations">,
              conditionIn: condition || undefined,
              conditionAssessmentId: assessmentId
                ? (assessmentId as Id<"conditionAssessments">)
                : undefined,
            }),
          )
        }
      >
        {busy ? <RefreshCw className="mr-2 size-3 animate-spin" /> : null}
        {t("recordReceipt")}
      </Button>
    </div>
  );
}

function TransitInstallationForm({
  item,
  organizationId,
  tasks,
  busy,
  draft,
  dispatch,
  runAction,
}: {
  item: TransitHandoffItem;
  organizationId: Id<"organizations">;
  tasks: InstallationTask[] | undefined;
  busy: boolean;
  draft: TransitHandoffDraft;
  dispatch: (action: TransitHandoffDraftAction) => void;
  runAction: RunTransitAction;
}) {
  const t = useScopedI18n("untranslatedDashboard.transit.handoffs");
  const evidenceT = useScopedI18n("conditionAssessments");
  const recordInstallation = useMutation(
    api.transit.recordTransitItemInstallation,
  );
  const { observedFrom, installationDestination, assessmentId, taskId } = draft;
  const openTasks: InstallationTask[] = [];
  for (const task of tasks ?? []) {
    if (task.status !== "completed") {
      openTasks.push(task);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          {t("installationDestination")}
        </Label>
        <LocationSelector
          organizationId={organizationId}
          value={installationDestination}
          onValueChange={(value) =>
            dispatch({ field: "installationDestination", value })
          }
          allowNone={false}
        />
      </div>
      <Label>{t("observedFrom")}</Label>
      <LocationSelector
        organizationId={organizationId}
        value={observedFrom}
        onValueChange={(value) => dispatch({ field: "observedFrom", value })}
        allowNone
      />
      <AcceptedConditionAssessmentSelector
        collectionId={item.collectionId}
        value={assessmentId}
        onValueChange={(value) => dispatch({ field: "assessmentId", value })}
        disabled={busy}
      />
      {tasks ? (
        <select
          aria-label={evidenceT("installationTask")}
          value={taskId}
          onChange={(event) =>
            dispatch({ field: "taskId", value: event.target.value })
          }
          className="w-full rounded-md border border-border bg-background p-2 text-sm"
          disabled={busy}
        >
          <option value="">{evidenceT("installationTask")}</option>
          {openTasks.map((task) => (
            <option key={task._id} value={task._id}>
              {task.title}
            </option>
          ))}
        </select>
      ) : null}
      <Button
        size="sm"
        className="mt-2"
        disabled={
          busy ||
          !assessmentId ||
          !installationDestination ||
          installationDestination === "__none__"
        }
        onClick={() =>
          runAction(item.transitItemId, () =>
            recordInstallation({
              exhibitionLocationId: installationDestination as Id<"locations">,
              installationConditionAssessmentId:
                assessmentId as Id<"conditionAssessments">,
              installationTaskId: taskId
                ? (taskId as Id<"installationTasks">)
                : undefined,
              transitItemId: item.transitItemId,
              observedFromLocationId: toObservedLocationId(observedFrom),
            }),
          )
        }
      >
        {busy ? <RefreshCw className="mr-2 size-3 animate-spin" /> : null}
        {t("recordInstallation")}
      </Button>
    </div>
  );
}
