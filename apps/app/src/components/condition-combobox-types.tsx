import { AlertOctagon, Edit3, Gem, ShieldCheck, Sparkles } from "lucide-react";
import type * as React from "react";

export interface ConditionOption {
  value: string;
  label: string;
  description: string;
  id?: string;
  icon?: React.ReactNode;
}

export function getStandardConditions(
  translate: (key: string) => string,
): ConditionOption[] {
  return [
    {
      value: "Excellent",
      label: translate("untranslatedComponents.conditions.excellent"),
      description: translate(
        "untranslatedComponents.conditions.excellentDescription",
      ),
      icon: <Gem className="size-3.5 text-emerald-500" />,
    },
    {
      value: "Very Good",
      label: translate("untranslatedComponents.conditions.veryGood"),
      description: translate(
        "untranslatedComponents.conditions.veryGoodDescription",
      ),
      icon: <Sparkles className="size-3.5 text-cyan-500" />,
    },
    {
      value: "Good",
      label: translate("untranslatedComponents.conditions.good"),
      description: translate(
        "untranslatedComponents.conditions.goodDescription",
      ),
      icon: <ShieldCheck className="size-3.5 text-blue-500" />,
    },
    {
      value: "Poor",
      label: translate("untranslatedComponents.conditions.poor"),
      description: translate(
        "untranslatedComponents.conditions.poorDescription",
      ),
      icon: <AlertOctagon className="size-3.5 text-red-500" />,
    },
  ];
}

export function getConditionIcon(conditionValue: string): React.ReactNode {
  if (conditionValue.toLowerCase() === "excellent")
    return <Gem className="size-3.5 text-emerald-500" />;
  if (conditionValue.toLowerCase() === "very good")
    return <Sparkles className="size-3.5 text-cyan-500" />;
  if (conditionValue.toLowerCase() === "good")
    return <ShieldCheck className="size-3.5 text-blue-500" />;
  if (conditionValue.toLowerCase() === "poor")
    return <AlertOctagon className="size-3.5 text-red-500" />;

  return <Edit3 className="size-3.5 text-purple-500" />;
}

export interface ConditionComboboxProps {
  organizationId?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function formatConditionName(name: string): string {
  const trimmed = name.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
