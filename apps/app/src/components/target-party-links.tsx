"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type {
  PartyRole,
  PartyTarget,
} from "@v1/backend/convex/utils/partyValidators";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Users } from "lucide-react";
import { useReducer } from "react";
import { toast } from "sonner";
import { PartyPicker, usePartyPickerAccess } from "@/components/party-picker";
import { usePermissions } from "@/components/permission-gate";
import { useClientDate } from "@/hooks/use-client-date-format";
import { usePartyErrorMessage } from "@/hooks/use-party-error-message";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

type PartyLinkView = FunctionReturnType<
  typeof api.partyLinks.listForTarget
>[number];

interface PanelState {
  role: PartyRole | undefined;
  partyId: Id<"accounts"> | undefined;
  reason: string;
  isSaving: boolean;
  endingLinkId: Id<"partyLinks"> | undefined;
  endReason: string;
}

type PanelAction =
  | { type: "setRole"; value: PartyRole }
  | { type: "setParty"; value: Id<"accounts"> | undefined }
  | { type: "setReason"; value: string }
  | { type: "setSaving"; value: boolean }
  | { type: "startEnding"; linkId: Id<"partyLinks"> }
  | { type: "setEndReason"; value: string }
  | { type: "stopEnding" }
  | { type: "linked" };

function reducer(state: PanelState, action: PanelAction): PanelState {
  switch (action.type) {
    case "setRole":
      return { ...state, role: action.value };
    case "setParty":
      return { ...state, partyId: action.value };
    case "setReason":
      return { ...state, reason: action.value };
    case "setSaving":
      return { ...state, isSaving: action.value };
    case "startEnding":
      return { ...state, endingLinkId: action.linkId, endReason: "" };
    case "setEndReason":
      return { ...state, endReason: action.value };
    case "stopEnding":
      return {
        ...state,
        endingLinkId: undefined,
        endReason: "",
        isSaving: false,
      };
    case "linked":
      return { ...state, partyId: undefined, reason: "", isSaving: false };
  }
}

/** "From {date}" or "Replaced or ended on {date}", formatted on the client. */
export function PartyLinkDate({
  kind,
  timestamp,
  locale,
}: {
  kind: "from" | "replacedOn";
  timestamp: number | undefined;
  locale: string;
}) {
  const t = useScopedI18n("parties.links");
  const date = useClientDate(timestamp, locale);
  return <>{t(kind, { date })}</>;
}

