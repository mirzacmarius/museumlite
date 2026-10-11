"use client";

import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  RecordRecoveryState,
  useBackToResultsLink,
} from "@/components/record-recovery-state";
import { useReproductionErrorMessage } from "@/hooks/use-reproduction-error-message";
import { useRecordViewState } from "@/hooks/use-return-path";
import { useScopedI18n } from "@/locales/client";
import {
  RequestStatusBadge,
  useRequestDate,
} from "../../_components/request-status";
import { DecisionSection } from "./decision-section";
import { DeliverySection } from "./delivery-section";
import { DerivativeSection } from "./derivative-section";
import { EvidenceSection } from "./evidence-section";
import { ReasonDialog } from "./reason-dialog";
import type { RequestView } from "./request-view";
import { RightsFields } from "./rights-fields";
import { Field, Section } from "./section";

function RequestDetail({ view }: { view: RequestView }) {
  const t = useScopedI18n("reproductionRequests");
  const back = useBackToResultsLink("reproductionRequests");
  const formatDate = useRequestDate();
  const errorMessage = useReproductionErrorMessage();
  const withdraw = useMutation(api.reproductionRequests.withdraw);
  const [withdrawing, setWithdrawing] = useState(false);
  const { request } = view;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="space-y-2">
        <Link
          href={back.href}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {back.fromResults ? back.label : t("detail.back")}
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-lg font-semibold">
                {request.requestNumber}
              </h1>
              <RequestStatusBadge status={request.status} />
            </div>
            <p className="break-words text-sm text-muted-foreground">
              {request.requester.name}
              {request.object.label ? ` · ${request.object.label}` : null}
            </p>
          </div>
          {request.status === "open" && view.commands.canPrepare ? (
            <Button variant="outline" onClick={() => setWithdrawing(true)}>
              {t("detail.withdraw")}
            </Button>
          ) : null}
        </div>
      </div>

      <Section id="request-title" title={t("detail.requestTitle")}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label={t("detail.requester")}>
            <Link
              href={`/accounts/${request.requester.accountId}`}
              className="underline underline-offset-2"
            >
              {request.requester.name}
            </Link>
          </Field>
          <Field label={t("detail.email")}>{request.requester.email}</Field>
          <Field label={t("detail.object")}>
            {request.object.available ? (
              <Link
                href={`/objects/${request.object._id}`}
                className="inline-flex items-center gap-1 underline underline-offset-2"
              >
                {request.object.label}
                <ExternalLink className="size-3" />
              </Link>
            ) : (
              request.object.label || t("detail.notRecorded")
            )}
          </Field>
          <Field label={t("detail.image")}>
            {request.media.available
              ? request.media.fileName
              : t("detail.imageUnavailable")}
          </Field>
          <Field label={t("detail.purpose")}>
            {t(`purposes.${request.purpose}`)}
          </Field>
          <Field label={t("detail.language")}>
            {t(`locales.${request.requesterLocale}`)}
          </Field>
          <div className="sm:col-span-2">
            <Field label={t("create.purposeDetails")}>
              {request.purposeDetails}
            </Field>
          </div>
          <Field label={t("detail.received")}>
            {formatDate(request.createdAt)}
          </Field>
          {request.closeReason ? (
            <Field label={t("detail.closeReason")}>{request.closeReason}</Field>
          ) : null}
        </dl>
      </Section>

      <Section
        id="rights-title"
        title={t("detail.rightsTitle")}
        description={t("detail.rightsDescription")}
      >
        <RightsFields rights={request.media} />
      </Section>

      <EvidenceSection view={view} />
      <DerivativeSection view={view} />
      <DecisionSection view={view} />
      <DeliverySection view={view} />

      {withdrawing ? (
        <ReasonDialog
          title={t("detail.withdrawTitle")}
          description={t("detail.withdrawDescription")}
          confirmLabel={t("detail.withdraw")}
          onClose={() => setWithdrawing(false)}
          onConfirm={async (reason) => {
            try {
              await withdraw({ requestId: request._id, reason });
              toast.success(t("detail.withdrawn"));
              return true;
            } catch (error) {
              toast.error(errorMessage(error));
              return false;
            }
          }}
        />
      ) : null}
    </div>
  );
}

export function RequestDetailClient({ requestId }: { requestId: string }) {
  const view = useQuery(api.reproductionRequests.get, { requestId });
  const viewState = useRecordViewState(view);

  if (view === undefined)
    return (
      <div className="flex size-full items-center justify-center">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted/60" />
      </div>
    );
  if (view === null)
    return (
      <RecordRecoveryState
        kind={viewState === "removed" ? "removed" : "missing"}
        list="reproductionRequests"
      />
    );
  return <RequestDetail view={view} />;
}
