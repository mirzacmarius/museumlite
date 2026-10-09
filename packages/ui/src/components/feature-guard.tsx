"use client";

import { Button } from "@v1/ui/button";
import { Lock } from "lucide-react";
import Link from "next/link";
import { formatUiMessage, useUiLocale } from "../locale";

/** Why a feature is unavailable; each reason names who can change it. */
export type FeatureGuardReason =
  | { kind: "tier_required"; tier: "pro" | "enterprise" }
  | { kind: "module_disabled" }
  | { kind: "permission_missing" };

interface FeatureGuardProps {
  children: React.ReactNode;
  featureName: string;
  /** Null renders the children. */
  reason: FeatureGuardReason | null;
  /** Extra context shown above the reason. */
  description?: string;
  /** Link to the settings page that resolves the reason (administrators only). */
  showAction?: boolean;
}

export function FeatureGuard({
  children,
  featureName,
  reason,
  description,
  showAction = true,
}: FeatureGuardProps) {
  const { messages } = useUiLocale();
  if (!reason) return <>{children}</>;

  const copy = messages.featureGuard;
  const explanation =
    reason.kind === "tier_required"
      ? formatUiMessage(copy.tierRequired, { tier: copy.tiers[reason.tier] })
      : reason.kind === "module_disabled"
        ? copy.moduleDisabled
        : copy.permissionMissing;
  const action =
    !showAction || reason.kind === "permission_missing"
      ? null
      : reason.kind === "tier_required"
        ? {
            href: "/settings/billing",
            label: formatUiMessage(copy.upgradeTo, {
              tier: copy.tiers[reason.tier],
            }),
          }
        : { href: "/settings/modules", label: copy.openModules };

  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center min-h-[400px] w-full border border-white/10 rounded-lg bg-zinc-950/20 p-8 text-center animate-in fade-in duration-500"
    >
      <div className="size-12 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10">
        <Lock aria-hidden="true" className="size-6 text-white/40" />
      </div>
      <h3 className="text-xl font-medium text-white mb-2">
        {formatUiMessage(copy.locked, { featureName })}
      </h3>
      {description ? (
        <p className="text-white/60 max-w-md mb-2">{description}</p>
      ) : null}
      <p className="text-white/60 max-w-md mb-6">{explanation}</p>

      {action ? (
        <Button
          asChild
          size="lg"
          className="bg-white text-black hover:bg-white/90"
        >
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : null}
    </div>
  );
}
