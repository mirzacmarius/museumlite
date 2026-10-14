"use client";

import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { formatNumber } from "@/lib/format-number";
import { useCurrentLocale, useScopedI18n } from "@/locales/client";
import { OverviewPill } from "./overview-pill";
import { useMyWorkColumns, type WorkColumn } from "./work-board";

const MY_WORK_HREF = "/assignments";

/** One pill per queue with work waiting on the viewer; empty queues are left out. */
export function MyWorkPills({ groups }: { groups: WorkColumn[] }) {
  const t = useScopedI18n("caseTasks");
  const locale = useCurrentLocale();
  const waiting = groups.filter((group) => !group.loading && group.count > 0);

  return (
    <section
      aria-label={t("myWork.title")}
      className="flex flex-wrap items-center gap-2"
    >
      {waiting.map((group) => (
        <OverviewPill
          key={group.key}
          href={MY_WORK_HREF}
          title={group.title}
          value={`${formatNumber(group.count, locale)}${group.hasMore ? "+" : ""}`}
          icon={group.icon}
          accentClassName={group.accentClassName}
        />
      ))}
      <Link
        href={MY_WORK_HREF}
        className="flex items-center gap-1 px-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        {t("myWork.title")}
        <ArrowRight className="size-3" aria-hidden="true" />
      </Link>
    </section>
  );
}

export function MyWorkSummary({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  return <MyWorkPills groups={useMyWorkColumns(organizationId)} />;
}
