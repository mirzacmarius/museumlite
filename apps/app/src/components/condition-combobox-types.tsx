import { AlertOctagon, Edit3, Gem, ShieldCheck, Sparkles } from "lucide-react";
import type * as React from "react";

export interface ConditionOption {
  value: string;
  label: string;
  description: string;
  id?: string;
  icon?: React.ReactNode;
}

export const STANDARD_CONDITIONS: ConditionOption[] = [
  {
    value: "Excellent",
    label: "Excellent",
    description:
      "New or mint condition. Either purchased new or has been well curated since it was made.",
    icon: <Gem className="size-3.5 text-emerald-500" />,
  },
  {
    value: "Very Good",
    label: "Very Good",
    description:
      "Shows some minor signs of use or age. Wear is normal, no visible damage.",
    icon: <Sparkles className="size-3.5 text-cyan-500" />,
  },
  {
    value: "Good",
    label: "Good",
    description:
      "Item is aged or faded and may show minor damage but remains structurally sound.",
    icon: <ShieldCheck className="size-3.5 text-blue-500" />,
  },
  {
    value: "Poor",
    label: "Poor",
    description:
      "Item exhibits severe damage or heavy use and would require extensive stabilization, restoration or conservation.",
    icon: <AlertOctagon className="size-3.5 text-red-500" />,
  },
];

export function getConditionIcon(conditionValue: string): React.ReactNode {
  const standardCondition = STANDARD_CONDITIONS.find(
    (c) => c.value.toLowerCase() === conditionValue.toLowerCase(),
  );

  if (standardCondition) {
    return standardCondition.icon;
  }

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
