import { AccessionsPageSkeleton } from "../accessions-page-skeleton";

export default function AccessionTransfersLoading() {
  return (
    <AccessionsPageSkeleton
      actionsCount={1}
      showWorkbenchNav={true}
      statsCount={5}
    />
  );
}
