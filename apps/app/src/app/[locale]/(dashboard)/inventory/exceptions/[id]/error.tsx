"use client";

import { RecordErrorRecovery } from "@/components/record-recovery-state";

export default function InventoryExceptionError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <RecordErrorRecovery
      error={error}
      list="inventory"
      retry={unstable_retry}
    />
  );
}
