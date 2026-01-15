"use client";

import { CheckoutLink } from "@convex-dev/polar/react";
import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { useQuery } from "convex/react";
import { Lock } from "lucide-react";

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
  description = "Upgrade your plan to access this feature.",
  tierNeeded = "pro",
  showUpgrade = true,
}: FeatureGuardProps) {
  const products = useQuery(api.subscriptions.listAllProducts);

  const upgradeProduct = products?.find(
    (product) =>
      product.name.toLowerCase().includes(tierNeeded) &&
      product.recurringInterval === "month",
  );

  const yearlyUpgradeProduct = products?.find(
    (product) =>
      product.name.toLowerCase().includes(tierNeeded) &&
      product.recurringInterval === "year",
  );

  if (isLocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] w-full border border-white/10 rounded-lg bg-black/20 p-8 text-center animate-in fade-in duration-500">
        <div className="size-12 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10">
          <Lock className="size-6 text-white/40" />
        </div>
        <h3 className="text-xl font-medium text-white mb-2">
          {featureName} is locked
        </h3>
        <p className="text-white/60 max-w-md mb-6">{description}</p>

        {showUpgrade && upgradeProduct && yearlyUpgradeProduct && (
          <Button
            asChild
            size="lg"
            className="bg-white text-black hover:bg-white/90"
          >
            <CheckoutLink
              polarApi={api.subscriptions}
              productIds={[upgradeProduct.id, yearlyUpgradeProduct.id]}
            >
              Upgrade to{" "}
              {tierNeeded.charAt(0).toUpperCase() + tierNeeded.slice(1)}
            </CheckoutLink>
          </Button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
