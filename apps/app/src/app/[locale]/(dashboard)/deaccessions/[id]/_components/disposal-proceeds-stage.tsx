"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { DatePicker } from "@v1/ui/date-picker";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ClientDateFns } from "@/components/client-date";
import { usePermissions } from "@/components/permission-gate";
import { formatCurrency } from "@/lib/format-number";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { disposalStageErrorMessage } from "./disposal-stage-error";

type ProceedsStage = NonNullable<
  FunctionReturnType<typeof api.deaccessions.getDisposalStages>
>["proceeds"];

export function DisposalProceedsStage({
  deaccessionId,
  proceeds,
  locale,
}: {
  deaccessionId: Id<"deaccessions">;
  proceeds: ProceedsStage;
  locale: string;
}) {
  const t = useScopedI18n("deaccessions.stages");
  const currentLocale = useCurrentLocale();
  const { hasPermission } = usePermissions();
  const [isEditing, setIsEditing] = useState(false);
  const canEdit =
    (proceeds.state === "outstanding" || proceeds.state === "recorded") &&
    hasPermission("collections.update");
  const isRecorded =
    proceeds.state === "recorded" || proceeds.state === "verified";

  return (
    <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
      <h3 className="text-sm font-semibold">{t("proceeds.title")}</h3>
      {proceeds.state === "not_applicable" ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {t("proceeds.notApplicable")}
        </p>
      ) : proceeds.state === "awaiting_decision" ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {t("awaitingDecision")}
        </p>
      ) : isRecorded && !isEditing ? (
        <dl className="mt-2 space-y-1 text-sm">
          {proceeds.amount !== undefined && proceeds.currency ? (
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("proceeds.amount")}
              </dt>
              <dd>
                {formatCurrency(
                  proceeds.amount,
                  currentLocale,
                  proceeds.currency,
                )}
              </dd>
            </div>
          ) : null}
          {proceeds.recipient ? (
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("proceeds.paidBy")}
              </dt>
              <dd>{proceeds.recipient}</dd>
            </div>
          ) : null}
          {proceeds.date ? (
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("proceeds.date")}
              </dt>
              <dd>
                <ClientDateFns
                  timestamp={proceeds.date}
                  format="MMM d, yyyy"
                  locale={locale}
                />
              </dd>
            </div>
          ) : null}
          <p className="pt-1 text-xs text-muted-foreground">
            {proceeds.hasReceipt
              ? t("proceeds.receiptAttached")
              : t("proceeds.receiptMissing")}
          </p>
          {proceeds.verifiedAt ? (
            <p className="text-xs text-muted-foreground">
              {t("proceeds.verifiedOn")}{" "}
              <ClientDateFns
                timestamp={proceeds.verifiedAt}
                format="MMM d, yyyy"
                locale={locale}
              />
            </p>
          ) : null}
          {proceeds.verificationExceptionReason ? (
            <div className="mt-2 rounded-xl border border-border/60 p-3">
              <p className="text-xs text-muted-foreground">
                {t("proceeds.exceptionReason")}
              </p>
              <p className="mt-1 whitespace-pre-wrap">
                {proceeds.verificationExceptionReason}
              </p>
            </div>
          ) : null}
        </dl>
      ) : !isEditing ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {t("proceeds.outstanding")}
        </p>
      ) : null}

      {canEdit && isEditing ? (
        <ProceedsForm
          deaccessionId={deaccessionId}
          proceeds={proceeds}
          onDone={() => setIsEditing(false)}
        />
      ) : canEdit ? (
        <div className="mt-3 space-y-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsEditing(true)}
          >
            {isRecorded ? t("proceeds.edit") : t("proceeds.record")}
          </Button>
          {proceeds.state === "recorded" ? (
            <VerifyProceeds
              deaccessionId={deaccessionId}
              hasReceipt={proceeds.hasReceipt}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ProceedsForm({
  deaccessionId,
  proceeds,
  onDone,
}: {
  deaccessionId: Id<"deaccessions">;
  proceeds: ProceedsStage;
  onDone: () => void;
}) {
  const t = useScopedI18n("deaccessions.stages");
  const recordProceeds = useMutation(api.deaccessions.recordProceeds);
  const generateUploadUrl = useMutation(
    api.deaccessions.generateReceiptUploadUrl,
  );
  const [form, setForm] = useState<{
    amount: string;
    currency: string;
    paidBy: string;
    date: Date | undefined;
    notes: string;
  }>({
    amount: proceeds.amount !== undefined ? String(proceeds.amount) : "",
    currency: proceeds.currency ?? "",
    paidBy: proceeds.recipient ?? "",
    date: proceeds.date ? new Date(proceeds.date) : undefined,
    notes: "",
  });
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { amount, currency, paidBy, date, notes } = form;
  const update = <Field extends keyof typeof form>(
    field: Field,
    value: (typeof form)[Field],
  ) => setForm((current) => ({ ...current, [field]: value }));

  const parsedAmount = Number(amount);
  const isValid =
    amount.trim() !== "" &&
    Number.isFinite(parsedAmount) &&
    parsedAmount >= 0 &&
    /^[A-Za-z]{3}$/.test(currency.trim()) &&
    paidBy.trim().length > 0 &&
    date !== undefined;

  const uploadReceipt = async (file: File) => {
    const uploadUrl = await generateUploadUrl({ deaccessionId });
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!response.ok) throw new Error("Receipt upload failed");
    const { storageId }: { storageId: Id<"_storage"> } = await response.json();
    return storageId;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValid || !date) return;
    setIsSaving(true);
    try {
      const receipt = receiptInputRef.current?.files?.[0];
      const receiptDocument = receipt
        ? await uploadReceipt(receipt)
        : undefined;
      await recordProceeds({
        deaccessionId,
        amount: parsedAmount,
        currency: currency.trim().toUpperCase(),
        recipient: paidBy,
        date: date.getTime(),
        notes: notes || undefined,
        receiptDocument,
      });
      toast.success(t("proceeds.saved"));
      onDone();
    } catch (error) {
      toast.error(disposalStageErrorMessage(error, t("actionFailed")));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="disposal-proceeds-amount">
            {t("proceeds.amount")}
          </Label>
          <Input
            id="disposal-proceeds-amount"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={amount}
            onChange={(event) => update("amount", event.target.value)}
            required
            disabled={isSaving}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="disposal-proceeds-currency">
            {t("proceeds.currency")}
          </Label>
          <Input
            id="disposal-proceeds-currency"
            value={currency}
            onChange={(event) => update("currency", event.target.value)}
            maxLength={3}
            placeholder="EUR"
            required
            disabled={isSaving}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="disposal-proceeds-paid-by">
          {t("proceeds.paidBy")}
        </Label>
        <Input
          id="disposal-proceeds-paid-by"
          value={paidBy}
          onChange={(event) => update("paidBy", event.target.value)}
          required
          disabled={isSaving}
        />
      </div>
      <DatePicker
        id="disposal-proceeds-date"
        label={t("proceeds.date")}
        date={date}
        onSelect={(value) => update("date", value)}
        disabled={isSaving}
      />
      <div className="space-y-1.5">
        <Label htmlFor="disposal-proceeds-receipt">
          {t("proceeds.receipt")}
        </Label>
        <Input
          id="disposal-proceeds-receipt"
          type="file"
          accept="application/pdf,image/*"
          ref={receiptInputRef}
          disabled={isSaving}
        />
        {proceeds.hasReceipt ? (
          <p className="text-xs text-muted-foreground">
            {t("proceeds.receiptKept")}
          </p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="disposal-proceeds-notes">{t("notes")}</Label>
        <Textarea
          id="disposal-proceeds-notes"
          value={notes}
          onChange={(event) => update("notes", event.target.value)}
          rows={2}
          disabled={isSaving}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!isValid || isSaving}>
          {isSaving ? t("saving") : t("proceeds.save")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onDone}
          disabled={isSaving}
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

function VerifyProceeds({
  deaccessionId,
  hasReceipt,
}: {
  deaccessionId: Id<"deaccessions">;
  hasReceipt: boolean;
}) {
  const t = useScopedI18n("deaccessions.stages");
  const verifyProceeds = useMutation(api.deaccessions.verifyProceeds);
  const [exceptionReason, setExceptionReason] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const canVerify = hasReceipt || exceptionReason.trim().length > 0;

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      await verifyProceeds({
        deaccessionId,
        exceptionReason: hasReceipt ? undefined : exceptionReason,
      });
      toast.success(t("proceeds.verifiedToast"));
    } catch (error) {
      toast.error(disposalStageErrorMessage(error, t("actionFailed")));
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-2 border-t border-border/60 pt-3">
      {hasReceipt ? null : (
        <div className="space-y-1.5">
          <Label htmlFor="disposal-proceeds-exception">
            {t("proceeds.exceptionReason")}
          </Label>
          <Textarea
            id="disposal-proceeds-exception"
            value={exceptionReason}
            onChange={(event) => setExceptionReason(event.target.value)}
            rows={2}
            disabled={isVerifying}
          />
          <p className="text-xs text-muted-foreground">
            {t("proceeds.exceptionHint")}
          </p>
        </div>
      )}
      <Button
        size="sm"
        onClick={handleVerify}
        disabled={!canVerify || isVerifying}
      >
        {isVerifying ? t("saving") : t("proceeds.verify")}
      </Button>
    </div>
  );
}
