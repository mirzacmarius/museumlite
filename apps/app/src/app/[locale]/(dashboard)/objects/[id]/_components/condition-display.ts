import type { useI18n } from "@/locales/client";

type Translator = ReturnType<typeof useI18n>;

export function formatConditionLabel(
  condition: string | null | undefined,
  translate: Translator,
): string | undefined {
  if (condition == null) return undefined;

  const normalized = condition.trim().toLowerCase();
  switch (normalized) {
    case "excellent":
      return translate("untranslatedComponents.conditions.excellent");
    case "very good":
      return translate("untranslatedComponents.conditions.veryGood");
    case "good":
      return translate("untranslatedComponents.conditions.good");
    case "poor":
      return translate("untranslatedComponents.conditions.poor");
    default:
      return condition;
  }
}
