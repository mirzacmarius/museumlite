"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import type { PartySummary } from "@v1/backend/convex/utils/partyValidators";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@v1/ui/card";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@v1/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Building2, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ClientDate } from "@/components/client-date";
import { PartyPicker, partyContactLine } from "@/components/party-picker";
import { usePermissions } from "@/components/permission-gate";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { usePartyErrorMessage } from "@/hooks/use-party-error-message";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

type ReviewStatus = "pending" | "dismissed" | "confirmed_distinct";
type DuplicateReview = FunctionReturnType<
  typeof api.partyDuplicates.list
>["page"][number];
type LegacyKind = "accession" | "loan" | "deaccession";
type LegacyItem = FunctionReturnType<
  typeof api.partyLinks.listLegacyLinks
>["items"][number];

const REVIEW_STATUSES: readonly ReviewStatus[] = [
  "pending",
  "dismissed",
  "confirmed_distinct",
];

function PartyCard({ party }: { party: PartySummary | null }) {
  const t = useScopedI18n("parties");
  if (!party) {
    return (
      <div className="rounded-md border border-white/10 p-3 text-sm text-muted-foreground">
        {t("review.unavailable")}
      </div>
    );
  }
  const Icon = party.holderType === "privatePerson" ? User : Building2;
  return (
    <div className="space-y-1 rounded-md border border-white/10 p-3 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <Icon className="size-4 text-muted-foreground" />
        {party.displayName}
        {party.archived ? (
          <Badge variant="secondary">{t("links.archived")}</Badge>
        ) : null}
      </p>
      <p className="text-xs text-muted-foreground">
        {t(`holderTypes.${party.holderType}`)} · {party.accountNumber}
      </p>
      {partyContactLine(party) ? (
        <p className="text-xs text-muted-foreground">
          {partyContactLine(party)}
        </p>
      ) : null}
    </div>
  );
}

