import {
  type SubscriptionTier,
  TIER_LIMITS,
} from "@v1/backend/convex/utils/featurePolicy";
import type { WebMessageKey } from "@/locales/messages";

export type BillingInterval = "month" | "year";

export interface PricingPlan {
  tier: SubscriptionTier;
  name: string;
  description: string;
  priceAmount: number;
  interval: BillingInterval | null;
  features: string[];
  cta: string;
  featured?: boolean;
}

type Translate = (
  key: WebMessageKey,
  values?: Record<string, string | number>,
) => string;

const PAID_PLAN_PRICES = {
  pro: { month: 2000, year: 20000 },
  enterprise: { month: 9900, year: 99000 },
} as const;

function formatStorage(bytes: number): string {
  const gigabytes = bytes / (1024 * 1024 * 1024);
  return `${gigabytes} GB`;
}

function formatLimit(
  value: number | null,
  singular: string,
  plural: string,
  translate: Translate,
) {
  if (value === null)
    return translate("marketing.pricing.unlimited", { feature: plural });
  return translate("marketing.pricing.upTo", {
    count: value,
    feature: value === 1 ? singular : plural,
  });
}

function formatStorageLimit(
  bytes: number | null,
  translate: Translate,
): string {
  if (bytes === null)
    return translate("marketing.pricing.unlimited", {
      feature: translate("marketing.pricing.storage"),
    });
  return translate("marketing.pricing.storageUpTo", {
    size: formatStorage(bytes),
  });
}

function getTierFeatures(
  tier: SubscriptionTier,
  translate: Translate,
): string[] {
  const limits = TIER_LIMITS[tier];
  const features = [
    formatLimit(
      limits.objects,
      translate("marketing.pricing.object"),
      translate("marketing.pricing.objects"),
      translate,
    ),
    formatStorageLimit(limits.mediaBytes, translate),
    formatLimit(
      limits.users,
      translate("marketing.pricing.teamMember"),
      translate("marketing.pricing.teamMembers"),
      translate,
    ),
    formatLimit(
      limits.exportsPerMonth,
      translate("marketing.pricing.export"),
      translate("marketing.pricing.exportsPerMonth"),
      translate,
    ),
  ];

  if (tier === "free") {
    features.push(
      translate("marketing.pricing.featureCatalog"),
      translate("marketing.pricing.featureMedia"),
      translate("marketing.pricing.featureNoCard"),
    );
    return features;
  }

  features.push(
    translate("marketing.pricing.featureLoans"),
    translate("marketing.pricing.featureReporting"),
    translate("marketing.pricing.featureInstallations"),
  );

  if (tier === "enterprise") {
    features.push(
      translate("marketing.pricing.featureCompliance"),
      translate("marketing.pricing.featureSupport"),
    );
  }

  return features;
}

function getPaidPlan(
  tier: "pro" | "enterprise",
  interval: BillingInterval,
  translate: Translate,
): PricingPlan {
  return {
    tier,
    name: tier === "pro" ? "Pro" : "Enterprise",
    description: translate(
      tier === "pro"
        ? "marketing.pricing.proDescription"
        : "marketing.pricing.enterpriseDescription",
    ),
    priceAmount: PAID_PLAN_PRICES[tier][interval],
    interval,
    features: getTierFeatures(tier, translate),
    cta: translate("marketing.pricing.getStarted"),
    featured: tier === "pro",
  };
}

export function getPricingPlans(
  interval: BillingInterval,
  translate: Translate,
): PricingPlan[] {
  return [
    {
      tier: "free",
      name: translate("marketing.pricing.free"),
      description: translate("marketing.pricing.freeDescription"),
      priceAmount: 0,
      interval: null,
      features: getTierFeatures("free", translate),
      cta: translate("marketing.pricing.getStarted"),
    },
    getPaidPlan("pro", interval, translate),
    getPaidPlan("enterprise", interval, translate),
  ];
}

export function formatPlanPrice(amount: number) {
  if (amount === 0) {
    return { price: "$0", sub: "" };
  }

  const dollars = amount / 100;
  const formatted = Number.isInteger(dollars)
    ? `$${dollars}`
    : `$${dollars.toFixed(2)}`;

  return { price: formatted };
}
