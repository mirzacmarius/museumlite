"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Inbox } from "lucide-react";
import { formatNumber } from "@/lib/format-number";
import { useCurrentLocale, useI18n, useScopedI18n } from "@/locales/client";
import { SectionLink } from "./my-assignments-sections";
import { WorkSection } from "./my-work-sections";
import { OVERVIEW_CARD_GRID_STYLE, OverviewCard } from "./overview-card";
import { MY_WORK_HREF, useMyWorkColumns, type WorkColumn } from "./work-board";

/** A card per kind of work waiting; `groups` is undefined while they load. */
export function MyWorkCards({ groups }: { groups: WorkColumn[] | undefined }) {
  const t = useScopedI18n("caseTasks");
  const tRoot = useI18n();
  const locale = useCurrentLocale();
  const waiting = (groups ?? []).flatMap((group) =>
    group.summaryEntries.filter((entry) => entry.count > 0),
  );
  const linksToMyWork =
    waiting.length > 0 && waiting.every((entry) => entry.href !== MY_WORK_HREF);

  return (
    <WorkSection
      icon={<Inbox className="size-4 text-blue-400" />}
      title={t("myWork.title")}
      action={
        linksToMyWork ? (
          <SectionLink href={MY_WORK_HREF}>
            {tRoot("common.viewAll")}
          </SectionLink>
        ) : undefined
      }
    >
      {waiting.length > 0 ? (
        <div className="grid" style={OVERVIEW_CARD_GRID_STYLE}>
          {waiting.map((entry) => (
            <OverviewCard
              key={entry.key}
              href={entry.href}
              title={entry.title}
              value={`${formatNumber(entry.count, locale)}${entry.hasMore ? "+" : ""}`}
              icon={entry.icon}
              accentClassName={entry.accentClassName}
            />
          ))}
        </div>
      ) : groups ? (
        <p className="text-xs text-muted-foreground">
          {t("myWork.nothingWaiting")}
        </p>
      ) : null}
    </WorkSection>
  );
}

export function MyWorkSummary({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  return <MyWorkCards groups={useMyWorkColumns(organizationId)} />;
}
