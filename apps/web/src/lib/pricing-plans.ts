import {
  TIER_LIMITS,
  type SubscriptionTier,
} from "@v1/backend/convex/utils/featurePolicy";

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

const PAID_PLAN_COPY = {
  pro: {
    description: "Advanced workflows and reporting for growing collections.",
  },
  enterprise: {
    description: "Unlimited capacity and premium controls for larger teams.",
  },
} as const;

const PAID_PLAN_PRICES = {
  pro: { month: 2000, year: 20000 },
  enterprise: { month: 9900, year: 99000 },
} as const;

function formatStorage(bytes: number): string {
  const gigabytes = bytes / (1024 * 1024 * 1024);
  return `${gigabytes} GB`;
}

function formatLimit(value: number | null, singular: string, plural: string) {
  if (value === null) return `Unlimited ${plural}`;
  return `Up to ${value} ${value === 1 ? singular : plural}`;
}

function formatStorageLimit(bytes: number | null): string {
  if (bytes === null) return "Unlimited storage";
  return `Up to ${formatStorage(bytes)} storage`;
}

function getTierFeatures(tier: SubscriptionTier): string[] {
  const limits = TIER_LIMITS[tier];
  const features = [
    formatLimit(limits.objects, "object", "objects"),
    formatStorageLimit(limits.mediaBytes),
    formatLimit(limits.users, "team member", "team members"),
    formatLimit(limits.exportsPerMonth, "export", "exports per month"),
  ];

  if (tier === "free") {
    features.push(
      "Object catalog, accessions & locations",
      "Media library",
      "No credit card required",
    );
    return features;
  }

  features.push(
    "Loans, exhibitions & conservation",
    "Reporting & public portal",
    "Installations module",
  );

  if (tier === "enterprise") {
    features.push("Compliance & audit controls", "Priority support");
  }

  return features;
}

function getPaidPlan(
  tier: "pro" | "enterprise",
  interval: BillingInterval,
): PricingPlan {
  return {
    tier,
    name: tier === "pro" ? "Pro" : "Enterprise",
    description: PAID_PLAN_COPY[tier].description,
    priceAmount: PAID_PLAN_PRICES[tier][interval],
    interval,
    features: getTierFeatures(tier),
    cta: "Get started",
    featured: tier === "pro",
  };
}

export function getPricingPlans(interval: BillingInterval): PricingPlan[] {
  return [
    {
      tier: "free",
      name: "Free",
      description: "Core collection tools to get started — free forever.",
      priceAmount: 0,
      interval: null,
      features: getTierFeatures("free"),
      cta: "Start for free",
    },
    getPaidPlan("pro", interval),
    getPaidPlan("enterprise", interval),
  ];
}

export function formatPlanPrice(amount: number, interval: BillingInterval | null) {
  if (amount === 0) {
    return { price: "$0", sub: "" };
  }

  const dollars = amount / 100;
  const formatted = Number.isInteger(dollars)
    ? `$${dollars}`
    : `$${dollars.toFixed(2)}`;

  return {
    price: formatted,
    sub: interval === "year" ? "/ year" : "/ month",
  };
}
