"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Badge } from "@v1/ui/badge";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { Skeleton } from "@v1/ui/skeleton";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Building2, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useOrganization } from "@/components/organization-provider";
import { formatDate } from "@/lib/format-date";
import { type FormatLocale, formatNumber } from "@/lib/format-number";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";

type OrganizationSummary = FunctionReturnType<
  typeof api.organizationOverview.listMine
>[number];

const SKELETON_KEYS = ["first", "second", "third"] as const;

/**
 * Every Organization the user belongs to, as cards with their role and the
 * Dashboard's headline counts. Opening one makes it the current Organization.
 */
export function OrganizationsOverview() {
  const t = useScopedI18n("organizationsOverview");
  const organizations = useQuery(api.organizationOverview.listMine);
  const { currentOrganizationId, setCurrentOrganizationId } = useOrganization();
  const { push } = useRouter();
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const shown =
    organizations?.filter(
      (organization) =>
        !query ||
        organization.name.toLowerCase().includes(query) ||
        organization.parentOrganizationName?.toLowerCase().includes(query),
    ) ?? [];

  const open = (organizationId: Id<"organizations">) => {
    setCurrentOrganizationId(organizationId);
    push("/");
  };

  return (
    <div className="@container h-full min-h-0 w-full overflow-y-auto bg-background p-4 sm:p-6 custom-scrollbar">
      <div className="flex min-w-0 flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {t("title")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/organization/new">
              <Plus className="mr-1 size-4" />
              {t("createOrganization")}
            </Link>
          </Button>
        </header>

        {organizations === undefined ? (
          <div className="grid gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
            {SKELETON_KEYS.map((key) => (
              <Skeleton key={key} className="h-44 rounded-lg" />
            ))}
          </div>
        ) : organizations.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <>
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("searchPlaceholder")}
                aria-label={t("searchLabel")}
                className="pl-8"
              />
            </div>
            {shown.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("noResults", { query: search.trim() })}
              </p>
            ) : (
              <ul className="grid gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
                {shown.map((organization) => (
                  <OrganizationCard
                    key={organization._id}
                    organization={organization}
                    isCurrent={organization._id === currentOrganizationId}
                    onOpen={() => open(organization._id)}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function OrganizationCard({
  organization,
  isCurrent,
  onOpen,
}: {
  organization: OrganizationSummary;
  isCurrent: boolean;
  onOpen: () => void;
}) {
  const t = useScopedI18n("organizationsOverview");
  const locale = useCurrentLocale();
  const { metrics } = organization;
  const joinedAt = new Date(organization.joinedAt);

  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background">
            <Building2 className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">
              {organization.name}
            </h2>
            <p className="truncate text-xs text-muted-foreground">
              {t(`types.${organization.type}`)}
              {organization.parentOrganizationName
                ? ` · ${t("partOf", { name: organization.parentOrganizationName })}`
                : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {isCurrent ? <Badge>{t("current")}</Badge> : null}
          <Badge variant="outline">
            {t(`tiers.${organization.subscriptionTier}`)}
          </Badge>
        </div>
      </div>

      {metrics === null ? null : metrics.availability === "ready" ? (
        <dl className="grid grid-cols-3 gap-2 border-y border-border py-3">
          <Metric
            label={t("objects")}
            value={metrics.objects}
            locale={locale}
          />
          <Metric
            label={t("activeLoans")}
            value={metrics.activeLoans}
            locale={locale}
          />
          <Metric
            label={t("locations")}
            value={metrics.locations}
            locale={locale}
          />
        </dl>
      ) : (
        <p className="border-y border-border py-3 text-xs text-muted-foreground">
          {t("metricsUnavailable")}
        </p>
      )}

      <div className="mt-auto flex items-end justify-between gap-3">
        <div className="min-w-0 text-xs text-muted-foreground">
          <p className="truncate">
            {t("role", { role: organization.roleName })}
          </p>
          <p className="truncate">
            {t("memberSince", {
              date: formatDate(joinedAt, locale),
            })}
          </p>
        </div>
        <Button
          size="sm"
          variant={isCurrent ? "outline" : "default"}
          onClick={onOpen}
        >
          {t("open")}
        </Button>
      </div>
    </li>
  );
}

function Metric({
  label,
  value,
  locale,
}: {
  label: string;
  value: number;
  locale: FormatLocale;
}) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-base font-semibold tabular-nums text-foreground">
        {formatNumber(value, locale)}
      </dd>
    </div>
  );
}
