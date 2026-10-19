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
      className="flex flex-col items-center justify-center min-h-[400px] w-full border border-border rounded-lg bg-muted/30 p-8 text-center"
    >
      <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-4 border border-border">
        <Lock aria-hidden="true" className="size-6 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-medium text-foreground mb-2">
        {formatUiMessage(copy.locked, { featureName })}
      </h3>
      {description ? (
        <p className="text-muted-foreground max-w-md mb-2">{description}</p>
      ) : null}
      <p className="text-muted-foreground max-w-md mb-6">{explanation}</p>

      {action ? (
        <Button asChild size="lg">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : null}
    </div>
  );
}
