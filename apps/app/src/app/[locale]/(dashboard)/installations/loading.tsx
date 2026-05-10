import { DashboardListPageSkeleton } from "@/components/dashboard-list-page-skeleton";

export default function InstallationsLoading() {
  return (
    <DashboardListPageSkeleton
      actionsCount={1}
      filtersCount={1}
      gridColumns="lg:grid-cols-4"
    />
  );
}