function DuplicateReviewRow({
  review,
  canResolve,
}: {
  review: DuplicateReview;
  canResolve: boolean;
}) {
  const t = useScopedI18n("parties");
  const resolve = useMutation(api.partyDuplicates.resolve);
  const partyErrorMessage = usePartyErrorMessage();
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const decide = async (decision: "dismissed" | "confirmed_distinct") => {
    setIsSaving(true);
    try {
      await resolve({
        reviewId: review._id,
        decision,
        note: note.trim() || undefined,
      });
      toast.success(t("review.resolved"));
    } catch (error) {
      toast.error(partyErrorMessage(error));
      setIsSaving(false);
    }
  };

  return (
    <li className="space-y-3 p-3">
      <div className="flex flex-wrap gap-2">
        {review.reasons.map((reason) => (
          <Badge key={reason} variant="outline">
            {t(`reasons.${reason}`)}
          </Badge>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <PartyCard party={review.first} />
        <PartyCard party={review.second} />
      </div>
      {review.status === "pending" && canResolve ? (
        <div className="space-y-2">
          <Label htmlFor={`review-note-${review._id}`}>
            {t("review.note")}
          </Label>
          <Input
            id={`review-note-${review._id}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={isSaving}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isSaving}
              onClick={() => void decide("confirmed_distinct")}
            >
              {t("review.notSame")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isSaving}
              onClick={() => void decide("dismissed")}
            >
              {t("review.dismiss")}
            </Button>
          </div>
        </div>
      ) : review.status !== "pending" ? (
        <p className="text-xs text-muted-foreground">
          {t("review.reviewedBy", { name: review.reviewedByName ?? "—" })}
          {review.note ? ` · ${review.note}` : ""}
        </p>
      ) : null}
    </li>
  );
}

function DuplicateReviews({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("parties.review");
  const tParties = useScopedI18n("parties");
  const { hasPermission } = usePermissions();
  const canResolve = hasPermission("accounts.write");
  const partyErrorMessage = usePartyErrorMessage();
  const [status, setStatus] = useState<ReviewStatus>("pending");
  const [isScanning, setIsScanning] = useState(false);
  const scan = useMutation(api.partyDuplicates.scan);
  const {
    results,
    status: loadStatus,
    loadMore,
  } = usePaginatedQuery(
    api.partyDuplicates.list,
    { organizationId, status },
    { initialNumItems: 20 },
  );

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const result = await scan({ organizationId });
      toast.success(t("scanResult", { count: result.created }));
      if (result.scanLimitReached) {
        toast.info(t("scanLimit", { count: result.scanned }));
      }
    } catch (error) {
      toast.error(partyErrorMessage(error));
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="party-review-status">{t("status")}</Label>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as ReviewStatus)}
          >
            <SelectTrigger id="party-review-status" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REVIEW_STATUSES.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`statuses.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canResolve ? (
          <Button
            type="button"
            variant="outline"
            disabled={isScanning}
            onClick={() => void handleScan()}
          >
            {isScanning ? t("scanning") : t("scan")}
          </Button>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">{t("mergeHint")}</p>
      {loadStatus === "LoadingFirstPage" ? null : results.length === 0 ? (
        <p className="text-sm">{t("noDuplicates")}</p>
      ) : (
        <ul className="divide-y divide-white/10 rounded-md border border-white/10">
          {results.map((review) => (
            <DuplicateReviewRow
              key={review._id}
              review={review}
              canResolve={canResolve}
            />
          ))}
        </ul>
      )}
      {loadStatus === "CanLoadMore" ? (
        <Button type="button" variant="outline" onClick={() => loadMore(20)}>
          {tParties("history.loadMore")}
        </Button>
      ) : null}
    </div>
  );
}

function LegacyLinkRow({
  organizationId,
  item,
  canLink,
}: {
  organizationId: Id<"organizations">;
  item: LegacyItem;
  canLink: boolean;
}) {
  const t = useScopedI18n("parties");
  const locale = useCurrentLocale();
  const link = useMutation(api.partyLinks.link);
  const partyErrorMessage = usePartyErrorMessage();
  const [partyId, setPartyId] = useState<Id<"accounts"> | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  const linkParty = async (accountId: Id<"accounts">) => {
    setIsSaving(true);
    try {
      await link({
        target: item.target,
        accountId,
        role: item.suggestedRole,
        assertedName: item.assertedName,
      });
      toast.success(t("links.linked"));
    } catch (error) {
      toast.error(partyErrorMessage(error));
      setIsSaving(false);
    }
  };

  return (
    <li className="space-y-2 p-3 text-sm">
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{item.label}</span>
        <Badge variant="outline">{t(`roles.${item.suggestedRole}`)}</Badge>
        <span className="text-xs text-muted-foreground">
          <ClientDate timestamp={item.date} locale={locale} />
        </span>
      </p>
      {item.assertedName ? (
        <p>{t("links.namedOnRecord", { name: item.assertedName })}</p>
      ) : null}
      {item.contact ? (
        <p className="text-xs text-muted-foreground">{item.contact}</p>
      ) : null}
      {item.existingParty ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-muted-foreground">
            {t("review.referencesParty", {
              name: item.existingParty.displayName,
            })}
          </p>
          {canLink ? (
            <Button
              type="button"
              size="sm"
              disabled={isSaving || item.existingParty.archived}
              onClick={() => {
                if (item.existingParty) void linkParty(item.existingParty._id);
              }}
            >
              {t("review.confirmLink")}
            </Button>
          ) : null}
        </div>
      ) : canLink ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="flex-1">
            <PartyPicker
              organizationId={organizationId}
              value={partyId}
              onChange={(party) => setPartyId(party?._id)}
              disabled={isSaving}
            />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!partyId || isSaving}
            onClick={() => {
              if (partyId) void linkParty(partyId);
            }}
          >
            {t("review.link")}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function LegacyLinkResults({
  organizationId,
  kind,
}: {
  organizationId: Id<"organizations">;
  kind: LegacyKind;
}) {
  const t = useScopedI18n("parties.review");
  const { hasPermission } = usePermissions();
  const canLink = hasPermission(
    kind === "loan" ? "loans.update" : "collections.update",
  );
  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  const result = useQuery(api.partyLinks.listLegacyLinks, {
    organizationId,
    kind,
    paginationOpts: {
      cursor: cursors[cursors.length - 1] ?? null,
      numItems: 25,
    },
  });
  if (!result) return null;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground" role="status">
        {t("checked", { count: result.checkedCount })}
      </p>
      {result.items.length === 0 ? (
        <p className="text-sm">{t("legacyEmpty")}</p>
      ) : (
        <ul className="divide-y divide-white/10 rounded-md border border-white/10">
          {result.items.map((item) => (
            <LegacyLinkRow
              key={item.target.id}
              organizationId={organizationId}
              item={item}
              canLink={canLink}
            />
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={cursors.length === 1}
          onClick={() => setCursors((current) => current.slice(0, -1))}
        >
          {t("previous")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={result.isDone}
          onClick={() =>
            setCursors((current) => [...current, result.continueCursor])
          }
        >
          {t("next")}
        </Button>
      </div>
    </div>
  );
}

function LegacyLinks({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("parties.review");
  const { hasPermission } = usePermissions();
  const { hasFeature } = useFeatureAccess();
  const kinds: LegacyKind[] = [
    ...(hasPermission("collections.read")
      ? (["accession", "deaccession"] as const)
      : []),
    ...(hasFeature("loans") && hasPermission("loans.read")
      ? (["loan"] as const)
      : []),
  ];
  const [selection, setSelection] = useState<LegacyKind>("accession");
  const kind = kinds.includes(selection) ? selection : kinds[0];
  if (!kind) return null;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("legacyDescription")}</p>
      <div className="space-y-1.5">
        <Label htmlFor="party-legacy-kind">{t("recordType")}</Label>
        <Select
          value={kind}
          onValueChange={(value) => setSelection(value as LegacyKind)}
        >
          <SelectTrigger id="party-legacy-kind" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {kinds.map((option) => (
              <SelectItem key={option} value={option}>
                {t(`kinds.${option}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <LegacyLinkResults
        key={`${organizationId}:${kind}`}
        organizationId={organizationId}
        kind={kind}
      />
    </div>
  );
}

/**
 * Staff review of possible duplicate parties and records that name a party
 * only in text. Decisions are recorded; nothing is merged or linked
 * automatically.
 */
export function PartyReview({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const t = useScopedI18n("parties.review");
  const { hasPermission, isLoading } = usePermissions();
  const { hasModule } = useFeatureAccess();
  if (isLoading || !hasModule("accounts") || !hasPermission("accounts.read"))
    return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        <Tabs defaultValue="duplicates">
          <TabsList>
            <TabsTrigger value="duplicates">{t("duplicatesTab")}</TabsTrigger>
            <TabsTrigger value="legacy">{t("legacyTab")}</TabsTrigger>
          </TabsList>
          <TabsContent value="duplicates" className="pt-4">
            <DuplicateReviews organizationId={organizationId} />
          </TabsContent>
          <TabsContent value="legacy" className="pt-4">
            <LegacyLinks organizationId={organizationId} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
