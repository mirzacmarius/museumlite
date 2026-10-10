"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { EntryPurpose } from "@v1/backend/convex/utils/objectEntryValidators";
import { Checkbox } from "@v1/ui/checkbox";
import { DatePicker } from "@v1/ui/date-picker";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Textarea } from "@v1/ui/textarea";
import { useQuery } from "convex/react";
import type { ReactNode } from "react";
import { LocationSelector } from "@/components/location-selector";
import { PartyPicker, usePartyPickerAccess } from "@/components/party-picker";
import { useScopedI18n } from "@/locales/client";

const PURPOSES = [
  "acquisition",
  "identification",
  "deposit",
  "research",
  "other",
] as const satisfies readonly EntryPurpose[];

export interface PartyField {
  name: string;
  accountId: Id<"accounts"> | undefined;
}

export interface ReceiveForm {
  entryNumber: string;
  purpose: EntryPurpose;
  purposeNote: string;
  depositor: PartyField;
  ownerSameAsDepositor: boolean;
  owner: PartyField;
  receivedAt: Date | undefined;
  locationId: string;
  conditionAtEntry: string;
  responsibleUserId: string;
  responsibilityTerms: string;
  decisionDueAt: Date | undefined;
  returnDueAt: Date | undefined;
  notes: string;
  title: string;
  objectName: string;
  description: string;
}

export type UpdateReceiveForm = <Field extends keyof ReceiveForm>(
  field: Field,
  value: ReceiveForm[Field],
) => void;

