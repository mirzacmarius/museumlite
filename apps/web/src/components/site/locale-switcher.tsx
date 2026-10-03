"use client";

import { cn } from "@v1/ui/utils";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { localeNames, locales } from "@/locales/messages";
import { persistWebLocale } from "@/locales/persist";
import { useWebI18n } from "@/locales/provider";

export function LocaleSwitcher({ className = "" }: { className?: string }) {
  const { locale, t } = useWebI18n();
  const { refresh } = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(value: string) {
    const nextLocale = locales.find((supported) => supported === value);
    if (!nextLocale || nextLocale === locale) return;

    startTransition(async () => {
      await persistWebLocale(nextLocale);
      refresh();
    });
  }

  return (
    <label className={cn("inline-flex items-center", className)}>
      <span className="sr-only">{t("common.language.label")}</span>
      <select
        aria-label={t("common.language.label")}
        value={locale}
        disabled={isPending}
        onChange={(event) => void handleChange(event.target.value)}
        className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
      >
        {locales.map((supportedLocale) => (
          <option key={supportedLocale} value={supportedLocale}>
            {localeNames[supportedLocale]}
          </option>
        ))}
      </select>
    </label>
  );
}
