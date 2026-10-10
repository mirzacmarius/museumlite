"use client";

import { RecordErrorRecovery } from "@/components/record-recovery-state";

export default function AlertEpisodeError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <RecordErrorRecovery
      error={error}
      list="locations"
      retry={unstable_retry}
    />
  );
}
