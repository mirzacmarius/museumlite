type AccessionsStatsData = {
  pending: number;
  approved: number;
};

type AccessionsStatsProps = {
  stats?: AccessionsStatsData | null;
};

export function AccessionsStats({ stats }: AccessionsStatsProps) {
  return (
    <div className="flex gap-8">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Pending
        </span>
        <span className="text-2xl font-semibold tracking-tight text-white">
          {stats?.pending ?? "-"}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Approved
        </span>
        <span className="text-2xl font-semibold tracking-tight text-white">
          {stats?.approved ?? "-"}
        </span>
      </div>
    </div>
  );
}
