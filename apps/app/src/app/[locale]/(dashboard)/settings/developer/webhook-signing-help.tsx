"use client";

import { useScopedI18n } from "@/locales/client";

export function WebhookSigningHelp() {
  const t = useScopedI18n("webhookDeliveries");
  return (
    <details className="rounded-lg border border-white/10 p-4 text-sm">
      <summary className="cursor-pointer font-medium">
        {t("signing.title")}
      </summary>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
        <li>{t("signing.signature")}</li>
        <li>{t("signing.signatureV2")}</li>
        <li>{t("signing.duplicates")}</li>
        <li>{t("signing.retries")}</li>
      </ul>
    </details>
  );
}
