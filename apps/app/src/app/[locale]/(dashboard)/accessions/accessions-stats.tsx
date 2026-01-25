type AccessionsStatsData = {
  pending: number;
  approved: number;
};

type AccessionsStatsProps = {
  stats?: AccessionsStatsData | null;
};

export function AccessionsStats({ stats }: AccessionsStatsProps) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
          Pending
        </span>
        <span className="text-2xl font-semibold tracking-tight text-white">
          {stats?.pending ?? "-"}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
          Approved
        </span>
        <span className="text-2xl font-semibold tracking-tight text-white">
          {stats?.approved ?? "-"}
        </span>
      </div>
    </div>
  );
}
