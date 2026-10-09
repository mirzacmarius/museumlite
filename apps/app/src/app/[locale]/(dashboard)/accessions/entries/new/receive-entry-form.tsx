"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useEntryErrorMessage } from "@/hooks/use-entry-error-message";
import { useScopedI18n } from "@/locales/client";
import { endOfDay, handoffTime } from "../_components/entry-dates";
import {
  CustodySection,
  DatesSection,
  PartiesSection,
  PropertySection,
  type ReceiveForm,
  type UpdateReceiveForm,
} from "./receive-entry-sections";

const NO_LOCATION = "__none__";

function trimmedOrUndefined(value: string) {
  const text = value.trim();
  return text ? text : undefined;
}

function initialForm(): ReceiveForm {
  return {
    entryNumber: "",
    purpose: "deposit",
    purposeNote: "",
    depositor: { name: "", accountId: undefined },
    ownerSameAsDepositor: true,
    owner: { name: "", accountId: undefined },
    receivedAt: new Date(),
    locationId: "",
    conditionAtEntry: "",
    responsibleUserId: "",
    responsibilityTerms: "",
    decisionDueAt: undefined,
    returnDueAt: undefined,
    notes: "",
    title: "",
    objectName: "",
    description: "",
  };
}

export function ReceiveEntryForm({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("objectEntries");
  const { push } = useRouter();
  const errorMessage = useEntryErrorMessage();
  const receive = useMutation(api.objectEntries.receive);
  const user = useQuery(api.users.getUser);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(initialForm);
  const update: UpdateReceiveForm = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));
  // Staff receiving the property are accountable unless they choose someone.
  const responsibleUserId = form.responsibleUserId || user?._id || "";
  const owner = form.ownerSameAsDepositor ? form.depositor : form.owner;
  const isValid =
    form.title.trim().length > 0 &&
    (form.depositor.name.trim().length > 0 ||
      form.depositor.accountId !== undefined) &&
    form.receivedAt !== undefined &&
    form.locationId !== "" &&
    form.locationId !== NO_LOCATION &&
    form.conditionAtEntry.trim().length > 0 &&
    responsibleUserId !== "";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValid || !form.receivedAt) return;
    setIsSaving(true);
    try {
      const result = await receive({
        organizationId,
        entryNumber: trimmedOrUndefined(form.entryNumber),
        purpose: form.purpose,
        purposeNote: trimmedOrUndefined(form.purposeNote),
        depositorName: trimmedOrUndefined(form.depositor.name),
        depositorAccountId: form.depositor.accountId,
        ownerName: trimmedOrUndefined(owner.name),
        ownerAccountId: owner.accountId,
        receivedAt: handoffTime(form.receivedAt, Date.now()),
        locationId: form.locationId as Id<"locations">,
        conditionAtEntry: form.conditionAtEntry,
        responsibleUserId: responsibleUserId as Id<"users">,
        responsibilityTerms: trimmedOrUndefined(form.responsibilityTerms),
        decisionDueAt: form.decisionDueAt && endOfDay(form.decisionDueAt),
        returnDueAt: form.returnDueAt && endOfDay(form.returnDueAt),
        notes: trimmedOrUndefined(form.notes),
        object: {
          title: form.title,
          objectName: trimmedOrUndefined(form.objectName),
          description: trimmedOrUndefined(form.description),
        },
      });
      toast.success(
        t("receiveForm.success", { entryNumber: result.entryNumber }),
      );
      push(`/accessions/entries/${result.entryId}`);
    } catch (error) {
      toast.error(errorMessage(error));
      setIsSaving(false);
    }
  };

  const sectionProps = { form, update, disabled: isSaving };
  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-3xl space-y-6 p-6"
    >
      <div>
        <Link
          href="/accessions/entries"
          className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {t("detail.back")}
        </Link>
        <h1 className="text-lg font-semibold">{t("receiveForm.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("receiveForm.description")}
        </p>
      </div>
      <PropertySection {...sectionProps} />
      <PartiesSection {...sectionProps} organizationId={organizationId} />
      <CustodySection
        {...sectionProps}
        organizationId={organizationId}
        responsibleUserId={responsibleUserId}
      />
      <DatesSection {...sectionProps} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" asChild>
          <Link href="/accessions/entries">{t("actions.cancel")}</Link>
        </Button>
        <Button type="submit" disabled={!isValid || isSaving}>
          {isSaving ? t("receiveForm.saving") : t("receiveForm.submit")}
        </Button>
      </div>
    </form>
  );
}
