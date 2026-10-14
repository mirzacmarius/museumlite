"use client";

import { api } from "@v1/backend/convex/_generated/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@v1/ui/select";
import { cn } from "@v1/ui/utils";
import { useMutation } from "convex/react";
import { Languages } from "lucide-react";
import { toast } from "sonner";
import {
  useChangeLocale,
  useCurrentLocale,
  useScopedI18n,
} from "@/locales/client";

export function LanguageSwitcher({ triggerClass }: { triggerClass?: string }) {
  const changeLocale = useChangeLocale();
  const locale = useCurrentLocale();
  const setPreference = useMutation(api.userPreferences.set);
  const t = useScopedI18n("untranslatedDashboard.languageSwitcher");

  const handleLocaleChange = async (nextLocale: string) => {
    try {
      await setPreference({ key: "language", value: nextLocale });
    } catch {
      toast.error(t("saveFailed"));
    }
    changeLocale(nextLocale as "en" | "fr" | "es" | "no" | "ro");
  };

  const langs = [
    { text: "English", value: "en" },
    { text: "Français", value: "fr" },
    { text: "Español", value: "es" },
    { text: "Norsk", value: "no" },
    { text: "Română", value: "ro" },
  ];
  const formatLanguage = (lng: string) => {
    return langs.find((lang) => lang.value === lng)?.text;
  };

  return (
    <Select value={locale} onValueChange={handleLocaleChange}>
      <SelectTrigger
        className={cn(
          "h-6 rounded border-primary/20 bg-secondary !px-2 hover:border-primary/40",
          triggerClass,
        )}
      >
        <div className="flex items-start gap-2">
          <Languages className="size-[14px]" />
          <span className="text-xs font-medium">{formatLanguage(locale)}</span>
        </div>
      </SelectTrigger>
      <SelectContent>
        {langs.map(({ text, value }) => (
          <SelectItem
            key={value}
            value={value}
            className="text-sm font-medium text-primary/60"
          >
            {text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
