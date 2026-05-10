import { DashboardListPageSkeleton } from "@/components/dashboard-list-page-skeleton";

export default function InsuranceLoading() {
  return (
    <DashboardListPageSkeleton
      actionsCount={2}
      filtersCount={2}
      layout="list"
    />
  );
}
