import { AccessionsPageSkeleton } from "../accessions/accessions-page-skeleton";

export default function DeaccessionsLoading() {
  return (
    <AccessionsPageSkeleton
      actionsCount={3}
      showWorkbenchNav={false}
      statsCount={2}
    />
  );
}