interface SectionProps {
  form: ReceiveForm;
  update: UpdateReceiveForm;
  disabled: boolean;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border/60 p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  disabled,
  required,
  multiline,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  required?: boolean;
  multiline?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={2}
          required={required}
          disabled={disabled}
        />
      ) : (
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          disabled={disabled}
        />
      )}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function PropertySection({ form, update, disabled }: SectionProps) {
  const t = useScopedI18n("objectEntries");
  return (
    <Section title={t("sections.property")}>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          id="entry-title"
          label={t("fields.objectTitle")}
          value={form.title}
          onChange={(value) => update("title", value)}
          required
          disabled={disabled}
        />
        <TextField
          id="entry-object-name"
          label={t("fields.objectName")}
          value={form.objectName}
          onChange={(value) => update("objectName", value)}
          disabled={disabled}
        />
      </div>
      <TextField
        id="entry-description"
        label={t("fields.objectDescription")}
        value={form.description}
        onChange={(value) => update("description", value)}
        multiline
        disabled={disabled}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="entry-purpose">{t("fields.purpose")}</Label>
          <Select
            value={form.purpose}
            onValueChange={(value) => update("purpose", value as EntryPurpose)}
            disabled={disabled}
          >
            <SelectTrigger id="entry-purpose">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PURPOSES.map((purpose) => (
                <SelectItem key={purpose} value={purpose}>
                  {t(`purposes.${purpose}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <TextField
          id="entry-number"
          label={t("fields.entryNumber")}
          value={form.entryNumber}
          onChange={(value) => update("entryNumber", value)}
          hint={t("fields.entryNumberHint")}
          disabled={disabled}
        />
      </div>
      <TextField
        id="entry-purpose-note"
        label={t("fields.purposeNote")}
        value={form.purposeNote}
        onChange={(value) => update("purposeNote", value)}
        multiline
        disabled={disabled}
      />
    </Section>
  );
}

function PartyInputs({
  partyRole,
  organizationId,
  value,
  onChange,
  disabled,
}: {
  partyRole: "depositor" | "owner";
  organizationId: Id<"organizations">;
  value: PartyField;
  onChange: (next: PartyField) => void;
  disabled: boolean;
}) {
  const t = useScopedI18n("objectEntries");
  const { canPick } = usePartyPickerAccess();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {canPick ? (
        <div className="space-y-1.5">
          <Label htmlFor={`entry-${partyRole}-party`}>
            {t(
              partyRole === "depositor"
                ? "fields.depositorParty"
                : "fields.ownerParty",
            )}
          </Label>
          <PartyPicker
            id={`entry-${partyRole}-party`}
            organizationId={organizationId}
            value={value.accountId}
            onChange={(party) =>
              onChange({
                accountId: party?._id,
                name:
                  party && !value.name.trim() ? party.displayName : value.name,
              })
            }
            disabled={disabled}
          />
        </div>
      ) : null}
      <TextField
        id={`entry-${partyRole}-name`}
        label={t(
          partyRole === "depositor" ? "fields.depositor" : "fields.owner",
        )}
        value={value.name}
        onChange={(name) => onChange({ ...value, name })}
        required={partyRole === "depositor" && value.accountId === undefined}
        disabled={disabled}
      />
    </div>
  );
}

export function PartiesSection({
  form,
  update,
  disabled,
  organizationId,
}: SectionProps & { organizationId: Id<"organizations"> }) {
  const t = useScopedI18n("objectEntries");
  return (
    <Section title={t("sections.parties")}>
      <PartyInputs
        partyRole="depositor"
        organizationId={organizationId}
        value={form.depositor}
        onChange={(next) => update("depositor", next)}
        disabled={disabled}
      />
      <div className="flex items-center gap-2">
        <Checkbox
          id="entry-owner-same"
          checked={form.ownerSameAsDepositor}
          onCheckedChange={(checked) =>
            update("ownerSameAsDepositor", checked === true)
          }
          disabled={disabled}
        />
        <Label htmlFor="entry-owner-same" className="font-normal">
          {t("fields.ownerSameAsDepositor")}
        </Label>
      </div>
      {form.ownerSameAsDepositor ? null : (
        <>
          <PartyInputs
            partyRole="owner"
            organizationId={organizationId}
            value={form.owner}
            onChange={(next) => update("owner", next)}
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">
            {t("fields.ownerHint")}
          </p>
        </>
      )}
    </Section>
  );
}

export function CustodySection({
  form,
  update,
  disabled,
  organizationId,
  responsibleUserId,
}: SectionProps & {
  organizationId: Id<"organizations">;
  responsibleUserId: string;
}) {
  const t = useScopedI18n("objectEntries");
  const members = useQuery(api.objectEntries.listResponsibleMembers, {
    organizationId,
  });
  return (
    <Section title={t("sections.custody")}>
      <div className="grid gap-3 sm:grid-cols-2">
        <DatePicker
          id="entry-received-at"
          label={t("fields.receivedAt")}
          date={form.receivedAt}
          onSelect={(value) => update("receivedAt", value)}
          disabled={disabled}
        />
        <div className="space-y-1.5">
          <Label>{t("fields.location")}</Label>
          <LocationSelector
            organizationId={organizationId}
            value={form.locationId || undefined}
            onValueChange={(value) => update("locationId", value)}
            placeholder={t("fields.chooseLocation")}
            allowNone={false}
          />
        </div>
      </div>
      <TextField
        id="entry-condition"
        label={t("fields.condition")}
        value={form.conditionAtEntry}
        onChange={(value) => update("conditionAtEntry", value)}
        hint={t("fields.conditionHint")}
        multiline
        required
        disabled={disabled}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="entry-responsible">{t("fields.responsible")}</Label>
          <Select
            value={responsibleUserId}
            onValueChange={(value) => update("responsibleUserId", value)}
            disabled={disabled}
          >
            <SelectTrigger id="entry-responsible">
              <SelectValue placeholder={t("fields.chooseMember")} />
            </SelectTrigger>
            <SelectContent>
              {(members ?? []).map((member) => (
                <SelectItem key={member.userId} value={member.userId}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <TextField
          id="entry-terms"
          label={t("fields.responsibilityTerms")}
          value={form.responsibilityTerms}
          onChange={(value) => update("responsibilityTerms", value)}
          disabled={disabled}
        />
      </div>
    </Section>
  );
}

export function DatesSection({ form, update, disabled }: SectionProps) {
  const t = useScopedI18n("objectEntries");
  return (
    <Section title={t("sections.dates")}>
      <div className="grid gap-3 sm:grid-cols-2">
        <DatePicker
          id="entry-decision-due"
          label={t("fields.decisionDueAt")}
          date={form.decisionDueAt}
          onSelect={(value) => update("decisionDueAt", value)}
          disabled={disabled}
        />
        <DatePicker
          id="entry-return-due"
          label={t("fields.returnDueAt")}
          date={form.returnDueAt}
          onSelect={(value) => update("returnDueAt", value)}
          disabled={disabled}
        />
      </div>
      <TextField
        id="entry-notes"
        label={t("fields.notes")}
        value={form.notes}
        onChange={(value) => update("notes", value)}
        multiline
        disabled={disabled}
      />
    </Section>
  );
}
