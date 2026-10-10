/**
 * Runs one checkpoint page of a bounded job from an action. A failed page
 * rolls back entirely, so it is retried with fewer rows (dense rows can
 * exceed per-transaction platform limits at the default size). Only a failure
 * at a single row reaches `fail`, which records it while the job keeps its
 * last committed checkpoint for a retry.
 */
export async function runCheckpointPage({
  pageSize,
  apply,
  fail,
}: {
  pageSize: number;
  apply: (pageSize: number) => Promise<unknown>;
  fail: (message: string) => Promise<unknown>;
}) {
  let rows = pageSize;
  for (;;) {
    try {
      await apply(rows);
      return;
    } catch (error) {
      if (rows > 1) {
        rows = Math.max(1, Math.floor(rows / 2));
        continue;
      }
      await fail(error instanceof Error ? error.message : String(error));
      return;
    }
  }
}
