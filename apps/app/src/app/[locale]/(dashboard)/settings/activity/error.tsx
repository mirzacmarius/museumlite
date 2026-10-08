"use client";

import { Button } from "@v1/ui/button";
import { useRouter } from "next/navigation";
import { useScopedI18n } from "@/locales/client";

export default function HistoryError({
  unstable_retry,
}: {
  error: Error;
  unstable_retry: () => void;
}) {
  const t = useScopedI18n("activityLog");
  const { replace } = useRouter();
  return (
    <div role="alert" className="space-y-4 rounded-lg border border-border p-6">
      <p>{t("unavailable")}</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={unstable_retry}>{t("retry")}</Button>
        <Button
          variant="outline"
          onClick={() => {
            replace(window.location.pathname);
            unstable_retry();
          }}
        >
          {t("clearFilters")}
        </Button>
      </div>
    </div>
  );
}
