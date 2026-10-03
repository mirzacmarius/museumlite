"use client";

import { Button } from "@v1/ui/button";
import { Lock } from "lucide-react";
import Link from "next/link";
import { formatUiMessage, useUiLocale } from "../locale";

interface FeatureGuardProps {
  children: React.ReactNode;
  isLocked: boolean;
  featureName: string;
  description?: string;
  tierNeeded?: "pro" | "enterprise";
  showUpgrade?: boolean;
}

export function FeatureGuard({
  children,
  isLocked,
  featureName,
  description,
  tierNeeded = "pro",
  showUpgrade = true,
}: FeatureGuardProps) {
  const { messages } = useUiLocale();
  if (isLocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] w-full border border-white/10 rounded-lg bg-zinc-950/20 p-8 text-center animate-in fade-in duration-500">
        <div className="size-12 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10">
          <Lock className="size-6 text-white/40" />
        </div>
        <h3 className="text-xl font-medium text-white mb-2">
          {formatUiMessage(messages.featureGuard.locked, { featureName })}
        </h3>
        <p className="text-white/60 max-w-md mb-6">
          {description ?? messages.featureGuard.unavailable}
        </p>

        {showUpgrade && (
          <Button
            asChild
            size="lg"
            className="bg-white text-black hover:bg-white/90"
          >
            <Link href="/settings/billing">
              {formatUiMessage(messages.featureGuard.upgradeTo, {
                tier: messages.featureGuard.tiers[tierNeeded],
              })}
            </Link>
          </Button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