function LinkDetails({
  link,
  locale,
}: {
  link: PartyLinkView;
  locale: string;
}) {
  const t = useScopedI18n("parties");
  return (
    <div className="space-y-1 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{t(`roles.${link.role}`)}</Badge>
        <span className="font-medium">
          {link.partyName ?? t("links.partyUnavailable")}
        </span>
        {link.partyArchived ? (
          <Badge variant="secondary">{t("links.archived")}</Badge>
        ) : null}
      </div>
      {link.nameSnapshot !== link.partyName ? (
        <p className="text-muted-foreground">
          {t("links.recordedAs", { name: link.nameSnapshot })}
        </p>
      ) : null}
      {link.assertedName ? (
        <p className="text-muted-foreground">
          {t("links.namedOnRecord", { name: link.assertedName })}
        </p>
      ) : null}
      {link.contactSnapshot ? (
        <p className="text-muted-foreground">
          {t("links.contactAtLink", { contact: link.contactSnapshot })}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        <PartyLinkDate
          kind="from"
          timestamp={link.effectiveFrom}
          locale={locale}
        />
        {" · "}
        {link.origin === "backfill"
          ? t("links.backfilled")
          : t("links.linkedBy", { name: link.createdByName ?? "—" })}
      </p>
    </div>
  );
}

interface TargetPartyLinksProps {
  target: PartyTarget;
  organizationId: Id<"organizations">;
  roles: readonly PartyRole[];
  /** The record's own write permission, required to link parties. */
  writePermission: "collections.update" | "loans.update";
  /** How the record names the party, kept as the named assertion. */
  assertedName?: string;
}

/**
 * Parties linked to one procedure record: current roles, earlier parties
 * with their recorded snapshots, and linking for staff who may edit it.
 */
export function TargetPartyLinks({
  target,
  organizationId,
  roles,
  writePermission,
  assertedName,
}: TargetPartyLinksProps) {
  const t = useScopedI18n("parties");
  const locale = useCurrentLocale();
  const { canPick } = usePartyPickerAccess();
  const { hasPermission } = usePermissions();
  const partyErrorMessage = usePartyErrorMessage();
  const [state, dispatch] = useReducer(reducer, {
    role: roles[0],
    partyId: undefined,
    reason: "",
    isSaving: false,
    endingLinkId: undefined,
    endReason: "",
  });
  const links = useQuery(
    api.partyLinks.listForTarget,
    canPick ? { target } : "skip",
  );
  const link = useMutation(api.partyLinks.link);
  const supersede = useMutation(api.partyLinks.supersede);

  if (!canPick) return null;
  const canEdit = hasPermission(writePermission);
  const current = links?.filter((entry) => entry.isCurrent) ?? [];
  const earlier = links?.filter((entry) => !entry.isCurrent) ?? [];
  const replacing = current.some((entry) => entry.role === state.role);

  const handleLink = async () => {
    if (!state.partyId || !state.role) return;
    dispatch({ type: "setSaving", value: true });
    try {
      await link({
        target,
        accountId: state.partyId,
        role: state.role,
        assertedName,
        reason: state.reason.trim() || undefined,
      });
      toast.success(t("links.linked"));
      dispatch({ type: "linked" });
    } catch (error) {
      toast.error(partyErrorMessage(error));
      dispatch({ type: "setSaving", value: false });
    }
  };

  const handleEnd = async (linkId: Id<"partyLinks">) => {
    dispatch({ type: "setSaving", value: true });
    try {
      await supersede({ linkId, reason: state.endReason });
      toast.success(t("links.ended"));
      dispatch({ type: "stopEnding" });
    } catch (error) {
      toast.error(partyErrorMessage(error));
      dispatch({ type: "setSaving", value: false });
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Users className="size-4 text-muted-foreground" />
          {t("links.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("links.description")}
        </p>
      </div>

      {links === undefined ? null : current.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("links.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {current.map((entry) => (
            <li
              key={entry._id}
              className="space-y-2 rounded-lg border border-border/60 p-3"
            >
              <LinkDetails link={entry} locale={locale} />
              {canEdit && state.endingLinkId === entry._id ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t("links.endTitle")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("links.endDescription")}
                  </p>
                  <Label htmlFor={`end-reason-${entry._id}`}>
                    {t("links.endReason")}
                  </Label>
                  <Input
                    id={`end-reason-${entry._id}`}
                    value={state.endReason}
                    onChange={(event) =>
                      dispatch({
                        type: "setEndReason",
                        value: event.target.value,
                      })
                    }
                    disabled={state.isSaving}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={state.isSaving || !state.endReason.trim()}
                      onClick={() => void handleEnd(entry._id)}
                    >
                      {t("links.endConfirm")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={state.isSaving}
                      onClick={() => dispatch({ type: "stopEnding" })}
                    >
                      {t("links.cancel")}
                    </Button>
                  </div>
                </div>
              ) : canEdit ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    dispatch({ type: "startEnding", linkId: entry._id })
                  }
                >
                  {t("links.end")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {earlier.length > 0 ? (
        <details className="rounded-lg border border-border/60 p-3">
          <summary className="cursor-pointer text-sm font-medium">
            {t("links.earlier", { count: earlier.length })}
          </summary>
          <ul className="mt-3 space-y-3">
            {earlier.map((entry) => (
              <li key={entry._id} className="space-y-1">
                <LinkDetails link={entry} locale={locale} />
                <p className="text-xs text-muted-foreground">
                  <PartyLinkDate
                    kind="replacedOn"
                    timestamp={entry.supersededAt}
                    locale={locale}
                  />
                  {entry.supersessionReason
                    ? ` · ${t("links.reason", { reason: entry.supersessionReason })}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {canEdit ? (
        <div className="space-y-3 border-t border-border/60 pt-4">
          {roles.length > 1 ? (
            <div className="space-y-1.5">
              <Label htmlFor="party-link-role">{t("links.role")}</Label>
              <Select
                value={state.role}
                onValueChange={(value) =>
                  dispatch({ type: "setRole", value: value as PartyRole })
                }
              >
                <SelectTrigger id="party-link-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {t(`roles.${role}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="party-link-party">{t("links.party")}</Label>
            <PartyPicker
              id="party-link-party"
              organizationId={organizationId}
              value={state.partyId}
              onChange={(party) =>
                dispatch({ type: "setParty", value: party?._id })
              }
              disabled={state.isSaving}
            />
          </div>
          {replacing ? (
            <div className="space-y-1.5">
              <Label htmlFor="party-link-reason">
                {t("links.changeReason")}
              </Label>
              <Input
                id="party-link-reason"
                value={state.reason}
                placeholder={t("links.changeReasonPlaceholder")}
                onChange={(event) =>
                  dispatch({ type: "setReason", value: event.target.value })
                }
                disabled={state.isSaving}
              />
            </div>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={!state.partyId || state.isSaving}
            onClick={() => void handleLink()}
          >
            {state.isSaving ? t("links.linking") : t("links.link")}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
