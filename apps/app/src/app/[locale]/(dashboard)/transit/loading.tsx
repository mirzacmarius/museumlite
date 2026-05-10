import { DashboardListPageSkeleton } from "@/components/dashboard-list-page-skeleton";

export default function TransitLoading() {
  return (
    <DashboardListPageSkeleton
      actionsCount={1}
      filtersCount={2}
      layout="list"
    />
  );
}
