import { DashboardListPageSkeleton } from "@/components/dashboard-list-page-skeleton";

export default function AccountsLoading() {
  return (
    <DashboardListPageSkeleton
      actionsCount={3}
      filtersCount={1}
      layout="list"
    />
  );
}
