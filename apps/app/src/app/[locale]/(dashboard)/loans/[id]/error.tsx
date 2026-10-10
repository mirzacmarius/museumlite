"use client";

import { RecordErrorRecovery } from "@/components/record-recovery-state";

export default function LoanDetailError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <RecordErrorRecovery error={error} list="loans" retry={unstable_retry} />
  );
}
