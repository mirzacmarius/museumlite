"use client";

import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { usePaginatedQuery, useQuery } from "convex/react";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { PermissionGate } from "@/components/permission-gate";
import { RecordRecoveryState } from "@/components/record-recovery-state";
import { useCurrentMinute } from "@/hooks/use-current-minute";
import { useRecordViewState } from "@/hooks/use-return-path";
import { useScopedI18n } from "@/locales/client";
import { EnvironmentReadingList } from "../../_components/environment/environment-readings";
import {
  EpisodeFacts,
  EpisodeStatusPill,
} from "../../_components/environment/episode-facts";
import { ResolveEpisodeDialog } from "../../_components/environment/resolve-episode-dialog";

const READINGS_PAGE_SIZE = 25;

export default function AlertEpisodePage({
  params,
}: {
  params: Promise<{ episodeId: string }>;
}) {
  const t = useScopedI18n("locations.environment");
  const { episodeId } = use(params);
  const now = useCurrentMinute();
  const detail = useQuery(
    api.environmentalMonitoring.getEpisode,
    now === null ? "skip" : { episodeId, now },
  );
  const viewState = useRecordViewState(detail);
  const [resolving, setResolving] = useState(false);

  if (detail === undefined || now === null) {
    return (
      <div className="flex size-full items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (detail === null) {
    return (
      <RecordRecoveryState
        kind={viewState === "removed" ? "removed" : "missing"}
        list="locations"
      />
    );
  }

  const { episode, location } = detail;
  return (
    <div className="flex size-full overflow-y-auto bg-background px-4 py-6 md:px-6">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <div className="space-y-4">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="-ml-3 text-muted-foreground hover:text-foreground"
          >
            <Link href={`/locations/${location._id}`}>
              <ArrowLeft className="mr-2 size-4" aria-hidden="true" />
              {t("backToLocation", { location: location.name })}
            </Link>
          </Button>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="flex flex-wrap items-center gap-3 text-xl font-medium tracking-tight">
              {t("episodeTitle", { location: location.name })}
              <EpisodeStatusPill episode={episode} />
            </h1>
            {episode.status === "open" ? (
              <PermissionGate permission="locations.update">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setResolving(true)}
                >
                  {t("resolve")}
                </Button>
              </PermissionGate>
            ) : null}
          </div>
        </div>

        <EpisodeFacts episode={episode} now={now} />

        <EpisodeReadings episodeId={episode._id} />

        <ResolveEpisodeDialog
          episodeId={episode._id}
          open={resolving}
          onOpenChange={setResolving}
        />
      </div>
    </div>
  );
}

function EpisodeReadings({ episodeId }: { episodeId: Id<"alertEpisodes"> }) {
  const t = useScopedI18n("locations.environment");
  const { results, status, loadMore } = usePaginatedQuery(
    api.environmentalMonitoring.listEpisodeReadings,
    { episodeId },
    { initialNumItems: READINGS_PAGE_SIZE },
  );

  return (
    <section
      aria-labelledby="episode-readings-heading"
      className="space-y-3 border-t border-border/60 pt-5 dark:border-white/10"
    >
      <h2 id="episode-readings-heading" className="text-sm font-medium">
        {t("evidenceHeading")}
      </h2>
      <p className="text-xs text-muted-foreground">
        {t("evidenceDescription")}
      </p>
      {status === "LoadingFirstPage" ? (
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      ) : (
        <EnvironmentReadingList readings={results} />
      )}
      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={status === "LoadingMore"}
          onClick={() => loadMore(READINGS_PAGE_SIZE)}
        >
          {t("loadMoreReadings")}
        </Button>
      ) : null}
    </section>
  );
}
