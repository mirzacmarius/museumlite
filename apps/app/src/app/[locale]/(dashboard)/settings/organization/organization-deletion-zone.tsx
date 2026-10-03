"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@v1/ui/alert-dialog";
import { Button } from "@v1/ui/button";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Trash2, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDate } from "@/lib/format-date";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

interface OrganizationDeletionZoneProps {
  organizationId: Id<"organizations">;
  isSubOrganization: boolean;
}

interface TransferCandidate {
  userId: Id<"users">;
  name?: string;
  email?: string;
  roleName: string;
}

function getStatusMessage(
  status: string,
  labels: {
    gracePeriodMessage: string;
    awaitingFinalNoticeMessage: string;
    pendingPurgeMessage: string;
  },
  dates: {
    graceEndsAt: number;
    scheduledDeletionDate: number | null;
    scheduledPurgeAt: number | null;
  },
  locale: string,
) {
  if (status === "grace_period") {
    return labels.gracePeriodMessage.replace(
      "{date}",
      formatDate(new Date(dates.graceEndsAt), locale),
    );
  }
  if (status === "awaiting_final_notice") {
    return labels.awaitingFinalNoticeMessage;
  }
  if (status === "pending_purge" && dates.scheduledPurgeAt) {
    return labels.pendingPurgeMessage.replace(
      "{date}",
      formatDate(new Date(dates.scheduledPurgeAt), locale),
    );
  }
  return null;
}

export function OrganizationDeletionZone({
  organizationId,
  isSubOrganization,
}: OrganizationDeletionZoneProps) {
  const locale = useCurrentLocale();
  const t = useScopedI18n("settings.organization.deletion");

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("");

  const deletionStatus = useQuery(api.organizationDeletion.getDeletionStatus, {
    organizationId,
  });
  const transferCandidates = useQuery(
    api.organizationDeletion.listTransferCandidates,
    { organizationId },
  );

  const requestDeletion = useMutation(api.organizationDeletion.requestDeletion);
  const cancelDeletion = useMutation(api.organizationDeletion.cancelDeletion);
  const transferOwnership = useMutation(
    api.organizationDeletion.transferOwnership,
  );

  const statusMessage = useMemo(() => {
    if (!deletionStatus) {
      return null;
    }
    return getStatusMessage(
      deletionStatus.status,
      {
        gracePeriodMessage: t("gracePeriodMessage"),
        awaitingFinalNoticeMessage: t("awaitingFinalNoticeMessage"),
        pendingPurgeMessage: t("pendingPurgeMessage"),
      },
      deletionStatus,
      locale,
    );
  }, [deletionStatus, locale, t]);

  if (isSubOrganization) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          {t("subOrganizationBlocked")}
        </p>
      </div>
    );
  }

  const handleRequestDeletion = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await requestDeletion({ organizationId });
    } catch {
      setError(t("requestError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelDeletion = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await cancelDeletion({ organizationId });
    } catch {
      setError(t("cancelError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransferOwnership = async () => {
    if (!selectedOwnerId) {
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await transferOwnership({
        organizationId,
        newOwnerUserId: selectedOwnerId as Id<"users">,
      });
      setSelectedOwnerId("");
    } catch {
      setError(t("transferError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-8 border-t border-border pt-8">
      <h3 className="mb-4 text-lg font-medium text-destructive">
        {t("dangerZone")}
      </h3>

      {error ? (
        <div className="mb-4 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {deletionStatus ? (
        <div className="mb-4 space-y-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div className="space-y-1">
              <p className="font-medium">{t("activeTitle")}</p>
              {statusMessage ? (
                <p className="text-sm text-muted-foreground">{statusMessage}</p>
              ) : null}
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={isSubmitting}>
                {isSubmitting ? t("cancelling") : t("cancelButton")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("cancelDialog.title")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("cancelDialog.description")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>
                  {t("cancelDialog.cancel")}
                </AlertDialogCancel>
                <AlertDialogAction onClick={handleCancelDeletion}>
                  {t("cancelDialog.confirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="space-y-3 border-t border-destructive/20 pt-4">
            <div className="flex items-center gap-2">
              <UserRound className="size-4 text-muted-foreground" />
              <p className="font-medium">{t("transferTitle")}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("transferDescription")}
            </p>
            <div className="space-y-2">
              <Label>{t("transferCandidateLabel")}</Label>
              <Select
                value={selectedOwnerId}
                onValueChange={setSelectedOwnerId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("transferCandidatePlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {(transferCandidates ?? []).map(
                    (candidate: TransferCandidate) => (
                      <SelectItem
                        key={candidate.userId}
                        value={candidate.userId}
                      >
                        {candidate.name ?? candidate.email ?? candidate.userId}
                        {candidate.roleName ? ` (${candidate.roleName})` : ""}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={!selectedOwnerId || isSubmitting}
              onClick={handleTransferOwnership}
            >
              {isSubmitting ? t("transferring") : t("transferButton")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-medium">{t("title")}</p>
              <p className="text-sm text-muted-foreground">
                {t("description")}
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isSubmitting}>
                  <Trash2 className="mr-2 size-4" />
                  {isSubmitting ? t("requesting") : t("requestButton")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("confirmDialog.title")}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("confirmDialog.description")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    {t("confirmDialog.cancel")}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleRequestDeletion}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {t("confirmDialog.confirm")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </div>
  );
}
